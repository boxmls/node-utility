/**
 * Tests
 *
 *
 */
const debug = require('debug')('boxmls-utility-test'),
      colors = require('colors'),
      utility = require('../lib/index'),
      async = require('async'),
      firebase = require('boxmls-firebase-admin');

const fs = require('fs');
const path = require('path');

// Certificate can be path to file or stringified JSON object
let defaultPath = `${path.dirname(__filename).split(path.sep).slice(0,-1).join(path.sep)}/gce-key.json`;
let gceCert = process.env.FIREBASE_ADMIN_CERT || defaultPath;

module.exports = {

  'before': function(done) {
    this.timeout( 15000 );

    if(!process.env.FIREBASE_ADMIN_DB) {
      return done(new Error("FIREBASE_ADMIN_DB env must be defined"));
    }

    if(!process.env.FIREBASE_ADMIN_REF) {
      return done(new Error("FIREBASE_ADMIN_REF env must be defined"));
    }

    const firebaseAdmin = firebase.init('database',gceCert);

    firebaseAdmin.ready(()=>{
      firebaseAdmin.exit((err)=>{
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

      utility.sendError(new Error("Test Error"), {
        cacheTimeout: 1
      }, (err)=>{
        done(err);
      });
    }

  },

  'getReferrer': {

    'checks referrer http://maxim.k8s.boxmls.com': function(done){
      this.timeout( 15000 );

      let referer = "http://maxim.k8s.boxmls.com";
      utility.getReferrer({headers:{referer:referer}},[gceCert],(err,urlParts)=>{
        try {
          urlParts.should.be.an.instanceOf(Object);
          urlParts.should.have.property('brand', 'boxmls');
          urlParts.should.have.property('agentSubdomain', 'maxim');
          urlParts.should.have.property('machineName', 'k8s');
          done();
        } catch(e) {
          done(e);
        }
      });
    },

    'return referrer http://maxim.k8s.boxmls.com from cache': function(done){
      this.timeout( 15000 );

      let referer = "http://maxim.k8s.boxmls.com";
      utility.getReferrer({headers:{referer:referer}},[gceCert],(err,urlParts)=>{
        try {
          urlParts.should.be.an.instanceOf(Object);
          urlParts.should.have.property('brand', 'boxmls');
          urlParts.should.have.property('agentSubdomain', 'maxim');
          urlParts.should.have.property('machineName', 'k8s');
          done();
        } catch(e) {
          done(e);
        }
      });
    },

    'checks referrer http://test.com': function(done){
      this.timeout( 15000 );
      let referer = "http://test.com";
      utility.getReferrer({headers:{referer:referer}},[gceCert],(err,urlParts)=>{
        try {
          urlParts.should.be.an.instanceOf(Object);
          urlParts.should.have.property('brand', null);
          urlParts.should.have.property('agentSubdomain', false);
          urlParts.should.have.property('machineName', false);
          done();
        } catch(e) {
          done(e);
        }
      });
    },

    'checks referrer http://cdn.boxmls.com': function(done){
      this.timeout( 15000 );
      let referer = "http://cdn.boxmls.com";
      utility.getReferrer({headers:{referer:referer}},[gceCert],(err,urlParts)=>{
        try {
          urlParts.should.be.an.instanceOf(Object);
          urlParts.should.have.property('brand', 'boxmls');
          urlParts.should.have.property('agentSubdomain', false);
          urlParts.should.have.property('machineName', false);
          done();
        } catch(e) {
          done(e);
        }
      });
    }

  }
  
};
