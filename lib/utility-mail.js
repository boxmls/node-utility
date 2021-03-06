/**
 * Notifications
 */

let debug = require('debug')('boxmls-utility'),
  async = require( 'async' ),
  path = require( 'path' ),
  extend =require( 'extend'),
  _ = require( 'lodash'),
  emailTemplate = require('email-templates').EmailTemplate,
  config = require( '../package.json').config,
  moment = require('moment'),
  getData = require('boxmls-firebase-admin').getData;

Object.defineProperties( module.exports, {
  create: {
    value: function create( options ) {
      return new Mail( options );
    },
    enumerable: true,
    writable: true
  },
  version: {
    value: 0.1,
    writable: false
  }
});

function Mail( opts ) {
  let self = this,
    templatesPath,
    Mandrill = require('mandrill-api');

  try {
    templatesPath = path.dirname(require.resolve('boxmls-utility/package.json')) + '/static/email-templates';
  } catch(e) {
    templatesPath = 'static/email-templates'
  }

  let mandrillKey = getData(`mandrill.key_${process.env.NODE_ENV == 'production' ? 'production' : 'development'}`);

  self.options = _.defaults( opts, {
    mandrillKey,
    templatesPath
  });

  // If Mandrill KEY is not defined still, try to retrieve it from MANDRILL_KEY env.
  if(!(_.get(self, 'options.mandrillKey')) && process.env.MANDRILL_KEY) {
    self.options.mandrillKey = process.env.MANDRILL_KEY;
  }

  let mandrill = new Mandrill.Mandrill(_.get(self, 'options.mandrillKey', null ));

  /**
   *
   * @param message
   */
  self.send = function send( templateName, options, callback ) {

    if( _.isEmpty( options ) ) {
      return callback( 'Invalid Options' );
    }

    if( _.isEmpty( options.to ) ) {
      return callback( 'Invalid Options' );
    }

    if( _.isEmpty( options.from ) ) {
      options.from = null;
    }

    options.templateName = templateName;
    options.to = self._getTo( options );

    async.waterfall( [

      /**  */
        function getTemplate( done ) {
        debug( "send.getTemplate" );
        self._renderTemplate( templateName, options, function( error, template ) {
          if( error ) {
            return done( error );
          } else {
            return done( null, template );
          }
        } );

      },

      /**  */
        function mandrillSend( template, done ) {
        debug( "send.mandrillSend" );
        var parameters = {
          message: {
            to: options.to,
            from_email: options.from,
            headers: options.headers || {},
            subject: template.subject,
            html: template.html,
            text: template.text
          }
        };
        //console.log( "Mandrill Parameters", require('util').inspect( parameters, {showHidden: false, depth: 10, colors: true}));
        //send an e-mail to particular mail
        mandrill.messages.send( parameters, function(response) {
          var err = self._prepareError( null, response );
          done( err, response );
        }, function(error){
          var err = self._prepareError( error, null );
          done( err );
        });

      }

    ], function( err, response ) {

      if( err ) {
        console.log( err );
      }

      options.response = response;
      if( typeof callback == 'function' ) {
        callback( err, response );
      }

    } );

  };

  /**
   * Prepare Variables and
   * Render HTML/TXT Templates
   *
   * @param templateName
   */
  self._renderTemplate = function _renderTemplate( templateName, options, callback ) {

    var templateDir = path.join( self.options.templatesPath, templateName );
    var template = new emailTemplate( templateDir );

    //console.log( "Rendering template from path [%s]", templateDir );

    //console.log( require( 'util' ).inspect(  options , { showHidden: false, depth: 10, colors: true } ) );

    template.render( options, function ( error, results ) {

      if( error ) {
        return callback( error );
      }

      extend( results, {
        subject: options.subject
      } );

      return callback( null, results );

    });

  };

  /**
   *
   * @param to
   * @returns {*}
   */
  self._getTo = function _getTo( options ) {
    var to = [];
    if( typeof options.to == 'string' ) {
      to.push( {
        "email": options.to
      } );
    } else if ( typeof options.to.email !== 'undefined' ) {
      to.push( options.to );
    } else {
      to = options.to;
    }
    return to;
  };

  /**
   * Prepare Error on parsing response data.
   *
   * @param error
   * @param data
   */
  self._prepareError = function _prepareError( error, data ) {
    var err;
    var errText = 'Email could not be sent';

    //console.log( "ERROR", error );
    //console.log( "DATA", data );

    if( error ) {
      err = new Error( errText + ': ' + error.message );
    } else if ( data && !_.isEmpty(data[0].status) && data[0].status == 'rejected' ) {
      err = new Error( errText + ': ' +  data[0].reject_reason );
    }

    return err;

  }

  return self;

}