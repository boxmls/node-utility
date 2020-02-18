/**
 * Test ElasticSearch Cache.
 *
 */

const _ = require('lodash');
let cache = require('root-require')('lib/index.js').getElasticSearchCache();
const client = require('root-require')('lib/elasticsearch')();

const cacheKey = 'mochaTest:cache';

module.exports = {

  "ping elasticsearch": (done) => {

    client.ping({
      requestTimeout: 1000
    }, (error) => {
      if (error) {
        console.trace('elasticsearch cluster is down!');
        done(error);
      } else {
        console.log('Cluster are up and reachable!');
        done();
      }
    });
  },

  "create elasticsearch index": function(done) {

    this.timeout(6000);

    client.indices.create( {
      index: 'cache',
      body: {
        "aliases": {},
        "mappings": {},
        "settings": {
          "index": {
            "number_of_shards": "3",
            "number_of_replicas": "1",
            "version": {
              "created": "2040299"
            }
          }
        },
        "warmers": {}
      }
    }, setTimeout(() =>{
      done();
    }, 5000));
  },

  "trying to retrieve cache": async function(){

    this.timeout(5000);

    await cache.get(cacheKey).then((response) => {

      response.should.have.property('ok');

      if (!_.get(response, 'ok')) {
        response.should.have.property('err');
      } else {
        response.should.have.property('data', null);
      }
    });
  },

  "set cache document": async function() {

    this.timeout(5000);

    let payload = {
      "test": "test"
    };

    await cache.set(cacheKey, payload).then(response => {
      console.log('Successfully stored cache doc [%s]', cacheKey);

      response.should.have.property('ok', true);
    }, error => {
      console.error(error);
    });
  },

  "flushing cache document": async function(){

    this.timeout(5000);

    await cache.flush(cacheKey).then((response) => {

      response.should.have.property('ok', true);
    }, error => {
      console.error(error);
    });
  }

};