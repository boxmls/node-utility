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