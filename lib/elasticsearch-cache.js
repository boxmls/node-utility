const _ = require('lodash');
const colors = require('colors');
const crypto = require('crypto');
const debug = require('debug')('elasticsearch-cache');
const moment = require('moment');

// ElasticSearch
const index = 'cache';
const type = 'cache';

module.exports = class ElasticSearchCache {

  constructor(options) {

    this.options = _.defaults(options, {
      default_ttl: 3600
    });

    if (!options.es_client) {
      this.options.es_client = require('./elasticsearch')();
    }
  }

  /**
   * Retrieving cache document by key
   *
   * @param key - cache key (might be a string or object)
   * @returns {Promise}
   */
  get(key) {
    return new Promise((resolve, reject) => {

      let _id;

      try {
        _id = this.buildIdHash(key);

        debug('cache.get: Requesting cache [%s]', colors.green(key));

        this.options.es_client.get({
          "index": index,
          "type": type,
          "id": _id
        }, (err, _doc) => {


          if (err) {
            debug('cache.get: Could not retrieve cache [%s].', colors.red(key));
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
                debug('cache.get: Successfully received cache [%s]', colors.green(key));

                let _body = JSON.parse(_.get(_source, 'body'));

                // Determine if the document is expired - flush it and respond with empty object.
                if (moment().format() > moment(_.get(_source, 'date')).add(_.get(_source, 'expires', this.options.default_ttl), 's').format()) {

                  debug('cache.get: Document is expired, so returning empty response [%s].', colors.green(key));
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
              debug('cache.get: Missed cache doc [%s]', colors.green(key));
              resolve({
                ok: true,
                data: null
              });
            }
          }
        });
      } catch (e) {
        resolve({
          ok: false,
          err: e
        });
      }
    });
  }

  /**
   * Indexing cache document
   *
   * @param key - cache key (might be a string or object)
   * @param body - document body object which should be cached
   * @param ttl - time to live for cache document
   * @returns {Promise}
   */

  set(key, body, ttl) {

    return new Promise((resolve, reject) => {

      let _id;

      try {
        _id = this.buildIdHash(key);

        let _doc = {
          'branch': _.get(process.env, 'GIT_BRANCH', 'production'),
          'date': moment().format(),
          'expires': ttl || this.options.default_ttl,
          'key': key,
          'service': _.get(process.env, 'GIT_NAME', ''),
          'body': JSON.stringify(body)
        };

        debug('cache.set: Indexing cache [%s]', colors.green(key));

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
            debug('cache.set: Successfully indexed cache [%s] ', colors.green(key));
            resolve({ok: true});
          }
        });
      } catch (e) {
        reject(e);
      }
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

      let _id;

      try {
        _id = this.buildIdHash(key);

        debug('cache.flush: Flushing cache by ES document id [%s]', colors.green(_id));

        this.options.es_client.delete({
          "index": index,
          "type": type,
          "id": _id
        }, (err, data) => {

          if (err) {
            console.error('cache.flush: Could not remove the cache [%s].', colors.red(_id));
            reject(err);
          } else {
            debug('cache.flush: Successfully removed cache [%s]', colors.green(_id));
            resolve({ok: true});
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Removing cache for current service (by git name and branch)
   *
   * @returns {Promise}
   */
  flushServiceCache(){
    return new Promise((resolve, reject) => {

      try {

        let service = _.get(process.env, 'GIT_NAME', null);
        let branch = _.get(process.env, 'GIT_BRANCH', null);

        if(!service || branch){
          let err = 'cache.flushServiceCache: Missed GIT_NAME or GIT_BRANCH parameter.';

          console.error(err);
          return reject(err);
        }

        debug('cache.flush: Flushing [%s] cache for [%s] branch', colors.green(service), colors.green(branch));

        this.options.es_client.deleteByQuery({
          "index": index,
          "type": type,
          "body": {
            "query": {
              "bool": {
                "must": [
                  {
                    "term": {
                      "service": service
                    }
                  },
                  {
                    "term": {
                      "branch": branch
                    }
                  }
                ]
              }
            }
          }
        }, (err, data) => {
          if (err) {
            console.error('cache.flush: Could not remove [%s] cache for [%s] branch.', colors.red(service), colors.red(branch));
            reject(err);
          } else {
            debug('cache.flush: Successfully removed [%s] cache for [%s] branch', colors.green(service), colors.green(branch));
            resolve({ok: true});
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Build id hash from the passed key.
   * id will contain branch part to isolate cache between lifecycles
   *
   * @param key
   * @returns {*}
   */
  buildIdHash(key) {

    if (!key) {
      let err = 'cache.buildIdHash: Missed key parameter.';

      console.error(err);
      throw new Error(err);
    }

    if(!_.get(process.env, 'GIT_NAME', null) || !_.get(process.env, 'GIT_BRANCH', null)){
      let err = 'cache.buildIdHash: Missed GIT_NAME or GIT_BRANCH parameter.';

      console.error(err);
      throw new Error(err);
    }

    try {
      if (typeof key === 'object') {
        key = JSON.stringify(key, Object.getOwnPropertyNames(key));
      }

      key = key + _.get(process.env, 'GIT_BRANCH', 'production');
      return crypto.createHash('sha1').update(key).digest('hex');
    } catch (e) {
      let err = 'cache.buildIdHash: ' + e;

      console.error(err);
      throw new Error(err);
    }
  }
};

