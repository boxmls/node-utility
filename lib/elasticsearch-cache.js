const _ = require('lodash');
const colors = require('colors');
const crypto = require('crypto');
const debug = require('debug')('elasticsearch-cache');
const moment = require('moment');
const utility = require('./index.js');

// ElasticSearch
const index = 'cache';
const type = 'cache';

module.exports = class ElasticSearchCache {

  constructor(options) {

    this.options = _.defaults(options, {
      default_ttl: 3600
    });

    // If wasn't passed ES client - initialize new client
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

        this.checkIfDisabled();

        _id = this.buildIdHash(key);

        debug('cache.get:[%s] Requesting cache.', colors.green(key));

        this.options.es_client.get({
          "index": index,
          "type": type,
          "id": _id
        }, (err, _doc) => {
          if (err) {
            debug('cache.get:[%s] Error - %s.', colors.red(key), err);
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
                debug('cache.get:[%s] Successfully received cache.', colors.green(key));

                let _body = JSON.parse(_.get(_source, 'body'));

                // Determine if the document is expired - flush it and respond with empty object.
                if (moment().format() > moment(_.get(_source, 'date')).add(_.get(_source, 'expires', this.options.default_ttl), 's').format()) {

                  debug('cache.get:[%s] Document is expired, so returning empty response.', colors.green(key));
                  _body = null;
                }

                resolve({
                  ok: true,
                  data: _body
                });
              } catch (err) {
                debug('cache.get:[%s] Error - %s.', colors.red(key), err);
                resolve({
                  ok: false,
                  err: err
                });
              }
            } else {
              debug('cache.get:[%s] Missed cache doc.', colors.green(key));
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

        this.checkIfDisabled();

        _id = this.buildIdHash(key);

        let _doc = {
          'branch': _.get(process.env, 'GIT_BRANCH'),
          'date': moment().format(),
          'expires': ttl || this.options.default_ttl,
          'key': key,
          'service': _.get(process.env, 'GIT_NAME'),
          'body': JSON.stringify(body)
        };

        debug('cache.set:[%s] Indexing cache.', colors.green(key));

        this.options.es_client.index({
          "index": index,
          "type": type,
          "id": _id,
          "body": _doc
        }, (err, data) => {
          if (err) {
            debug('cache.set:[%s] Error - %s.', colors.red(key), err);
            reject(err);
          } else {
            debug('cache.set:[%s] Successfully indexed cache.', colors.green(key));
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

        this.checkIfDisabled();

        _id = this.buildIdHash(key);

        debug('cache.flush:[%s] Flushing cache by ES document id.', colors.green(key));

        this.options.es_client.delete({
          "index": index,
          "type": type,
          "id": _id
        }, (err, data) => {

          if (err) {
            debug('cache.flush:[%s] Error - %s.', colors.red(key), err);
            reject(err);
          } else {
            debug('cache.flush:[%s] Successfully removed cache.', colors.green(key));
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
  flushServiceCache() {
    let self = this;

    return new Promise((resolve, reject) => {

      try {

        this.checkIfDisabled();

        let service = _.get(process.env, 'GIT_NAME', null);
        let branch = _.get(process.env, 'GIT_BRANCH', null);

        if (!service || !branch) {
          let err = 'cache.flushServiceCache:[' + colors.red(service) + ':' + colors.red(branch) + '] Error - Missed GIT_NAME or GIT_BRANCH parameter.';

          debug(err);
          return reject(err);
        }

        debug('cache.flushServiceCache:[%s:%s] Flushing cache.', colors.green(service), colors.green(branch));

        let query = {
          "client": self.options.es_client,
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
        };

        utility.scrollResults(query, (source, next, body) => {
          self.flush(_.get(source, 'key')).then(result => {
            next();
          }, error => {
            next(error);
          });
        }, (error) => {
          if (error) {
            debug('cache.flushServiceCache:[%s:%s] Error - %s.', colors.green(service), colors.green(branch), error);
            reject(error);
          } else {
            debug('cache.flushServiceCache:[%s:%s] Successfully flushed cache.', colors.green(service), colors.green(branch));
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

      debug(err);
      throw new Error(err);
    }

    if (!_.get(process.env, 'GIT_NAME', null) || !_.get(process.env, 'GIT_BRANCH', null)) {
      let err = 'cache.buildIdHash:[' + colors.red(key) + '] Error - Missed GIT_NAME or GIT_BRANCH parameter.';

      debug(err);
      throw new Error(err);
    }

    try {
      if (typeof key === 'object') {
        key = JSON.stringify(key, Object.getOwnPropertyNames(key));
      }

      key = key + _.get(process.env, 'GIT_BRANCH', 'production');
      return crypto.createHash('sha1').update(key).digest('hex');
    } catch (e) {
      let err = 'cache.buildIdHash:[' + key + '] Error - ' + e + '.';

      debug(err);
      throw new Error(err);
    }
  }

  /**
   * Checking if ES cache disabled
   * If so, then throw new error
   *
   * @returns {boolean}
   */
  checkIfDisabled(){
    if(_.get(process.env, 'ES_CACHE_DISABLED', false)){
      throw new Error('cache.isEnabled: ElasticSearch cache disabled');
    }else{
      return true;
    }
  }
};

