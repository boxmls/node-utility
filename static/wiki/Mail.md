The module has Mail utility to send smart Email Notifications.

## Usage

```js
var utility = require('@mypropertyoffice/utility');
var mail = utility.createMail( {
  // Optional
  // Module defines test or live mandrill key by branch.
  // It can be define manually here, though.
  "mandrillKey": "{mandrillKey}",
  // Optional. Default templates path is used.
  // If you need to set path to your custom templates directory, use `templatesPath` to re-define it.
  "templatesPath": path.dirname(require.resolve('@mypropertyoffice/utility/package.json')) + '/static/email-templates',
  // Optional. The utility sends statistic to Slack channel. 
  // You can re-define slackWebhook with you custom one
  "slackWebhook": "{slackWebhook}"
} );

mail.send( 'name-of-template', {
  "to": "maxim@boxmls.com",
  "from": "info@[brand-email-domain]",
  "subject": "Activate your [brand-name] website!"
  "activation_link": "[brand-uri]/activation/hash"
}
```

## Email Templates



## Content Tags

In some cases, it's necessary to have ability to set pre-defined tags which will be replaced with dynamic values. 

For example, to set activation link, we're using `[brand-uri]` tag, which will be replaced with detected Brand's URI.

There are the following pre-defined list of tags:
* `[brand-name]`. Name of the detected Brand ( e.g. `BoxMLS` ).
* `[brand-domain]`. Domain of the detected Brand ( e.g. `boxmls.com` ).
* `[brand-email-domain]`. Email Domain of the detected Brand ( e.g. `boxmls.com` ).
* `[brand-uri]`. Url of the detected Brand ( e.g. `https://boxmls.com` ).

You are able to set a tag anywhere in options, mail utility is scrolling and replacing tags in options object recursively.

## Features

Mail utility handles logic tied to detecting of the Brand.

It tries to detect the Brand by:
* Agent object if exists ( e.g., on `mail.send( options, callback )`, it is looking for the brand in agent object `options.agent.brand` ).
* If Agent object does not exists ( it happens, when we're sending email to Agent, but not to client ) we try to detect the brand by email Recipient(s). Not, we're looking only `to`. And `cc` and `bcc` are being ignored.