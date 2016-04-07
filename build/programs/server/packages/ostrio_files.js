(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var WebApp = Package.webapp.WebApp;
var main = Package.webapp.main;
var WebAppInternals = Package.webapp.WebAppInternals;
var _ = Package.underscore._;
var check = Package.check.check;
var Match = Package.check.Match;
var SHA256 = Package.sha.SHA256;
var Cookies = Package['ostrio:cookies'].Cookies;
var Random = Package.random.Random;
var Collection2 = Package['aldeed:collection2-core'].Collection2;
var SimpleSchema = Package['aldeed:simple-schema'].SimpleSchema;
var MongoObject = Package['aldeed:simple-schema'].MongoObject;
var MongoInternals = Package.mongo.MongoInternals;
var Mongo = Package.mongo.Mongo;

/* Package-scope variables */
var __coffeescriptShare;

(function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ostrio_files/files.coffee.js                                                                               //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
__coffeescriptShare = typeof __coffeescriptShare === 'object' ? __coffeescriptShare : {}; var share = __coffeescriptShare;
var Throttle, _insts, bound, cp, formatFleURL, fs, rcp, request;                                                       // 1
                                                                                                                       //
if (Meteor.isServer) {                                                                                                 // 1
                                                                                                                       // 2
  /*                                                                                                                   // 2
  @description Require "fs-extra" npm package                                                                          //
   */                                                                                                                  //
  fs = Npm.require('fs-extra');                                                                                        // 2
  request = Npm.require('request');                                                                                    // 2
  Throttle = Npm.require('throttle');                                                                                  // 2
                                                                                                                       // 8
  /*                                                                                                                   // 8
  @var {object} bound - Meteor.bindEnvironment aka Fiber wrapper                                                       //
   */                                                                                                                  //
  bound = Meteor.bindEnvironment(function(callback) {                                                                  // 2
    return callback();                                                                                                 // 11
  });                                                                                                                  //
}                                                                                                                      //
                                                                                                                       //
                                                                                                                       // 13
/*                                                                                                                     // 13
@object                                                                                                                //
@name _insts                                                                                                           //
@description Object of Meteor.Files instances                                                                          //
 */                                                                                                                    //
                                                                                                                       //
_insts = {};                                                                                                           // 1
                                                                                                                       //
                                                                                                                       // 20
/*                                                                                                                     // 20
@function                                                                                                              //
@name rcp                                                                                                              //
@param {Object} obj - Initial object                                                                                   //
@description Create object with only needed props                                                                      //
 */                                                                                                                    //
                                                                                                                       //
rcp = function(obj) {                                                                                                  // 1
  var o;                                                                                                               // 27
  o = {                                                                                                                // 27
    currentFile: obj.currentFile,                                                                                      // 28
    search: obj.search,                                                                                                // 28
    storagePath: obj.storagePath,                                                                                      // 28
    collectionName: obj.collectionName,                                                                                // 28
    downloadRoute: obj.downloadRoute,                                                                                  // 28
    chunkSize: obj.chunkSize,                                                                                          // 28
    debug: obj.debug,                                                                                                  // 28
    _prefix: obj._prefix,                                                                                              // 28
    cacheControl: obj.cacheControl,                                                                                    // 28
    versions: obj.versions                                                                                             // 28
  };                                                                                                                   //
  return o;                                                                                                            // 38
};                                                                                                                     // 26
                                                                                                                       //
                                                                                                                       // 40
/*                                                                                                                     // 40
@function                                                                                                              //
@name cp                                                                                                               //
@param {Object} to   - Destanation                                                                                     //
@param {Object} from - Source                                                                                          //
@description Copy-Paste only needed props from one to another object                                                   //
 */                                                                                                                    //
                                                                                                                       //
cp = function(to, from) {                                                                                              // 1
  to.currentFile = from.currentFile;                                                                                   // 48
  to.search = from.search;                                                                                             // 48
  to.storagePath = from.storagePath;                                                                                   // 48
  to.collectionName = from.collectionName;                                                                             // 48
  to.downloadRoute = from.downloadRoute;                                                                               // 48
  to.chunkSize = from.chunkSize;                                                                                       // 48
  to.debug = from.debug;                                                                                               // 48
  to._prefix = from._prefix;                                                                                           // 48
  to.cacheControl = from.cacheControl;                                                                                 // 48
  to.versions = from.versions;                                                                                         // 48
  return to;                                                                                                           // 58
};                                                                                                                     // 47
                                                                                                                       //
                                                                                                                       // 60
/*                                                                                                                     // 60
@class                                                                                                                 //
@namespace Meteor                                                                                                      //
@name Files                                                                                                            //
@param config           {Object}   - Configuration object with next properties:                                        //
@param config.debug     {Boolean}  - Turn on/of debugging and extra logging                                            //
@param config.schema    {Object}   - Collection Schema                                                                 //
@param config.public    {Boolean}  - Store files in folder accessible for proxy servers, for limits, and more - read docs
@param config.strict    {Boolean}  - Strict mode for partial content, if is `true` server will return `416` response code, when `range` is not specified, otherwise server return `206`
@param config.protected {Function} - If `true` - files will be served only to authorized users, if `function()` - you're able to check visitor's permissions in your own way function's context has:
  - `request` - On server only                                                                                         //
  - `response` - On server only                                                                                        //
  - `user()`                                                                                                           //
  - `userId`                                                                                                           //
@param config.chunkSize      {Number}  - Upload chunk size                                                             //
@param config.allowUpload    {Boolean} - Allow/deny upload from client, default `true`                                 //
@param config.permissions    {Number}  - Permissions which will be set to uploaded files, like: `511` or `0o777`       //
@param config.storagePath    {String}  - Storage path on file system                                                   //
@param config.cacheControl   {String}  - Default `Cache-Control` header                                                //
@param config.throttle       {Number}  - bps throttle threshold                                                        //
@param config.downloadRoute  {String}  - Server Route used to retrieve files                                           //
@param config.collectionName {String}  - Collection name                                                               //
@param config.namingFunction {Function}- Function which returns `String`                                               //
@param config.integrityCheck {Boolean} - Check file's integrity before serving to users                                //
@param config.onBeforeUpload {Function}- Function which executes on server after receiving each chunk and on client right before beginning upload. Function context is `File` - so you are able to check for extension, mime-type, size and etc.
return `true` to continue                                                                                              //
return `false` or `String` to abort upload                                                                             //
@param config.allowClientCode  {Boolean}  - Allow to run `remove` from client                                          //
@param config.downloadCallback {Function} - Callback triggered each time file is requested                             //
@param config.onbeforeunloadMessage {String|Function} - Message shown to user when closing browser's window or tab while upload process is running
@description Create new instance of Meteor.Files                                                                       //
 */                                                                                                                    //
                                                                                                                       //
Meteor.Files = (function() {                                                                                           // 1
  function Files(config) {                                                                                             // 93
    var _methods, cookie, self;                                                                                        // 94
    if (config) {                                                                                                      // 94
      this.storagePath = config.storagePath, this.collectionName = config.collectionName, this.downloadRoute = config.downloadRoute, this.schema = config.schema, this.chunkSize = config.chunkSize, this.namingFunction = config.namingFunction, this.debug = config.debug, this.onbeforeunloadMessage = config.onbeforeunloadMessage, this.permissions = config.permissions, this.allowClientCode = config.allowClientCode, this.onBeforeUpload = config.onBeforeUpload, this.integrityCheck = config.integrityCheck, this["protected"] = config["protected"], this["public"] = config["public"], this.strict = config.strict, this.downloadCallback = config.downloadCallback, this.cacheControl = config.cacheControl, this.throttle = config.throttle;
    }                                                                                                                  //
    if (this.debug == null) {                                                                                          //
      this.debug = false;                                                                                              //
    }                                                                                                                  //
    if (this["public"] == null) {                                                                                      //
      this["public"] = false;                                                                                          //
    }                                                                                                                  //
    if (this.strict == null) {                                                                                         //
      this.strict = true;                                                                                              //
    }                                                                                                                  //
    if (this["protected"] == null) {                                                                                   //
      this["protected"] = false;                                                                                       //
    }                                                                                                                  //
    if (this.chunkSize == null) {                                                                                      //
      this.chunkSize = 272144;                                                                                         //
    }                                                                                                                  //
    if (this.permissions == null) {                                                                                    //
      this.permissions = 0x1ff;                                                                                        //
    }                                                                                                                  //
    if (this.cacheControl == null) {                                                                                   //
      this.cacheControl = 'public, max-age=31536000, s-maxage=31536000';                                               //
    }                                                                                                                  //
    if (this.collectionName == null) {                                                                                 //
      this.collectionName = 'MeteorUploadFiles';                                                                       //
    }                                                                                                                  //
    if (this.namingFunction == null) {                                                                                 //
      this.namingFunction = function() {                                                                               //
        return Random._randomString(17, 'AZQWXSECDRFVTBGYNHUJMIKOLPzaqwsxecdrfvtgbyhnujimkolp');                       //
      };                                                                                                               //
    }                                                                                                                  //
    if (this.integrityCheck == null) {                                                                                 //
      this.integrityCheck = true;                                                                                      //
    }                                                                                                                  //
    if (this.onBeforeUpload == null) {                                                                                 //
      this.onBeforeUpload = false;                                                                                     //
    }                                                                                                                  //
    if (this.allowClientCode == null) {                                                                                //
      this.allowClientCode = true;                                                                                     //
    }                                                                                                                  //
    if (this.downloadCallback == null) {                                                                               //
      this.downloadCallback = false;                                                                                   //
    }                                                                                                                  //
    if (this.onbeforeunloadMessage == null) {                                                                          //
      this.onbeforeunloadMessage = 'Upload in a progress... Do you want to abort?';                                    //
    }                                                                                                                  //
    if (this.throttle == null) {                                                                                       //
      this.throttle = false;                                                                                           //
    }                                                                                                                  //
    cookie = new Cookies();                                                                                            // 94
    if (this["protected"] && Meteor.isClient) {                                                                        // 113
      if (!cookie.has('meteor_login_token') && Meteor._localStorage.getItem('Meteor.loginToken')) {                    // 114
        cookie.set('meteor_login_token', Meteor._localStorage.getItem('Meteor.loginToken'), null, '/');                // 115
      }                                                                                                                //
    }                                                                                                                  //
    if (!this.storagePath) {                                                                                           // 117
      this.storagePath = this["public"] ? "../web.browser/app/uploads/" + this.collectionName : "/assets/app/uploads/" + this.collectionName;
      this.downloadRoute = this["public"] ? "/uploads/" + this.collectionName : !this.downloadRoute ? '/cdn/storage' : void 0;
    }                                                                                                                  //
    if (!this.downloadRoute) {                                                                                         // 121
      this.downloadRoute = '/cdn/storage';                                                                             // 122
    }                                                                                                                  //
    if (!this.schema) {                                                                                                // 125
      this.schema = {                                                                                                  // 126
        size: {                                                                                                        // 127
          type: Number                                                                                                 // 127
        },                                                                                                             //
        name: {                                                                                                        // 127
          type: String                                                                                                 // 128
        },                                                                                                             //
        type: {                                                                                                        // 127
          type: String                                                                                                 // 129
        },                                                                                                             //
        path: {                                                                                                        // 127
          type: String                                                                                                 // 130
        },                                                                                                             //
        isVideo: {                                                                                                     // 127
          type: Boolean                                                                                                // 131
        },                                                                                                             //
        isAudio: {                                                                                                     // 127
          type: Boolean                                                                                                // 132
        },                                                                                                             //
        isImage: {                                                                                                     // 127
          type: Boolean                                                                                                // 133
        },                                                                                                             //
        _prefix: {                                                                                                     // 127
          type: String                                                                                                 // 134
        },                                                                                                             //
        extension: {                                                                                                   // 127
          type: String,                                                                                                // 136
          optional: true                                                                                               // 136
        },                                                                                                             //
        _storagePath: {                                                                                                // 127
          type: String                                                                                                 // 138
        },                                                                                                             //
        _downloadRoute: {                                                                                              // 127
          type: String                                                                                                 // 139
        },                                                                                                             //
        _collectionName: {                                                                                             // 127
          type: String                                                                                                 // 140
        },                                                                                                             //
        meta: {                                                                                                        // 127
          type: Object,                                                                                                // 142
          blackbox: true,                                                                                              // 142
          optional: true                                                                                               // 142
        },                                                                                                             //
        userId: {                                                                                                      // 127
          type: String,                                                                                                // 146
          optional: true                                                                                               // 146
        },                                                                                                             //
        updatedAt: {                                                                                                   // 127
          type: Date,                                                                                                  // 149
          autoValue: function() {                                                                                      // 149
            return new Date();                                                                                         //
          }                                                                                                            //
        },                                                                                                             //
        versions: {                                                                                                    // 127
          type: Object,                                                                                                // 152
          blackbox: true                                                                                               // 152
        }                                                                                                              //
      };                                                                                                               //
    }                                                                                                                  //
    check(this.debug, Boolean);                                                                                        // 94
    check(this.schema, Object);                                                                                        // 94
    check(this["public"], Boolean);                                                                                    // 94
    check(this.strict, Boolean);                                                                                       // 94
    check(this.throttle, Match.OneOf(false, Number));                                                                  // 94
    check(this["protected"], Match.OneOf(Boolean, Function));                                                          // 94
    check(this.chunkSize, Number);                                                                                     // 94
    check(this.permissions, Number);                                                                                   // 94
    check(this.storagePath, String);                                                                                   // 94
    check(this.downloadRoute, String);                                                                                 // 94
    check(this.integrityCheck, Boolean);                                                                               // 94
    check(this.collectionName, String);                                                                                // 94
    check(this.namingFunction, Function);                                                                              // 94
    check(this.onBeforeUpload, Match.OneOf(Boolean, Function));                                                        // 94
    check(this.allowClientCode, Boolean);                                                                              // 94
    check(this.downloadCallback, Match.OneOf(Boolean, Function));                                                      // 94
    check(this.onbeforeunloadMessage, Match.OneOf(String, Function));                                                  // 94
    if (this["public"] && this["protected"]) {                                                                         // 173
      throw new Meteor.Error(500, "[Meteor.File." + this.collectionName + "]: Files can not be public and protected at the same time!");
    }                                                                                                                  //
    this.collection = new Mongo.Collection(this.collectionName);                                                       // 94
    this.storagePath = this.storagePath.replace(/\/$/, '');                                                            // 94
    this.downloadRoute = this.downloadRoute.replace(/\/$/, '');                                                        // 94
    self = this;                                                                                                       // 94
    this.cursor = null;                                                                                                // 94
    this.search = {};                                                                                                  // 94
    this.currentFile = null;                                                                                           // 94
    this.collection.attachSchema(this.schema);                                                                         // 94
    this.collection.deny({                                                                                             // 94
      insert: function() {                                                                                             // 188
        return true;                                                                                                   //
      },                                                                                                               //
      update: function() {                                                                                             // 188
        return true;                                                                                                   //
      },                                                                                                               //
      remove: function() {                                                                                             // 188
        return true;                                                                                                   //
      }                                                                                                                //
    });                                                                                                                //
    this._prefix = SHA256(this.collectionName + this.storagePath + this.downloadRoute);                                // 94
    _insts[this._prefix] = this;                                                                                       // 94
    this.checkAccess = function(http) {                                                                                // 94
      var rc, result, text, user, userFuncs, userId;                                                                   // 199
      if (this["protected"]) {                                                                                         // 199
        user = false;                                                                                                  // 200
        userFuncs = this.getUser(http);                                                                                // 200
        user = userFuncs.user, userId = userFuncs.userId;                                                              // 200
        user = user();                                                                                                 // 200
        if (_.isFunction(this["protected"])) {                                                                         // 205
          result = http ? this["protected"].call(_.extend(http, userFuncs), this.currentFile || null) : this["protected"].call(userFuncs, this.currentFile || null);
        } else {                                                                                                       //
          result = !!user;                                                                                             // 208
        }                                                                                                              //
        if ((http && result === true) || !http) {                                                                      // 210
          return true;                                                                                                 // 211
        } else {                                                                                                       //
          rc = _.isNumber(result) ? result : 401;                                                                      // 213
          if (this.debug) {                                                                                            // 214
            console.warn('Access denied!');                                                                            // 214
          }                                                                                                            //
          if (http) {                                                                                                  // 215
            text = 'Access denied!';                                                                                   // 216
            http.response.writeHead(rc, {                                                                              // 216
              'Content-Length': text.length,                                                                           // 218
              'Content-Type': 'text/plain'                                                                             // 218
            });                                                                                                        //
            http.response.end(text);                                                                                   // 216
          }                                                                                                            //
          return false;                                                                                                // 221
        }                                                                                                              //
      } else {                                                                                                         //
        return true;                                                                                                   // 223
      }                                                                                                                //
    };                                                                                                                 //
    if (Meteor.isServer) {                                                                                             // 225
      WebApp.connectHandlers.use((function(_this) {                                                                    // 226
        return function(request, response, next) {                                                                     //
          var http, params, uri, uris, version;                                                                        // 227
          if (!_this["public"]) {                                                                                      // 227
            if (!!~request._parsedUrl.path.indexOf(_this.downloadRoute + "/" + _this.collectionName)) {                // 228
              uri = request._parsedUrl.path.replace(_this.downloadRoute + "/" + _this.collectionName, '');             // 229
              if (uri.indexOf('/') === 0) {                                                                            // 230
                uri = uri.substring(1);                                                                                // 231
              }                                                                                                        //
              uris = uri.split('/');                                                                                   // 229
              if (uris.length === 3) {                                                                                 // 234
                params = {                                                                                             // 235
                  query: request._parsedUrl.query ? JSON.parse('{"' + decodeURI(request._parsedUrl.query).replace(/"/g, '\\"').replace(/&/g, '","').replace(/=/g, '":"') + '"}') : {},
                  _id: uris[0],                                                                                        // 236
                  version: uris[1],                                                                                    // 236
                  name: uris[2]                                                                                        // 236
                };                                                                                                     //
                http = {                                                                                               // 235
                  request: request,                                                                                    // 240
                  response: response,                                                                                  // 240
                  params: params                                                                                       // 240
                };                                                                                                     //
                if (_this.checkAccess(http)) {                                                                         // 241
                  return _this.findOne(uris[0]).download.call(_this, http, uris[1]);                                   //
                }                                                                                                      //
              } else {                                                                                                 //
                return next();                                                                                         //
              }                                                                                                        //
            } else {                                                                                                   //
              return next();                                                                                           //
            }                                                                                                          //
          } else {                                                                                                     //
            if (!!~request._parsedUrl.path.indexOf("" + _this.downloadRoute)) {                                        // 247
              uri = request._parsedUrl.path.replace("" + _this.downloadRoute, '');                                     // 248
              if (uri.indexOf('/') === 0) {                                                                            // 249
                uri = uri.substring(1);                                                                                // 250
              }                                                                                                        //
              uris = uri.split('/');                                                                                   // 248
              if (uris.length === 1) {                                                                                 // 253
                params = {                                                                                             // 254
                  query: request._parsedUrl.query ? JSON.parse('{"' + decodeURI(request._parsedUrl.query).replace(/"/g, '\\"').replace(/&/g, '","').replace(/=/g, '":"') + '"}') : {},
                  file: uris[0]                                                                                        // 255
                };                                                                                                     //
                http = {                                                                                               // 254
                  request: request,                                                                                    // 257
                  response: response,                                                                                  // 257
                  params: params                                                                                       // 257
                };                                                                                                     //
                if (!!~params.file.indexOf('-')) {                                                                     // 259
                  version = params.file.split('-')[0];                                                                 // 260
                  return _this.download.call(_this, http, version);                                                    //
                } else {                                                                                               //
                  response.writeHead(404);                                                                             // 263
                  return response.end('No such file :(');                                                              //
                }                                                                                                      //
              } else {                                                                                                 //
                return next();                                                                                         //
              }                                                                                                        //
            } else {                                                                                                   //
              return next();                                                                                           //
            }                                                                                                          //
          }                                                                                                            //
        };                                                                                                             //
      })(this));                                                                                                       //
    }                                                                                                                  //
    this.methodNames = {                                                                                               // 94
      MeteorFileAbort: "MeteorFileAbort" + this._prefix,                                                               // 271
      MeteorFileWrite: "MeteorFileWrite" + this._prefix,                                                               // 271
      MeteorFileUnlink: "MeteorFileUnlink" + this._prefix                                                              // 271
    };                                                                                                                 //
    if (Meteor.isServer) {                                                                                             // 275
      _methods = {};                                                                                                   // 276
      _methods[self.methodNames.MeteorFileUnlink] = function(inst) {                                                   // 276
        check(inst, Object);                                                                                           // 279
        if (self.debug) {                                                                                              // 280
          console.info('Meteor.Files Debugger: [MeteorFileUnlink]');                                                   // 280
        }                                                                                                              //
        if (self.allowClientCode) {                                                                                    // 281
          return self.remove.call(cp(_insts[inst._prefix], inst), inst.search);                                        //
        } else {                                                                                                       //
          throw new Meteor.Error(401, '[Meteor.Files] [remove()] Run code from client is not allowed!');               // 284
        }                                                                                                              //
      };                                                                                                               //
      _methods[self.methodNames.MeteorFileWrite] = function(unitArray, fileData, meta, first, chunksQty, currentChunk, totalSentChunks, randFileName, part, partsQty, fileSize) {
        var _path, binary, e, error, extension, extensionWithDot, fileName, i, isUploadAllowed, last, path, pathName, pathPart, ref, result;
        if (meta == null) {                                                                                            //
          meta = {};                                                                                                   //
        }                                                                                                              //
        this.unblock();                                                                                                // 287
        check(part, Number);                                                                                           // 287
        check(meta, Match.Optional(Object));                                                                           // 287
        check(first, Boolean);                                                                                         // 287
        check(fileSize, Number);                                                                                       // 287
        check(partsQty, Number);                                                                                       // 287
        check(fileData, Object);                                                                                       // 287
        check(unitArray, Match.OneOf(Uint8Array, Object));                                                             // 287
        check(chunksQty, Number);                                                                                      // 287
        check(randFileName, String);                                                                                   // 287
        check(currentChunk, Number);                                                                                   // 287
        check(totalSentChunks, Number);                                                                                // 287
        if (self.debug) {                                                                                              // 300
          console.info("Meteor.Files Debugger: [MeteorFileWrite] {name: " + randFileName + ", meta:" + meta + "}");    // 300
        }                                                                                                              //
        if (self.debug) {                                                                                              // 301
          console.info("Meteor.Files Debugger: Received chunk #" + currentChunk + " of " + chunksQty + " chunks, in part: " + part + ", file: " + (fileData.name || fileData.fileName));
        }                                                                                                              //
        if (self.onBeforeUpload && _.isFunction(self.onBeforeUpload)) {                                                // 303
          isUploadAllowed = self.onBeforeUpload.call(fileData);                                                        // 304
          if (isUploadAllowed !== true) {                                                                              // 305
            throw new Meteor.Error(403, _.isString(isUploadAllowed) ? isUploadAllowed : '@onBeforeUpload() returned false');
          }                                                                                                            //
        }                                                                                                              //
        i = 0;                                                                                                         // 287
        binary = '';                                                                                                   // 287
        while (i < unitArray.byteLength) {                                                                             // 310
          binary += String.fromCharCode(unitArray[i]);                                                                 // 311
          i++;                                                                                                         // 311
        }                                                                                                              //
        last = chunksQty * partsQty <= totalSentChunks;                                                                // 287
        fileName = self.getFileName(fileData);                                                                         // 287
        ref = self.getExt(fileName), extension = ref.extension, extensionWithDot = ref.extensionWithDot;               // 287
        pathName = self["public"] ? self.storagePath + "/original-" + randFileName : self.storagePath + "/" + randFileName;
        path = self["public"] ? self.storagePath + "/original-" + randFileName + extensionWithDot : self.storagePath + "/" + randFileName + extensionWithDot;
        pathPart = partsQty > 1 ? pathName + "_" + part + extensionWithDot : path;                                     // 287
        result = self.dataToSchema({                                                                                   // 287
          name: fileName,                                                                                              // 324
          path: path,                                                                                                  // 324
          meta: meta,                                                                                                  // 324
          type: fileData != null ? fileData.type : void 0,                                                             // 324
          size: fileData.size,                                                                                         // 324
          extension: extension                                                                                         // 324
        });                                                                                                            //
        result.chunk = currentChunk;                                                                                   // 287
        result.last = last;                                                                                            // 287
        try {                                                                                                          // 334
          if (first) {                                                                                                 // 335
            fs.outputFileSync(pathPart, binary, 'binary');                                                             // 336
          } else {                                                                                                     //
            fs.appendFileSync(pathPart, binary, 'binary');                                                             // 338
          }                                                                                                            //
        } catch (_error) {                                                                                             //
          e = _error;                                                                                                  // 340
          error = new Meteor.Error(500, 'Unfinished upload (probably caused by server reboot or aborted operation)', e);
          console.error(error);                                                                                        // 340
          return error;                                                                                                // 342
        }                                                                                                              //
        if ((chunksQty === currentChunk) && self.debug) {                                                              // 344
          console.info("Meteor.Files Debugger: The part #" + part + " of file " + fileName + " (binary) was saved to " + pathPart);
        }                                                                                                              //
        if (last) {                                                                                                    // 346
          if (partsQty > 1) {                                                                                          // 347
            i = 2;                                                                                                     // 348
            while (i <= partsQty) {                                                                                    // 349
              _path = pathName + "_" + i + extensionWithDot;                                                           // 350
              fs.appendFileSync(pathName + '_1' + extensionWithDot, fs.readFileSync(_path), 'binary');                 // 350
              fs.unlink(_path);                                                                                        // 350
              i++;                                                                                                     // 350
            }                                                                                                          //
            fs.renameSync(pathName + '_1' + extensionWithDot, path);                                                   // 348
          }                                                                                                            //
          fs.chmod(path, self.permissions);                                                                            // 347
          if (self["public"]) {                                                                                        // 358
            result._id = randFileName;                                                                                 // 358
          }                                                                                                            //
          result.type = self.getMimeType(fileData);                                                                    // 347
          result._id = self.collection.insert(_.clone(result));                                                        // 347
          if (self.debug) {                                                                                            // 362
            console.info("Meteor.Files Debugger: The file " + fileName + " (binary) was saved to " + path);            // 362
          }                                                                                                            //
        }                                                                                                              //
        return result;                                                                                                 // 363
      };                                                                                                               //
      _methods[self.methodNames.MeteorFileAbort] = function(randFileName, partsQty, fileData) {                        // 276
        var extensionWithDot, i, path, pathName, results;                                                              // 366
        check(partsQty, Number);                                                                                       // 366
        check(fileData, Object);                                                                                       // 366
        check(randFileName, String);                                                                                   // 366
        pathName = self["public"] ? self.storagePath + "/original-" + randFileName : self.storagePath + "/" + randFileName;
        extensionWithDot = "." + fileData.ext;                                                                         // 366
        if (partsQty > 1) {                                                                                            // 373
          i = 0;                                                                                                       // 374
          results = [];                                                                                                // 375
          while (i <= partsQty) {                                                                                      //
            path = pathName + "_" + i + extensionWithDot;                                                              // 376
            if (fs.existsSync(path)) {                                                                                 // 377
              fs.unlink(path);                                                                                         // 377
            }                                                                                                          //
            results.push(i++);                                                                                         // 376
          }                                                                                                            //
          return results;                                                                                              //
        }                                                                                                              //
      };                                                                                                               //
      Meteor.methods(_methods);                                                                                        // 276
    }                                                                                                                  //
  }                                                                                                                    //
                                                                                                                       //
                                                                                                                       // 382
  /*                                                                                                                   // 382
  Extend Meteor.Files with mime library                                                                                //
  @url https://github.com/broofa/node-mime                                                                             //
  @description Temporary removed from package due to unstability                                                       //
   */                                                                                                                  //
                                                                                                                       //
                                                                                                                       // 389
  /*                                                                                                                   // 389
  @isomorphic                                                                                                          //
  @function                                                                                                            //
  @class Meteor.Files                                                                                                  //
  @name getMimeType                                                                                                    //
  @param {Object} fileData - File Object                                                                               //
  @description Returns file's mime-type                                                                                //
  @returns {String}                                                                                                    //
   */                                                                                                                  //
                                                                                                                       //
  Files.prototype.getMimeType = function(fileData) {                                                                   // 93
    var mime;                                                                                                          // 399
    check(fileData, Object);                                                                                           // 399
    if (fileData != null ? fileData.type : void 0) {                                                                   // 400
      mime = fileData.type;                                                                                            // 400
    }                                                                                                                  //
    if (!mime || !_.isString(mime)) {                                                                                  // 401
      mime = 'application/octet-stream';                                                                               // 401
    }                                                                                                                  //
    return mime;                                                                                                       //
  };                                                                                                                   //
                                                                                                                       //
                                                                                                                       // 404
  /*                                                                                                                   // 404
  @isomorphic                                                                                                          //
  @function                                                                                                            //
  @class Meteor.Files                                                                                                  //
  @name getFileName                                                                                                    //
  @param {Object} fileData - File Object                                                                               //
  @description Returns file's name                                                                                     //
  @returns {String}                                                                                                    //
   */                                                                                                                  //
                                                                                                                       //
  Files.prototype.getFileName = function(fileData) {                                                                   // 93
    var cleanName, fileName;                                                                                           // 414
    fileName = fileData.name || fileData.fileName;                                                                     // 414
    if (_.isString(fileName) && fileName.length > 0) {                                                                 // 415
      cleanName = function(str) {                                                                                      // 416
        return str.replace(/\.\./g, '').replace(/\//g, '');                                                            //
      };                                                                                                               //
      return cleanName(fileData.name || fileData.fileName);                                                            // 417
    } else {                                                                                                           //
      return '';                                                                                                       // 419
    }                                                                                                                  //
  };                                                                                                                   //
                                                                                                                       //
                                                                                                                       // 421
  /*                                                                                                                   // 421
  @isomorphic                                                                                                          //
  @function                                                                                                            //
  @class Meteor.Files                                                                                                  //
  @name getUser                                                                                                        //
  @description Returns object with `userId` and `user()` method which return user's object                             //
  @returns {Object}                                                                                                    //
   */                                                                                                                  //
                                                                                                                       //
  Files.prototype.getUser = function(http) {                                                                           // 93
    var cookie, result, user;                                                                                          // 430
    result = {                                                                                                         // 430
      user: function() {                                                                                               // 431
        return void 0;                                                                                                 // 431
      },                                                                                                               //
      userId: void 0                                                                                                   // 431
    };                                                                                                                 //
    if (Meteor.isServer) {                                                                                             // 434
      if (http) {                                                                                                      // 435
        cookie = http.request.Cookies;                                                                                 // 436
        if (_.has(Package, 'accounts-base') && cookie.has('meteor_login_token')) {                                     // 437
          user = Meteor.users.findOne({                                                                                // 438
            'services.resume.loginTokens.hashedToken': Accounts._hashLoginToken(cookie.get('meteor_login_token'))      // 438
          });                                                                                                          //
          if (user) {                                                                                                  // 439
            result.user = function() {                                                                                 // 440
              return user;                                                                                             // 440
            };                                                                                                         //
            result.userId = user._id;                                                                                  // 440
          }                                                                                                            //
        }                                                                                                              //
      }                                                                                                                //
    } else {                                                                                                           //
      if (_.has(Package, 'accounts-base') && Meteor.userId()) {                                                        // 443
        result.user = function() {                                                                                     // 444
          return Meteor.user();                                                                                        // 444
        };                                                                                                             //
        result.userId = Meteor.userId();                                                                               // 444
      }                                                                                                                //
    }                                                                                                                  //
    return result;                                                                                                     // 447
  };                                                                                                                   //
                                                                                                                       //
                                                                                                                       // 449
  /*                                                                                                                   // 449
  @isomorphic                                                                                                          //
  @function                                                                                                            //
  @class Meteor.Files                                                                                                  //
  @name getExt                                                                                                         //
  @param {String} FileName - File name                                                                                 //
  @description Get extension from FileName                                                                             //
  @returns {Object}                                                                                                    //
   */                                                                                                                  //
                                                                                                                       //
  Files.prototype.getExt = function(fileName) {                                                                        // 93
    var extension;                                                                                                     // 459
    if (!!~fileName.indexOf('.')) {                                                                                    // 459
      extension = fileName.split('.').pop();                                                                           // 460
      return {                                                                                                         // 461
        extension: extension,                                                                                          // 461
        extensionWithDot: '.' + extension                                                                              // 461
      };                                                                                                               //
    } else {                                                                                                           //
      return {                                                                                                         // 463
        extension: '',                                                                                                 // 463
        extensionWithDot: ''                                                                                           // 463
      };                                                                                                               //
    }                                                                                                                  //
  };                                                                                                                   //
                                                                                                                       //
                                                                                                                       // 465
  /*                                                                                                                   // 465
  @isomorphic                                                                                                          //
  @function                                                                                                            //
  @class Meteor.Files                                                                                                  //
  @name dataToSchema                                                                                                   //
  @param {Object} data - File data                                                                                     //
  @description Build object in accordance with schema from File data                                                   //
  @returns {Object}                                                                                                    //
   */                                                                                                                  //
                                                                                                                       //
  Files.prototype.dataToSchema = function(data) {                                                                      // 93
    return {                                                                                                           // 475
      name: data.name,                                                                                                 // 475
      extension: data.extension,                                                                                       // 475
      path: data.path,                                                                                                 // 475
      meta: data.meta,                                                                                                 // 475
      type: data.type,                                                                                                 // 475
      size: data.size,                                                                                                 // 475
      versions: {                                                                                                      // 475
        original: {                                                                                                    // 483
          path: data.path,                                                                                             // 484
          size: data.size,                                                                                             // 484
          type: data.type,                                                                                             // 484
          extension: data.extension                                                                                    // 484
        }                                                                                                              //
      },                                                                                                               //
      isVideo: !!~data.type.toLowerCase().indexOf('video'),                                                            // 475
      isAudio: !!~data.type.toLowerCase().indexOf('audio'),                                                            // 475
      isImage: !!~data.type.toLowerCase().indexOf('image'),                                                            // 475
      _prefix: data._prefix || this._prefix,                                                                           // 475
      _storagePath: data._storagePath || this.storagePath,                                                             // 475
      _downloadRoute: data._downloadRoute || this.downloadRoute,                                                       // 475
      _collectionName: data._collectionName || this.collectionName                                                     // 475
    };                                                                                                                 //
  };                                                                                                                   //
                                                                                                                       //
                                                                                                                       // 497
  /*                                                                                                                   // 497
  @isomorphic                                                                                                          //
  @function                                                                                                            //
  @class Meteor.Files                                                                                                  //
  @name srch                                                                                                           //
  @param {String|Object} search - Search data                                                                          //
  @description Build search object                                                                                     //
  @returns {Object}                                                                                                    //
   */                                                                                                                  //
                                                                                                                       //
  Files.prototype.srch = function(search) {                                                                            // 93
    if (search && _.isString(search)) {                                                                                // 507
      this.search = {                                                                                                  // 508
        _id: search                                                                                                    // 509
      };                                                                                                               //
    } else {                                                                                                           //
      this.search = search;                                                                                            // 511
    }                                                                                                                  //
    return this.search;                                                                                                //
  };                                                                                                                   //
                                                                                                                       //
                                                                                                                       // 514
  /*                                                                                                                   // 514
  @server                                                                                                              //
  @function                                                                                                            //
  @class Meteor.Files                                                                                                  //
  @name write                                                                                                          //
  @param {Buffer} buffer - Binary File's Buffer                                                                        //
  @param {Object} opts - {fileName: '', type: '', size: 0, meta: {...}}                                                //
  @param {Function} callback - function(error, fileObj){...}                                                           //
  @description Write buffer to FS and add to Meteor.Files Collection                                                   //
  @returns {Files} - Return this                                                                                       //
   */                                                                                                                  //
                                                                                                                       //
  Files.prototype.write = Meteor.isServer ? function(buffer, opts, callback) {                                         // 93
    var extension, extensionWithDot, fileName, path, randFileName, ref, result;                                        // 526
    if (opts == null) {                                                                                                //
      opts = {};                                                                                                       //
    }                                                                                                                  //
    if (this.debug) {                                                                                                  // 526
      console.info("Meteor.Files Debugger: [write(buffer, " + (JSON.stringify(opts)) + ", callback)]");                // 526
    }                                                                                                                  //
    check(opts, Match.Optional(Object));                                                                               // 526
    check(callback, Match.Optional(Function));                                                                         // 526
    if (this.checkAccess()) {                                                                                          // 530
      randFileName = this.namingFunction();                                                                            // 531
      fileName = opts.name || opts.fileName ? opts.name || opts.fileName : randFileName;                               // 531
      ref = this.getExt(fileName), extension = ref.extension, extensionWithDot = ref.extensionWithDot;                 // 531
      path = this["public"] ? this.storagePath + "/original-" + randFileName + extensionWithDot : this.storagePath + "/" + randFileName + extensionWithDot;
      opts.type = this.getMimeType(opts);                                                                              // 531
      if (!opts.meta) {                                                                                                // 539
        opts.meta = {};                                                                                                // 539
      }                                                                                                                //
      if (!opts.size) {                                                                                                // 540
        opts.size = buffer.length;                                                                                     // 540
      }                                                                                                                //
      result = this.dataToSchema({                                                                                     // 531
        name: fileName,                                                                                                // 543
        path: path,                                                                                                    // 543
        meta: opts.meta,                                                                                               // 543
        type: opts.type,                                                                                               // 543
        size: opts.size,                                                                                               // 543
        extension: extension                                                                                           // 543
      });                                                                                                              //
      if (this.debug) {                                                                                                // 550
        console.info("Meteor.Files Debugger: The file " + fileName + " (binary) was added to " + this.collectionName);
      }                                                                                                                //
      fs.outputFileSync(path, buffer, 'binary');                                                                       // 531
      result._id = this.collection.insert(_.clone(result));                                                            // 531
      callback && callback(null, result);                                                                              // 531
      return result;                                                                                                   // 556
    }                                                                                                                  //
  } : void 0;                                                                                                          //
                                                                                                                       //
                                                                                                                       // 560
  /*                                                                                                                   // 560
  @server                                                                                                              //
  @function                                                                                                            //
  @class Meteor.Files                                                                                                  //
  @name load                                                                                                           //
  @param {String} url - URL to file                                                                                    //
  @param {Object} opts - {fileName: '', meta: {...}}                                                                   //
  @param {Function} callback - function(error, fileObj){...}                                                           //
  @description Download file, write stream to FS and add to Meteor.Files Collection                                    //
  @returns {Files} - Return this                                                                                       //
   */                                                                                                                  //
                                                                                                                       //
  Files.prototype.load = Meteor.isServer ? function(url, opts, callback) {                                             // 93
    var extension, extensionWithDot, fileName, path, randFileName, ref, self;                                          // 572
    if (opts == null) {                                                                                                //
      opts = {};                                                                                                       //
    }                                                                                                                  //
    if (this.debug) {                                                                                                  // 572
      console.info("Meteor.Files Debugger: [load(" + url + ", " + (JSON.stringify(opts)) + ", callback)]");            // 572
    }                                                                                                                  //
    check(url, String);                                                                                                // 572
    check(opts, Match.Optional(Object));                                                                               // 572
    check(callback, Match.Optional(Function));                                                                         // 572
    self = this;                                                                                                       // 572
    if (this.checkAccess()) {                                                                                          // 578
      randFileName = this.namingFunction();                                                                            // 579
      fileName = opts.name || opts.fileName ? opts.name || opts.fileName : randFileName;                               // 579
      ref = this.getExt(fileName), extension = ref.extension, extensionWithDot = ref.extensionWithDot;                 // 579
      path = this["public"] ? this.storagePath + "/original-" + randFileName + extensionWithDot : this.storagePath + "/" + randFileName + extensionWithDot;
      if (!opts.meta) {                                                                                                // 584
        opts.meta = {};                                                                                                // 584
      }                                                                                                                //
      return request.get(url).on('error', function(error) {                                                            //
        throw new Meteor.Error(500, ("Error on [load(" + url + ", " + opts + ")]; Error:") + JSON.stringify(error));   // 587
      }).on('response', function(response) {                                                                           //
        return bound(function() {                                                                                      //
          var result;                                                                                                  // 590
          result = self.dataToSchema({                                                                                 // 590
            name: fileName,                                                                                            // 591
            path: path,                                                                                                // 591
            meta: opts.meta,                                                                                           // 591
            type: response.headers['content-type'],                                                                    // 591
            size: response.headers['content-length'],                                                                  // 591
            extension: extension                                                                                       // 591
          });                                                                                                          //
          if (this.debug) {                                                                                            // 598
            console.info("Meteor.Files Debugger: The file " + fileName + " (binary) was loaded to " + this.collectionName);
          }                                                                                                            //
          result._id = self.collection.insert(_.clone(result));                                                        // 590
          return callback && callback(null, result);                                                                   //
        });                                                                                                            //
      }).pipe(fs.createOutputStream(path));                                                                            //
    }                                                                                                                  //
  } : void 0;                                                                                                          //
                                                                                                                       //
                                                                                                                       // 608
  /*                                                                                                                   // 608
  @server                                                                                                              //
  @function                                                                                                            //
  @class Meteor.Files                                                                                                  //
  @name addFile                                                                                                        //
  @param {String} path - Path to file                                                                                  //
  @param {String} path - Path to file                                                                                  //
  @description Add file from FS to Meteor.Files                                                                        //
  @returns {Files} - Return this                                                                                       //
   */                                                                                                                  //
                                                                                                                       //
  Files.prototype.addFile = Meteor.isServer ? function(path, opts, callback) {                                         // 93
    var error, extension, extensionWithDot, fileName, fileSize, pathParts, ref, result, stats;                         // 619
    if (opts == null) {                                                                                                //
      opts = {};                                                                                                       //
    }                                                                                                                  //
    if (this.debug) {                                                                                                  // 619
      console.info("[addFile(" + path + ")]");                                                                         // 619
    }                                                                                                                  //
    if (this["public"]) {                                                                                              // 621
      throw new Meteor.Error(403, 'Can not run [addFile()] on public collection');                                     // 621
    }                                                                                                                  //
    check(path, String);                                                                                               // 619
    check(opts, Match.Optional(Object));                                                                               // 619
    check(callback, Match.Optional(Function));                                                                         // 619
    try {                                                                                                              // 626
      stats = fs.statSync(path);                                                                                       // 627
      if (stat.isFile()) {                                                                                             // 629
        fileSize = stats.size;                                                                                         // 630
        pathParts = path.split('/');                                                                                   // 630
        fileName = pathParts[pathParts.length - 1];                                                                    // 630
        ref = this.getExt(fileName), extension = ref.extension, extensionWithDot = ref.extensionWithDot;               // 630
        if (!opts.type) {                                                                                              // 636
          opts.type = 'application/*';                                                                                 // 636
        }                                                                                                              //
        if (!opts.meta) {                                                                                              // 637
          opts.meta = {};                                                                                              // 637
        }                                                                                                              //
        if (!opts.size) {                                                                                              // 638
          opts.size = fileSize;                                                                                        // 638
        }                                                                                                              //
        result = this.dataToSchema({                                                                                   // 630
          name: fileName,                                                                                              // 641
          path: path,                                                                                                  // 641
          meta: opts.meta,                                                                                             // 641
          type: opts.type,                                                                                             // 641
          size: opts.size,                                                                                             // 641
          extension: extension,                                                                                        // 641
          _storagePath: path.replace("/" + fileName, '')                                                               // 641
        });                                                                                                            //
        result._id = this.collection.insert(_.clone(result));                                                          // 630
        if (this.debug) {                                                                                              // 650
          console.info("The file " + fileName + " (binary) was added to " + this.collectionName);                      // 650
        }                                                                                                              //
        callback && callback(null, result);                                                                            // 630
        return result;                                                                                                 // 653
      } else {                                                                                                         //
        error = new Meteor.Error(400, "[Files.addFile(" + path + ")]: File does not exist");                           // 655
        callback && callback(error);                                                                                   // 655
        return error;                                                                                                  // 657
      }                                                                                                                //
    } catch (_error) {                                                                                                 //
      error = _error;                                                                                                  // 660
      callback && callback(error);                                                                                     // 660
      return error;                                                                                                    // 661
    }                                                                                                                  //
  } : void 0;                                                                                                          //
                                                                                                                       //
                                                                                                                       // 665
  /*                                                                                                                   // 665
  @isomorphic                                                                                                          //
  @function                                                                                                            //
  @class Meteor.Files                                                                                                  //
  @name findOne                                                                                                        //
  @param {String|Object} search - `_id` of the file or `Object` like, {prop:'val'}                                     //
  @description Load file                                                                                               //
  @returns {Files} - Return this                                                                                       //
   */                                                                                                                  //
                                                                                                                       //
  Files.prototype.findOne = function(search) {                                                                         // 93
    if (this.debug) {                                                                                                  // 675
      console.info("Meteor.Files Debugger: [findOne(" + (JSON.stringify(search)) + ")]");                              // 675
    }                                                                                                                  //
    check(search, Match.OneOf(Object, String));                                                                        // 675
    this.srch(search);                                                                                                 // 675
    if (this.checkAccess()) {                                                                                          // 679
      this.currentFile = this.collection.findOne(this.search);                                                         // 680
      this.cursor = null;                                                                                              // 680
      return this;                                                                                                     // 682
    }                                                                                                                  //
  };                                                                                                                   //
                                                                                                                       //
                                                                                                                       // 684
  /*                                                                                                                   // 684
  @isomorphic                                                                                                          //
  @function                                                                                                            //
  @class Meteor.Files                                                                                                  //
  @name find                                                                                                           //
  @param {String|Object} search - `_id` of the file or `Object` like, {prop:'val'}                                     //
  @description Load file or bunch of files                                                                             //
  @returns {Files} - Return this                                                                                       //
   */                                                                                                                  //
                                                                                                                       //
  Files.prototype.find = function(search) {                                                                            // 93
    if (this.debug) {                                                                                                  // 694
      console.info("Meteor.Files Debugger: [find(" + (JSON.stringify(search)) + ")]");                                 // 694
    }                                                                                                                  //
    check(search, Match.OneOf(Object, String));                                                                        // 694
    this.srch(search);                                                                                                 // 694
    if (this.checkAccess) {                                                                                            // 698
      this.currentFile = null;                                                                                         // 699
      this.cursor = this.collection.find(this.search);                                                                 // 699
      return this;                                                                                                     // 701
    }                                                                                                                  //
  };                                                                                                                   //
                                                                                                                       //
                                                                                                                       // 703
  /*                                                                                                                   // 703
  @isomorphic                                                                                                          //
  @function                                                                                                            //
  @class Meteor.Files                                                                                                  //
  @name get                                                                                                            //
  @description Return value of current cursor or file                                                                  //
  @returns {Object|[Object]}                                                                                           //
   */                                                                                                                  //
                                                                                                                       //
  Files.prototype.get = function() {                                                                                   // 93
    if (this.debug) {                                                                                                  // 712
      console.info('Meteor.Files Debugger: [get()]');                                                                  // 712
    }                                                                                                                  //
    if (this.cursor) {                                                                                                 // 713
      return this.cursor.fetch();                                                                                      // 713
    }                                                                                                                  //
    return this.currentFile;                                                                                           // 714
  };                                                                                                                   //
                                                                                                                       //
                                                                                                                       // 716
  /*                                                                                                                   // 716
  @isomorphic                                                                                                          //
  @function                                                                                                            //
  @class Meteor.Files                                                                                                  //
  @name fetch                                                                                                          //
  @description Alias for `get()` method                                                                                //
  @returns {[Object]}                                                                                                  //
   */                                                                                                                  //
                                                                                                                       //
  Files.prototype.fetch = function() {                                                                                 // 93
    var data;                                                                                                          // 725
    if (this.debug) {                                                                                                  // 725
      console.info('Meteor.Files Debugger: [fetch()]');                                                                // 725
    }                                                                                                                  //
    data = this.get();                                                                                                 // 725
    if (!_.isArray(data)) {                                                                                            // 727
      return [data];                                                                                                   // 728
    } else {                                                                                                           //
      return data;                                                                                                     //
    }                                                                                                                  //
  };                                                                                                                   //
                                                                                                                       //
                                                                                                                       // 732
  /*                                                                                                                   // 732
  @client                                                                                                              //
  @function                                                                                                            //
  @class Meteor.Files                                                                                                  //
  @name insert                                                                                                         //
  @param {Object} config - Configuration object with next properties:                                                  //
    {File|Object} file           - HTML5 `files` item, like in change event: `e.currentTarget.files[0]`                //
    {Object}      meta           - Additional data as object, use later for search                                     //
    {Number}      streams        - Quantity of parallel upload streams                                                 //
    {Function}    onUploaded     - Callback triggered when upload is finished, with two arguments `error` and `fileRef`
    {Function}    onProgress     - Callback triggered when chunk is sent, with only argument `progress`                //
    {Function}    onBeforeUpload - Callback triggered right before upload is started, with only `FileReader` argument:
                                   context is `File` - so you are able to check for extension, mime-type, size and etc.
                                   return true to continue                                                             //
                                   return false to abort upload                                                        //
  @description Upload file to server over DDP                                                                          //
  @url https://developer.mozilla.org/en-US/docs/Web/API/FileReader                                                     //
  @returns {Object} with next properties:                                                                              //
    {ReactiveVar} onPause      - Is upload process on the pause?                                                       //
    {Function}    pause        - Pause upload process                                                                  //
    {Function}    continue     - Continue paused upload process                                                        //
    {Function}    toggle       - Toggle continue/pause if upload process                                               //
    {Function}    abort        - Abort upload                                                                          //
   */                                                                                                                  //
                                                                                                                       //
  Files.prototype.insert = Meteor.isClient ? function(config) {                                                        // 93
    var beforeunload, end, ext, extension, extensionWithDot, file, fileData, fileReader, i, isUploadAllowed, j, last, len, meta, mime, onAbort, onBeforeUpload, onProgress, onUploaded, part, partSize, parts, randFileName, ref, ref1, result, self, streams, totalSentChunks, upload, uploaded;
    if (this.checkAccess()) {                                                                                          // 757
      if (this.debug) {                                                                                                // 758
        console.info('Meteor.Files Debugger: [insert()]');                                                             // 758
      }                                                                                                                //
      file = config.file, meta = config.meta, onUploaded = config.onUploaded, onProgress = config.onProgress, onBeforeUpload = config.onBeforeUpload, onAbort = config.onAbort, streams = config.streams;
      if (meta == null) {                                                                                              //
        meta = {};                                                                                                     //
      }                                                                                                                //
      check(meta, Match.Optional(Object));                                                                             // 758
      check(onAbort, Match.Optional(Function));                                                                        // 758
      check(streams, Match.Optional(Number));                                                                          // 758
      check(onUploaded, Match.Optional(Function));                                                                     // 758
      check(onProgress, Match.Optional(Function));                                                                     // 758
      check(onBeforeUpload, Match.Optional(Function));                                                                 // 758
      if (file) {                                                                                                      // 769
        if (this.debug) {                                                                                              // 770
          console.time('insert');                                                                                      // 770
        }                                                                                                              //
        self = this;                                                                                                   // 770
        beforeunload = function(e) {                                                                                   // 770
          var message;                                                                                                 // 774
          message = _.isFunction(self.onbeforeunloadMessage) ? self.onbeforeunloadMessage.call(null) : self.onbeforeunloadMessage;
          if (e) {                                                                                                     // 775
            e.returnValue = message;                                                                                   // 775
          }                                                                                                            //
          return message;                                                                                              // 776
        };                                                                                                             //
        window.addEventListener('beforeunload', beforeunload, false);                                                  // 770
        result = {                                                                                                     // 770
          onPause: new ReactiveVar(false),                                                                             // 780
          continueFrom: [],                                                                                            // 780
          pause: function() {                                                                                          // 780
            this.onPause.set(true);                                                                                    // 783
            return this.state.set('paused');                                                                           //
          },                                                                                                           //
          "continue": function() {                                                                                     // 780
            var func, j, len, ref;                                                                                     // 786
            this.onPause.set(false);                                                                                   // 786
            this.state.set('active');                                                                                  // 786
            ref = this.continueFrom;                                                                                   // 788
            for (j = 0, len = ref.length; j < len; j++) {                                                              // 788
              func = ref[j];                                                                                           //
              func.call(null);                                                                                         // 788
            }                                                                                                          // 788
            return this.continueFrom = [];                                                                             //
          },                                                                                                           //
          toggle: function() {                                                                                         // 780
            if (this.onPause.get()) {                                                                                  // 791
              return this["continue"]();                                                                               //
            } else {                                                                                                   //
              return this.pause();                                                                                     //
            }                                                                                                          //
          },                                                                                                           //
          progress: new ReactiveVar(0),                                                                                // 780
          abort: function() {                                                                                          // 780
            window.removeEventListener('beforeunload', beforeunload, false);                                           // 794
            onAbort && onAbort.call(file, fileData);                                                                   // 794
            this.pause();                                                                                              // 794
            this.state.set('aborted');                                                                                 // 794
            Meteor.call(self.methodNames.MeteorFileAbort, randFileName, streams, file);                                // 794
            return delete upload;                                                                                      //
          },                                                                                                           //
          state: new ReactiveVar('active')                                                                             // 780
        };                                                                                                             //
        result.progress.set = _.throttle(result.progress.set, 250);                                                    // 770
        Tracker.autorun(function() {                                                                                   // 770
          if (Meteor.status().connected) {                                                                             // 805
            result["continue"]();                                                                                      // 806
            if (self.debug) {                                                                                          // 807
              return console.info('Meteor.Files Debugger: Connection established continue() upload');                  //
            }                                                                                                          //
          } else {                                                                                                     //
            result.pause();                                                                                            // 809
            if (self.debug) {                                                                                          // 810
              return console.info('Meteor.Files Debugger: Connection error set upload on pause()');                    //
            }                                                                                                          //
          }                                                                                                            //
        });                                                                                                            //
        if (!streams) {                                                                                                // 812
          streams = 1;                                                                                                 // 812
        }                                                                                                              //
        totalSentChunks = 0;                                                                                           // 770
        ref = this.getExt(file.name), extension = ref.extension, extensionWithDot = ref.extensionWithDot;              // 770
        if (!file.type) {                                                                                              // 817
          ref1 = this.getMimeType({}), ext = ref1.ext, mime = ref1.mime;                                               // 818
          file.type = mime;                                                                                            // 818
        }                                                                                                              //
        fileData = {                                                                                                   // 770
          size: file.size,                                                                                             // 822
          type: file.type,                                                                                             // 822
          name: file.name,                                                                                             // 822
          ext: extension,                                                                                              // 822
          extension: extension,                                                                                        // 822
          'mime-type': file.type                                                                                       // 822
        };                                                                                                             //
        file = _.extend(file, fileData);                                                                               // 770
        last = false;                                                                                                  // 770
        parts = [];                                                                                                    // 770
        uploaded = 0;                                                                                                  // 770
        partSize = Math.ceil(file.size / streams);                                                                     // 770
        result.file = file;                                                                                            // 770
        randFileName = this.namingFunction();                                                                          // 770
        i = 1;                                                                                                         // 770
        while (i <= streams) {                                                                                         // 838
          parts.push({                                                                                                 // 839
            to: partSize * i,                                                                                          // 840
            from: partSize * (i - 1),                                                                                  // 840
            size: partSize,                                                                                            // 840
            part: i,                                                                                                   // 840
            chunksQty: this.chunkSize < partSize ? Math.ceil(partSize / this.chunkSize) : 1                            // 840
          });                                                                                                          //
          i++;                                                                                                         // 839
        }                                                                                                              //
        end = function(error, data) {                                                                                  // 770
          if (self.debug) {                                                                                            // 848
            console.timeEnd('insert');                                                                                 // 848
          }                                                                                                            //
          window.removeEventListener('beforeunload', beforeunload, false);                                             // 848
          result.progress.set(0);                                                                                      // 848
          result.state.set(error ? 'aborted' : 'completed');                                                           // 848
          return onUploaded && onUploaded.call(self, error, data);                                                     //
        };                                                                                                             //
        if (onBeforeUpload && _.isFunction(onBeforeUpload)) {                                                          // 854
          isUploadAllowed = onBeforeUpload.call(file);                                                                 // 855
          if (isUploadAllowed !== true) {                                                                              // 856
            end(new Meteor.Error(403, _.isString(isUploadAllowed) ? isUploadAllowed : 'onBeforeUpload() returned false'), null);
            return false;                                                                                              // 858
          }                                                                                                            //
        }                                                                                                              //
        if (this.onBeforeUpload && _.isFunction(this.onBeforeUpload)) {                                                // 860
          isUploadAllowed = this.onBeforeUpload.call(file);                                                            // 861
          if (isUploadAllowed !== true) {                                                                              // 862
            end(new Meteor.Error(403, _.isString(isUploadAllowed) ? isUploadAllowed : '@onBeforeUpload() returned false'), null);
            return false;                                                                                              // 864
          }                                                                                                            //
        }                                                                                                              //
        upload = function(filePart, part, chunksQtyInPart, fileReader) {                                               // 770
          var currentChunk, first;                                                                                     // 867
          currentChunk = 1;                                                                                            // 867
          first = true;                                                                                                // 867
          if (this.debug) {                                                                                            // 869
            console.time("insertPart" + part);                                                                         // 869
          }                                                                                                            //
          fileReader.onload = function(chunk) {                                                                        // 867
            var arrayBuffer, progress, unitArray;                                                                      // 872
            ++totalSentChunks;                                                                                         // 872
            progress = (uploaded / file.size) * 100;                                                                   // 872
            result.progress.set(progress);                                                                             // 872
            onProgress && onProgress(progress);                                                                        // 872
            last = part === streams && currentChunk >= chunksQtyInPart;                                                // 872
            uploaded += self.chunkSize;                                                                                // 872
            arrayBuffer = chunk.srcElement || chunk.target;                                                            // 872
            unitArray = new Uint8Array(arrayBuffer.result);                                                            // 872
            if (chunksQtyInPart === 1) {                                                                               // 882
              Meteor.call(self.methodNames.MeteorFileWrite, unitArray, fileData, meta, first, chunksQtyInPart, currentChunk, totalSentChunks, randFileName, part, streams, file.size, function(error, data) {
                if (error) {                                                                                           // 884
                  return end(error);                                                                                   // 884
                }                                                                                                      //
                if (data.last) {                                                                                       // 885
                  return end(error, data);                                                                             //
                }                                                                                                      //
              });                                                                                                      //
            } else {                                                                                                   //
              Meteor.call(self.methodNames.MeteorFileWrite, unitArray, fileData, meta, first, chunksQtyInPart, currentChunk, totalSentChunks, randFileName, part, streams, file.size, function(error, data) {
                var next;                                                                                              // 889
                if (error) {                                                                                           // 889
                  return end(error);                                                                                   // 889
                }                                                                                                      //
                next = function() {                                                                                    // 889
                  var from, to;                                                                                        // 891
                  if (data.chunk + 1 <= chunksQtyInPart) {                                                             // 891
                    from = currentChunk * self.chunkSize;                                                              // 892
                    to = from + self.chunkSize;                                                                        // 892
                    fileReader.readAsArrayBuffer(filePart.slice(from, to));                                            // 892
                    return currentChunk = ++data.chunk;                                                                //
                  } else if (data.last) {                                                                              //
                    return end(error, data);                                                                           //
                  }                                                                                                    //
                };                                                                                                     //
                if (!result.onPause.get()) {                                                                           // 900
                  return next.call(null);                                                                              //
                } else {                                                                                               //
                  return result.continueFrom.push(next);                                                               //
                }                                                                                                      //
              });                                                                                                      //
            }                                                                                                          //
            return first = false;                                                                                      //
          };                                                                                                           //
          if (!result.onPause.get()) {                                                                                 // 907
            return fileReader.readAsArrayBuffer(filePart.slice(0, self.chunkSize));                                    //
          }                                                                                                            //
        };                                                                                                             //
        for (i = j = 0, len = parts.length; j < len; i = ++j) {                                                        // 909
          part = parts[i];                                                                                             //
          fileReader = new FileReader;                                                                                 // 910
          upload.call(null, file.slice(part.from, part.to), i + 1, part.chunksQty, fileReader);                        // 910
        }                                                                                                              // 909
        return result;                                                                                                 // 913
      } else {                                                                                                         //
        return console.warn('Meteor.Files: [insert({file: "file", ..})]: file property is required');                  //
      }                                                                                                                //
    }                                                                                                                  //
  } : void 0;                                                                                                          //
                                                                                                                       //
                                                                                                                       // 919
  /*                                                                                                                   // 919
  @isomorphic                                                                                                          //
  @function                                                                                                            //
  @class Meteor.Files                                                                                                  //
  @name remove                                                                                                         //
  @param {String|Object} search - `_id` of the file or `Object` like, {prop:'val'}                                     //
  @description Remove file(s) on cursor or find and remove file(s) if search is set                                    //
  @returns {undefined}                                                                                                 //
   */                                                                                                                  //
                                                                                                                       //
  Files.prototype.remove = function(search) {                                                                          // 93
    var files;                                                                                                         // 929
    if (this.debug) {                                                                                                  // 929
      console.info("Meteor.Files Debugger: [remove(" + (JSON.stringify(search)) + ")]");                               // 929
    }                                                                                                                  //
    check(search, Match.Optional(Match.OneOf(Object, String)));                                                        // 929
    if (this.checkAccess()) {                                                                                          // 932
      this.srch(search);                                                                                               // 933
      if (Meteor.isClient) {                                                                                           // 934
        Meteor.call(this.methodNames.MeteorFileUnlink, rcp(this));                                                     // 935
        void 0;                                                                                                        // 935
      }                                                                                                                //
      if (Meteor.isServer) {                                                                                           // 938
        files = this.collection.find(this.search);                                                                     // 939
        if (files.count() > 0) {                                                                                       // 940
          files.forEach((function(_this) {                                                                             // 941
            return function(file) {                                                                                    //
              return _this.unlink(file);                                                                               //
            };                                                                                                         //
          })(this));                                                                                                   //
        }                                                                                                              //
        this.collection.remove(this.search);                                                                           // 939
        return void 0;                                                                                                 //
      }                                                                                                                //
    }                                                                                                                  //
  };                                                                                                                   //
                                                                                                                       //
                                                                                                                       // 945
  /*                                                                                                                   // 945
  @sever                                                                                                               //
  @function                                                                                                            //
  @class Meteor.Files                                                                                                  //
  @name unlink                                                                                                         //
  @param {Object} file - fileObj                                                                                       //
  @description Unlink files and it's versions from FS                                                                  //
  @returns {undefined}                                                                                                 //
   */                                                                                                                  //
                                                                                                                       //
  Files.prototype.unlink = Meteor.isServer ? function(file) {                                                          // 93
    if (file.versions && !_.isEmpty(file.versions)) {                                                                  // 955
      _.each(file.versions, function(version) {                                                                        // 956
        return fs.remove(version.path);                                                                                //
      });                                                                                                              //
    } else {                                                                                                           //
      fs.remove(file.path);                                                                                            // 959
    }                                                                                                                  //
    return void 0;                                                                                                     //
  } : void 0;                                                                                                          //
                                                                                                                       //
                                                                                                                       // 964
  /*                                                                                                                   // 964
  @server                                                                                                              //
  @function                                                                                                            //
  @class Meteor.Files                                                                                                  //
  @name download                                                                                                       //
  @param {Object|Files} self - Instance of MEteor.Files                                                                //
  @description Initiates the HTTP response                                                                             //
  @returns {undefined}                                                                                                 //
   */                                                                                                                  //
                                                                                                                       //
  Files.prototype.download = Meteor.isServer ? function(http, version) {                                               // 93
    var array, dispositionEncoding, dispositionName, dispositionType, end, fileRef, fileStats, partiral, ref, ref1, ref2, ref3, reqRange, responseType, start, stream, streamErrorHandler, take, text;
    if (version == null) {                                                                                             //
      version = 'original';                                                                                            //
    }                                                                                                                  //
    if (this.debug) {                                                                                                  // 974
      console.info("Meteor.Files Debugger: [download(" + http + ", " + version + ")]");                                // 974
    }                                                                                                                  //
    responseType = '200';                                                                                              // 974
    if (!this["public"]) {                                                                                             // 976
      if (this.currentFile) {                                                                                          // 977
        if (_.has(this.currentFile, 'versions') && _.has(this.currentFile.versions, version)) {                        // 978
          fileRef = this.currentFile.versions[version];                                                                // 979
        } else {                                                                                                       //
          fileRef = this.currentFile;                                                                                  // 981
        }                                                                                                              //
      } else {                                                                                                         //
        fileRef = false;                                                                                               // 983
      }                                                                                                                //
    }                                                                                                                  //
    if (this["public"]) {                                                                                              // 985
      fileRef = {                                                                                                      // 986
        path: this.storagePath + "/" + http.params.file                                                                // 987
      };                                                                                                               //
      responseType = fs.existsSync(fileRef.path) ? '200' : '404';                                                      // 986
    } else if (!fileRef || !_.isObject(fileRef) || !fs.existsSync(fileRef.path)) {                                     //
      responseType = '404';                                                                                            // 990
    } else if (this.currentFile && fs.existsSync(fileRef.path)) {                                                      //
      if (this.downloadCallback) {                                                                                     // 993
        if (!this.downloadCallback.call(_.extend(http, this.getUser(http)), this.currentFile)) {                       // 994
          responseType = '404';                                                                                        // 995
        }                                                                                                              //
      }                                                                                                                //
      partiral = false;                                                                                                // 993
      reqRange = false;                                                                                                // 993
      fileStats = fs.statSync(fileRef.path);                                                                           // 993
      if (fileStats.size !== fileRef.size && !this.integrityCheck) {                                                   // 1000
        fileRef.size = fileStats.size;                                                                                 // 1000
      }                                                                                                                //
      if (fileStats.size !== fileRef.size && this.integrityCheck) {                                                    // 1001
        responseType = '400';                                                                                          // 1001
      }                                                                                                                //
      if (http.params.query.download && http.params.query.download === 'true') {                                       // 1003
        dispositionType = 'attachment; ';                                                                              // 1004
      } else {                                                                                                         //
        dispositionType = 'inline; ';                                                                                  // 1006
      }                                                                                                                //
      dispositionName = "filename=\"" + (encodeURIComponent(this.currentFile.name)) + "\"; filename=*UTF-8\"" + (encodeURIComponent(this.currentFile.name)) + "\"; ";
      dispositionEncoding = 'charset=utf-8';                                                                           // 993
      http.response.setHeader('Content-Type', fileRef.type);                                                           // 993
      http.response.setHeader('Content-Disposition', dispositionType + dispositionName + dispositionEncoding);         // 993
      http.response.setHeader('Accept-Ranges', 'bytes');                                                               // 993
      if ((ref = this.currentFile) != null ? (ref1 = ref.updatedAt) != null ? ref1.toUTCString() : void 0 : void 0) {  // 1014
        http.response.setHeader('Last-Modified', (ref2 = this.currentFile) != null ? (ref3 = ref2.updatedAt) != null ? ref3.toUTCString() : void 0 : void 0);
      }                                                                                                                //
      http.response.setHeader('Connection', 'keep-alive');                                                             // 993
      if (http.request.headers.range) {                                                                                // 1017
        partiral = true;                                                                                               // 1018
        array = http.request.headers.range.split(/bytes=([0-9]*)-([0-9]*)/);                                           // 1018
        start = parseInt(array[1]);                                                                                    // 1018
        end = parseInt(array[2]);                                                                                      // 1018
        if (isNaN(end)) {                                                                                              // 1022
          end = (start + this.chunkSize) < fileRef.size ? start + this.chunkSize : fileRef.size;                       // 1023
        }                                                                                                              //
        take = end - start;                                                                                            // 1018
      } else {                                                                                                         //
        start = 0;                                                                                                     // 1026
        end = void 0;                                                                                                  // 1026
        take = this.chunkSize;                                                                                         // 1026
      }                                                                                                                //
      if (take > 4096000) {                                                                                            // 1030
        take = 4096000;                                                                                                // 1031
        end = start + take;                                                                                            // 1031
      }                                                                                                                //
      if (partiral || (http.params.query.play && http.params.query.play === 'true')) {                                 // 1034
        reqRange = {                                                                                                   // 1035
          start: start,                                                                                                // 1035
          end: end                                                                                                     // 1035
        };                                                                                                             //
        if (isNaN(start) && !isNaN(end)) {                                                                             // 1036
          reqRange.start = end - take;                                                                                 // 1037
          reqRange.end = end;                                                                                          // 1037
        }                                                                                                              //
        if (!isNaN(start) && isNaN(end)) {                                                                             // 1039
          reqRange.start = start;                                                                                      // 1040
          reqRange.end = start + take;                                                                                 // 1040
        }                                                                                                              //
        if ((start + take) >= fileRef.size) {                                                                          // 1043
          reqRange.end = fileRef.size - 1;                                                                             // 1043
        }                                                                                                              //
        http.response.setHeader('Pragma', 'private');                                                                  // 1035
        http.response.setHeader('Expires', new Date(+(new Date) + 1000 * 32400).toUTCString());                        // 1035
        http.response.setHeader('Cache-Control', 'private, maxage=10800, s-maxage=32400');                             // 1035
        if ((this.strict && !http.request.headers.range) || reqRange.start >= fileRef.size || reqRange.end > fileRef.size) {
          responseType = '416';                                                                                        // 1049
        } else {                                                                                                       //
          responseType = '206';                                                                                        // 1051
        }                                                                                                              //
      } else {                                                                                                         //
        http.response.setHeader('Cache-Control', this.cacheControl);                                                   // 1053
        responseType = '200';                                                                                          // 1053
      }                                                                                                                //
    } else {                                                                                                           //
      responseType = '404';                                                                                            // 1056
    }                                                                                                                  //
    streamErrorHandler = function(error) {                                                                             // 974
      http.response.writeHead(500);                                                                                    // 1059
      return http.response.end(error.toString());                                                                      //
    };                                                                                                                 //
    switch (responseType) {                                                                                            // 1062
      case '400':                                                                                                      // 1062
        if (this.debug) {                                                                                              // 1064
          console.warn("Meteor.Files Debugger: [download(" + http + ", " + version + ")] [400] Content-Length mismatch!: " + fileRef.path);
        }                                                                                                              //
        text = 'Content-Length mismatch!';                                                                             // 1064
        http.response.writeHead(400, {                                                                                 // 1064
          'Content-Type': 'text/plain',                                                                                // 1067
          'Cache-Control': 'no-cache',                                                                                 // 1067
          'Content-Length': text.length                                                                                // 1067
        });                                                                                                            //
        http.response.end(text);                                                                                       // 1064
        break;                                                                                                         // 1071
      case '404':                                                                                                      // 1062
        if (this.debug) {                                                                                              // 1073
          console.warn("Meteor.Files Debugger: [download(" + http + ", " + version + ")] [404] File not found: " + (fileRef && fileRef.path ? fileRef.path : void 0));
        }                                                                                                              //
        text = 'File Not Found :(';                                                                                    // 1073
        http.response.writeHead(404, {                                                                                 // 1073
          'Content-Length': text.length,                                                                               // 1076
          'Content-Type': 'text/plain'                                                                                 // 1076
        });                                                                                                            //
        http.response.end(text);                                                                                       // 1073
        break;                                                                                                         // 1079
      case '416':                                                                                                      // 1062
        if (this.debug) {                                                                                              // 1081
          console.info("Meteor.Files Debugger: [download(" + http + ", " + version + ")] [416] Content-Range is not specified!: " + fileRef.path);
        }                                                                                                              //
        http.response.writeHead(416, {                                                                                 // 1081
          'Content-Range': "bytes */" + fileRef.size                                                                   // 1083
        });                                                                                                            //
        http.response.end();                                                                                           // 1081
        break;                                                                                                         // 1085
      case '200':                                                                                                      // 1062
        if (this.debug) {                                                                                              // 1087
          console.info("Meteor.Files Debugger: [download(" + http + ", " + version + ")] [200]: " + fileRef.path);     // 1087
        }                                                                                                              //
        stream = fs.createReadStream(fileRef.path);                                                                    // 1087
        stream.on('open', (function(_this) {                                                                           // 1087
          return function() {                                                                                          //
            http.response.writeHead(200);                                                                              // 1090
            if (_this.throttle) {                                                                                      // 1091
              return stream.pipe(new Throttle({                                                                        //
                bps: _this.throttle,                                                                                   // 1092
                chunksize: _this.chunkSize                                                                             // 1092
              })).pipe(http.response);                                                                                 //
            } else {                                                                                                   //
              return stream.pipe(http.response);                                                                       //
            }                                                                                                          //
          };                                                                                                           //
        })(this)).on('error', streamErrorHandler);                                                                     //
        break;                                                                                                         // 1097
      case '206':                                                                                                      // 1062
        if (this.debug) {                                                                                              // 1099
          console.info("Meteor.Files Debugger: [download(" + http + ", " + version + ")] [206]: " + fileRef.path);     // 1099
        }                                                                                                              //
        http.response.setHeader('Content-Range', "bytes " + reqRange.start + "-" + reqRange.end + "/" + fileRef.size);
        http.response.setHeader('Trailer', 'expires');                                                                 // 1099
        http.response.setHeader('Transfer-Encoding', 'chunked');                                                       // 1099
        if (this.throttle) {                                                                                           // 1103
          stream = fs.createReadStream(fileRef.path, {                                                                 // 1104
            start: reqRange.start,                                                                                     // 1104
            end: reqRange.end                                                                                          // 1104
          });                                                                                                          //
          stream.on('open', function() {                                                                               // 1104
            return http.response.writeHead(206);                                                                       //
          }).on('error', streamErrorHandler).on('end', function() {                                                    //
            return http.response.end();                                                                                //
          }).pipe(new Throttle({                                                                                       //
            bps: this.throttle,                                                                                        // 1108
            chunksize: this.chunkSize                                                                                  // 1108
          })).pipe(http.response);                                                                                     //
        } else {                                                                                                       //
          stream = fs.createReadStream(fileRef.path, {                                                                 // 1111
            start: reqRange.start,                                                                                     // 1111
            end: reqRange.end                                                                                          // 1111
          });                                                                                                          //
          stream.on('open', function() {                                                                               // 1111
            return http.response.writeHead(206);                                                                       //
          }).on('error', streamErrorHandler).on('end', function() {                                                    //
            return http.response.end();                                                                                //
          }).pipe(http.response);                                                                                      //
        }                                                                                                              //
        break;                                                                                                         // 1116
    }                                                                                                                  // 1062
    return void 0;                                                                                                     //
  } : void 0;                                                                                                          //
                                                                                                                       //
                                                                                                                       // 1121
  /*                                                                                                                   // 1121
  @isomorphic                                                                                                          //
  @function                                                                                                            //
  @class Meteor.Files                                                                                                  //
  @name link                                                                                                           //
  @param {Object}   fileRef - File reference object                                                                    //
  @param {String}   version - [Optional] Version of file you would like to request                                     //
  @param {Boolean}  pub     - [Optional] is file located in publicity available folder?                                //
  @description Returns URL to file                                                                                     //
  @returns {String}                                                                                                    //
   */                                                                                                                  //
                                                                                                                       //
  Files.prototype.link = function(fileRef, version, pub) {                                                             // 93
    if (version == null) {                                                                                             //
      version = 'original';                                                                                            //
    }                                                                                                                  //
    if (pub == null) {                                                                                                 //
      pub = false;                                                                                                     //
    }                                                                                                                  //
    if (this.debug) {                                                                                                  // 1133
      console.info('Meteor.Files Debugger: [link()]');                                                                 // 1133
    }                                                                                                                  //
    if (_.isString(fileRef)) {                                                                                         // 1134
      version = fileRef;                                                                                               // 1135
      fileRef = void 0;                                                                                                // 1135
    }                                                                                                                  //
    if (!fileRef && !this.currentFile) {                                                                               // 1137
      return void 0;                                                                                                   // 1137
    }                                                                                                                  //
    if (this["public"]) {                                                                                              // 1139
      return formatFleURL(fileRef || this.currentFile, version, true);                                                 // 1140
    } else {                                                                                                           //
      return formatFleURL(fileRef || this.currentFile, version, false);                                                // 1142
    }                                                                                                                  //
  };                                                                                                                   //
                                                                                                                       //
  return Files;                                                                                                        //
                                                                                                                       //
})();                                                                                                                  //
                                                                                                                       //
                                                                                                                       // 1144
/*                                                                                                                     // 1144
@isomorphic                                                                                                            //
@function                                                                                                              //
@name formatFleURL                                                                                                     //
@param {Object} fileRef - File reference object                                                                        //
@param {String} version - [Optional] Version of file you would like build URL for                                      //
@param {Boolean}  pub   - [Optional] is file located in publicity available folder?                                    //
@description Returns formatted URL for file                                                                            //
@returns {String}                                                                                                      //
 */                                                                                                                    //
                                                                                                                       //
formatFleURL = function(fileRef, version, pub) {                                                                       // 1
  var ext, ref, root;                                                                                                  // 1155
  if (version == null) {                                                                                               //
    version = 'original';                                                                                              //
  }                                                                                                                    //
  if (pub == null) {                                                                                                   //
    pub = false;                                                                                                       //
  }                                                                                                                    //
  root = __meteor_runtime_config__.ROOT_URL.replace(/\/+$/, '');                                                       // 1155
  if ((fileRef != null ? (ref = fileRef.extension) != null ? ref.length : void 0 : void 0) > 0) {                      // 1157
    ext = '.' + fileRef.extension;                                                                                     // 1158
  } else {                                                                                                             //
    ext = '';                                                                                                          // 1160
  }                                                                                                                    //
  if (pub) {                                                                                                           // 1162
    return root + (fileRef._downloadRoute + "/" + version + "-" + fileRef._id + ext);                                  // 1163
  } else {                                                                                                             //
    return root + (fileRef._downloadRoute + "/" + fileRef._collectionName + "/" + fileRef._id + "/" + version + "/" + fileRef._id + ext);
  }                                                                                                                    //
};                                                                                                                     // 1154
                                                                                                                       //
if (Meteor.isClient) {                                                                                                 // 1167
                                                                                                                       // 1168
  /*                                                                                                                   // 1168
  @client                                                                                                              //
  @TemplateHelper                                                                                                      //
  @name fileURL                                                                                                        //
  @param {Object} fileRef - File reference object                                                                      //
  @param {String} version - [Optional] Version of file you would like to request                                       //
  @description Get download URL for file by fileRef, even without subscription                                         //
  @example {{fileURL fileRef}}                                                                                         //
  @returns {String}                                                                                                    //
   */                                                                                                                  //
  Template.registerHelper('fileURL', function(fileRef, version) {                                                      // 1168
    if (!fileRef || !_.isObject(fileRef)) {                                                                            // 1179
      return void 0;                                                                                                   // 1179
    }                                                                                                                  //
    version = !_.isString(version) ? 'original' : version;                                                             // 1179
    if (fileRef._id) {                                                                                                 // 1181
      if (fileRef._storagePath.indexOf('../web.browser') !== -1) {                                                     // 1182
        return formatFleURL(fileRef, version, true);                                                                   // 1183
      } else {                                                                                                         //
        return formatFleURL(fileRef, version, false);                                                                  // 1185
      }                                                                                                                //
    } else {                                                                                                           //
      return null;                                                                                                     //
    }                                                                                                                  //
  });                                                                                                                  //
}                                                                                                                      //
                                                                                                                       //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['ostrio:files'] = {};

})();

//# sourceMappingURL=ostrio_files.js.map
