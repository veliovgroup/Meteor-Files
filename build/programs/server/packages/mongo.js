(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var NpmModuleMongodb = Package['npm-mongo'].NpmModuleMongodb;
var NpmModuleMongodbVersion = Package['npm-mongo'].NpmModuleMongodbVersion;
var AllowDeny = Package['allow-deny'].AllowDeny;
var Random = Package.random.Random;
var EJSON = Package.ejson.EJSON;
var _ = Package.underscore._;
var LocalCollection = Package.minimongo.LocalCollection;
var Minimongo = Package.minimongo.Minimongo;
var DDP = Package['ddp-client'].DDP;
var DDPServer = Package['ddp-server'].DDPServer;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var DiffSequence = Package['diff-sequence'].DiffSequence;
var MongoID = Package['mongo-id'].MongoID;
var check = Package.check.check;
var Match = Package.check.Match;
var ECMAScript = Package.ecmascript.ECMAScript;
var MaxHeap = Package['binary-heap'].MaxHeap;
var MinHeap = Package['binary-heap'].MinHeap;
var MinMaxHeap = Package['binary-heap'].MinMaxHeap;
var Hook = Package['callback-hook'].Hook;
var meteorInstall = Package.modules.meteorInstall;
var Buffer = Package.modules.Buffer;
var process = Package.modules.process;
var Symbol = Package['ecmascript-runtime'].Symbol;
var Map = Package['ecmascript-runtime'].Map;
var Set = Package['ecmascript-runtime'].Set;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var MongoInternals, MongoTest, MongoConnection, CursorDescription, Cursor, listenAll, forEachTrigger, OPLOG_COLLECTION, idForOp, OplogHandle, ObserveMultiplexer, ObserveHandle, DocFetcher, PollingObserveDriver, OplogObserveDriver, LocalCollectionDriver, Mongo;

var require = meteorInstall({"node_modules":{"meteor":{"mongo":{"mongo_driver.js":["babel-runtime/helpers/typeof",function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/mongo/mongo_driver.js                                                                                     //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
var _typeof2 = require('babel-runtime/helpers/typeof');                                                               //
                                                                                                                      //
var _typeof3 = _interopRequireDefault(_typeof2);                                                                      //
                                                                                                                      //
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }                     //
                                                                                                                      //
/**                                                                                                                   //
 * Provide a synchronous Collection API using fibers, backed by                                                       //
 * MongoDB.  This is only for use on the server, and mostly identical                                                 //
 * to the client API.                                                                                                 //
 *                                                                                                                    //
 * NOTE: the public API methods must be run within a fiber. If you call                                               //
 * these outside of a fiber they will explode!                                                                        //
 */                                                                                                                   //
                                                                                                                      //
var path = Npm.require('path');                                                                                       // 10
var MongoDB = NpmModuleMongodb;                                                                                       // 11
var Fiber = Npm.require('fibers');                                                                                    // 12
var Future = Npm.require(path.join('fibers', 'future'));                                                              // 13
                                                                                                                      //
MongoInternals = {};                                                                                                  // 15
MongoTest = {};                                                                                                       // 16
                                                                                                                      //
MongoInternals.NpmModules = {                                                                                         // 18
  mongodb: {                                                                                                          // 19
    version: NpmModuleMongodbVersion,                                                                                 // 20
    module: MongoDB                                                                                                   // 21
  }                                                                                                                   //
};                                                                                                                    //
                                                                                                                      //
// Older version of what is now available via                                                                         //
// MongoInternals.NpmModules.mongodb.module.  It was never documented, but                                            //
// people do use it.                                                                                                  //
// XXX COMPAT WITH 1.0.3.2                                                                                            //
MongoInternals.NpmModule = MongoDB;                                                                                   // 29
                                                                                                                      //
// This is used to add or remove EJSON from the beginning of everything nested                                        //
// inside an EJSON custom type. It should only be called on pure JSON!                                                //
var replaceNames = function replaceNames(filter, thing) {                                                             // 33
  if ((typeof thing === 'undefined' ? 'undefined' : (0, _typeof3['default'])(thing)) === "object") {                  // 34
    if (_.isArray(thing)) {                                                                                           // 35
      return _.map(thing, _.bind(replaceNames, null, filter));                                                        // 36
    }                                                                                                                 //
    var ret = {};                                                                                                     // 38
    _.each(thing, function (value, key) {                                                                             // 39
      ret[filter(key)] = replaceNames(filter, value);                                                                 // 40
    });                                                                                                               //
    return ret;                                                                                                       // 42
  }                                                                                                                   //
  return thing;                                                                                                       // 44
};                                                                                                                    //
                                                                                                                      //
// Ensure that EJSON.clone keeps a Timestamp as a Timestamp (instead of just                                          //
// doing a structural clone).                                                                                         //
// XXX how ok is this? what if there are multiple copies of MongoDB loaded?                                           //
MongoDB.Timestamp.prototype.clone = function () {                                                                     // 50
  // Timestamps should be immutable.                                                                                  //
  return this;                                                                                                        // 52
};                                                                                                                    //
                                                                                                                      //
var makeMongoLegal = function makeMongoLegal(name) {                                                                  // 55
  return "EJSON" + name;                                                                                              // 55
};                                                                                                                    //
var unmakeMongoLegal = function unmakeMongoLegal(name) {                                                              // 56
  return name.substr(5);                                                                                              // 56
};                                                                                                                    //
                                                                                                                      //
var replaceMongoAtomWithMeteor = function replaceMongoAtomWithMeteor(document) {                                      // 58
  if (document instanceof MongoDB.Binary) {                                                                           // 59
    var buffer = document.value(true);                                                                                // 60
    return new Uint8Array(buffer);                                                                                    // 61
  }                                                                                                                   //
  if (document instanceof MongoDB.ObjectID) {                                                                         // 63
    return new Mongo.ObjectID(document.toHexString());                                                                // 64
  }                                                                                                                   //
  if (document["EJSON$type"] && document["EJSON$value"] && _.size(document) === 2) {                                  // 66
    return EJSON.fromJSONValue(replaceNames(unmakeMongoLegal, document));                                             // 68
  }                                                                                                                   //
  if (document instanceof MongoDB.Timestamp) {                                                                        // 70
    // For now, the Meteor representation of a Mongo timestamp type (not a date!                                      //
    // this is a weird internal thing used in the oplog!) is the same as the                                          //
    // Mongo representation. We need to do this explicitly or else we would do a                                      //
    // structural clone and lose the prototype.                                                                       //
    return document;                                                                                                  // 75
  }                                                                                                                   //
  return undefined;                                                                                                   // 77
};                                                                                                                    //
                                                                                                                      //
var replaceMeteorAtomWithMongo = function replaceMeteorAtomWithMongo(document) {                                      // 80
  if (EJSON.isBinary(document)) {                                                                                     // 81
    // This does more copies than we'd like, but is necessary because                                                 //
    // MongoDB.BSON only looks like it takes a Uint8Array (and doesn't actually                                       //
    // serialize it correctly).                                                                                       //
    return new MongoDB.Binary(new Buffer(document));                                                                  // 85
  }                                                                                                                   //
  if (document instanceof Mongo.ObjectID) {                                                                           // 87
    return new MongoDB.ObjectID(document.toHexString());                                                              // 88
  }                                                                                                                   //
  if (document instanceof MongoDB.Timestamp) {                                                                        // 90
    // For now, the Meteor representation of a Mongo timestamp type (not a date!                                      //
    // this is a weird internal thing used in the oplog!) is the same as the                                          //
    // Mongo representation. We need to do this explicitly or else we would do a                                      //
    // structural clone and lose the prototype.                                                                       //
    return document;                                                                                                  // 95
  }                                                                                                                   //
  if (EJSON._isCustomType(document)) {                                                                                // 97
    return replaceNames(makeMongoLegal, EJSON.toJSONValue(document));                                                 // 98
  }                                                                                                                   //
  // It is not ordinarily possible to stick dollar-sign keys into mongo                                               //
  // so we don't bother checking for things that need escaping at this time.                                          //
  return undefined;                                                                                                   // 80
};                                                                                                                    //
                                                                                                                      //
var replaceTypes = function replaceTypes(document, atomTransformer) {                                                 // 105
  if ((typeof document === 'undefined' ? 'undefined' : (0, _typeof3['default'])(document)) !== 'object' || document === null) return document;
                                                                                                                      //
  var replacedTopLevelAtom = atomTransformer(document);                                                               // 109
  if (replacedTopLevelAtom !== undefined) return replacedTopLevelAtom;                                                // 110
                                                                                                                      //
  var ret = document;                                                                                                 // 113
  _.each(document, function (val, key) {                                                                              // 114
    var valReplaced = replaceTypes(val, atomTransformer);                                                             // 115
    if (val !== valReplaced) {                                                                                        // 116
      // Lazy clone. Shallow copy.                                                                                    //
      if (ret === document) ret = _.clone(document);                                                                  // 118
      ret[key] = valReplaced;                                                                                         // 120
    }                                                                                                                 //
  });                                                                                                                 //
  return ret;                                                                                                         // 123
};                                                                                                                    //
                                                                                                                      //
MongoConnection = function MongoConnection(url, options) {                                                            // 127
  var self = this;                                                                                                    // 128
  options = options || {};                                                                                            // 129
  self._observeMultiplexers = {};                                                                                     // 130
  self._onFailoverHook = new Hook();                                                                                  // 131
                                                                                                                      //
  var mongoOptions = { db: { safe: true }, server: {}, replSet: {} };                                                 // 133
                                                                                                                      //
  // Set autoReconnect to true, unless passed on the URL. Why someone                                                 //
  // would want to set autoReconnect to false, I'm not really sure, but                                               //
  // keeping this for backwards compatibility for now.                                                                //
  if (!/[\?&]auto_?[rR]econnect=/.test(url)) {                                                                        // 127
    mongoOptions.server.auto_reconnect = true;                                                                        // 139
  }                                                                                                                   //
                                                                                                                      //
  // Disable the native parser by default, unless specifically enabled                                                //
  // in the mongo URL.                                                                                                //
  // - The native driver can cause errors which normally would be                                                     //
  //   thrown, caught, and handled into segfaults that take down the                                                  //
  //   whole app.                                                                                                     //
  // - Binary modules don't yet work when you bundle and move the bundle                                              //
  //   to a different platform (aka deploy)                                                                           //
  // We should revisit this after binary npm module support lands.                                                    //
  if (!/[\?&]native_?[pP]arser=/.test(url)) {                                                                         // 127
    mongoOptions.db.native_parser = false;                                                                            // 151
  }                                                                                                                   //
                                                                                                                      //
  // XXX maybe we should have a better way of allowing users to configure the                                         //
  // underlying Mongo driver                                                                                          //
  if (_.has(options, 'poolSize')) {                                                                                   // 127
    // If we just set this for "server", replSet will override it. If we just                                         //
    // set it for replSet, it will be ignored if we're not using a replSet.                                           //
    mongoOptions.server.poolSize = options.poolSize;                                                                  // 159
    mongoOptions.replSet.poolSize = options.poolSize;                                                                 // 160
  }                                                                                                                   //
                                                                                                                      //
  self.db = null;                                                                                                     // 163
  // We keep track of the ReplSet's primary, so that we can trigger hooks when                                        //
  // it changes.  The Node driver's joined callback seems to fire way too                                             //
  // often, which is why we need to track it ourselves.                                                               //
  self._primary = null;                                                                                               // 127
  self._oplogHandle = null;                                                                                           // 168
  self._docFetcher = null;                                                                                            // 169
                                                                                                                      //
  var connectFuture = new Future();                                                                                   // 172
  MongoDB.connect(url, mongoOptions, Meteor.bindEnvironment(function (err, db) {                                      // 173
    if (err) {                                                                                                        // 178
      throw err;                                                                                                      // 179
    }                                                                                                                 //
                                                                                                                      //
    // First, figure out what the current primary is, if any.                                                         //
    if (db.serverConfig._state.master) self._primary = db.serverConfig._state.master.name;                            // 177
    db.serverConfig.on('joined', Meteor.bindEnvironment(function (kind, doc) {                                        // 185
      if (kind === 'primary') {                                                                                       // 187
        if (doc.primary !== self._primary) {                                                                          // 188
          self._primary = doc.primary;                                                                                // 189
          self._onFailoverHook.each(function (callback) {                                                             // 190
            callback();                                                                                               // 191
            return true;                                                                                              // 192
          });                                                                                                         //
        }                                                                                                             //
      } else if (doc.me === self._primary) {                                                                          //
        // The thing we thought was primary is now something other than                                               //
        // primary.  Forget that we thought it was primary.  (This means                                              //
        // that if a server stops being primary and then starts being                                                 //
        // primary again without another server becoming primary in the                                               //
        // middle, we'll correctly count it as a failover.)                                                           //
        self._primary = null;                                                                                         // 201
      }                                                                                                               //
    }));                                                                                                              //
                                                                                                                      //
    // Allow the constructor to return.                                                                               //
    connectFuture['return'](db);                                                                                      // 177
  }, connectFuture.resolver() // onException                                                                          //
  ));                                                                                                                 // 176
                                                                                                                      //
  // Wait for the connection to be successful; throws on failure.                                                     //
  self.db = connectFuture.wait();                                                                                     // 127
                                                                                                                      //
  if (options.oplogUrl && !Package['disable-oplog']) {                                                                // 215
    self._oplogHandle = new OplogHandle(options.oplogUrl, self.db.databaseName);                                      // 216
    self._docFetcher = new DocFetcher(self);                                                                          // 217
  }                                                                                                                   //
};                                                                                                                    //
                                                                                                                      //
MongoConnection.prototype.close = function () {                                                                       // 221
  var self = this;                                                                                                    // 222
                                                                                                                      //
  if (!self.db) throw Error("close called before Connection created?");                                               // 224
                                                                                                                      //
  // XXX probably untested                                                                                            //
  var oplogHandle = self._oplogHandle;                                                                                // 221
  self._oplogHandle = null;                                                                                           // 229
  if (oplogHandle) oplogHandle.stop();                                                                                // 230
                                                                                                                      //
  // Use Future.wrap so that errors get thrown. This happens to                                                       //
  // work even outside a fiber since the 'close' method is not                                                        //
  // actually asynchronous.                                                                                           //
  Future.wrap(_.bind(self.db.close, self.db))(true).wait();                                                           // 221
};                                                                                                                    //
                                                                                                                      //
// Returns the Mongo Collection object; may yield.                                                                    //
MongoConnection.prototype.rawCollection = function (collectionName) {                                                 // 240
  var self = this;                                                                                                    // 241
                                                                                                                      //
  if (!self.db) throw Error("rawCollection called before Connection created?");                                       // 243
                                                                                                                      //
  var future = new Future();                                                                                          // 246
  self.db.collection(collectionName, future.resolver());                                                              // 247
  return future.wait();                                                                                               // 248
};                                                                                                                    //
                                                                                                                      //
MongoConnection.prototype._createCappedCollection = function (collectionName, byteSize, maxDocuments) {               // 251
  var self = this;                                                                                                    // 253
                                                                                                                      //
  if (!self.db) throw Error("_createCappedCollection called before Connection created?");                             // 255
                                                                                                                      //
  var future = new Future();                                                                                          // 258
  self.db.createCollection(collectionName, { capped: true, size: byteSize, max: maxDocuments }, future.resolver());   // 259
  future.wait();                                                                                                      // 263
};                                                                                                                    //
                                                                                                                      //
// This should be called synchronously with a write, to create a                                                      //
// transaction on the current write fence, if any. After we can read                                                  //
// the write, and after observers have been notified (or at least,                                                    //
// after the observer notifiers have added themselves to the write                                                    //
// fence), you should call 'committed()' on the object returned.                                                      //
MongoConnection.prototype._maybeBeginWrite = function () {                                                            // 271
  var self = this;                                                                                                    // 272
  var fence = DDPServer._CurrentWriteFence.get();                                                                     // 273
  if (fence) return fence.beginWrite();else return { committed: function () {                                         // 274
      function committed() {}                                                                                         // 277
                                                                                                                      //
      return committed;                                                                                               //
    }() };                                                                                                            //
};                                                                                                                    //
                                                                                                                      //
// Internal interface: adds a callback which is called when the Mongo primary                                         //
// changes. Returns a stop handle.                                                                                    //
MongoConnection.prototype._onFailover = function (callback) {                                                         // 282
  return this._onFailoverHook.register(callback);                                                                     // 283
};                                                                                                                    //
                                                                                                                      //
//////////// Public API //////////                                                                                    //
                                                                                                                      //
// The write methods block until the database has confirmed the write (it may                                         //
// not be replicated or stable on disk, but one server has confirmed it) if no                                        //
// callback is provided. If a callback is provided, then they call the callback                                       //
// when the write is confirmed. They return nothing on success, and raise an                                          //
// exception on failure.                                                                                              //
//                                                                                                                    //
// After making a write (with insert, update, remove), observers are                                                  //
// notified asynchronously. If you want to receive a callback once all                                                //
// of the observer notifications have landed for your write, do the                                                   //
// writes inside a write fence (set DDPServer._CurrentWriteFence to a new                                             //
// _WriteFence, and then set a callback on the write fence.)                                                          //
//                                                                                                                    //
// Since our execution environment is single-threaded, this is                                                        //
// well-defined -- a write "has been made" if it's returned, and an                                                   //
// observer "has been notified" if its callback has returned.                                                         //
                                                                                                                      //
var writeCallback = function writeCallback(write, refresh, callback) {                                                // 305
  return function (err, result) {                                                                                     // 306
    if (!err) {                                                                                                       // 307
      // XXX We don't have to run this on error, right?                                                               //
      try {                                                                                                           // 309
        refresh();                                                                                                    // 310
      } catch (refreshErr) {                                                                                          //
        if (callback) {                                                                                               // 312
          callback(refreshErr);                                                                                       // 313
          return;                                                                                                     // 314
        } else {                                                                                                      //
          throw refreshErr;                                                                                           // 316
        }                                                                                                             //
      }                                                                                                               //
    }                                                                                                                 //
    write.committed();                                                                                                // 320
    if (callback) callback(err, result);else if (err) throw err;                                                      // 321
  };                                                                                                                  //
};                                                                                                                    //
                                                                                                                      //
var bindEnvironmentForWrite = function bindEnvironmentForWrite(callback) {                                            // 328
  return Meteor.bindEnvironment(callback, "Mongo write");                                                             // 329
};                                                                                                                    //
                                                                                                                      //
MongoConnection.prototype._insert = function (collection_name, document, callback) {                                  // 332
  var self = this;                                                                                                    // 334
                                                                                                                      //
  var sendError = function sendError(e) {                                                                             // 336
    if (callback) return callback(e);                                                                                 // 337
    throw e;                                                                                                          // 339
  };                                                                                                                  //
                                                                                                                      //
  if (collection_name === "___meteor_failure_test_collection") {                                                      // 342
    var e = new Error("Failure test");                                                                                // 343
    e.expected = true;                                                                                                // 344
    sendError(e);                                                                                                     // 345
    return;                                                                                                           // 346
  }                                                                                                                   //
                                                                                                                      //
  if (!(LocalCollection._isPlainObject(document) && !EJSON._isCustomType(document))) {                                // 349
    sendError(new Error("Only plain objects may be inserted into MongoDB"));                                          // 351
    return;                                                                                                           // 353
  }                                                                                                                   //
                                                                                                                      //
  var write = self._maybeBeginWrite();                                                                                // 356
  var refresh = function refresh() {                                                                                  // 357
    Meteor.refresh({ collection: collection_name, id: document._id });                                                // 358
  };                                                                                                                  //
  callback = bindEnvironmentForWrite(writeCallback(write, refresh, callback));                                        // 360
  try {                                                                                                               // 361
    var collection = self.rawCollection(collection_name);                                                             // 362
    collection.insert(replaceTypes(document, replaceMeteorAtomWithMongo), { safe: true }, callback);                  // 363
  } catch (e) {                                                                                                       //
    write.committed();                                                                                                // 366
    throw e;                                                                                                          // 367
  }                                                                                                                   //
};                                                                                                                    //
                                                                                                                      //
// Cause queries that may be affected by the selector to poll in this write                                           //
// fence.                                                                                                             //
MongoConnection.prototype._refresh = function (collectionName, selector) {                                            // 373
  var self = this;                                                                                                    // 374
  var refreshKey = { collection: collectionName };                                                                    // 375
  // If we know which documents we're removing, don't poll queries that are                                           //
  // specific to other documents. (Note that multiple notifications here should                                       //
  // not cause multiple polls, since all our listener is doing is enqueueing a                                        //
  // poll.)                                                                                                           //
  var specificIds = LocalCollection._idsMatchedBySelector(selector);                                                  // 373
  if (specificIds) {                                                                                                  // 381
    _.each(specificIds, function (id) {                                                                               // 382
      Meteor.refresh(_.extend({ id: id }, refreshKey));                                                               // 383
    });                                                                                                               //
  } else {                                                                                                            //
    Meteor.refresh(refreshKey);                                                                                       // 386
  }                                                                                                                   //
};                                                                                                                    //
                                                                                                                      //
MongoConnection.prototype._remove = function (collection_name, selector, callback) {                                  // 390
  var self = this;                                                                                                    // 392
                                                                                                                      //
  if (collection_name === "___meteor_failure_test_collection") {                                                      // 394
    var e = new Error("Failure test");                                                                                // 395
    e.expected = true;                                                                                                // 396
    if (callback) return callback(e);else throw e;                                                                    // 397
  }                                                                                                                   //
                                                                                                                      //
  var write = self._maybeBeginWrite();                                                                                // 403
  var refresh = function refresh() {                                                                                  // 404
    self._refresh(collection_name, selector);                                                                         // 405
  };                                                                                                                  //
  callback = bindEnvironmentForWrite(writeCallback(write, refresh, callback));                                        // 407
                                                                                                                      //
  try {                                                                                                               // 409
    var collection = self.rawCollection(collection_name);                                                             // 410
    collection.remove(replaceTypes(selector, replaceMeteorAtomWithMongo), { safe: true }, callback);                  // 411
  } catch (e) {                                                                                                       //
    write.committed();                                                                                                // 414
    throw e;                                                                                                          // 415
  }                                                                                                                   //
};                                                                                                                    //
                                                                                                                      //
MongoConnection.prototype._dropCollection = function (collectionName, cb) {                                           // 419
  var self = this;                                                                                                    // 420
                                                                                                                      //
  var write = self._maybeBeginWrite();                                                                                // 422
  var refresh = function refresh() {                                                                                  // 423
    Meteor.refresh({ collection: collectionName, id: null,                                                            // 424
      dropCollection: true });                                                                                        // 425
  };                                                                                                                  //
  cb = bindEnvironmentForWrite(writeCallback(write, refresh, cb));                                                    // 427
                                                                                                                      //
  try {                                                                                                               // 429
    var collection = self.rawCollection(collectionName);                                                              // 430
    collection.drop(cb);                                                                                              // 431
  } catch (e) {                                                                                                       //
    write.committed();                                                                                                // 433
    throw e;                                                                                                          // 434
  }                                                                                                                   //
};                                                                                                                    //
                                                                                                                      //
// For testing only.  Slightly better than `c.rawDatabase().dropDatabase()`                                           //
// because it lets the test's fence wait for it to be complete.                                                       //
MongoConnection.prototype._dropDatabase = function (cb) {                                                             // 440
  var self = this;                                                                                                    // 441
                                                                                                                      //
  var write = self._maybeBeginWrite();                                                                                // 443
  var refresh = function refresh() {                                                                                  // 444
    Meteor.refresh({ dropDatabase: true });                                                                           // 445
  };                                                                                                                  //
  cb = bindEnvironmentForWrite(writeCallback(write, refresh, cb));                                                    // 447
                                                                                                                      //
  try {                                                                                                               // 449
    self.db.dropDatabase(cb);                                                                                         // 450
  } catch (e) {                                                                                                       //
    write.committed();                                                                                                // 452
    throw e;                                                                                                          // 453
  }                                                                                                                   //
};                                                                                                                    //
                                                                                                                      //
MongoConnection.prototype._update = function (collection_name, selector, mod, options, callback) {                    // 457
  var self = this;                                                                                                    // 459
                                                                                                                      //
  if (!callback && options instanceof Function) {                                                                     // 461
    callback = options;                                                                                               // 462
    options = null;                                                                                                   // 463
  }                                                                                                                   //
                                                                                                                      //
  if (collection_name === "___meteor_failure_test_collection") {                                                      // 466
    var e = new Error("Failure test");                                                                                // 467
    e.expected = true;                                                                                                // 468
    if (callback) return callback(e);else throw e;                                                                    // 469
  }                                                                                                                   //
                                                                                                                      //
  // explicit safety check. null and undefined can crash the mongo                                                    //
  // driver. Although the node driver and minimongo do 'support'                                                      //
  // non-object modifier in that they don't crash, they are not                                                       //
  // meaningful operations and do not do anything. Defensively throw an                                               //
  // error here.                                                                                                      //
  if (!mod || (typeof mod === 'undefined' ? 'undefined' : (0, _typeof3['default'])(mod)) !== 'object') throw new Error("Invalid modifier. Modifier must be an object.");
                                                                                                                      //
  if (!(LocalCollection._isPlainObject(mod) && !EJSON._isCustomType(mod))) {                                          // 483
    throw new Error("Only plain objects may be used as replacement" + " documents in MongoDB");                       // 485
    return;                                                                                                           // 488
  }                                                                                                                   //
                                                                                                                      //
  if (!options) options = {};                                                                                         // 491
                                                                                                                      //
  var write = self._maybeBeginWrite();                                                                                // 493
  var refresh = function refresh() {                                                                                  // 494
    self._refresh(collection_name, selector);                                                                         // 495
  };                                                                                                                  //
  callback = writeCallback(write, refresh, callback);                                                                 // 497
  try {                                                                                                               // 498
    var collection = self.rawCollection(collection_name);                                                             // 499
    var mongoOpts = { safe: true };                                                                                   // 500
    // explictly enumerate options that minimongo supports                                                            //
    if (options.upsert) mongoOpts.upsert = true;                                                                      // 498
    if (options.multi) mongoOpts.multi = true;                                                                        // 503
    // Lets you get a more more full result from MongoDB. Use with caution:                                           //
    // might not work with C.upsert (as opposed to C.update({upsert:true}) or                                         //
    // with simulated upsert.                                                                                         //
    if (options.fullResult) mongoOpts.fullResult = true;                                                              // 498
                                                                                                                      //
    var mongoSelector = replaceTypes(selector, replaceMeteorAtomWithMongo);                                           // 509
    var mongoMod = replaceTypes(mod, replaceMeteorAtomWithMongo);                                                     // 510
                                                                                                                      //
    var isModify = isModificationMod(mongoMod);                                                                       // 512
    var knownId = selector._id || mod._id;                                                                            // 513
                                                                                                                      //
    if (options._forbidReplace && !isModify) {                                                                        // 515
      var e = new Error("Invalid modifier. Replacements are forbidden.");                                             // 516
      if (callback) {                                                                                                 // 517
        return callback(e);                                                                                           // 518
      } else {                                                                                                        //
        throw e;                                                                                                      // 520
      }                                                                                                               //
    }                                                                                                                 //
                                                                                                                      //
    if (options.upsert && !knownId && options.insertedId) {                                                           // 524
      // XXX If we know we're using Mongo 2.6 (and this isn't a replacement)                                          //
      //     we should be able to just use $setOnInsert instead of this                                               //
      //     simulated upsert thing. (We can't use $setOnInsert with                                                  //
      //     replacements because there's nowhere to write it, and $setOnInsert                                       //
      //     can't set _id on Mongo 2.4.)                                                                             //
      //                                                                                                              //
      //     Also, in the future we could do a real upsert for the mongo id                                           //
      //     generation case, if the the node mongo driver gives us back the id                                       //
      //     of the upserted doc (which our current version does not).                                                //
      //                                                                                                              //
      //     For more context, see                                                                                    //
      //     https://github.com/meteor/meteor/issues/2278#issuecomment-64252706                                       //
      simulateUpsertWithInsertedId(collection, mongoSelector, mongoMod, isModify, options,                            // 537
      // This callback does not need to be bindEnvironment'ed because                                                 //
      // simulateUpsertWithInsertedId() wraps it and then passes it through                                           //
      // bindEnvironmentForWrite.                                                                                     //
      function (err, result) {                                                                                        // 543
        // If we got here via a upsert() call, then options._returnObject will                                        //
        // be set and we should return the whole object. Otherwise, we should                                         //
        // just return the number of affected docs to match the mongo API.                                            //
        if (result && !options._returnObject) callback(err, result.numberAffected);else callback(err, result);        // 547
      });                                                                                                             //
    } else {                                                                                                          //
      collection.update(mongoSelector, mongoMod, mongoOpts, bindEnvironmentForWrite(function (err, result, extra) {   // 554
        if (!err) {                                                                                                   // 557
          if (result && options._returnObject) {                                                                      // 558
            result = { numberAffected: result };                                                                      // 559
            // If this was an upsert() call, and we ended up                                                          //
            // inserting a new doc and we know its id, then                                                           //
            // return that id as well.                                                                                //
            if (options.upsert && knownId && !extra.updatedExisting) result.insertedId = knownId;                     // 558
          }                                                                                                           //
        }                                                                                                             //
        callback(err, result);                                                                                        // 568
      }));                                                                                                            //
    }                                                                                                                 //
  } catch (e) {                                                                                                       //
    write.committed();                                                                                                // 572
    throw e;                                                                                                          // 573
  }                                                                                                                   //
};                                                                                                                    //
                                                                                                                      //
var isModificationMod = function isModificationMod(mod) {                                                             // 577
  var isReplace = false;                                                                                              // 578
  var isModify = false;                                                                                               // 579
  for (var k in meteorBabelHelpers.sanitizeForInObject(mod)) {                                                        // 580
    if (k.substr(0, 1) === '$') {                                                                                     // 581
      isModify = true;                                                                                                // 582
    } else {                                                                                                          //
      isReplace = true;                                                                                               // 584
    }                                                                                                                 //
  }                                                                                                                   //
  if (isModify && isReplace) {                                                                                        // 587
    throw new Error("Update parameter cannot have both modifier and non-modifier fields.");                           // 588
  }                                                                                                                   //
  return isModify;                                                                                                    // 591
};                                                                                                                    //
                                                                                                                      //
var NUM_OPTIMISTIC_TRIES = 3;                                                                                         // 594
                                                                                                                      //
// exposed for testing                                                                                                //
MongoConnection._isCannotChangeIdError = function (err) {                                                             // 597
  // First check for what this error looked like in Mongo 2.4.  Either of these                                       //
  // checks should work, but just to be safe...                                                                       //
  if (err.code === 13596) return true;                                                                                // 600
  if (err.err.indexOf("cannot change _id of a document") === 0) return true;                                          // 602
                                                                                                                      //
  // Now look for what it looks like in Mongo 2.6.  We don't use the error code                                       //
  // here, because the error code we observed it producing (16837) appears to be                                      //
  // a far more generic error code based on examining the source.                                                     //
  if (err.err.indexOf("The _id field cannot be changed") === 0) return true;                                          // 597
                                                                                                                      //
  return false;                                                                                                       // 611
};                                                                                                                    //
                                                                                                                      //
var simulateUpsertWithInsertedId = function simulateUpsertWithInsertedId(collection, selector, mod, isModify, options, callback) {
  // STRATEGY:  First try doing a plain update.  If it affected 0 documents,                                          //
  // then without affecting the database, we know we should probably do an                                            //
  // insert.  We then do a *conditional* insert that will fail in the case                                            //
  // of a race condition.  This conditional insert is actually an                                                     //
  // upsert-replace with an _id, which will never successfully update an                                              //
  // existing document.  If this upsert fails with an error saying it                                                 //
  // couldn't change an existing _id, then we know an intervening write has                                           //
  // caused the query to match something.  We go back to step one and repeat.                                         //
  // Like all "optimistic write" schemes, we rely on the fact that it's                                               //
  // unlikely our writes will continue to be interfered with under normal                                             //
  // circumstances (though sufficiently heavy contention with writers                                                 //
  // disagreeing on the existence of an object will cause writes to fail                                              //
  // in theory).                                                                                                      //
                                                                                                                      //
  var newDoc;                                                                                                         // 630
  // Run this code up front so that it fails fast if someone uses                                                     //
  // a Mongo update operator we don't support.                                                                        //
  if (isModify) {                                                                                                     // 615
    // We've already run replaceTypes/replaceMeteorAtomWithMongo on                                                   //
    // selector and mod.  We assume it doesn't matter, as far as                                                      //
    // the behavior of modifiers is concerned, whether `_modify`                                                      //
    // is run on EJSON or on mongo-converted EJSON.                                                                   //
    var selectorDoc = LocalCollection._removeDollarOperators(selector);                                               // 638
                                                                                                                      //
    newDoc = selectorDoc;                                                                                             // 640
                                                                                                                      //
    // Convert dotted keys into objects. (Resolves issue #4522).                                                      //
    _.each(newDoc, function (value, key) {                                                                            // 633
      var trail = key.split(".");                                                                                     // 644
                                                                                                                      //
      if (trail.length > 1) {                                                                                         // 646
        //Key is dotted. Convert it into an object.                                                                   //
        delete newDoc[key];                                                                                           // 648
                                                                                                                      //
        var obj = newDoc,                                                                                             // 650
            leaf = trail.pop();                                                                                       //
                                                                                                                      //
        // XXX It is not quite certain what should be done if there are clashing                                      //
        // keys on the trail of the dotted key. For now we will just override it                                      //
        // It wouldn't be a very sane query in the first place, but should look                                       //
        // up what mongo does in this case.                                                                           //
                                                                                                                      //
        while (key = trail.shift()) {                                                                                 // 646
          if ((0, _typeof3['default'])(obj[key]) !== "object") {                                                      // 659
            obj[key] = {};                                                                                            // 660
          }                                                                                                           //
                                                                                                                      //
          obj = obj[key];                                                                                             // 663
        }                                                                                                             //
                                                                                                                      //
        obj[leaf] = value;                                                                                            // 666
      }                                                                                                               //
    });                                                                                                               //
                                                                                                                      //
    LocalCollection._modify(newDoc, mod, { isInsert: true });                                                         // 670
  } else {                                                                                                            //
    newDoc = mod;                                                                                                     // 672
  }                                                                                                                   //
                                                                                                                      //
  var insertedId = options.insertedId; // must exist                                                                  // 675
  var mongoOptsForUpdate = {                                                                                          // 615
    safe: true,                                                                                                       // 677
    multi: options.multi                                                                                              // 678
  };                                                                                                                  //
  var mongoOptsForInsert = {                                                                                          // 680
    safe: true,                                                                                                       // 681
    upsert: true                                                                                                      // 682
  };                                                                                                                  //
                                                                                                                      //
  var tries = NUM_OPTIMISTIC_TRIES;                                                                                   // 685
                                                                                                                      //
  var doUpdate = function doUpdate() {                                                                                // 687
    tries--;                                                                                                          // 688
    if (!tries) {                                                                                                     // 689
      callback(new Error("Upsert failed after " + NUM_OPTIMISTIC_TRIES + " tries."));                                 // 690
    } else {                                                                                                          //
      collection.update(selector, mod, mongoOptsForUpdate, bindEnvironmentForWrite(function (err, result) {           // 692
        if (err) callback(err);else if (result) callback(null, {                                                      // 694
          numberAffected: result                                                                                      // 698
        });else doConditionalInsert();                                                                                //
      }));                                                                                                            //
    }                                                                                                                 //
  };                                                                                                                  //
                                                                                                                      //
  var doConditionalInsert = function doConditionalInsert() {                                                          // 706
    var replacementWithId = _.extend(replaceTypes({ _id: insertedId }, replaceMeteorAtomWithMongo), newDoc);          // 707
    collection.update(selector, replacementWithId, mongoOptsForInsert, bindEnvironmentForWrite(function (err, result) {
      if (err) {                                                                                                      // 712
        // figure out if this is a                                                                                    //
        // "cannot change _id of document" error, and                                                                 //
        // if so, try doUpdate() again, up to 3 times.                                                                //
        if (MongoConnection._isCannotChangeIdError(err)) {                                                            // 716
          doUpdate();                                                                                                 // 717
        } else {                                                                                                      //
          callback(err);                                                                                              // 719
        }                                                                                                             //
      } else {                                                                                                        //
        callback(null, {                                                                                              // 722
          numberAffected: result,                                                                                     // 723
          insertedId: insertedId                                                                                      // 724
        });                                                                                                           //
      }                                                                                                               //
    }));                                                                                                              //
  };                                                                                                                  //
                                                                                                                      //
  doUpdate();                                                                                                         // 730
};                                                                                                                    //
                                                                                                                      //
_.each(["insert", "update", "remove", "dropCollection", "dropDatabase"], function (method) {                          // 733
  MongoConnection.prototype[method] = function () /* arguments */{                                                    // 734
    var self = this;                                                                                                  // 735
    return Meteor.wrapAsync(self["_" + method]).apply(self, arguments);                                               // 736
  };                                                                                                                  //
});                                                                                                                   //
                                                                                                                      //
// XXX MongoConnection.upsert() does not return the id of the inserted document                                       //
// unless you set it explicitly in the selector or modifier (as a replacement                                         //
// doc).                                                                                                              //
MongoConnection.prototype.upsert = function (collectionName, selector, mod, options, callback) {                      // 743
  var self = this;                                                                                                    // 745
  if (typeof options === "function" && !callback) {                                                                   // 746
    callback = options;                                                                                               // 747
    options = {};                                                                                                     // 748
  }                                                                                                                   //
                                                                                                                      //
  return self.update(collectionName, selector, mod, _.extend({}, options, {                                           // 751
    upsert: true,                                                                                                     // 753
    _returnObject: true                                                                                               // 754
  }), callback);                                                                                                      //
};                                                                                                                    //
                                                                                                                      //
MongoConnection.prototype.find = function (collectionName, selector, options) {                                       // 758
  var self = this;                                                                                                    // 759
                                                                                                                      //
  if (arguments.length === 1) selector = {};                                                                          // 761
                                                                                                                      //
  return new Cursor(self, new CursorDescription(collectionName, selector, options));                                  // 764
};                                                                                                                    //
                                                                                                                      //
MongoConnection.prototype.findOne = function (collection_name, selector, options) {                                   // 768
  var self = this;                                                                                                    // 770
  if (arguments.length === 1) selector = {};                                                                          // 771
                                                                                                                      //
  options = options || {};                                                                                            // 774
  options.limit = 1;                                                                                                  // 775
  return self.find(collection_name, selector, options).fetch()[0];                                                    // 776
};                                                                                                                    //
                                                                                                                      //
// We'll actually design an index API later. For now, we just pass through to                                         //
// Mongo's, but make it synchronous.                                                                                  //
MongoConnection.prototype._ensureIndex = function (collectionName, index, options) {                                  // 781
  var self = this;                                                                                                    // 783
                                                                                                                      //
  // We expect this function to be called at startup, not from within a method,                                       //
  // so we don't interact with the write fence.                                                                       //
  var collection = self.rawCollection(collectionName);                                                                // 782
  var future = new Future();                                                                                          // 788
  var indexName = collection.ensureIndex(index, options, future.resolver());                                          // 789
  future.wait();                                                                                                      // 790
};                                                                                                                    //
MongoConnection.prototype._dropIndex = function (collectionName, index) {                                             // 792
  var self = this;                                                                                                    // 793
                                                                                                                      //
  // This function is only used by test code, not within a method, so we don't                                        //
  // interact with the write fence.                                                                                   //
  var collection = self.rawCollection(collectionName);                                                                // 792
  var future = new Future();                                                                                          // 798
  var indexName = collection.dropIndex(index, future.resolver());                                                     // 799
  future.wait();                                                                                                      // 800
};                                                                                                                    //
                                                                                                                      //
// CURSORS                                                                                                            //
                                                                                                                      //
// There are several classes which relate to cursors:                                                                 //
//                                                                                                                    //
// CursorDescription represents the arguments used to construct a cursor:                                             //
// collectionName, selector, and (find) options.  Because it is used as a key                                         //
// for cursor de-dup, everything in it should either be JSON-stringifiable or                                         //
// not affect observeChanges output (eg, options.transform functions are not                                          //
// stringifiable but do not affect observeChanges).                                                                   //
//                                                                                                                    //
// SynchronousCursor is a wrapper around a MongoDB cursor                                                             //
// which includes fully-synchronous versions of forEach, etc.                                                         //
//                                                                                                                    //
// Cursor is the cursor object returned from find(), which implements the                                             //
// documented Mongo.Collection cursor API.  It wraps a CursorDescription and a                                        //
// SynchronousCursor (lazily: it doesn't contact Mongo until you call a method                                        //
// like fetch or forEach on it).                                                                                      //
//                                                                                                                    //
// ObserveHandle is the "observe handle" returned from observeChanges. It has a                                       //
// reference to an ObserveMultiplexer.                                                                                //
//                                                                                                                    //
// ObserveMultiplexer allows multiple identical ObserveHandles to be driven by a                                      //
// single observe driver.                                                                                             //
//                                                                                                                    //
// There are two "observe drivers" which drive ObserveMultiplexers:                                                   //
//   - PollingObserveDriver caches the results of a query and reruns it when                                          //
//     necessary.                                                                                                     //
//   - OplogObserveDriver follows the Mongo operation log to directly observe                                         //
//     database changes.                                                                                              //
// Both implementations follow the same simple interface: when you create them,                                       //
// they start sending observeChanges callbacks (and a ready() invocation) to                                          //
// their ObserveMultiplexer, and you stop them by calling their stop() method.                                        //
                                                                                                                      //
CursorDescription = function CursorDescription(collectionName, selector, options) {                                   // 836
  var self = this;                                                                                                    // 837
  self.collectionName = collectionName;                                                                               // 838
  self.selector = Mongo.Collection._rewriteSelector(selector);                                                        // 839
  self.options = options || {};                                                                                       // 840
};                                                                                                                    //
                                                                                                                      //
Cursor = function Cursor(mongo, cursorDescription) {                                                                  // 843
  var self = this;                                                                                                    // 844
                                                                                                                      //
  self._mongo = mongo;                                                                                                // 846
  self._cursorDescription = cursorDescription;                                                                        // 847
  self._synchronousCursor = null;                                                                                     // 848
};                                                                                                                    //
                                                                                                                      //
_.each(['forEach', 'map', 'fetch', 'count'], function (method) {                                                      // 851
  Cursor.prototype[method] = function () {                                                                            // 852
    var self = this;                                                                                                  // 853
                                                                                                                      //
    // You can only observe a tailable cursor.                                                                        //
    if (self._cursorDescription.options.tailable) throw new Error("Cannot call " + method + " on a tailable cursor");
                                                                                                                      //
    if (!self._synchronousCursor) {                                                                                   // 859
      self._synchronousCursor = self._mongo._createSynchronousCursor(self._cursorDescription, {                       // 860
        // Make sure that the "self" argument to forEach/map callbacks is the                                         //
        // Cursor, not the SynchronousCursor.                                                                         //
        selfForIteration: self,                                                                                       // 864
        useTransform: true                                                                                            // 865
      });                                                                                                             //
    }                                                                                                                 //
                                                                                                                      //
    return self._synchronousCursor[method].apply(self._synchronousCursor, arguments);                                 // 869
  };                                                                                                                  //
});                                                                                                                   //
                                                                                                                      //
// Since we don't actually have a "nextObject" interface, there's really no                                           //
// reason to have a "rewind" interface.  All it did was make multiple calls                                           //
// to fetch/map/forEach return nothing the second time.                                                               //
// XXX COMPAT WITH 0.8.1                                                                                              //
Cursor.prototype.rewind = function () {};                                                                             // 878
                                                                                                                      //
Cursor.prototype.getTransform = function () {                                                                         // 881
  return this._cursorDescription.options.transform;                                                                   // 882
};                                                                                                                    //
                                                                                                                      //
// When you call Meteor.publish() with a function that returns a Cursor, we need                                      //
// to transmute it into the equivalent subscription.  This is the function that                                       //
// does that.                                                                                                         //
                                                                                                                      //
Cursor.prototype._publishCursor = function (sub) {                                                                    // 889
  var self = this;                                                                                                    // 890
  var collection = self._cursorDescription.collectionName;                                                            // 891
  return Mongo.Collection._publishCursor(self, sub, collection);                                                      // 892
};                                                                                                                    //
                                                                                                                      //
// Used to guarantee that publish functions return at most one cursor per                                             //
// collection. Private, because we might later have cursors that include                                              //
// documents from multiple collections somehow.                                                                       //
Cursor.prototype._getCollectionName = function () {                                                                   // 898
  var self = this;                                                                                                    // 899
  return self._cursorDescription.collectionName;                                                                      // 900
};                                                                                                                    //
                                                                                                                      //
Cursor.prototype.observe = function (callbacks) {                                                                     // 903
  var self = this;                                                                                                    // 904
  return LocalCollection._observeFromObserveChanges(self, callbacks);                                                 // 905
};                                                                                                                    //
                                                                                                                      //
Cursor.prototype.observeChanges = function (callbacks) {                                                              // 908
  var self = this;                                                                                                    // 909
  var ordered = LocalCollection._observeChangesCallbacksAreOrdered(callbacks);                                        // 910
  return self._mongo._observeChanges(self._cursorDescription, ordered, callbacks);                                    // 911
};                                                                                                                    //
                                                                                                                      //
MongoConnection.prototype._createSynchronousCursor = function (cursorDescription, options) {                          // 915
  var self = this;                                                                                                    // 917
  options = _.pick(options || {}, 'selfForIteration', 'useTransform');                                                // 918
                                                                                                                      //
  var collection = self.rawCollection(cursorDescription.collectionName);                                              // 920
  var cursorOptions = cursorDescription.options;                                                                      // 921
  var mongoOptions = {                                                                                                // 922
    sort: cursorOptions.sort,                                                                                         // 923
    limit: cursorOptions.limit,                                                                                       // 924
    skip: cursorOptions.skip                                                                                          // 925
  };                                                                                                                  //
                                                                                                                      //
  // Do we want a tailable cursor (which only works on capped collections)?                                           //
  if (cursorOptions.tailable) {                                                                                       // 916
    // We want a tailable cursor...                                                                                   //
    mongoOptions.tailable = true;                                                                                     // 931
    // ... and for the server to wait a bit if any getMore has no data (rather                                        //
    // than making us put the relevant sleeps in the client)...                                                       //
    mongoOptions.awaitdata = true;                                                                                    // 929
    // ... and to keep querying the server indefinitely rather than just 5 times                                      //
    // if there's no more data.                                                                                       //
    mongoOptions.numberOfRetries = -1;                                                                                // 929
    // And if this is on the oplog collection and the cursor specifies a 'ts',                                        //
    // then set the undocumented oplog replay flag, which does a special scan to                                      //
    // find the first document (instead of creating an index on ts). This is a                                        //
    // very hard-coded Mongo flag which only works on the oplog collection and                                        //
    // only works with the ts field.                                                                                  //
    if (cursorDescription.collectionName === OPLOG_COLLECTION && cursorDescription.selector.ts) {                     // 929
      mongoOptions.oplogReplay = true;                                                                                // 945
    }                                                                                                                 //
  }                                                                                                                   //
                                                                                                                      //
  var dbCursor = collection.find(replaceTypes(cursorDescription.selector, replaceMeteorAtomWithMongo), cursorOptions.fields, mongoOptions);
                                                                                                                      //
  return new SynchronousCursor(dbCursor, cursorDescription, options);                                                 // 953
};                                                                                                                    //
                                                                                                                      //
var SynchronousCursor = function SynchronousCursor(dbCursor, cursorDescription, options) {                            // 956
  var self = this;                                                                                                    // 957
  options = _.pick(options || {}, 'selfForIteration', 'useTransform');                                                // 958
                                                                                                                      //
  self._dbCursor = dbCursor;                                                                                          // 960
  self._cursorDescription = cursorDescription;                                                                        // 961
  // The "self" argument passed to forEach/map callbacks. If we're wrapped                                            //
  // inside a user-visible Cursor, we want to provide the outer cursor!                                               //
  self._selfForIteration = options.selfForIteration || self;                                                          // 956
  if (options.useTransform && cursorDescription.options.transform) {                                                  // 965
    self._transform = LocalCollection.wrapTransform(cursorDescription.options.transform);                             // 966
  } else {                                                                                                            //
    self._transform = null;                                                                                           // 969
  }                                                                                                                   //
                                                                                                                      //
  // Need to specify that the callback is the first argument to nextObject,                                           //
  // since otherwise when we try to call it with no args the driver will                                              //
  // interpret "undefined" first arg as an options hash and crash.                                                    //
  self._synchronousNextObject = Future.wrap(dbCursor.nextObject.bind(dbCursor), 0);                                   // 956
  self._synchronousCount = Future.wrap(dbCursor.count.bind(dbCursor));                                                // 977
  self._visitedIds = new LocalCollection._IdMap();                                                                    // 978
};                                                                                                                    //
                                                                                                                      //
_.extend(SynchronousCursor.prototype, {                                                                               // 981
  _nextObject: function () {                                                                                          // 982
    function _nextObject() {                                                                                          // 982
      var self = this;                                                                                                // 983
                                                                                                                      //
      while (true) {                                                                                                  // 985
        var doc = self._synchronousNextObject().wait();                                                               // 986
                                                                                                                      //
        if (!doc) return null;                                                                                        // 988
        doc = replaceTypes(doc, replaceMongoAtomWithMeteor);                                                          // 989
                                                                                                                      //
        if (!self._cursorDescription.options.tailable && _.has(doc, '_id')) {                                         // 991
          // Did Mongo give us duplicate documents in the same cursor? If so,                                         //
          // ignore this one. (Do this before the transform, since transform might                                    //
          // return some unrelated value.) We don't do this for tailable cursors,                                     //
          // because we want to maintain O(1) memory usage. And if there isn't _id                                    //
          // for some reason (maybe it's the oplog), then we don't do this either.                                    //
          // (Be careful to do this for falsey but existing _id, though.)                                             //
          if (self._visitedIds.has(doc._id)) continue;                                                                // 998
          self._visitedIds.set(doc._id, true);                                                                        // 999
        }                                                                                                             //
                                                                                                                      //
        if (self._transform) doc = self._transform(doc);                                                              // 1002
                                                                                                                      //
        return doc;                                                                                                   // 1005
      }                                                                                                               //
    }                                                                                                                 //
                                                                                                                      //
    return _nextObject;                                                                                               //
  }(),                                                                                                                //
                                                                                                                      //
  forEach: function () {                                                                                              // 1009
    function forEach(callback, thisArg) {                                                                             // 1009
      var self = this;                                                                                                // 1010
                                                                                                                      //
      // Get back to the beginning.                                                                                   //
      self._rewind();                                                                                                 // 1009
                                                                                                                      //
      // We implement the loop ourself instead of using self._dbCursor.each,                                          //
      // because "each" will call its callback outside of a fiber which makes it                                      //
      // much more complex to make this function synchronous.                                                         //
      var index = 0;                                                                                                  // 1009
      while (true) {                                                                                                  // 1019
        var doc = self._nextObject();                                                                                 // 1020
        if (!doc) return;                                                                                             // 1021
        callback.call(thisArg, doc, index++, self._selfForIteration);                                                 // 1022
      }                                                                                                               //
    }                                                                                                                 //
                                                                                                                      //
    return forEach;                                                                                                   //
  }(),                                                                                                                //
                                                                                                                      //
  // XXX Allow overlapping callback executions if callback yields.                                                    //
  map: function () {                                                                                                  // 1027
    function map(callback, thisArg) {                                                                                 // 1027
      var self = this;                                                                                                // 1028
      var res = [];                                                                                                   // 1029
      self.forEach(function (doc, index) {                                                                            // 1030
        res.push(callback.call(thisArg, doc, index, self._selfForIteration));                                         // 1031
      });                                                                                                             //
      return res;                                                                                                     // 1033
    }                                                                                                                 //
                                                                                                                      //
    return map;                                                                                                       //
  }(),                                                                                                                //
                                                                                                                      //
  _rewind: function () {                                                                                              // 1036
    function _rewind() {                                                                                              // 1036
      var self = this;                                                                                                // 1037
                                                                                                                      //
      // known to be synchronous                                                                                      //
      self._dbCursor.rewind();                                                                                        // 1036
                                                                                                                      //
      self._visitedIds = new LocalCollection._IdMap();                                                                // 1042
    }                                                                                                                 //
                                                                                                                      //
    return _rewind;                                                                                                   //
  }(),                                                                                                                //
                                                                                                                      //
  // Mostly usable for tailable cursors.                                                                              //
  close: function () {                                                                                                // 1046
    function close() {                                                                                                // 1046
      var self = this;                                                                                                // 1047
                                                                                                                      //
      self._dbCursor.close();                                                                                         // 1049
    }                                                                                                                 //
                                                                                                                      //
    return close;                                                                                                     //
  }(),                                                                                                                //
                                                                                                                      //
  fetch: function () {                                                                                                // 1052
    function fetch() {                                                                                                // 1052
      var self = this;                                                                                                // 1053
      return self.map(_.identity);                                                                                    // 1054
    }                                                                                                                 //
                                                                                                                      //
    return fetch;                                                                                                     //
  }(),                                                                                                                //
                                                                                                                      //
  count: function () {                                                                                                // 1057
    function count() {                                                                                                // 1057
      var self = this;                                                                                                // 1058
      return self._synchronousCount().wait();                                                                         // 1059
    }                                                                                                                 //
                                                                                                                      //
    return count;                                                                                                     //
  }(),                                                                                                                //
                                                                                                                      //
  // This method is NOT wrapped in Cursor.                                                                            //
  getRawObjects: function () {                                                                                        // 1063
    function getRawObjects(ordered) {                                                                                 // 1063
      var self = this;                                                                                                // 1064
      if (ordered) {                                                                                                  // 1065
        return self.fetch();                                                                                          // 1066
      } else {                                                                                                        //
        var results = new LocalCollection._IdMap();                                                                   // 1068
        self.forEach(function (doc) {                                                                                 // 1069
          results.set(doc._id, doc);                                                                                  // 1070
        });                                                                                                           //
        return results;                                                                                               // 1072
      }                                                                                                               //
    }                                                                                                                 //
                                                                                                                      //
    return getRawObjects;                                                                                             //
  }()                                                                                                                 //
});                                                                                                                   //
                                                                                                                      //
MongoConnection.prototype.tail = function (cursorDescription, docCallback) {                                          // 1077
  var self = this;                                                                                                    // 1078
  if (!cursorDescription.options.tailable) throw new Error("Can only tail a tailable cursor");                        // 1079
                                                                                                                      //
  var cursor = self._createSynchronousCursor(cursorDescription);                                                      // 1082
                                                                                                                      //
  var stopped = false;                                                                                                // 1084
  var lastTS = undefined;                                                                                             // 1085
  var loop = function loop() {                                                                                        // 1086
    while (true) {                                                                                                    // 1087
      if (stopped) return;                                                                                            // 1088
      try {                                                                                                           // 1090
        var doc = cursor._nextObject();                                                                               // 1091
      } catch (err) {                                                                                                 //
        // There's no good way to figure out if this was actually an error                                            //
        // from Mongo. Ah well. But either way, we need to retry the cursor                                           //
        // (unless the failure was because the observe got stopped).                                                  //
        doc = null;                                                                                                   // 1096
      }                                                                                                               //
      // Since cursor._nextObject can yield, we need to check again to see if                                         //
      // we've been stopped before calling the callback.                                                              //
      if (stopped) return;                                                                                            // 1087
      if (doc) {                                                                                                      // 1102
        // If a tailable cursor contains a "ts" field, use it to recreate the                                         //
        // cursor on error. ("ts" is a standard that Mongo uses internally for                                        //
        // the oplog, and there's a special flag that lets you do binary search                                       //
        // on it instead of needing to use an index.)                                                                 //
        lastTS = doc.ts;                                                                                              // 1107
        docCallback(doc);                                                                                             // 1108
      } else {                                                                                                        //
        var newSelector = _.clone(cursorDescription.selector);                                                        // 1110
        if (lastTS) {                                                                                                 // 1111
          newSelector.ts = { $gt: lastTS };                                                                           // 1112
        }                                                                                                             //
        cursor = self._createSynchronousCursor(new CursorDescription(cursorDescription.collectionName, newSelector, cursorDescription.options));
        // Mongo failover takes many seconds.  Retry in a bit.  (Without this                                         //
        // setTimeout, we peg the CPU at 100% and never notice the actual                                             //
        // failover.                                                                                                  //
        Meteor.setTimeout(loop, 100);                                                                                 // 1109
        break;                                                                                                        // 1122
      }                                                                                                               //
    }                                                                                                                 //
  };                                                                                                                  //
                                                                                                                      //
  Meteor.defer(loop);                                                                                                 // 1127
                                                                                                                      //
  return {                                                                                                            // 1129
    stop: function () {                                                                                               // 1130
      function stop() {                                                                                               // 1130
        stopped = true;                                                                                               // 1131
        cursor.close();                                                                                               // 1132
      }                                                                                                               //
                                                                                                                      //
      return stop;                                                                                                    //
    }()                                                                                                               //
  };                                                                                                                  //
};                                                                                                                    //
                                                                                                                      //
MongoConnection.prototype._observeChanges = function (cursorDescription, ordered, callbacks) {                        // 1137
  var self = this;                                                                                                    // 1139
                                                                                                                      //
  if (cursorDescription.options.tailable) {                                                                           // 1141
    return self._observeChangesTailable(cursorDescription, ordered, callbacks);                                       // 1142
  }                                                                                                                   //
                                                                                                                      //
  // You may not filter out _id when observing changes, because the id is a core                                      //
  // part of the observeChanges API.                                                                                  //
  if (cursorDescription.options.fields && (cursorDescription.options.fields._id === 0 || cursorDescription.options.fields._id === false)) {
    throw Error("You may not observe a cursor with {fields: {_id: 0}}");                                              // 1150
  }                                                                                                                   //
                                                                                                                      //
  var observeKey = JSON.stringify(_.extend({ ordered: ordered }, cursorDescription));                                 // 1153
                                                                                                                      //
  var multiplexer, observeDriver;                                                                                     // 1156
  var firstHandle = false;                                                                                            // 1157
                                                                                                                      //
  // Find a matching ObserveMultiplexer, or create a new one. This next block is                                      //
  // guaranteed to not yield (and it doesn't call anything that can observe a                                         //
  // new query), so no other calls to this function can interleave with it.                                           //
  Meteor._noYieldsAllowed(function () {                                                                               // 1138
    if (_.has(self._observeMultiplexers, observeKey)) {                                                               // 1163
      multiplexer = self._observeMultiplexers[observeKey];                                                            // 1164
    } else {                                                                                                          //
      firstHandle = true;                                                                                             // 1166
      // Create a new ObserveMultiplexer.                                                                             //
      multiplexer = new ObserveMultiplexer({                                                                          // 1165
        ordered: ordered,                                                                                             // 1169
        onStop: function () {                                                                                         // 1170
          function onStop() {                                                                                         // 1170
            delete self._observeMultiplexers[observeKey];                                                             // 1171
            observeDriver.stop();                                                                                     // 1172
          }                                                                                                           //
                                                                                                                      //
          return onStop;                                                                                              //
        }()                                                                                                           //
      });                                                                                                             //
      self._observeMultiplexers[observeKey] = multiplexer;                                                            // 1175
    }                                                                                                                 //
  });                                                                                                                 //
                                                                                                                      //
  var observeHandle = new ObserveHandle(multiplexer, callbacks);                                                      // 1179
                                                                                                                      //
  if (firstHandle) {                                                                                                  // 1181
    var matcher, sorter;                                                                                              // 1182
    var canUseOplog = _.all([function () {                                                                            // 1183
      // At a bare minimum, using the oplog requires us to have an oplog, to                                          //
      // want unordered callbacks, and to not want a callback on the polls                                            //
      // that won't happen.                                                                                           //
      return self._oplogHandle && !ordered && !callbacks._testOnlyPollCallback;                                       // 1188
    }, function () {                                                                                                  //
      // We need to be able to compile the selector. Fall back to polling for                                         //
      // some newfangled $selector that minimongo doesn't support yet.                                                //
      try {                                                                                                           // 1193
        matcher = new Minimongo.Matcher(cursorDescription.selector);                                                  // 1194
        return true;                                                                                                  // 1195
      } catch (e) {                                                                                                   //
        // XXX make all compilation errors MinimongoError or something                                                //
        //     so that this doesn't ignore unrelated exceptions                                                       //
        return false;                                                                                                 // 1199
      }                                                                                                               //
    }, function () {                                                                                                  //
      // ... and the selector itself needs to support oplog.                                                          //
      return OplogObserveDriver.cursorSupported(cursorDescription, matcher);                                          // 1203
    }, function () {                                                                                                  //
      // And we need to be able to compile the sort, if any.  eg, can't be                                            //
      // {$natural: 1}.                                                                                               //
      if (!cursorDescription.options.sort) return true;                                                               // 1207
      try {                                                                                                           // 1209
        sorter = new Minimongo.Sorter(cursorDescription.options.sort, { matcher: matcher });                          // 1210
        return true;                                                                                                  // 1212
      } catch (e) {                                                                                                   //
        // XXX make all compilation errors MinimongoError or something                                                //
        //     so that this doesn't ignore unrelated exceptions                                                       //
        return false;                                                                                                 // 1216
      }                                                                                                               //
    }], function (f) {                                                                                                //
      return f();                                                                                                     // 1218
    }); // invoke each function                                                                                       //
                                                                                                                      //
    var driverClass = canUseOplog ? OplogObserveDriver : PollingObserveDriver;                                        // 1181
    observeDriver = new driverClass({                                                                                 // 1221
      cursorDescription: cursorDescription,                                                                           // 1222
      mongoHandle: self,                                                                                              // 1223
      multiplexer: multiplexer,                                                                                       // 1224
      ordered: ordered,                                                                                               // 1225
      matcher: matcher, // ignored by polling                                                                         // 1226
      sorter: sorter, // ignored by polling                                                                           // 1227
      _testOnlyPollCallback: callbacks._testOnlyPollCallback                                                          // 1228
    });                                                                                                               //
                                                                                                                      //
    // This field is only set for use in tests.                                                                       //
    multiplexer._observeDriver = observeDriver;                                                                       // 1181
  }                                                                                                                   //
                                                                                                                      //
  // Blocks until the initial adds have been sent.                                                                    //
  multiplexer.addHandleAndSendInitialAdds(observeHandle);                                                             // 1138
                                                                                                                      //
  return observeHandle;                                                                                               // 1238
};                                                                                                                    //
                                                                                                                      //
// Listen for the invalidation messages that will trigger us to poll the                                              //
// database for changes. If this selector specifies specific IDs, specify them                                        //
// here, so that updates to different specific IDs don't cause us to poll.                                            //
// listenCallback is the same kind of (notification, complete) callback passed                                        //
// to InvalidationCrossbar.listen.                                                                                    //
                                                                                                                      //
listenAll = function listenAll(cursorDescription, listenCallback) {                                                   // 1247
  var listeners = [];                                                                                                 // 1248
  forEachTrigger(cursorDescription, function (trigger) {                                                              // 1249
    listeners.push(DDPServer._InvalidationCrossbar.listen(trigger, listenCallback));                                  // 1250
  });                                                                                                                 //
                                                                                                                      //
  return {                                                                                                            // 1254
    stop: function () {                                                                                               // 1255
      function stop() {                                                                                               // 1255
        _.each(listeners, function (listener) {                                                                       // 1256
          listener.stop();                                                                                            // 1257
        });                                                                                                           //
      }                                                                                                               //
                                                                                                                      //
      return stop;                                                                                                    //
    }()                                                                                                               //
  };                                                                                                                  //
};                                                                                                                    //
                                                                                                                      //
forEachTrigger = function forEachTrigger(cursorDescription, triggerCallback) {                                        // 1263
  var key = { collection: cursorDescription.collectionName };                                                         // 1264
  var specificIds = LocalCollection._idsMatchedBySelector(cursorDescription.selector);                                // 1265
  if (specificIds) {                                                                                                  // 1267
    _.each(specificIds, function (id) {                                                                               // 1268
      triggerCallback(_.extend({ id: id }, key));                                                                     // 1269
    });                                                                                                               //
    triggerCallback(_.extend({ dropCollection: true, id: null }, key));                                               // 1271
  } else {                                                                                                            //
    triggerCallback(key);                                                                                             // 1273
  }                                                                                                                   //
  // Everyone cares about the database being dropped.                                                                 //
  triggerCallback({ dropDatabase: true });                                                                            // 1263
};                                                                                                                    //
                                                                                                                      //
// observeChanges for tailable cursors on capped collections.                                                         //
//                                                                                                                    //
// Some differences from normal cursors:                                                                              //
//   - Will never produce anything other than 'added' or 'addedBefore'. If you                                        //
//     do update a document that has already been produced, this will not notice                                      //
//     it.                                                                                                            //
//   - If you disconnect and reconnect from Mongo, it will essentially restart                                        //
//     the query, which will lead to duplicate results. This is pretty bad,                                           //
//     but if you include a field called 'ts' which is inserted as                                                    //
//     new MongoInternals.MongoTimestamp(0, 0) (which is initialized to the                                           //
//     current Mongo-style timestamp), we'll be able to find the place to                                             //
//     restart properly. (This field is specifically understood by Mongo with an                                      //
//     optimization which allows it to find the right place to start without                                          //
//     an index on ts. It's how the oplog works.)                                                                     //
//   - No callbacks are triggered synchronously with the call (there's no                                             //
//     differentiation between "initial data" and "later changes"; everything                                         //
//     that matches the query gets sent asynchronously).                                                              //
//   - De-duplication is not implemented.                                                                             //
//   - Does not yet interact with the write fence. Probably, this should work by                                      //
//     ignoring removes (which don't work on capped collections) and updates                                          //
//     (which don't affect tailable cursors), and just keeping track of the ID                                        //
//     of the inserted object, and closing the write fence once you get to that                                       //
//     ID (or timestamp?).  This doesn't work well if the document doesn't match                                      //
//     the query, though.  On the other hand, the write fence can close                                               //
//     immediately if it does not match the query. So if we trust minimongo                                           //
//     enough to accurately evaluate the query against the write fence, we                                            //
//     should be able to do this...  Of course, minimongo doesn't even support                                        //
//     Mongo Timestamps yet.                                                                                          //
MongoConnection.prototype._observeChangesTailable = function (cursorDescription, ordered, callbacks) {                // 1307
  var self = this;                                                                                                    // 1309
                                                                                                                      //
  // Tailable cursors only ever call added/addedBefore callbacks, so it's an                                          //
  // error if you didn't provide them.                                                                                //
  if (ordered && !callbacks.addedBefore || !ordered && !callbacks.added) {                                            // 1308
    throw new Error("Can't observe an " + (ordered ? "ordered" : "unordered") + " tailable cursor without a " + (ordered ? "addedBefore" : "added") + " callback");
  }                                                                                                                   //
                                                                                                                      //
  return self.tail(cursorDescription, function (doc) {                                                                // 1320
    var id = doc._id;                                                                                                 // 1321
    delete doc._id;                                                                                                   // 1322
    // The ts is an implementation detail. Hide it.                                                                   //
    delete doc.ts;                                                                                                    // 1320
    if (ordered) {                                                                                                    // 1325
      callbacks.addedBefore(id, doc, null);                                                                           // 1326
    } else {                                                                                                          //
      callbacks.added(id, doc);                                                                                       // 1328
    }                                                                                                                 //
  });                                                                                                                 //
};                                                                                                                    //
                                                                                                                      //
// XXX We probably need to find a better way to expose this. Right now                                                //
// it's only used by tests, but in fact you need it in normal                                                         //
// operation to interact with capped collections.                                                                     //
MongoInternals.MongoTimestamp = MongoDB.Timestamp;                                                                    // 1336
                                                                                                                      //
MongoInternals.Connection = MongoConnection;                                                                          // 1338
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}],"oplog_tailing.js":function(require){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/mongo/oplog_tailing.js                                                                                    //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
var Future = Npm.require('fibers/future');                                                                            // 1
                                                                                                                      //
OPLOG_COLLECTION = 'oplog.rs';                                                                                        // 3
                                                                                                                      //
var TOO_FAR_BEHIND = process.env.METEOR_OPLOG_TOO_FAR_BEHIND || 2000;                                                 // 5
                                                                                                                      //
var showTS = function showTS(ts) {                                                                                    // 7
  return "Timestamp(" + ts.getHighBits() + ", " + ts.getLowBits() + ")";                                              // 8
};                                                                                                                    //
                                                                                                                      //
idForOp = function idForOp(op) {                                                                                      // 11
  if (op.op === 'd') return op.o._id;else if (op.op === 'i') return op.o._id;else if (op.op === 'u') return op.o2._id;else if (op.op === 'c') throw Error("Operator 'c' doesn't supply an object with id: " + EJSON.stringify(op));else throw Error("Unknown op: " + EJSON.stringify(op));
};                                                                                                                    //
                                                                                                                      //
OplogHandle = function OplogHandle(oplogUrl, dbName) {                                                                // 25
  var self = this;                                                                                                    // 26
  self._oplogUrl = oplogUrl;                                                                                          // 27
  self._dbName = dbName;                                                                                              // 28
                                                                                                                      //
  self._oplogLastEntryConnection = null;                                                                              // 30
  self._oplogTailConnection = null;                                                                                   // 31
  self._stopped = false;                                                                                              // 32
  self._tailHandle = null;                                                                                            // 33
  self._readyFuture = new Future();                                                                                   // 34
  self._crossbar = new DDPServer._Crossbar({                                                                          // 35
    factPackage: "mongo-livedata", factName: "oplog-watchers"                                                         // 36
  });                                                                                                                 //
  self._baseOplogSelector = {                                                                                         // 38
    ns: new RegExp('^' + Meteor._escapeRegExp(self._dbName) + '\\.'),                                                 // 39
    $or: [{ op: { $in: ['i', 'u', 'd'] } },                                                                           // 40
    // drop collection                                                                                                //
    { op: 'c', 'o.drop': { $exists: true } }, { op: 'c', 'o.dropDatabase': 1 }]                                       // 43
  };                                                                                                                  //
                                                                                                                      //
  // Data structures to support waitUntilCaughtUp(). Each oplog entry has a                                           //
  // MongoTimestamp object on it (which is not the same as a Date --- it's a                                          //
  // combination of time and an incrementing counter; see                                                             //
  // http://docs.mongodb.org/manual/reference/bson-types/#timestamps).                                                //
  //                                                                                                                  //
  // _catchingUpFutures is an array of {ts: MongoTimestamp, future: Future}                                           //
  // objects, sorted by ascending timestamp. _lastProcessedTS is the                                                  //
  // MongoTimestamp of the last oplog entry we've processed.                                                          //
  //                                                                                                                  //
  // Each time we call waitUntilCaughtUp, we take a peek at the final oplog                                           //
  // entry in the db.  If we've already processed it (ie, it is not greater than                                      //
  // _lastProcessedTS), waitUntilCaughtUp immediately returns. Otherwise,                                             //
  // waitUntilCaughtUp makes a new Future and inserts it along with the final                                         //
  // timestamp entry that it read, into _catchingUpFutures. waitUntilCaughtUp                                         //
  // then waits on that future, which is resolved once _lastProcessedTS is                                            //
  // incremented to be past its timestamp by the worker fiber.                                                        //
  //                                                                                                                  //
  // XXX use a priority queue or something else that's faster than an array                                           //
  self._catchingUpFutures = [];                                                                                       // 25
  self._lastProcessedTS = null;                                                                                       // 67
                                                                                                                      //
  self._onSkippedEntriesHook = new Hook({                                                                             // 69
    debugPrintExceptions: "onSkippedEntries callback"                                                                 // 70
  });                                                                                                                 //
                                                                                                                      //
  self._entryQueue = new Meteor._DoubleEndedQueue();                                                                  // 73
  self._workerActive = false;                                                                                         // 74
                                                                                                                      //
  self._startTailing();                                                                                               // 76
};                                                                                                                    //
                                                                                                                      //
_.extend(OplogHandle.prototype, {                                                                                     // 79
  stop: function () {                                                                                                 // 80
    function stop() {                                                                                                 // 80
      var self = this;                                                                                                // 81
      if (self._stopped) return;                                                                                      // 82
      self._stopped = true;                                                                                           // 84
      if (self._tailHandle) self._tailHandle.stop();                                                                  // 85
      // XXX should close connections too                                                                             //
    }                                                                                                                 // 80
                                                                                                                      //
    return stop;                                                                                                      //
  }(),                                                                                                                //
  onOplogEntry: function () {                                                                                         // 89
    function onOplogEntry(trigger, callback) {                                                                        // 89
      var self = this;                                                                                                // 90
      if (self._stopped) throw new Error("Called onOplogEntry on stopped handle!");                                   // 91
                                                                                                                      //
      // Calling onOplogEntry requires us to wait for the tailing to be ready.                                        //
      self._readyFuture.wait();                                                                                       // 89
                                                                                                                      //
      var originalCallback = callback;                                                                                // 97
      callback = Meteor.bindEnvironment(function (notification) {                                                     // 98
        // XXX can we avoid this clone by making oplog.js careful?                                                    //
        originalCallback(EJSON.clone(notification));                                                                  // 100
      }, function (err) {                                                                                             //
        Meteor._debug("Error in oplog callback", err.stack);                                                          // 102
      });                                                                                                             //
      var listenHandle = self._crossbar.listen(trigger, callback);                                                    // 104
      return {                                                                                                        // 105
        stop: function () {                                                                                           // 106
          function stop() {                                                                                           // 106
            listenHandle.stop();                                                                                      // 107
          }                                                                                                           //
                                                                                                                      //
          return stop;                                                                                                //
        }()                                                                                                           //
      };                                                                                                              //
    }                                                                                                                 //
                                                                                                                      //
    return onOplogEntry;                                                                                              //
  }(),                                                                                                                //
  // Register a callback to be invoked any time we skip oplog entries (eg,                                            //
  // because we are too far behind).                                                                                  //
  onSkippedEntries: function () {                                                                                     // 113
    function onSkippedEntries(callback) {                                                                             // 113
      var self = this;                                                                                                // 114
      if (self._stopped) throw new Error("Called onSkippedEntries on stopped handle!");                               // 115
      return self._onSkippedEntriesHook.register(callback);                                                           // 117
    }                                                                                                                 //
                                                                                                                      //
    return onSkippedEntries;                                                                                          //
  }(),                                                                                                                //
  // Calls `callback` once the oplog has been processed up to a point that is                                         //
  // roughly "now": specifically, once we've processed all ops that are                                               //
  // currently visible.                                                                                               //
  // XXX become convinced that this is actually safe even if oplogConnection                                          //
  // is some kind of pool                                                                                             //
  waitUntilCaughtUp: function () {                                                                                    // 124
    function waitUntilCaughtUp() {                                                                                    // 124
      var self = this;                                                                                                // 125
      if (self._stopped) throw new Error("Called waitUntilCaughtUp on stopped handle!");                              // 126
                                                                                                                      //
      // Calling waitUntilCaughtUp requries us to wait for the oplog connection to                                    //
      // be ready.                                                                                                    //
      self._readyFuture.wait();                                                                                       // 124
                                                                                                                      //
      while (!self._stopped) {                                                                                        // 133
        // We need to make the selector at least as restrictive as the actual                                         //
        // tailing selector (ie, we need to specify the DB name) or else we might                                     //
        // find a TS that won't show up in the actual tail stream.                                                    //
        try {                                                                                                         // 137
          var lastEntry = self._oplogLastEntryConnection.findOne(OPLOG_COLLECTION, self._baseOplogSelector, { fields: { ts: 1 }, sort: { $natural: -1 } });
          break;                                                                                                      // 141
        } catch (e) {                                                                                                 //
          // During failover (eg) if we get an exception we should log and retry                                      //
          // instead of crashing.                                                                                     //
          Meteor._debug("Got exception while reading last entry: " + e);                                              // 145
          Meteor._sleepForMs(100);                                                                                    // 146
        }                                                                                                             //
      }                                                                                                               //
                                                                                                                      //
      if (self._stopped) return;                                                                                      // 150
                                                                                                                      //
      if (!lastEntry) {                                                                                               // 153
        // Really, nothing in the oplog? Well, we've processed everything.                                            //
        return;                                                                                                       // 155
      }                                                                                                               //
                                                                                                                      //
      var ts = lastEntry.ts;                                                                                          // 158
      if (!ts) throw Error("oplog entry without ts: " + EJSON.stringify(lastEntry));                                  // 159
                                                                                                                      //
      if (self._lastProcessedTS && ts.lessThanOrEqual(self._lastProcessedTS)) {                                       // 162
        // We've already caught up to here.                                                                           //
        return;                                                                                                       // 164
      }                                                                                                               //
                                                                                                                      //
      // Insert the future into our list. Almost always, this will be at the end,                                     //
      // but it's conceivable that if we fail over from one primary to another,                                       //
      // the oplog entries we see will go backwards.                                                                  //
      var insertAfter = self._catchingUpFutures.length;                                                               // 124
      while (insertAfter - 1 > 0 && self._catchingUpFutures[insertAfter - 1].ts.greaterThan(ts)) {                    // 172
        insertAfter--;                                                                                                // 174
      }                                                                                                               //
      var f = new Future();                                                                                           // 176
      self._catchingUpFutures.splice(insertAfter, 0, { ts: ts, future: f });                                          // 177
      f.wait();                                                                                                       // 178
    }                                                                                                                 //
                                                                                                                      //
    return waitUntilCaughtUp;                                                                                         //
  }(),                                                                                                                //
  _startTailing: function () {                                                                                        // 180
    function _startTailing() {                                                                                        // 180
      var self = this;                                                                                                // 181
      // First, make sure that we're talking to the local database.                                                   //
      var mongodbUri = Npm.require('mongodb-uri');                                                                    // 180
      if (mongodbUri.parse(self._oplogUrl).database !== 'local') {                                                    // 184
        throw Error("$MONGO_OPLOG_URL must be set to the 'local' database of " + "a Mongo replica set");              // 185
      }                                                                                                               //
                                                                                                                      //
      // We make two separate connections to Mongo. The Node Mongo driver                                             //
      // implements a naive round-robin connection pool: each "connection" is a                                       //
      // pool of several (5 by default) TCP connections, and each request is                                          //
      // rotated through the pools. Tailable cursor queries block on the server                                       //
      // until there is some data to return (or until a few seconds have                                              //
      // passed). So if the connection pool used for tailing cursors is the same                                      //
      // pool used for other queries, the other queries will be delayed by seconds                                    //
      // 1/5 of the time.                                                                                             //
      //                                                                                                              //
      // The tail connection will only ever be running a single tail command, so                                      //
      // it only needs to make one underlying TCP connection.                                                         //
      self._oplogTailConnection = new MongoConnection(self._oplogUrl, { poolSize: 1 });                               // 180
      // XXX better docs, but: it's to get monotonic results                                                          //
      // XXX is it safe to say "if there's an in flight query, just use its                                           //
      //     results"? I don't think so but should consider that                                                      //
      self._oplogLastEntryConnection = new MongoConnection(self._oplogUrl, { poolSize: 1 });                          // 180
                                                                                                                      //
      // Now, make sure that there actually is a repl set here. If not, oplog                                         //
      // tailing won't ever find anything!                                                                            //
      var f = new Future();                                                                                           // 180
      self._oplogLastEntryConnection.db.admin().command({ ismaster: 1 }, f.resolver());                               // 211
      var isMasterDoc = f.wait();                                                                                     // 213
      if (!(isMasterDoc && isMasterDoc.documents && isMasterDoc.documents[0] && isMasterDoc.documents[0].setName)) {  // 214
        throw Error("$MONGO_OPLOG_URL must be set to the 'local' database of " + "a Mongo replica set");              // 216
      }                                                                                                               //
                                                                                                                      //
      // Find the last oplog entry.                                                                                   //
      var lastOplogEntry = self._oplogLastEntryConnection.findOne(OPLOG_COLLECTION, {}, { sort: { $natural: -1 }, fields: { ts: 1 } });
                                                                                                                      //
      var oplogSelector = _.clone(self._baseOplogSelector);                                                           // 224
      if (lastOplogEntry) {                                                                                           // 225
        // Start after the last entry that currently exists.                                                          //
        oplogSelector.ts = { $gt: lastOplogEntry.ts };                                                                // 227
        // If there are any calls to callWhenProcessedLatest before any other                                         //
        // oplog entries show up, allow callWhenProcessedLatest to call its                                           //
        // callback immediately.                                                                                      //
        self._lastProcessedTS = lastOplogEntry.ts;                                                                    // 225
      }                                                                                                               //
                                                                                                                      //
      var cursorDescription = new CursorDescription(OPLOG_COLLECTION, oplogSelector, { tailable: true });             // 234
                                                                                                                      //
      self._tailHandle = self._oplogTailConnection.tail(cursorDescription, function (doc) {                           // 237
        self._entryQueue.push(doc);                                                                                   // 239
        self._maybeStartWorker();                                                                                     // 240
      });                                                                                                             //
      self._readyFuture['return']();                                                                                  // 243
    }                                                                                                                 //
                                                                                                                      //
    return _startTailing;                                                                                             //
  }(),                                                                                                                //
                                                                                                                      //
  _maybeStartWorker: function () {                                                                                    // 246
    function _maybeStartWorker() {                                                                                    // 246
      var self = this;                                                                                                // 247
      if (self._workerActive) return;                                                                                 // 248
      self._workerActive = true;                                                                                      // 250
      Meteor.defer(function () {                                                                                      // 251
        try {                                                                                                         // 252
          while (!self._stopped && !self._entryQueue.isEmpty()) {                                                     // 253
            // Are we too far behind? Just tell our observers that they need to                                       //
            // repoll, and drop our queue.                                                                            //
            if (self._entryQueue.length > TOO_FAR_BEHIND) {                                                           // 256
              var lastEntry = self._entryQueue.pop();                                                                 // 257
              self._entryQueue.clear();                                                                               // 258
                                                                                                                      //
              self._onSkippedEntriesHook.each(function (callback) {                                                   // 260
                callback();                                                                                           // 261
                return true;                                                                                          // 262
              });                                                                                                     //
                                                                                                                      //
              // Free any waitUntilCaughtUp() calls that were waiting for us to                                       //
              // pass something that we just skipped.                                                                 //
              self._setLastProcessedTS(lastEntry.ts);                                                                 // 256
              continue;                                                                                               // 268
            }                                                                                                         //
                                                                                                                      //
            var doc = self._entryQueue.shift();                                                                       // 271
                                                                                                                      //
            if (!(doc.ns && doc.ns.length > self._dbName.length + 1 && doc.ns.substr(0, self._dbName.length + 1) === self._dbName + '.')) {
              throw new Error("Unexpected ns");                                                                       // 276
            }                                                                                                         //
                                                                                                                      //
            var trigger = { collection: doc.ns.substr(self._dbName.length + 1),                                       // 279
              dropCollection: false,                                                                                  // 280
              dropDatabase: false,                                                                                    // 281
              op: doc };                                                                                              // 282
                                                                                                                      //
            // Is it a special command and the collection name is hidden somewhere                                    //
            // in operator?                                                                                           //
            if (trigger.collection === "$cmd") {                                                                      // 253
              if (doc.o.dropDatabase) {                                                                               // 287
                delete trigger.collection;                                                                            // 288
                trigger.dropDatabase = true;                                                                          // 289
              } else if (_.has(doc.o, 'drop')) {                                                                      //
                trigger.collection = doc.o.drop;                                                                      // 291
                trigger.dropCollection = true;                                                                        // 292
                trigger.id = null;                                                                                    // 293
              } else {                                                                                                //
                throw Error("Unknown command " + JSON.stringify(doc));                                                // 295
              }                                                                                                       //
            } else {                                                                                                  //
              // All other ops have an id.                                                                            //
              trigger.id = idForOp(doc);                                                                              // 299
            }                                                                                                         //
                                                                                                                      //
            self._crossbar.fire(trigger);                                                                             // 302
                                                                                                                      //
            // Now that we've processed this operation, process pending                                               //
            // sequencers.                                                                                            //
            if (!doc.ts) throw Error("oplog entry without ts: " + EJSON.stringify(doc));                              // 253
            self._setLastProcessedTS(doc.ts);                                                                         // 308
          }                                                                                                           //
        } finally {                                                                                                   //
          self._workerActive = false;                                                                                 // 311
        }                                                                                                             //
      });                                                                                                             //
    }                                                                                                                 //
                                                                                                                      //
    return _maybeStartWorker;                                                                                         //
  }(),                                                                                                                //
  _setLastProcessedTS: function () {                                                                                  // 315
    function _setLastProcessedTS(ts) {                                                                                // 315
      var self = this;                                                                                                // 316
      self._lastProcessedTS = ts;                                                                                     // 317
      while (!_.isEmpty(self._catchingUpFutures) && self._catchingUpFutures[0].ts.lessThanOrEqual(self._lastProcessedTS)) {
        var sequencer = self._catchingUpFutures.shift();                                                              // 321
        sequencer.future['return']();                                                                                 // 322
      }                                                                                                               //
    }                                                                                                                 //
                                                                                                                      //
    return _setLastProcessedTS;                                                                                       //
  }()                                                                                                                 //
});                                                                                                                   //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"observe_multiplex.js":function(require){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/mongo/observe_multiplex.js                                                                                //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
var Future = Npm.require('fibers/future');                                                                            // 1
                                                                                                                      //
ObserveMultiplexer = function ObserveMultiplexer(options) {                                                           // 3
  var self = this;                                                                                                    // 4
                                                                                                                      //
  if (!options || !_.has(options, 'ordered')) throw Error("must specified ordered");                                  // 6
                                                                                                                      //
  Package.facts && Package.facts.Facts.incrementServerFact("mongo-livedata", "observe-multiplexers", 1);              // 9
                                                                                                                      //
  self._ordered = options.ordered;                                                                                    // 12
  self._onStop = options.onStop || function () {};                                                                    // 13
  self._queue = new Meteor._SynchronousQueue();                                                                       // 14
  self._handles = {};                                                                                                 // 15
  self._readyFuture = new Future();                                                                                   // 16
  self._cache = new LocalCollection._CachingChangeObserver({                                                          // 17
    ordered: options.ordered });                                                                                      // 18
  // Number of addHandleAndSendInitialAdds tasks scheduled but not yet                                                //
  // running. removeHandle uses this to know if it's time to call the onStop                                          //
  // callback.                                                                                                        //
  self._addHandleTasksScheduledButNotPerformed = 0;                                                                   // 3
                                                                                                                      //
  _.each(self.callbackNames(), function (callbackName) {                                                              // 24
    self[callbackName] = function () /* ... */{                                                                       // 25
      self._applyCallback(callbackName, _.toArray(arguments));                                                        // 26
    };                                                                                                                //
  });                                                                                                                 //
};                                                                                                                    //
                                                                                                                      //
_.extend(ObserveMultiplexer.prototype, {                                                                              // 31
  addHandleAndSendInitialAdds: function () {                                                                          // 32
    function addHandleAndSendInitialAdds(handle) {                                                                    // 32
      var self = this;                                                                                                // 33
                                                                                                                      //
      // Check this before calling runTask (even though runTask does the same                                         //
      // check) so that we don't leak an ObserveMultiplexer on error by                                               //
      // incrementing _addHandleTasksScheduledButNotPerformed and never                                               //
      // decrementing it.                                                                                             //
      if (!self._queue.safeToRunTask()) throw new Error("Can't call observeChanges from an observe callback on the same query");
      ++self._addHandleTasksScheduledButNotPerformed;                                                                 // 42
                                                                                                                      //
      Package.facts && Package.facts.Facts.incrementServerFact("mongo-livedata", "observe-handles", 1);               // 44
                                                                                                                      //
      self._queue.runTask(function () {                                                                               // 47
        self._handles[handle._id] = handle;                                                                           // 48
        // Send out whatever adds we have so far (whether or not we the                                               //
        // multiplexer is ready).                                                                                     //
        self._sendAdds(handle);                                                                                       // 47
        --self._addHandleTasksScheduledButNotPerformed;                                                               // 52
      });                                                                                                             //
      // *outside* the task, since otherwise we'd deadlock                                                            //
      self._readyFuture.wait();                                                                                       // 32
    }                                                                                                                 //
                                                                                                                      //
    return addHandleAndSendInitialAdds;                                                                               //
  }(),                                                                                                                //
                                                                                                                      //
  // Remove an observe handle. If it was the last observe handle, call the                                            //
  // onStop callback; you cannot add any more observe handles after this.                                             //
  //                                                                                                                  //
  // This is not synchronized with polls and handle additions: this means that                                        //
  // you can safely call it from within an observe callback, but it also means                                        //
  // that we have to be careful when we iterate over _handles.                                                        //
  removeHandle: function () {                                                                                         // 64
    function removeHandle(id) {                                                                                       // 64
      var self = this;                                                                                                // 65
                                                                                                                      //
      // This should not be possible: you can only call removeHandle by having                                        //
      // access to the ObserveHandle, which isn't returned to user code until the                                     //
      // multiplex is ready.                                                                                          //
      if (!self._ready()) throw new Error("Can't remove handles until the multiplex is ready");                       // 64
                                                                                                                      //
      delete self._handles[id];                                                                                       // 73
                                                                                                                      //
      Package.facts && Package.facts.Facts.incrementServerFact("mongo-livedata", "observe-handles", -1);              // 75
                                                                                                                      //
      if (_.isEmpty(self._handles) && self._addHandleTasksScheduledButNotPerformed === 0) {                           // 78
        self._stop();                                                                                                 // 80
      }                                                                                                               //
    }                                                                                                                 //
                                                                                                                      //
    return removeHandle;                                                                                              //
  }(),                                                                                                                //
  _stop: function () {                                                                                                // 83
    function _stop(options) {                                                                                         // 83
      var self = this;                                                                                                // 84
      options = options || {};                                                                                        // 85
                                                                                                                      //
      // It shouldn't be possible for us to stop when all our handles still                                           //
      // haven't been returned from observeChanges!                                                                   //
      if (!self._ready() && !options.fromQueryError) throw Error("surprising _stop: not ready");                      // 83
                                                                                                                      //
      // Call stop callback (which kills the underlying process which sends us                                        //
      // callbacks and removes us from the connection's dictionary).                                                  //
      self._onStop();                                                                                                 // 83
      Package.facts && Package.facts.Facts.incrementServerFact("mongo-livedata", "observe-multiplexers", -1);         // 95
                                                                                                                      //
      // Cause future addHandleAndSendInitialAdds calls to throw (but the onStop                                      //
      // callback should make our connection forget about us).                                                        //
      self._handles = null;                                                                                           // 83
    }                                                                                                                 //
                                                                                                                      //
    return _stop;                                                                                                     //
  }(),                                                                                                                //
                                                                                                                      //
  // Allows all addHandleAndSendInitialAdds calls to return, once all preceding                                       //
  // adds have been processed. Does not block.                                                                        //
  ready: function () {                                                                                                // 105
    function ready() {                                                                                                // 105
      var self = this;                                                                                                // 106
      self._queue.queueTask(function () {                                                                             // 107
        if (self._ready()) throw Error("can't make ObserveMultiplex ready twice!");                                   // 108
        self._readyFuture['return']();                                                                                // 110
      });                                                                                                             //
    }                                                                                                                 //
                                                                                                                      //
    return ready;                                                                                                     //
  }(),                                                                                                                //
                                                                                                                      //
  // If trying to execute the query results in an error, call this. This is                                           //
  // intended for permanent errors, not transient network errors that could be                                        //
  // fixed. It should only be called before ready(), because if you called ready                                      //
  // that meant that you managed to run the query once. It will stop this                                             //
  // ObserveMultiplex and cause addHandleAndSendInitialAdds calls (and thus                                           //
  // observeChanges calls) to throw the error.                                                                        //
  queryError: function () {                                                                                           // 120
    function queryError(err) {                                                                                        // 120
      var self = this;                                                                                                // 121
      self._queue.runTask(function () {                                                                               // 122
        if (self._ready()) throw Error("can't claim query has an error after it worked!");                            // 123
        self._stop({ fromQueryError: true });                                                                         // 125
        self._readyFuture['throw'](err);                                                                              // 126
      });                                                                                                             //
    }                                                                                                                 //
                                                                                                                      //
    return queryError;                                                                                                //
  }(),                                                                                                                //
                                                                                                                      //
  // Calls "cb" once the effects of all "ready", "addHandleAndSendInitialAdds"                                        //
  // and observe callbacks which came before this call have been propagated to                                        //
  // all handles. "ready" must have already been called on this multiplexer.                                          //
  onFlush: function () {                                                                                              // 133
    function onFlush(cb) {                                                                                            // 133
      var self = this;                                                                                                // 134
      self._queue.queueTask(function () {                                                                             // 135
        if (!self._ready()) throw Error("only call onFlush on a multiplexer that will be ready");                     // 136
        cb();                                                                                                         // 138
      });                                                                                                             //
    }                                                                                                                 //
                                                                                                                      //
    return onFlush;                                                                                                   //
  }(),                                                                                                                //
  callbackNames: function () {                                                                                        // 141
    function callbackNames() {                                                                                        // 141
      var self = this;                                                                                                // 142
      if (self._ordered) return ["addedBefore", "changed", "movedBefore", "removed"];else return ["added", "changed", "removed"];
    }                                                                                                                 //
                                                                                                                      //
    return callbackNames;                                                                                             //
  }(),                                                                                                                //
  _ready: function () {                                                                                               // 148
    function _ready() {                                                                                               // 148
      return this._readyFuture.isResolved();                                                                          // 149
    }                                                                                                                 //
                                                                                                                      //
    return _ready;                                                                                                    //
  }(),                                                                                                                //
  _applyCallback: function () {                                                                                       // 151
    function _applyCallback(callbackName, args) {                                                                     // 151
      var self = this;                                                                                                // 152
      self._queue.queueTask(function () {                                                                             // 153
        // If we stopped in the meantime, do nothing.                                                                 //
        if (!self._handles) return;                                                                                   // 155
                                                                                                                      //
        // First, apply the change to the cache.                                                                      //
        // XXX We could make applyChange callbacks promise not to hang on to any                                      //
        // state from their arguments (assuming that their supplied callbacks                                         //
        // don't) and skip this clone. Currently 'changed' hangs on to state                                          //
        // though.                                                                                                    //
        self._cache.applyChange[callbackName].apply(null, EJSON.clone(args));                                         // 153
                                                                                                                      //
        // If we haven't finished the initial adds, then we should only be getting                                    //
        // adds.                                                                                                      //
        if (!self._ready() && callbackName !== 'added' && callbackName !== 'addedBefore') {                           // 153
          throw new Error("Got " + callbackName + " during initial adds");                                            // 169
        }                                                                                                             //
                                                                                                                      //
        // Now multiplex the callbacks out to all observe handles. It's OK if                                         //
        // these calls yield; since we're inside a task, no other use of our queue                                    //
        // can continue until these are done. (But we do have to be careful to not                                    //
        // use a handle that got removed, because removeHandle does not use the                                       //
        // queue; thus, we iterate over an array of keys that we control.)                                            //
        _.each(_.keys(self._handles), function (handleId) {                                                           // 153
          var handle = self._handles && self._handles[handleId];                                                      // 178
          if (!handle) return;                                                                                        // 179
          var callback = handle['_' + callbackName];                                                                  // 181
          // clone arguments so that callbacks can mutate their arguments                                             //
          callback && callback.apply(null, EJSON.clone(args));                                                        // 177
        });                                                                                                           //
      });                                                                                                             //
    }                                                                                                                 //
                                                                                                                      //
    return _applyCallback;                                                                                            //
  }(),                                                                                                                //
                                                                                                                      //
  // Sends initial adds to a handle. It should only be called from within a task                                      //
  // (the task that is processing the addHandleAndSendInitialAdds call). It                                           //
  // synchronously invokes the handle's added or addedBefore; there's no need to                                      //
  // flush the queue afterwards to ensure that the callbacks get out.                                                 //
  _sendAdds: function () {                                                                                            // 192
    function _sendAdds(handle) {                                                                                      // 192
      var self = this;                                                                                                // 193
      if (self._queue.safeToRunTask()) throw Error("_sendAdds may only be called from within a task!");               // 194
      var add = self._ordered ? handle._addedBefore : handle._added;                                                  // 196
      if (!add) return;                                                                                               // 197
      // note: docs may be an _IdMap or an OrderedDict                                                                //
      self._cache.docs.forEach(function (doc, id) {                                                                   // 192
        if (!_.has(self._handles, handle._id)) throw Error("handle got removed before sending initial adds!");        // 201
        var fields = EJSON.clone(doc);                                                                                // 203
        delete fields._id;                                                                                            // 204
        if (self._ordered) add(id, fields, null); // we're going in order, so add at end                              // 205
        else add(id, fields);                                                                                         // 205
      });                                                                                                             //
    }                                                                                                                 //
                                                                                                                      //
    return _sendAdds;                                                                                                 //
  }()                                                                                                                 //
});                                                                                                                   //
                                                                                                                      //
var nextObserveHandleId = 1;                                                                                          // 214
ObserveHandle = function ObserveHandle(multiplexer, callbacks) {                                                      // 215
  var self = this;                                                                                                    // 216
  // The end user is only supposed to call stop().  The other fields are                                              //
  // accessible to the multiplexer, though.                                                                           //
  self._multiplexer = multiplexer;                                                                                    // 215
  _.each(multiplexer.callbackNames(), function (name) {                                                               // 220
    if (callbacks[name]) {                                                                                            // 221
      self['_' + name] = callbacks[name];                                                                             // 222
    } else if (name === "addedBefore" && callbacks.added) {                                                           //
      // Special case: if you specify "added" and "movedBefore", you get an                                           //
      // ordered observe where for some reason you don't get ordering data on                                         //
      // the adds.  I dunno, we wrote tests for it, there must have been a                                            //
      // reason.                                                                                                      //
      self._addedBefore = function (id, fields, before) {                                                             // 228
        callbacks.added(id, fields);                                                                                  // 229
      };                                                                                                              //
    }                                                                                                                 //
  });                                                                                                                 //
  self._stopped = false;                                                                                              // 233
  self._id = nextObserveHandleId++;                                                                                   // 234
};                                                                                                                    //
ObserveHandle.prototype.stop = function () {                                                                          // 236
  var self = this;                                                                                                    // 237
  if (self._stopped) return;                                                                                          // 238
  self._stopped = true;                                                                                               // 240
  self._multiplexer.removeHandle(self._id);                                                                           // 241
};                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"doc_fetcher.js":function(require){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/mongo/doc_fetcher.js                                                                                      //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
var Fiber = Npm.require('fibers');                                                                                    // 1
var Future = Npm.require('fibers/future');                                                                            // 2
                                                                                                                      //
DocFetcher = function DocFetcher(mongoConnection) {                                                                   // 4
  var self = this;                                                                                                    // 5
  self._mongoConnection = mongoConnection;                                                                            // 6
  // Map from cache key -> [callback]                                                                                 //
  self._callbacksForCacheKey = {};                                                                                    // 4
};                                                                                                                    //
                                                                                                                      //
_.extend(DocFetcher.prototype, {                                                                                      // 11
  // Fetches document "id" from collectionName, returning it or null if not                                           //
  // found.                                                                                                           //
  //                                                                                                                  //
  // If you make multiple calls to fetch() with the same cacheKey (a string),                                         //
  // DocFetcher may assume that they all return the same document. (It does                                           //
  // not check to see if collectionName/id match.)                                                                    //
  //                                                                                                                  //
  // You may assume that callback is never called synchronously (and in fact                                          //
  // OplogObserveDriver does so).                                                                                     //
  fetch: function () {                                                                                                // 21
    function fetch(collectionName, id, cacheKey, callback) {                                                          // 21
      var self = this;                                                                                                // 22
                                                                                                                      //
      check(collectionName, String);                                                                                  // 24
      // id is some sort of scalar                                                                                    //
      check(cacheKey, String);                                                                                        // 21
                                                                                                                      //
      // If there's already an in-progress fetch for this cache key, yield until                                      //
      // it's done and return whatever it returns.                                                                    //
      if (_.has(self._callbacksForCacheKey, cacheKey)) {                                                              // 21
        self._callbacksForCacheKey[cacheKey].push(callback);                                                          // 31
        return;                                                                                                       // 32
      }                                                                                                               //
                                                                                                                      //
      var callbacks = self._callbacksForCacheKey[cacheKey] = [callback];                                              // 35
                                                                                                                      //
      Fiber(function () {                                                                                             // 37
        try {                                                                                                         // 38
          var doc = self._mongoConnection.findOne(collectionName, { _id: id }) || null;                               // 39
          // Return doc to all relevant callbacks. Note that this array can                                           //
          // continue to grow during callback excecution.                                                             //
          while (!_.isEmpty(callbacks)) {                                                                             // 38
            // Clone the document so that the various calls to fetch don't return                                     //
            // objects that are intertwingled with each other. Clone before                                           //
            // popping the future, so that if clone throws, the error gets passed                                     //
            // to the next callback.                                                                                  //
            var clonedDoc = EJSON.clone(doc);                                                                         // 48
            callbacks.pop()(null, clonedDoc);                                                                         // 49
          }                                                                                                           //
        } catch (e) {                                                                                                 //
          while (!_.isEmpty(callbacks)) {                                                                             // 52
            callbacks.pop()(e);                                                                                       // 53
          }                                                                                                           //
        } finally {                                                                                                   //
          // XXX consider keeping the doc around for a period of time before                                          //
          // removing from the cache                                                                                  //
          delete self._callbacksForCacheKey[cacheKey];                                                                // 58
        }                                                                                                             //
      }).run();                                                                                                       //
    }                                                                                                                 //
                                                                                                                      //
    return fetch;                                                                                                     //
  }()                                                                                                                 //
});                                                                                                                   //
                                                                                                                      //
MongoTest.DocFetcher = DocFetcher;                                                                                    // 64
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"polling_observe_driver.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/mongo/polling_observe_driver.js                                                                           //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
PollingObserveDriver = function PollingObserveDriver(options) {                                                       // 1
  var self = this;                                                                                                    // 2
                                                                                                                      //
  self._cursorDescription = options.cursorDescription;                                                                // 4
  self._mongoHandle = options.mongoHandle;                                                                            // 5
  self._ordered = options.ordered;                                                                                    // 6
  self._multiplexer = options.multiplexer;                                                                            // 7
  self._stopCallbacks = [];                                                                                           // 8
  self._stopped = false;                                                                                              // 9
                                                                                                                      //
  self._synchronousCursor = self._mongoHandle._createSynchronousCursor(self._cursorDescription);                      // 11
                                                                                                                      //
  // previous results snapshot.  on each poll cycle, diffs against                                                    //
  // results drives the callbacks.                                                                                    //
  self._results = null;                                                                                               // 1
                                                                                                                      //
  // The number of _pollMongo calls that have been added to self._taskQueue but                                       //
  // have not started running. Used to make sure we never schedule more than one                                      //
  // _pollMongo (other than possibly the one that is currently running). It's                                         //
  // also used by _suspendPolling to pretend there's a poll scheduled. Usually,                                       //
  // it's either 0 (for "no polls scheduled other than maybe one currently                                            //
  // running") or 1 (for "a poll scheduled that isn't running yet"), but it can                                       //
  // also be 2 if incremented by _suspendPolling.                                                                     //
  self._pollsScheduledButNotStarted = 0;                                                                              // 1
  self._pendingWrites = []; // people to notify when polling completes                                                // 26
                                                                                                                      //
  // Make sure to create a separately throttled function for each                                                     //
  // PollingObserveDriver object.                                                                                     //
  self._ensurePollIsScheduled = _.throttle(self._unthrottledEnsurePollIsScheduled, self._cursorDescription.options.pollingThrottleMs || 50 /* ms */);
                                                                                                                      //
  // XXX figure out if we still need a queue                                                                          //
  self._taskQueue = new Meteor._SynchronousQueue();                                                                   // 1
                                                                                                                      //
  var listenersHandle = listenAll(self._cursorDescription, function (notification) {                                  // 37
    // When someone does a transaction that might affect us, schedule a poll                                          //
    // of the database. If that transaction happens inside of a write fence,                                          //
    // block the fence until we've polled and notified observers.                                                     //
    var fence = DDPServer._CurrentWriteFence.get();                                                                   // 42
    if (fence) self._pendingWrites.push(fence.beginWrite());                                                          // 43
    // Ensure a poll is scheduled... but if we already know that one is,                                              //
    // don't hit the throttled _ensurePollIsScheduled function (which might                                           //
    // lead to us calling it unnecessarily in <pollingThrottleMs> ms).                                                //
    if (self._pollsScheduledButNotStarted === 0) self._ensurePollIsScheduled();                                       // 38
  });                                                                                                                 //
  self._stopCallbacks.push(function () {                                                                              // 52
    listenersHandle.stop();                                                                                           // 52
  });                                                                                                                 //
                                                                                                                      //
  // every once and a while, poll even if we don't think we're dirty, for                                             //
  // eventual consistency with database writes from outside the Meteor                                                //
  // universe.                                                                                                        //
  //                                                                                                                  //
  // For testing, there's an undocumented callback argument to observeChanges                                         //
  // which disables time-based polling and gets called at the beginning of each                                       //
  // poll.                                                                                                            //
  if (options._testOnlyPollCallback) {                                                                                // 1
    self._testOnlyPollCallback = options._testOnlyPollCallback;                                                       // 62
  } else {                                                                                                            //
    var pollingInterval = self._cursorDescription.options.pollingIntervalMs || self._cursorDescription.options._pollingInterval || // COMPAT with 1.2
    10 * 1000;                                                                                                        // 67
    var intervalHandle = Meteor.setInterval(_.bind(self._ensurePollIsScheduled, self), pollingInterval);              // 68
    self._stopCallbacks.push(function () {                                                                            // 70
      Meteor.clearInterval(intervalHandle);                                                                           // 71
    });                                                                                                               //
  }                                                                                                                   //
                                                                                                                      //
  // Make sure we actually poll soon!                                                                                 //
  self._unthrottledEnsurePollIsScheduled();                                                                           // 1
                                                                                                                      //
  Package.facts && Package.facts.Facts.incrementServerFact("mongo-livedata", "observe-drivers-polling", 1);           // 78
};                                                                                                                    //
                                                                                                                      //
_.extend(PollingObserveDriver.prototype, {                                                                            // 82
  // This is always called through _.throttle (except once at startup).                                               //
  _unthrottledEnsurePollIsScheduled: function () {                                                                    // 84
    function _unthrottledEnsurePollIsScheduled() {                                                                    // 84
      var self = this;                                                                                                // 85
      if (self._pollsScheduledButNotStarted > 0) return;                                                              // 86
      ++self._pollsScheduledButNotStarted;                                                                            // 88
      self._taskQueue.queueTask(function () {                                                                         // 89
        self._pollMongo();                                                                                            // 90
      });                                                                                                             //
    }                                                                                                                 //
                                                                                                                      //
    return _unthrottledEnsurePollIsScheduled;                                                                         //
  }(),                                                                                                                //
                                                                                                                      //
  // test-only interface for controlling polling.                                                                     //
  //                                                                                                                  //
  // _suspendPolling blocks until any currently running and scheduled polls are                                       //
  // done, and prevents any further polls from being scheduled. (new                                                  //
  // ObserveHandles can be added and receive their initial added callbacks,                                           //
  // though.)                                                                                                         //
  //                                                                                                                  //
  // _resumePolling immediately polls, and allows further polls to occur.                                             //
  _suspendPolling: function () {                                                                                      // 102
    function _suspendPolling() {                                                                                      // 102
      var self = this;                                                                                                // 103
      // Pretend that there's another poll scheduled (which will prevent                                              //
      // _ensurePollIsScheduled from queueing any more polls).                                                        //
      ++self._pollsScheduledButNotStarted;                                                                            // 102
      // Now block until all currently running or scheduled polls are done.                                           //
      self._taskQueue.runTask(function () {});                                                                        // 102
                                                                                                                      //
      // Confirm that there is only one "poll" (the fake one we're pretending to                                      //
      // have) scheduled.                                                                                             //
      if (self._pollsScheduledButNotStarted !== 1) throw new Error("_pollsScheduledButNotStarted is " + self._pollsScheduledButNotStarted);
    }                                                                                                                 //
                                                                                                                      //
    return _suspendPolling;                                                                                           //
  }(),                                                                                                                //
  _resumePolling: function () {                                                                                       // 116
    function _resumePolling() {                                                                                       // 116
      var self = this;                                                                                                // 117
      // We should be in the same state as in the end of _suspendPolling.                                             //
      if (self._pollsScheduledButNotStarted !== 1) throw new Error("_pollsScheduledButNotStarted is " + self._pollsScheduledButNotStarted);
      // Run a poll synchronously (which will counteract the                                                          //
      // ++_pollsScheduledButNotStarted from _suspendPolling).                                                        //
      self._taskQueue.runTask(function () {                                                                           // 116
        self._pollMongo();                                                                                            // 125
      });                                                                                                             //
    }                                                                                                                 //
                                                                                                                      //
    return _resumePolling;                                                                                            //
  }(),                                                                                                                //
                                                                                                                      //
  _pollMongo: function () {                                                                                           // 129
    function _pollMongo() {                                                                                           // 129
      var self = this;                                                                                                // 130
      --self._pollsScheduledButNotStarted;                                                                            // 131
                                                                                                                      //
      if (self._stopped) return;                                                                                      // 133
                                                                                                                      //
      var first = false;                                                                                              // 136
      var oldResults = self._results;                                                                                 // 137
      if (!oldResults) {                                                                                              // 138
        first = true;                                                                                                 // 139
        // XXX maybe use OrderedDict instead?                                                                         //
        oldResults = self._ordered ? [] : new LocalCollection._IdMap();                                               // 138
      }                                                                                                               //
                                                                                                                      //
      self._testOnlyPollCallback && self._testOnlyPollCallback();                                                     // 144
                                                                                                                      //
      // Save the list of pending writes which this round will commit.                                                //
      var writesForCycle = self._pendingWrites;                                                                       // 129
      self._pendingWrites = [];                                                                                       // 148
                                                                                                                      //
      // Get the new query results. (This yields.)                                                                    //
      try {                                                                                                           // 129
        var newResults = self._synchronousCursor.getRawObjects(self._ordered);                                        // 152
      } catch (e) {                                                                                                   //
        if (first && typeof e.code === 'number') {                                                                    // 154
          // This is an error document sent to us by mongod, not a connection                                         //
          // error generated by the client. And we've never seen this query work                                      //
          // successfully. Probably it's a bad selector or something, so we should                                    //
          // NOT retry. Instead, we should halt the observe (which ends up calling                                    //
          // `stop` on us).                                                                                           //
          self._multiplexer.queryError(new Error("Exception while polling query " + JSON.stringify(self._cursorDescription) + ": " + e.message));
          return;                                                                                                     // 164
        }                                                                                                             //
                                                                                                                      //
        // getRawObjects can throw if we're having trouble talking to the                                             //
        // database.  That's fine --- we will repoll later anyway. But we should                                      //
        // make sure not to lose track of this cycle's writes.                                                        //
        // (It also can throw if there's just something invalid about this query;                                     //
        // unfortunately the ObserveDriver API doesn't provide a good way to                                          //
        // "cancel" the observe from the inside in this case.                                                         //
        Array.prototype.push.apply(self._pendingWrites, writesForCycle);                                              // 153
        Meteor._debug("Exception while polling query " + JSON.stringify(self._cursorDescription) + ": " + e.stack);   // 174
        return;                                                                                                       // 176
      }                                                                                                               //
                                                                                                                      //
      // Run diffs.                                                                                                   //
      if (!self._stopped) {                                                                                           // 129
        LocalCollection._diffQueryChanges(self._ordered, oldResults, newResults, self._multiplexer);                  // 181
      }                                                                                                               //
                                                                                                                      //
      // Signals the multiplexer to allow all observeChanges calls that share this                                    //
      // multiplexer to return. (This happens asynchronously, via the                                                 //
      // multiplexer's queue.)                                                                                        //
      if (first) self._multiplexer.ready();                                                                           // 129
                                                                                                                      //
      // Replace self._results atomically.  (This assignment is what makes `first`                                    //
      // stay through on the next cycle, so we've waited until after we've                                            //
      // committed to ready-ing the multiplexer.)                                                                     //
      self._results = newResults;                                                                                     // 129
                                                                                                                      //
      // Once the ObserveMultiplexer has processed everything we've done in this                                      //
      // round, mark all the writes which existed before this call as                                                 //
      // commmitted. (If new writes have shown up in the meantime, there'll                                           //
      // already be another _pollMongo task scheduled.)                                                               //
      self._multiplexer.onFlush(function () {                                                                         // 129
        _.each(writesForCycle, function (w) {                                                                         // 201
          w.committed();                                                                                              // 202
        });                                                                                                           //
      });                                                                                                             //
    }                                                                                                                 //
                                                                                                                      //
    return _pollMongo;                                                                                                //
  }(),                                                                                                                //
                                                                                                                      //
  stop: function () {                                                                                                 // 207
    function stop() {                                                                                                 // 207
      var self = this;                                                                                                // 208
      self._stopped = true;                                                                                           // 209
      _.each(self._stopCallbacks, function (c) {                                                                      // 210
        c();                                                                                                          // 210
      });                                                                                                             //
      // Release any write fences that are waiting on us.                                                             //
      _.each(self._pendingWrites, function (w) {                                                                      // 207
        w.committed();                                                                                                // 213
      });                                                                                                             //
      Package.facts && Package.facts.Facts.incrementServerFact("mongo-livedata", "observe-drivers-polling", -1);      // 215
    }                                                                                                                 //
                                                                                                                      //
    return stop;                                                                                                      //
  }()                                                                                                                 //
});                                                                                                                   //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"oplog_observe_driver.js":function(require){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/mongo/oplog_observe_driver.js                                                                             //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
var Fiber = Npm.require('fibers');                                                                                    // 1
var Future = Npm.require('fibers/future');                                                                            // 2
                                                                                                                      //
var PHASE = {                                                                                                         // 4
  QUERYING: "QUERYING",                                                                                               // 5
  FETCHING: "FETCHING",                                                                                               // 6
  STEADY: "STEADY"                                                                                                    // 7
};                                                                                                                    //
                                                                                                                      //
// Exception thrown by _needToPollQuery which unrolls the stack up to the                                             //
// enclosing call to finishIfNeedToPollQuery.                                                                         //
var SwitchedToQuery = function SwitchedToQuery() {};                                                                  // 12
var finishIfNeedToPollQuery = function finishIfNeedToPollQuery(f) {                                                   // 13
  return function () {                                                                                                // 14
    try {                                                                                                             // 15
      f.apply(this, arguments);                                                                                       // 16
    } catch (e) {                                                                                                     //
      if (!(e instanceof SwitchedToQuery)) throw e;                                                                   // 18
    }                                                                                                                 //
  };                                                                                                                  //
};                                                                                                                    //
                                                                                                                      //
var currentId = 0;                                                                                                    // 24
                                                                                                                      //
// OplogObserveDriver is an alternative to PollingObserveDriver which follows                                         //
// the Mongo operation log instead of just re-polling the query. It obeys the                                         //
// same simple interface: constructing it starts sending observeChanges                                               //
// callbacks (and a ready() invocation) to the ObserveMultiplexer, and you stop                                       //
// it by calling the stop() method.                                                                                   //
OplogObserveDriver = function OplogObserveDriver(options) {                                                           // 31
  var self = this;                                                                                                    // 32
  self._usesOplog = true; // tests look at this                                                                       // 33
                                                                                                                      //
  self._id = currentId;                                                                                               // 31
  currentId++;                                                                                                        // 36
                                                                                                                      //
  self._cursorDescription = options.cursorDescription;                                                                // 38
  self._mongoHandle = options.mongoHandle;                                                                            // 39
  self._multiplexer = options.multiplexer;                                                                            // 40
                                                                                                                      //
  if (options.ordered) {                                                                                              // 42
    throw Error("OplogObserveDriver only supports unordered observeChanges");                                         // 43
  }                                                                                                                   //
                                                                                                                      //
  var sorter = options.sorter;                                                                                        // 46
  // We don't support $near and other geo-queries so it's OK to initialize the                                        //
  // comparator only once in the constructor.                                                                         //
  var comparator = sorter && sorter.getComparator();                                                                  // 31
                                                                                                                      //
  if (options.cursorDescription.options.limit) {                                                                      // 51
    // There are several properties ordered driver implements:                                                        //
    // - _limit is a positive number                                                                                  //
    // - _comparator is a function-comparator by which the query is ordered                                           //
    // - _unpublishedBuffer is non-null Min/Max Heap,                                                                 //
    //                      the empty buffer in STEADY phase implies that the                                         //
    //                      everything that matches the queries selector fits                                         //
    //                      into published set.                                                                       //
    // - _published - Min Heap (also implements IdMap methods)                                                        //
                                                                                                                      //
    var heapOptions = { IdMap: LocalCollection._IdMap };                                                              // 61
    self._limit = self._cursorDescription.options.limit;                                                              // 62
    self._comparator = comparator;                                                                                    // 63
    self._sorter = sorter;                                                                                            // 64
    self._unpublishedBuffer = new MinMaxHeap(comparator, heapOptions);                                                // 65
    // We need something that can find Max value in addition to IdMap interface                                       //
    self._published = new MaxHeap(comparator, heapOptions);                                                           // 51
  } else {                                                                                                            //
    self._limit = 0;                                                                                                  // 69
    self._comparator = null;                                                                                          // 70
    self._sorter = null;                                                                                              // 71
    self._unpublishedBuffer = null;                                                                                   // 72
    self._published = new LocalCollection._IdMap();                                                                   // 73
  }                                                                                                                   //
                                                                                                                      //
  // Indicates if it is safe to insert a new document at the end of the buffer                                        //
  // for this query. i.e. it is known that there are no documents matching the                                        //
  // selector those are not in published or buffer.                                                                   //
  self._safeAppendToBuffer = false;                                                                                   // 31
                                                                                                                      //
  self._stopped = false;                                                                                              // 81
  self._stopHandles = [];                                                                                             // 82
                                                                                                                      //
  Package.facts && Package.facts.Facts.incrementServerFact("mongo-livedata", "observe-drivers-oplog", 1);             // 84
                                                                                                                      //
  self._registerPhaseChange(PHASE.QUERYING);                                                                          // 87
                                                                                                                      //
  var selector = self._cursorDescription.selector;                                                                    // 89
  self._matcher = options.matcher;                                                                                    // 90
  var projection = self._cursorDescription.options.fields || {};                                                      // 91
  self._projectionFn = LocalCollection._compileProjection(projection);                                                // 92
  // Projection function, result of combining important fields for selector and                                       //
  // existing fields projection                                                                                       //
  self._sharedProjection = self._matcher.combineIntoProjection(projection);                                           // 31
  if (sorter) self._sharedProjection = sorter.combineIntoProjection(self._sharedProjection);                          // 96
  self._sharedProjectionFn = LocalCollection._compileProjection(self._sharedProjection);                              // 98
                                                                                                                      //
  self._needToFetch = new LocalCollection._IdMap();                                                                   // 101
  self._currentlyFetching = null;                                                                                     // 102
  self._fetchGeneration = 0;                                                                                          // 103
                                                                                                                      //
  self._requeryWhenDoneThisQuery = false;                                                                             // 105
  self._writesToCommitWhenWeReachSteady = [];                                                                         // 106
                                                                                                                      //
  // If the oplog handle tells us that it skipped some entries (because it got                                        //
  // behind, say), re-poll.                                                                                           //
  self._stopHandles.push(self._mongoHandle._oplogHandle.onSkippedEntries(finishIfNeedToPollQuery(function () {        // 31
    self._needToPollQuery();                                                                                          // 112
  })));                                                                                                               //
                                                                                                                      //
  forEachTrigger(self._cursorDescription, function (trigger) {                                                        // 116
    self._stopHandles.push(self._mongoHandle._oplogHandle.onOplogEntry(trigger, function (notification) {             // 117
      Meteor._noYieldsAllowed(finishIfNeedToPollQuery(function () {                                                   // 119
        var op = notification.op;                                                                                     // 120
        if (notification.dropCollection || notification.dropDatabase) {                                               // 121
          // Note: this call is not allowed to block on anything (especially                                          //
          // on waiting for oplog entries to catch up) because that will block                                        //
          // onOplogEntry!                                                                                            //
          self._needToPollQuery();                                                                                    // 125
        } else {                                                                                                      //
          // All other operators should be handled depending on phase                                                 //
          if (self._phase === PHASE.QUERYING) self._handleOplogEntryQuerying(op);else self._handleOplogEntrySteadyOrFetching(op);
        }                                                                                                             //
      }));                                                                                                            //
    }));                                                                                                              //
  });                                                                                                                 //
                                                                                                                      //
  // XXX ordering w.r.t. everything else?                                                                             //
  self._stopHandles.push(listenAll(self._cursorDescription, function (notification) {                                 // 31
    // If we're not in a pre-fire write fence, we don't have to do anything.                                          //
    var fence = DDPServer._CurrentWriteFence.get();                                                                   // 142
    if (!fence || fence.fired) return;                                                                                // 143
                                                                                                                      //
    if (fence._oplogObserveDrivers) {                                                                                 // 146
      fence._oplogObserveDrivers[self._id] = self;                                                                    // 147
      return;                                                                                                         // 148
    }                                                                                                                 //
                                                                                                                      //
    fence._oplogObserveDrivers = {};                                                                                  // 151
    fence._oplogObserveDrivers[self._id] = self;                                                                      // 152
                                                                                                                      //
    fence.onBeforeFire(function () {                                                                                  // 154
      var drivers = fence._oplogObserveDrivers;                                                                       // 155
      delete fence._oplogObserveDrivers;                                                                              // 156
                                                                                                                      //
      // This fence cannot fire until we've caught up to "this point" in the                                          //
      // oplog, and all observers made it back to the steady state.                                                   //
      self._mongoHandle._oplogHandle.waitUntilCaughtUp();                                                             // 154
                                                                                                                      //
      _.each(drivers, function (driver) {                                                                             // 162
        if (driver._stopped) return;                                                                                  // 163
                                                                                                                      //
        var write = fence.beginWrite();                                                                               // 166
        if (driver._phase === PHASE.STEADY) {                                                                         // 167
          // Make sure that all of the callbacks have made it through the                                             //
          // multiplexer and been delivered to ObserveHandles before committing                                       //
          // writes.                                                                                                  //
          driver._multiplexer.onFlush(function () {                                                                   // 171
            write.committed();                                                                                        // 172
          });                                                                                                         //
        } else {                                                                                                      //
          driver._writesToCommitWhenWeReachSteady.push(write);                                                        // 175
        }                                                                                                             //
      });                                                                                                             //
    });                                                                                                               //
  }));                                                                                                                //
                                                                                                                      //
  // When Mongo fails over, we need to repoll the query, in case we processed an                                      //
  // oplog entry that got rolled back.                                                                                //
  self._stopHandles.push(self._mongoHandle._onFailover(finishIfNeedToPollQuery(function () {                          // 31
    self._needToPollQuery();                                                                                          // 186
  })));                                                                                                               //
                                                                                                                      //
  // Give _observeChanges a chance to add the new ObserveHandle to our                                                //
  // multiplexer, so that the added calls get streamed.                                                               //
  Meteor.defer(finishIfNeedToPollQuery(function () {                                                                  // 31
    self._runInitialQuery();                                                                                          // 192
  }));                                                                                                                //
};                                                                                                                    //
                                                                                                                      //
_.extend(OplogObserveDriver.prototype, {                                                                              // 196
  _addPublished: function () {                                                                                        // 197
    function _addPublished(id, doc) {                                                                                 // 197
      var self = this;                                                                                                // 198
      Meteor._noYieldsAllowed(function () {                                                                           // 199
        var fields = _.clone(doc);                                                                                    // 200
        delete fields._id;                                                                                            // 201
        self._published.set(id, self._sharedProjectionFn(doc));                                                       // 202
        self._multiplexer.added(id, self._projectionFn(fields));                                                      // 203
                                                                                                                      //
        // After adding this document, the published set might be overflowed                                          //
        // (exceeding capacity specified by limit). If so, push the maximum                                           //
        // element to the buffer, we might want to save it in memory to reduce the                                    //
        // amount of Mongo lookups in the future.                                                                     //
        if (self._limit && self._published.size() > self._limit) {                                                    // 199
          // XXX in theory the size of published is no more than limit+1                                              //
          if (self._published.size() !== self._limit + 1) {                                                           // 211
            throw new Error("After adding to published, " + (self._published.size() - self._limit) + " documents are overflowing the set");
          }                                                                                                           //
                                                                                                                      //
          var overflowingDocId = self._published.maxElementId();                                                      // 217
          var overflowingDoc = self._published.get(overflowingDocId);                                                 // 218
                                                                                                                      //
          if (EJSON.equals(overflowingDocId, id)) {                                                                   // 220
            throw new Error("The document just added is overflowing the published set");                              // 221
          }                                                                                                           //
                                                                                                                      //
          self._published.remove(overflowingDocId);                                                                   // 224
          self._multiplexer.removed(overflowingDocId);                                                                // 225
          self._addBuffered(overflowingDocId, overflowingDoc);                                                        // 226
        }                                                                                                             //
      });                                                                                                             //
    }                                                                                                                 //
                                                                                                                      //
    return _addPublished;                                                                                             //
  }(),                                                                                                                //
  _removePublished: function () {                                                                                     // 230
    function _removePublished(id) {                                                                                   // 230
      var self = this;                                                                                                // 231
      Meteor._noYieldsAllowed(function () {                                                                           // 232
        self._published.remove(id);                                                                                   // 233
        self._multiplexer.removed(id);                                                                                // 234
        if (!self._limit || self._published.size() === self._limit) return;                                           // 235
                                                                                                                      //
        if (self._published.size() > self._limit) throw Error("self._published got too big");                         // 238
                                                                                                                      //
        // OK, we are publishing less than the limit. Maybe we should look in the                                     //
        // buffer to find the next element past what we were publishing before.                                       //
                                                                                                                      //
        if (!self._unpublishedBuffer.empty()) {                                                                       // 232
          // There's something in the buffer; move the first thing in it to                                           //
          // _published.                                                                                              //
          var newDocId = self._unpublishedBuffer.minElementId();                                                      // 247
          var newDoc = self._unpublishedBuffer.get(newDocId);                                                         // 248
          self._removeBuffered(newDocId);                                                                             // 249
          self._addPublished(newDocId, newDoc);                                                                       // 250
          return;                                                                                                     // 251
        }                                                                                                             //
                                                                                                                      //
        // There's nothing in the buffer.  This could mean one of a few things.                                       //
                                                                                                                      //
        // (a) We could be in the middle of re-running the query (specifically, we                                    //
        // could be in _publishNewResults). In that case, _unpublishedBuffer is                                       //
        // empty because we clear it at the beginning of _publishNewResults. In                                       //
        // this case, our caller already knows the entire answer to the query and                                     //
        // we don't need to do anything fancy here.  Just return.                                                     //
        if (self._phase === PHASE.QUERYING) return;                                                                   // 232
                                                                                                                      //
        // (b) We're pretty confident that the union of _published and                                                //
        // _unpublishedBuffer contain all documents that match selector. Because                                      //
        // _unpublishedBuffer is empty, that means we're confident that _published                                    //
        // contains all documents that match selector. So we have nothing to do.                                      //
        if (self._safeAppendToBuffer) return;                                                                         // 232
                                                                                                                      //
        // (c) Maybe there are other documents out there that should be in our                                        //
        // buffer. But in that case, when we emptied _unpublishedBuffer in                                            //
        // _removeBuffered, we should have called _needToPollQuery, which will                                        //
        // either put something in _unpublishedBuffer or set _safeAppendToBuffer                                      //
        // (or both), and it will put us in QUERYING for that whole time. So in                                       //
        // fact, we shouldn't be able to get here.                                                                    //
                                                                                                                      //
        throw new Error("Buffer inexplicably empty");                                                                 // 232
      });                                                                                                             //
    }                                                                                                                 //
                                                                                                                      //
    return _removePublished;                                                                                          //
  }(),                                                                                                                //
  _changePublished: function () {                                                                                     // 281
    function _changePublished(id, oldDoc, newDoc) {                                                                   // 281
      var self = this;                                                                                                // 282
      Meteor._noYieldsAllowed(function () {                                                                           // 283
        self._published.set(id, self._sharedProjectionFn(newDoc));                                                    // 284
        var projectedNew = self._projectionFn(newDoc);                                                                // 285
        var projectedOld = self._projectionFn(oldDoc);                                                                // 286
        var changed = DiffSequence.makeChangedFields(projectedNew, projectedOld);                                     // 287
        if (!_.isEmpty(changed)) self._multiplexer.changed(id, changed);                                              // 289
      });                                                                                                             //
    }                                                                                                                 //
                                                                                                                      //
    return _changePublished;                                                                                          //
  }(),                                                                                                                //
  _addBuffered: function () {                                                                                         // 293
    function _addBuffered(id, doc) {                                                                                  // 293
      var self = this;                                                                                                // 294
      Meteor._noYieldsAllowed(function () {                                                                           // 295
        self._unpublishedBuffer.set(id, self._sharedProjectionFn(doc));                                               // 296
                                                                                                                      //
        // If something is overflowing the buffer, we just remove it from cache                                       //
        if (self._unpublishedBuffer.size() > self._limit) {                                                           // 295
          var maxBufferedId = self._unpublishedBuffer.maxElementId();                                                 // 300
                                                                                                                      //
          self._unpublishedBuffer.remove(maxBufferedId);                                                              // 302
                                                                                                                      //
          // Since something matching is removed from cache (both published set and                                   //
          // buffer), set flag to false                                                                               //
          self._safeAppendToBuffer = false;                                                                           // 299
        }                                                                                                             //
      });                                                                                                             //
    }                                                                                                                 //
                                                                                                                      //
    return _addBuffered;                                                                                              //
  }(),                                                                                                                //
  // Is called either to remove the doc completely from matching set or to move                                       //
  // it to the published set later.                                                                                   //
  _removeBuffered: function () {                                                                                      // 312
    function _removeBuffered(id) {                                                                                    // 312
      var self = this;                                                                                                // 313
      Meteor._noYieldsAllowed(function () {                                                                           // 314
        self._unpublishedBuffer.remove(id);                                                                           // 315
        // To keep the contract "buffer is never empty in STEADY phase unless the                                     //
        // everything matching fits into published" true, we poll everything as                                       //
        // soon as we see the buffer becoming empty.                                                                  //
        if (!self._unpublishedBuffer.size() && !self._safeAppendToBuffer) self._needToPollQuery();                    // 314
      });                                                                                                             //
    }                                                                                                                 //
                                                                                                                      //
    return _removeBuffered;                                                                                           //
  }(),                                                                                                                //
  // Called when a document has joined the "Matching" results set.                                                    //
  // Takes responsibility of keeping _unpublishedBuffer in sync with _published                                       //
  // and the effect of limit enforced.                                                                                //
  _addMatching: function () {                                                                                         // 326
    function _addMatching(doc) {                                                                                      // 326
      var self = this;                                                                                                // 327
      Meteor._noYieldsAllowed(function () {                                                                           // 328
        var id = doc._id;                                                                                             // 329
        if (self._published.has(id)) throw Error("tried to add something already published " + id);                   // 330
        if (self._limit && self._unpublishedBuffer.has(id)) throw Error("tried to add something already existed in buffer " + id);
                                                                                                                      //
        var limit = self._limit;                                                                                      // 335
        var comparator = self._comparator;                                                                            // 336
        var maxPublished = limit && self._published.size() > 0 ? self._published.get(self._published.maxElementId()) : null;
        var maxBuffered = limit && self._unpublishedBuffer.size() > 0 ? self._unpublishedBuffer.get(self._unpublishedBuffer.maxElementId()) : null;
        // The query is unlimited or didn't publish enough documents yet or the                                       //
        // new document would fit into published set pushing the maximum element                                      //
        // out, then we need to publish the doc.                                                                      //
        var toPublish = !limit || self._published.size() < limit || comparator(doc, maxPublished) < 0;                // 328
                                                                                                                      //
        // Otherwise we might need to buffer it (only in case of limited query).                                      //
        // Buffering is allowed if the buffer is not filled up yet and all                                            //
        // matching docs are either in the published set or in the buffer.                                            //
        var canAppendToBuffer = !toPublish && self._safeAppendToBuffer && self._unpublishedBuffer.size() < limit;     // 328
                                                                                                                      //
        // Or if it is small enough to be safely inserted to the middle or the                                        //
        // beginning of the buffer.                                                                                   //
        var canInsertIntoBuffer = !toPublish && maxBuffered && comparator(doc, maxBuffered) <= 0;                     // 328
                                                                                                                      //
        var toBuffer = canAppendToBuffer || canInsertIntoBuffer;                                                      // 359
                                                                                                                      //
        if (toPublish) {                                                                                              // 361
          self._addPublished(id, doc);                                                                                // 362
        } else if (toBuffer) {                                                                                        //
          self._addBuffered(id, doc);                                                                                 // 364
        } else {                                                                                                      //
          // dropping it and not saving to the cache                                                                  //
          self._safeAppendToBuffer = false;                                                                           // 367
        }                                                                                                             //
      });                                                                                                             //
    }                                                                                                                 //
                                                                                                                      //
    return _addMatching;                                                                                              //
  }(),                                                                                                                //
  // Called when a document leaves the "Matching" results set.                                                        //
  // Takes responsibility of keeping _unpublishedBuffer in sync with _published                                       //
  // and the effect of limit enforced.                                                                                //
  _removeMatching: function () {                                                                                      // 374
    function _removeMatching(id) {                                                                                    // 374
      var self = this;                                                                                                // 375
      Meteor._noYieldsAllowed(function () {                                                                           // 376
        if (!self._published.has(id) && !self._limit) throw Error("tried to remove something matching but not cached " + id);
                                                                                                                      //
        if (self._published.has(id)) {                                                                                // 380
          self._removePublished(id);                                                                                  // 381
        } else if (self._unpublishedBuffer.has(id)) {                                                                 //
          self._removeBuffered(id);                                                                                   // 383
        }                                                                                                             //
      });                                                                                                             //
    }                                                                                                                 //
                                                                                                                      //
    return _removeMatching;                                                                                           //
  }(),                                                                                                                //
  _handleDoc: function () {                                                                                           // 387
    function _handleDoc(id, newDoc) {                                                                                 // 387
      var self = this;                                                                                                // 388
      Meteor._noYieldsAllowed(function () {                                                                           // 389
        var matchesNow = newDoc && self._matcher.documentMatches(newDoc).result;                                      // 390
                                                                                                                      //
        var publishedBefore = self._published.has(id);                                                                // 392
        var bufferedBefore = self._limit && self._unpublishedBuffer.has(id);                                          // 393
        var cachedBefore = publishedBefore || bufferedBefore;                                                         // 394
                                                                                                                      //
        if (matchesNow && !cachedBefore) {                                                                            // 396
          self._addMatching(newDoc);                                                                                  // 397
        } else if (cachedBefore && !matchesNow) {                                                                     //
          self._removeMatching(id);                                                                                   // 399
        } else if (cachedBefore && matchesNow) {                                                                      //
          var oldDoc = self._published.get(id);                                                                       // 401
          var comparator = self._comparator;                                                                          // 402
          var minBuffered = self._limit && self._unpublishedBuffer.size() && self._unpublishedBuffer.get(self._unpublishedBuffer.minElementId());
                                                                                                                      //
          if (publishedBefore) {                                                                                      // 406
            // Unlimited case where the document stays in published once it                                           //
            // matches or the case when we don't have enough matching docs to                                         //
            // publish or the changed but matching doc will stay in published                                         //
            // anyways.                                                                                               //
            //                                                                                                        //
            // XXX: We rely on the emptiness of buffer. Be sure to maintain the                                       //
            // fact that buffer can't be empty if there are matching documents not                                    //
            // published. Notably, we don't want to schedule repoll and continue                                      //
            // relying on this property.                                                                              //
            var staysInPublished = !self._limit || self._unpublishedBuffer.size() === 0 || comparator(newDoc, minBuffered) <= 0;
                                                                                                                      //
            if (staysInPublished) {                                                                                   // 420
              self._changePublished(id, oldDoc, newDoc);                                                              // 421
            } else {                                                                                                  //
              // after the change doc doesn't stay in the published, remove it                                        //
              self._removePublished(id);                                                                              // 424
              // but it can move into buffered now, check it                                                          //
              var maxBuffered = self._unpublishedBuffer.get(self._unpublishedBuffer.maxElementId());                  // 422
                                                                                                                      //
              var toBuffer = self._safeAppendToBuffer || maxBuffered && comparator(newDoc, maxBuffered) <= 0;         // 429
                                                                                                                      //
              if (toBuffer) {                                                                                         // 432
                self._addBuffered(id, newDoc);                                                                        // 433
              } else {                                                                                                //
                // Throw away from both published set and buffer                                                      //
                self._safeAppendToBuffer = false;                                                                     // 436
              }                                                                                                       //
            }                                                                                                         //
          } else if (bufferedBefore) {                                                                                //
            oldDoc = self._unpublishedBuffer.get(id);                                                                 // 440
            // remove the old version manually instead of using _removeBuffered so                                    //
            // we don't trigger the querying immediately.  if we end this block                                       //
            // with the buffer empty, we will need to trigger the query poll                                          //
            // manually too.                                                                                          //
            self._unpublishedBuffer.remove(id);                                                                       // 439
                                                                                                                      //
            var maxPublished = self._published.get(self._published.maxElementId());                                   // 447
            var maxBuffered = self._unpublishedBuffer.size() && self._unpublishedBuffer.get(self._unpublishedBuffer.maxElementId());
                                                                                                                      //
            // the buffered doc was updated, it could move to published                                               //
            var toPublish = comparator(newDoc, maxPublished) < 0;                                                     // 439
                                                                                                                      //
            // or stays in buffer even after the change                                                               //
            var staysInBuffer = !toPublish && self._safeAppendToBuffer || !toPublish && maxBuffered && comparator(newDoc, maxBuffered) <= 0;
                                                                                                                      //
            if (toPublish) {                                                                                          // 461
              self._addPublished(id, newDoc);                                                                         // 462
            } else if (staysInBuffer) {                                                                               //
              // stays in buffer but changes                                                                          //
              self._unpublishedBuffer.set(id, newDoc);                                                                // 465
            } else {                                                                                                  //
              // Throw away from both published set and buffer                                                        //
              self._safeAppendToBuffer = false;                                                                       // 468
              // Normally this check would have been done in _removeBuffered but                                      //
              // we didn't use it, so we need to do it ourself now.                                                   //
              if (!self._unpublishedBuffer.size()) {                                                                  // 466
                self._needToPollQuery();                                                                              // 472
              }                                                                                                       //
            }                                                                                                         //
          } else {                                                                                                    //
            throw new Error("cachedBefore implies either of publishedBefore or bufferedBefore is true.");             // 476
          }                                                                                                           //
        }                                                                                                             //
      });                                                                                                             //
    }                                                                                                                 //
                                                                                                                      //
    return _handleDoc;                                                                                                //
  }(),                                                                                                                //
  _fetchModifiedDocuments: function () {                                                                              // 481
    function _fetchModifiedDocuments() {                                                                              // 481
      var self = this;                                                                                                // 482
      Meteor._noYieldsAllowed(function () {                                                                           // 483
        self._registerPhaseChange(PHASE.FETCHING);                                                                    // 484
        // Defer, because nothing called from the oplog entry handler may yield,                                      //
        // but fetch() yields.                                                                                        //
        Meteor.defer(finishIfNeedToPollQuery(function () {                                                            // 483
          while (!self._stopped && !self._needToFetch.empty()) {                                                      // 488
            if (self._phase === PHASE.QUERYING) {                                                                     // 489
              // While fetching, we decided to go into QUERYING mode, and then we                                     //
              // saw another oplog entry, so _needToFetch is not empty. But we                                        //
              // shouldn't fetch these documents until AFTER the query is done.                                       //
              break;                                                                                                  // 493
            }                                                                                                         //
                                                                                                                      //
            // Being in steady phase here would be surprising.                                                        //
            if (self._phase !== PHASE.FETCHING) throw new Error("phase in fetchModifiedDocuments: " + self._phase);   // 488
                                                                                                                      //
            self._currentlyFetching = self._needToFetch;                                                              // 500
            var thisGeneration = ++self._fetchGeneration;                                                             // 501
            self._needToFetch = new LocalCollection._IdMap();                                                         // 502
            var waiting = 0;                                                                                          // 503
            var fut = new Future();                                                                                   // 504
            // This loop is safe, because _currentlyFetching will not be updated                                      //
            // during this loop (in fact, it is never mutated).                                                       //
            self._currentlyFetching.forEach(function (cacheKey, id) {                                                 // 488
              waiting++;                                                                                              // 508
              self._mongoHandle._docFetcher.fetch(self._cursorDescription.collectionName, id, cacheKey, finishIfNeedToPollQuery(function (err, doc) {
                try {                                                                                                 // 512
                  if (err) {                                                                                          // 513
                    Meteor._debug("Got exception while fetching documents: " + err);                                  // 514
                    // If we get an error from the fetcher (eg, trouble                                               //
                    // connecting to Mongo), let's just abandon the fetch phase                                       //
                    // altogether and fall back to polling. It's not like we're                                       //
                    // getting live updates anyway.                                                                   //
                    if (self._phase !== PHASE.QUERYING) {                                                             // 513
                      self._needToPollQuery();                                                                        // 521
                    }                                                                                                 //
                  } else if (!self._stopped && self._phase === PHASE.FETCHING && self._fetchGeneration === thisGeneration) {
                    // We re-check the generation in case we've had an explicit                                       //
                    // _pollQuery call (eg, in another fiber) which should                                            //
                    // effectively cancel this round of fetches.  (_pollQuery                                         //
                    // increments the generation.)                                                                    //
                    self._handleDoc(id, doc);                                                                         // 529
                  }                                                                                                   //
                } finally {                                                                                           //
                  waiting--;                                                                                          // 532
                  // Because fetch() never calls its callback synchronously,                                          //
                  // this is safe (ie, we won't call fut.return() before the                                          //
                  // forEach is done).                                                                                //
                  if (waiting === 0) fut['return']();                                                                 // 531
                }                                                                                                     //
              }));                                                                                                    //
            });                                                                                                       //
            fut.wait();                                                                                               // 541
            // Exit now if we've had a _pollQuery call (here or in another fiber).                                    //
            if (self._phase === PHASE.QUERYING) return;                                                               // 488
            self._currentlyFetching = null;                                                                           // 545
          }                                                                                                           //
          // We're done fetching, so we can be steady, unless we've had a                                             //
          // _pollQuery call (here or in another fiber).                                                              //
          if (self._phase !== PHASE.QUERYING) self._beSteady();                                                       // 487
        }));                                                                                                          //
      });                                                                                                             //
    }                                                                                                                 //
                                                                                                                      //
    return _fetchModifiedDocuments;                                                                                   //
  }(),                                                                                                                //
  _beSteady: function () {                                                                                            // 554
    function _beSteady() {                                                                                            // 554
      var self = this;                                                                                                // 555
      Meteor._noYieldsAllowed(function () {                                                                           // 556
        self._registerPhaseChange(PHASE.STEADY);                                                                      // 557
        var writes = self._writesToCommitWhenWeReachSteady;                                                           // 558
        self._writesToCommitWhenWeReachSteady = [];                                                                   // 559
        self._multiplexer.onFlush(function () {                                                                       // 560
          _.each(writes, function (w) {                                                                               // 561
            w.committed();                                                                                            // 562
          });                                                                                                         //
        });                                                                                                           //
      });                                                                                                             //
    }                                                                                                                 //
                                                                                                                      //
    return _beSteady;                                                                                                 //
  }(),                                                                                                                //
  _handleOplogEntryQuerying: function () {                                                                            // 567
    function _handleOplogEntryQuerying(op) {                                                                          // 567
      var self = this;                                                                                                // 568
      Meteor._noYieldsAllowed(function () {                                                                           // 569
        self._needToFetch.set(idForOp(op), op.ts.toString());                                                         // 570
      });                                                                                                             //
    }                                                                                                                 //
                                                                                                                      //
    return _handleOplogEntryQuerying;                                                                                 //
  }(),                                                                                                                //
  _handleOplogEntrySteadyOrFetching: function () {                                                                    // 573
    function _handleOplogEntrySteadyOrFetching(op) {                                                                  // 573
      var self = this;                                                                                                // 574
      Meteor._noYieldsAllowed(function () {                                                                           // 575
        var id = idForOp(op);                                                                                         // 576
        // If we're already fetching this one, or about to, we can't optimize;                                        //
        // make sure that we fetch it again if necessary.                                                             //
        if (self._phase === PHASE.FETCHING && (self._currentlyFetching && self._currentlyFetching.has(id) || self._needToFetch.has(id))) {
          self._needToFetch.set(id, op.ts.toString());                                                                // 582
          return;                                                                                                     // 583
        }                                                                                                             //
                                                                                                                      //
        if (op.op === 'd') {                                                                                          // 586
          if (self._published.has(id) || self._limit && self._unpublishedBuffer.has(id)) self._removeMatching(id);    // 587
        } else if (op.op === 'i') {                                                                                   //
          if (self._published.has(id)) throw new Error("insert found for already-existing ID in published");          // 591
          if (self._unpublishedBuffer && self._unpublishedBuffer.has(id)) throw new Error("insert found for already-existing ID in buffer");
                                                                                                                      //
          // XXX what if selector yields?  for now it can't but later it could                                        //
          // have $where                                                                                              //
          if (self._matcher.documentMatches(op.o).result) self._addMatching(op.o);                                    // 590
        } else if (op.op === 'u') {                                                                                   //
          // Is this a modifier ($set/$unset, which may require us to poll the                                        //
          // database to figure out if the whole document matches the selector) or                                    //
          // a replacement (in which case we can just directly re-evaluate the                                        //
          // selector)?                                                                                               //
          var isReplace = !_.has(op.o, '$set') && !_.has(op.o, '$unset');                                             // 605
          // If this modifier modifies something inside an EJSON custom type (ie,                                     //
          // anything with EJSON$), then we can't try to use                                                          //
          // LocalCollection._modify, since that just mutates the EJSON encoding,                                     //
          // not the actual object.                                                                                   //
          var canDirectlyModifyDoc = !isReplace && modifierCanBeDirectlyApplied(op.o);                                // 600
                                                                                                                      //
          var publishedBefore = self._published.has(id);                                                              // 613
          var bufferedBefore = self._limit && self._unpublishedBuffer.has(id);                                        // 614
                                                                                                                      //
          if (isReplace) {                                                                                            // 616
            self._handleDoc(id, _.extend({ _id: id }, op.o));                                                         // 617
          } else if ((publishedBefore || bufferedBefore) && canDirectlyModifyDoc) {                                   //
            // Oh great, we actually know what the document is, so we can apply                                       //
            // this directly.                                                                                         //
            var newDoc = self._published.has(id) ? self._published.get(id) : self._unpublishedBuffer.get(id);         // 622
            newDoc = EJSON.clone(newDoc);                                                                             // 624
                                                                                                                      //
            newDoc._id = id;                                                                                          // 626
            try {                                                                                                     // 627
              LocalCollection._modify(newDoc, op.o);                                                                  // 628
            } catch (e) {                                                                                             //
              if (e.name !== "MinimongoError") throw e;                                                               // 630
              // We didn't understand the modifier.  Re-fetch.                                                        //
              self._needToFetch.set(id, op.ts.toString());                                                            // 629
              if (self._phase === PHASE.STEADY) {                                                                     // 634
                self._fetchModifiedDocuments();                                                                       // 635
              }                                                                                                       //
              return;                                                                                                 // 637
            }                                                                                                         //
            self._handleDoc(id, self._sharedProjectionFn(newDoc));                                                    // 639
          } else if (!canDirectlyModifyDoc || self._matcher.canBecomeTrueByModifier(op.o) || self._sorter && self._sorter.affectedByModifier(op.o)) {
            self._needToFetch.set(id, op.ts.toString());                                                              // 643
            if (self._phase === PHASE.STEADY) self._fetchModifiedDocuments();                                         // 644
          }                                                                                                           //
        } else {                                                                                                      //
          throw Error("XXX SURPRISING OPERATION: " + op);                                                             // 648
        }                                                                                                             //
      });                                                                                                             //
    }                                                                                                                 //
                                                                                                                      //
    return _handleOplogEntrySteadyOrFetching;                                                                         //
  }(),                                                                                                                //
  // Yields!                                                                                                          //
  _runInitialQuery: function () {                                                                                     // 653
    function _runInitialQuery() {                                                                                     // 653
      var self = this;                                                                                                // 654
      if (self._stopped) throw new Error("oplog stopped surprisingly early");                                         // 655
                                                                                                                      //
      self._runQuery({ initial: true }); // yields                                                                    // 658
                                                                                                                      //
      if (self._stopped) return; // can happen on queryError                                                          // 653
                                                                                                                      //
      // Allow observeChanges calls to return. (After this, it's possible for                                         //
      // stop() to be called.)                                                                                        //
      self._multiplexer.ready();                                                                                      // 653
                                                                                                                      //
      self._doneQuerying(); // yields                                                                                 // 667
    }                                                                                                                 // 653
                                                                                                                      //
    return _runInitialQuery;                                                                                          //
  }(),                                                                                                                //
                                                                                                                      //
  // In various circumstances, we may just want to stop processing the oplog and                                      //
  // re-run the initial query, just as if we were a PollingObserveDriver.                                             //
  //                                                                                                                  //
  // This function may not block, because it is called from an oplog entry                                            //
  // handler.                                                                                                         //
  //                                                                                                                  //
  // XXX We should call this when we detect that we've been in FETCHING for "too                                      //
  // long".                                                                                                           //
  //                                                                                                                  //
  // XXX We should call this when we detect Mongo failover (since that might                                          //
  // mean that some of the oplog entries we have processed have been rolled                                           //
  // back). The Node Mongo driver is in the middle of a bunch of huge                                                 //
  // refactorings, including the way that it notifies you when primary                                                //
  // changes. Will put off implementing this until driver 1.4 is out.                                                 //
  _pollQuery: function () {                                                                                           // 684
    function _pollQuery() {                                                                                           // 684
      var self = this;                                                                                                // 685
      Meteor._noYieldsAllowed(function () {                                                                           // 686
        if (self._stopped) return;                                                                                    // 687
                                                                                                                      //
        // Yay, we get to forget about all the things we thought we had to fetch.                                     //
        self._needToFetch = new LocalCollection._IdMap();                                                             // 686
        self._currentlyFetching = null;                                                                               // 692
        ++self._fetchGeneration; // ignore any in-flight fetches                                                      // 693
        self._registerPhaseChange(PHASE.QUERYING);                                                                    // 686
                                                                                                                      //
        // Defer so that we don't yield.  We don't need finishIfNeedToPollQuery                                       //
        // here because SwitchedToQuery is not thrown in QUERYING mode.                                               //
        Meteor.defer(function () {                                                                                    // 686
          self._runQuery();                                                                                           // 699
          self._doneQuerying();                                                                                       // 700
        });                                                                                                           //
      });                                                                                                             //
    }                                                                                                                 //
                                                                                                                      //
    return _pollQuery;                                                                                                //
  }(),                                                                                                                //
                                                                                                                      //
  // Yields!                                                                                                          //
  _runQuery: function () {                                                                                            // 706
    function _runQuery(options) {                                                                                     // 706
      var self = this;                                                                                                // 707
      options = options || {};                                                                                        // 708
      var newResults, newBuffer;                                                                                      // 709
                                                                                                                      //
      // This while loop is just to retry failures.                                                                   //
      while (true) {                                                                                                  // 706
        // If we've been stopped, we don't have to run anything any more.                                             //
        if (self._stopped) return;                                                                                    // 714
                                                                                                                      //
        newResults = new LocalCollection._IdMap();                                                                    // 717
        newBuffer = new LocalCollection._IdMap();                                                                     // 718
                                                                                                                      //
        // Query 2x documents as the half excluded from the original query will go                                    //
        // into unpublished buffer to reduce additional Mongo lookups in cases                                        //
        // when documents are removed from the published set and need a                                               //
        // replacement.                                                                                               //
        // XXX needs more thought on non-zero skip                                                                    //
        // XXX 2 is a "magic number" meaning there is an extra chunk of docs for                                      //
        // buffer if such is needed.                                                                                  //
        var cursor = self._cursorForQuery({ limit: self._limit * 2 });                                                // 712
        try {                                                                                                         // 728
          cursor.forEach(function (doc, i) {                                                                          // 729
            // yields                                                                                                 //
            if (!self._limit || i < self._limit) newResults.set(doc._id, doc);else newBuffer.set(doc._id, doc);       // 730
          });                                                                                                         //
          break;                                                                                                      // 735
        } catch (e) {                                                                                                 //
          if (options.initial && typeof e.code === 'number') {                                                        // 737
            // This is an error document sent to us by mongod, not a connection                                       //
            // error generated by the client. And we've never seen this query work                                    //
            // successfully. Probably it's a bad selector or something, so we                                         //
            // should NOT retry. Instead, we should halt the observe (which ends                                      //
            // up calling `stop` on us).                                                                              //
            self._multiplexer.queryError(e);                                                                          // 743
            return;                                                                                                   // 744
          }                                                                                                           //
                                                                                                                      //
          // During failover (eg) if we get an exception we should log and retry                                      //
          // instead of crashing.                                                                                     //
          Meteor._debug("Got exception while polling query: " + e);                                                   // 736
          Meteor._sleepForMs(100);                                                                                    // 750
        }                                                                                                             //
      }                                                                                                               //
                                                                                                                      //
      if (self._stopped) return;                                                                                      // 754
                                                                                                                      //
      self._publishNewResults(newResults, newBuffer);                                                                 // 757
    }                                                                                                                 //
                                                                                                                      //
    return _runQuery;                                                                                                 //
  }(),                                                                                                                //
                                                                                                                      //
  // Transitions to QUERYING and runs another query, or (if already in QUERYING)                                      //
  // ensures that we will query again later.                                                                          //
  //                                                                                                                  //
  // This function may not block, because it is called from an oplog entry                                            //
  // handler. However, if we were not already in the QUERYING phase, it throws                                        //
  // an exception that is caught by the closest surrounding                                                           //
  // finishIfNeedToPollQuery call; this ensures that we don't continue running                                        //
  // close that was designed for another phase inside PHASE.QUERYING.                                                 //
  //                                                                                                                  //
  // (It's also necessary whenever logic in this file yields to check that other                                      //
  // phases haven't put us into QUERYING mode, though; eg,                                                            //
  // _fetchModifiedDocuments does this.)                                                                              //
  _needToPollQuery: function () {                                                                                     // 772
    function _needToPollQuery() {                                                                                     // 772
      var self = this;                                                                                                // 773
      Meteor._noYieldsAllowed(function () {                                                                           // 774
        if (self._stopped) return;                                                                                    // 775
                                                                                                                      //
        // If we're not already in the middle of a query, we can query now                                            //
        // (possibly pausing FETCHING).                                                                               //
        if (self._phase !== PHASE.QUERYING) {                                                                         // 774
          self._pollQuery();                                                                                          // 781
          throw new SwitchedToQuery();                                                                                // 782
        }                                                                                                             //
                                                                                                                      //
        // We're currently in QUERYING. Set a flag to ensure that we run another                                      //
        // query when we're done.                                                                                     //
        self._requeryWhenDoneThisQuery = true;                                                                        // 774
      });                                                                                                             //
    }                                                                                                                 //
                                                                                                                      //
    return _needToPollQuery;                                                                                          //
  }(),                                                                                                                //
                                                                                                                      //
  // Yields!                                                                                                          //
  _doneQuerying: function () {                                                                                        // 792
    function _doneQuerying() {                                                                                        // 792
      var self = this;                                                                                                // 793
                                                                                                                      //
      if (self._stopped) return;                                                                                      // 795
      self._mongoHandle._oplogHandle.waitUntilCaughtUp(); // yields                                                   // 797
      if (self._stopped) return;                                                                                      // 792
      if (self._phase !== PHASE.QUERYING) throw Error("Phase unexpectedly " + self._phase);                           // 800
                                                                                                                      //
      Meteor._noYieldsAllowed(function () {                                                                           // 803
        if (self._requeryWhenDoneThisQuery) {                                                                         // 804
          self._requeryWhenDoneThisQuery = false;                                                                     // 805
          self._pollQuery();                                                                                          // 806
        } else if (self._needToFetch.empty()) {                                                                       //
          self._beSteady();                                                                                           // 808
        } else {                                                                                                      //
          self._fetchModifiedDocuments();                                                                             // 810
        }                                                                                                             //
      });                                                                                                             //
    }                                                                                                                 //
                                                                                                                      //
    return _doneQuerying;                                                                                             //
  }(),                                                                                                                //
                                                                                                                      //
  _cursorForQuery: function () {                                                                                      // 815
    function _cursorForQuery(optionsOverwrite) {                                                                      // 815
      var self = this;                                                                                                // 816
      return Meteor._noYieldsAllowed(function () {                                                                    // 817
        // The query we run is almost the same as the cursor we are observing,                                        //
        // with a few changes. We need to read all the fields that are relevant to                                    //
        // the selector, not just the fields we are going to publish (that's the                                      //
        // "shared" projection). And we don't want to apply any transform in the                                      //
        // cursor, because observeChanges shouldn't use the transform.                                                //
        var options = _.clone(self._cursorDescription.options);                                                       // 823
                                                                                                                      //
        // Allow the caller to modify the options. Useful to specify different                                        //
        // skip and limit values.                                                                                     //
        _.extend(options, optionsOverwrite);                                                                          // 817
                                                                                                                      //
        options.fields = self._sharedProjection;                                                                      // 829
        delete options.transform;                                                                                     // 830
        // We are NOT deep cloning fields or selector here, which should be OK.                                       //
        var description = new CursorDescription(self._cursorDescription.collectionName, self._cursorDescription.selector, options);
        return new Cursor(self._mongoHandle, description);                                                            // 836
      });                                                                                                             //
    }                                                                                                                 //
                                                                                                                      //
    return _cursorForQuery;                                                                                           //
  }(),                                                                                                                //
                                                                                                                      //
  // Replace self._published with newResults (both are IdMaps), invoking observe                                      //
  // callbacks on the multiplexer.                                                                                    //
  // Replace self._unpublishedBuffer with newBuffer.                                                                  //
  //                                                                                                                  //
  // XXX This is very similar to LocalCollection._diffQueryUnorderedChanges. We                                       //
  // should really: (a) Unify IdMap and OrderedDict into Unordered/OrderedDict                                        //
  // (b) Rewrite diff.js to use these classes instead of arrays and objects.                                          //
  _publishNewResults: function () {                                                                                   // 848
    function _publishNewResults(newResults, newBuffer) {                                                              // 848
      var self = this;                                                                                                // 849
      Meteor._noYieldsAllowed(function () {                                                                           // 850
                                                                                                                      //
        // If the query is limited and there is a buffer, shut down so it doesn't                                     //
        // stay in a way.                                                                                             //
        if (self._limit) {                                                                                            // 854
          self._unpublishedBuffer.clear();                                                                            // 855
        }                                                                                                             //
                                                                                                                      //
        // First remove anything that's gone. Be careful not to modify                                                //
        // self._published while iterating over it.                                                                   //
        var idsToRemove = [];                                                                                         // 850
        self._published.forEach(function (doc, id) {                                                                  // 861
          if (!newResults.has(id)) idsToRemove.push(id);                                                              // 862
        });                                                                                                           //
        _.each(idsToRemove, function (id) {                                                                           // 865
          self._removePublished(id);                                                                                  // 866
        });                                                                                                           //
                                                                                                                      //
        // Now do adds and changes.                                                                                   //
        // If self has a buffer and limit, the new fetched result will be                                             //
        // limited correctly as the query has sort specifier.                                                         //
        newResults.forEach(function (doc, id) {                                                                       // 850
          self._handleDoc(id, doc);                                                                                   // 873
        });                                                                                                           //
                                                                                                                      //
        // Sanity-check that everything we tried to put into _published ended up                                      //
        // there.                                                                                                     //
        // XXX if this is slow, remove it later                                                                       //
        if (self._published.size() !== newResults.size()) {                                                           // 850
          throw Error("The Mongo server and the Meteor query disagree on how " + "many documents match your query. Maybe it is hitting a Mongo " + "edge case? The query is: " + EJSON.stringify(self._cursorDescription.selector));
        }                                                                                                             //
        self._published.forEach(function (doc, id) {                                                                  // 886
          if (!newResults.has(id)) throw Error("_published has a doc that newResults doesn't; " + id);                // 887
        });                                                                                                           //
                                                                                                                      //
        // Finally, replace the buffer                                                                                //
        newBuffer.forEach(function (doc, id) {                                                                        // 850
          self._addBuffered(id, doc);                                                                                 // 893
        });                                                                                                           //
                                                                                                                      //
        self._safeAppendToBuffer = newBuffer.size() < self._limit;                                                    // 896
      });                                                                                                             //
    }                                                                                                                 //
                                                                                                                      //
    return _publishNewResults;                                                                                        //
  }(),                                                                                                                //
                                                                                                                      //
  // This stop function is invoked from the onStop of the ObserveMultiplexer, so                                      //
  // it shouldn't actually be possible to call it until the multiplexer is                                            //
  // ready.                                                                                                           //
  //                                                                                                                  //
  // It's important to check self._stopped after every call in this file that                                         //
  // can yield!                                                                                                       //
  stop: function () {                                                                                                 // 906
    function stop() {                                                                                                 // 906
      var self = this;                                                                                                // 907
      if (self._stopped) return;                                                                                      // 908
      self._stopped = true;                                                                                           // 910
      _.each(self._stopHandles, function (handle) {                                                                   // 911
        handle.stop();                                                                                                // 912
      });                                                                                                             //
                                                                                                                      //
      // Note: we *don't* use multiplexer.onFlush here because this stop                                              //
      // callback is actually invoked by the multiplexer itself when it has                                           //
      // determined that there are no handles left. So nothing is actually going                                      //
      // to get flushed (and it's probably not valid to call methods on the                                           //
      // dying multiplexer).                                                                                          //
      _.each(self._writesToCommitWhenWeReachSteady, function (w) {                                                    // 906
        w.committed(); // maybe yields?                                                                               // 921
      });                                                                                                             // 920
      self._writesToCommitWhenWeReachSteady = null;                                                                   // 923
                                                                                                                      //
      // Proactively drop references to potentially big things.                                                       //
      self._published = null;                                                                                         // 906
      self._unpublishedBuffer = null;                                                                                 // 927
      self._needToFetch = null;                                                                                       // 928
      self._currentlyFetching = null;                                                                                 // 929
      self._oplogEntryHandle = null;                                                                                  // 930
      self._listenersHandle = null;                                                                                   // 931
                                                                                                                      //
      Package.facts && Package.facts.Facts.incrementServerFact("mongo-livedata", "observe-drivers-oplog", -1);        // 933
    }                                                                                                                 //
                                                                                                                      //
    return stop;                                                                                                      //
  }(),                                                                                                                //
                                                                                                                      //
  _registerPhaseChange: function () {                                                                                 // 937
    function _registerPhaseChange(phase) {                                                                            // 937
      var self = this;                                                                                                // 938
      Meteor._noYieldsAllowed(function () {                                                                           // 939
        var now = new Date();                                                                                         // 940
                                                                                                                      //
        if (self._phase) {                                                                                            // 942
          var timeDiff = now - self._phaseStartTime;                                                                  // 943
          Package.facts && Package.facts.Facts.incrementServerFact("mongo-livedata", "time-spent-in-" + self._phase + "-phase", timeDiff);
        }                                                                                                             //
                                                                                                                      //
        self._phase = phase;                                                                                          // 948
        self._phaseStartTime = now;                                                                                   // 949
      });                                                                                                             //
    }                                                                                                                 //
                                                                                                                      //
    return _registerPhaseChange;                                                                                      //
  }()                                                                                                                 //
});                                                                                                                   //
                                                                                                                      //
// Does our oplog tailing code support this cursor? For now, we are being very                                        //
// conservative and allowing only simple queries with simple options.                                                 //
// (This is a "static method".)                                                                                       //
OplogObserveDriver.cursorSupported = function (cursorDescription, matcher) {                                          // 957
  // First, check the options.                                                                                        //
  var options = cursorDescription.options;                                                                            // 959
                                                                                                                      //
  // Did the user say no explicitly?                                                                                  //
  // underscored version of the option is COMPAT with 1.2                                                             //
  if (options.disableOplog || options._disableOplog) return false;                                                    // 957
                                                                                                                      //
  // skip is not supported: to support it we would need to keep track of all                                          //
  // "skipped" documents or at least their ids.                                                                       //
  // limit w/o a sort specifier is not supported: current implementation needs a                                      //
  // deterministic way to order documents.                                                                            //
  if (options.skip || options.limit && !options.sort) return false;                                                   // 957
                                                                                                                      //
  // If a fields projection option is given check if it is supported by                                               //
  // minimongo (some operators are not supported).                                                                    //
  if (options.fields) {                                                                                               // 957
    try {                                                                                                             // 975
      LocalCollection._checkSupportedProjection(options.fields);                                                      // 976
    } catch (e) {                                                                                                     //
      if (e.name === "MinimongoError") return false;else throw e;                                                     // 978
    }                                                                                                                 //
  }                                                                                                                   //
                                                                                                                      //
  // We don't allow the following selectors:                                                                          //
  //   - $where (not confident that we provide the same JS environment                                                //
  //             as Mongo, and can yield!)                                                                            //
  //   - $near (has "interesting" properties in MongoDB, like the possibility                                         //
  //            of returning an ID multiple times, though even polling maybe                                          //
  //            have a bug there)                                                                                     //
  //           XXX: once we support it, we would need to think more on how we                                         //
  //           initialize the comparators when we create the driver.                                                  //
  return !matcher.hasWhere() && !matcher.hasGeoQuery();                                                               // 957
};                                                                                                                    //
                                                                                                                      //
var modifierCanBeDirectlyApplied = function modifierCanBeDirectlyApplied(modifier) {                                  // 996
  return _.all(modifier, function (fields, operation) {                                                               // 997
    return _.all(fields, function (value, field) {                                                                    // 998
      return !/EJSON\$/.test(field);                                                                                  // 999
    });                                                                                                               //
  });                                                                                                                 //
};                                                                                                                    //
                                                                                                                      //
MongoInternals.OplogObserveDriver = OplogObserveDriver;                                                               // 1004
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"local_collection_driver.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/mongo/local_collection_driver.js                                                                          //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
LocalCollectionDriver = function LocalCollectionDriver() {                                                            // 1
  var self = this;                                                                                                    // 2
  self.noConnCollections = {};                                                                                        // 3
};                                                                                                                    //
                                                                                                                      //
var ensureCollection = function ensureCollection(name, collections) {                                                 // 6
  if (!(name in collections)) collections[name] = new LocalCollection(name);                                          // 7
  return collections[name];                                                                                           // 9
};                                                                                                                    //
                                                                                                                      //
_.extend(LocalCollectionDriver.prototype, {                                                                           // 12
  open: function () {                                                                                                 // 13
    function open(name, conn) {                                                                                       // 13
      var self = this;                                                                                                // 14
      if (!name) return new LocalCollection();                                                                        // 15
      if (!conn) {                                                                                                    // 17
        return ensureCollection(name, self.noConnCollections);                                                        // 18
      }                                                                                                               //
      if (!conn._mongo_livedata_collections) conn._mongo_livedata_collections = {};                                   // 20
      // XXX is there a way to keep track of a connection's collections without                                       //
      // dangling it off the connection object?                                                                       //
      return ensureCollection(name, conn._mongo_livedata_collections);                                                // 13
    }                                                                                                                 //
                                                                                                                      //
    return open;                                                                                                      //
  }()                                                                                                                 //
});                                                                                                                   //
                                                                                                                      //
// singleton                                                                                                          //
LocalCollectionDriver = new LocalCollectionDriver();                                                                  // 29
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"remote_collection_driver.js":function(require){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/mongo/remote_collection_driver.js                                                                         //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
MongoInternals.RemoteCollectionDriver = function (mongo_url, options) {                                               // 1
  var self = this;                                                                                                    // 3
  self.mongo = new MongoConnection(mongo_url, options);                                                               // 4
};                                                                                                                    //
                                                                                                                      //
_.extend(MongoInternals.RemoteCollectionDriver.prototype, {                                                           // 7
  open: function () {                                                                                                 // 8
    function open(name) {                                                                                             // 8
      var self = this;                                                                                                // 9
      var ret = {};                                                                                                   // 10
      _.each(['find', 'findOne', 'insert', 'update', 'upsert', 'remove', '_ensureIndex', '_dropIndex', '_createCappedCollection', 'dropCollection', 'rawCollection'], function (m) {
        ret[m] = _.bind(self.mongo[m], self.mongo, name);                                                             // 16
      });                                                                                                             //
      return ret;                                                                                                     // 18
    }                                                                                                                 //
                                                                                                                      //
    return open;                                                                                                      //
  }()                                                                                                                 //
});                                                                                                                   //
                                                                                                                      //
// Create the singleton RemoteCollectionDriver only on demand, so we                                                  //
// only require Mongo configuration if it's actually used (eg, not if                                                 //
// you're only trying to receive data from a remote DDP server.)                                                      //
MongoInternals.defaultRemoteCollectionDriver = _.once(function () {                                                   // 26
  var connectionOptions = {};                                                                                         // 27
                                                                                                                      //
  var mongoUrl = process.env.MONGO_URL;                                                                               // 29
                                                                                                                      //
  if (process.env.MONGO_OPLOG_URL) {                                                                                  // 31
    connectionOptions.oplogUrl = process.env.MONGO_OPLOG_URL;                                                         // 32
  }                                                                                                                   //
                                                                                                                      //
  if (!mongoUrl) throw new Error("MONGO_URL must be set in environment");                                             // 35
                                                                                                                      //
  return new MongoInternals.RemoteCollectionDriver(mongoUrl, connectionOptions);                                      // 38
});                                                                                                                   //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"collection.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/mongo/collection.js                                                                                       //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
// options.connection, if given, is a LivedataClient or LivedataServer                                                //
// XXX presently there is no way to destroy/clean up a Collection                                                     //
                                                                                                                      //
/**                                                                                                                   //
 * @summary Namespace for MongoDB-related items                                                                       //
 * @namespace                                                                                                         //
 */                                                                                                                   //
Mongo = {};                                                                                                           // 8
                                                                                                                      //
/**                                                                                                                   //
 * @summary Constructor for a Collection                                                                              //
 * @locus Anywhere                                                                                                    //
 * @instancename collection                                                                                           //
 * @class                                                                                                             //
 * @param {String} name The name of the collection.  If null, creates an unmanaged (unsynchronized) local collection.
 * @param {Object} [options]                                                                                          //
 * @param {Object} options.connection The server connection that will manage this collection. Uses the default connection if not specified.  Pass the return value of calling [`DDP.connect`](#ddp_connect) to specify a different server. Pass `null` to specify no connection. Unmanaged (`name` is null) collections cannot specify a connection.
 * @param {String} options.idGeneration The method of generating the `_id` fields of new documents in this collection.  Possible values:
                                                                                                                      //
 - **`'STRING'`**: random strings                                                                                     //
 - **`'MONGO'`**:  random [`Mongo.ObjectID`](#mongo_object_id) values                                                 //
                                                                                                                      //
The default id generation technique is `'STRING'`.                                                                    //
 * @param {Function} options.transform An optional transformation function. Documents will be passed through this function before being returned from `fetch` or `findOne`, and before being passed to callbacks of `observe`, `map`, `forEach`, `allow`, and `deny`. Transforms are *not* applied for the callbacks of `observeChanges` or to cursors returned from publish functions.
 */                                                                                                                   //
Mongo.Collection = function (name, options) {                                                                         // 26
  var self = this;                                                                                                    // 27
  if (!(self instanceof Mongo.Collection)) throw new Error('use "new" to construct a Mongo.Collection');              // 28
                                                                                                                      //
  if (!name && name !== null) {                                                                                       // 31
    Meteor._debug("Warning: creating anonymous collection. It will not be " + "saved or synchronized over the network. (Pass null for " + "the collection name to turn off this warning.)");
    name = null;                                                                                                      // 35
  }                                                                                                                   //
                                                                                                                      //
  if (name !== null && typeof name !== "string") {                                                                    // 38
    throw new Error("First argument to new Mongo.Collection must be a string or null");                               // 39
  }                                                                                                                   //
                                                                                                                      //
  if (options && options.methods) {                                                                                   // 43
    // Backwards compatibility hack with original signature (which passed                                             //
    // "connection" directly instead of in options. (Connections must have a "methods"                                //
    // method.)                                                                                                       //
    // XXX remove before 1.0                                                                                          //
    options = { connection: options };                                                                                // 48
  }                                                                                                                   //
  // Backwards compatibility: "connection" used to be called "manager".                                               //
  if (options && options.manager && !options.connection) {                                                            // 26
    options.connection = options.manager;                                                                             // 52
  }                                                                                                                   //
  options = _.extend({                                                                                                // 54
    connection: undefined,                                                                                            // 55
    idGeneration: 'STRING',                                                                                           // 56
    transform: null,                                                                                                  // 57
    _driver: undefined,                                                                                               // 58
    _preventAutopublish: false                                                                                        // 59
  }, options);                                                                                                        //
                                                                                                                      //
  switch (options.idGeneration) {                                                                                     // 62
    case 'MONGO':                                                                                                     // 63
      self._makeNewID = function () {                                                                                 // 64
        var src = name ? DDP.randomStream('/collection/' + name) : Random.insecure;                                   // 65
        return new Mongo.ObjectID(src.hexString(24));                                                                 // 68
      };                                                                                                              //
      break;                                                                                                          // 70
    case 'STRING':                                                                                                    // 62
    default:                                                                                                          // 72
      self._makeNewID = function () {                                                                                 // 73
        var src = name ? DDP.randomStream('/collection/' + name) : Random.insecure;                                   // 74
        return src.id();                                                                                              // 77
      };                                                                                                              //
      break;                                                                                                          // 79
  }                                                                                                                   // 62
                                                                                                                      //
  self._transform = LocalCollection.wrapTransform(options.transform);                                                 // 82
                                                                                                                      //
  if (!name || options.connection === null)                                                                           // 84
    // note: nameless collections never have a connection                                                             //
    self._connection = null;else if (options.connection) self._connection = options.connection;else if (Meteor.isClient) self._connection = Meteor.connection;else self._connection = Meteor.server;
                                                                                                                      //
  if (!options._driver) {                                                                                             // 94
    // XXX This check assumes that webapp is loaded so that Meteor.server !==                                         //
    // null. We should fully support the case of "want to use a Mongo-backed                                          //
    // collection from Node code without webapp", but we don't yet.                                                   //
    // #MeteorServerNull                                                                                              //
    if (name && self._connection === Meteor.server && typeof MongoInternals !== "undefined" && MongoInternals.defaultRemoteCollectionDriver) {
      options._driver = MongoInternals.defaultRemoteCollectionDriver();                                               // 102
    } else {                                                                                                          //
      options._driver = LocalCollectionDriver;                                                                        // 104
    }                                                                                                                 //
  }                                                                                                                   //
                                                                                                                      //
  self._collection = options._driver.open(name, self._connection);                                                    // 108
  self._name = name;                                                                                                  // 109
  self._driver = options._driver;                                                                                     // 110
                                                                                                                      //
  if (self._connection && self._connection.registerStore) {                                                           // 112
    // OK, we're going to be a slave, replicating some remote                                                         //
    // database, except possibly with some temporary divergence while                                                 //
    // we have unacknowledged RPC's.                                                                                  //
    var ok = self._connection.registerStore(name, {                                                                   // 116
      // Called at the beginning of a batch of updates. batchSize is the number                                       //
      // of update calls to expect.                                                                                   //
      //                                                                                                              //
      // XXX This interface is pretty janky. reset probably ought to go back to                                       //
      // being its own function, and callers shouldn't have to calculate                                              //
      // batchSize. The optimization of not calling pause/remove should be                                            //
      // delayed until later: the first call to update() should buffer its                                            //
      // message, and then we can either directly apply it at endUpdate time if                                       //
      // it was the only update, or do pauseObservers/apply/apply at the next                                         //
      // update() if there's another one.                                                                             //
      beginUpdate: function () {                                                                                      // 127
        function beginUpdate(batchSize, reset) {                                                                      // 127
          // pause observers so users don't see flicker when updating several                                         //
          // objects at once (including the post-reconnect reset-and-reapply                                          //
          // stage), and so that a re-sorting of a query can take advantage of the                                    //
          // full _diffQuery moved calculation instead of applying change one at a                                    //
          // time.                                                                                                    //
          if (batchSize > 1 || reset) self._collection.pauseObservers();                                              // 133
                                                                                                                      //
          if (reset) self._collection.remove({});                                                                     // 136
        }                                                                                                             //
                                                                                                                      //
        return beginUpdate;                                                                                           //
      }(),                                                                                                            //
                                                                                                                      //
      // Apply an update.                                                                                             //
      // XXX better specify this interface (not in terms of a wire message)?                                          //
      update: function () {                                                                                           // 142
        function update(msg) {                                                                                        // 142
          var mongoId = MongoID.idParse(msg.id);                                                                      // 143
          var doc = self._collection.findOne(mongoId);                                                                // 144
                                                                                                                      //
          // Is this a "replace the whole doc" message coming from the quiescence                                     //
          // of method writes to an object? (Note that 'undefined' is a valid                                         //
          // value meaning "remove it".)                                                                              //
          if (msg.msg === 'replace') {                                                                                // 142
            var replace = msg.replace;                                                                                // 150
            if (!replace) {                                                                                           // 151
              if (doc) self._collection.remove(mongoId);                                                              // 152
            } else if (!doc) {                                                                                        //
              self._collection.insert(replace);                                                                       // 155
            } else {                                                                                                  //
              // XXX check that replace has no $ ops                                                                  //
              self._collection.update(mongoId, replace);                                                              // 158
            }                                                                                                         //
            return;                                                                                                   // 160
          } else if (msg.msg === 'added') {                                                                           //
            if (doc) {                                                                                                // 162
              throw new Error("Expected not to find a document already present for an add");                          // 163
            }                                                                                                         //
            self._collection.insert(_.extend({ _id: mongoId }, msg.fields));                                          // 165
          } else if (msg.msg === 'removed') {                                                                         //
            if (!doc) throw new Error("Expected to find a document already present for removed");                     // 167
            self._collection.remove(mongoId);                                                                         // 169
          } else if (msg.msg === 'changed') {                                                                         //
            if (!doc) throw new Error("Expected to find a document to change");                                       // 171
            if (!_.isEmpty(msg.fields)) {                                                                             // 173
              var modifier = {};                                                                                      // 174
              _.each(msg.fields, function (value, key) {                                                              // 175
                if (value === undefined) {                                                                            // 176
                  if (!modifier.$unset) modifier.$unset = {};                                                         // 177
                  modifier.$unset[key] = 1;                                                                           // 179
                } else {                                                                                              //
                  if (!modifier.$set) modifier.$set = {};                                                             // 181
                  modifier.$set[key] = value;                                                                         // 183
                }                                                                                                     //
              });                                                                                                     //
              self._collection.update(mongoId, modifier);                                                             // 186
            }                                                                                                         //
          } else {                                                                                                    //
            throw new Error("I don't know how to deal with this message");                                            // 189
          }                                                                                                           //
        }                                                                                                             //
                                                                                                                      //
        return update;                                                                                                //
      }(),                                                                                                            //
                                                                                                                      //
      // Called at the end of a batch of updates.                                                                     //
      endUpdate: function () {                                                                                        // 195
        function endUpdate() {                                                                                        // 195
          self._collection.resumeObservers();                                                                         // 196
        }                                                                                                             //
                                                                                                                      //
        return endUpdate;                                                                                             //
      }(),                                                                                                            //
                                                                                                                      //
      // Called around method stub invocations to capture the original versions                                       //
      // of modified documents.                                                                                       //
      saveOriginals: function () {                                                                                    // 201
        function saveOriginals() {                                                                                    // 201
          self._collection.saveOriginals();                                                                           // 202
        }                                                                                                             //
                                                                                                                      //
        return saveOriginals;                                                                                         //
      }(),                                                                                                            //
      retrieveOriginals: function () {                                                                                // 204
        function retrieveOriginals() {                                                                                // 204
          return self._collection.retrieveOriginals();                                                                // 205
        }                                                                                                             //
                                                                                                                      //
        return retrieveOriginals;                                                                                     //
      }(),                                                                                                            //
                                                                                                                      //
      // Used to preserve current versions of documents across a store reset.                                         //
      getDoc: function () {                                                                                           // 209
        function getDoc(id) {                                                                                         // 209
          return self.findOne(id);                                                                                    // 210
        }                                                                                                             //
                                                                                                                      //
        return getDoc;                                                                                                //
      }(),                                                                                                            //
                                                                                                                      //
      // To be able to get back to the collection from the store.                                                     //
      _getCollection: function () {                                                                                   // 214
        function _getCollection() {                                                                                   // 214
          return self;                                                                                                // 215
        }                                                                                                             //
                                                                                                                      //
        return _getCollection;                                                                                        //
      }()                                                                                                             //
    });                                                                                                               //
                                                                                                                      //
    if (!ok) throw new Error("There is already a collection named '" + name + "'");                                   // 219
  }                                                                                                                   //
                                                                                                                      //
  // XXX don't define these until allow or deny is actually used for this                                             //
  // collection. Could be hard if the security rules are only defined on the                                          //
  // server.                                                                                                          //
  self._defineMutationMethods();                                                                                      // 26
                                                                                                                      //
  // autopublish                                                                                                      //
  if (Package.autopublish && !options._preventAutopublish && self._connection && self._connection.publish) {          // 26
    self._connection.publish(null, function () {                                                                      // 231
      return self.find();                                                                                             // 232
    }, { is_auto: true });                                                                                            //
  }                                                                                                                   //
};                                                                                                                    //
                                                                                                                      //
///                                                                                                                   //
/// Main collection API                                                                                               //
///                                                                                                                   //
                                                                                                                      //
_.extend(Mongo.Collection.prototype, {                                                                                // 242
                                                                                                                      //
  _getFindSelector: function () {                                                                                     // 244
    function _getFindSelector(args) {                                                                                 // 244
      if (args.length == 0) return {};else return args[0];                                                            // 245
    }                                                                                                                 //
                                                                                                                      //
    return _getFindSelector;                                                                                          //
  }(),                                                                                                                //
                                                                                                                      //
  _getFindOptions: function () {                                                                                      // 251
    function _getFindOptions(args) {                                                                                  // 251
      var self = this;                                                                                                // 252
      if (args.length < 2) {                                                                                          // 253
        return { transform: self._transform };                                                                        // 254
      } else {                                                                                                        //
        check(args[1], Match.Optional(Match.ObjectIncluding({                                                         // 256
          fields: Match.Optional(Match.OneOf(Object, undefined)),                                                     // 257
          sort: Match.Optional(Match.OneOf(Object, Array, undefined)),                                                // 258
          limit: Match.Optional(Match.OneOf(Number, undefined)),                                                      // 259
          skip: Match.Optional(Match.OneOf(Number, undefined))                                                        // 260
        })));                                                                                                         //
                                                                                                                      //
        return _.extend({                                                                                             // 263
          transform: self._transform                                                                                  // 264
        }, args[1]);                                                                                                  //
      }                                                                                                               //
    }                                                                                                                 //
                                                                                                                      //
    return _getFindOptions;                                                                                           //
  }(),                                                                                                                //
                                                                                                                      //
  /**                                                                                                                 //
   * @summary Find the documents in a collection that match the selector.                                             //
   * @locus Anywhere                                                                                                  //
   * @method find                                                                                                     //
   * @memberOf Mongo.Collection                                                                                       //
   * @instance                                                                                                        //
   * @param {MongoSelector} [selector] A query describing the documents to find                                       //
   * @param {Object} [options]                                                                                        //
   * @param {MongoSortSpecifier} options.sort Sort order (default: natural order)                                     //
   * @param {Number} options.skip Number of results to skip at the beginning                                          //
   * @param {Number} options.limit Maximum number of results to return                                                //
   * @param {MongoFieldSpecifier} options.fields Dictionary of fields to return or exclude.                           //
   * @param {Boolean} options.reactive (Client only) Default `true`; pass `false` to disable reactivity               //
   * @param {Function} options.transform Overrides `transform` on the  [`Collection`](#collections) for this cursor.  Pass `null` to disable transformation.
   * @param {Boolean} options.disableOplog (Server only) Pass true to disable oplog-tailing on this query. This affects the way server processes calls to `observe` on this query. Disabling the oplog can be useful when working with data that updates in large batches.
   * @param {Number} options.pollingIntervalMs (Server only) How often to poll this query when observing on the server. In milliseconds. Defaults to 10 seconds.
   * @param {Number} options.pollingThrottleMs (Server only) Minimum time to allow between re-polling. Increasing this will save CPU and mongo load at the expense of slower updates to users. Decreasing this is not recommended. In milliseconds. Defaults to 50 milliseconds.
   * @returns {Mongo.Cursor}                                                                                          //
   */                                                                                                                 //
  find: function () {                                                                                                 // 288
    function find() /* selector, options */{                                                                          // 288
      // Collection.find() (return all docs) behaves differently                                                      //
      // from Collection.find(undefined) (return 0 docs).  so be                                                      //
      // careful about the length of arguments.                                                                       //
      var self = this;                                                                                                // 292
      var argArray = _.toArray(arguments);                                                                            // 293
      return self._collection.find(self._getFindSelector(argArray), self._getFindOptions(argArray));                  // 294
    }                                                                                                                 //
                                                                                                                      //
    return find;                                                                                                      //
  }(),                                                                                                                //
                                                                                                                      //
  /**                                                                                                                 //
   * @summary Finds the first document that matches the selector, as ordered by sort and skip options.                //
   * @locus Anywhere                                                                                                  //
   * @method findOne                                                                                                  //
   * @memberOf Mongo.Collection                                                                                       //
   * @instance                                                                                                        //
   * @param {MongoSelector} [selector] A query describing the documents to find                                       //
   * @param {Object} [options]                                                                                        //
   * @param {MongoSortSpecifier} options.sort Sort order (default: natural order)                                     //
   * @param {Number} options.skip Number of results to skip at the beginning                                          //
   * @param {MongoFieldSpecifier} options.fields Dictionary of fields to return or exclude.                           //
   * @param {Boolean} options.reactive (Client only) Default true; pass false to disable reactivity                   //
   * @param {Function} options.transform Overrides `transform` on the [`Collection`](#collections) for this cursor.  Pass `null` to disable transformation.
   * @returns {Object}                                                                                                //
   */                                                                                                                 //
  findOne: function () {                                                                                              // 313
    function findOne() /* selector, options */{                                                                       // 313
      var self = this;                                                                                                // 314
      var argArray = _.toArray(arguments);                                                                            // 315
      return self._collection.findOne(self._getFindSelector(argArray), self._getFindOptions(argArray));               // 316
    }                                                                                                                 //
                                                                                                                      //
    return findOne;                                                                                                   //
  }()                                                                                                                 //
                                                                                                                      //
});                                                                                                                   //
                                                                                                                      //
Mongo.Collection._publishCursor = function (cursor, sub, collection) {                                                // 322
  var observeHandle = cursor.observeChanges({                                                                         // 323
    added: function () {                                                                                              // 324
      function added(id, fields) {                                                                                    // 324
        sub.added(collection, id, fields);                                                                            // 325
      }                                                                                                               //
                                                                                                                      //
      return added;                                                                                                   //
    }(),                                                                                                              //
    changed: function () {                                                                                            // 327
      function changed(id, fields) {                                                                                  // 327
        sub.changed(collection, id, fields);                                                                          // 328
      }                                                                                                               //
                                                                                                                      //
      return changed;                                                                                                 //
    }(),                                                                                                              //
    removed: function () {                                                                                            // 330
      function removed(id) {                                                                                          // 330
        sub.removed(collection, id);                                                                                  // 331
      }                                                                                                               //
                                                                                                                      //
      return removed;                                                                                                 //
    }()                                                                                                               //
  });                                                                                                                 //
                                                                                                                      //
  // We don't call sub.ready() here: it gets called in livedata_server, after                                         //
  // possibly calling _publishCursor on multiple returned cursors.                                                    //
                                                                                                                      //
  // register stop callback (expects lambda w/ no args).                                                              //
  sub.onStop(function () {                                                                                            // 322
    observeHandle.stop();                                                                                             // 339
  });                                                                                                                 //
                                                                                                                      //
  // return the observeHandle in case it needs to be stopped early                                                    //
  return observeHandle;                                                                                               // 322
};                                                                                                                    //
                                                                                                                      //
// protect against dangerous selectors.  falsey and {_id: falsey} are both                                            //
// likely programmer error, and not what you want, particularly for destructive                                       //
// operations.  JS regexps don't serialize over DDP but can be trivially                                              //
// replaced by $regex.                                                                                                //
Mongo.Collection._rewriteSelector = function (selector) {                                                             // 349
  // shorthand -- scalars match _id                                                                                   //
  if (LocalCollection._selectorIsId(selector)) selector = { _id: selector };                                          // 351
                                                                                                                      //
  if (_.isArray(selector)) {                                                                                          // 354
    // This is consistent with the Mongo console itself; if we don't do this                                          //
    // check passing an empty array ends up selecting all items                                                       //
    throw new Error("Mongo selector can't be an array.");                                                             // 357
  }                                                                                                                   //
                                                                                                                      //
  if (!selector || '_id' in selector && !selector._id)                                                                // 360
    // can't match anything                                                                                           //
    return { _id: Random.id() };                                                                                      // 362
                                                                                                                      //
  var ret = {};                                                                                                       // 364
  _.each(selector, function (value, key) {                                                                            // 365
    // Mongo supports both {field: /foo/} and {field: {$regex: /foo/}}                                                //
    if (value instanceof RegExp) {                                                                                    // 367
      ret[key] = convertRegexpToMongoSelector(value);                                                                 // 368
    } else if (value && value.$regex instanceof RegExp) {                                                             //
      ret[key] = convertRegexpToMongoSelector(value.$regex);                                                          // 370
      // if value is {$regex: /foo/, $options: ...} then $options                                                     //
      // override the ones set on $regex.                                                                             //
      if (value.$options !== undefined) ret[key].$options = value.$options;                                           // 369
    } else if (_.contains(['$or', '$and', '$nor'], key)) {                                                            //
      // Translate lower levels of $and/$or/$nor                                                                      //
      ret[key] = _.map(value, function (v) {                                                                          // 378
        return Mongo.Collection._rewriteSelector(v);                                                                  // 379
      });                                                                                                             //
    } else {                                                                                                          //
      ret[key] = value;                                                                                               // 382
    }                                                                                                                 //
  });                                                                                                                 //
  return ret;                                                                                                         // 385
};                                                                                                                    //
                                                                                                                      //
// convert a JS RegExp object to a Mongo {$regex: ..., $options: ...}                                                 //
// selector                                                                                                           //
function convertRegexpToMongoSelector(regexp) {                                                                       // 390
  check(regexp, RegExp); // safety belt                                                                               // 391
                                                                                                                      //
  var selector = { $regex: regexp.source };                                                                           // 390
  var regexOptions = '';                                                                                              // 394
  // JS RegExp objects support 'i', 'm', and 'g'. Mongo regex $options                                                //
  // support 'i', 'm', 'x', and 's'. So we support 'i' and 'm' here.                                                  //
  if (regexp.ignoreCase) regexOptions += 'i';                                                                         // 390
  if (regexp.multiline) regexOptions += 'm';                                                                          // 399
  if (regexOptions) selector.$options = regexOptions;                                                                 // 401
                                                                                                                      //
  return selector;                                                                                                    // 404
};                                                                                                                    //
                                                                                                                      //
// 'insert' immediately returns the inserted document's new _id.                                                      //
// The others return values immediately if you are in a stub, an in-memory                                            //
// unmanaged collection, or a mongo-backed collection and you don't pass a                                            //
// callback. 'update' and 'remove' return the number of affected                                                      //
// documents. 'upsert' returns an object with keys 'numberAffected' and, if an                                        //
// insert happened, 'insertedId'.                                                                                     //
//                                                                                                                    //
// Otherwise, the semantics are exactly like other methods: they take                                                 //
// a callback as an optional last argument; if no callback is                                                         //
// provided, they block until the operation is complete, and throw an                                                 //
// exception if it fails; if a callback is provided, then they don't                                                  //
// necessarily block, and they call the callback when they finish with error and                                      //
// result arguments.  (The insert method provides the document ID as its result;                                      //
// update and remove provide the number of affected docs as the result; upsert                                        //
// provides an object with numberAffected and maybe insertedId.)                                                      //
//                                                                                                                    //
// On the client, blocking is impossible, so if a callback                                                            //
// isn't provided, they just return immediately and any error                                                         //
// information is lost.                                                                                               //
//                                                                                                                    //
// There's one more tweak. On the client, if you don't provide a                                                      //
// callback, then if there is an error, a message will be logged with                                                 //
// Meteor._debug.                                                                                                     //
//                                                                                                                    //
// The intent (though this is actually determined by the underlying                                                   //
// drivers) is that the operations should be done synchronously, not                                                  //
// generating their result until the database has acknowledged                                                        //
// them. In the future maybe we should provide a flag to turn this                                                    //
// off.                                                                                                               //
                                                                                                                      //
/**                                                                                                                   //
 * @summary Insert a document in the collection.  Returns its unique _id.                                             //
 * @locus Anywhere                                                                                                    //
 * @method  insert                                                                                                    //
 * @memberOf Mongo.Collection                                                                                         //
 * @instance                                                                                                          //
 * @param {Object} doc The document to insert. May not yet have an _id attribute, in which case Meteor will generate one for you.
 * @param {Function} [callback] Optional.  If present, called with an error object as the first argument and, if no error, the _id as the second.
 */                                                                                                                   //
Mongo.Collection.prototype.insert = function () {                                                                     // 446
  function insert(doc, callback) {                                                                                    // 446
    // Make sure we were passed a document to insert                                                                  //
    if (!doc) {                                                                                                       // 448
      throw new Error("insert requires an argument");                                                                 // 449
    }                                                                                                                 //
                                                                                                                      //
    // Shallow-copy the document and possibly generate an ID                                                          //
    doc = _.extend({}, doc);                                                                                          // 446
                                                                                                                      //
    if ('_id' in doc) {                                                                                               // 455
      if (!doc._id || !(typeof doc._id === 'string' || doc._id instanceof Mongo.ObjectID)) {                          // 456
        throw new Error("Meteor requires document _id fields to be non-empty strings or ObjectIDs");                  // 458
      }                                                                                                               //
    } else {                                                                                                          //
      var generateId = true;                                                                                          // 461
                                                                                                                      //
      // Don't generate the id if we're the client and the 'outermost' call                                           //
      // This optimization saves us passing both the randomSeed and the id                                            //
      // Passing both is redundant.                                                                                   //
      if (this._isRemoteCollection()) {                                                                               // 460
        var enclosing = DDP._CurrentInvocation.get();                                                                 // 467
        if (!enclosing) {                                                                                             // 468
          generateId = false;                                                                                         // 469
        }                                                                                                             //
      }                                                                                                               //
                                                                                                                      //
      if (generateId) {                                                                                               // 473
        doc._id = this._makeNewID();                                                                                  // 474
      }                                                                                                               //
    }                                                                                                                 //
                                                                                                                      //
    // On inserts, always return the id that we generated; on all other                                               //
    // operations, just return the result from the collection.                                                        //
    var chooseReturnValueFromCollectionResult = function () {                                                         // 446
      function chooseReturnValueFromCollectionResult(result) {                                                        // 480
        if (doc._id) {                                                                                                // 481
          return doc._id;                                                                                             // 482
        }                                                                                                             //
                                                                                                                      //
        // XXX what is this for??                                                                                     //
        // It's some iteraction between the callback to _callMutatorMethod and                                        //
        // the return value conversion                                                                                //
        doc._id = result;                                                                                             // 480
                                                                                                                      //
        return result;                                                                                                // 490
      }                                                                                                               //
                                                                                                                      //
      return chooseReturnValueFromCollectionResult;                                                                   //
    }();                                                                                                              //
                                                                                                                      //
    var wrappedCallback = wrapCallback(callback, chooseReturnValueFromCollectionResult);                              // 493
                                                                                                                      //
    if (this._isRemoteCollection()) {                                                                                 // 496
      var result = this._callMutatorMethod("insert", [doc], wrappedCallback);                                         // 497
      return chooseReturnValueFromCollectionResult(result);                                                           // 498
    }                                                                                                                 //
                                                                                                                      //
    // it's my collection.  descend into the collection object                                                        //
    // and propagate any exception.                                                                                   //
    try {                                                                                                             // 446
      // If the user provided a callback and the collection implements this                                           //
      // operation asynchronously, then queryRet will be undefined, and the                                           //
      // result will be returned through the callback instead.                                                        //
      var _result = this._collection.insert(doc, wrappedCallback);                                                    // 507
      return chooseReturnValueFromCollectionResult(_result);                                                          // 508
    } catch (e) {                                                                                                     //
      if (callback) {                                                                                                 // 510
        callback(e);                                                                                                  // 511
        return null;                                                                                                  // 512
      }                                                                                                               //
      throw e;                                                                                                        // 514
    }                                                                                                                 //
  }                                                                                                                   //
                                                                                                                      //
  return insert;                                                                                                      //
}();                                                                                                                  //
                                                                                                                      //
/**                                                                                                                   //
 * @summary Modify one or more documents in the collection. Returns the number of affected documents.                 //
 * @locus Anywhere                                                                                                    //
 * @method update                                                                                                     //
 * @memberOf Mongo.Collection                                                                                         //
 * @instance                                                                                                          //
 * @param {MongoSelector} selector Specifies which documents to modify                                                //
 * @param {MongoModifier} modifier Specifies how to modify the documents                                              //
 * @param {Object} [options]                                                                                          //
 * @param {Boolean} options.multi True to modify all matching documents; false to only modify one of the matching documents (the default).
 * @param {Boolean} options.upsert True to insert a document if no matching documents are found.                      //
 * @param {Function} [callback] Optional.  If present, called with an error object as the first argument and, if no error, the number of affected documents as the second.
 */                                                                                                                   //
Mongo.Collection.prototype.update = function () {                                                                     // 531
  function update(selector, modifier) {                                                                               // 531
    for (var _len = arguments.length, optionsAndCallback = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
      optionsAndCallback[_key - 2] = arguments[_key];                                                                 //
    }                                                                                                                 //
                                                                                                                      //
    var callback = popCallbackFromArgs(optionsAndCallback);                                                           // 532
                                                                                                                      //
    selector = Mongo.Collection._rewriteSelector(selector);                                                           // 534
                                                                                                                      //
    // We've already popped off the callback, so we are left with an array                                            //
    // of one or zero items                                                                                           //
    var options = _.clone(optionsAndCallback[0]) || {};                                                               // 531
    if (options && options.upsert) {                                                                                  // 539
      // set `insertedId` if absent.  `insertedId` is a Meteor extension.                                             //
      if (options.insertedId) {                                                                                       // 541
        if (!(typeof options.insertedId === 'string' || options.insertedId instanceof Mongo.ObjectID)) throw new Error("insertedId must be string or ObjectID");
      } else if (!selector._id) {                                                                                     //
        options.insertedId = this._makeNewID();                                                                       // 546
      }                                                                                                               //
    }                                                                                                                 //
                                                                                                                      //
    var wrappedCallback = wrapCallback(callback);                                                                     // 550
                                                                                                                      //
    if (this._isRemoteCollection()) {                                                                                 // 552
      var args = [selector, modifier, options];                                                                       // 553
                                                                                                                      //
      return this._callMutatorMethod("update", args, wrappedCallback);                                                // 559
    }                                                                                                                 //
                                                                                                                      //
    // it's my collection.  descend into the collection object                                                        //
    // and propagate any exception.                                                                                   //
    try {                                                                                                             // 531
      // If the user provided a callback and the collection implements this                                           //
      // operation asynchronously, then queryRet will be undefined, and the                                           //
      // result will be returned through the callback instead.                                                        //
      return this._collection.update(selector, modifier, options, wrappedCallback);                                   // 568
    } catch (e) {                                                                                                     //
      if (callback) {                                                                                                 // 571
        callback(e);                                                                                                  // 572
        return null;                                                                                                  // 573
      }                                                                                                               //
      throw e;                                                                                                        // 575
    }                                                                                                                 //
  }                                                                                                                   //
                                                                                                                      //
  return update;                                                                                                      //
}();                                                                                                                  //
                                                                                                                      //
/**                                                                                                                   //
 * @summary Remove documents from the collection                                                                      //
 * @locus Anywhere                                                                                                    //
 * @method remove                                                                                                     //
 * @memberOf Mongo.Collection                                                                                         //
 * @instance                                                                                                          //
 * @param {MongoSelector} selector Specifies which documents to remove                                                //
 * @param {Function} [callback] Optional.  If present, called with an error object as its argument.                   //
 */                                                                                                                   //
Mongo.Collection.prototype.remove = function () {                                                                     // 588
  function remove(selector, callback) {                                                                               // 588
    selector = Mongo.Collection._rewriteSelector(selector);                                                           // 589
                                                                                                                      //
    var wrappedCallback = wrapCallback(callback);                                                                     // 591
                                                                                                                      //
    if (this._isRemoteCollection()) {                                                                                 // 593
      return this._callMutatorMethod("remove", [selector], wrappedCallback);                                          // 594
    }                                                                                                                 //
                                                                                                                      //
    // it's my collection.  descend into the collection object                                                        //
    // and propagate any exception.                                                                                   //
    try {                                                                                                             // 588
      // If the user provided a callback and the collection implements this                                           //
      // operation asynchronously, then queryRet will be undefined, and the                                           //
      // result will be returned through the callback instead.                                                        //
      return this._collection.remove(selector, wrappedCallback);                                                      // 603
    } catch (e) {                                                                                                     //
      if (callback) {                                                                                                 // 605
        callback(e);                                                                                                  // 606
        return null;                                                                                                  // 607
      }                                                                                                               //
      throw e;                                                                                                        // 609
    }                                                                                                                 //
  }                                                                                                                   //
                                                                                                                      //
  return remove;                                                                                                      //
}();                                                                                                                  //
                                                                                                                      //
// Determine if this collection is simply a minimongo representation of a real                                        //
// database on another server                                                                                         //
Mongo.Collection.prototype._isRemoteCollection = function () {                                                        // 615
  function _isRemoteCollection() {                                                                                    // 615
    // XXX see #MeteorServerNull                                                                                      //
    return this._connection && this._connection !== Meteor.server;                                                    // 617
  }                                                                                                                   //
                                                                                                                      //
  return _isRemoteCollection;                                                                                         //
}();                                                                                                                  //
                                                                                                                      //
// Convert the callback to not return a result if there is an error                                                   //
function wrapCallback(callback, convertResult) {                                                                      // 621
  if (!callback) {                                                                                                    // 622
    return;                                                                                                           // 623
  }                                                                                                                   //
                                                                                                                      //
  // If no convert function was passed in, just use a "blank function"                                                //
  convertResult = convertResult || _.identity;                                                                        // 621
                                                                                                                      //
  return function (error, result) {                                                                                   // 629
    callback(error, !error && convertResult(result));                                                                 // 630
  };                                                                                                                  //
}                                                                                                                     //
                                                                                                                      //
/**                                                                                                                   //
 * @summary Modify one or more documents in the collection, or insert one if no matching documents were found. Returns an object with keys `numberAffected` (the number of documents modified)  and `insertedId` (the unique _id of the document that was inserted, if any).
 * @locus Anywhere                                                                                                    //
 * @param {MongoSelector} selector Specifies which documents to modify                                                //
 * @param {MongoModifier} modifier Specifies how to modify the documents                                              //
 * @param {Object} [options]                                                                                          //
 * @param {Boolean} options.multi True to modify all matching documents; false to only modify one of the matching documents (the default).
 * @param {Function} [callback] Optional.  If present, called with an error object as the first argument and, if no error, the number of affected documents as the second.
 */                                                                                                                   //
Mongo.Collection.prototype.upsert = function () {                                                                     // 643
  function upsert(selector, modifier, options, callback) {                                                            // 643
    if (!callback && typeof options === "function") {                                                                 // 645
      callback = options;                                                                                             // 646
      options = {};                                                                                                   // 647
    }                                                                                                                 //
                                                                                                                      //
    var updateOptions = _.extend({}, options, {                                                                       // 650
      _returnObject: true,                                                                                            // 651
      upsert: true                                                                                                    // 652
    });                                                                                                               //
                                                                                                                      //
    return this.update(selector, modifier, updateOptions, callback);                                                  // 655
  }                                                                                                                   //
                                                                                                                      //
  return upsert;                                                                                                      //
}();                                                                                                                  //
                                                                                                                      //
// We'll actually design an index API later. For now, we just pass through to                                         //
// Mongo's, but make it synchronous.                                                                                  //
Mongo.Collection.prototype._ensureIndex = function (index, options) {                                                 // 660
  var self = this;                                                                                                    // 661
  if (!self._collection._ensureIndex) throw new Error("Can only call _ensureIndex on server collections");            // 662
  self._collection._ensureIndex(index, options);                                                                      // 664
};                                                                                                                    //
Mongo.Collection.prototype._dropIndex = function (index) {                                                            // 666
  var self = this;                                                                                                    // 667
  if (!self._collection._dropIndex) throw new Error("Can only call _dropIndex on server collections");                // 668
  self._collection._dropIndex(index);                                                                                 // 670
};                                                                                                                    //
Mongo.Collection.prototype._dropCollection = function () {                                                            // 672
  var self = this;                                                                                                    // 673
  if (!self._collection.dropCollection) throw new Error("Can only call _dropCollection on server collections");       // 674
  self._collection.dropCollection();                                                                                  // 676
};                                                                                                                    //
Mongo.Collection.prototype._createCappedCollection = function (byteSize, maxDocuments) {                              // 678
  var self = this;                                                                                                    // 679
  if (!self._collection._createCappedCollection) throw new Error("Can only call _createCappedCollection on server collections");
  self._collection._createCappedCollection(byteSize, maxDocuments);                                                   // 682
};                                                                                                                    //
                                                                                                                      //
/**                                                                                                                   //
 * @summary Returns the [`Collection`](http://mongodb.github.io/node-mongodb-native/1.4/api-generated/collection.html) object corresponding to this collection from the [npm `mongodb` driver module](https://www.npmjs.com/package/mongodb) which is wrapped by `Mongo.Collection`.
 * @locus Server                                                                                                      //
 */                                                                                                                   //
Mongo.Collection.prototype.rawCollection = function () {                                                              // 689
  var self = this;                                                                                                    // 690
  if (!self._collection.rawCollection) {                                                                              // 691
    throw new Error("Can only call rawCollection on server collections");                                             // 692
  }                                                                                                                   //
  return self._collection.rawCollection();                                                                            // 694
};                                                                                                                    //
                                                                                                                      //
/**                                                                                                                   //
 * @summary Returns the [`Db`](http://mongodb.github.io/node-mongodb-native/1.4/api-generated/db.html) object corresponding to this collection's database connection from the [npm `mongodb` driver module](https://www.npmjs.com/package/mongodb) which is wrapped by `Mongo.Collection`.
 * @locus Server                                                                                                      //
 */                                                                                                                   //
Mongo.Collection.prototype.rawDatabase = function () {                                                                // 701
  var self = this;                                                                                                    // 702
  if (!(self._driver.mongo && self._driver.mongo.db)) {                                                               // 703
    throw new Error("Can only call rawDatabase on server collections");                                               // 704
  }                                                                                                                   //
  return self._driver.mongo.db;                                                                                       // 706
};                                                                                                                    //
                                                                                                                      //
/**                                                                                                                   //
 * @summary Create a Mongo-style `ObjectID`.  If you don't specify a `hexString`, the `ObjectID` will generated randomly (not using MongoDB's ID construction rules).
 * @locus Anywhere                                                                                                    //
 * @class                                                                                                             //
 * @param {String} [hexString] Optional.  The 24-character hexadecimal contents of the ObjectID to create             //
 */                                                                                                                   //
Mongo.ObjectID = MongoID.ObjectID;                                                                                    // 716
                                                                                                                      //
/**                                                                                                                   //
 * @summary To create a cursor, use find. To access the documents in a cursor, use forEach, map, or fetch.            //
 * @class                                                                                                             //
 * @instanceName cursor                                                                                               //
 */                                                                                                                   //
Mongo.Cursor = LocalCollection.Cursor;                                                                                // 723
                                                                                                                      //
/**                                                                                                                   //
 * @deprecated in 0.9.1                                                                                               //
 */                                                                                                                   //
Mongo.Collection.Cursor = Mongo.Cursor;                                                                               // 728
                                                                                                                      //
/**                                                                                                                   //
 * @deprecated in 0.9.1                                                                                               //
 */                                                                                                                   //
Mongo.Collection.ObjectID = Mongo.ObjectID;                                                                           // 733
                                                                                                                      //
/**                                                                                                                   //
 * @deprecated in 0.9.1                                                                                               //
 */                                                                                                                   //
Meteor.Collection = Mongo.Collection;                                                                                 // 738
                                                                                                                      //
// Allow deny stuff is now in the allow-deny package                                                                  //
_.extend(Meteor.Collection.prototype, AllowDeny.CollectionPrototype);                                                 // 741
                                                                                                                      //
function popCallbackFromArgs(args) {                                                                                  // 743
  // Pull off any callback (or perhaps a 'callback' variable that was passed                                          //
  // in undefined, like how 'upsert' does it).                                                                        //
  if (args.length && (args[args.length - 1] === undefined || args[args.length - 1] instanceof Function)) {            // 746
    return args.pop();                                                                                                // 749
  }                                                                                                                   //
}                                                                                                                     //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{"extensions":[".js",".json"]});
require("./node_modules/meteor/mongo/mongo_driver.js");
require("./node_modules/meteor/mongo/oplog_tailing.js");
require("./node_modules/meteor/mongo/observe_multiplex.js");
require("./node_modules/meteor/mongo/doc_fetcher.js");
require("./node_modules/meteor/mongo/polling_observe_driver.js");
require("./node_modules/meteor/mongo/oplog_observe_driver.js");
require("./node_modules/meteor/mongo/local_collection_driver.js");
require("./node_modules/meteor/mongo/remote_collection_driver.js");
require("./node_modules/meteor/mongo/collection.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
(function (pkg, symbols) {
  for (var s in symbols)
    (s in pkg) || (pkg[s] = symbols[s]);
})(Package.mongo = {}, {
  MongoInternals: MongoInternals,
  MongoTest: MongoTest,
  Mongo: Mongo
});

})();

//# sourceMappingURL=mongo.js.map
