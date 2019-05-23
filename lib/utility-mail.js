/**
 * Notifications
 */

let debug = require('debug')('bu'),
    async = require( 'async' ),
    path = require( 'path' ),
    extend =require( 'extend'),
    _ = require( 'lodash'),
    Slack = require('slack-node'),
    emailTemplate = require('email-templates').EmailTemplate,
    config = require( '../package.json').config,
    moment = require('moment');

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
  var self = this;

  var templatesPath;
  try {
    templatesPath = path.dirname(require.resolve('@mypropertyoffice/utility/package.json')) + '/static/email-templates';
  } catch(e) {
    templatesPath = 'static/email-templates'
  }

  self.options = _.defaults( opts, {
    "mandrillKey": process.env.MANDRILL_KEY || _.get( config, 'mandrill.key_development' ),
    "templatesPath": templatesPath,
    "slackWebhook": _.get( config, 'slack_webhook' )
  });

  var slack = new Slack();
  slack.setWebhook( self.options.slackWebhook );

  let Mandrill = require('mandrill-api'),
      mandrill = new Mandrill.Mandrill(self.options.mandrillKey),
      mlsModel = require('./model-mls'),
      brandModel = require('./model-brand'),
      helper = require('./utility-mail-helper.js');

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
    options.isSubdomain = options.agent ? true : false;
    options.to = self._getTo( options );

    options.year = moment().format( 'YYYY' );
    options.S3bucketLink = 'https://s3-us-west-1.amazonaws.com/cdn.boxmls.com';

    async.waterfall( [

      /** Retrieve timeZones of all MLSs */
      function getMLS( done ) {
        debug( "send.getMLS" );
        mlsModel.getAll( 'timeZone', (error, mls)=>{
          options.MLS = mls;
          done( error );
        } );
      },

      /** */
      function setBrand( done ) {
        debug( "send.setBrand" );
        self._detectBrand( options, function( error, brand ) {
          options.brand = brand;
          options.from = self._getFrom( options );
          options.replyTo = self._getReplyTo( options );
          options.subject = self._getSubject( templateName, options );
          options.siteUrl = self._getSiteUrl( options );
          options.contact_phone = _.get( brand, 'themeConfig.default.company.phone' );
          self._replaceTags( options );
          done( error );
        } );

      },

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
            from_name: _.get( options, 'brand.themeConfig.default.company.product' ),
            tracking_domain: 'mailer.' + _.get( options, 'brand.domain.default.main' ),
            "headers": {
              "Reply-To": options.replyTo
            },
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
          var err = self._prepareError( error, response );
          done( err );
        });

      }

    ], function( err, response ) {

      if( err ) {
        console.log( err );
      }

      options.response = response;
      self._sendSlackMessage( err, options, function() {
        if( typeof callback == 'function' ) {
          callback( err, response );
        }
      } );

    } );

  };

  /**
   * Scrolls object properties recursively and replaces specified [brand-tags] with correct values.
   *
   * @param callback
   */
  self._replaceTags = function _replaceTags( options ) {

    function walker(obj) {
      var k,
          has = Object.prototype.hasOwnProperty.bind(obj);
      for (k in obj) if (has(k)) {
        switch (typeof obj[k]) {
          case 'object':
            walker(obj[k]); break;
          case 'string':

            if( obj[k].indexOf( '[brand-name]' ) > -1 ) {
              debug( 'String with brand tag [brand-name] was [%s]', obj[k] );
              obj[k] = obj[k].replace( /(\[brand-name\])/g, _.get( options, 'brand.themeConfig.default.company.product' ) );
              debug( 'String with brand tag [brand-name] is [%s]', obj[k] );
            }

            if( obj[k].indexOf( '[brand-domain]' ) > -1 ) {
              debug( 'String with brand tag [brand-domain] was [%s]', obj[k] );
              obj[k] = obj[k].replace( /(\[brand-domain\])/g, _.get( options, 'brand.mainDomain' ) );
              debug( 'String with brand tag [brand-domain] is [%s]', obj[k] );
            }

            if( obj[k].indexOf( '[brand-email-domain]' ) > -1 ) {
              debug( 'String with brand tag [brand-email-domain] was [%s]', obj[k] );
              obj[k] = obj[k].replace( /(\[brand-email-domain\])/g, _.get( options, 'brand.domain.email' ) );
              debug( 'String with brand tag [brand-email-domain] is [%s]', obj[k] );
            }

            if( obj[k].indexOf( '[brand-uri]' ) > -1 ) {
              debug( 'String with brand tag [brand-uri] was [%s]', obj[k] );
              obj[k] = obj[k].replace( /(\[brand-uri\])/g, _.get( options, 'brand.mainDomainURI' ) );
              debug( 'String with brand tag [brand-uri] is [%s]', obj[k] );
            }

            if( obj[k].indexOf( '[site-uri]' ) > -1 ) {
              debug( 'String with tag [site-uri] was [%s]', obj[k] );
              obj[k] = obj[k].replace( /(\[site-uri\])/g, _.get( options, 'siteUrl' ) );
              debug( 'String with brand tag [site-uri] is [%s]', obj[k] );
            }

        }
      }
    }

    walker(options);

  };

  /**
   * Try to detect the Brand by:
   * - Agent object if exists ( options.agent.brand )
   * - Email Recipient(s). Only [to]. [cc] and [bcc] must be ignored.
   *
   *
   * @author peshkov@UDX
   * @param options
   * @param callback
   */
  self._detectBrand = function _detectBrand( options, callback ) {

    async.auto( {

      "brandUniqueID": [function(done) {
        var brandUniqueID = 'default';

        if(_.get(options, 'agent.brand')) {

          brandUniqueID = _.get(options, 'agent.brand');
          debug( "Detected Brand ID [%s] using provided agent's object", brandUniqueID );
          return done(null, brandUniqueID);

        }

        else if(_.get(options, 'brand')) {

          brandUniqueID = _.get(options, 'brand');
          debug( "Brand ID [%s] provided via options directly", brandUniqueID );
          return done(null, brandUniqueID);

        }

        else {

          var recipients = _.map( _.filter( _.get( options, 'to', [] ), function ( recipient ) {
            return _.get( recipient, 'type', 'to') === 'to';
          } ), function( recipient ) {
            return _.get( recipient, 'email' );
          } );

          if( !recipients.length ) {
            debug( "Could not detect Brand ID by email recipient. Using default Brand" );
            return done(null, brandUniqueID);
          }

          debug( "Trying to detect Brand ID by email recipients [%s]", recipients.join() );

          var detectedBrandUniqueID = false;
          async.eachLimit( recipients, 1, function( email, next ) {
            if( detectedBrandUniqueID ) {
              return next();
            }
            brandModel.detectBrandIDByEmail( email, function( err, _brandUniqueID ) {
              if( !_.isEmpty(_brandUniqueID) ) {
                brandUniqueID = _brandUniqueID;
                debug( "Detected Brand ID [%s] using provided agent's object", brandUniqueID );
                detectedBrandUniqueID = true;
              } else {
                debug( "No Brand ID detected by [%s] email", email );
              }
              next();
            } );
          }, function(){
            done( null, brandUniqueID );
          } );

        }
      }],

      "brand": [ "brandUniqueID", function(done, results) {
        debug( 'Detected Brand [%s] for email notification.', _.get(results, 'brandUniqueID', 'default') );
        brandModel.getBrand( _.get(results, 'brandUniqueID', 'default'), done );
      }]

    }, function( err, results ) {

      if (err) {
        return callback(err);
      }
      else if (!_.get(results, 'brand.uniqueID')) {
        return callback(new Error('Could not detect Brand for mail notification'));
      }

      var instance = _.get(process, 'env.GIT_BRANCH') === "production" ? 'default' : 'development';
      var brand = _.get(results, 'brand' );
      var subdomain = _.get( options, 'user.subdomain' ) || _.get( options, 'agent.subdomain' ) || _.get( options, 'client.subdomain' );

      // Set specific vars which are necessary for our email notifications.
      _.set( brand, 'emailLogoURI', ( 'https://' + _.get( brand, 'domain.' + instance + '.main' ) + '/images/logos/email/email-logo.png' ) );
      _.set( brand, 'mainDomain', ( subdomain ? subdomain + '.' : '' ) + _.get( brand, 'domain.' + instance + '.main' ) );
      _.set( brand, 'mainDomainURI', 'https://' + ( subdomain ? subdomain + '.' : '' ) + _.get( brand, 'domain.' + instance + '.main' ) );

      callback(null, brand );

    });

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

    options.helper = helper;

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
   * Determine subject on email by template's name
   *
   * @param templateName
   * @returns {*}
   */
  self._getSubject = function _getSubject( templateName, options ) {
    var subject = _.get( options, 'subject' );

    if(_.isEmpty(subject)) {

      switch( templateName ) {

        case 'account-activation':
        case 'agent-confirm':
          subject = 'Complete your ' + _.get( options, 'brand.themeConfig.default.company.product' ) + ' sign up';
          break;

        case 'password-reset':
          subject = 'Password Reset';
          break;

        case 'password-changed':
          subject = 'Password Changed';
          break;

        case 'agent-added-favorite':
          subject = 'Favorited Property';
          break;

        case 'client-added-favorite':
          subject = 'Favorited Property';
          break;

        case 'realtime-favorite-updated':
          subject = 'Favorited Property Updated';
          break;

        case 'daily-listings-created':
          subject = 'Daily List of New Properties tied to Saved Search';
          break;

        case 'daily-listings-updated':
          subject = 'Properties with status changes';
          break;

        case 'realtime-listing-added':
          subject = 'New Property matched Saved Search';
          break;

        case 'upcoming-openhomes':
          subject = 'Upcoming Open Homes';
          break;

        case 'upcoming-tours':
          subject = 'Upcoming Broker Tour';
          break;

        default:
          subject = _.get( options, 'brand.themeConfig.default.company.product' );
          break;

      }

    }

    subject = subject.replace( '[brand-name]', _.get( options, 'brand.themeConfig.default.company.product' ) );
    subject = subject.replace( '[brand-domain]', _.get( options, 'brand.domain.default.main' ) );

    // Add non-production branch to subject for better troubleshooting.
    if( process.env.GIT_BRANCH && process.env.GIT_BRANCH !== 'production' ) {
      subject = process.env.GIT_BRANCH + ' - ' + subject;
    }

    return subject;
  }

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
   *
   * @param options
   * @returns {*}
   */
  self._getFrom = function _getFrom( options ) {
    var from = "";
    if( typeof options.from == 'undefined' || !options.from ) {
      if( _.get( options, 'brand.themeConfig.default.company.notifyEmail' ) ) {
        from = _.get( options, 'brand.themeConfig.default.company.notifyEmail' );
      } else {
        from = 'notify@' + _.get( options, 'brand.domain.email' );
      }
    } else {
      from = options.from.replace( '[brand-email-domain]', _.get( options, 'brand.domain.email' ) );
      // Determine if the email name is supported for current brand.
      // If not, - we set 'notify' email name.
      from = from.split('@');
      if( (_.get( options, 'brand.allowedEmailNames', [] )).indexOf(from[0]) < 0 ) {
        if( _.get( options, 'brand.themeConfig.default.company.notifyEmail' ) ) {
          from = _.get( options, 'brand.themeConfig.default.company.notifyEmail' );
          return from;
        }
        from[0] = 'notify';
      }
      from = from.join('@');
    }
    return from;
  };

  /**
   *
   * @param options
   * @returns {*}
   */
  self._getReplyTo = function _getReplyTo( options ) {
    //console.log( require( 'util' ).inspect(  options , { showHidden: false, depth: 10, colors: true } ) );
    var replyTo = "";
    if( typeof options.replyTo == 'undefined' || !options.replyTo ) {
      if( options.agent && options.agent !== null && typeof options.agent.email != 'undefined' ) {
        replyTo = options.agent.email;
      } else {
        replyTo = self._getFrom( options );
      }
    } else {
      replyTo = options.replyTo;
    }
    return replyTo;
  };

  /**
   *
   * @param options
   * @returns {*}
   */
  self._getSiteUrl = function _getSiteUrl( options ) {
    var siteUrl = "";
    var instance = _.get(process, 'env.GIT_BRANCH') === "production" ? 'default' : 'development';

    if( typeof options.siteUrl == 'undefined' || !options.siteUrl ) {
      siteUrl = 'https://' + _.get( options, 'brand.domain.' + instance + '.main' );
      if( process.env.MPOAPP_PORT ) {
        siteUrl += ":" + process.env.MPOAPP_PORT;
      }

      var _subdomain = _.get( options, 'user.subdomain' ) || _.get( options, 'agent.subdomain' ) || _.get( options, 'client.subdomain' );

      if( _subdomain ) {
        var pattern = RegExp("^(([^:/?#]+):)?(//([^/?#]*))?([^?#]*)(\\?([^#]*))?(#(.*))?");
        var matches =  siteUrl.match( pattern );

        var siteUrl = matches[2] + '://' + _subdomain + '.';

        for( var i=4; i<=matches.length; i++ ) {
          if( matches[i] ) {
            siteUrl += matches[i];
          }
        }
      }


    } else {
      siteUrl = options.siteUrl;
    }
    //console.log( 'SITE URL', siteUrl );
    return siteUrl;
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
    } else if ( data[0].status == 'rejected' ) {
      err = new Error( errText + ': ' +  data[0].reject_reason );
    } else if ( data[0].status !== 'sent' ) {
      if( data[0].status == 'queued' ) {
        // @todo: not sure if 'queued' status is ok. peshkov@UD
      } else {
        err = new Error( errText );
      }
    }

    return err;

  }

  /**
   * Maybe send message to Slack
   * Slack Message can be set for debugging.
   * Message contains the list of recipients and subject.
   * By default we are sending slack messages for production and latest branches
   * But it's customisable.
   *
   * @param message
   * @param options
   * @param callback
   * @returns {boolean}
   */
  self._sendSlackMessage = function _sendSlackMessage( err, options, callback ) {

    options.slackMessage = process.env.SLACK_MESSAGE_ON_EMAIL || options.slackMessage || true;
    if( ["false","0"].indexOf( options.slackMessage ) >= 0 ) {
      options.slackMessage = false;
    } else if( ["true","1"].indexOf( options.slackMessage ) >= 0 ) {
      options.slackMessage = true;
    }

    options.slackChannel = process.env.SLACK_CHANNEL_ON_EMAIL || options.slackChannel || null;
    if( options.slackMessage && options.slackChannel == null ) {
      if( process.env.GIT_BRANCH == 'production' ) {
        options.slackChannel = "user-emails";
      } else if( process.env.GIT_BRANCH == 'latest' ) {
        options.slackChannel = "user-emails-dev";
      } else {
        options.slackMessage = false;
      }
    }

    if( !options.slackMessage || !options.slackChannel ) {
      return callback();
    }

    var message = "Recipients [%s]. Subject [%s]. Template [%s].";

    if( err instanceof Error) {
      message += " \nError: " + err.message;
    } else if( options.response ) {
      if( _.get( options, 'response[0]._id' ) ) {
        message += " \nView: https://mandrillapp.com/activity/content?id=" + ( moment.utc().format("YYYYMMDD") ) + "_" + options.response[0]._id;
      }
    }

    var recipients = "";
    options.to.forEach( function(i) {
      if( recipients.length > 0 ) {
        recipients = ", ";
      }
      recipients += i.email;
    } );

    var text = require( 'util' ).format.apply( null, _.values( [ message, recipients, options.subject, options.templateName ] ) );

    console.log( text );

    slack.webhook({
      channel: '#' + options.slackChannel,
      username: "poller/" + require("os" ).hostname(),
      text: text
    }, function(err) {
      if( err ) {
        console.log(err);
      }
      callback();
    });

  }

  return self;

}