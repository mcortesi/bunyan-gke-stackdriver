const Bunyan = require('bunyan');
const {createStream} = require('../dist');
const chalk = require('chalk');
const {Transform} = require('stream');

const colorize = (colorFn, outStream) => {
  const colorizeTransformer = new Transform({
    transform: (chunk, encoding, callback) => {
      callback(null, colorFn(chunk.toString()));
    },
  });

  colorizeTransformer.pipe(outStream);
  return colorizeTransformer;
};

const logger = Bunyan.createLogger({
  name: 'mylog',
  streams: [
    {
      type: 'stream',
      stream: process.stdout,
    },
    createStream(undefined, colorize(chalk.green, process.stdout)),
  ],
});

logger.info('hola que tal');

logger.info({todos: 'putos', que: 'los'}, 'pario a todos');

logger.error(new Error('esto esta mal!'));
