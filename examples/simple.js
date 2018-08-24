const Bunyan = require('bunyan');
const {createStream} = require('../dist');

const logger = Bunyan.createLogger({
  name: 'mylog',
  streams: [createStream()],
});

logger.info('hola que tal');

logger.info({todos: 'putos', que: 'los'}, 'pario a todos');

logger.error(new Error('esto esta mal!'));
