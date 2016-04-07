
var Throttle = require('../');

// create a "Throttle" instance that reads at 10 kb/s
var rate = +process.argv[2] || 10;
var kb = 1024;
var throttle = new Throttle(rate * kb);

process.stdin.pipe(throttle).pipe(process.stdout);
