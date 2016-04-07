(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var check = Package.check.check;
var Match = Package.check.Match;
var Random = Package.random.Random;
var EJSON = Package.ejson.EJSON;
var _ = Package.underscore._;
var Retry = Package.retry.Retry;
var MongoID = Package['mongo-id'].MongoID;
var DiffSequence = Package['diff-sequence'].DiffSequence;
var ECMAScript = Package.ecmascript.ECMAScript;
var DDPCommon = Package['ddp-common'].DDPCommon;
var DDP = Package['ddp-client'].DDP;
var WebApp = Package.webapp.WebApp;
var main = Package.webapp.main;
var WebAppInternals = Package.webapp.WebAppInternals;
var RoutePolicy = Package.routepolicy.RoutePolicy;
var Hook = Package['callback-hook'].Hook;
var LocalCollection = Package.minimongo.LocalCollection;
var Minimongo = Package.minimongo.Minimongo;
var meteorInstall = Package.modules.meteorInstall;
var Buffer = Package.modules.Buffer;
var process = Package.modules.process;
var Symbol = Package['ecmascript-runtime'].Symbol;
var Map = Package['ecmascript-runtime'].Map;
var Set = Package['ecmascript-runtime'].Set;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var StreamServer, DDPServer, Server;

var require = meteorInstall({"node_modules":{"meteor":{"ddp-server":{"stream_server.js":function(require){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/ddp-server/stream_server.js                                                                              //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
var url = Npm.require('url');                                                                                        // 1
                                                                                                                     //
// By default, we use the permessage-deflate extension with default                                                  //
// configuration. If $SERVER_WEBSOCKET_COMPRESSION is set, then it must be valid                                     //
// JSON. If it represents a falsey value, then we do not use permessage-deflate                                      //
// at all; otherwise, the JSON value is used as an argument to deflate's                                             //
// configure method; see                                                                                             //
// https://github.com/faye/permessage-deflate-node/blob/master/README.md                                             //
//                                                                                                                   //
// (We do this in an _.once instead of at startup, because we don't want to                                          //
// crash the tool during isopacket load if your JSON doesn't parse. This is only                                     //
// a problem because the tool has to load the DDP server code just in order to                                       //
// be a DDP client; see https://github.com/meteor/meteor/issues/3452 .)                                              //
var websocketExtensions = _.once(function () {                                                                       // 14
  var extensions = [];                                                                                               // 15
                                                                                                                     //
  var websocketCompressionConfig = process.env.SERVER_WEBSOCKET_COMPRESSION ? JSON.parse(process.env.SERVER_WEBSOCKET_COMPRESSION) : {};
  if (websocketCompressionConfig) {                                                                                  // 19
    extensions.push(Npm.require('permessage-deflate').configure(websocketCompressionConfig));                        // 20
  }                                                                                                                  //
                                                                                                                     //
  return extensions;                                                                                                 // 25
});                                                                                                                  //
                                                                                                                     //
var pathPrefix = __meteor_runtime_config__.ROOT_URL_PATH_PREFIX || "";                                               // 28
                                                                                                                     //
StreamServer = function StreamServer() {                                                                             // 30
  var self = this;                                                                                                   // 31
  self.registration_callbacks = [];                                                                                  // 32
  self.open_sockets = [];                                                                                            // 33
                                                                                                                     //
  // Because we are installing directly onto WebApp.httpServer instead of using                                      //
  // WebApp.app, we have to process the path prefix ourselves.                                                       //
  self.prefix = pathPrefix + '/sockjs';                                                                              // 30
  RoutePolicy.declare(self.prefix + '/', 'network');                                                                 // 38
                                                                                                                     //
  // set up sockjs                                                                                                   //
  var sockjs = Npm.require('sockjs');                                                                                // 30
  var serverOptions = {                                                                                              // 42
    prefix: self.prefix,                                                                                             // 43
    log: function () {                                                                                               // 44
      function log() {}                                                                                              // 44
                                                                                                                     //
      return log;                                                                                                    //
    }(),                                                                                                             //
    // this is the default, but we code it explicitly because we depend                                              //
    // on it in stream_client:HEARTBEAT_TIMEOUT                                                                      //
    heartbeat_delay: 45000,                                                                                          // 47
    // The default disconnect_delay is 5 seconds, but if the server ends up CPU                                      //
    // bound for that much time, SockJS might not notice that the user has                                           //
    // reconnected because the timer (of disconnect_delay ms) can fire before                                        //
    // SockJS processes the new connection. Eventually we'll fix this by not                                         //
    // combining CPU-heavy processing with SockJS termination (eg a proxy which                                      //
    // converts to Unix sockets) but for now, raise the delay.                                                       //
    disconnect_delay: 60 * 1000,                                                                                     // 54
    // Set the USE_JSESSIONID environment variable to enable setting the                                             //
    // JSESSIONID cookie. This is useful for setting up proxies with                                                 //
    // session affinity.                                                                                             //
    jsessionid: !!process.env.USE_JSESSIONID                                                                         // 58
  };                                                                                                                 //
                                                                                                                     //
  // If you know your server environment (eg, proxies) will prevent websockets                                       //
  // from ever working, set $DISABLE_WEBSOCKETS and SockJS clients (ie,                                              //
  // browsers) will not waste time attempting to use them.                                                           //
  // (Your server will still have a /websocket endpoint.)                                                            //
  if (process.env.DISABLE_WEBSOCKETS) {                                                                              // 30
    serverOptions.websocket = false;                                                                                 // 66
  } else {                                                                                                           //
    serverOptions.faye_server_options = {                                                                            // 68
      extensions: websocketExtensions()                                                                              // 69
    };                                                                                                               //
  }                                                                                                                  //
                                                                                                                     //
  self.server = sockjs.createServer(serverOptions);                                                                  // 73
                                                                                                                     //
  // Install the sockjs handlers, but we want to keep around our own particular                                      //
  // request handler that adjusts idle timeouts while we have an outstanding                                         //
  // request.  This compensates for the fact that sockjs removes all listeners                                       //
  // for "request" to add its own.                                                                                   //
  WebApp.httpServer.removeListener('request', WebApp._timeoutAdjustmentRequestCallback);                             // 30
  self.server.installHandlers(WebApp.httpServer);                                                                    // 81
  WebApp.httpServer.addListener('request', WebApp._timeoutAdjustmentRequestCallback);                                // 82
                                                                                                                     //
  // Support the /websocket endpoint                                                                                 //
  self._redirectWebsocketEndpoint();                                                                                 // 30
                                                                                                                     //
  self.server.on('connection', function (socket) {                                                                   // 88
    socket.send = function (data) {                                                                                  // 89
      socket.write(data);                                                                                            // 90
    };                                                                                                               //
    socket.on('close', function () {                                                                                 // 92
      self.open_sockets = _.without(self.open_sockets, socket);                                                      // 93
    });                                                                                                              //
    self.open_sockets.push(socket);                                                                                  // 95
                                                                                                                     //
    // XXX COMPAT WITH 0.6.6. Send the old style welcome message, which                                              //
    // will force old clients to reload. Remove this once we're not                                                  //
    // concerned about people upgrading from a pre-0.7.0 release. Also,                                              //
    // remove the clause in the client that ignores the welcome message                                              //
    // (livedata_connection.js)                                                                                      //
    socket.send(JSON.stringify({ server_id: "0" }));                                                                 // 88
                                                                                                                     //
    // call all our callbacks when we get a new socket. they will do the                                             //
    // work of setting up handlers and such for specific messages.                                                   //
    _.each(self.registration_callbacks, function (callback) {                                                        // 88
      callback(socket);                                                                                              // 107
    });                                                                                                              //
  });                                                                                                                //
};                                                                                                                   //
                                                                                                                     //
_.extend(StreamServer.prototype, {                                                                                   // 113
  // call my callback when a new socket connects.                                                                    //
  // also call it for all current connections.                                                                       //
  register: function () {                                                                                            // 116
    function register(callback) {                                                                                    // 116
      var self = this;                                                                                               // 117
      self.registration_callbacks.push(callback);                                                                    // 118
      _.each(self.all_sockets(), function (socket) {                                                                 // 119
        callback(socket);                                                                                            // 120
      });                                                                                                            //
    }                                                                                                                //
                                                                                                                     //
    return register;                                                                                                 //
  }(),                                                                                                               //
                                                                                                                     //
  // get a list of all sockets                                                                                       //
  all_sockets: function () {                                                                                         // 125
    function all_sockets() {                                                                                         // 125
      var self = this;                                                                                               // 126
      return _.values(self.open_sockets);                                                                            // 127
    }                                                                                                                //
                                                                                                                     //
    return all_sockets;                                                                                              //
  }(),                                                                                                               //
                                                                                                                     //
  // Redirect /websocket to /sockjs/websocket in order to not expose                                                 //
  // sockjs to clients that want to use raw websockets                                                               //
  _redirectWebsocketEndpoint: function () {                                                                          // 132
    function _redirectWebsocketEndpoint() {                                                                          // 132
      var self = this;                                                                                               // 133
      // Unfortunately we can't use a connect middleware here since                                                  //
      // sockjs installs itself prior to all existing listeners                                                      //
      // (meaning prior to any connect middlewares) so we need to take                                               //
      // an approach similar to overshadowListeners in                                                               //
      // https://github.com/sockjs/sockjs-node/blob/cf820c55af6a9953e16558555a31decea554f70e/src/utils.coffee        //
      _.each(['request', 'upgrade'], function (event) {                                                              // 132
        var httpServer = WebApp.httpServer;                                                                          // 140
        var oldHttpServerListeners = httpServer.listeners(event).slice(0);                                           // 141
        httpServer.removeAllListeners(event);                                                                        // 142
                                                                                                                     //
        // request and upgrade have different arguments passed but                                                   //
        // we only care about the first one which is always request                                                  //
        var newListener = function () {                                                                              // 139
          function newListener(request /*, moreArguments */) {                                                       // 146
            // Store arguments for use within the closure below                                                      //
            var args = arguments;                                                                                    // 148
                                                                                                                     //
            // Rewrite /websocket and /websocket/ urls to /sockjs/websocket while                                    //
            // preserving query string.                                                                              //
            var parsedUrl = url.parse(request.url);                                                                  // 146
            if (parsedUrl.pathname === pathPrefix + '/websocket' || parsedUrl.pathname === pathPrefix + '/websocket/') {
              parsedUrl.pathname = self.prefix + '/websocket';                                                       // 155
              request.url = url.format(parsedUrl);                                                                   // 156
            }                                                                                                        //
            _.each(oldHttpServerListeners, function (oldListener) {                                                  // 158
              oldListener.apply(httpServer, args);                                                                   // 159
            });                                                                                                      //
          }                                                                                                          //
                                                                                                                     //
          return newListener;                                                                                        //
        }();                                                                                                         //
        httpServer.addListener(event, newListener);                                                                  // 162
      });                                                                                                            //
    }                                                                                                                //
                                                                                                                     //
    return _redirectWebsocketEndpoint;                                                                               //
  }()                                                                                                                //
});                                                                                                                  //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"livedata_server.js":["babel-runtime/helpers/typeof",function(require){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/ddp-server/livedata_server.js                                                                            //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
var _typeof2 = require("babel-runtime/helpers/typeof");                                                              //
                                                                                                                     //
var _typeof3 = _interopRequireDefault(_typeof2);                                                                     //
                                                                                                                     //
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }                    //
                                                                                                                     //
DDPServer = {};                                                                                                      // 1
                                                                                                                     //
var Fiber = Npm.require('fibers');                                                                                   // 3
                                                                                                                     //
// This file contains classes:                                                                                       //
// * Session - The server's connection to a single DDP client                                                        //
// * Subscription - A single subscription for a single client                                                        //
// * Server - An entire server that may talk to > 1 client. A DDP endpoint.                                          //
//                                                                                                                   //
// Session and Subscription are file scope. For now, until we freeze                                                 //
// the interface, Server is package scope (in the future it should be                                                //
// exported.)                                                                                                        //
                                                                                                                     //
// Represents a single document in a SessionCollectionView                                                           //
var SessionDocumentView = function SessionDocumentView() {                                                           // 15
  var self = this;                                                                                                   // 16
  self.existsIn = {}; // set of subscriptionHandle                                                                   // 17
  self.dataByKey = {}; // key-> [ {subscriptionHandle, value} by precedence]                                         // 15
};                                                                                                                   // 15
                                                                                                                     //
DDPServer._SessionDocumentView = SessionDocumentView;                                                                // 21
                                                                                                                     //
_.extend(SessionDocumentView.prototype, {                                                                            // 24
                                                                                                                     //
  getFields: function () {                                                                                           // 26
    function getFields() {                                                                                           // 26
      var self = this;                                                                                               // 27
      var ret = {};                                                                                                  // 28
      _.each(self.dataByKey, function (precedenceList, key) {                                                        // 29
        ret[key] = precedenceList[0].value;                                                                          // 30
      });                                                                                                            //
      return ret;                                                                                                    // 32
    }                                                                                                                //
                                                                                                                     //
    return getFields;                                                                                                //
  }(),                                                                                                               //
                                                                                                                     //
  clearField: function () {                                                                                          // 35
    function clearField(subscriptionHandle, key, changeCollector) {                                                  // 35
      var self = this;                                                                                               // 36
      // Publish API ignores _id if present in fields                                                                //
      if (key === "_id") return;                                                                                     // 35
      var precedenceList = self.dataByKey[key];                                                                      // 40
                                                                                                                     //
      // It's okay to clear fields that didn't exist. No need to throw                                               //
      // an error.                                                                                                   //
      if (!precedenceList) return;                                                                                   // 35
                                                                                                                     //
      var removedValue = undefined;                                                                                  // 47
      for (var i = 0; i < precedenceList.length; i++) {                                                              // 48
        var precedence = precedenceList[i];                                                                          // 49
        if (precedence.subscriptionHandle === subscriptionHandle) {                                                  // 50
          // The view's value can only change if this subscription is the one that                                   //
          // used to have precedence.                                                                                //
          if (i === 0) removedValue = precedence.value;                                                              // 53
          precedenceList.splice(i, 1);                                                                               // 55
          break;                                                                                                     // 56
        }                                                                                                            //
      }                                                                                                              //
      if (_.isEmpty(precedenceList)) {                                                                               // 59
        delete self.dataByKey[key];                                                                                  // 60
        changeCollector[key] = undefined;                                                                            // 61
      } else if (removedValue !== undefined && !EJSON.equals(removedValue, precedenceList[0].value)) {               //
        changeCollector[key] = precedenceList[0].value;                                                              // 64
      }                                                                                                              //
    }                                                                                                                //
                                                                                                                     //
    return clearField;                                                                                               //
  }(),                                                                                                               //
                                                                                                                     //
  changeField: function () {                                                                                         // 68
    function changeField(subscriptionHandle, key, value, changeCollector, isAdd) {                                   // 68
      var self = this;                                                                                               // 70
      // Publish API ignores _id if present in fields                                                                //
      if (key === "_id") return;                                                                                     // 69
                                                                                                                     //
      // Don't share state with the data passed in by the user.                                                      //
      value = EJSON.clone(value);                                                                                    // 69
                                                                                                                     //
      if (!_.has(self.dataByKey, key)) {                                                                             // 78
        self.dataByKey[key] = [{ subscriptionHandle: subscriptionHandle,                                             // 79
          value: value }];                                                                                           // 80
        changeCollector[key] = value;                                                                                // 81
        return;                                                                                                      // 82
      }                                                                                                              //
      var precedenceList = self.dataByKey[key];                                                                      // 84
      var elt;                                                                                                       // 85
      if (!isAdd) {                                                                                                  // 86
        elt = _.find(precedenceList, function (precedence) {                                                         // 87
          return precedence.subscriptionHandle === subscriptionHandle;                                               // 88
        });                                                                                                          //
      }                                                                                                              //
                                                                                                                     //
      if (elt) {                                                                                                     // 92
        if (elt === precedenceList[0] && !EJSON.equals(value, elt.value)) {                                          // 93
          // this subscription is changing the value of this field.                                                  //
          changeCollector[key] = value;                                                                              // 95
        }                                                                                                            //
        elt.value = value;                                                                                           // 97
      } else {                                                                                                       //
        // this subscription is newly caring about this field                                                        //
        precedenceList.push({ subscriptionHandle: subscriptionHandle, value: value });                               // 100
      }                                                                                                              //
    }                                                                                                                //
                                                                                                                     //
    return changeField;                                                                                              //
  }()                                                                                                                //
});                                                                                                                  //
                                                                                                                     //
/**                                                                                                                  //
 * Represents a client's view of a single collection                                                                 //
 * @param {String} collectionName Name of the collection it represents                                               //
 * @param {Object.<String, Function>} sessionCallbacks The callbacks for added, changed, removed                     //
 * @class SessionCollectionView                                                                                      //
 */                                                                                                                  //
var SessionCollectionView = function SessionCollectionView(collectionName, sessionCallbacks) {                       // 112
  var self = this;                                                                                                   // 113
  self.collectionName = collectionName;                                                                              // 114
  self.documents = {};                                                                                               // 115
  self.callbacks = sessionCallbacks;                                                                                 // 116
};                                                                                                                   //
                                                                                                                     //
DDPServer._SessionCollectionView = SessionCollectionView;                                                            // 119
                                                                                                                     //
_.extend(SessionCollectionView.prototype, {                                                                          // 122
                                                                                                                     //
  isEmpty: function () {                                                                                             // 124
    function isEmpty() {                                                                                             // 124
      var self = this;                                                                                               // 125
      return _.isEmpty(self.documents);                                                                              // 126
    }                                                                                                                //
                                                                                                                     //
    return isEmpty;                                                                                                  //
  }(),                                                                                                               //
                                                                                                                     //
  diff: function () {                                                                                                // 129
    function diff(previous) {                                                                                        // 129
      var self = this;                                                                                               // 130
      DiffSequence.diffObjects(previous.documents, self.documents, {                                                 // 131
        both: _.bind(self.diffDocument, self),                                                                       // 132
                                                                                                                     //
        rightOnly: function () {                                                                                     // 134
          function rightOnly(id, nowDV) {                                                                            // 134
            self.callbacks.added(self.collectionName, id, nowDV.getFields());                                        // 135
          }                                                                                                          //
                                                                                                                     //
          return rightOnly;                                                                                          //
        }(),                                                                                                         //
                                                                                                                     //
        leftOnly: function () {                                                                                      // 138
          function leftOnly(id, prevDV) {                                                                            // 138
            self.callbacks.removed(self.collectionName, id);                                                         // 139
          }                                                                                                          //
                                                                                                                     //
          return leftOnly;                                                                                           //
        }()                                                                                                          //
      });                                                                                                            //
    }                                                                                                                //
                                                                                                                     //
    return diff;                                                                                                     //
  }(),                                                                                                               //
                                                                                                                     //
  diffDocument: function () {                                                                                        // 144
    function diffDocument(id, prevDV, nowDV) {                                                                       // 144
      var self = this;                                                                                               // 145
      var fields = {};                                                                                               // 146
      DiffSequence.diffObjects(prevDV.getFields(), nowDV.getFields(), {                                              // 147
        both: function () {                                                                                          // 148
          function both(key, prev, now) {                                                                            // 148
            if (!EJSON.equals(prev, now)) fields[key] = now;                                                         // 149
          }                                                                                                          //
                                                                                                                     //
          return both;                                                                                               //
        }(),                                                                                                         //
        rightOnly: function () {                                                                                     // 152
          function rightOnly(key, now) {                                                                             // 152
            fields[key] = now;                                                                                       // 153
          }                                                                                                          //
                                                                                                                     //
          return rightOnly;                                                                                          //
        }(),                                                                                                         //
        leftOnly: function () {                                                                                      // 155
          function leftOnly(key, prev) {                                                                             // 155
            fields[key] = undefined;                                                                                 // 156
          }                                                                                                          //
                                                                                                                     //
          return leftOnly;                                                                                           //
        }()                                                                                                          //
      });                                                                                                            //
      self.callbacks.changed(self.collectionName, id, fields);                                                       // 159
    }                                                                                                                //
                                                                                                                     //
    return diffDocument;                                                                                             //
  }(),                                                                                                               //
                                                                                                                     //
  added: function () {                                                                                               // 162
    function added(subscriptionHandle, id, fields) {                                                                 // 162
      var self = this;                                                                                               // 163
      var docView = self.documents[id];                                                                              // 164
      var added = false;                                                                                             // 165
      if (!docView) {                                                                                                // 166
        added = true;                                                                                                // 167
        docView = new SessionDocumentView();                                                                         // 168
        self.documents[id] = docView;                                                                                // 169
      }                                                                                                              //
      docView.existsIn[subscriptionHandle] = true;                                                                   // 171
      var changeCollector = {};                                                                                      // 172
      _.each(fields, function (value, key) {                                                                         // 173
        docView.changeField(subscriptionHandle, key, value, changeCollector, true);                                  // 174
      });                                                                                                            //
      if (added) self.callbacks.added(self.collectionName, id, changeCollector);else self.callbacks.changed(self.collectionName, id, changeCollector);
    }                                                                                                                //
                                                                                                                     //
    return added;                                                                                                    //
  }(),                                                                                                               //
                                                                                                                     //
  changed: function () {                                                                                             // 183
    function changed(subscriptionHandle, id, _changed) {                                                             // 183
      var self = this;                                                                                               // 184
      var changedResult = {};                                                                                        // 185
      var docView = self.documents[id];                                                                              // 186
      if (!docView) throw new Error("Could not find element with id " + id + " to change");                          // 187
      _.each(_changed, function (value, key) {                                                                       // 189
        if (value === undefined) docView.clearField(subscriptionHandle, key, changedResult);else docView.changeField(subscriptionHandle, key, value, changedResult);
      });                                                                                                            //
      self.callbacks.changed(self.collectionName, id, changedResult);                                                // 195
    }                                                                                                                //
                                                                                                                     //
    return changed;                                                                                                  //
  }(),                                                                                                               //
                                                                                                                     //
  removed: function () {                                                                                             // 198
    function removed(subscriptionHandle, id) {                                                                       // 198
      var self = this;                                                                                               // 199
      var docView = self.documents[id];                                                                              // 200
      if (!docView) {                                                                                                // 201
        var err = new Error("Removed nonexistent document " + id);                                                   // 202
        throw err;                                                                                                   // 203
      }                                                                                                              //
      delete docView.existsIn[subscriptionHandle];                                                                   // 205
      if (_.isEmpty(docView.existsIn)) {                                                                             // 206
        // it is gone from everyone                                                                                  //
        self.callbacks.removed(self.collectionName, id);                                                             // 208
        delete self.documents[id];                                                                                   // 209
      } else {                                                                                                       //
        var changed = {};                                                                                            // 211
        // remove this subscription from every precedence list                                                       //
        // and record the changes                                                                                    //
        _.each(docView.dataByKey, function (precedenceList, key) {                                                   // 210
          docView.clearField(subscriptionHandle, key, changed);                                                      // 215
        });                                                                                                          //
                                                                                                                     //
        self.callbacks.changed(self.collectionName, id, changed);                                                    // 218
      }                                                                                                              //
    }                                                                                                                //
                                                                                                                     //
    return removed;                                                                                                  //
  }()                                                                                                                //
});                                                                                                                  //
                                                                                                                     //
/******************************************************************************/                                     //
/* Session                                                                    */                                     //
/******************************************************************************/                                     //
                                                                                                                     //
var Session = function Session(server, version, socket, options) {                                                   // 227
  var self = this;                                                                                                   // 228
  self.id = Random.id();                                                                                             // 229
                                                                                                                     //
  self.server = server;                                                                                              // 231
  self.version = version;                                                                                            // 232
                                                                                                                     //
  self.initialized = false;                                                                                          // 234
  self.socket = socket;                                                                                              // 235
                                                                                                                     //
  // set to null when the session is destroyed. multiple places below                                                //
  // use this to determine if the session is alive or not.                                                           //
  self.inQueue = new Meteor._DoubleEndedQueue();                                                                     // 227
                                                                                                                     //
  self.blocked = false;                                                                                              // 241
  self.workerRunning = false;                                                                                        // 242
                                                                                                                     //
  // Sub objects for active subscriptions                                                                            //
  self._namedSubs = {};                                                                                              // 227
  self._universalSubs = [];                                                                                          // 246
                                                                                                                     //
  self.userId = null;                                                                                                // 248
                                                                                                                     //
  self.collectionViews = {};                                                                                         // 250
                                                                                                                     //
  // Set this to false to not send messages when collectionViews are                                                 //
  // modified. This is done when rerunning subs in _setUserId and those messages                                     //
  // are calculated via a diff instead.                                                                              //
  self._isSending = true;                                                                                            // 227
                                                                                                                     //
  // If this is true, don't start a newly-created universal publisher on this                                        //
  // session. The session will take care of starting it when appropriate.                                            //
  self._dontStartNewUniversalSubs = false;                                                                           // 227
                                                                                                                     //
  // when we are rerunning subscriptions, any ready messages                                                         //
  // we want to buffer up for when we are done rerunning subscriptions                                               //
  self._pendingReady = [];                                                                                           // 227
                                                                                                                     //
  // List of callbacks to call when this connection is closed.                                                       //
  self._closeCallbacks = [];                                                                                         // 227
                                                                                                                     //
  // XXX HACK: If a sockjs connection, save off the URL. This is                                                     //
  // temporary and will go away in the near future.                                                                  //
  self._socketUrl = socket.url;                                                                                      // 227
                                                                                                                     //
  // Allow tests to disable responding to pings.                                                                     //
  self._respondToPings = options.respondToPings;                                                                     // 227
                                                                                                                     //
  // This object is the public interface to the session. In the public                                               //
  // API, it is called the `connection` object.  Internally we call it                                               //
  // a `connectionHandle` to avoid ambiguity.                                                                        //
  self.connectionHandle = {                                                                                          // 227
    id: self.id,                                                                                                     // 280
    close: function () {                                                                                             // 281
      function close() {                                                                                             // 281
        self.close();                                                                                                // 282
      }                                                                                                              //
                                                                                                                     //
      return close;                                                                                                  //
    }(),                                                                                                             //
    onClose: function () {                                                                                           // 284
      function onClose(fn) {                                                                                         // 284
        var cb = Meteor.bindEnvironment(fn, "connection onClose callback");                                          // 285
        if (self.inQueue) {                                                                                          // 286
          self._closeCallbacks.push(cb);                                                                             // 287
        } else {                                                                                                     //
          // if we're already closed, call the callback.                                                             //
          Meteor.defer(cb);                                                                                          // 290
        }                                                                                                            //
      }                                                                                                              //
                                                                                                                     //
      return onClose;                                                                                                //
    }(),                                                                                                             //
    clientAddress: self._clientAddress(),                                                                            // 293
    httpHeaders: self.socket.headers                                                                                 // 294
  };                                                                                                                 //
                                                                                                                     //
  socket.send(DDPCommon.stringifyDDP({ msg: 'connected',                                                             // 297
    session: self.id }));                                                                                            // 298
  // On initial connect, spin up all the universal publishers.                                                       //
  Fiber(function () {                                                                                                // 227
    self.startUniversalSubs();                                                                                       // 301
  }).run();                                                                                                          //
                                                                                                                     //
  if (version !== 'pre1' && options.heartbeatInterval !== 0) {                                                       // 304
    self.heartbeat = new DDPCommon.Heartbeat({                                                                       // 305
      heartbeatInterval: options.heartbeatInterval,                                                                  // 306
      heartbeatTimeout: options.heartbeatTimeout,                                                                    // 307
      onTimeout: function () {                                                                                       // 308
        function onTimeout() {                                                                                       // 308
          self.close();                                                                                              // 309
        }                                                                                                            //
                                                                                                                     //
        return onTimeout;                                                                                            //
      }(),                                                                                                           //
      sendPing: function () {                                                                                        // 311
        function sendPing() {                                                                                        // 311
          self.send({ msg: 'ping' });                                                                                // 312
        }                                                                                                            //
                                                                                                                     //
        return sendPing;                                                                                             //
      }()                                                                                                            //
    });                                                                                                              //
    self.heartbeat.start();                                                                                          // 315
  }                                                                                                                  //
                                                                                                                     //
  Package.facts && Package.facts.Facts.incrementServerFact("livedata", "sessions", 1);                               // 318
};                                                                                                                   //
                                                                                                                     //
_.extend(Session.prototype, {                                                                                        // 322
                                                                                                                     //
  sendReady: function () {                                                                                           // 324
    function sendReady(subscriptionIds) {                                                                            // 324
      var self = this;                                                                                               // 325
      if (self._isSending) self.send({ msg: "ready", subs: subscriptionIds });else {                                 // 326
        _.each(subscriptionIds, function (subscriptionId) {                                                          // 329
          self._pendingReady.push(subscriptionId);                                                                   // 330
        });                                                                                                          //
      }                                                                                                              //
    }                                                                                                                //
                                                                                                                     //
    return sendReady;                                                                                                //
  }(),                                                                                                               //
                                                                                                                     //
  sendAdded: function () {                                                                                           // 335
    function sendAdded(collectionName, id, fields) {                                                                 // 335
      var self = this;                                                                                               // 336
      if (self._isSending) self.send({ msg: "added", collection: collectionName, id: id, fields: fields });          // 337
    }                                                                                                                //
                                                                                                                     //
    return sendAdded;                                                                                                //
  }(),                                                                                                               //
                                                                                                                     //
  sendChanged: function () {                                                                                         // 341
    function sendChanged(collectionName, id, fields) {                                                               // 341
      var self = this;                                                                                               // 342
      if (_.isEmpty(fields)) return;                                                                                 // 343
                                                                                                                     //
      if (self._isSending) {                                                                                         // 346
        self.send({                                                                                                  // 347
          msg: "changed",                                                                                            // 348
          collection: collectionName,                                                                                // 349
          id: id,                                                                                                    // 350
          fields: fields                                                                                             // 351
        });                                                                                                          //
      }                                                                                                              //
    }                                                                                                                //
                                                                                                                     //
    return sendChanged;                                                                                              //
  }(),                                                                                                               //
                                                                                                                     //
  sendRemoved: function () {                                                                                         // 356
    function sendRemoved(collectionName, id) {                                                                       // 356
      var self = this;                                                                                               // 357
      if (self._isSending) self.send({ msg: "removed", collection: collectionName, id: id });                        // 358
    }                                                                                                                //
                                                                                                                     //
    return sendRemoved;                                                                                              //
  }(),                                                                                                               //
                                                                                                                     //
  getSendCallbacks: function () {                                                                                    // 362
    function getSendCallbacks() {                                                                                    // 362
      var self = this;                                                                                               // 363
      return {                                                                                                       // 364
        added: _.bind(self.sendAdded, self),                                                                         // 365
        changed: _.bind(self.sendChanged, self),                                                                     // 366
        removed: _.bind(self.sendRemoved, self)                                                                      // 367
      };                                                                                                             //
    }                                                                                                                //
                                                                                                                     //
    return getSendCallbacks;                                                                                         //
  }(),                                                                                                               //
                                                                                                                     //
  getCollectionView: function () {                                                                                   // 371
    function getCollectionView(collectionName) {                                                                     // 371
      var self = this;                                                                                               // 372
      if (_.has(self.collectionViews, collectionName)) {                                                             // 373
        return self.collectionViews[collectionName];                                                                 // 374
      }                                                                                                              //
      var ret = new SessionCollectionView(collectionName, self.getSendCallbacks());                                  // 376
      self.collectionViews[collectionName] = ret;                                                                    // 378
      return ret;                                                                                                    // 379
    }                                                                                                                //
                                                                                                                     //
    return getCollectionView;                                                                                        //
  }(),                                                                                                               //
                                                                                                                     //
  added: function () {                                                                                               // 382
    function added(subscriptionHandle, collectionName, id, fields) {                                                 // 382
      var self = this;                                                                                               // 383
      var view = self.getCollectionView(collectionName);                                                             // 384
      view.added(subscriptionHandle, id, fields);                                                                    // 385
    }                                                                                                                //
                                                                                                                     //
    return added;                                                                                                    //
  }(),                                                                                                               //
                                                                                                                     //
  removed: function () {                                                                                             // 388
    function removed(subscriptionHandle, collectionName, id) {                                                       // 388
      var self = this;                                                                                               // 389
      var view = self.getCollectionView(collectionName);                                                             // 390
      view.removed(subscriptionHandle, id);                                                                          // 391
      if (view.isEmpty()) {                                                                                          // 392
        delete self.collectionViews[collectionName];                                                                 // 393
      }                                                                                                              //
    }                                                                                                                //
                                                                                                                     //
    return removed;                                                                                                  //
  }(),                                                                                                               //
                                                                                                                     //
  changed: function () {                                                                                             // 397
    function changed(subscriptionHandle, collectionName, id, fields) {                                               // 397
      var self = this;                                                                                               // 398
      var view = self.getCollectionView(collectionName);                                                             // 399
      view.changed(subscriptionHandle, id, fields);                                                                  // 400
    }                                                                                                                //
                                                                                                                     //
    return changed;                                                                                                  //
  }(),                                                                                                               //
                                                                                                                     //
  startUniversalSubs: function () {                                                                                  // 403
    function startUniversalSubs() {                                                                                  // 403
      var self = this;                                                                                               // 404
      // Make a shallow copy of the set of universal handlers and start them. If                                     //
      // additional universal publishers start while we're running them (due to                                      //
      // yielding), they will run separately as part of Server.publish.                                              //
      var handlers = _.clone(self.server.universal_publish_handlers);                                                // 403
      _.each(handlers, function (handler) {                                                                          // 409
        self._startSubscription(handler);                                                                            // 410
      });                                                                                                            //
    }                                                                                                                //
                                                                                                                     //
    return startUniversalSubs;                                                                                       //
  }(),                                                                                                               //
                                                                                                                     //
  // Destroy this session and unregister it at the server.                                                           //
  close: function () {                                                                                               // 415
    function close() {                                                                                               // 415
      var self = this;                                                                                               // 416
                                                                                                                     //
      // Destroy this session, even if it's not registered at the                                                    //
      // server. Stop all processing and tear everything down. If a socket                                           //
      // was attached, close it.                                                                                     //
                                                                                                                     //
      // Already destroyed.                                                                                          //
      if (!self.inQueue) return;                                                                                     // 415
                                                                                                                     //
      // Drop the merge box data immediately.                                                                        //
      self.inQueue = null;                                                                                           // 415
      self.collectionViews = {};                                                                                     // 428
                                                                                                                     //
      if (self.heartbeat) {                                                                                          // 430
        self.heartbeat.stop();                                                                                       // 431
        self.heartbeat = null;                                                                                       // 432
      }                                                                                                              //
                                                                                                                     //
      if (self.socket) {                                                                                             // 435
        self.socket.close();                                                                                         // 436
        self.socket._meteorSession = null;                                                                           // 437
      }                                                                                                              //
                                                                                                                     //
      Package.facts && Package.facts.Facts.incrementServerFact("livedata", "sessions", -1);                          // 440
                                                                                                                     //
      Meteor.defer(function () {                                                                                     // 443
        // stop callbacks can yield, so we defer this on close.                                                      //
        // sub._isDeactivated() detects that we set inQueue to null and                                              //
        // treats it as semi-deactivated (it will ignore incoming callbacks, etc).                                   //
        self._deactivateAllSubscriptions();                                                                          // 447
                                                                                                                     //
        // Defer calling the close callbacks, so that the caller closing                                             //
        // the session isn't waiting for all the callbacks to complete.                                              //
        _.each(self._closeCallbacks, function (callback) {                                                           // 443
          callback();                                                                                                // 452
        });                                                                                                          //
      });                                                                                                            //
                                                                                                                     //
      // Unregister the session.                                                                                     //
      self.server._removeSession(self);                                                                              // 415
    }                                                                                                                //
                                                                                                                     //
    return close;                                                                                                    //
  }(),                                                                                                               //
                                                                                                                     //
  // Send a message (doing nothing if no socket is connected right now.)                                             //
  // It should be a JSON object (it will be stringified.)                                                            //
  send: function () {                                                                                                // 462
    function send(msg) {                                                                                             // 462
      var self = this;                                                                                               // 463
      if (self.socket) {                                                                                             // 464
        if (Meteor._printSentDDP) Meteor._debug("Sent DDP", DDPCommon.stringifyDDP(msg));                            // 465
        self.socket.send(DDPCommon.stringifyDDP(msg));                                                               // 467
      }                                                                                                              //
    }                                                                                                                //
                                                                                                                     //
    return send;                                                                                                     //
  }(),                                                                                                               //
                                                                                                                     //
  // Send a connection error.                                                                                        //
  sendError: function () {                                                                                           // 472
    function sendError(reason, offendingMessage) {                                                                   // 472
      var self = this;                                                                                               // 473
      var msg = { msg: 'error', reason: reason };                                                                    // 474
      if (offendingMessage) msg.offendingMessage = offendingMessage;                                                 // 475
      self.send(msg);                                                                                                // 477
    }                                                                                                                //
                                                                                                                     //
    return sendError;                                                                                                //
  }(),                                                                                                               //
                                                                                                                     //
  // Process 'msg' as an incoming message. (But as a guard against                                                   //
  // race conditions during reconnection, ignore the message if                                                      //
  // 'socket' is not the currently connected socket.)                                                                //
  //                                                                                                                 //
  // We run the messages from the client one at a time, in the order                                                 //
  // given by the client. The message handler is passed an idempotent                                                //
  // function 'unblock' which it may call to allow other messages to                                                 //
  // begin running in parallel in another fiber (for example, a method                                               //
  // that wants to yield.) Otherwise, it is automatically unblocked                                                  //
  // when it returns.                                                                                                //
  //                                                                                                                 //
  // Actually, we don't have to 'totally order' the messages in this                                                 //
  // way, but it's the easiest thing that's correct. (unsub needs to                                                 //
  // be ordered against sub, methods need to be ordered against each                                                 //
  // other.)                                                                                                         //
  processMessage: function () {                                                                                      // 495
    function processMessage(msg_in) {                                                                                // 495
      var self = this;                                                                                               // 496
      if (!self.inQueue) // we have been destroyed.                                                                  // 497
        return;                                                                                                      // 498
                                                                                                                     //
      // Respond to ping and pong messages immediately without queuing.                                              //
      // If the negotiated DDP version is "pre1" which didn't support                                                //
      // pings, preserve the "pre1" behavior of responding with a "bad                                               //
      // request" for the unknown messages.                                                                          //
      //                                                                                                             //
      // Fibers are needed because heartbeat uses Meteor.setTimeout, which                                           //
      // needs a Fiber. We could actually use regular setTimeout and avoid                                           //
      // these new fibers, but it is easier to just make everything use                                              //
      // Meteor.setTimeout and not think too hard.                                                                   //
      //                                                                                                             //
      // Any message counts as receiving a pong, as it demonstrates that                                             //
      // the client is still alive.                                                                                  //
      if (self.heartbeat) {                                                                                          // 495
        Fiber(function () {                                                                                          // 513
          self.heartbeat.messageReceived();                                                                          // 514
        }).run();                                                                                                    //
      }                                                                                                              //
                                                                                                                     //
      if (self.version !== 'pre1' && msg_in.msg === 'ping') {                                                        // 518
        if (self._respondToPings) self.send({ msg: "pong", id: msg_in.id });                                         // 519
        return;                                                                                                      // 521
      }                                                                                                              //
      if (self.version !== 'pre1' && msg_in.msg === 'pong') {                                                        // 523
        // Since everything is a pong, nothing to do                                                                 //
        return;                                                                                                      // 525
      }                                                                                                              //
                                                                                                                     //
      self.inQueue.push(msg_in);                                                                                     // 528
      if (self.workerRunning) return;                                                                                // 529
      self.workerRunning = true;                                                                                     // 531
                                                                                                                     //
      var processNext = function () {                                                                                // 533
        function processNext() {                                                                                     // 533
          var msg = self.inQueue && self.inQueue.shift();                                                            // 534
          if (!msg) {                                                                                                // 535
            self.workerRunning = false;                                                                              // 536
            return;                                                                                                  // 537
          }                                                                                                          //
                                                                                                                     //
          Fiber(function () {                                                                                        // 540
            var blocked = true;                                                                                      // 541
                                                                                                                     //
            var unblock = function () {                                                                              // 543
              function unblock() {                                                                                   // 543
                if (!blocked) return; // idempotent                                                                  // 544
                blocked = false;                                                                                     // 543
                processNext();                                                                                       // 547
              }                                                                                                      //
                                                                                                                     //
              return unblock;                                                                                        //
            }();                                                                                                     //
                                                                                                                     //
            if (_.has(self.protocol_handlers, msg.msg)) self.protocol_handlers[msg.msg].call(self, msg, unblock);else self.sendError('Bad request', msg);
            unblock(); // in case the handler didn't already do it                                                   // 554
          }).run();                                                                                                  // 540
        }                                                                                                            //
                                                                                                                     //
        return processNext;                                                                                          //
      }();                                                                                                           //
                                                                                                                     //
      processNext();                                                                                                 // 558
    }                                                                                                                //
                                                                                                                     //
    return processMessage;                                                                                           //
  }(),                                                                                                               //
                                                                                                                     //
  protocol_handlers: {                                                                                               // 561
    sub: function () {                                                                                               // 562
      function sub(msg) {                                                                                            // 562
        var self = this;                                                                                             // 563
                                                                                                                     //
        // reject malformed messages                                                                                 //
        if (typeof msg.id !== "string" || typeof msg.name !== "string" || 'params' in msg && !(msg.params instanceof Array)) {
          self.sendError("Malformed subscription", msg);                                                             // 569
          return;                                                                                                    // 570
        }                                                                                                            //
                                                                                                                     //
        if (!self.server.publish_handlers[msg.name]) {                                                               // 573
          self.send({                                                                                                // 574
            msg: 'nosub', id: msg.id,                                                                                // 575
            error: new Meteor.Error(404, "Subscription '" + msg.name + "' not found") });                            // 576
          return;                                                                                                    // 577
        }                                                                                                            //
                                                                                                                     //
        if (_.has(self._namedSubs, msg.id))                                                                          // 580
          // subs are idempotent, or rather, they are ignored if a sub                                               //
          // with that id already exists. this is important during                                                   //
          // reconnect.                                                                                              //
          return;                                                                                                    // 584
                                                                                                                     //
        // XXX It'd be much better if we had generic hooks where any package can                                     //
        // hook into subscription handling, but in the mean while we special case                                    //
        // ddp-rate-limiter package. This is also done for weak requirements to                                      //
        // add the ddp-rate-limiter package in case we don't have Accounts. A                                        //
        // user trying to use the ddp-rate-limiter must explicitly require it.                                       //
        if (Package['ddp-rate-limiter']) {                                                                           // 562
          var DDPRateLimiter = Package['ddp-rate-limiter'].DDPRateLimiter;                                           // 592
          var rateLimiterInput = {                                                                                   // 593
            userId: self.userId,                                                                                     // 594
            clientAddress: self.connectionHandle.clientAddress,                                                      // 595
            type: "subscription",                                                                                    // 596
            name: msg.name,                                                                                          // 597
            connectionId: self.id                                                                                    // 598
          };                                                                                                         //
                                                                                                                     //
          DDPRateLimiter._increment(rateLimiterInput);                                                               // 601
          var rateLimitResult = DDPRateLimiter._check(rateLimiterInput);                                             // 602
          if (!rateLimitResult.allowed) {                                                                            // 603
            self.send({                                                                                              // 604
              msg: 'nosub', id: msg.id,                                                                              // 605
              error: new Meteor.Error('too-many-requests', DDPRateLimiter.getErrorMessage(rateLimitResult), { timeToReset: rateLimitResult.timeToReset })
            });                                                                                                      //
            return;                                                                                                  // 611
          }                                                                                                          //
        }                                                                                                            //
                                                                                                                     //
        var handler = self.server.publish_handlers[msg.name];                                                        // 615
                                                                                                                     //
        self._startSubscription(handler, msg.id, msg.params, msg.name);                                              // 617
      }                                                                                                              //
                                                                                                                     //
      return sub;                                                                                                    //
    }(),                                                                                                             //
                                                                                                                     //
    unsub: function () {                                                                                             // 621
      function unsub(msg) {                                                                                          // 621
        var self = this;                                                                                             // 622
                                                                                                                     //
        self._stopSubscription(msg.id);                                                                              // 624
      }                                                                                                              //
                                                                                                                     //
      return unsub;                                                                                                  //
    }(),                                                                                                             //
                                                                                                                     //
    method: function () {                                                                                            // 627
      function method(msg, unblock) {                                                                                // 627
        var self = this;                                                                                             // 628
                                                                                                                     //
        // reject malformed messages                                                                                 //
        // For now, we silently ignore unknown attributes,                                                           //
        // for forwards compatibility.                                                                               //
        if (typeof msg.id !== "string" || typeof msg.method !== "string" || 'params' in msg && !(msg.params instanceof Array) || 'randomSeed' in msg && typeof msg.randomSeed !== "string") {
          self.sendError("Malformed method invocation", msg);                                                        // 637
          return;                                                                                                    // 638
        }                                                                                                            //
                                                                                                                     //
        var randomSeed = msg.randomSeed || null;                                                                     // 641
                                                                                                                     //
        // set up to mark the method as satisfied once all observers                                                 //
        // (and subscriptions) have reacted to any writes that were                                                  //
        // done.                                                                                                     //
        var fence = new DDPServer._WriteFence();                                                                     // 627
        fence.onAllCommitted(function () {                                                                           // 647
          // Retire the fence so that future writes are allowed.                                                     //
          // This means that callbacks like timers are free to use                                                   //
          // the fence, and if they fire before it's armed (for                                                      //
          // example, because the method waits for them) their                                                       //
          // writes will be included in the fence.                                                                   //
          fence.retire();                                                                                            // 653
          self.send({                                                                                                // 654
            msg: 'updated', methods: [msg.id] });                                                                    // 655
        });                                                                                                          //
                                                                                                                     //
        // find the handler                                                                                          //
        var handler = self.server.method_handlers[msg.method];                                                       // 627
        if (!handler) {                                                                                              // 660
          self.send({                                                                                                // 661
            msg: 'result', id: msg.id,                                                                               // 662
            error: new Meteor.Error(404, "Method '" + msg.method + "' not found") });                                // 663
          fence.arm();                                                                                               // 664
          return;                                                                                                    // 665
        }                                                                                                            //
                                                                                                                     //
        var setUserId = function () {                                                                                // 668
          function setUserId(userId) {                                                                               // 668
            self._setUserId(userId);                                                                                 // 669
          }                                                                                                          //
                                                                                                                     //
          return setUserId;                                                                                          //
        }();                                                                                                         //
                                                                                                                     //
        var invocation = new DDPCommon.MethodInvocation({                                                            // 672
          isSimulation: false,                                                                                       // 673
          userId: self.userId,                                                                                       // 674
          setUserId: setUserId,                                                                                      // 675
          unblock: unblock,                                                                                          // 676
          connection: self.connectionHandle,                                                                         // 677
          randomSeed: randomSeed                                                                                     // 678
        });                                                                                                          //
                                                                                                                     //
        var promise = new Promise(function (resolve, reject) {                                                       // 681
          // XXX It'd be better if we could hook into method handlers better but                                     //
          // for now, we need to check if the ddp-rate-limiter exists since we                                       //
          // have a weak requirement for the ddp-rate-limiter package to be added                                    //
          // to our application.                                                                                     //
          if (Package['ddp-rate-limiter']) {                                                                         // 686
            var DDPRateLimiter = Package['ddp-rate-limiter'].DDPRateLimiter;                                         // 687
            var rateLimiterInput = {                                                                                 // 688
              userId: self.userId,                                                                                   // 689
              clientAddress: self.connectionHandle.clientAddress,                                                    // 690
              type: "method",                                                                                        // 691
              name: msg.method,                                                                                      // 692
              connectionId: self.id                                                                                  // 693
            };                                                                                                       //
            DDPRateLimiter._increment(rateLimiterInput);                                                             // 695
            var rateLimitResult = DDPRateLimiter._check(rateLimiterInput);                                           // 696
            if (!rateLimitResult.allowed) {                                                                          // 697
              reject(new Meteor.Error("too-many-requests", DDPRateLimiter.getErrorMessage(rateLimitResult), { timeToReset: rateLimitResult.timeToReset }));
              return;                                                                                                // 703
            }                                                                                                        //
          }                                                                                                          //
                                                                                                                     //
          resolve(DDPServer._CurrentWriteFence.withValue(fence, function () {                                        // 707
            return DDP._CurrentInvocation.withValue(invocation, function () {                                        //
              return maybeAuditArgumentChecks(handler, invocation, msg.params, "call to '" + msg.method + "'");      //
            });                                                                                                      //
          }));                                                                                                       //
        });                                                                                                          //
                                                                                                                     //
        function finish() {                                                                                          // 719
          fence.arm();                                                                                               // 720
          unblock();                                                                                                 // 721
        }                                                                                                            //
                                                                                                                     //
        var payload = {                                                                                              // 724
          msg: "result",                                                                                             // 725
          id: msg.id                                                                                                 // 726
        };                                                                                                           //
                                                                                                                     //
        promise.then(function (result) {                                                                             // 729
          finish();                                                                                                  // 730
          if (result !== undefined) {                                                                                // 731
            payload.result = result;                                                                                 // 732
          }                                                                                                          //
          self.send(payload);                                                                                        // 734
        }, function (exception) {                                                                                    //
          finish();                                                                                                  // 736
          payload.error = wrapInternalException(exception, "while invoking method '" + msg.method + "'");            // 737
          self.send(payload);                                                                                        // 741
        });                                                                                                          //
      }                                                                                                              //
                                                                                                                     //
      return method;                                                                                                 //
    }()                                                                                                              //
  },                                                                                                                 //
                                                                                                                     //
  _eachSub: function () {                                                                                            // 746
    function _eachSub(f) {                                                                                           // 746
      var self = this;                                                                                               // 747
      _.each(self._namedSubs, f);                                                                                    // 748
      _.each(self._universalSubs, f);                                                                                // 749
    }                                                                                                                //
                                                                                                                     //
    return _eachSub;                                                                                                 //
  }(),                                                                                                               //
                                                                                                                     //
  _diffCollectionViews: function () {                                                                                // 752
    function _diffCollectionViews(beforeCVs) {                                                                       // 752
      var self = this;                                                                                               // 753
      DiffSequence.diffObjects(beforeCVs, self.collectionViews, {                                                    // 754
        both: function () {                                                                                          // 755
          function both(collectionName, leftValue, rightValue) {                                                     // 755
            rightValue.diff(leftValue);                                                                              // 756
          }                                                                                                          //
                                                                                                                     //
          return both;                                                                                               //
        }(),                                                                                                         //
        rightOnly: function () {                                                                                     // 758
          function rightOnly(collectionName, rightValue) {                                                           // 758
            _.each(rightValue.documents, function (docView, id) {                                                    // 759
              self.sendAdded(collectionName, id, docView.getFields());                                               // 760
            });                                                                                                      //
          }                                                                                                          //
                                                                                                                     //
          return rightOnly;                                                                                          //
        }(),                                                                                                         //
        leftOnly: function () {                                                                                      // 763
          function leftOnly(collectionName, leftValue) {                                                             // 763
            _.each(leftValue.documents, function (doc, id) {                                                         // 764
              self.sendRemoved(collectionName, id);                                                                  // 765
            });                                                                                                      //
          }                                                                                                          //
                                                                                                                     //
          return leftOnly;                                                                                           //
        }()                                                                                                          //
      });                                                                                                            //
    }                                                                                                                //
                                                                                                                     //
    return _diffCollectionViews;                                                                                     //
  }(),                                                                                                               //
                                                                                                                     //
  // Sets the current user id in all appropriate contexts and reruns                                                 //
  // all subscriptions                                                                                               //
  _setUserId: function () {                                                                                          // 773
    function _setUserId(userId) {                                                                                    // 773
      var self = this;                                                                                               // 774
                                                                                                                     //
      if (userId !== null && typeof userId !== "string") throw new Error("setUserId must be called on string or null, not " + (typeof userId === "undefined" ? "undefined" : (0, _typeof3["default"])(userId)));
                                                                                                                     //
      // Prevent newly-created universal subscriptions from being added to our                                       //
      // session; they will be found below when we call startUniversalSubs.                                          //
      //                                                                                                             //
      // (We don't have to worry about named subscriptions, because we only add                                      //
      // them when we process a 'sub' message. We are currently processing a                                         //
      // 'method' message, and the method did not unblock, because it is illegal                                     //
      // to call setUserId after unblock. Thus we cannot be concurrently adding a                                    //
      // new named subscription.)                                                                                    //
      self._dontStartNewUniversalSubs = true;                                                                        // 773
                                                                                                                     //
      // Prevent current subs from updating our collectionViews and call their                                       //
      // stop callbacks. This may yield.                                                                             //
      self._eachSub(function (sub) {                                                                                 // 773
        sub._deactivate();                                                                                           // 793
      });                                                                                                            //
                                                                                                                     //
      // All subs should now be deactivated. Stop sending messages to the client,                                    //
      // save the state of the published collections, reset to an empty view, and                                    //
      // update the userId.                                                                                          //
      self._isSending = false;                                                                                       // 773
      var beforeCVs = self.collectionViews;                                                                          // 800
      self.collectionViews = {};                                                                                     // 801
      self.userId = userId;                                                                                          // 802
                                                                                                                     //
      // Save the old named subs, and reset to having no subscriptions.                                              //
      var oldNamedSubs = self._namedSubs;                                                                            // 773
      self._namedSubs = {};                                                                                          // 806
      self._universalSubs = [];                                                                                      // 807
                                                                                                                     //
      _.each(oldNamedSubs, function (sub, subscriptionId) {                                                          // 809
        self._namedSubs[subscriptionId] = sub._recreate();                                                           // 810
        // nb: if the handler throws or calls this.error(), it will in fact                                          //
        // immediately send its 'nosub'. This is OK, though.                                                         //
        self._namedSubs[subscriptionId]._runHandler();                                                               // 809
      });                                                                                                            //
                                                                                                                     //
      // Allow newly-created universal subs to be started on our connection in                                       //
      // parallel with the ones we're spinning up here, and spin up universal                                        //
      // subs.                                                                                                       //
      self._dontStartNewUniversalSubs = false;                                                                       // 773
      self.startUniversalSubs();                                                                                     // 820
                                                                                                                     //
      // Start sending messages again, beginning with the diff from the previous                                     //
      // state of the world to the current state. No yields are allowed during                                       //
      // this diff, so that other changes cannot interleave.                                                         //
      Meteor._noYieldsAllowed(function () {                                                                          // 773
        self._isSending = true;                                                                                      // 826
        self._diffCollectionViews(beforeCVs);                                                                        // 827
        if (!_.isEmpty(self._pendingReady)) {                                                                        // 828
          self.sendReady(self._pendingReady);                                                                        // 829
          self._pendingReady = [];                                                                                   // 830
        }                                                                                                            //
      });                                                                                                            //
    }                                                                                                                //
                                                                                                                     //
    return _setUserId;                                                                                               //
  }(),                                                                                                               //
                                                                                                                     //
  _startSubscription: function () {                                                                                  // 835
    function _startSubscription(handler, subId, params, name) {                                                      // 835
      var self = this;                                                                                               // 836
                                                                                                                     //
      var sub = new Subscription(self, handler, subId, params, name);                                                // 838
      if (subId) self._namedSubs[subId] = sub;else self._universalSubs.push(sub);                                    // 840
                                                                                                                     //
      sub._runHandler();                                                                                             // 845
    }                                                                                                                //
                                                                                                                     //
    return _startSubscription;                                                                                       //
  }(),                                                                                                               //
                                                                                                                     //
  // tear down specified subscription                                                                                //
  _stopSubscription: function () {                                                                                   // 849
    function _stopSubscription(subId, error) {                                                                       // 849
      var self = this;                                                                                               // 850
                                                                                                                     //
      var subName = null;                                                                                            // 852
                                                                                                                     //
      if (subId && self._namedSubs[subId]) {                                                                         // 854
        subName = self._namedSubs[subId]._name;                                                                      // 855
        self._namedSubs[subId]._removeAllDocuments();                                                                // 856
        self._namedSubs[subId]._deactivate();                                                                        // 857
        delete self._namedSubs[subId];                                                                               // 858
      }                                                                                                              //
                                                                                                                     //
      var response = { msg: 'nosub', id: subId };                                                                    // 861
                                                                                                                     //
      if (error) {                                                                                                   // 863
        response.error = wrapInternalException(error, subName ? "from sub " + subName + " id " + subId : "from sub id " + subId);
      }                                                                                                              //
                                                                                                                     //
      self.send(response);                                                                                           // 870
    }                                                                                                                //
                                                                                                                     //
    return _stopSubscription;                                                                                        //
  }(),                                                                                                               //
                                                                                                                     //
  // tear down all subscriptions. Note that this does NOT send removed or nosub                                      //
  // messages, since we assume the client is gone.                                                                   //
  _deactivateAllSubscriptions: function () {                                                                         // 875
    function _deactivateAllSubscriptions() {                                                                         // 875
      var self = this;                                                                                               // 876
                                                                                                                     //
      _.each(self._namedSubs, function (sub, id) {                                                                   // 878
        sub._deactivate();                                                                                           // 879
      });                                                                                                            //
      self._namedSubs = {};                                                                                          // 881
                                                                                                                     //
      _.each(self._universalSubs, function (sub) {                                                                   // 883
        sub._deactivate();                                                                                           // 884
      });                                                                                                            //
      self._universalSubs = [];                                                                                      // 886
    }                                                                                                                //
                                                                                                                     //
    return _deactivateAllSubscriptions;                                                                              //
  }(),                                                                                                               //
                                                                                                                     //
  // Determine the remote client's IP address, based on the                                                          //
  // HTTP_FORWARDED_COUNT environment variable representing how many                                                 //
  // proxies the server is behind.                                                                                   //
  _clientAddress: function () {                                                                                      // 892
    function _clientAddress() {                                                                                      // 892
      var self = this;                                                                                               // 893
                                                                                                                     //
      // For the reported client address for a connection to be correct,                                             //
      // the developer must set the HTTP_FORWARDED_COUNT environment                                                 //
      // variable to an integer representing the number of hops they                                                 //
      // expect in the `x-forwarded-for` header. E.g., set to "1" if the                                             //
      // server is behind one proxy.                                                                                 //
      //                                                                                                             //
      // This could be computed once at startup instead of every time.                                               //
      var httpForwardedCount = parseInt(process.env['HTTP_FORWARDED_COUNT']) || 0;                                   // 892
                                                                                                                     //
      if (httpForwardedCount === 0) return self.socket.remoteAddress;                                                // 904
                                                                                                                     //
      var forwardedFor = self.socket.headers["x-forwarded-for"];                                                     // 907
      if (!_.isString(forwardedFor)) return null;                                                                    // 908
      forwardedFor = forwardedFor.trim().split(/\s*,\s*/);                                                           // 910
                                                                                                                     //
      // Typically the first value in the `x-forwarded-for` header is                                                //
      // the original IP address of the client connecting to the first                                               //
      // proxy.  However, the end user can easily spoof the header, in                                               //
      // which case the first value(s) will be the fake IP address from                                              //
      // the user pretending to be a proxy reporting the original IP                                                 //
      // address value.  By counting HTTP_FORWARDED_COUNT back from the                                              //
      // end of the list, we ensure that we get the IP address being                                                 //
      // reported by *our* first proxy.                                                                              //
                                                                                                                     //
      if (httpForwardedCount < 0 || httpForwardedCount > forwardedFor.length) return null;                           // 892
                                                                                                                     //
      return forwardedFor[forwardedFor.length - httpForwardedCount];                                                 // 924
    }                                                                                                                //
                                                                                                                     //
    return _clientAddress;                                                                                           //
  }()                                                                                                                //
});                                                                                                                  //
                                                                                                                     //
/******************************************************************************/                                     //
/* Subscription                                                               */                                     //
/******************************************************************************/                                     //
                                                                                                                     //
// ctor for a sub handle: the input to each publish function                                                         //
                                                                                                                     //
// Instance name is this because it's usually referred to as this inside a                                           //
// publish                                                                                                           //
/**                                                                                                                  //
 * @summary The server's side of a subscription                                                                      //
 * @class Subscription                                                                                               //
 * @instanceName this                                                                                                //
 */                                                                                                                  //
var Subscription = function Subscription(session, handler, subscriptionId, params, name) {                           // 941
  var self = this;                                                                                                   // 943
  self._session = session; // type is Session                                                                        // 944
                                                                                                                     //
  /**                                                                                                                //
   * @summary Access inside the publish function. The incoming [connection](#meteor_onconnection) for this subscription.
   * @locus Server                                                                                                   //
   * @name  connection                                                                                               //
   * @memberOf Subscription                                                                                          //
   * @instance                                                                                                       //
   */                                                                                                                //
  self.connection = session.connectionHandle; // public API object                                                   // 942
                                                                                                                     //
  self._handler = handler;                                                                                           // 942
                                                                                                                     //
  // my subscription ID (generated by client, undefined for universal subs).                                         //
  self._subscriptionId = subscriptionId;                                                                             // 942
  // undefined for universal subs                                                                                    //
  self._name = name;                                                                                                 // 942
                                                                                                                     //
  self._params = params || [];                                                                                       // 962
                                                                                                                     //
  // Only named subscriptions have IDs, but we need some sort of string                                              //
  // internally to keep track of all subscriptions inside                                                            //
  // SessionDocumentViews. We use this subscriptionHandle for that.                                                  //
  if (self._subscriptionId) {                                                                                        // 942
    self._subscriptionHandle = 'N' + self._subscriptionId;                                                           // 968
  } else {                                                                                                           //
    self._subscriptionHandle = 'U' + Random.id();                                                                    // 970
  }                                                                                                                  //
                                                                                                                     //
  // has _deactivate been called?                                                                                    //
  self._deactivated = false;                                                                                         // 942
                                                                                                                     //
  // stop callbacks to g/c this sub.  called w/ zero arguments.                                                      //
  self._stopCallbacks = [];                                                                                          // 942
                                                                                                                     //
  // the set of (collection, documentid) that this subscription has                                                  //
  // an opinion about                                                                                                //
  self._documents = {};                                                                                              // 942
                                                                                                                     //
  // remember if we are ready.                                                                                       //
  self._ready = false;                                                                                               // 942
                                                                                                                     //
  // Part of the public API: the user of this sub.                                                                   //
                                                                                                                     //
  /**                                                                                                                //
   * @summary Access inside the publish function. The id of the logged-in user, or `null` if no user is logged in.   //
   * @locus Server                                                                                                   //
   * @memberOf Subscription                                                                                          //
   * @name  userId                                                                                                   //
   * @instance                                                                                                       //
   */                                                                                                                //
  self.userId = session.userId;                                                                                      // 942
                                                                                                                     //
  // For now, the id filter is going to default to                                                                   //
  // the to/from DDP methods on MongoID, to                                                                          //
  // specifically deal with mongo/minimongo ObjectIds.                                                               //
                                                                                                                     //
  // Later, you will be able to make this be "raw"                                                                   //
  // if you want to publish a collection that you know                                                               //
  // just has strings for keys and no funny business, to                                                             //
  // a ddp consumer that isn't minimongo                                                                             //
                                                                                                                     //
  self._idFilter = {                                                                                                 // 942
    idStringify: MongoID.idStringify,                                                                                // 1007
    idParse: MongoID.idParse                                                                                         // 1008
  };                                                                                                                 //
                                                                                                                     //
  Package.facts && Package.facts.Facts.incrementServerFact("livedata", "subscriptions", 1);                          // 1011
};                                                                                                                   //
                                                                                                                     //
_.extend(Subscription.prototype, {                                                                                   // 1015
  _runHandler: function () {                                                                                         // 1016
    function _runHandler() {                                                                                         // 1016
      // XXX should we unblock() here? Either before running the publish                                             //
      // function, or before running _publishCursor.                                                                 //
      //                                                                                                             //
      // Right now, each publish function blocks all future publishes and                                            //
      // methods waiting on data from Mongo (or whatever else the function                                           //
      // blocks on). This probably slows page load in common cases.                                                  //
                                                                                                                     //
      var self = this;                                                                                               // 1024
      try {                                                                                                          // 1025
        var res = maybeAuditArgumentChecks(self._handler, self, EJSON.clone(self._params),                           // 1026
        // It's OK that this would look weird for universal subscriptions,                                           //
        // because they have no arguments so there can never be an                                                   //
        // audit-argument-checks failure.                                                                            //
        "publisher '" + self._name + "'");                                                                           // 1031
      } catch (e) {                                                                                                  //
        self.error(e);                                                                                               // 1033
        return;                                                                                                      // 1034
      }                                                                                                              //
                                                                                                                     //
      // Did the handler call this.error or this.stop?                                                               //
      if (self._isDeactivated()) return;                                                                             // 1016
                                                                                                                     //
      self._publishHandlerResult(res);                                                                               // 1041
    }                                                                                                                //
                                                                                                                     //
    return _runHandler;                                                                                              //
  }(),                                                                                                               //
                                                                                                                     //
  _publishHandlerResult: function () {                                                                               // 1044
    function _publishHandlerResult(res) {                                                                            // 1044
      // SPECIAL CASE: Instead of writing their own callbacks that invoke                                            //
      // this.added/changed/ready/etc, the user can just return a collection                                         //
      // cursor or array of cursors from the publish function; we call their                                         //
      // _publishCursor method which starts observing the cursor and publishes the                                   //
      // results. Note that _publishCursor does NOT call ready().                                                    //
      //                                                                                                             //
      // XXX This uses an undocumented interface which only the Mongo cursor                                         //
      // interface publishes. Should we make this interface public and encourage                                     //
      // users to implement it themselves? Arguably, it's unnecessary; users can                                     //
      // already write their own functions like                                                                      //
      //   var publishMyReactiveThingy = function (name, handler) {                                                  //
      //     Meteor.publish(name, function () {                                                                      //
      //       var reactiveThingy = handler();                                                                       //
      //       reactiveThingy.publishMe();                                                                           //
      //     });                                                                                                     //
      //   };                                                                                                        //
                                                                                                                     //
      var self = this;                                                                                               // 1062
      var isCursor = function () {                                                                                   // 1063
        function isCursor(c) {                                                                                       // 1063
          return c && c._publishCursor;                                                                              // 1064
        }                                                                                                            //
                                                                                                                     //
        return isCursor;                                                                                             //
      }();                                                                                                           //
      if (isCursor(res)) {                                                                                           // 1066
        try {                                                                                                        // 1067
          res._publishCursor(self);                                                                                  // 1068
        } catch (e) {                                                                                                //
          self.error(e);                                                                                             // 1070
          return;                                                                                                    // 1071
        }                                                                                                            //
        // _publishCursor only returns after the initial added callbacks have run.                                   //
        // mark subscription as ready.                                                                               //
        self.ready();                                                                                                // 1066
      } else if (_.isArray(res)) {                                                                                   //
        // check all the elements are cursors                                                                        //
        if (!_.all(res, isCursor)) {                                                                                 // 1078
          self.error(new Error("Publish function returned an array of non-Cursors"));                                // 1079
          return;                                                                                                    // 1080
        }                                                                                                            //
        // find duplicate collection names                                                                           //
        // XXX we should support overlapping cursors, but that would require the                                     //
        // merge box to allow overlap within a subscription                                                          //
        var collectionNames = {};                                                                                    // 1076
        for (var i = 0; i < res.length; ++i) {                                                                       // 1086
          var collectionName = res[i]._getCollectionName();                                                          // 1087
          if (_.has(collectionNames, collectionName)) {                                                              // 1088
            self.error(new Error("Publish function returned multiple cursors for collection " + collectionName));    // 1089
            return;                                                                                                  // 1092
          }                                                                                                          //
          collectionNames[collectionName] = true;                                                                    // 1094
        };                                                                                                           //
                                                                                                                     //
        try {                                                                                                        // 1097
          _.each(res, function (cur) {                                                                               // 1098
            cur._publishCursor(self);                                                                                // 1099
          });                                                                                                        //
        } catch (e) {                                                                                                //
          self.error(e);                                                                                             // 1102
          return;                                                                                                    // 1103
        }                                                                                                            //
        self.ready();                                                                                                // 1105
      } else if (res) {                                                                                              //
        // truthy values other than cursors or arrays are probably a                                                 //
        // user mistake (possible returning a Mongo document via, say,                                               //
        // `coll.findOne()`).                                                                                        //
        self.error(new Error("Publish function can only return a Cursor or " + "an array of Cursors"));              // 1110
      }                                                                                                              //
    }                                                                                                                //
                                                                                                                     //
    return _publishHandlerResult;                                                                                    //
  }(),                                                                                                               //
                                                                                                                     //
  // This calls all stop callbacks and prevents the handler from updating any                                        //
  // SessionCollectionViews further. It's used when the user unsubscribes or                                         //
  // disconnects, as well as during setUserId re-runs. It does *NOT* send                                            //
  // removed messages for the published objects; if that is necessary, call                                          //
  // _removeAllDocuments first.                                                                                      //
  _deactivate: function () {                                                                                         // 1120
    function _deactivate() {                                                                                         // 1120
      var self = this;                                                                                               // 1121
      if (self._deactivated) return;                                                                                 // 1122
      self._deactivated = true;                                                                                      // 1124
      self._callStopCallbacks();                                                                                     // 1125
      Package.facts && Package.facts.Facts.incrementServerFact("livedata", "subscriptions", -1);                     // 1126
    }                                                                                                                //
                                                                                                                     //
    return _deactivate;                                                                                              //
  }(),                                                                                                               //
                                                                                                                     //
  _callStopCallbacks: function () {                                                                                  // 1130
    function _callStopCallbacks() {                                                                                  // 1130
      var self = this;                                                                                               // 1131
      // tell listeners, so they can clean up                                                                        //
      var callbacks = self._stopCallbacks;                                                                           // 1130
      self._stopCallbacks = [];                                                                                      // 1134
      _.each(callbacks, function (callback) {                                                                        // 1135
        callback();                                                                                                  // 1136
      });                                                                                                            //
    }                                                                                                                //
                                                                                                                     //
    return _callStopCallbacks;                                                                                       //
  }(),                                                                                                               //
                                                                                                                     //
  // Send remove messages for every document.                                                                        //
  _removeAllDocuments: function () {                                                                                 // 1141
    function _removeAllDocuments() {                                                                                 // 1141
      var self = this;                                                                                               // 1142
      Meteor._noYieldsAllowed(function () {                                                                          // 1143
        _.each(self._documents, function (collectionDocs, collectionName) {                                          // 1144
          // Iterate over _.keys instead of the dictionary itself, since we'll be                                    //
          // mutating it.                                                                                            //
          _.each(_.keys(collectionDocs), function (strId) {                                                          // 1147
            self.removed(collectionName, self._idFilter.idParse(strId));                                             // 1148
          });                                                                                                        //
        });                                                                                                          //
      });                                                                                                            //
    }                                                                                                                //
                                                                                                                     //
    return _removeAllDocuments;                                                                                      //
  }(),                                                                                                               //
                                                                                                                     //
  // Returns a new Subscription for the same session with the same                                                   //
  // initial creation parameters. This isn't a clone: it doesn't have                                                //
  // the same _documents cache, stopped state or callbacks; may have a                                               //
  // different _subscriptionHandle, and gets its userId from the                                                     //
  // session, not from this object.                                                                                  //
  _recreate: function () {                                                                                           // 1159
    function _recreate() {                                                                                           // 1159
      var self = this;                                                                                               // 1160
      return new Subscription(self._session, self._handler, self._subscriptionId, self._params, self._name);         // 1161
    }                                                                                                                //
                                                                                                                     //
    return _recreate;                                                                                                //
  }(),                                                                                                               //
                                                                                                                     //
  /**                                                                                                                //
   * @summary Call inside the publish function.  Stops this client's subscription, triggering a call on the client to the `onStop` callback passed to [`Meteor.subscribe`](#meteor_subscribe), if any. If `error` is not a [`Meteor.Error`](#meteor_error), it will be [sanitized](#meteor_error).
   * @locus Server                                                                                                   //
   * @param {Error} error The error to pass to the client.                                                           //
   * @instance                                                                                                       //
   * @memberOf Subscription                                                                                          //
   */                                                                                                                //
  error: function () {                                                                                               // 1173
    function error(_error) {                                                                                         // 1173
      var self = this;                                                                                               // 1174
      if (self._isDeactivated()) return;                                                                             // 1175
      self._session._stopSubscription(self._subscriptionId, _error);                                                 // 1177
    }                                                                                                                //
                                                                                                                     //
    return error;                                                                                                    //
  }(),                                                                                                               //
                                                                                                                     //
  // Note that while our DDP client will notice that you've called stop() on the                                     //
  // server (and clean up its _subscriptions table) we don't actually provide a                                      //
  // mechanism for an app to notice this (the subscribe onError callback only                                        //
  // triggers if there is an error).                                                                                 //
                                                                                                                     //
  /**                                                                                                                //
   * @summary Call inside the publish function.  Stops this client's subscription and invokes the client's `onStop` callback with no error.
   * @locus Server                                                                                                   //
   * @instance                                                                                                       //
   * @memberOf Subscription                                                                                          //
   */                                                                                                                //
  stop: function () {                                                                                                // 1191
    function stop() {                                                                                                // 1191
      var self = this;                                                                                               // 1192
      if (self._isDeactivated()) return;                                                                             // 1193
      self._session._stopSubscription(self._subscriptionId);                                                         // 1195
    }                                                                                                                //
                                                                                                                     //
    return stop;                                                                                                     //
  }(),                                                                                                               //
                                                                                                                     //
  /**                                                                                                                //
   * @summary Call inside the publish function.  Registers a callback function to run when the subscription is stopped.
   * @locus Server                                                                                                   //
   * @memberOf Subscription                                                                                          //
   * @instance                                                                                                       //
   * @param {Function} func The callback function                                                                    //
   */                                                                                                                //
  onStop: function () {                                                                                              // 1205
    function onStop(callback) {                                                                                      // 1205
      var self = this;                                                                                               // 1206
      if (self._isDeactivated()) callback();else self._stopCallbacks.push(callback);                                 // 1207
    }                                                                                                                //
                                                                                                                     //
    return onStop;                                                                                                   //
  }(),                                                                                                               //
                                                                                                                     //
  // This returns true if the sub has been deactivated, *OR* if the session was                                      //
  // destroyed but the deferred call to _deactivateAllSubscriptions hasn't                                           //
  // happened yet.                                                                                                   //
  _isDeactivated: function () {                                                                                      // 1216
    function _isDeactivated() {                                                                                      // 1216
      var self = this;                                                                                               // 1217
      return self._deactivated || self._session.inQueue === null;                                                    // 1218
    }                                                                                                                //
                                                                                                                     //
    return _isDeactivated;                                                                                           //
  }(),                                                                                                               //
                                                                                                                     //
  /**                                                                                                                //
   * @summary Call inside the publish function.  Informs the subscriber that a document has been added to the record set.
   * @locus Server                                                                                                   //
   * @memberOf Subscription                                                                                          //
   * @instance                                                                                                       //
   * @param {String} collection The name of the collection that contains the new document.                           //
   * @param {String} id The new document's ID.                                                                       //
   * @param {Object} fields The fields in the new document.  If `_id` is present it is ignored.                      //
   */                                                                                                                //
  added: function () {                                                                                               // 1230
    function added(collectionName, id, fields) {                                                                     // 1230
      var self = this;                                                                                               // 1231
      if (self._isDeactivated()) return;                                                                             // 1232
      id = self._idFilter.idStringify(id);                                                                           // 1234
      Meteor._ensure(self._documents, collectionName)[id] = true;                                                    // 1235
      self._session.added(self._subscriptionHandle, collectionName, id, fields);                                     // 1236
    }                                                                                                                //
                                                                                                                     //
    return added;                                                                                                    //
  }(),                                                                                                               //
                                                                                                                     //
  /**                                                                                                                //
   * @summary Call inside the publish function.  Informs the subscriber that a document in the record set has been modified.
   * @locus Server                                                                                                   //
   * @memberOf Subscription                                                                                          //
   * @instance                                                                                                       //
   * @param {String} collection The name of the collection that contains the changed document.                       //
   * @param {String} id The changed document's ID.                                                                   //
   * @param {Object} fields The fields in the document that have changed, together with their new values.  If a field is not present in `fields` it was left unchanged; if it is present in `fields` and has a value of `undefined` it was removed from the document.  If `_id` is present it is ignored.
   */                                                                                                                //
  changed: function () {                                                                                             // 1248
    function changed(collectionName, id, fields) {                                                                   // 1248
      var self = this;                                                                                               // 1249
      if (self._isDeactivated()) return;                                                                             // 1250
      id = self._idFilter.idStringify(id);                                                                           // 1252
      self._session.changed(self._subscriptionHandle, collectionName, id, fields);                                   // 1253
    }                                                                                                                //
                                                                                                                     //
    return changed;                                                                                                  //
  }(),                                                                                                               //
                                                                                                                     //
  /**                                                                                                                //
   * @summary Call inside the publish function.  Informs the subscriber that a document has been removed from the record set.
   * @locus Server                                                                                                   //
   * @memberOf Subscription                                                                                          //
   * @instance                                                                                                       //
   * @param {String} collection The name of the collection that the document has been removed from.                  //
   * @param {String} id The ID of the document that has been removed.                                                //
   */                                                                                                                //
  removed: function () {                                                                                             // 1264
    function removed(collectionName, id) {                                                                           // 1264
      var self = this;                                                                                               // 1265
      if (self._isDeactivated()) return;                                                                             // 1266
      id = self._idFilter.idStringify(id);                                                                           // 1268
      // We don't bother to delete sets of things in a collection if the                                             //
      // collection is empty.  It could break _removeAllDocuments.                                                   //
      delete self._documents[collectionName][id];                                                                    // 1264
      self._session.removed(self._subscriptionHandle, collectionName, id);                                           // 1272
    }                                                                                                                //
                                                                                                                     //
    return removed;                                                                                                  //
  }(),                                                                                                               //
                                                                                                                     //
  /**                                                                                                                //
   * @summary Call inside the publish function.  Informs the subscriber that an initial, complete snapshot of the record set has been sent.  This will trigger a call on the client to the `onReady` callback passed to  [`Meteor.subscribe`](#meteor_subscribe), if any.
   * @locus Server                                                                                                   //
   * @memberOf Subscription                                                                                          //
   * @instance                                                                                                       //
   */                                                                                                                //
  ready: function () {                                                                                               // 1281
    function ready() {                                                                                               // 1281
      var self = this;                                                                                               // 1282
      if (self._isDeactivated()) return;                                                                             // 1283
      if (!self._subscriptionId) return; // unnecessary but ignored for universal sub                                // 1285
      if (!self._ready) {                                                                                            // 1281
        self._session.sendReady([self._subscriptionId]);                                                             // 1288
        self._ready = true;                                                                                          // 1289
      }                                                                                                              //
    }                                                                                                                //
                                                                                                                     //
    return ready;                                                                                                    //
  }()                                                                                                                //
});                                                                                                                  //
                                                                                                                     //
/******************************************************************************/                                     //
/* Server                                                                     */                                     //
/******************************************************************************/                                     //
                                                                                                                     //
Server = function Server(options) {                                                                                  // 1298
  var self = this;                                                                                                   // 1299
                                                                                                                     //
  // The default heartbeat interval is 30 seconds on the server and 35                                               //
  // seconds on the client.  Since the client doesn't need to send a                                                 //
  // ping as long as it is receiving pings, this means that pings                                                    //
  // normally go from the server to the client.                                                                      //
  //                                                                                                                 //
  // Note: Troposphere depends on the ability to mutate                                                              //
  // Meteor.server.options.heartbeatTimeout! This is a hack, but it's life.                                          //
  self.options = _.defaults(options || {}, {                                                                         // 1298
    heartbeatInterval: 15000,                                                                                        // 1309
    heartbeatTimeout: 15000,                                                                                         // 1310
    // For testing, allow responding to pings to be disabled.                                                        //
    respondToPings: true                                                                                             // 1312
  });                                                                                                                //
                                                                                                                     //
  // Map of callbacks to call when a new connection comes in to the                                                  //
  // server and completes DDP version negotiation. Use an object instead                                             //
  // of an array so we can safely remove one from the list while                                                     //
  // iterating over it.                                                                                              //
  self.onConnectionHook = new Hook({                                                                                 // 1298
    debugPrintExceptions: "onConnection callback"                                                                    // 1320
  });                                                                                                                //
                                                                                                                     //
  self.publish_handlers = {};                                                                                        // 1323
  self.universal_publish_handlers = [];                                                                              // 1324
                                                                                                                     //
  self.method_handlers = {};                                                                                         // 1326
                                                                                                                     //
  self.sessions = {}; // map from id to session                                                                      // 1328
                                                                                                                     //
  self.stream_server = new StreamServer();                                                                           // 1298
                                                                                                                     //
  self.stream_server.register(function (socket) {                                                                    // 1332
    // socket implements the SockJSConnection interface                                                              //
    socket._meteorSession = null;                                                                                    // 1334
                                                                                                                     //
    var sendError = function sendError(reason, offendingMessage) {                                                   // 1336
      var msg = { msg: 'error', reason: reason };                                                                    // 1337
      if (offendingMessage) msg.offendingMessage = offendingMessage;                                                 // 1338
      socket.send(DDPCommon.stringifyDDP(msg));                                                                      // 1340
    };                                                                                                               //
                                                                                                                     //
    socket.on('data', function (raw_msg) {                                                                           // 1343
      if (Meteor._printReceivedDDP) {                                                                                // 1344
        Meteor._debug("Received DDP", raw_msg);                                                                      // 1345
      }                                                                                                              //
      try {                                                                                                          // 1347
        try {                                                                                                        // 1348
          var msg = DDPCommon.parseDDP(raw_msg);                                                                     // 1349
        } catch (err) {                                                                                              //
          sendError('Parse error');                                                                                  // 1351
          return;                                                                                                    // 1352
        }                                                                                                            //
        if (msg === null || !msg.msg) {                                                                              // 1354
          sendError('Bad request', msg);                                                                             // 1355
          return;                                                                                                    // 1356
        }                                                                                                            //
                                                                                                                     //
        if (msg.msg === 'connect') {                                                                                 // 1359
          if (socket._meteorSession) {                                                                               // 1360
            sendError("Already connected", msg);                                                                     // 1361
            return;                                                                                                  // 1362
          }                                                                                                          //
          Fiber(function () {                                                                                        // 1364
            self._handleConnect(socket, msg);                                                                        // 1365
          }).run();                                                                                                  //
          return;                                                                                                    // 1367
        }                                                                                                            //
                                                                                                                     //
        if (!socket._meteorSession) {                                                                                // 1370
          sendError('Must connect first', msg);                                                                      // 1371
          return;                                                                                                    // 1372
        }                                                                                                            //
        socket._meteorSession.processMessage(msg);                                                                   // 1374
      } catch (e) {                                                                                                  //
        // XXX print stack nicely                                                                                    //
        Meteor._debug("Internal exception while processing message", msg, e.message, e.stack);                       // 1377
      }                                                                                                              //
    });                                                                                                              //
                                                                                                                     //
    socket.on('close', function () {                                                                                 // 1382
      if (socket._meteorSession) {                                                                                   // 1383
        Fiber(function () {                                                                                          // 1384
          socket._meteorSession.close();                                                                             // 1385
        }).run();                                                                                                    //
      }                                                                                                              //
    });                                                                                                              //
  });                                                                                                                //
};                                                                                                                   //
                                                                                                                     //
_.extend(Server.prototype, {                                                                                         // 1392
                                                                                                                     //
  /**                                                                                                                //
   * @summary Register a callback to be called when a new DDP connection is made to the server.                      //
   * @locus Server                                                                                                   //
   * @param {function} callback The function to call when a new DDP connection is established.                       //
   * @memberOf Meteor                                                                                                //
   * @importFromPackage meteor                                                                                       //
   */                                                                                                                //
  onConnection: function () {                                                                                        // 1401
    function onConnection(fn) {                                                                                      // 1401
      var self = this;                                                                                               // 1402
      return self.onConnectionHook.register(fn);                                                                     // 1403
    }                                                                                                                //
                                                                                                                     //
    return onConnection;                                                                                             //
  }(),                                                                                                               //
                                                                                                                     //
  _handleConnect: function () {                                                                                      // 1406
    function _handleConnect(socket, msg) {                                                                           // 1406
      var self = this;                                                                                               // 1407
                                                                                                                     //
      // The connect message must specify a version and an array of supported                                        //
      // versions, and it must claim to support what it is proposing.                                                //
      if (!(typeof msg.version === 'string' && _.isArray(msg.support) && _.all(msg.support, _.isString) && _.contains(msg.support, msg.version))) {
        socket.send(DDPCommon.stringifyDDP({ msg: 'failed',                                                          // 1415
          version: DDPCommon.SUPPORTED_DDP_VERSIONS[0] }));                                                          // 1416
        socket.close();                                                                                              // 1417
        return;                                                                                                      // 1418
      }                                                                                                              //
                                                                                                                     //
      // In the future, handle session resumption: something like:                                                   //
      //  socket._meteorSession = self.sessions[msg.session]                                                         //
      var version = calculateVersion(msg.support, DDPCommon.SUPPORTED_DDP_VERSIONS);                                 // 1406
                                                                                                                     //
      if (msg.version !== version) {                                                                                 // 1425
        // The best version to use (according to the client's stated preferences)                                    //
        // is not the one the client is trying to use. Inform them about the best                                    //
        // version to use.                                                                                           //
        socket.send(DDPCommon.stringifyDDP({ msg: 'failed', version: version }));                                    // 1429
        socket.close();                                                                                              // 1430
        return;                                                                                                      // 1431
      }                                                                                                              //
                                                                                                                     //
      // Yay, version matches! Create a new session.                                                                 //
      // Note: Troposphere depends on the ability to mutate                                                          //
      // Meteor.server.options.heartbeatTimeout! This is a hack, but it's life.                                      //
      socket._meteorSession = new Session(self, version, socket, self.options);                                      // 1406
      self.sessions[socket._meteorSession.id] = socket._meteorSession;                                               // 1438
      self.onConnectionHook.each(function (callback) {                                                               // 1439
        if (socket._meteorSession) callback(socket._meteorSession.connectionHandle);                                 // 1440
        return true;                                                                                                 // 1442
      });                                                                                                            //
    }                                                                                                                //
                                                                                                                     //
    return _handleConnect;                                                                                           //
  }(),                                                                                                               //
  /**                                                                                                                //
   * Register a publish handler function.                                                                            //
   *                                                                                                                 //
   * @param name {String} identifier for query                                                                       //
   * @param handler {Function} publish handler                                                                       //
   * @param options {Object}                                                                                         //
   *                                                                                                                 //
   * Server will call handler function on each new subscription,                                                     //
   * either when receiving DDP sub message for a named subscription, or on                                           //
   * DDP connect for a universal subscription.                                                                       //
   *                                                                                                                 //
   * If name is null, this will be a subscription that is                                                            //
   * automatically established and permanently on for all connected                                                  //
   * client, instead of a subscription that can be turned on and off                                                 //
   * with subscribe().                                                                                               //
   *                                                                                                                 //
   * options to contain:                                                                                             //
   *  - (mostly internal) is_auto: true if generated automatically                                                   //
   *    from an autopublish hook. this is for cosmetic purposes only                                                 //
   *    (it lets us determine whether to print a warning suggesting                                                  //
   *    that you turn off autopublish.)                                                                              //
   */                                                                                                                //
                                                                                                                     //
  /**                                                                                                                //
   * @summary Publish a record set.                                                                                  //
   * @memberOf Meteor                                                                                                //
   * @importFromPackage meteor                                                                                       //
   * @locus Server                                                                                                   //
   * @param {String} name Name of the record set.  If `null`, the set has no name, and the record set is automatically sent to all connected clients.
   * @param {Function} func Function called on the server each time a client subscribes.  Inside the function, `this` is the publish handler object, described below.  If the client passed arguments to `subscribe`, the function is called with the same arguments.
   */                                                                                                                //
  publish: function () {                                                                                             // 1476
    function publish(name, handler, options) {                                                                       // 1476
      var self = this;                                                                                               // 1477
                                                                                                                     //
      options = options || {};                                                                                       // 1479
                                                                                                                     //
      if (name && name in self.publish_handlers) {                                                                   // 1481
        Meteor._debug("Ignoring duplicate publish named '" + name + "'");                                            // 1482
        return;                                                                                                      // 1483
      }                                                                                                              //
                                                                                                                     //
      if (Package.autopublish && !options.is_auto) {                                                                 // 1486
        // They have autopublish on, yet they're trying to manually                                                  //
        // picking stuff to publish. They probably should turn off                                                   //
        // autopublish. (This check isn't perfect -- if you create a                                                 //
        // publish before you turn on autopublish, it won't catch                                                    //
        // it. But this will definitely handle the simple case where                                                 //
        // you've added the autopublish package to your app, and are                                                 //
        // calling publish from your app code.)                                                                      //
        if (!self.warned_about_autopublish) {                                                                        // 1494
          self.warned_about_autopublish = true;                                                                      // 1495
          Meteor._debug("** You've set up some data subscriptions with Meteor.publish(), but\n" + "** you still have autopublish turned on. Because autopublish is still\n" + "** on, your Meteor.publish() calls won't have much effect. All data\n" + "** will still be sent to all clients.\n" + "**\n" + "** Turn off autopublish by removing the autopublish package:\n" + "**\n" + "**   $ meteor remove autopublish\n" + "**\n" + "** .. and make sure you have Meteor.publish() and Meteor.subscribe() calls\n" + "** for each collection that you want clients to see.\n");
        }                                                                                                            //
      }                                                                                                              //
                                                                                                                     //
      if (name) self.publish_handlers[name] = handler;else {                                                         // 1511
        self.universal_publish_handlers.push(handler);                                                               // 1514
        // Spin up the new publisher on any existing session too. Run each                                           //
        // session's subscription in a new Fiber, so that there's no change for                                      //
        // self.sessions to change while we're running this loop.                                                    //
        _.each(self.sessions, function (session) {                                                                   // 1513
          if (!session._dontStartNewUniversalSubs) {                                                                 // 1519
            Fiber(function () {                                                                                      // 1520
              session._startSubscription(handler);                                                                   // 1521
            }).run();                                                                                                //
          }                                                                                                          //
        });                                                                                                          //
      }                                                                                                              //
    }                                                                                                                //
                                                                                                                     //
    return publish;                                                                                                  //
  }(),                                                                                                               //
                                                                                                                     //
  _removeSession: function () {                                                                                      // 1528
    function _removeSession(session) {                                                                               // 1528
      var self = this;                                                                                               // 1529
      if (self.sessions[session.id]) {                                                                               // 1530
        delete self.sessions[session.id];                                                                            // 1531
      }                                                                                                              //
    }                                                                                                                //
                                                                                                                     //
    return _removeSession;                                                                                           //
  }(),                                                                                                               //
                                                                                                                     //
  /**                                                                                                                //
   * @summary Defines functions that can be invoked over the network by clients.                                     //
   * @locus Anywhere                                                                                                 //
   * @param {Object} methods Dictionary whose keys are method names and values are functions.                        //
   * @memberOf Meteor                                                                                                //
   * @importFromPackage meteor                                                                                       //
   */                                                                                                                //
  methods: function () {                                                                                             // 1542
    function methods(_methods) {                                                                                     // 1542
      var self = this;                                                                                               // 1543
      _.each(_methods, function (func, name) {                                                                       // 1544
        if (typeof func !== 'function') throw new Error("Method '" + name + "' must be a function");                 // 1545
        if (self.method_handlers[name]) throw new Error("A method named '" + name + "' is already defined");         // 1547
        self.method_handlers[name] = func;                                                                           // 1549
      });                                                                                                            //
    }                                                                                                                //
                                                                                                                     //
    return methods;                                                                                                  //
  }(),                                                                                                               //
                                                                                                                     //
  call: function () {                                                                                                // 1553
    function call(name /*, arguments */) {                                                                           // 1553
      // if it's a function, the last argument is the result callback,                                               //
      // not a parameter to the remote method.                                                                       //
      var args = Array.prototype.slice.call(arguments, 1);                                                           // 1556
      if (args.length && typeof args[args.length - 1] === "function") var callback = args.pop();                     // 1557
      return this.apply(name, args, callback);                                                                       // 1559
    }                                                                                                                //
                                                                                                                     //
    return call;                                                                                                     //
  }(),                                                                                                               //
                                                                                                                     //
  // @param options {Optional Object}                                                                                //
  // @param callback {Optional Function}                                                                             //
  apply: function () {                                                                                               // 1564
    function apply(name, args, options, callback) {                                                                  // 1564
      var self = this;                                                                                               // 1565
                                                                                                                     //
      // We were passed 3 arguments. They may be either (name, args, options)                                        //
      // or (name, args, callback)                                                                                   //
      if (!callback && typeof options === 'function') {                                                              // 1564
        callback = options;                                                                                          // 1570
        options = {};                                                                                                // 1571
      }                                                                                                              //
      options = options || {};                                                                                       // 1573
                                                                                                                     //
      if (callback)                                                                                                  // 1575
        // It's not really necessary to do this, since we immediately                                                //
        // run the callback in this fiber before returning, but we do it                                             //
        // anyway for regularity.                                                                                    //
        // XXX improve error message (and how we report it)                                                          //
        callback = Meteor.bindEnvironment(callback, "delivering result of invoking '" + name + "'");                 // 1580
                                                                                                                     //
      // Run the handler                                                                                             //
      var handler = self.method_handlers[name];                                                                      // 1564
      var exception;                                                                                                 // 1587
      if (!handler) {                                                                                                // 1588
        exception = new Meteor.Error(404, "Method '" + name + "' not found");                                        // 1589
      } else {                                                                                                       //
        // If this is a method call from within another method, get the                                              //
        // user state from the outer method, otherwise don't allow                                                   //
        // setUserId to be called                                                                                    //
        var userId = null;                                                                                           // 1594
        var setUserId = function () {                                                                                // 1595
          function setUserId() {                                                                                     // 1595
            throw new Error("Can't call setUserId on a server initiated method call");                               // 1596
          }                                                                                                          //
                                                                                                                     //
          return setUserId;                                                                                          //
        }();                                                                                                         //
        var connection = null;                                                                                       // 1598
        var currentInvocation = DDP._CurrentInvocation.get();                                                        // 1599
        if (currentInvocation) {                                                                                     // 1600
          userId = currentInvocation.userId;                                                                         // 1601
          setUserId = function () {                                                                                  // 1602
            function setUserId(userId) {                                                                             // 1602
              currentInvocation.setUserId(userId);                                                                   // 1603
            }                                                                                                        //
                                                                                                                     //
            return setUserId;                                                                                        //
          }();                                                                                                       //
          connection = currentInvocation.connection;                                                                 // 1605
        }                                                                                                            //
                                                                                                                     //
        var invocation = new DDPCommon.MethodInvocation({                                                            // 1608
          isSimulation: false,                                                                                       // 1609
          userId: userId,                                                                                            // 1610
          setUserId: setUserId,                                                                                      // 1611
          connection: connection,                                                                                    // 1612
          randomSeed: DDPCommon.makeRpcSeed(currentInvocation, name)                                                 // 1613
        });                                                                                                          //
        try {                                                                                                        // 1615
          var result = DDP._CurrentInvocation.withValue(invocation, function () {                                    // 1616
            return maybeAuditArgumentChecks(handler, invocation, EJSON.clone(args), "internal call to '" + name + "'");
          });                                                                                                        //
          result = EJSON.clone(result);                                                                              // 1621
        } catch (e) {                                                                                                //
          exception = e;                                                                                             // 1623
        }                                                                                                            //
      }                                                                                                              //
                                                                                                                     //
      // Return the result in whichever way the caller asked for it. Note that we                                    //
      // do NOT block on the write fence in an analogous way to how the client                                       //
      // blocks on the relevant data being visible, so you are NOT guaranteed that                                   //
      // cursor observe callbacks have fired when your callback is invoked. (We                                      //
      // can change this if there's a real use case.)                                                                //
      if (callback) {                                                                                                // 1564
        callback(exception, result);                                                                                 // 1633
        return undefined;                                                                                            // 1634
      }                                                                                                              //
      if (exception) throw exception;                                                                                // 1636
      return result;                                                                                                 // 1638
    }                                                                                                                //
                                                                                                                     //
    return apply;                                                                                                    //
  }(),                                                                                                               //
                                                                                                                     //
  _urlForSession: function () {                                                                                      // 1641
    function _urlForSession(sessionId) {                                                                             // 1641
      var self = this;                                                                                               // 1642
      var session = self.sessions[sessionId];                                                                        // 1643
      if (session) return session._socketUrl;else return null;                                                       // 1644
    }                                                                                                                //
                                                                                                                     //
    return _urlForSession;                                                                                           //
  }()                                                                                                                //
});                                                                                                                  //
                                                                                                                     //
var calculateVersion = function calculateVersion(clientSupportedVersions, serverSupportedVersions) {                 // 1651
  var correctVersion = _.find(clientSupportedVersions, function (version) {                                          // 1653
    return _.contains(serverSupportedVersions, version);                                                             // 1654
  });                                                                                                                //
  if (!correctVersion) {                                                                                             // 1656
    correctVersion = serverSupportedVersions[0];                                                                     // 1657
  }                                                                                                                  //
  return correctVersion;                                                                                             // 1659
};                                                                                                                   //
                                                                                                                     //
DDPServer._calculateVersion = calculateVersion;                                                                      // 1662
                                                                                                                     //
// "blind" exceptions other than those that were deliberately thrown to signal                                       //
// errors to the client                                                                                              //
var wrapInternalException = function wrapInternalException(exception, context) {                                     // 1667
  if (!exception || exception instanceof Meteor.Error) return exception;                                             // 1668
                                                                                                                     //
  // tests can set the 'expected' flag on an exception so it won't go to the                                         //
  // server log                                                                                                      //
  if (!exception.expected) {                                                                                         // 1667
    Meteor._debug("Exception " + context, exception.stack);                                                          // 1674
    if (exception.sanitizedError) {                                                                                  // 1675
      Meteor._debug("Sanitized and reported to the client as:", exception.sanitizedError.message);                   // 1676
      Meteor._debug();                                                                                               // 1677
    }                                                                                                                //
  }                                                                                                                  //
                                                                                                                     //
  // Did the error contain more details that could have been useful if caught in                                     //
  // server code (or if thrown from non-client-originated code), but also                                            //
  // provided a "sanitized" version with more context than 500 Internal server                                       //
  // error? Use that.                                                                                                //
  if (exception.sanitizedError) {                                                                                    // 1667
    if (exception.sanitizedError instanceof Meteor.Error) return exception.sanitizedError;                           // 1686
    Meteor._debug("Exception " + context + " provides a sanitizedError that " + "is not a Meteor.Error; ignoring");  // 1688
  }                                                                                                                  //
                                                                                                                     //
  return new Meteor.Error(500, "Internal server error");                                                             // 1692
};                                                                                                                   //
                                                                                                                     //
// Audit argument checks, if the audit-argument-checks package exists (it is a                                       //
// weak dependency of this package).                                                                                 //
var maybeAuditArgumentChecks = function maybeAuditArgumentChecks(f, context, args, description) {                    // 1698
  args = args || [];                                                                                                 // 1699
  if (Package['audit-argument-checks']) {                                                                            // 1700
    return Match._failIfArgumentsAreNotAllChecked(f, context, args, description);                                    // 1701
  }                                                                                                                  //
  return f.apply(context, args);                                                                                     // 1704
};                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}],"writefence.js":function(require){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/ddp-server/writefence.js                                                                                 //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
var path = Npm.require('path');                                                                                      // 1
var Future = Npm.require(path.join('fibers', 'future'));                                                             // 2
                                                                                                                     //
// A write fence collects a group of writes, and provides a callback                                                 //
// when all of the writes are fully committed and propagated (all                                                    //
// observers have been notified of the write and acknowledged it.)                                                   //
//                                                                                                                   //
DDPServer._WriteFence = function () {                                                                                // 8
  var self = this;                                                                                                   // 9
                                                                                                                     //
  self.armed = false;                                                                                                // 11
  self.fired = false;                                                                                                // 12
  self.retired = false;                                                                                              // 13
  self.outstanding_writes = 0;                                                                                       // 14
  self.before_fire_callbacks = [];                                                                                   // 15
  self.completion_callbacks = [];                                                                                    // 16
};                                                                                                                   //
                                                                                                                     //
// The current write fence. When there is a current write fence, code                                                //
// that writes to databases should register their writes with it using                                               //
// beginWrite().                                                                                                     //
//                                                                                                                   //
DDPServer._CurrentWriteFence = new Meteor.EnvironmentVariable();                                                     // 23
                                                                                                                     //
_.extend(DDPServer._WriteFence.prototype, {                                                                          // 25
  // Start tracking a write, and return an object to represent it. The                                               //
  // object has a single method, committed(). This method should be                                                  //
  // called when the write is fully committed and propagated. You can                                                //
  // continue to add writes to the WriteFence up until it is triggered                                               //
  // (calls its callbacks because all writes have committed.)                                                        //
  beginWrite: function () {                                                                                          // 31
    function beginWrite() {                                                                                          // 31
      var self = this;                                                                                               // 32
                                                                                                                     //
      if (self.retired) return { committed: function () {                                                            // 34
          function committed() {}                                                                                    // 35
                                                                                                                     //
          return committed;                                                                                          //
        }() };                                                                                                       //
                                                                                                                     //
      if (self.fired) throw new Error("fence has already activated -- too late to add writes");                      // 37
                                                                                                                     //
      self.outstanding_writes++;                                                                                     // 40
      var _committed = false;                                                                                        // 41
      return {                                                                                                       // 42
        committed: function () {                                                                                     // 43
          function committed() {                                                                                     // 43
            if (_committed) throw new Error("committed called twice on the same write");                             // 44
            _committed = true;                                                                                       // 46
            self.outstanding_writes--;                                                                               // 47
            self._maybeFire();                                                                                       // 48
          }                                                                                                          //
                                                                                                                     //
          return committed;                                                                                          //
        }()                                                                                                          //
      };                                                                                                             //
    }                                                                                                                //
                                                                                                                     //
    return beginWrite;                                                                                               //
  }(),                                                                                                               //
                                                                                                                     //
  // Arm the fence. Once the fence is armed, and there are no more                                                   //
  // uncommitted writes, it will activate.                                                                           //
  arm: function () {                                                                                                 // 55
    function arm() {                                                                                                 // 55
      var self = this;                                                                                               // 56
      if (self === DDPServer._CurrentWriteFence.get()) throw Error("Can't arm the current fence");                   // 57
      self.armed = true;                                                                                             // 59
      self._maybeFire();                                                                                             // 60
    }                                                                                                                //
                                                                                                                     //
    return arm;                                                                                                      //
  }(),                                                                                                               //
                                                                                                                     //
  // Register a function to be called once before firing the fence.                                                  //
  // Callback function can add new writes to the fence, in which case                                                //
  // it won't fire until those writes are done as well.                                                              //
  onBeforeFire: function () {                                                                                        // 66
    function onBeforeFire(func) {                                                                                    // 66
      var self = this;                                                                                               // 67
      if (self.fired) throw new Error("fence has already activated -- too late to " + "add a callback");             // 68
      self.before_fire_callbacks.push(func);                                                                         // 71
    }                                                                                                                //
                                                                                                                     //
    return onBeforeFire;                                                                                             //
  }(),                                                                                                               //
                                                                                                                     //
  // Register a function to be called when the fence fires.                                                          //
  onAllCommitted: function () {                                                                                      // 75
    function onAllCommitted(func) {                                                                                  // 75
      var self = this;                                                                                               // 76
      if (self.fired) throw new Error("fence has already activated -- too late to " + "add a callback");             // 77
      self.completion_callbacks.push(func);                                                                          // 80
    }                                                                                                                //
                                                                                                                     //
    return onAllCommitted;                                                                                           //
  }(),                                                                                                               //
                                                                                                                     //
  // Convenience function. Arms the fence, then blocks until it fires.                                               //
  armAndWait: function () {                                                                                          // 84
    function armAndWait() {                                                                                          // 84
      var self = this;                                                                                               // 85
      var future = new Future();                                                                                     // 86
      self.onAllCommitted(function () {                                                                              // 87
        future['return']();                                                                                          // 88
      });                                                                                                            //
      self.arm();                                                                                                    // 90
      future.wait();                                                                                                 // 91
    }                                                                                                                //
                                                                                                                     //
    return armAndWait;                                                                                               //
  }(),                                                                                                               //
                                                                                                                     //
  _maybeFire: function () {                                                                                          // 94
    function _maybeFire() {                                                                                          // 94
      var self = this;                                                                                               // 95
      if (self.fired) throw new Error("write fence already activated?");                                             // 96
      if (self.armed && !self.outstanding_writes) {                                                                  // 98
        var invokeCallback = function () {                                                                           //
          function invokeCallback(func) {                                                                            // 99
            try {                                                                                                    // 100
              func(self);                                                                                            // 101
            } catch (err) {                                                                                          //
              Meteor._debug("exception in write fence callback:", err);                                              // 103
            }                                                                                                        //
          }                                                                                                          //
                                                                                                                     //
          return invokeCallback;                                                                                     //
        }();                                                                                                         //
                                                                                                                     //
        self.outstanding_writes++;                                                                                   // 107
        while (self.before_fire_callbacks.length > 0) {                                                              // 108
          var callbacks = self.before_fire_callbacks;                                                                // 109
          self.before_fire_callbacks = [];                                                                           // 110
          _.each(callbacks, invokeCallback);                                                                         // 111
        }                                                                                                            //
        self.outstanding_writes--;                                                                                   // 113
                                                                                                                     //
        if (!self.outstanding_writes) {                                                                              // 115
          self.fired = true;                                                                                         // 116
          var callbacks = self.completion_callbacks;                                                                 // 117
          self.completion_callbacks = [];                                                                            // 118
          _.each(callbacks, invokeCallback);                                                                         // 119
        }                                                                                                            //
      }                                                                                                              //
    }                                                                                                                //
                                                                                                                     //
    return _maybeFire;                                                                                               //
  }(),                                                                                                               //
                                                                                                                     //
  // Deactivate this fence so that adding more writes has no effect.                                                 //
  // The fence must have already fired.                                                                              //
  retire: function () {                                                                                              // 126
    function retire() {                                                                                              // 126
      var self = this;                                                                                               // 127
      if (!self.fired) throw new Error("Can't retire a fence that hasn't fired.");                                   // 128
      self.retired = true;                                                                                           // 130
    }                                                                                                                //
                                                                                                                     //
    return retire;                                                                                                   //
  }()                                                                                                                //
});                                                                                                                  //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"crossbar.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/ddp-server/crossbar.js                                                                                   //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
// A "crossbar" is a class that provides structured notification registration.                                       //
// See _match for the definition of how a notification matches a trigger.                                            //
// All notifications and triggers must have a string key named 'collection'.                                         //
                                                                                                                     //
DDPServer._Crossbar = function (options) {                                                                           // 5
  var self = this;                                                                                                   // 6
  options = options || {};                                                                                           // 7
                                                                                                                     //
  self.nextId = 1;                                                                                                   // 9
  // map from collection name (string) -> listener id -> object. each object has                                     //
  // keys 'trigger', 'callback'.  As a hack, the empty string means "no                                              //
  // collection".                                                                                                    //
  self.listenersByCollection = {};                                                                                   // 5
  self.factPackage = options.factPackage || "livedata";                                                              // 14
  self.factName = options.factName || null;                                                                          // 15
};                                                                                                                   //
                                                                                                                     //
_.extend(DDPServer._Crossbar.prototype, {                                                                            // 18
  // msg is a trigger or a notification                                                                              //
  _collectionForMessage: function () {                                                                               // 20
    function _collectionForMessage(msg) {                                                                            // 20
      var self = this;                                                                                               // 21
      if (!_.has(msg, 'collection')) {                                                                               // 22
        return '';                                                                                                   // 23
      } else if (typeof msg.collection === 'string') {                                                               //
        if (msg.collection === '') throw Error("Message has empty collection!");                                     // 25
        return msg.collection;                                                                                       // 27
      } else {                                                                                                       //
        throw Error("Message has non-string collection!");                                                           // 29
      }                                                                                                              //
    }                                                                                                                //
                                                                                                                     //
    return _collectionForMessage;                                                                                    //
  }(),                                                                                                               //
                                                                                                                     //
  // Listen for notification that match 'trigger'. A notification                                                    //
  // matches if it has the key-value pairs in trigger as a                                                           //
  // subset. When a notification matches, call 'callback', passing                                                   //
  // the actual notification.                                                                                        //
  //                                                                                                                 //
  // Returns a listen handle, which is an object with a method                                                       //
  // stop(). Call stop() to stop listening.                                                                          //
  //                                                                                                                 //
  // XXX It should be legal to call fire() from inside a listen()                                                    //
  // callback?                                                                                                       //
  listen: function () {                                                                                              // 43
    function listen(trigger, callback) {                                                                             // 43
      var self = this;                                                                                               // 44
      var id = self.nextId++;                                                                                        // 45
                                                                                                                     //
      var collection = self._collectionForMessage(trigger);                                                          // 47
      var record = { trigger: EJSON.clone(trigger), callback: callback };                                            // 48
      if (!_.has(self.listenersByCollection, collection)) {                                                          // 49
        self.listenersByCollection[collection] = {};                                                                 // 50
      }                                                                                                              //
      self.listenersByCollection[collection][id] = record;                                                           // 52
                                                                                                                     //
      if (self.factName && Package.facts) {                                                                          // 54
        Package.facts.Facts.incrementServerFact(self.factPackage, self.factName, 1);                                 // 55
      }                                                                                                              //
                                                                                                                     //
      return {                                                                                                       // 59
        stop: function () {                                                                                          // 60
          function stop() {                                                                                          // 60
            if (self.factName && Package.facts) {                                                                    // 61
              Package.facts.Facts.incrementServerFact(self.factPackage, self.factName, -1);                          // 62
            }                                                                                                        //
            delete self.listenersByCollection[collection][id];                                                       // 65
            if (_.isEmpty(self.listenersByCollection[collection])) {                                                 // 66
              delete self.listenersByCollection[collection];                                                         // 67
            }                                                                                                        //
          }                                                                                                          //
                                                                                                                     //
          return stop;                                                                                               //
        }()                                                                                                          //
      };                                                                                                             //
    }                                                                                                                //
                                                                                                                     //
    return listen;                                                                                                   //
  }(),                                                                                                               //
                                                                                                                     //
  // Fire the provided 'notification' (an object whose attribute                                                     //
  // values are all JSON-compatibile) -- inform all matching listeners                                               //
  // (registered with listen()).                                                                                     //
  //                                                                                                                 //
  // If fire() is called inside a write fence, then each of the                                                      //
  // listener callbacks will be called inside the write fence as well.                                               //
  //                                                                                                                 //
  // The listeners may be invoked in parallel, rather than serially.                                                 //
  fire: function () {                                                                                                // 81
    function fire(notification) {                                                                                    // 81
      var self = this;                                                                                               // 82
                                                                                                                     //
      var collection = self._collectionForMessage(notification);                                                     // 84
                                                                                                                     //
      if (!_.has(self.listenersByCollection, collection)) {                                                          // 86
        return;                                                                                                      // 87
      }                                                                                                              //
                                                                                                                     //
      var listenersForCollection = self.listenersByCollection[collection];                                           // 90
      var callbackIds = [];                                                                                          // 91
      _.each(listenersForCollection, function (l, id) {                                                              // 92
        if (self._matches(notification, l.trigger)) {                                                                // 93
          callbackIds.push(id);                                                                                      // 94
        }                                                                                                            //
      });                                                                                                            //
                                                                                                                     //
      // Listener callbacks can yield, so we need to first find all the ones that                                    //
      // match in a single iteration over self.listenersByCollection (which can't                                    //
      // be mutated during this iteration), and then invoke the matching                                             //
      // callbacks, checking before each call to ensure they haven't stopped.                                        //
      // Note that we don't have to check that                                                                       //
      // self.listenersByCollection[collection] still === listenersForCollection,                                    //
      // because the only way that stops being true is if listenersForCollection                                     //
      // first gets reduced down to the empty object (and then never gets                                            //
      // increased again).                                                                                           //
      _.each(callbackIds, function (id) {                                                                            // 81
        if (_.has(listenersForCollection, id)) {                                                                     // 108
          listenersForCollection[id].callback(notification);                                                         // 109
        }                                                                                                            //
      });                                                                                                            //
    }                                                                                                                //
                                                                                                                     //
    return fire;                                                                                                     //
  }(),                                                                                                               //
                                                                                                                     //
  // A notification matches a trigger if all keys that exist in both are equal.                                      //
  //                                                                                                                 //
  // Examples:                                                                                                       //
  //  N:{collection: "C"} matches T:{collection: "C"}                                                                //
  //    (a non-targeted write to a collection matches a                                                              //
  //     non-targeted query)                                                                                         //
  //  N:{collection: "C", id: "X"} matches T:{collection: "C"}                                                       //
  //    (a targeted write to a collection matches a non-targeted query)                                              //
  //  N:{collection: "C"} matches T:{collection: "C", id: "X"}                                                       //
  //    (a non-targeted write to a collection matches a                                                              //
  //     targeted query)                                                                                             //
  //  N:{collection: "C", id: "X"} matches T:{collection: "C", id: "X"}                                              //
  //    (a targeted write to a collection matches a targeted query targeted                                          //
  //     at the same document)                                                                                       //
  //  N:{collection: "C", id: "X"} does not match T:{collection: "C", id: "Y"}                                       //
  //    (a targeted write to a collection does not match a targeted query                                            //
  //     targeted at a different document)                                                                           //
  _matches: function () {                                                                                            // 131
    function _matches(notification, trigger) {                                                                       // 131
      // Most notifications that use the crossbar have a string `collection` and                                     //
      // maybe an `id` that is a string or ObjectID. We're already dividing up                                       //
      // triggers by collection, but let's fast-track "nope, different ID" (and                                      //
      // avoid the overly generic EJSON.equals). This makes a noticeable                                             //
      // performance difference; see https://github.com/meteor/meteor/pull/3697                                      //
      if (typeof notification.id === 'string' && typeof trigger.id === 'string' && notification.id !== trigger.id) {
        return false;                                                                                                // 140
      }                                                                                                              //
      if (notification.id instanceof MongoID.ObjectID && trigger.id instanceof MongoID.ObjectID && !notification.id.equals(trigger.id)) {
        return false;                                                                                                // 145
      }                                                                                                              //
                                                                                                                     //
      return _.all(trigger, function (triggerValue, key) {                                                           // 148
        return !_.has(notification, key) || EJSON.equals(triggerValue, notification[key]);                           // 149
      });                                                                                                            //
    }                                                                                                                //
                                                                                                                     //
    return _matches;                                                                                                 //
  }()                                                                                                                //
});                                                                                                                  //
                                                                                                                     //
// The "invalidation crossbar" is a specific instance used by the DDP server to                                      //
// implement write fence notifications. Listener callbacks on this crossbar                                          //
// should call beginWrite on the current write fence before they return, if they                                     //
// want to delay the write fence from firing (ie, the DDP method-data-updated                                        //
// message from being sent).                                                                                         //
DDPServer._InvalidationCrossbar = new DDPServer._Crossbar({                                                          // 160
  factName: "invalidation-crossbar-listeners"                                                                        // 161
});                                                                                                                  //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"server_convenience.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/ddp-server/server_convenience.js                                                                         //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
if (process.env.DDP_DEFAULT_CONNECTION_URL) {                                                                        // 1
  __meteor_runtime_config__.DDP_DEFAULT_CONNECTION_URL = process.env.DDP_DEFAULT_CONNECTION_URL;                     // 2
}                                                                                                                    //
                                                                                                                     //
Meteor.server = new Server();                                                                                        // 6
                                                                                                                     //
Meteor.refresh = function (notification) {                                                                           // 8
  DDPServer._InvalidationCrossbar.fire(notification);                                                                // 9
};                                                                                                                   //
                                                                                                                     //
// Proxy the public methods of Meteor.server so they can                                                             //
// be called directly on Meteor.                                                                                     //
_.each(['publish', 'methods', 'call', 'apply', 'onConnection'], function (name) {                                    // 14
  Meteor[name] = _.bind(Meteor.server[name], Meteor.server);                                                         // 16
});                                                                                                                  //
                                                                                                                     //
// Meteor.server used to be called Meteor.default_server. Provide                                                    //
// backcompat as a courtesy even though it was never documented.                                                     //
// XXX COMPAT WITH 0.6.4                                                                                             //
Meteor.default_server = Meteor.server;                                                                               // 22
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{"extensions":[".js",".json"]});
require("./node_modules/meteor/ddp-server/stream_server.js");
require("./node_modules/meteor/ddp-server/livedata_server.js");
require("./node_modules/meteor/ddp-server/writefence.js");
require("./node_modules/meteor/ddp-server/crossbar.js");
require("./node_modules/meteor/ddp-server/server_convenience.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
(function (pkg, symbols) {
  for (var s in symbols)
    (s in pkg) || (pkg[s] = symbols[s]);
})(Package['ddp-server'] = {}, {
  DDPServer: DDPServer
});

})();

//# sourceMappingURL=ddp-server.js.map
