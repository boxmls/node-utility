/**
 * Billing Model
 *
 * @author peshkov@UD
 */
let debug = require( 'debug' )( 'bu' ),
    _ = require( 'lodash' ),
    async = require( 'async' ),
    config = require( '../package.json').config,
    request = require('request'),
    NodeCache = require( "node-cache" ),
    myCache = new NodeCache();

Object.defineProperties( module.exports, {

  detectBrandIDByEmail: {
    /**
     * Try to detect the Brand by provided email.
     *
     *
     * @param email
     * @param callback
     */
    value: function detectBrandIDByEmail( email, callback ) {
      debug( 'detectBrandIDByEmail. Looking for brand by [%s] email', email );

      function _callback( err, brandID ) {
        debug( 'detectBrandIDByEmail. The [%s] brand detected by [%s] email', brandID, email );
        return callback( err, brandID );
      }

      var userModel = require('./model-user');

      userModel.findByEmail( email, function( err, user ) {
        if( err ) {
          return _callback( err, null );
        }
        else if( !_.get( user, 'isAgent' ) ) {
          if( !_.get( user, 'subdomain' ) ) {
            return _callback( new Error( "Could not detect Brand ID by provided email" ), null );
          }
          else {
            userModel.subdomainLookup( _.get( user, 'subdomain' ), function( err, user ) {
              return _callback( err, _.get( user, 'brand' ) );
            } );
          }
        }
        else {
          return _callback( null, _.get( user, 'brand' ) );
        }
      } );

    },
    enumerable: true,
    writable: true
  },

  getBrand: {
    /**
     * Returns Brand object by brand ID
     * If brand can not be found by brand ID, default Brand will be returned
     *
     * @param brandID string
     * @param callback function
     */
    value: function getBrand( brandID, callback ) {
      debug( 'getBrand' );

      request( {
          method: 'GET',
          uri: 'http://api.boxmls.com/v1/brand/brand/' + brandID,
          headers: {
            "x-access-token": _.get( config, 'x_access_token' ),
            "x-brand-token": _.get( config, 'x_brand_token')
          },
          json: true,
          timeout: 5000
        }, function ( error, response, body ) {

          debug( 'Found [%s] brand by [%s] brand ID', _.get( body, 'data.name' ), brandID );

          if( !error && _.get( body, 'ok' ) && _.get( body, 'data' ) ) {
            return callback( null, _.get( body, 'data' ) );
          } else {
            return callback( error || null, null );
          }
        }
      );

    },
    enumerable: true,
    writable: true
  },

  defineBrand: {
    /**
     * Detect and return Brand unique ID for particular user
     * If brand can not be detected, default Brand will be returned
     *
     * @param user object
     * @param callback function
     */
    value: function defineBrand( user, callback ) {
      debug( 'defineBrand' );

      if(!_.get(user, 'isAgent')) {
        return callback( null, null );
      }

      async.auto({

        "brokerage": [function( done ) {
          require('./model-brokerage').detectBrokerageByUser( user, done );
        }],

        "brands": [function( done, results ) {
          request( {
              method: 'GET',
              uri: 'http://api.boxmls.com/v1/brand/brands/all?_source=associatedOffices',
              headers: {
                "x-access-token": _.get( config, 'x_access_token' ),
                "x-brand-token": _.get( config, 'x_brand_token')
              },
              json: true,
              timeout: 10000
            }, function ( error, response, body ) {
              if( !error && _.get( body, 'ok' ) && _.get( body, 'data.length' ) ) {
                return done( null, _.get( body, 'data' ) );
              } else {
                console.error( 'Brands could not be retrieved' );
                return done( error || new Error( 'Brands could not be retrieved' ) );
              }
            }
          );
        }],

        "brand": [ "brokerage", "brands", function(done, results) {
          var brand = 'default';
          var brokerageOffices = _.unique((_.filter(_.map( _.get(results,'brokerage.offices'), function(e) {return _.get(e,'_officeID') } ))).concat( _.get(results,'brokerage._pid') ));
          // Detect associated Brand by Brokerage Office(s) ID(s).
          _.each(_.get(results,'brands'),function(_brand) {
            _.each( _.get( _brand, 'associatedOffices', [] ), function(office) {
              if(_.get(_brand,'_id') && brokerageOffices.indexOf(office) > -1) {
                brand = _.get(_brand,'_id');
              }
            } );
          });
          request( {
              method: 'GET',
              uri: 'http://api.boxmls.com/v1/brand/brand/' + brand,
              headers: {
                "x-access-token": _.get( config, 'x_access_token' ),
                "x-brand-token": _.get( config, 'x_brand_token')
              },
              json: true,
              timeout: 5000
            }, function ( error, response, body ) {
              if( !error && _.get( body, 'ok' ) && _.get( body, 'data.uniqueID' ) ) {
                debug( 'Detected [%s] brand for [%s] user', _.get( body, 'data.uniqueID' ), _.get( user, 'email' ) );
                return callback( null, _.get( body, 'data.uniqueID' ) );
              } else {
                console.error( 'Brand could not be detected for [%s] user', _.get( body, 'data.name' ), _.get( body, 'data.uniqueID' ), _.get( user, 'email' ) );
                return callback( error || null, null );
              }
            }
          );
        }]

      }, function( err, results ) {
        return callback( err, _.get( results, 'brand' ) );
      });

    },
    enumerable: true,
    writable: true
  },

  getAllBrands: {
    /**
     * Returns All brands
     *
     * @param callback function
     */
    value: function getAllBrands( source, callback ) {
      debug( 'getAllBrands' );

      var _source;
      if( typeof source == "function" ) {
        callback = source;
      } else {
        _source =  Array.isArray(source) ? source.join(',') : source;
      }

      var cacheKey = 'getAllBrands:' + _source;
      var uri = 'http://api.boxmls.net/v1/brand/brands/all' + (_source ? '?_source=' + _source : '');

      myCache.get(cacheKey, function (err, brands) {

        if (!_.isEmpty(brands)) {
          return callback(null, brands);
        }

        request( {
            method: 'GET',
            uri: uri,
            headers: {
              "x-access-token": _.get( config, 'x_access_token' ),
              "x-brand-token": _.get( config, 'x_brand_token')
            },
            json: true,
            timeout: 15000
          }, function ( error, response, body ) {
            if( !error && _.get( body, 'ok' ) && _.get( body, 'data.length' ) ) {
              myCache.set( cacheKey, _.get( body, 'data' ), (60*10), function(){
                callback( null, _.get( body, 'data' ) );
              } );
            } else {
              console.error( 'Brands could not be retrieved' );
              return callback( error || new Error( 'Brands could not be retrieved' ) );
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
