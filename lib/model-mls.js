/**
 * MLS Model
 *
 * @author peshkov@UD
 */
let debug = require( 'debug' )( 'bu' ),
    _ = require( 'lodash' ),
    async = require( 'async' ),
    config = require( '../package.json').config,
    request = require('request'),
    NodeCache = require( "node-cache"),
    myCache = new NodeCache();

Object.defineProperties( module.exports, {

  getAll: {
    /**
     * Returns All MLS Configs
     *
     * Caches data for 100 minutes.
     *
     * @param callback function
     */
    value: function getAll( source, callback ) {
      debug( 'getAll' );

      var _source;
      if( typeof source == "function" ) {
        callback = source;
      } else {
        _source =  Array.isArray(source) ? source.join(',') : source;
      }

      var cacheKey = 'mls.getAll:' + _source;
      var uri = 'http://api.boxmls.com/v1/mls/all/config' + (_source ? '?_source=' + _source : '');

      myCache.get(cacheKey, function (err, data ) {
        if (!_.isEmpty(data) && !process.env.CACHE_FLUSH ) {
          debug('MLS data retrieved from Cache');
          return callback( null, data );
        }

        request( {
            method: 'GET',
            uri: uri,
            headers: {
              "x-access-token": _.get( config, 'x_access_token' ),
              "x-mls-token": _.get( config, 'x_mls_token')
            },
            json: true,
            timeout: 5000
          }, function ( error, response, body ) {
            if( !error && _.get( body, 'ok' ) && _.get( body, 'data.length' ) ) {
              var data = {};
              _.each( _.get( body, 'data' ), function(item) {
                _.set( data, _.get( item, '_id' ), item );
              } );
              myCache.set( cacheKey, data, 6000 );
              return callback( null, data );
            } else {
              console.error( 'MLS Configs could not be retrieved' );
              return callback( error || new Error( 'MLS Configs could not be retrieved' ) );
            }
          }
        );

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
