## BoxMLS Functions Utility

* The set of general project helper functions and utilities ( e.g., AWS utility )
* Stores general BoxMLS configuration.

## Installation

To add the module to BoxMLS service ( to install module and add it to `package.json`):
 
```
npm install --save https://github.com/boxmls/node-utility.git#0.3.2
```

## Process Environments

* `SLACK_WEBHOOK_URI`
* `SLACK_WEBHOOK_CHANNEL`
* `MANDRILL_KEY_LIVE`
* `ALERT_EMAIL_TO`
* `ALERT_EMAIL_FROM`
* `NODE_ENV`. Enums: `production`,`development`