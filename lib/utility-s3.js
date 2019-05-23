/**
 * S3 Utility
 *
 * @author peshkov@UD
 */

let debug = require( 'debug' )('bu'),
    _ = require('lodash'),
    config = require( '../package.json').config,
    s3 = require('s3');

Object.defineProperties( module.exports, {
  create: {
    value: function create( options ) {
      return new s3Utility( options );
    },
    enumerable: true,
    writable: true
  },
  version: {
    value: 0.1,
    writable: false
  }
});

/**
 *
 */
function s3Utility( options ) {

  var self = this;

  options = _.defaults( options, {
    region: "us-west-1",
    bucket: "cdn.boxmls.com",
    bucketDir: "",
    accessKeyId: _.get( config, 'aws.access_key_id' ),
    secretAccessKey: _.get( config, 'aws.secret_access_key' )
  });

  var client = s3.createClient({
    s3Options: {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
      region: options.region
    }
  });

  /**
   *
   *
   */
  self.deleteObjects = function deleteObjects( filenames, callback ) {
    try {

      var Objects = [];
      _.each( filenames, function( filename ) {
        Objects.push( {
          "Key": options.bucketDir + "/" + filename
        } );
      } );

      var s3Params = {
        Bucket: options.bucket,
        Delete: {
          Objects: Objects,
          Quiet: false
        }
      };

      //console.log(require('util').inspect( s3Params, {showHidden: false, depth: 10, colors: true}));

      var listener = client.deleteObjects( s3Params );

      listener.on('error', function(err) {
        throw err;
      });

      listener.on('end', function() {
        callback( null );
      });

    } catch(e) {
      console.error( "Unable to delete Objects from [%s] bucket. Dir: [%s]", options.bucket, options.bucketDir );
      console.error("Error", require('util').inspect( e, {showHidden: false, depth: 10, colors: true}));
      callback( e, false );
    }
  }

  /**
   * Remove the specific DIR with all its data recursively
   *
   */
  self.deleteDir = function deleteDir( dirPath, callback ) {
    try {

      var s3Params = {
        Bucket: options.bucket,
        Prefix: options.bucketDir + '/' + dirPath
      };

      //console.log(require('util').inspect( s3Params, {showHidden: false, depth: 10, colors: true}));

      var listener = client.deleteDir( s3Params );

      listener.on('error', function(err) {
        throw err;
      });

      listener.on('end', function() {
        callback( null );
      });

    } catch(e) {
      console.error( "Unable to delete Dir [%s] from [%s] bucket. Dir: [%s]", dirPath, options.bucket, options.bucketDir );
      console.error("Error", require('util').inspect( e, {showHidden: false, depth: 10, colors: true}));
      callback( e, false );
    }
  }

  /**
   *
   *
   */
  self.listObjects = function listObjects( callback ) {
    try {
      var objects = [];
      var listener = client.listObjects( {
        s3Params: {
          Bucket: options.bucket,
          Prefix: options.bucketDir + "/"
        }
      } );

      listener.on('error', function(err) {
        throw err;
      });

      listener.on('data', function( data ) {
        objects = _.get( data, "Contents", [] );
      });

      listener.on('end', function() {
        callback( null, objects );
      });

    } catch(e) {
      console.error( "Unable to get Objects from [%s] bucket. Dir: [%s]", options.bucket, options.bucketDir );
      callback( e, false );
    }
  }

  /**
   * Update metadata of file
   *
   */
  self.updateMeta = function updateMeta( filename, metadata, callback ) {
    try {
      var Key = ( options.bucketDir.length > 0 ? options.bucketDir + "/" + filename : filename );

      var listener =  client.copyObject({
        Bucket: options.bucket,
        CopySource: options.bucket + '/' + Key,
        Key: Key,
        MetadataDirective: "REPLACE",
        Metadata: metadata
      });

      listener.on('error', function(err) {
        throw err;
      });

      listener.on('end', function() {
        callback( null, true );
      });

    } catch(e) {
      callback( e, false );
    }
  }

  /**
   * Check if file exists on S3 and return its Public URI
   *
   */
  self.getPublicURI = function getPublicURI( filename, callback ) {
    try {
      var Key = ( options.bucketDir.length > 0 ? options.bucketDir + "/" + filename : filename );
      client.s3.headObject({
        Bucket: options.bucket,
        Key: Key
      }, function( err ) {
        if (err) {
          //console.log(require('util').inspect(err, {showHidden: false, depth: 10, colors: true}));
          callback( null, false );
        } else {
          var uri = s3.getPublicUrl( options.bucket, Key, options.region );
          callback( null, uri );
        }
      });
    } catch(e) {
      console.error( "Unable to get Public URI:", filename, e.message);
      callback( e, false );
    }
  }

  /**
   * Download File from Amazon S3
   */
  self.download = function download( filename, localFile, callback ) {
    var Key = ( options.bucketDir.length > 0 ? options.bucketDir + "/" + filename : filename );
    var _options = {
      localFile: localFile,
      s3Params: {
        Bucket: options.bucket,
        Key: Key
      }
    };
    try {
      var downloader = client.downloadFile(_options);
      downloader.on('error', function(err) {
        callback( err, false );
      });
      downloader.on('end', function() {
        callback( null, true );
      });
    } catch(e) {
      console.error( "Unable to download:", localFile, e.message);
      callback( e, false );
    }
  }

  /**
   * Upload File from Buffer to Amazon S3
   *
   * We use separate node module `aws-sdk`, because
   * `s3` module does not have ability to upload data from buffer directly.
   *
   * @param filename
   * @param buffer
   * @param _options
   * @param callback
   */
  self.uploadFromBuffer = function uploadFromBuffer( filename, buffer, _options, callback ) {
    debug( "Uploading file from Buffer to S3. Filename: [%s]", filename );

    _options = _.defaults( _options, {
      "metadata": {},
      "mimetype": "image/jpeg"
    });

    var AWS = require('aws-sdk');
    AWS.config.update({accessKeyId: _.get( options, 'accessKeyId' ), secretAccessKey: _.get( options, 'secretAccessKey' )});
    var S3 = new AWS.S3({region: _.get( options, 'region' ) });

    var params = {
      Bucket: options.bucket, // your s3 bucket name
      Key: filename,
      Body: buffer,
      ACL: 'public-read',
      ContentType: _options.mimetype
    }

    if(!_.isEmpty(_options.metadata)) {
      params['Metadata'] = _options.metadata;
    }

    S3.putObject( params, function(e) {
      if(e) {
        return callback(e,false);
      } else {
        return callback(null,true);
      }
    } );

  }

  /**
   * Upload File to Amazon S3
   */
  self.upload = function upload( filename, localFile, metadata, callback ) {
    debug( "Uploading [%s] file to S3. Filename: [%s]", localFile, filename );
    var Key = ( options.bucketDir.length > 0 ? options.bucketDir + "/" + filename : filename );
    var _options = {
      localFile: localFile,
      s3Params: {
        Bucket: options.bucket,
        Key: Key
      }
    };
    if( !_.isEmpty( metadata ) && typeof metadata == "object" ) {
      _options[ 's3Params' ][ 'Metadata' ] = metadata;
    }

    try {
      var uploader = client.uploadFile(_options);
      uploader.on('error', function(err) {
        console.error("Unable to upload:", localFile, err.stack);
        callback( err, false );
      });
      uploader.on('end', function() {
        callback( null, true );
      });
    } catch(e) {
      console.error( "Unable to upload:", localFile, e.message);
      callback( e, false );
    }
  }

}