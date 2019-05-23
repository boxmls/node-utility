### 0.2.21
* Extended `mail` utility with `MLS` env. Needed for detecting time zones.

### 0.2.20
* Fixed `sendError` function.

### 0.2.19
* Improved `getConfig` function. Increased brands cache from 5 to 10 minutes.

### 0.2.18
* Added ability to provide brand as parameter on sending email.

### 0.2.17
* Improvements to `getConfig` and `getReferer` functions. Now we store some brands information in config and detect brand of referer. 

### 0.2.14
* Improvements to `sendError` function. Added more parameters. By default, the same error can not be sent more than once per hour.

### 0.2.12
* Updated `getReferer` function with new requirements.

### 0.2.11
* Extended `getConfig` function to have ability to get dynamic configuration. Now `config.rules.domains` can be built on fly.

### 0.2.10
* Refactored `sendError` function.

### 0.2.9
* Replaced `node-mandrill` with official `mandrill-api` module.

### 0.2.7
* Added `scrollResults` function.

### 0.2.3
* Added `logEntry` utility. 

### 0.2.0
* Added Mail utility. See `getMail` function.
* Added `sendError` function, which sends detailed information about an error to Slack and Email.

### 0.1.3
* Added `uploadFromBuffer` function to S3 API utility

### 0.1.2
* Added `getS3` function. Returns S3 API object.
* Extended configuration data.

### 0.1.0
* Added `getReferrer` function
* Added `getConfig` function