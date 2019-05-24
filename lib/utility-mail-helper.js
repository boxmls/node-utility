/**
 * Helper functions for Email Template mostly
 */

let debug = require( 'debug' )('bu'),
    dateFormat = require( 'dateformat' ),
    excerpt = require( 'html-excerpt' ),
    async = require( 'async' ),
    _ = require('lodash'),
    moment = require('moment-timezone'),
    elasticsearch = require('elasticsearch'),
    config = require( '../package.json').config,
    esIndexProduction = process.env.ES_INDEX_PRODUCTION || config.es_index_production;

let client = new elasticsearch.Client({
  host: ( process.env.ES_ADDRESS || config.es_address )
});

module.exports = (function ( self ) {
  'use strict';

  self = self || {};

  /**
   *
   * @param options
   * @returns {*}
   */
  self.getSubdomainUrl = function getSubdomainUrl( subdomain, url ) {

    //console.log( 'subdomainUrl:before', require('util').inspect( url, {showHidden: false, depth: 10, colors: true}));

    // Determine if URL already contains subdomain
    // If so, just return URL as is.
    var pattern = RegExp( "[\/\.]+"+subdomain+"\." );
    var subdomainMatch = url.match( pattern );
    if( subdomainMatch ) {
      //console.log( 'subdomainUrl:after', require('util').inspect( url, {showHidden: false, depth: 10, colors: true}));
      return url;
    }

    var pattern = RegExp( "^(([^:/?#]+):)?(//([^/?#]*))?([^?#]*)(\\?([^#]*))?(#(.*))?" );
    var matches = url.match( pattern );
    var subdomainUrl = matches[ 2 ] + '://' + subdomain + '.';
    for( var i = 4; i <= matches.length; i++ ) {
      if( matches[ i ] && i !== 2 ) {
        subdomainUrl += matches[ i ];
      }
    }

    //console.log( 'subdomainUrl:after', require('util').inspect( subdomainUrl, {showHidden: false, depth: 10, colors: true}));

    return subdomainUrl;
  };

  /**
   *
   * @param val
   * @returns {*}
   */
  self.toLowerCase = function toLowerCase( val ) {
    return val.toLowerCase();
  }

  /**
   * Format boolean to Yes/No
   *
   * @param val
   * @returns {*}
   */
  self.formatBool = function toLowerCase( value ) {
    if( value === 'true' || value === true ) {
      value = "Yes";
    } else {
      value = "No";
    }
    return value;
  }

  /**
   *
   *
   */
  self.camelCaseToHuman = function camelCaseToHuman( name ) {
    var words = name.match( /[A-Za-z][a-z]*/g );

    function capitalize( word ) {
      return word.charAt( 0 ).toUpperCase() + word.substring( 1 );
    }

    return words.map( capitalize ).join( " " );
  }

  /**
   * Returns Human readable Status
   *
   * @param val
   * @returns {*}
   */
  self.formatStatus = function formatStatus( status ) {
    switch( status ) {
      case "active":
        status = "Active";
        break;
      case "inContract":
        status = "In Contract";
        break;
      case "pending":
        status = "Pending";
        break;
      case "sold":
        status = "Sold";
        break;
      case "offMarket":
        status = "Off Market";
        break;
    }
    return status;
  }

  /**
   * Returns Human Property Type
   *
   * @author potanin@UD
   * @param val
   * @returns {*}
   */
  self.formatPropType = function formatPropType( type ) {
    switch( type ) {
      case "singleFamily":
        return "Single Family";
      case "condominium":
        return "Condominium";
      case "loft":
        return "Loft";
      case "tenancyInCommon":
        return "Tenancy In Common";
      case "cooperative":
        return "Cooperative";
      case "lot":
        return "Lot";
      case "commercial":
        return "Commercial";
      case "apartmentBuilding":
        return "Apartment Building";
    }
    return type;
  }

  /**
   *
   * @param val
   * @returns {string}
   */
  self.formatPhone = function formatPhone( val ) {
    var numbers = ( val + '' ).replace( /\D/g, '' ),
      char = { 0: '(', 3: ') ', 6: ' - ' };
    val = '';
    for( var i = 0; i < numbers.length; i++ ) {
      val += (char[ i ] || '') + numbers[ i ];
    }
    return val;
  }

  /**
   *
   * @param val
   * @returns {string}
   */
  self.getAgentPhone = function getAgentPhone( agent ) {
    var val;
    if( agent.contact.mobilePhone ) {
      val = agent.contact.mobilePhone;
    } else if ( agent.contact.officePhone ){
      val = agent.contact.officePhone;
    } else if ( agent.contact.phones.length > 0 ){
      var types = [ "mobile", "office", "cell", "direct", "primary" ];
      for (var i = 0; i < agent.contact.phones.length; ++i) {
        if (
          types.indexOf( agent.contact.phones[i].additionalType.toLowerCase() ) ||
          types.indexOf( agent.contact.phones[i].type.toLowerCase() )
        ) {
          val = agent.contact.phones[i].phoneComplete;
          break;
        }
      }
    } else if ( agent.contact.homePhone ){
      val = agent.contact.homePhone;
    }
    return val;
  }

  /**
   * Add time zone if it's missing
   *
   * @param v
   * @param tz
   * @returns {*}
   */
  self.dateTZ = function dateTZ(v, tz) {
    if( v && tz && !v.match(/^.*(T\d{2}:\d{2}:\d{2})([-+]\d{2}:\d{2})$/g) ) {
      v = moment(v).format(`YYYY-MM-DD[T]HH:mm:ss${moment().tz(tz).format('Z')}`);
    }
    return v;
  }

  /**
   *
   * @param val
   * @param tz
   * @returns {string}
   */
  self.formatEventDate = function formatEventDate( data, tz ) {
    //console.log( 'mail-helper:formatEventDate. TimeZone [%s]', tz );
    let val = false;
    if( data && data.startDateTime && data.endDateTime ) {
      let startDateTime = self.dateTZ(data.startDateTime, tz),
          endDateTime = self.dateTZ(data.endDateTime, tz),
          startTimeFormat = 'dddd, MMMM Do, h:mm a',
          endTimeFormat = 'h:mm a z';

      if(tz) {
        val = `${moment(startDateTime).tz(tz).format(startTimeFormat)} - ${moment(endDateTime).tz(tz).format(endTimeFormat)}`;
      } else {
        val = `${moment(startDateTime).format(startTimeFormat)} - ${moment(endDateTime).format(endTimeFormat)}`;
      }
    }
    return val;
  }

  /**
   * Returns formatted number
   *
   * @param val
   * @returns {*}
   */
  self.numberFormat = function numberFormat( number, decimals, dec_point, thousands_sep ) {
    //  discuss at: http://phpjs.org/functions/number_format/
    // original by: Jonas Raoni Soares Silva (http://www.jsfromhell.com)
    // improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // improved by: davook
    // improved by: Brett Zamir (http://brett-zamir.me)
    // improved by: Brett Zamir (http://brett-zamir.me)
    // improved by: Theriault
    // improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // bugfixed by: Michael White (http://getsprink.com)
    // bugfixed by: Benjamin Lupton
    // bugfixed by: Allan Jensen (http://www.winternet.no)
    // bugfixed by: Howard Yeend
    // bugfixed by: Diogo Resende
    // bugfixed by: Rival
    // bugfixed by: Brett Zamir (http://brett-zamir.me)
    //  revised by: Jonas Raoni Soares Silva (http://www.jsfromhell.com)
    //  revised by: Luke Smith (http://lucassmith.name)
    //    input by: Kheang Hok Chin (http://www.distantia.ca/)
    //    input by: Jay Klehr
    //    input by: Amir Habibi (http://www.residence-mixte.com/)
    //    input by: Amirouche
    //   example 1: number_format(1234.56);
    //   returns 1: '1,235'
    //   example 2: number_format(1234.56, 2, ',', ' ');
    //   returns 2: '1 234,56'
    //   example 3: number_format(1234.5678, 2, '.', '');
    //   returns 3: '1234.57'
    //   example 4: number_format(67, 2, ',', '.');
    //   returns 4: '67,00'
    //   example 5: number_format(1000);
    //   returns 5: '1,000'
    //   example 6: number_format(67.311, 2);
    //   returns 6: '67.31'
    //   example 7: number_format(1000.55, 1);
    //   returns 7: '1,000.6'
    //   example 8: number_format(67000, 5, ',', '.');
    //   returns 8: '67.000,00000'
    //   example 9: number_format(0.9, 0);
    //   returns 9: '1'
    //  example 10: number_format('1.20', 2);
    //  returns 10: '1.20'
    //  example 11: number_format('1.20', 4);
    //  returns 11: '1.2000'
    //  example 12: number_format('1.2000', 3);
    //  returns 12: '1.200'
    //  example 13: number_format('1 000,50', 2, '.', ' ');
    //  returns 13: '100 050.00'
    //  example 14: number_format(1e-8, 8, '.', '');
    //  returns 14: '0.00000001'

    number = (number + '')
      .replace( /[^0-9+\-Ee.]/g, '' );
    var n = !isFinite( +number ) ? 0 : +number,
      prec = !isFinite( +decimals ) ? 0 : Math.abs( decimals ),
      sep = (typeof thousands_sep === 'undefined') ? ',' : thousands_sep,
      dec = (typeof dec_point === 'undefined') ? '.' : dec_point,
      s = '',
      toFixedFix = function ( n, prec ) {
        var k = Math.pow( 10, prec );
        return '' + (Math.round( n * k ) / k)
            .toFixed( prec );
      };
    // Fix for IE parseFloat(0.55).toFixed(0) = 0;
    s = (prec ? toFixedFix( n, prec ) : '' + Math.round( n ))
      .split( '.' );
    if( s[ 0 ].length > 3 ) {
      s[ 0 ] = s[ 0 ].replace( /\B(?=(?:\d{3})+(?!\d))/g, sep );
    }
    if( (s[ 1 ] || '')
        .length < prec ) {
      s[ 1 ] = s[ 1 ] || '';
      s[ 1 ] += new Array( prec - s[ 1 ].length + 1 )
        .join( '0' );
    }
    return s.join( dec );
  }

  /**
   * Returns Human Time ago
   *
   * @param val
   * @returns {*}
   */
  self.timeSince = function timeSince( val ) {
    var date = new Date( val );
    var seconds = Math.floor( (new Date() - date) / 1000 );
    var interval = Math.floor( seconds / 31536000 );

    if( interval > 1 ) {
      return interval + " years";
    }
    interval = Math.floor( seconds / 2592000 );
    if( interval > 1 ) {
      return interval + " months";
    }
    interval = Math.floor( seconds / 86400 );
    if( interval > 1 ) {
      return interval + " days";
    }
    interval = Math.floor( seconds / 3600 );
    if( interval > 1 ) {
      return interval + " hours";
    }
    interval = Math.floor( seconds / 60 );
    if( interval > 1 ) {
      return interval + " minutes";
    }
    return Math.floor( seconds ) + " seconds";
  }

  /**
   * Return true if price was reduced less than 48 hours ago.
   *
   * @param listing object
   * @returns {boolean}
   */
  self.isPriceReduced = function isPriceReduced( listing ) {
    if(
      typeof listing == 'object' &&
      typeof listing.primary == 'object' &&
      listing.primary.mpoStatus == 'active' &&
      typeof listing.primary.price == 'object' &&
      listing.primary.price.priceReduction &&
      listing.primary.price.priceChangeDate
    ) {
      return true;
      //var time = new Date( listing.primary.price.priceChangeDate ).getTime();
      //var currentTime = new Date().getTime();
      //var diffInHours = ( currentTime - time ) / 1000 / 60 / 60;
      //if( diffInHours < 48 ) {
      //  return true;
      //}
    }
    return false;
  }

  /**
   * Returnes formated reduced value of listing's price
   *
   * @param listing
   * @returns {*}
   */
  self.reducedSum = function reducedSum( listing ) {
    var diff;
    if(
      typeof listing == 'object' &&
      typeof listing.primary == 'object' &&
      typeof listing.primary.price == 'object' &&
      listing.primary.price.listingPrice &&
      listing.primary.price.origPrice &&
      listing.primary.price.origPrice - listing.primary.price.listingPrice > 0
    ) {
      diff = listing.primary.price.origPrice - listing.primary.price.listingPrice;
      diff = self.numberFormat( diff );
    }
    return diff;
  }



  /**
   * Returns percentage over/under listing price paid on property purchase
   *
   * @param listing
   * @returns {*}
   */
  self.getSoldPercentOfListing = function getSoldPercentOfListing( listing ) {
    var spOfLP;
    if(
        typeof listing == 'object' &&
        typeof listing.mls == 'object' &&
        typeof listing.mls.soldInformation == 'object' &&
        listing.mls.soldInformation.sellingPrice &&
        typeof listing.primary == 'object' &&
        typeof listing.primary.price == 'object' &&
        listing.primary.price.listingPrice
    ) {
      spOfLP = (listing.mls.soldInformation.sellingPrice / listing.primary.price.listingPrice);
      spOfLP = self.numberFormat( spOfLP, 2 );
    }
    return spOfLP;
  }


  /**
   * Returns correct formatted price
   *
   * @param listing object
   * @returns {*}
   */
  self.getPrice = function getPrice( listing ) {
    var price;

    if( typeof listing !== 'object' || typeof listing.primary !== 'object' ) {
      return 0;
    }

    switch( listing.primary.mpoStatus ) {

      case 'sold':
      case 'offMarket':
        if(
          typeof listing.mls == 'object' &&
          typeof listing.mls.soldInformation == 'object' &&
          listing.mls.soldInformation.sellingPrice > 0
        ) {
          price = listing.mls.soldInformation.sellingPrice;
        } else {
          price = listing.primary.price.listingPrice
        }
        break;

      default:
        price = listing.primary.price.listingPrice;
        break;

    }

    return self.numberFormat( price );
  }

  /**
   * Returns correct formatted price
   *
   * @param listing object
   * @returns {*}
   */
  self.getExcerpt = function getExcerpt( html, n, end ) {
    if( typeof n == 'undefined' ) n = 100;
    if( typeof end == 'undefined' ) end = '...';
    return excerpt.text( html, n, end );
  }

  /**
   * Returns description for open home event
   *
   * @param listing object
   * @returns {*}
   */
  self.getOpenHomeDescription = function getOpenHomeDescription( listing ) {
    var description = '';

    if(
      typeof listing.events !== 'undefined' &&
      typeof listing.events.openHomes !== 'undefined' &&
      listing.events.openHomes.length > 0
    ) {
      listing.events.openHomes.every( function( item ){
        if( typeof item.comments !== 'undefined' && item.comments.length > 0 ) {
          description = item.comments;
          return false;
        }
      } );
    }

    if(
      description.length == 0 &&
      typeof listing.description != 'undefined' &&
      typeof listing.description.marketingRemarks !== 'undefined'
    ) {
      description = listing.description.marketingRemarks;
    }

    return self.getExcerpt( description );
  }

  /**
   * Returns correct status color
   *
   * @param listing object
   * @returns {*}
   */
  self.getStatusColor = function getStatusColor( status ) {
    var color;
    switch( status ) {
      case 'active':
        color = '#75a863';
        break;
      case 'inContract':
        color = '#f7a500';
        break;
      case 'pending':
        color = '#1f6790';
        break;
      case 'sold':
        color = '#1f6790';
        break;
      case 'offMarket':
        color = '#000000';
        break;
      default:
        color = '#75a863';
        break;
    }
    return color;
  }

  /**
   * Returnes listing address
   *
   * @param address object
   * @returns {*}
   */
  self.formatAddress = function formatAddress( address ) {
    var value = '';

    if(!_.isEmpty(_.get(address,'streetNum'))) {
      value += address.streetNum;
    }

    if(!_.isEmpty(_.get(address,'streetNumModifier'))) {
      value += '-' + address.streetNumModifier;
    }

    if(!_.isEmpty(_.get(address,'streetDirection'))) {
      value += ' ' + address.streetDirection;
    }

    if(!_.isEmpty(_.get(address,'streetName'))) {
      value += ' ' + address.streetName;
    }

    if(!_.isEmpty(_.get(address,'streetSuffix'))) {
      value += ' ' + address.streetSuffix;
    }

    if(!_.isEmpty(_.get(address,'unitNum'))) {
      value += ' #' + address.unitNum;
    }

    return value.trim();
  }

  /**
   * Determine if the listing can be added to My Tours
   * GitHub Issue: https://github.com/MyPropertyOffice/mpo-app/issues/812
   *
   * Returns FALSE if:
   * - user is not an agent
   * - listing is not active
   * - listing does not have upcoming tour
   * - Upcoming tour is already over
   * - listing already added to My Tours
   */
  self.canBeAddedtoMyTours = function getMyTourButtonLink( listing, user, callback ) {

    // Determine if user is not an agent
    if( !user.isAgent ) {
      //console.log( "canBeAddedtoMyTours: User is not Agent" );
      return callback( null, false );
    }

    // Determine if listing is Active
    if( listing.primary.mpoStatus !== 'active' ) {
      //console.log( "canBeAddedtoMyTours: Listing [%s] is not active", listing._pid );
      return callback( null, false );
    }

    // Determine if listing does not contain Upcoming Tour
    if( !listing.events.tour || typeof listing.events.tour.endDateTime == 'undefined' ) {
      //console.log( "canBeAddedtoMyTours: No tour data for the listing [%s]", listing._pid );
      return callback( null, false );
    }

    // Determine if listing's tour is not already over
    var currentTime = moment().tz("America/Los_Angeles").format('YYYY-MM-DDTHH:mm');
    if( moment( listing.events.tour.endDateTime ).isBefore( currentTime ) ) {
      //console.log( "canBeAddedtoMyTours: Tour is already over" );
      return callback( null, false );
    }

    client.search( {
      index: esIndexProduction,
      type: ".percolator",
      size: 1,
      body: {
        "query": {
          "bool": {
            "must": [
              {
                "term": {
                  "_percolatorType": "mytour"
                }
              },
              {
                "term": {
                  "_userId": user._mid
                }
              },
              {
                "term": {
                  "_listingId": listing._pid
                }
              },
              {
                "range": {
                  "_myTour.endDateTime": {
                    "gt": currentTime
                  }
                }
              }
            ]
          }
        }
      }
    }, function ( error, response ) {

      if( !error && typeof response.hits !== 'undefined' && response.hits.total > 0 ) {
        //console.log( "canBeAddedtoMyTours: My Tour already added" );
        return callback( null, false );
      } else {
        return callback( null, true );
      }

    } );

  }

  return self;

}( {} ));