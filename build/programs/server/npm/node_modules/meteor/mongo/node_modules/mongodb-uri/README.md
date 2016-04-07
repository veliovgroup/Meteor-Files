# mongodb-uri

Parse and format MongoDB URIs of the form:

```
mongodb://[username[:password]@]host1[:port1][,host2[:port2],...[,hostN[:portN]]][/[database]][?options]
```

Note that there are two minor differences between this format and the
[standard MongoDB connect string URI format](http://docs.mongodb.org/manual/reference/connection-string/):

1. `password` is optional even when a `username` is supplied
2. The slash before the `database` is not required when leaving out the `database` but specifying `options`

Neither of these differences should prevent this library from parsing any URI conforming to the standard format.

## Usage

### parse

Takes a URI string and returns a URI object of the form:

```
{
  scheme: !String,
  username: String=,
  password: String=,
  hosts: [ { host: !String, port: Number= }, ... ],
  database: String=,
  options: Object=
}
```

`scheme` and `hosts` will always be present. Other fields will only be present in the result if they were present in the
input.

#### Example

```javascript
var mongodbUri = require('mongodb-uri');
var uri = 'mongodb://user%3An%40me:p%40ssword@host:1234/d%40tabase?authSource=%40dmin';
var uriObject = mongodbUri.parse(uri);
console.log(JSON.stringify(uriObject, null, 2));
```

```
{
  "scheme": "mongodb",
  "hosts": [
    {
      "host": "host",
      "port": 1234
    }
  ],
  "username": "user:n@me",
  "password": "p@ssword",
  "options": {
    "authSource": "@dmin"
  },
  "database": "d@tabase"
}
```

### format

Takes a URI object and returns a URI string.

#### Example

```javascript
var mongodbUri = require('mongodb-uri');
var uri = mongodbUri.format(
        {
            username: 'user:n@me',
            password: 'p@ssword',
            hosts: [
                {
                    host: 'host',
                    port: 1234
                }
            ],
            database: 'd@tabase',
            options: {
                authSource: '@dmin'
            }
        }
);
console.log(uri);
```

```
mongodb://user%3An%40me:p%40ssword@host:1234/d%40tabase?authSource=%40dmin
```

### formatMongoose

Takes either a URI object or string and returns a Mongoose connection string. Specifically, instead of listing all hosts
and ports in a single URI, a Mongoose connection string contains a list of URIs each with a single host and port pair.

Useful in environments where a MongoDB URI environment variable is provided, but needs to be programmatically
transformed into a string digestible by [mongoose.connect()](http://mongoosejs.com/docs/connections.html)--for example,
when deploying to a [PaaS like Heroku using a MongoDB add-on like MongoLab](https://devcenter.heroku.com/articles/mongolab).

#### Example

```javascript
var mongoose = require('mongoose');
var mongodbUri = require('mongodb-uri');

// A MongoDB URI, not compatible with Mongoose because it lists multiple hosts in the address
// Could be pulled from an environment variable or config file
var uri = 'mongodb://username:password@host1:1234,host2:5678/database';

// Reformat to a Mongoose connect string and connect()
var mongooseConnectString = mongodbUri.formatMongoose(uri);
mongoose.connect(mongooseConnectString);

// Test for connection success
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'Connection error: '));
db.once('open', function callback () {
    console.log('Successfully connected to MongoDB');
});
```
