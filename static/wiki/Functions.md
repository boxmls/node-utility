```
var boxMLSUtility = require('@mypropertyoffice/utility');
```

### scrollResults

```
boxMLSUtility.scrollResults( parameters, documentHandler, callback )
```

Handler For Scrolling through large dataset with simple callback system

#### Parameters
No parameters

### getConfig

```
boxMLSUtility.getConfig()
```

Returns general BoxMLS configuration, such as authorization keys, trusted domains and user-agents, etc.

#### Parameters
No parameters

### getReferrer

```
boxMLSUtility.getReferrer(req, callback)
```

Returns Object, which contains url parts, subdomain and brand details of Referrer.
 
It determines referrer by the following headers in 

#### Parameters
* `req`. Express Request object.
* `callback`. Callback function.

### sendError

```
boxMLSUtility.sendError( error )
```

Sends detailed report about the error to Slack and Email.

#### Parameters
* `error`. Error object.