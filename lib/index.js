/**
 * Functions Utility
 */
let debug = require( 'debug' )('bu'),
  _ = require( 'lodash'),
  url = require('url'),
  colors = require('colors'),
  crypto = require('crypto'),
  Cache = require('async-disk-cache'),
  cache = new Cache('errors'),
  async = require('async'),
  Slack = require( 'slack-node'),
  getData = require('boxmls-firebase-admin').getData;

Object.defineProperties( module.exports, {

  version: {
    value: require( '../package.json' ).version,
    enumerable: true,
    configurable: false,
    writable: true
  },

  createMail: {
    /**
     * Returns Mail Utility
     *
     * @param options
     * @returns {options}
     */
    value: function createMail( options ) {
      return require( './utility-mail' ).create( options );
    },
    enumerable: true,
    configurable: false,
    writable: true
  },

  getS3: {
    /**
     * Returns S3 Wrapper object for AWS S3 node module
     *
     * @param req
     * @returns {Object}
     */
    value: function getS3( options ) {
      return require( './utility-s3' ).create( options );
    },
    enumerable: true,
    configurable: false,
    writable: true
  },

  getHash: {
    /**
     * Returns sha1 hash for object
     *
     * @param object
     * @returns {String}
     */
    value: function getHash( object ) {
      let hash = crypto.createHash('sha1').update( JSON.stringify(object, Object.getOwnPropertyNames(object)) ).digest('hex');
      console.log( 'getHash. Hash for the message [%s] is [%s]', _.get(object,'message'), hash );
      return hash;
    },
    enumerable: true,
    configurable: false,
    writable: true
  },

  sendError: {
    /**
     * - Outputs detailed Error information to console
     * - Sends detailed Error information to Slack channels ( for `production`, `latest` branches only )
     * - Sends detailed Error information via email.
     *
     * details object:
     * - preventLog. Boolean. Optional. By default: false. Output logs or not.
     * - allowedEnvs. Array. Optional. The list of additional process ENVs which will be sent in alert notification.
     * - cacheTimeout. Integer. Optional. Time in seconds. By default the error is not being sent one hour (3600) if it was already sent.
     * - subject. String. Optional. Custom subject of email notification.
     *
     * @param error
     * @param callback
     */
    value: function sendError( error, details, callback ) {

      let _details;
      if( !callback && typeof details == 'function' ) {
        callback = details;
        _details = {};
      } else {
        _details = details || {};
      }

      if(!(_.get( _details, 'preventLog' ))) {
        console.log(_.get(error,'stack'));
      }

      // The list of ENVs which we want to send in alert notification
      let allowedEnvs = [
        'ES_ADDRESS',
        // GitHub envs
        'GIT_OWNER',
        'GIT_NAME',
        'GIT_BRANCH',
        // Node Envs
        'NODE_VERSION',
        'NODE_PORT',
        'NODE_ENV',
        'PWD',
        // PM2 envs
        'name',
        'pm_exec_path',
        'pm_uptime',
        'restart_time',
        'unstable_restarts'
      ];
      allowedEnvs = _.uniq(allowedEnvs.concat( _.get(_details,'allowedEnvs', [] ) ));

      let subject = "Error in " + process.env.NODE_ENV + " on " + ( process.env.NODE_ENV == 'production' ? 'PROD' : 'DEV' );
      if(_.get(_details, 'subject')) {
        subject = _.get(_details, 'subject');
        _.unset(_details,'subject');
      }

      let text = ['PROCESS ENVS:'];
      _.each(_.get(process,'env',{}), function(v,k){
        if( allowedEnvs.indexOf(k) >= 0 ) {
          text.push(k+': '+(typeof v == 'string' ? v : JSON.stringify(v)));
        }
      } );

      let additionalDetails = [];
      _.each(_details,function(v,k){
        if( ['preventLog','allowedEnvs','cacheTimeout','subject'].indexOf(k) < 0 ) {
          additionalDetails.push(k+': '+(typeof v == 'string' ? v : JSON.stringify(v)));
        }
      });

      if(!_.isEmpty(additionalDetails) ) {
        text.push('');
        text.push('ADDITIONAL DETAILS:');
        text = text.concat(additionalDetails);
        text.push('');
      }

      text.push('');
      text.push('ERROR MESSAGE: ', _.get( error, 'message' ));
      text.push('');
      text.push(_.get(error,'stack'));

      async.auto({

        "checkCache": [function(done) {
          let cacheTimeout = _.get(_details, 'cacheTimeout', 3600);
          let errorHash = module.exports.getHash(error);
          cache.get(errorHash).then((entry) => {
            let timeSec = new Date().getTime() / 1000;
            if(entry.isCached && (parseInt(entry.value) + cacheTimeout) > timeSec ) {
              done(new Error("Prevent sending the error since it was already sent less than " + cacheTimeout + " seconds ago."));
            } else {
              cache.set(errorHash, timeSec)
                .then(() => {
                  done();
                });
            }
          });
        }],

        "slack": [ "checkCache", function(done){

          const slackWebhookURI = getData('slack.webhook_uri'),
                slackWebhookChannel = getData('slack.webhook_channel');

          if( !slackWebhookURI || !slackWebhookChannel ) {
            return done();
          }

          var slack = new Slack();
          slack.setWebhook( slackWebhookURI );
          slack.webhook({
            channel: "#" + slackWebhookChannel,
            username: "poller/" + require("os" ).hostname(),
            text: text.join("\n")
          }, done );
        }],

        "mail": [ "checkCache", function(done){
          const mandrillKey = getData('mandrill.key_production');

          if(!mandrillKey) {
            done();
          }

          var mail = module.exports.createMail( {
            "mandrillKey": mandrillKey
          } );
          mail.send( 'admin-alert', {
            "to": [{"email":getData('alert_email.to')}],
            "from": getData('alert_email.from'),
            "subject": subject,
            "environment": ( process.env.NODE_ENV == 'production' ? 'PRODUCTION' : 'DEVELOPMENT' ),
            "text": text.join("<br/>")
          }, done );
        }]

      },function(err){
        if(err) {
          console.error( "Error Notification was not sent due: %s", err.message);
        }
        if(typeof callback == 'function') {
          callback(err);
        }
      });

    },
    enumerable: true,
    configurable: false,
    writable: true
  },

  scrollResults: {
    /**
     * Handler For Scrolling through large dataset with simple callback system
     *
     * @param query
     * @param documentHandler
     * @param done
     * @param config
     */
    value: function scrollResults( query, documentHandler, done ) {

      if( !query.client && !process.env.ES_ADDRESS ) {
        return done( new Error( "Elasticsearch client is not defined." ) );
      }

      var client = query.client || new require( 'elasticsearch' ).Client( {
          host: process.env.ES_ADDRESS,
          log: 'error'
        } );

      var _scroll_id = null;

      function documentCallbackWrapper( hits, finalCallback ) {
        debug( 'scrollResults.documentCallbackWrapper', hits.length );

        if(query.bulk){
          documentHandler( hits, finalCallback );
        } else {
          async.each( hits, function ( body, callback ) {
            debug( 'Doing [%s/%s] item.', body._type, body._id );
            documentHandler( body._source, callback, body );
          }, finalCallback );
        }

      }

      async.forever( function ( next ) {

        if( !_scroll_id ) {

          var _query = {
            index: query.index,
            scroll: query.scroll || "60m",
            type: query.type,
            sort: query.sort || null,
            size: query.size || 100,
            from: query.size || 0,
            q: query.q || null,
            body: query.body || null,
          };

          client.search( _query, function ( error, response ) {

            if( !error && response && response.hits.hits.length ) {
              _scroll_id = response._scroll_id;
              debug( 'First request done, have [%s] hits.', _.get( response, 'hits.total') );
              documentCallbackWrapper( response.hits.hits, next );
            } else {
              next( new Error( 'First request returned 0 hits' ) );
            }

          } );

        } else {

          client.scroll( {
            scrollId: _scroll_id,
            scroll: query.scroll || '60m'
          }, function ( error, response ) {
            if( !error && response && response.hits.hits.length ) {
              debug( 'Next scroll step done.' );
              documentCallbackWrapper( response.hits.hits, next );
            } else if( error ) {
              //console.log( 'Error', error );
              next( error );
            } else if( !response.hits.hits.length ) {
              // console.log( 'Done' );
              next( true );
            }
          } );

        }

      }, function(error) {
        if(typeof error === 'error') {
          done(error);
        } else {
          done();
        }
      } );
    },
    enumerable: true,
    configurable: false,
    writable: true
  },

  setupElasticsearchMapping: {
    /**
     * Creates index and its mapping from file(s).
     *
     * Mapping file depends on ES version.
     * File example:
     *
     * /{path_to_elasticsearch_mapping}/mapping/2.4.6/{index_name}.json
     * /{path_to_elasticsearch_mapping}/mapping/2.x/{index_name}.json
     * /{path_to_elasticsearch_mapping}/mapping/6.x/{index_name}.json
     *
     * @param options
     * @param callback
     */
    value: function setupElasticsearchMapping(options, callback) {

      options = _.defaults( options || {}, {
        "client": null,
        "mappingPath": "~/",
        "attemptTimeout": 60000,
        "attemptNumber": 1,
        "attemptNumberMax": 10
      } );

      async.auto({

        // We're checking if Elasticsearch cluster exists and it's healthy
        // We are doing specific amount of attempts before break.
        "info": [(done)=>{
          options.client.info((err, response)=>{
            if(err || !(_.get(response,'version.number'))) {
              if(options.attemptNumberMax <= options.attemptNumber) {
                return done(new Error(`Task is failed. [${colors.red(options.attemptNumberMax)}] attempts done. Elasticsearch cluster is not accessible.`));
              }
              if(err){
                console.log("Error occurred on trying to retrieve Elasticsearch cluster info: [%s]", colors.red(_.get(err,'message')));
              } else {
                console.log("Elasticsearch cluster is not accessible.");
              }
              options.attemptNumber++;
              console.log("Waiting [%s] ms before next [%s] attempt", colors.yellow(options.attemptTimeout), colors.yellow(options.attemptNumber));
              setTimeout(()=>{
                module.exports.setupElasticsearchMapping(options, callback);
              }, options.attemptTimeout);
            } else {
              done(null, response);
            }
          });
        }],

        "setup": ["info", (done, results)=>{
          let fs = require( 'fs' ),
            path = options.mappingPath,
            pathes = [],
            version = _.get(results, 'info.version.number');

          version.split('.').forEach((n,i)=>{
            let prefix = !i?'/':'.';
            pathes.push(`${path}${prefix}${n}`);
            pathes.push(`${path}${prefix}x`);
            path+=`${prefix}${n}`;
          });

          let mappingPath = '';
          pathes.reverse().forEach(p=>{
            if(!mappingPath && fs.existsSync(p)) {
              mappingPath = p;
            }
          });

          if(!mappingPath) {
            return done(new Error("Elasticsearch mapping path could not be found."));
          }

          fs.readdir(mappingPath,(err,files)=>{
            if(err) {
              return done(err);
            }
            async.eachLimit(files,1,(file, next)=>{
              let index = file.replace('.json',''),
                mapping = require(`${mappingPath}/${file}`);

              // Here is logic for overriding/add elastic search indexes settings
              if (_.get(process.env, 'ES_INDEXES_SETTINGS', '')) {
                try {
                  let settings = JSON.parse(_.get(process.env, 'ES_INDEXES_SETTINGS', ''));

                  if(settings){
                    settings = Object.assign({}, _.get(mapping, 'settings', {}), settings);
                    _.set(mapping, 'settings', settings);
                  }
                } catch (e) {
                  console.log(e);
                }
              }

              options.client.indices.exists( { "index": index }, ( error, exists )=>{
                if( !exists ) {
                  debug( 'Index does not [%s] exists. Creating it...', colors.green(index) );
                  options.client.indices.create( {
                    index: index,
                    body: mapping
                  }, next );
                } else {
                  next();
                }
              } );
            },done);
          });

        }]

      },callback);
    },
    enumerable: true,
    configurable: false,
    writable: true
  }

} );