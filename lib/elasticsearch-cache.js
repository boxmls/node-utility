const _ = require('lodash');
const colors = require('colors');
const moment = require('moment');
const client = require('./elasticsearch')();
const crypto = require('crypto');

// ElasticSearch
const index = 'cache';
const type = 'cache';

module.exports = class ElasticSearchCache {

  constructor(options) {

    this.options = _.defaults(options, {
      es_client: client,
      default_ttl: 3600
    });
  }

  /**
   * Retrieving cache document by key
   *
   * @param key - cache key (might be a string or object)
   * @returns {Promise}
   */
  get(key) {
    return new Promise((resolve, reject) => {

      if (!key) {
        let err = 'cache.get: Missed key parameter.';

        console.error(err);
        resolve({
          ok: false,
          err: err
        });
      }

      if (typeof key === 'object') {
        key = JSON.stringify(key, Object.getOwnPropertyNames(key));
      }

      let _id = crypto.createHash('sha1').update(key).digest('hex');

      console.log('cache.get: Requesting cache [%s]', colors.green(key));

      this.options.es_client.get({
        "index": index,
        "type": type,
        "id": _id
      }, (err, _doc) => {


        if (err) {
          console.error('cache.get: Could not retrieve the agent subdomain cache [%s].', colors.red(key));
          resolve({
            ok: true,
            data: null
          });
        } else {

          if (_.get(_doc, 'found')) {

            // Retrieving source from entire document
            let _source = _.get(_doc, '_source');

            // Trying to parse JSON from a body and resolve it in case it has a correct format
            try {
              console.log('cache.get: Successfully received cache [%s]', colors.green(key));

              let _body = JSON.parse(_.get(_source, 'body'));

              // Determine if the document is expired - flush it and respond with empty object.
              if (moment().format() > moment(_.get(_source, 'date')).add(_.get(_source, 'expires', this.options.default_ttl), 's').format()) {

                console.log('cache.get: Document is expired, so returning empty response [%s].', colors.green(key));
                _body = null;
              }

              resolve({
                ok: true,
                data: _body
              });
            } catch (err) {
              console.error('cache.get: ID - [%s] is duplicated in ES database, something weird happens.', colors.red(key));
              resolve({
                ok: false,
                err: err
              });
            }
          } else {
            console.log('cache.get: Missed cache doc [%s]', colors.green(key));
            resolve({
              ok: true,
              data: null
            });
          }
        }
      });
    });
  }

  /**
   * Indexing cache document
   *
   * @param key - cache key (might be a string or object)
   * @param body - document body object which should be cached
   * @param ttl - time to live for cache document
   * @param additionalItems
   * @returns {Promise}
   */

  set(key, body, ttl, additionalItems) {

    return new Promise((resolve, reject) => {

      if (!key) {
        let err = 'cache.set: Missed key parameter.';
        console.error(err);
        reject(err);
      }

      if (typeof key === 'object') {
        key = JSON.stringify(key, Object.getOwnPropertyNames(key));
      }

      let _id = crypto.createHash('sha1').update(key).digest('hex');

      let branch = _.get(process.env, 'GIT_BRANCH', 'production');

      let _doc = Object.assign({
        'expires': ttl || this.options.default_ttl,
        'body': JSON.stringify(body),
        'date': moment().format(),
        'service': _.get(process.env, 'GIT_NAME', ''),
        'branch': _.get(process.env, 'GIT_BRANCH', 'production'),
        'ENV': branch === 'production' ? 'production' : 'development'
      }, additionalItems);

      if (typeof additionalItems !== 'undefined') {
        _doc = Object.assign(_doc, _.map(additionalItems, item => item.toString()));
      }

      console.log('cache.set: Indexing cache [%s]', colors.green(key));

      this.options.es_client.index({
        "index": index,
        "type": type,
        "id": _id,
        "body": _doc
      }, (err, data) => {
        if (err) {
          console.error('cache.set: Could not index the cache .', colors.red(key));
          console.error(err);
          reject(err);
        } else {
          console.log('cache.set: Successfully indexed cache [%s] ', colors.green(key));
          resolve({ok: true});
        }
      });
    });
  }

  /**
   * Removing cache document by key
   *
   * @param key - cache key (might be a string or object)
   * @returns {Promise}
   */
  flush(key) {

    return new Promise((resolve, reject) => {

      if (!key) {
        let err = 'cache.set: Missed key parameter.';
        console.error(err);
        reject(err);
      }

      if (typeof key === 'object') {
        key = JSON.stringify(key, Object.getOwnPropertyNames(key));
      }

      let _id = crypto.createHash('sha1').update(key).digest('hex');

      console.log('cache.flush: Flushing cache by ES document id [%s]', colors.green(_id));

      this.options.es_client.delete({
        "index": index,
        "type": type,
        "id": _id
      }, function haveResponse(err, data) {

        if (err) {
          console.error('cache.flush: Could not remove the cache [%s].', colors.red(_id));
          reject(err);
        } else {
          console.log('cache.flush: Successfully removed cache [%s]', colors.green(_id));
          resolve({ok: true});
        }
      });
    });
  }
};

