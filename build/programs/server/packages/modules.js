(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var _ = Package.underscore._;
var meteorInstall = Package['modules-runtime'].meteorInstall;

/* Package-scope variables */
var Buffer, process;

var require = meteorInstall({"node_modules":{"meteor":{"modules":{"server.js":["./buffer.js","./process.js",function(require){

///////////////////////////////////////////////////////////////////////////
//                                                                       //
// packages/modules/server.js                                            //
//                                                                       //
///////////////////////////////////////////////////////////////////////////
                                                                         //
require("./buffer.js");
require("./process.js");

///////////////////////////////////////////////////////////////////////////

}],"buffer.js":["buffer",function(require){

///////////////////////////////////////////////////////////////////////////
//                                                                       //
// packages/modules/buffer.js                                            //
//                                                                       //
///////////////////////////////////////////////////////////////////////////
                                                                         //
try {
  Buffer = global.Buffer || require("buffer").Buffer;
} catch (noBuffer) {}

///////////////////////////////////////////////////////////////////////////

}],"process.js":["process",function(require,exports,module){

///////////////////////////////////////////////////////////////////////////
//                                                                       //
// packages/modules/process.js                                           //
//                                                                       //
///////////////////////////////////////////////////////////////////////////
                                                                         //
try {
  // The application can run `npm install process` to provide its own
  // process stub; otherwise this module will provide a partial stub.
  process = global.process || require("process");
} catch (noProcess) {
  process = {};
}

if (Meteor.isServer) {
  // Make require("process") work on the server in all versions of Node.
  meteorInstall({
    node_modules: {
      "process.js": function (r, e, module) {
        module.exports = process;
      }
    }
  });
} else {
  process.platform = "browser";
  process.nextTick = process.nextTick || Meteor._setImmediate;
}

if (typeof process.env !== "object") {
  process.env = {};
}

_.extend(process.env, meteorEnv);

///////////////////////////////////////////////////////////////////////////

}]}}}},{"extensions":[".js",".json"]});
var exports = require("./node_modules/meteor/modules/server.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
(function (pkg, symbols) {
  for (var s in symbols)
    (s in pkg) || (pkg[s] = symbols[s]);
})(Package.modules = exports, {
  meteorInstall: meteorInstall,
  Buffer: Buffer,
  process: process
});

})();
