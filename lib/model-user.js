/**
 * User Model
 *
 * @author peshkov@UD
 */
let config = require( '../package.json').config,
    client = new (require( 'elasticsearch' )).Client( {host: ( process.env.ES_ADDRESS || config.es_address )} );

Object.defineProperties( module.exports, {

  findByEmail: {
    /**
     * Returns user by email
     *
     * @param email
     * @param done
     */
    value: function findByEmail( email, callback ) {
      client.search( {
        index: '.system',
        type: 'user',
        body: {
          "query": {
            "filtered": {
              "filter": {
                "term": {
                  "email": email
                }
              }
            }
          }
        }
      }, function haveResponse( error, data ) {
        //console.log( 'findByEmail.haveResponse', error, data );
        if( !data.hits || data.hits.total == 0 ) {
          return callback( null, null );
        }
        callback( null, data.hits.hits[ 0 ]._source );
      } );
    },
    enumerable: true,
    writable: true
  },

  subdomainLookup: {
    /**
     * Returns agent by subdomain
     *
     * @param subdomain
     * @param callback
     */
    value: function subdomainLookup( subdomain, callback ) {
      client.search({
        index: '.system',
        type: 'user',
        body: {
          "query": {
            "bool": {
              "must": [
                {
                  "term": {
                    "subdomain": subdomain
                  }
                },
                {
                  "term": {
                    "isAgent": true
                  }
                }
              ]
            }
          }
        }
      }, function haveResponse(error, data) {
        if (data.hits.total == 0) {
          return callback(new Error("No agent found with that subdomain"));
        }
        return callback(null, data.hits.hits[0]._source);
      });
    },
    enumerable: true,
    writable: true
  },

  version: {
    value: 1.0,
    writable: false
  }

} );
