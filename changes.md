### 0.3.12
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