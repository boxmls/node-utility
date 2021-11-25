module.exports = function (options = {}) {
  const _ = require('lodash');

  let keepAlive = require('boxmls-firebase-admin').getData('elastic.keep_alive', false);
  if (keepAlive && typeof keepAlive == 'string') {
    keepAlive = [true, 'true', '1'].indexOf(keepAlive) > -1 ? true : false;
  }

  let args = _.defaults(options, {
    host: process.env.ES_ADDRESS || require('boxmls-firebase-admin').getData('elastic.address'),
    requestTimeout: 320000,
    apiVersion: '7.2',
    keepAlive
  });

  return new (require('elasticsearch')).Client(args);
};