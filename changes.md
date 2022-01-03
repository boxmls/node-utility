### 0.7.4
* Removed ENV `ES_ADDRESS` from the list of ENVs which we want to send in alert notification
### 0.7.3
* Updated `node-utility` to use Elastic Search version 7.15.

### 0.7.2
* Fixed typo in Elastic Search request for Cache.
* Prevented checking Referrer for `Liveness probe` requests 
### 0.7.1
* Removed parameters `from` for ES query, as it is not supported since Elastic Search version 6.0.
### 0.6.8
* Updated `node-utility` to use Elastic Search version 6.8.

### 0.6.7
* Updated `elasticsearch-cache` module to use Elastic Search version 6.8 and above.

### 0.6.5
* Updated `boxmls-firebase-admin` npm module to `0.2.7`
* Added improvements to `getReferrer` function. Now it tries to detect valid BoxMLS referrer from the list.

### 0.6.4
* Updated `boxmls-firebase-admin` npm module to `0.2.6`

### 0.6.3
* Updated `flush` method of `elasticsearch-cache` to prevent removing of not existent documents.

### 0.6.2
* Updated `boxmls-firebase-admin` npm module to `0.2.5`

### 0.6.1
* Added `checkIfDisabled` method to `elasticsearch-cache` library to be able to disable cache logic with `ES_CACHE_DISABLED` env.

### 0.6.0
* Updated `elasticsearch-cache` mocha tests in terms of new functionality.
* Updated `elasticsearch-cache` library, small fixes, added new comments, switched `console.error` to `debug`, updated `debug` messages.

### 0.5.9
* Rebuilt `flushServiceCache` method.

### 0.5.8
* Fixed `flushServiceCache` method.

### 0.5.7
* Added `flushServiceCache` method.
* Cleaned up `set` method from unneeded fields of cache document. 

### 0.5.6
* Prevent build URL parts details in case brand couldn't be detected for `getReferrer` request.

### 0.5.5
* Replaced `node-cache` with `elasticsearch-cache` internal library for `getReferrer` request.
* Cleaned up `package.json`, removed `md5` and `node-cache` npm packages since it not using anymore. 

### 0.5.4
* Added condition to prevent manipulates with cache without `GIT_NAME` and `GIT_BRANCH` ENVs.
* Added `GIT_NAME` and `GIT_BRANCH` environment variables to `circleci` config. 
* Re-ordered cache document items for `elasticsearch-cache` library, moved body item to bottom to easy debug.

### 0.5.3
* Added raw `key` value into cache document for `elasticsearch-cache` library.
* Re-ordered cache document items for `elasticsearch-cache` library.

### 0.5.2
* Fixed `elasticsearch-cache` library data types converter.

### 0.5.1
* Fixed `buildIdHash` and `set` methods of `elasticsearch-cache` library.
* Updated logs.

### 0.5.0
* Implemented `elasticsearch-cache` library.

### 0.4.2
* Updated `node-firebase-admin` to `0.2.4`

### 0.4.1
* Updated getReferrer method with supporting a full path as fallback.

### 0.4.0
* Added `getReferrer` function which uses Firebase Firestore to detect brand for a referrer.

### 0.3.15
* Added CirceCI tests.
* Added `boxmls-firebase-admin` module as wrapper for all `process.env` variables, so value(s) can be retrieved from firebase admin database id `process.env`(s) is not defined.
* Fixed the path to static email templates
* Fixed the bug on sending error notification when slack envs are not set
* Fixed the bug on error from Mandrill API.

### 0.3.7
* Improvements to Mail utility.
* Improvements to scrollResults function.

### 0.3.5
* Fixed utility-mail with correct Mandrill keys env.

### 0.3.4
* Fixed syntax errors.

### 0.3.3
* Removed deprecated and extra functions, utilities.
* Cleaned up `utility-mail`

### 0.3.2
* Added logic for global overriding/add settings for each ES index

### 0.3.1
* Added `setupElasticsearchMapping` function