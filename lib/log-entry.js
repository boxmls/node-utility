/**
 * Writes log (tied to listing) to `.log/entry` index/type (Elasticsearch)
 * Note, it uses async.queue so callback function is not needed actually.
 *
 */

let debug = require('debug')('bu'),
    async = require('async'),
    util = require('util'),
    moment = require('moment'),
    config = require( '../package.json' ).config;

var client = new (require('elasticsearch')).Client({
  host: ( process.env.ES_ADDRESS || config.es_address )
});

var debugDateTimeFormat = 'YYYY-MM-DDTHH:mm:ss.SS';

// Create module-wide queue that allows one request at a time.
module.queue = async.queue( methodCallHandler );

Object.defineProperties( module.exports, {

  log: {
    /**
     * Wrapper for module queue.
     * It's adding entry log request to module queue.
     *
     * @param data
     * @param callback. It's optional and can be ignored.
     */
    value: function log( data, callback ) {
      debug( "[%s] log. Adding writing entry log to module queue", moment().format(debugDateTimeFormat) );
      module.queue.push( data, callback );
    },
    enumerable: true,
    writable: true
  },

  version: {
    value: 1.0,
    writable: false
  }

});

/**
 * Queue Worker Task
 * In this module requests are queued. So, all usage of log is "brokered" via the queue.
 *
 * @param data
 * @param callback
 */
function methodCallHandler( data, callback ) {
  debug( "[%s] methodCallHandler. Writing entry log to module queue", moment().format(debugDateTimeFormat) );

  // passing along a string with format tags problably
  if ('string' === typeof data) {
    data = util.format.apply(null, arguments);
  }

  var body = {
    time: moment().format(),
    host: require('os').hostname(),
    app: process.env.GIT_NAME + ':' + process.env.GIT_BRANCH,
    comment: ( 'string' === typeof data ? data : data.comment || '' ),
    detail: ( 'object' === typeof data ? data : null )
  };

  // Kibana log's field detail.error must be an object!
  // Mapping requirement
  if (body.detail.error && typeof body.detail.error !== 'object') {
    body.detail.error = {
      "msg": body.detail.error
    };
  }

  client.index({
    index: '.logs',
    type: 'entry',
    body: body
  }, function ( error ) {
    if (error) {
      console.error( "Error writing entry log: [%s]", error.message );
    }
    if( typeof callback === 'function' ) {
      callback( error );
    }
  });

}