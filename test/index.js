/**
 * Tests
 *
 *
 */
const debug = require('debug')('boxmls-utility-test'),
      colors = require('colors'),
      firebase = require('boxmls-firebase-admin');

module.exports = {

  'before': function(done) {
    this.timeout( 15000 );

    const fs = require('fs');
    const path = require('path');

    // Certificate can be path to file or stringified JSON object
    let defaultPath = `${path.dirname(__filename).split(path.sep).slice(0,-1).join(path.sep)}/gce-key.json`;
    let gceCert = process.env.FIREBASE_ADMIN_CERT || defaultPath;

    if(!process.env.FIREBASE_ADMIN_DB) {
      return done(new Error("FIREBASE_ADMIN_DB env must be defined"));
    }

    if(!process.env.FIREBASE_ADMIN_REF) {
      return done(new Error("FIREBASE_ADMIN_REF env must be defined"));
    }

    const firebaseAdmin = firebase.init(gceCert);

    firebaseAdmin.ready(()=>{
      firebaseAdmin.exit(false,(err)=>{
        done(err);
      });
    });
  },

  'firebaseAdmin': {

    'can retrieve the data': function(){
      let data = firebase.getData();
      data.should.be.an.instanceOf(Object);
      data.should.have.property('test');
      data.test.should.equal('Hello World!');
    }

  },

  'mail': {

    'can send error notifications': function(done) {
      this.timeout( 10000 );

      const utility = require('../lib/index');
      utility.sendError(new Error("Test Error"), {
        cacheTimeout: 1
      }, (err)=>{
        done(err);
      });
    }

  }
  
};
