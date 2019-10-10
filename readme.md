![image](https://user-images.githubusercontent.com/308489/57512890-9acacc00-7315-11e9-854f-ad77da4d2742.png)

[![CircleCI](https://circleci.com/gh/boxmls/node-utility.svg?style=svg)](https://circleci.com/gh/boxmls/node-utility)

# Node utility

The set of general project helper functions and utilities ( e.g., AWS utility )

## Installation

To add the module to BoxMLS service ( to install module and add it to `package.json`):
 
```
npm install --save https://github.com/boxmls/node-utility.git#0.3.13
```

## Process Environments

* `SLACK_WEBHOOK_URI`. Optional
* `SLACK_WEBHOOK_CHANNEL`. Optional
* `MANDRILL_KEY_PRODUCTION`. Optional
* `MANDRILL_KEY_DEVELOPMENT`. Optional
* `ALERT_EMAIL_TO`. Optional
* `ALERT_EMAIL_FROM`. Optional
* `NODE_ENV`. Optional. Enums: `production`,`development`

Module `boxmls-firebase-admin` environments:
* `FIREBASE_ADMIN_CERT`. Optional. Path to GCE Certificate file or Certificate itself (JSON) 
* `FIREBASE_ADMIN_DB`. Optional. Database name which is used to generate Database URL using the pattern `https://{DATABASENAME}.firebaseio.com`.
* `FIREBASE_ADMIN_REF`. Optional. Database Resource Referal.
* `FIREBASE_CACHE_DIR`. Optional. The directory where cache file with firebase data will be stored.

## Functions

* `createMail( options )`. Initializes Mail tuility to send emails via Mandrill
* `getS3( options )`. Returns S3 Wrapper object for AWS S3 node module
* `getHash( object )`. Returns sha1 hash for object
* `sendError( Error, details, callback )`. Sends detailed Error information to email (and Slack. Optional).
* `scrollResults( query, documentHandler, callback )`. Handler For Scrolling through large dataset with simple callback system
* `setupElasticsearchMapping( options, callback )`. Creates index and its mapping from file(s).

# Support

Do you have any questions. Please, visit [Support](https://boxmls.github.io/support) page for consulting and help.