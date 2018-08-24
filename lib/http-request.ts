import http from 'http';
import {HttpRequest} from './types';

function extractLogInfo(req: http.IncomingMessage, res: http.ServerResponse): HttpRequest {
  return {
    requestMethod: req.method!,
    requestUrl: req.url!,
    // requestSize:
    status: res.statusCode,
    // responseSize:
    userAgent: req.headers['user-agent'] as string,
    // remoteIp:
    // serverIp:
    referer: req.headers['referer'] as string,
    // latency:
    cacheLookup: false,
    cacheHit: false,
    // cacheValidatedWithOriginServer:
    // cacheFillBytes:
    protocol: `HTTP/${req.httpVersion}`,
  };
}
