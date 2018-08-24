import {format} from 'util';
import Bunyan from 'bunyan';
import {Transform, TransformCallback, Writable} from 'stream';
import {ServiceContext, StackdriverLogEntry, Level, Severity, BunyanLogRecord} from './types';

const Level2Severity: Record<Level, Severity> = {
  [Level.FATAL]: Severity.CRITICAL,
  [Level.ERROR]: Severity.ERROR,
  [Level.WARN]: Severity.WARNING,
  [Level.INFO]: Severity.INFO,
  [Level.DEBUG]: Severity.DEBUG,
  [Level.TRACE]: Severity.DEBUG,
};

/**
 * TAKEN from bunyan source code. (but modified)
 *
 * A fast JSON.stringify that handles cycles and getter exceptions (when
 * safeJsonStringify is installed).
 *
 * This function attempts to use the regular JSON.stringify for speed, but on
 * error (e.g. JSON cycle detection exception) it falls back to safe stringify
 * handlers that can deal with cycles and/or getter exceptions.
 */
function fastAndSafeJsonStringify(rec: any): string {
  try {
    return JSON.stringify(rec);
  } catch (ex) {
    try {
      return JSON.stringify(rec, Bunyan.safeCycles());
    } catch (e) {
      return format('(Exception in JSON.stringify(rec): %j. ', e.message);
    }
  }
}

export class StackdriverTransformer extends Transform {
  constructor() {
    super({
      writableObjectMode: true,
    });
  }

  _transform(chunk: any, encoding: string, callback: TransformCallback): void {
    if (typeof chunk === 'string') {
      callback(new Error('Bad configuration. Use raw stream type on bunyan'));
      return;
    }
    let entry;
    try {
      entry = this.formatEntry(chunk);
    } catch (err) {
      callback(err);
      return;
    }
    callback(undefined, fastAndSafeJsonStringify(entry) + '\n');
  }

  /**
   * Format a bunyan record into a Stackdriver log entry.
   */
  private formatEntry(record: BunyanLogRecord): StackdriverLogEntry {
    // extract field we want to transform or discard
    const {msg, level, err, req, v, hostname, pid, ...others} = record;

    const baseEntry: StackdriverLogEntry = {
      message: msg,
      severity: Level2Severity[level],
      ...others,
    };

    if (err && err.stack) {
      baseEntry.message = err.stack;
      baseEntry.serviceContext = {
        service: record.name,
      };
    }

    if (req) {
      baseEntry.httpRequest = req;
    }

    return baseEntry;
  }
}

export function createStream(level?: Level, out?: Writable): Bunyan.Stream {
  const transformer = new StackdriverTransformer();

  transformer.pipe(out || process.stdout);

  return {
    level,
    type: 'raw',
    stream: transformer,
  };
}
