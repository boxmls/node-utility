/**
 * Brokerage Model
 *
 * @author peshkov@UD
 */
let debug = require( 'debug' )( 'bu' ),
    _ = require( 'lodash' ),
    async = require( 'async' ),
    config = require( '../package.json').config,
    client = new (require( 'elasticsearch' )).Client( { host: process.env.ES_ADDRESS || config.es_address } ),
    request = require('request');

Object.defineProperties( module.exports, {

  detectBrokerageByUser: {
    /**
     * Try to detect the Brokerage for the particular Agent.
     *
     *
     * @param object user
     * @param callback
     */
    value: function detectBrokerageByUser( user, callback ) {
      debug( 'detectBrokerageByUser. Subdomain [%s].', _.get( user, 'subdomain' ) );

      function _callback( err, results ) {
        var brokerage = _.get( results, 'brokerage' );
        if( err ) {
          console.error( "detectBrokerageByUser", err );
        } else if( brokerage ) {
          debug( 'detectBrokerageByUser. The [%s] Brokerage detected for [%s] subdomain.', _.get( brokerage, '_pid' ), _.get( user, 'subdomain' ) );
        }
        return callback( err, brokerage );
      }

      async.auto({

        "agent": [function(done) {
          if( _.get( user, 'isAgent' ) ) {
            return done( null, user );
          }
          if( !_.get( user, 'subdomain' ) ) {
            return done( new Error( "Could not detect Brokerage by provided user. Subdomain not found." ), null );
          }
          require('./model-user' ).subdomainLookup(_.get( user, 'subdomain' ), done);
        }],

        "brokerage": ["agent", function(done, results) {
          var mlsSys = _.get( results, 'agent.mlsSys');
          var mainOfficeId = _.get( results, 'agent.office.mainOfficeId');
          if(!mainOfficeId) {
            mainOfficeId = _.get( results, 'agent.office.officeNumber')
          }
          if( !mainOfficeId || !mlsSys ) {
            console.error( "detectBrokerageByUser. Not enough data to detect the Brokerage for [%s] user. mainOfficeId [%s]. mlsSys [%s]", _.get( results, 'agent._mid'), mainOfficeId, mlsSys );
            return done();
          }
          module.exports.detectBrokerage(mainOfficeId, mlsSys, function(err, data) {
            if(err || !data) {
              console.error( "detectBrokerageByUser. Failed to detect the Brokerage for [%s] user. mainOfficeId [%s]. mlsSys [%s]", _.get( results, 'agent._mid'), mainOfficeId, mlsSys );
            }
            done(err,data);
          } );
        }]

      }, _callback );

    },
    enumerable: true,
    writable: true
  },

  detectBrokerage: {
    /**
     * Detect the Brokerage by Main Office ID and MLS Sys.
     *
     * @param string mainOfficeId
     * @param string mlsSys
     * @param callback
     */
    value: function detectBrokerage( mainOfficeId, mlsSys, callback ) {

      if( !mainOfficeId || !mlsSys ) {
        console.error( "detectBrokerage", "mainOfficeId or mlsSys is not provided" );
        return callback( null, null );
      }

      debug( 'detectBrokerage. Main Office ID [%s].', mainOfficeId );

      async.auto( {

        "brokerage": [ function( done ) {
          var query = {
            "index": 'office',
            "type": 'office',
            "body": {
              "size": 1,
              "query": {
                "bool": {
                  "must": [
                    {
                      "term": {
                        "officeNumber": mainOfficeId
                      }
                    },
                    {
                      "term": {
                        "_mls": mlsSys
                      }
                    }
                  ]
                }
              }
            }
          };
          //console.log(require('util').inspect( query, {showHidden: false, depth: 10, colors: true}));
          client.search( query, function haveResponse( err, data ) {
            if( err ) {
              return done( err, null );
            }
            else if(_.get(data,'hits.total') == 1 && _.get(data,'hits.hits[0]._source')) {
              return done( null, {
                "_mls": _.get(data,'hits.hits[0]._source._mls'),
                "_pid": _.get(data,'hits.hits[0]._source._pid'),
                "name": _.get(data,'hits.hits[0]._source.officeName'),
                "longName": _.get(data,'hits.hits[0]._source.officeLongName'),
                "officeNumber": _.get(data,'hits.hits[0]._source.officeNumber'),
                "officeMLSID": _.get(data,'hits.hits[0]._source.officeMLSID')
              } );
            } else {
              return done( new Error( "The unique Main Office not found" ), null );
            }
          } );
        } ],

        "offices": [ function( done ) {
          var query = {
            "index": 'office',
            "type": 'office',
            "body": {
              "size": 100,
              "query": {
                "bool": {
                  "must": [
                    {
                      "term": {
                        "mainOfficeId": mainOfficeId
                      }
                    },
                    {
                      "term": {
                        "_mls": mlsSys
                      }
                    }
                  ]
                }
              }
            }
          };
          //console.log(require('util').inspect( query, {showHidden: false, depth: 10, colors: true}));
          client.search( query, function haveResponse( err, data ) {
            var offices = {};
            if( err ) {
              return done( err, null );
            }
            _.each( _.get(data,'hits.hits', [] ), function( office ) {
              offices[ _.get( office, '_id' ) ] = {
                "_officeID": _.get( office, '_id' ),
                "_mls": _.get( office, '_source._mls' ),
                "officeMLSID": _.get( office, '_source.officeMLSID' ),
                "officeNumber": _.get( office, '_source.officeNumber' )
              }
            } );

            done( null, offices );

          } );
        } ],

        // Try to detect other MLS offices by Office MLSIDs of already found offices.
        "otherMLSOffices": [ "offices", function( done, results ) {
          var officeMLSIDs = _.map( _.get( results, "offices", {} ), "officeMLSID" );
          var query = {
            "index": 'office',
            "type": 'office',
            "body": {
              "size": 100,
              "query": {
                "bool": {
                  "must": [
                    {
                      "terms": {
                        "officeMLSID": officeMLSIDs
                      }
                    }
                  ],
                  "must_not": [
                    {
                      "term": {
                        "_mls": mlsSys
                      }
                    }
                  ]
                }
              }
            }
          };
          //console.log(require('util').inspect( query, {showHidden: false, depth: 10, colors: true}));
          client.search( query, function haveResponse( err, data ) {
            var offices = {};
            if( err ) {
              return done( err, null );
            }
            _.each( _.get(data,'hits.hits', [] ), function( office ) {
              if( officeMLSIDs.indexOf( _.get( office, '_source.officeMLSID' ) ) > -1 ) {
                offices[ _.get( office, '_id' ) ] = {
                  "_officeID": _.get( office, '_id' ),
                  "_mls": _.get( office, '_source._mls' ),
                  "officeMLSID": _.get( office, '_source.officeMLSID' ),
                  "officeNumber": _.get( office, '_source.officeNumber' )
                }
              }
            } );
            //console.log(require('util').inspect( offices, {showHidden: false, depth: 10, colors: true}));
            done( null, offices );
          } );

        } ]

      }, function( err, results ) {

        if( err ) {
          console.error( "detectBrokerage", err.message );
          return callback( null, null );
        }

        var brokerage = _.get( results, "brokerage", {} );
        brokerage.offices = _.map( _.extend( _.get( results, "offices", {} ), _.get( results, "otherMLSOffices", {} ) ) );

        //console.log( "detectBrokerage", require('util').inspect( brokerage, {showHidden: false, depth: 10, colors: true}));

        return callback( null, brokerage );

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
