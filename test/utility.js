/**
 * Basic Tests
 *
 *
 */

const Cache = require('async-disk-cache');
const cache = new Cache('errors');

module.exports = {

  'before': function( done ) {
    module.exports.utility = require( '../lib/index.js' );
    done();
  }
  
};
