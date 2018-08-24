# Bunyan GKE Stackdriver Transport

Simple bunyan transport to leverage GKE (Google Kubernetes Engine) logging configuration for Stackdriver

## Usage

Just configure this transport for the logger:

```js
const Bunyan = require('bunyan');
const {createStream} = require('bunyan-gke-stackdriver');

const logger = Bunyan.createLogger({
  name: 'MyLogName',
  streams: [createStream()],
});
```

Optionally, you can configure the log level for the transport and the final output stream
(`stdout` by default).

```js
const Bunyan = require('bunyan');
const {createStream} = require('bunyan-gke-stackdriver');

const logger = Bunyan.createLogger({
  name: 'warnings',
  streams: [createStream(Bunyan.WARN, process.stderr)],
});
```

## The Problem

If your node application is deployed on GKE, and you've enabled logging for it (the default); all
your logs will end up in Stackdriver viewer but won't be very readable, and won't be using most
of Stackdriver features.

Bunyan uses structured logging, but with a different schema than stackdriver expect to make take
advantange of it's features.

Some of the features enabled by using this module:

- Show the correct severity (level) in stackdriver
- Show the `msg` in the summary. (Stackdriver expects a `message` key instead of `msg`)
- Render information about the request.
- Track errors in Stackdriver Error Reporting

## How does this work?

When using bunyan you can configure transports (`streams` in reality). If no one is configured, logs
go to `stdout`. In our case, we want them to go to `stdout` but with a different format. A format
that is compatible with what GKE has configured for log recolection.

So, in essence all you need to do is configure this module as the stream.

```js
const Bunyan = require('bunyan');
const {createStream} = require('bunyan-gke-stackdriver');

const logger = Bunyan.createLogger({
  name: 'MyLogName',
  streams: [createStream()],
});
```

### The lifecycle of a log entry in GKE

So, what happens when you do `logger.info('hello world')`?

First, bunyan creates a log record something like `{v: 1, level: 30, msg: 'hello world', ...}`.
Then, is passed to the configured strem, which if none was configured, is simply sending all to
`stdout`

Second, since you are running on a docker container within a node in GKE; docker will wrap that log
entry into something like

```json
{
  "stream": "stdout",
  "time": "2018-08-24T12:41:50.987184687Z",
  "log": "{\"level\":30,\"time\":1535114510986,\"msg\":\"hello world\"...}"
}
```

Lastly, since you have logging configured for GKE, there a fluentd daemon on each node. fluentd
aggregates logs from all your containers, transform them based on it's configuration, and finally
exports them. On GKE, fluentd is configured to export log entries to stackdriver. Also, it's
configured to unwrap the docker log entry and parse your original entry. It will recognize some fields
as part of the stackdriver schema and use them. But mostly it will pass all of them to stackdriver.

### The expected log entry

So, to be a good citizen with stackdriver and the fluentd configuration in GKE, we need to make a
few changes to the original entry.

1. Use `message` instead of `msg`
2. When logging an error, use `err.stack` as the value for `message`
3. When logging an http request, use `httpRequest` to log the details about it
4. Map `level` to `severity`

For more information about the stackdriver log entry schema check:

- General: https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry
- For errrors: https://cloud.google.com/error-reporting/docs/formatting-error-messages

## Log Trasformation

When in bunyan you log like:

```js
logger.info({data: {from: 'me', to: 'you'}}, 'data transfer');
```

Bunyan will generate

```json
{
  "name": "src-example", // the name configured for the log
  "level": 30, // info is level:30
  "msg": "data transfer", // your message
  "data": {"from": "me", "to": "you"}, // your log data
  "time": "2012-02-06T04:19:35.605Z",
  "src": {
    // only if use src: true while creating the logger
    "file": "/Users/trentm/tm/node-bunyan/examples/src.js",
    "line": 20,
    "func": "Wuzzle.woos"
  },
  "hostname": "banana.local",
  "pid": 123,
  "v": 0
}
```

To make stackdriver-fluentd compatible it will be transformed into:

```json
{
  "name": "src-example",
  "severity": 200, // map level into stackdriver severity
  "message": "data transfer", // change msg to message
  "data": {"from": "me", "to": "you"}, // your log data
  "time": "2012-02-06T04:19:35.605Z",
  "src": {
    // only if use src: true while creating the logger
    "file": "/Users/trentm/tm/node-bunyan/examples/src.js",
    "line": 20,
    "func": "Wuzzle.woos"
  }
  // erase not important keys v, pid, hostname
}
```

### For Errors

when logging an error with bunyan:

```js
log.info(err); // Special case to log an `Error` instance to the record.
// This adds an "err" field with exception details
// (including the stack) and sets "msg" to the exception
// message.
log.info(err, 'more on this: %s', more);
// ... or you can specify the "msg".
```

Bunyan by default, will keep your error in `err` key. We will use the `err.stack` and set it
as the `message`, since that what's required by stackdriver.

Also, the error log entry for stackdriver requires us to set:

```ts
  "serviceContext": {
    "service": string,     // Required.
    "version": string
  },
```

We will use the `name` configured as `serviceContext.name`.

Thanks to this, you can track your error ocurrences in https://cloud.google.com/error-reporting/

## Other options

You can bypass fluentd & docker all together and log directly by calling the stackdriver API. I'm
not pro using a http transport for log within the applicaton, since every application will be
doing it's own buffering and sending, plus you will be loosing context information like the
node & pod id.

But, if that's not a proble, simply use https://github.com/googleapis/nodejs-logging-bunyan.
