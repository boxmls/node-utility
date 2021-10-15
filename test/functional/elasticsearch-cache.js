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
        console.error('elasticsearch cluster is down!');
        done(error);
      } else {
        done();
      }
    });
  },

  "be sure that test cache document is not exist yet": async function(){

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

  "set test cache document": async function() {

    this.timeout(5000);

    let payload = {
      "test": "test"
    };

    await cache.set(cacheKey, payload).then(response => {

      response.should.have.property('ok', true);
    }, error => {
      console.error(error);
    });
  },

  "trying to retrieve test cache after set": async function(){

    this.timeout(5000);

    await cache.get(cacheKey).then((response) => {

      response.should.have.property('ok');

      if (!_.get(response, 'ok')) {
        response.should.have.property('err');
      } else {
        response.should.not.have.property('data', null);
      }
    });
  },

  "flushing a test cache document": async function(){

    this.timeout(5000);

    await cache.flush(cacheKey).then((response) => {

      response.should.have.property('ok', true);
    }, error => {
      console.error(error);
    });
  },

  "trying to retrieve test cache document after flush": async function(){

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

  "flushing all cache documents of service": async function(){

    this.timeout(5000);

    await cache.flushServiceCache().then((response) => {

      response.should.have.property('ok', true);
    }, error => {
      console.error(error);
    });
  },

  "checking if all cache documents of service were flushed": async function(){

    this.timeout(5000);

    client.search( {
      index: 'cache',
      body: {
        "query": {
          "match_all": {}
        }
      }
    }, function ( error, response ) {

      if( !error ) {
        response.hits.should.have.property('total', 0);
      } else {
        console.error(error);
      }

    } );
  }
};