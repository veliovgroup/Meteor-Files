node-throttle
=============
### Node.js Transform stream that passes data through at `n` bytes per second
[![Build Status](https://secure.travis-ci.org/TooTallNate/node-throttle.png)](http://travis-ci.org/TooTallNate/node-throttle)

This module offers a `Throttle` passthrough stream class, which allows you to
write data to it and it will be passed through in `n` bytes per second. It can
be useful for throttling HTTP uploads or to simulate reading from a file in
real-time, etc.


Installation
------------

``` bash
$ npm install throttle
```


Example
-------

Here's an example of throttling stdin at 1 byte per second and outputting the
data to stdout:

``` js
var Throttle = require('throttle');

// create a "Throttle" instance that reads at 1 bps
var throttle = new Throttle(1);

process.stdin.pipe(throttle).pipe(process.stdout);
```

We can see it in action with the `echo` command:

![](http://f.cl.ly/items/2h1I2Q0m3x1I2s2r2O3R/throttle.opt.gif)


API
---

  - [Throttle()](#throttle)

## Throttle()

The `Throttle` passthrough stream class is very similar to the node core
`stream.Passthrough` stream, except that you specify a `bps` "bytes per
second" option and data *will not* be passed through faster than the byte
value you specify.

You can invoke with just a `bps` Number and get the rest of the default
options. This should be more common:

``` js
process.stdin.pipe(new Throttle(100 * 1024)).pipe(process.stdout);
```

Or you can pass an `options` Object in, with a `bps` value specified along with
other options:

``` js
var t = new Throttle({ bps: 100 * 1024, chunkSize: 100, highWaterMark: 500 });
```
