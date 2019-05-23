The module includes Log Entry utility, which uses `async.queue`.
 
## Usage

```js
var utility = require('boxmls/utility');

// The request is being added to `async.queue`.
// So callback function is optional.
utility.logEntry.log( data );
```