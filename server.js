import { Mongo } from 'meteor/mongo';
import { fetch } from 'meteor/fetch';
import { WebApp } from 'meteor/webapp';
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { Cookies } from 'meteor/ostrio:cookies';
import { check, Match } from 'meteor/check';

import WriteStream from './write-stream.js';
import FilesCollectionCore from './core.js';
import { fixJSONParse, fixJSONStringify, helpers } from './lib.js';

import AbortController from 'abort-controller';
import fs from 'fs';
import nodeQs from 'querystring';
import nodePath from 'path';
// in Node.js 14, there is no promises version of stream
import { pipeline as pipelineCallback } from 'stream';
import { promisify } from 'util';
// change to this in "loadAsync" when Meteor supports Node.js 15 upwards
//import nodeStream from 'stream/promises';

const pipeline = promisify(pipelineCallback);

/**
 * @const {Object} bound  - Meteor.bindEnvironment (Fiber wrapper)
 * @const {Function} noop - No Operation function, placeholder for required callbacks
 */
const bound = Meteor.bindEnvironment(callback => callback());
const noop = function noop () {};

/**
 * Create (ensure) index on MongoDB collection, catch and log exception if thrown
 * @function createIndex
 * @param {Mongo.Collection} collection - Mongo.Collection instance
 * @param {object} keys - Field and value pairs where the field is the index key and the value describes the type of index for that field
 * @param {object} opts - Set of options that controls the creation of the index
 * @returns {void 0}
 */
const createIndex = async (_collection, keys, opts) => {
  const collection = _collection.rawCollection();

  try {
    await collection.createIndex(keys, opts);
  } catch (e) {
    if (e.code === 85) {
      let indexName;
      const indexes = await collection.indexes();
      for (const index of indexes) {
        let allMatch = true;
        for (const indexKey of Object.keys(keys)) {
          if (typeof index.key[indexKey] === 'undefined') {
            allMatch = false;
            break;
          }
        }

        for (const indexKey of Object.keys(index.key)) {
          if (typeof keys[indexKey] === 'undefined') {
            allMatch = false;
            break;
          }
        }

        if (allMatch) {
          indexName = index.name;
          break;
        }
      }

      if (indexName) {
        await collection.dropIndex(indexName);
        await collection.createIndex(keys, opts);
      }
    } else {
      Meteor._debug(`Can not set ${Object.keys(keys).join(' + ')} index on "${_collection._name}" collection`, { keys, opts, details: e });
    }
  }
};

/**
 * @locus Anywhere
 * @class FilesCollection
 * @param config           {Object}   - [Both]   Configuration object with next properties:
 * @param config.debug     {Boolean}  - [Both]   Turn on/of debugging and extra logging
 * @param config.schema    {Object}   - [Both]   Collection Schema
 * @param config.public    {Boolean}  - [Both]   Store files in folder accessible for proxy servers, for limits, and more - read docs
 * @param config.strict    {Boolean}  - [Server] Strict mode for partial content, if is `true` server will return `416` response code, when `range` is not specified, otherwise server return `206`
 * @param config.protected {Function} - [Server] If `true` - files will be served only to authorized users, if `function()` - you're able to check visitor's permissions in your own way function's context has:
 *  - `request`
 *  - `response`
 *  - `user()`
 *  - `userId`
 * @param config.protectedAsync {Function} - [Server] Same as `protected`, but returns a Promise that resolves to a Boolean
 * @param config.chunkSize      {Number}  - [Both] Upload chunk size, default: 524288 bytes (0,5 Mb)
 * @param config.permissions    {Number}  - [Server] Permissions which will be set to uploaded files (octal), like: `511` or `0o755`. Default: 0644
 * @param config.parentDirPermissions {Number}  - [Server] Permissions which will be set to parent directory of uploaded files (octal), like: `611` or `0o777`. Default: 0755
 * @param config.storagePath    {String|Function}  - [Server] Storage path on file system
 * @param config.cacheControl   {String}  - [Server] Default `Cache-Control` header
 * @param config.responseHeaders {Object|Function} - [Server] Custom response headers, if function is passed, must return Object
 * @param config.throttle       {Number}  - [Server] DEPRECATED bps throttle threshold
 * @param config.downloadRoute  {String}  - [Both]   Server Route used to retrieve files
 * @param config.collection     {Mongo.Collection} - [Both] Mongo Collection Instance
 * @param config.collectionName {String}  - [Both]   Collection name
 * @param config.namingFunction {Function}- [Both]   Function which returns `String`
 * @param config.integrityCheck {Boolean} - [Server] Check file's integrity before serving to users
 * @param config.onAfterUpload  {Function}- [Server] Called right after file is ready on FS. Use to transfer file somewhere else, or do other thing with file directly
 * @param config.onAfterRemove  {Function} - [Server] Called right after file is removed. Removed objects is passed to callback
 * @param config.onAfterRemoveAsync  {Function} - [Server] Called right after file is removed by the removeAsync method. Removed objects is passed to the function
 * @param config.continueUploadTTL {Number} - [Server] Time in seconds, during upload may be continued, default 3 hours (10800 seconds)
 * @param config.onBeforeUpload {Function}- [Both]   Function which executes on server after receiving each chunk and on client right before beginning upload. Function context is `File` - so you are able to check for extension, mime-type, size and etc.:
 *  - return or resolve `true` to continue
 *  - return or resolve `false` or `String` to abort upload
 * @param config.getUser        {Function} - [Server] Replace default way of recognizing user, usefull when you want to auth user based on custom cookie (or other way). arguments {http: {request: {...}, response: {...}}}, need to return {userId: String, user: Function}
 * @param config.onInitiateUpload {Function} - [Server] Function which executes on server right before upload is begin and right after `onBeforeUpload` hook. This hook is fully asynchronous.
 * @param config.onBeforeRemove {Function} - [Server] Executes before removing file on server, so you can check permissions. Return `true` to allow action and `false` to deny.
 * @param config.allowClientCode  {Boolean}  - [Both]   Allow to run `remove` from client
 * @param config.downloadCallback {Function} - [Server] Callback triggered each time file is requested, return truthy value to continue download, or falsy to abort
 * @param config.downloadCallbackAsync {Function} - [Server] async Callback triggered each time file is requested, return a Promise resolving to a truthy value to continue download, or falsy to abort
 * @param config.interceptRequest {Function} - [Server] Intercept incoming HTTP request, so you can whatever you want, no checks or preprocessing, arguments {http: {request: {...}, response: {...}}, params: {...}}
 * @param config.interceptDownload {Function} - [Server] Intercept download request, so you can serve file from third-party resource, arguments {http: {request: {...}, response: {...}}, fileRef: {...}}
 * @param config.interceptDownloadAsync {Function} - [Server] Intercept download request, so you can serve file from third-party resource, arguments {http: {request: {...}, response: {...}}, fileRef: {...}}. Returns a Promise that resolves to a Boolean.
 * @param config.disableUpload {Boolean} - Disable file upload, useful for server only solutions
 * @param config.disableDownload {Boolean} - Disable file download (serving), useful for file management only solutions
 * @param config.allowedOrigins  {Regex|Boolean}  - [Server]   Regex of Origins that are allowed CORS access or `false` to disable completely. Defaults to `/^http:\/\/localhost:12[0-9]{3}$/` for allowing Meteor-Cordova builds access
 * @param config.allowQueryStringCookies {Boolean} - Allow passing Cookies in a query string (in URL). Primary should be used only in Cordova environment. Note: this option will be used only on Cordova. Default: `false`
 * @param config.sanitize {Function} - Override default sanitize function
 * @param config._preCollection  {Mongo.Collection} - [Server] Mongo preCollection Instance
 * @param config._preCollectionName {String}  - [Server]  preCollection name
 * @summary Create new instance of FilesCollection
 */
class FilesCollection extends FilesCollectionCore {
  constructor(config) {
    super();
    let storagePath;
    if (config) {
      ({
        _preCollection: this._preCollection,
        _preCollectionName: this._preCollectionName,
        allowClientCode: this.allowClientCode,
        allowedOrigins: this.allowedOrigins,
        allowQueryStringCookies: this.allowQueryStringCookies,
        cacheControl: this.cacheControl,
        chunkSize: this.chunkSize,
        collection: this.collection,
        collectionName: this.collectionName,
        continueUploadTTL: this.continueUploadTTL,
        debug: this.debug,
        disableDownload: this.disableDownload,
        disableUpload: this.disableUpload,
        downloadCallback: this.downloadCallback,
        downloadCallbackAsync: this.downloadCallbackAsync,
        downloadRoute: this.downloadRoute,
        getUser: this.getUser,
        integrityCheck: this.integrityCheck,
        interceptDownload: this.interceptDownload,
        interceptDownloadAsync: this.interceptDownloadAsync,
        interceptRequest: this.interceptRequest,
        namingFunction: this.namingFunction,
        onAfterRemove: this.onAfterRemove,
        onAfterRemoveAsync: this.onAfterRemoveAsync,
        onAfterUpload: this.onAfterUpload,
        onAfterUploadAsync: this.onAfterUploadAsync,
        onBeforeRemove: this.onBeforeRemove,
        onBeforeUpload: this.onBeforeUpload,
        onInitiateUpload: this.onInitiateUpload,
        parentDirPermissions: this.parentDirPermissions,
        permissions: this.permissions,
        protected: this.protected,
        protectedAsync: this.protectedAsync,
        public: this.public,
        responseHeaders: this.responseHeaders,
        sanitize: this.sanitize,
        schema: this.schema,
        storagePath,
        strict: this.strict,
      } = config);
    }

    const self = this;

    if (!helpers.isBoolean(this.debug)) {
      this.debug = false;
    }

    if (!helpers.isBoolean(this.public)) {
      this.public = false;
    }

    if (!this.protected) {
      this.protected = false;
    }

    if (!this.protectedAsync) {
      this.protectedAsync = false;
    }

    if (!this.chunkSize) {
      this.chunkSize = 1024 * 512;
    }

    this.chunkSize = Math.floor(this.chunkSize / 8) * 8;

    if (!helpers.isString(this.collectionName) && !this.collection) {
      this.collectionName = 'MeteorUploadFiles';
    }

    if (!this.collection) {
      this.collection = new Mongo.Collection(this.collectionName);
    } else {
      this.collectionName = this.collection._name;
    }

    this.collection.filesCollection = this;
    check(this.collectionName, String);

    if (this.public && !this.downloadRoute) {
      throw new Meteor.Error(500, `[FilesCollection.${this.collectionName}]: "downloadRoute" must be precisely provided on "public" collections! Note: "downloadRoute" must be equal or be inside of your web/proxy-server (relative) root.`);
    }

    if (!helpers.isString(this.downloadRoute)) {
      this.downloadRoute = '/cdn/storage';
    }

    this.downloadRoute = this.downloadRoute.replace(/\/$/, '');

    if (!helpers.isFunction(this.namingFunction)) {
      this.namingFunction = false;
    }

    if (!helpers.isFunction(this.onBeforeUpload)) {
      this.onBeforeUpload = false;
    }

    if (!helpers.isFunction(this.getUser)) {
      this.getUser = false;
    }

    if (!helpers.isBoolean(this.allowClientCode)) {
      this.allowClientCode = true;
    }

    if (!helpers.isFunction(this.onInitiateUpload)) {
      this.onInitiateUpload = false;
    }

    if (!helpers.isFunction(this.interceptRequest)) {
      this.interceptRequest = false;
    }

    if (!helpers.isFunction(this.interceptDownload)) {
      this.interceptDownload = false;
    }

    if (!helpers.isFunction(this.interceptDownloadAsync)) {
      this.interceptDownloadAsync = false;
    }

    if (!helpers.isBoolean(this.strict)) {
      this.strict = true;
    }

    if (!helpers.isBoolean(this.allowQueryStringCookies)) {
      this.allowQueryStringCookies = false;
    }

    if (!helpers.isNumber(this.permissions)) {
      this.permissions = parseInt('644', 8);
    }

    if (!helpers.isNumber(this.parentDirPermissions)) {
      this.parentDirPermissions = parseInt('755', 8);
    }

    if (!helpers.isString(this.cacheControl)) {
      this.cacheControl = 'public, max-age=31536000, s-maxage=31536000';
    }

    if (!helpers.isFunction(this.onAfterUpload)) {
      this.onAfterUpload = false;
    }

    if (!helpers.isFunction(this.onAfterUploadAsync)) {
      this.onAfterUploadAsync = false;
    }

    if (!helpers.isBoolean(this.disableUpload)) {
      this.disableUpload = false;
    }

    if (!helpers.isFunction(this.onAfterRemove)) {
      this.onAfterRemove = false;
    }

    if (!helpers.isFunction(this.onAfterRemoveAsync)) {
      this.onAfterRemoveAsync = false;
    }

    if (!helpers.isFunction(this.onBeforeRemove)) {
      this.onBeforeRemove = false;
    }

    if (!helpers.isBoolean(this.integrityCheck)) {
      this.integrityCheck = true;
    }

    if (!helpers.isBoolean(this.disableDownload)) {
      this.disableDownload = false;
    }

    if (this.allowedOrigins === true || this.allowedOrigins === void 0) {
      this.allowedOrigins = /^http:\/\/localhost:12[0-9]{3}$/;
    }

    if (!helpers.isObject(this._currentUploads)) {
      this._currentUploads = {};
    }

    if (!helpers.isFunction(this.downloadCallback)) {
      this.downloadCallback = false;
    }

    if (!helpers.isFunction(this.downloadCallbackAsync)) {
      this.downloadCallbackAsync = false;
    }

    if (!helpers.isNumber(this.continueUploadTTL)) {
      this.continueUploadTTL = 10800;
    }

    if (!helpers.isFunction(this.sanitize)) {
      this.sanitize = helpers.sanitize;
    }

    if (!helpers.isFunction(this.responseHeaders)) {
      this.responseHeaders = (responseCode, fileRef, versionRef) => {
        const headers = {};
        switch (responseCode) {
        case '206':
          headers.Pragma = 'private';
          headers['Transfer-Encoding'] = 'chunked';
          break;
        case '400':
          headers['Cache-Control'] = 'no-cache';
          break;
        case '416':
          headers['Content-Range'] = `bytes */${versionRef.size}`;
          break;
        default:
          break;
        }

        headers.Connection = 'keep-alive';
        headers['Content-Type'] = versionRef.type || 'application/octet-stream';
        headers['Accept-Ranges'] = 'bytes';
        return headers;
      };
    }

    if (this.public && !storagePath) {
      throw new Meteor.Error(500, `[FilesCollection.${this.collectionName}] "storagePath" must be set on "public" collections! Note: "storagePath" must be equal on be inside of your web/proxy-server (absolute) root.`);
    }

    if (!storagePath) {
      storagePath = function () {
        return `assets${nodePath.sep}app${nodePath.sep}uploads${nodePath.sep}${self.collectionName}`;
      };
    }

    if (helpers.isString(storagePath)) {
      this.storagePath = () => storagePath;
    } else {
      this.storagePath = function () {
        let sp = storagePath.apply(self, arguments);
        if (!helpers.isString(sp)) {
          throw new Meteor.Error(400, `[FilesCollection.${self.collectionName}] "storagePath" function must return a String!`);
        }
        sp = sp.replace(/\/$/, '');
        return nodePath.normalize(sp);
      };
    }

    this._debug('[FilesCollection.storagePath] Set to:', this.storagePath({}));

    try {
      fs.mkdirSync(this.storagePath({}), {
        mode: this.parentDirPermissions,
        recursive: true
      });
    } catch (error) {
      if (error) {
        throw new Meteor.Error(401, `[FilesCollection.${self.collectionName}] Path "${this.storagePath({})}" is not writable!`, error);
      }
    }

    check(this.strict, Boolean);
    check(this.permissions, Number);
    check(this.storagePath, Function);
    check(this.cacheControl, String);
    check(this.onAfterRemove, Match.OneOf(false, Function));
    check(this.onAfterRemoveAsync, Match.OneOf(false, Function));
    check(this.onAfterUpload, Match.OneOf(false, Function));
    check(this.onAfterUploadAsync, Match.OneOf(false, Function));
    check(this.disableUpload, Boolean);
    check(this.integrityCheck, Boolean);
    check(this.onBeforeRemove, Match.OneOf(false, Function));
    check(this.disableDownload, Boolean);
    check(this.downloadCallback, Match.OneOf(false, Function));
    check(this.downloadCallbackAsync, Match.OneOf(false, Function));
    check(this.interceptRequest, Match.OneOf(false, Function));
    check(this.interceptDownload, Match.OneOf(false, Function));
    check(this.continueUploadTTL, Number);
    check(this.responseHeaders, Match.OneOf(Object, Function));
    check(this.allowedOrigins, Match.OneOf(Boolean, RegExp));
    check(this.allowQueryStringCookies, Boolean);

    this._cookies = new Cookies({
      allowQueryStringCookies: this.allowQueryStringCookies,
      allowedCordovaOrigins: this.allowedOrigins
    });

    if (!this.disableUpload) {
      if (!helpers.isString(this._preCollectionName) && !this._preCollection) {
        this._preCollectionName = `__pre_${this.collectionName}`;
      }

      if (!this._preCollection) {
        this._preCollection = new Mongo.Collection(this._preCollectionName);
      } else {
        this._preCollectionName = this._preCollection._name;
      }
      check(this._preCollectionName, String);

      createIndex(this._preCollection, { createdAt: 1 }, { expireAfterSeconds: this.continueUploadTTL, background: true });
      const _preCollectionCursor = this._preCollection.find({}, {
        fields: {
          _id: 1,
          isFinished: 1
        }
      });

      _preCollectionCursor.observe({
        changed(doc) {
          if (doc.isFinished) {
            self._debug(`[FilesCollection] [_preCollectionCursor.observe] [changed]: ${doc._id}`);
            self._preCollection.remove({_id: doc._id}, noop);
          }
        },
        removed(doc) {
          // Free memory after upload is done
          // Or if upload is unfinished
          self._debug(`[FilesCollection] [_preCollectionCursor.observe] [removed]: ${doc._id}`);
          if (helpers.isObject(self._currentUploads[doc._id])) {
            self._currentUploads[doc._id].stop();
            self._currentUploads[doc._id].end();

            // We can be unlucky to run into a race condition where another server removed this document before the change of `isFinished` is registered on this server.
            // Therefore it's better to double-check with the main collection if the file is referenced there. Issue: https://github.com/veliovgroup/Meteor-Files/issues/672
            if (!doc.isFinished && self.collection.find({ _id: doc._id }).count() === 0) {
              self._debug(`[FilesCollection] [_preCollectionCursor.observe] [removeUnfinishedUpload]: ${doc._id}`);
              self._currentUploads[doc._id].abort();
            }

            delete self._currentUploads[doc._id];
          }
        }
      });

      this._createStream = (_id, path, opts) => {
        this._currentUploads[_id] = new WriteStream(path, opts.fileLength, opts, this.permissions);
      };

      // This little function allows to continue upload
      // even after server is restarted (*not on dev-stage*)
      this._continueUpload = (_id) => {
        if (this._currentUploads[_id] && this._currentUploads[_id].file) {
          if (!this._currentUploads[_id].aborted && !this._currentUploads[_id].ended) {
            return this._currentUploads[_id].file;
          }
          this._createStream(_id, this._currentUploads[_id].file.file.path, this._currentUploads[_id].file);
          return this._currentUploads[_id].file;
        }
        const contUpld = this._preCollection.findOne({_id});
        if (contUpld) {
          this._createStream(_id, contUpld.file.path, contUpld);
          return this._currentUploads[_id].file;
        }
        return false;
      };
    }

    if (!this.schema) {
      this.schema = FilesCollectionCore.schema;
    }

    check(this.debug, Boolean);
    check(this.schema, Object);
    check(this.public, Boolean);
    check(this.getUser, Match.OneOf(false, Function));
    check(this.protected, Match.OneOf(Boolean, Function));
    check(this.protectedAsync, Match.OneOf(Boolean, Function));
    check(this.chunkSize, Number);
    check(this.downloadRoute, String);
    check(this.namingFunction, Match.OneOf(false, Function));
    check(this.onBeforeUpload, Match.OneOf(false, Function));
    check(this.onInitiateUpload, Match.OneOf(false, Function));
    check(this.allowClientCode, Boolean);

    if (this.public && this.protected) {
      throw new Meteor.Error(500, `[FilesCollection.${this.collectionName}]: Files can not be public and protected at the same time!`);
    }

    this._checkAccessAsync = async (http) => {
      if (this.protectedAsync) {
        let result;
        const { user, userId } = this._getUser(http);

        if (helpers.isFunction(this.protectedAsync)) {
          let fileRef;
          if (helpers.isObject(http.params) && http.params._id) {
            fileRef = await this.collection.findOneAsync(http.params._id);
          }

          result = http
            ? await this.protectedAsync(
              Object.assign(http, { user, userId }),
              fileRef || null
            )
            : await this.protectedAsync({ user, userId }, fileRef || null);
        } else {
          result = !!userId;
        }

        if ((http && result === true) || !http) {
          return true;
        }

        const rc = helpers.isNumber(result) ? result : 401;
        this._debug('[FilesCollection._checkAccess] WARN: Access denied!');
        if (http) {
          const text = 'Access denied!';
          if (!http.response.headersSent) {
            http.response.writeHead(rc, {
              'Content-Type': 'text/plain',
              'Content-Length': text.length,
            });
          }

          if (!http.response.finished) {
            http.response.end(text);
          }
        }

        return false;
      }
      return true;
    };

    this._checkAccess = (http) => {
      if (this.protected) {
        let result;
        const {user, userId} = this._getUser(http);

        if (helpers.isFunction(this.protected)) {
          let fileRef;
          if (helpers.isObject(http.params) &&  http.params._id) {
            fileRef = this.collection.findOne(http.params._id);
          }

          result = http ? this.protected.call(Object.assign(http, {user, userId}), (fileRef || null)) : this.protected.call({user, userId}, (fileRef || null));
        } else {
          result = !!userId;
        }

        if ((http && (result === true)) || !http) {
          return true;
        }

        const rc = helpers.isNumber(result) ? result : 401;
        this._debug('[FilesCollection._checkAccess] WARN: Access denied!');
        if (http) {
          const text = 'Access denied!';
          if (!http.response.headersSent) {
            http.response.writeHead(rc, {
              'Content-Type': 'text/plain',
              'Content-Length': text.length
            });
          }

          if (!http.response.finished) {
            http.response.end(text);
          }
        }

        return false;
      }
      return true;
    };

    this._methodNames = {
      _Abort: `_FilesCollectionAbort_${this.collectionName}`,
      _Write: `_FilesCollectionWrite_${this.collectionName}`,
      _Start: `_FilesCollectionStart_${this.collectionName}`,
      _Remove: `_FilesCollectionRemove_${this.collectionName}`
    };

    this.on('_handleUpload', this._handleUpload);
    this.on('_finishUpload', this._finishUpload);
    this._handleUploadSync = Meteor.wrapAsync(this._handleUpload.bind(this));

    if (this.disableUpload && this.disableDownload) {
      return;
    }
    WebApp.connectHandlers.use((httpReq, httpResp, next) => {
      if (this.allowedOrigins && httpReq._parsedUrl.path.includes(`${this.downloadRoute}/`) && !httpResp.headersSent) {
        if (this.allowedOrigins.test(httpReq.headers.origin)) {
          httpResp.setHeader('Access-Control-Allow-Credentials', 'true');
          httpResp.setHeader('Access-Control-Allow-Origin', httpReq.headers.origin);
        }

        if (httpReq.method === 'OPTIONS') {
          httpResp.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          httpResp.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, x-mtok, x-start, x-chunkid, x-fileid, x-eof');
          httpResp.setHeader('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Encoding, Content-Length, Content-Range');
          httpResp.setHeader('Allow', 'GET, POST, OPTIONS');
          httpResp.writeHead(200);
          httpResp.end();
          return;
        }
      }

      if (!this.disableUpload && httpReq._parsedUrl.path.includes(`${this.downloadRoute}/${this.collectionName}/__upload`)) {
        if (httpReq.method !== 'POST') {
          next();
          return;
        }

        const handleError = (_error) => {
          let error = _error;
          Meteor._debug('[FilesCollection] [Upload] [HTTP] Exception:', error);

          if (!httpResp.headersSent) {
            httpResp.writeHead(500);
          }

          if (!httpResp.finished) {
            if (helpers.isObject(error) && helpers.isFunction(error.toString)) {
              error = error.toString();
            }

            if (!helpers.isString(error)) {
              error = 'Unexpected error!';
            }

            httpResp.end(JSON.stringify({ error }));
          }
        };

        let body = '';
        const handleData = () => {
          try {
            let opts;
            let result;
            let user = this._getUser({request: httpReq, response: httpResp});

            if (httpReq.headers['x-start'] !== '1') {
              // CHUNK UPLOAD SCENARIO:
              opts = {
                fileId: this.sanitize(httpReq.headers['x-fileid'], 20, 'a')
              };

              if (httpReq.headers['x-eof'] === '1') {
                opts.eof = true;
              } else {
                opts.binData = Buffer.from(body, 'base64');
                opts.chunkId = parseInt(httpReq.headers['x-chunkid']);
              }

              const _continueUpload = this._continueUpload(opts.fileId);
              if (!_continueUpload) {
                throw new Meteor.Error(408, 'Can\'t continue upload, session expired. Start upload again.');
              }

              ({result, opts} = this._prepareUpload(Object.assign(opts, _continueUpload), user.userId, 'HTTP'));

              if (opts.eof) {
                // FINISH UPLOAD SCENARIO:
                this._handleUpload(result, opts, (_error) => {
                  let error = _error;
                  if (error) {
                    if (!httpResp.headersSent) {
                      httpResp.writeHead(500);
                    }

                    if (!httpResp.finished) {
                      if (helpers.isObject(error) && helpers.isFunction(error.toString)) {
                        error = error.toString();
                      }

                      if (!helpers.isString(error)) {
                        error = 'Unexpected error!';
                      }

                      httpResp.end(JSON.stringify({ error }));
                    }
                  }

                  if (!httpResp.headersSent) {
                    httpResp.writeHead(200);
                  }

                  if (helpers.isObject(result.file) && result.file.meta) {
                    result.file.meta = fixJSONStringify(result.file.meta);
                  }

                  if (!httpResp.finished) {
                    httpResp.end(JSON.stringify(result));
                  }
                });
                return;
              }

              this.emit('_handleUpload', result, opts, noop);

              if (!httpResp.headersSent) {
                httpResp.writeHead(204);
              }
              if (!httpResp.finished) {
                httpResp.end();
              }
            } else {
              // START SCENARIO:
              try {
                opts = JSON.parse(body);
              } catch (jsonErr) {
                Meteor._debug('Can\'t parse incoming JSON from Client on [.insert() | upload], something went wrong!', jsonErr);
                opts = {file: {}};
              }

              if (!helpers.isObject(opts.file)) {
                opts.file = {};
              }

              if (opts.fileId) {
                opts.fileId = this.sanitize(opts.fileId, 20, 'a');
              }

              this._debug(`[FilesCollection] [File Start HTTP] ${opts.file.name || '[no-name]'} - ${opts.fileId}`);
              if (helpers.isObject(opts.file) && opts.file.meta) {
                opts.file.meta = fixJSONParse(opts.file.meta);
              }

              opts.___s = true;
              ({result} = this._prepareUpload(helpers.clone(opts), user.userId, 'HTTP Start Method'));

              if (this.collection.findOne(result._id)) {
                throw new Meteor.Error(400, 'Can\'t start upload, data substitution detected!');
              }

              opts._id = opts.fileId;
              opts.createdAt = new Date();
              opts.maxLength = opts.fileLength;
              this._preCollection.insert(helpers.omit(opts, '___s'));
              this._createStream(result._id, result.path, helpers.omit(opts, '___s'));

              if (opts.returnMeta) {
                if (!httpResp.headersSent) {
                  httpResp.writeHead(200);
                }

                if (!httpResp.finished) {
                  httpResp.end(JSON.stringify({
                    uploadRoute: `${this.downloadRoute}/${this.collectionName}/__upload`,
                    file: result
                  }));
                }
              } else {
                if (!httpResp.headersSent) {
                  httpResp.writeHead(204);
                }

                if (!httpResp.finished) {
                  httpResp.end();
                }
              }
            }
          } catch (httpRespErr) {
            handleError(httpRespErr);
          }
        };

        httpReq.setTimeout(20000, handleError);
        if (typeof httpReq.body === 'object' && Object.keys(httpReq.body).length !== 0) {
          body = JSON.stringify(httpReq.body);
          handleData();
        } else {
          httpReq.on('data', (data) => bound(() => {
            body += data;
          }));

          httpReq.on('end', () => bound(() => {
            handleData();
          }));
        }
        return;
      }

      if (!this.disableDownload) {
        let uri;

        if (!this.public) {
          if (httpReq._parsedUrl.path.includes(`${this.downloadRoute}/${this.collectionName}`)) {
            uri = httpReq._parsedUrl.path.replace(`${this.downloadRoute}/${this.collectionName}`, '');
            if (uri.indexOf('/') === 0) {
              uri = uri.substring(1);
            }

            const uris = uri.split('/');
            if (uris.length === 3) {
              const params = {
                _id: uris[0],
                query: httpReq._parsedUrl.query ? nodeQs.parse(httpReq._parsedUrl.query) : {},
                name: uris[2].split('?')[0],
                version: uris[1]
              };

              const http = {request: httpReq, response: httpResp, params};
              if (this.interceptRequest && helpers.isFunction(this.interceptRequest) && this.interceptRequest(http) === true) {
                return;
              }

              if (this._checkAccess(http)) {
                this.download(http, uris[1], this.collection.findOne(uris[0]));
              }
            } else {
              next();
            }
          } else {
            next();
          }
        } else {
          if (httpReq._parsedUrl.path.includes(`${this.downloadRoute}`)) {
            uri = httpReq._parsedUrl.path.replace(`${this.downloadRoute}`, '');
            if (uri.indexOf('/') === 0) {
              uri = uri.substring(1);
            }

            const uris = uri.split('/');
            let _file = uris[uris.length - 1];
            if (_file) {
              let version;
              if (_file.includes('-')) {
                version = _file.split('-')[0];
                _file = _file.split('-')[1].split('?')[0];
              } else {
                version = 'original';
                _file = _file.split('?')[0];
              }

              const params = {
                query: httpReq._parsedUrl.query ? nodeQs.parse(httpReq._parsedUrl.query) : {},
                file: _file,
                _id: _file.split('.')[0],
                version,
                name: _file
              };
              const http = {request: httpReq, response: httpResp, params};
              if (this.interceptRequest && helpers.isFunction(this.interceptRequest) && this.interceptRequest(http) === true) {
                return;
              }
              this.download(http, version, this.collection.findOne(params._id));
            } else {
              next();
            }
          } else {
            next();
          }
        }
        return;
      }
      next();
    });

    if (!this.disableUpload) {
      const _methods = {};

      // Method used to remove file
      // from Client side
      _methods[this._methodNames._Remove] = function (selector) {
        check(selector, Match.OneOf(String, Object));
        self._debug(`[FilesCollection] [Unlink Method] [.remove(${selector})]`);

        if (self.allowClientCode) {
          if (self.onBeforeRemove && helpers.isFunction(self.onBeforeRemove)) {
            const userId = this.userId;
            const userFuncs = {
              userId: this.userId,
              user() {
                if (Meteor.users) {
                  return Meteor.users.findOne(userId);
                }
                return null;
              }
            };

            if (!self.onBeforeRemove.call(userFuncs, (self.find(selector) || null))) {
              throw new Meteor.Error(403, '[FilesCollection] [remove] Not permitted!');
            }
          }

          const cursor = self.find(selector);
          if (cursor.count() > 0) {
            self.remove(selector);
            return true;
          }
          throw new Meteor.Error(404, 'Cursor is empty, no files is removed');
        } else {
          throw new Meteor.Error(405, '[FilesCollection] [remove] Running code on a client is not allowed!');
        }
      };


      // Method used to receive "first byte" of upload
      // and all file's meta-data, so
      // it won't be transferred with every chunk
      // Basically it prepares everything
      // So user can pause/disconnect and
      // continue upload later, during `continueUploadTTL`
      _methods[this._methodNames._Start] = function (opts, returnMeta) {
        check(opts, {
          file: Object,
          fileId: String,
          FSName: Match.Optional(String),
          chunkSize: Number,
          fileLength: Number
        });

        check(returnMeta, Match.Optional(Boolean));

        opts.fileId = self.sanitize(opts.fileId, 20, 'a');

        self._debug(`[FilesCollection] [File Start Method] ${opts.file.name} - ${opts.fileId}`);
        opts.___s = true;
        const { result } = self._prepareUpload(helpers.clone(opts), this.userId, 'DDP Start Method');

        if (self.collection.findOne(result._id)) {
          throw new Meteor.Error(400, 'Can\'t start upload, data substitution detected!');
        }

        opts._id = opts.fileId;
        opts.createdAt = new Date();
        opts.maxLength = opts.fileLength;
        try {
          self._preCollection.insert(helpers.omit(opts, '___s'));
          self._createStream(result._id, result.path, helpers.omit(opts, '___s'));
        } catch (e) {
          self._debug(`[FilesCollection] [File Start Method] [EXCEPTION:] ${opts.file.name} - ${opts.fileId}`, e);
          throw new Meteor.Error(500, 'Can\'t start');
        }

        if (returnMeta) {
          return {
            uploadRoute: `${self.downloadRoute}/${self.collectionName}/__upload`,
            file: result
          };
        }
        return true;
      };


      // Method used to write file chunks
      // it receives very limited amount of meta-data
      // This method also responsible for EOF
      _methods[this._methodNames._Write] = function (_opts) {
        let opts = _opts;
        let result;
        check(opts, {
          eof: Match.Optional(Boolean),
          fileId: String,
          binData: Match.Optional(String),
          chunkId: Match.Optional(Number)
        });

        opts.fileId = self.sanitize(opts.fileId, 20, 'a');

        if (opts.binData) {
          opts.binData = Buffer.from(opts.binData, 'base64');
        }

        const _continueUpload = self._continueUpload(opts.fileId);
        if (!_continueUpload) {
          throw new Meteor.Error(408, 'Can\'t continue upload, session expired. Start upload again.');
        }

        this.unblock();
        ({result, opts} = self._prepareUpload(Object.assign(opts, _continueUpload), this.userId, 'DDP'));

        if (opts.eof) {
          try {
            return self._handleUploadSync(result, opts);
          } catch (handleUploadErr) {
            self._debug('[FilesCollection] [Write Method] [DDP] Exception:', handleUploadErr);
            throw handleUploadErr;
          }
        } else {
          self.emit('_handleUpload', result, opts, noop);
        }
        return true;
      };

      // Method used to Abort upload
      // - Freeing memory by ending writableStreams
      // - Removing temporary record from @_preCollection
      // - Removing record from @collection
      // - .unlink()ing chunks from FS
      _methods[this._methodNames._Abort] = function (_id) {
        check(_id, String);

        const _continueUpload = self._continueUpload(_id);
        self._debug(`[FilesCollection] [Abort Method]: ${_id} - ${(helpers.isObject(_continueUpload.file) ? _continueUpload.file.path : '')}`);

        if (self._currentUploads && self._currentUploads[_id]) {
          self._currentUploads[_id].stop();
          self._currentUploads[_id].abort();
        }

        if (_continueUpload) {
          self._preCollection.remove({_id});
          self.remove({_id});
          if (helpers.isObject(_continueUpload.file) && _continueUpload.file.path) {
            self.unlink({_id, path: _continueUpload.file.path});
          }
        }
        return true;
      };

      Meteor.methods(_methods);
    }
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name _prepareUpload
   * @summary Internal method. Used to optimize received data and check upload permission
   * @returns {Object}
   */
  _prepareUpload(opts = {}, userId, transport) {
    let ctx;
    if (!helpers.isBoolean(opts.eof)) {
      opts.eof = false;
    }

    if (!opts.binData) {
      opts.binData = 'EOF';
    }

    if (!helpers.isNumber(opts.chunkId)) {
      opts.chunkId = -1;
    }

    if (!helpers.isString(opts.FSName)) {
      opts.FSName = opts.fileId;
    }

    this._debug(`[FilesCollection] [Upload] [${transport}] Got #${opts.chunkId}/${opts.fileLength} chunks, dst: ${opts.file.name || opts.file.fileName}`);

    const fileName = this._getFileName(opts.file);
    const {extension, extensionWithDot} = this._getExt(fileName);

    if (!helpers.isObject(opts.file.meta)) {
      opts.file.meta = {};
    }

    let result = opts.file;
    result.name = fileName;
    result.meta = opts.file.meta;
    result.extension = extension;
    result.ext = extension;
    result._id = opts.fileId;
    result.userId = userId || null;
    opts.FSName = this.sanitize(opts.FSName);

    if (this.namingFunction) {
      opts.FSName = this.namingFunction(opts);
    }

    result.path = `${this.storagePath(result)}${nodePath.sep}${opts.FSName}${extensionWithDot}`;
    result = Object.assign(result, this._dataToSchema(result));

    if (this.onBeforeUpload && helpers.isFunction(this.onBeforeUpload)) {
      ctx = Object.assign({
        file: opts.file
      }, {
        chunkId: opts.chunkId,
        userId: result.userId,
        user() {
          if (Meteor.users && result.userId) {
            return Meteor.users.findOne(result.userId);
          }
          return null;
        },
        eof: opts.eof
      });
      const isUploadAllowed = this.onBeforeUpload.call(ctx, result);

      if (isUploadAllowed !== true) {
        throw new Meteor.Error(403, helpers.isString(isUploadAllowed) ? isUploadAllowed : '@onBeforeUpload() returned false');
      } else {
        if ((opts.___s === true) && this.onInitiateUpload && helpers.isFunction(this.onInitiateUpload)) {
          this.onInitiateUpload.call(ctx, result);
        }
      }
    } else if ((opts.___s === true) && this.onInitiateUpload && helpers.isFunction(this.onInitiateUpload)) {
      ctx = Object.assign({
        file: opts.file
      }, {
        chunkId: opts.chunkId,
        userId: result.userId,
        user() {
          if (Meteor.users && result.userId) {
            return Meteor.users.findOne(result.userId);
          }
          return null;
        },
        eof: opts.eof
      });
      this.onInitiateUpload.call(ctx, result);
    }

    return {result, opts};
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name _prepareUploadAsync
   * @summary Internal method. Used to optimize received data and check upload permission
   * @returns {Object}
   */
  async _prepareUploadAsync(opts = {}, userId, transport) {
    let ctx;
    if (!helpers.isBoolean(opts.eof)) {
      opts.eof = false;
    }

    if (!opts.binData) {
      opts.binData = 'EOF';
    }

    if (!helpers.isNumber(opts.chunkId)) {
      opts.chunkId = -1;
    }

    if (!helpers.isString(opts.FSName)) {
      opts.FSName = opts.fileId;
    }

    this._debug(`[FilesCollection] [Upload] [${transport}] Got #${opts.chunkId}/${opts.fileLength} chunks, dst: ${opts.file.name || opts.file.fileName}`);

    const fileName = this._getFileName(opts.file);
    const { extension, extensionWithDot } = this._getExt(fileName);

    if (!helpers.isObject(opts.file.meta)) {
      opts.file.meta = {};
    }

    let result = opts.file;
    result.name = fileName;
    result.meta = opts.file.meta;
    result.extension = extension;
    result.ext = extension;
    result._id = opts.fileId;
    result.userId = userId || null;
    opts.FSName = this.sanitize(opts.FSName);

    if (this.namingFunction) {
      opts.FSName = this.namingFunction(opts);
    }

    result.path = `${this.storagePath(result)}${nodePath.sep}${
      opts.FSName
    }${extensionWithDot}`;
    result = Object.assign(result, this._dataToSchema(result));

    if (this.onBeforeUpload && helpers.isFunction(this.onBeforeUpload)) {
      ctx = Object.assign(
        {
          file: opts.file,
        },
        {
          chunkId: opts.chunkId,
          userId: result.userId,
          async userAsync() {
            if (Meteor.users && result.userId) {
              return Meteor.users.findOneAsync(result.userId);
            }
            return null;
          },
          eof: opts.eof,
        }
      );
      const isUploadAllowed = await this.onBeforeUpload.call(ctx, result);

      if (isUploadAllowed !== true) {
        throw new Meteor.Error(
          403,
          helpers.isString(isUploadAllowed)
            ? isUploadAllowed
            : '@onBeforeUpload() returned false'
        );
      } else {
        if (
          opts.___s === true &&
          this.onInitiateUpload &&
          helpers.isFunction(this.onInitiateUpload)
        ) {
          this.onInitiateUpload.call(ctx, result);
        }
      }
    } else if (
      opts.___s === true &&
      this.onInitiateUpload &&
      helpers.isFunction(this.onInitiateUpload)
    ) {
      ctx = Object.assign(
        {
          file: opts.file,
        },
        {
          chunkId: opts.chunkId,
          userId: result.userId,
          async userAsync() {
            if (Meteor.users && result.userId) {
              return await Meteor.users.findOneAsync(result.userId);
            }
            return null;
          },
          eof: opts.eof,
        }
      );
      this.onInitiateUpload.call(ctx, result);
    }

    return { result, opts };
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name _finishUpload
   * @summary Internal method. Finish upload, close Writable stream, add record to MongoDB and flush used memory
   * @returns {undefined}
   */
  _finishUpload(result, opts, cb) {
    this._debug(`[FilesCollection] [Upload] [finish(ing)Upload] -> ${result.path}`);
    fs.chmod(result.path, this.permissions, noop);
    result.type = this._getMimeType(opts.file);
    result.public = this.public;
    this._updateFileTypes(result);

    this.collection.insert(helpers.clone(result), (colInsert, _id) => {
      if (colInsert) {
        cb && cb(colInsert);
        this._debug('[FilesCollection] [Upload] [_finishUpload] [insert] Error:', colInsert);
      } else {
        this._preCollection.update({_id: opts.fileId}, {$set: {isFinished: true}}, (preUpdateError) => {
          if (preUpdateError) {
            cb && cb(preUpdateError);
            this._debug('[FilesCollection] [Upload] [_finishUpload] [update] Error:', preUpdateError);
          } else {
            result._id = _id;
            this._debug(`[FilesCollection] [Upload] [finish(ed)Upload] -> ${result.path}`);
            this.onAfterUpload && this.onAfterUpload.call(this, result);
            this.emit('afterUpload', result);
            cb && cb(null, result);
          }
        });
      }
    });
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name _finishUploadAsync
   * @summary Internal method. Finish upload, close Writable stream, add record to MongoDB and flush used memory
   * @returns {Promise<undefined>}
   */
  async _finishUploadAsync(result, opts) {
    this._debug(
      `[FilesCollection] [Upload] [finish(ing)Upload] -> ${result.path}`
    );
    await fs.promises.chmod(result.path, this.permissions);
    result.type = this._getMimeType(opts.file);
    result.public = this.public;
    this._updateFileTypes(result);

    let _id;
    try {
      _id =  await this.collection.insertAsync(helpers.clone(result));
    } catch (colInsert) {
      this._debug(
        '[FilesCollection] [Upload] [_finishUpload] [insert] Error:',
        colInsert
      );
      throw colInsert;
    }

    try {
      await this._preCollection.updateAsync(
        { _id: opts.fileId },
        { $set: { isFinished: true } });
    } catch (preUpdateError) {
      if (preUpdateError) {
        this._debug(
          '[FilesCollection] [Upload] [_finishUpload] [update] Error:',
          preUpdateError
        );
        throw preUpdateError;
      }
    }

    result._id = _id;

    this._debug(
      `[FilesCollection] [Upload] [finish(ed)Upload] -> ${result.path}`
    );

    this.onAfterUploadAsync && (await this.onAfterUploadAsync.call(this, result));

    this.emit('afterUpload', result);
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name _handleUpload
   * @summary Internal method to handle upload process, pipe incoming data to Writable stream
   * @returns {undefined}
   */
  _handleUpload(result, opts, cb) {
    try {
      if (opts.eof) {
        this._currentUploads[result._id].end(() => {
          this.emit('_finishUpload', result, opts, cb);
        });
      } else {
        this._currentUploads[result._id].write(opts.chunkId, opts.binData, cb);
      }
    } catch (e) {
      this._debug('[_handleUpload] [EXCEPTION:]', e);
      cb && cb(e);
    }
  }

  /**
   * @locus Anywhere
   * @memberOf FilesCollection
   * @name _getMimeType
   * @param {Object} fileData - File Object
   * @summary Returns file's mime-type
   * @returns {String}
   */
  _getMimeType(fileData) {
    let mime;
    check(fileData, Object);
    if (helpers.isObject(fileData) && fileData.type) {
      mime = fileData.type;
    }

    if (!mime || !helpers.isString(mime)) {
      mime = 'application/octet-stream';
    }
    return mime;
  }

  /**
   * @locus Anywhere
   * @memberOf FilesCollection
   * @name _getUserId
   * @summary Returns `userId` matching the xmtok token derived from Meteor.server.sessions
   * @returns {String}
   */
  _getUserId(xmtok) {
    if (!xmtok) return null;

    // throw an error upon an unexpected type of Meteor.server.sessions in order to identify breaking changes
    if (!Meteor.server.sessions instanceof Map || !helpers.isObject(Meteor.server.sessions)) {
      throw new Error('Received incompatible type of Meteor.server.sessions');
    }

    if (Meteor.server.sessions instanceof Map && Meteor.server.sessions.has(xmtok) && helpers.isObject(Meteor.server.sessions.get(xmtok))) {
      // to be used with >= Meteor 1.8.1 where Meteor.server.sessions is a Map
      return Meteor.server.sessions.get(xmtok).userId;
    } else if (helpers.isObject(Meteor.server.sessions) && xmtok in Meteor.server.sessions && helpers.isObject(Meteor.server.sessions[xmtok])) {
      // to be used with < Meteor 1.8.1 where Meteor.server.sessions is an Object
      return Meteor.server.sessions[xmtok].userId;
    }

    return null;
  }

  /**
   * @locus Anywhere
   * @memberOf FilesCollection
   * @name _getUser
   * @summary Returns object with `userId` and `user()` method which return user's object
   * @returns {Object}
   */
  _getUser() {
    return this.getUser ?
      this.getUser(...arguments) : this._getUserDefault(...arguments);
  }

  /**
   * @locus Anywhere
   * @memberOf FilesCollection
   * @name _getUserDefault
   * @summary Default way of recognising user based on 'x_mtok' cookie, can be replaced by 'config.getUser' if defnied. Returns object with `userId` and `user()` method which return user's object
   * @returns {Object}
   */
  _getUserDefault(http) {
    const result = {
      user() { return null; },
      userId: null
    };

    if (http) {
      let mtok = null;
      if (http.request.headers['x-mtok']) {
        mtok = http.request.headers['x-mtok'];
      } else {
        const cookie = http.request.Cookies;
        if (cookie.has('x_mtok')) {
          mtok = cookie.get('x_mtok');
        }
      }

      if (mtok) {
        const userId = this._getUserId(mtok);

        if (userId) {
          result.user = () => Meteor.users.findOne(userId);
          result.userId = userId;
        }
      }
    }

    return result;
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name write
   * @param {Buffer} buffer - Binary File's Buffer
   * @param {Object} opts - Object with file-data
   * @param {String} opts.name - File name, alias: `fileName`
   * @param {String} opts.type - File mime-type
   * @param {Object} opts.meta - File additional meta-data
   * @param {String} opts.userId - UserId, default *null*
   * @param {String} opts.fileId - _id, sanitized, max-length: 20; default *null*
   * @param {Function} callback - function(error, fileObj){...}
   * @param {Boolean} proceedAfterUpload - Proceed onAfterUpload hook
   * @summary Write buffer to FS and add to FilesCollection Collection
   * @returns {FilesCollection} Instance
   */
  write(buffer, _opts = {}, _callback, _proceedAfterUpload) {
    this._debug('[FilesCollection] [write()]');
    let opts = _opts;
    let callback = _callback;
    let proceedAfterUpload = _proceedAfterUpload;

    if (helpers.isFunction(opts)) {
      proceedAfterUpload = callback;
      callback = opts;
      opts = {};
    } else if (helpers.isBoolean(callback)) {
      proceedAfterUpload = callback;
    } else if (helpers.isBoolean(opts)) {
      proceedAfterUpload = opts;
    }

    check(opts, Match.Optional(Object));
    check(callback, Match.Optional(Function));
    check(proceedAfterUpload, Match.Optional(Boolean));

    opts.fileId = opts.fileId && this.sanitize(opts.fileId, 20, 'a');
    const fileId = opts.fileId || Random.id();
    const fsName = this.namingFunction ? this.namingFunction(opts) : fileId;
    const fileName = (opts.name || opts.fileName) ? (opts.name || opts.fileName) : fsName;

    const {extension, extensionWithDot} = this._getExt(fileName);

    opts.path = `${this.storagePath(opts)}${nodePath.sep}${fsName}${extensionWithDot}`;
    opts.type = this._getMimeType(opts);
    if (!helpers.isObject(opts.meta)) {
      opts.meta = {};
    }

    if (!helpers.isNumber(opts.size)) {
      opts.size = buffer.length;
    }

    const result = this._dataToSchema({
      name: fileName,
      path: opts.path,
      meta: opts.meta,
      type: opts.type,
      size: opts.size,
      userId: opts.userId,
      extension
    });

    result._id = fileId;

    fs.stat(opts.path, (statError, stats) => {
      bound(() => {
        if (statError || !stats.isFile()) {
          const paths = opts.path.split('/');
          paths.pop();
          fs.mkdirSync(paths.join('/'), { recursive: true });
          fs.writeFileSync(opts.path, '');
        }

        const stream = fs.createWriteStream(opts.path, {flags: 'w', mode: this.permissions});
        stream.end(buffer, (streamErr) => {
          bound(() => {
            if (streamErr) {
              callback && callback(streamErr);
            } else {
              this.collection.insert(result, (insertErr, _id) => {
                if (insertErr) {
                  callback && callback(insertErr);
                  this._debug(`[FilesCollection] [write] [insert] Error: ${fileName} -> ${this.collectionName}`, insertErr);
                } else {
                  const fileRef = this.collection.findOne(_id);
                  callback && callback(null, fileRef);
                  if (proceedAfterUpload === true) {
                    this.onAfterUpload && this.onAfterUpload.call(this, fileRef);
                    this.emit('afterUpload', fileRef);
                  }
                  this._debug(`[FilesCollection] [write]: ${fileName} -> ${this.collectionName}`);
                }
              });
            }
          });
        });
      });
    });
    return this;
  }


  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name writeAsync
   * @param {Buffer} buffer - Binary File's Buffer
   * @param {Object} opts - Object with file-data
   * @param {String} opts.name - File name, alias: `fileName`
   * @param {String} opts.type - File mime-type
   * @param {Object} opts.meta - File additional meta-data
   * @param {String} opts.userId - UserId, default *null*
   * @param {String} opts.fileId - _id, sanitized, max-length: 20; default *null*
   * @param {Boolean} proceedAfterUpload - Proceed onAfterUploadAsync hook
   * @summary Write buffer to FS and add to FilesCollection Collection
   * @throws {Meteor.Error} If there is an error writing the file or inserting the document
   * @returns {Promise<FileRef>} Instance
   */
  async writeAsync(buffer, _opts = {}, _proceedAfterUpload) {
    this._debug('[FilesCollection] [writeAsync()]');
    let opts = _opts;
    let proceedAfterUpload = _proceedAfterUpload;

    if (helpers.isBoolean(opts)) {
      proceedAfterUpload = opts;
      opts = {};
    }

    check(opts, Match.Optional(Object));
    check(proceedAfterUpload, Match.Optional(Boolean));

    opts.fileId = opts.fileId && this.sanitize(opts.fileId, 20, 'a');
    const fileId = opts.fileId || Random.id();
    const fsName = this.namingFunction ? this.namingFunction(opts) : fileId;
    const fileName = (opts.name || opts.fileName) ? (opts.name || opts.fileName) : fsName;

    const {extension, extensionWithDot} = this._getExt(fileName);

    opts.path = `${this.storagePath(opts)}${nodePath.sep}${fsName}${extensionWithDot}`;
    opts.type = this._getMimeType(opts);
    if (!helpers.isObject(opts.meta)) {
      opts.meta = {};
    }

    if (!helpers.isNumber(opts.size)) {
      opts.size = buffer.length;
    }

    const result = this._dataToSchema({
      name: fileName,
      path: opts.path,
      meta: opts.meta,
      type: opts.type,
      size: opts.size,
      userId: opts.userId,
      extension
    });

    result._id = fileId;

    let fileRef;

    let mustCreateFileFirst = false;
    try {
      const stats = await fs.promises.stat(opts.path);
      if (!stats.isFile()) {
        mustCreateFileFirst = true;
      }
    } catch (statError) {
      mustCreateFileFirst = true;
    }
    if (mustCreateFileFirst) {
      const paths = opts.path.split('/');
      paths.pop();
      await fs.promises.mkdir(paths.join('/'), { recursive: true });
      await fs.promises.writeFile(opts.path, '');
    }

    const stream = fs.createWriteStream(opts.path, {flags: 'w', mode: this.permissions});

    await new Promise((resolve, reject) => {
      stream.end(buffer, (streamErr) => {
        if (streamErr) {
          reject(streamErr);
        } else {
          resolve();
        }
      });
    });

    try {
      const _id = await this.collection.insertAsync(result);
      fileRef = await this.collection.findOneAsync(_id);

      if (proceedAfterUpload === true) {
        if (this.onAfterUploadAsync){
          await this.onAfterUploadAsync.call(this, fileRef);
        }
        this.emit('afterUploadAsync', fileRef);
      }
      this._debug(`[FilesCollection] [write]: ${fileName} -> ${this.collectionName}`);
    } catch (insertErr) {
      this._debug(`[FilesCollection] [write] [insert] Error: ${fileName} -> ${this.collectionName}`, insertErr);
      throw new Meteor.Error('writeAsync', insertErr);
    }

    return fileRef;
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name load
   * @param {String} url - URL to file
   * @param {Object} [opts] - Object with file-data
   * @param {Object} opts.headers - HTTP headers to use when requesting the file
   * @param {String} opts.name - File name, alias: `fileName`
   * @param {String} opts.type - File mime-type
   * @param {Object} opts.meta - File additional meta-data
   * @param {String} opts.userId - UserId, default *null*
   * @param {String} opts.fileId - _id, sanitized, max-length: 20; default *null*
   * @param {Number} opts.timeout - Timeout in milliseconds, default: 360000 (6 mins)
   * @param {Function} callback - function(error, fileObj){...}
   * @param {Boolean} [proceedAfterUpload] - Proceed onAfterUpload hook
   * @summary Download file over HTTP, write stream to FS, and add to FilesCollection Collection
   * @returns {FilesCollection} Instance
   */
  load(url, _opts = {}, _callback, _proceedAfterUpload = false) {
    this._debug(`[FilesCollection] [load(${url}, ${JSON.stringify(_opts)}, callback)]`);
    let opts = _opts;
    let callback = _callback;
    let proceedAfterUpload = _proceedAfterUpload;

    if (helpers.isFunction(opts)) {
      proceedAfterUpload = callback;
      callback = opts;
      opts = {};
    } else if (helpers.isBoolean(callback)) {
      proceedAfterUpload = callback;
    } else if (helpers.isBoolean(opts)) {
      proceedAfterUpload = opts;
    }

    check(url, String);
    check(opts, Match.Optional(Object));
    check(callback, Match.Optional(Function));
    check(proceedAfterUpload, Match.Optional(Boolean));

    if (!helpers.isObject(opts)) {
      opts = {
        timeout: 360000
      };
    }

    if (!opts.timeout) {
      opts.timeout = 360000;
    }

    const fileId = (opts.fileId && this.sanitize(opts.fileId, 20, 'a')) || Random.id();
    const fsName = this.namingFunction ? this.namingFunction(opts) : fileId;
    const pathParts = url.split('/');
    const fileName = (opts.name || opts.fileName) ? (opts.name || opts.fileName) : pathParts[pathParts.length - 1].split('?')[0] || fsName;

    const {extension, extensionWithDot} = this._getExt(fileName);
    opts.path = `${this.storagePath(opts)}${nodePath.sep}${fsName}${extensionWithDot}`;

    const storeResult = (result, cb) => {
      result._id = fileId;

      this.collection.insert(result, (error, _id) => {
        if (error) {
          cb && cb(error);
          this._debug(`[FilesCollection] [load] [insert] Error: ${fileName} -> ${this.collectionName}`, error);
        } else {
          const fileRef = this.collection.findOne(_id);
          cb && cb(null, fileRef);
          if (proceedAfterUpload === true) {
            this.onAfterUpload && this.onAfterUpload.call(this, fileRef);
            this.emit('afterUpload', fileRef);
          }
          this._debug(`[FilesCollection] [load] [insert] ${fileName} -> ${this.collectionName}`);
        }
      });
    };

    fs.stat(opts.path, (statError, stats) => {
      bound(() => {
        if (statError || !stats.isFile()) {
          const paths = opts.path.split('/');
          paths.pop();
          fs.mkdirSync(paths.join('/'), { recursive: true });
          fs.writeFileSync(opts.path, '');
        }

        let isEnded = false;
        let timer = null;
        const wStream = fs.createWriteStream(opts.path, {flags: 'w', mode: this.permissions, autoClose: true, emitClose: false });
        const onEnd = (_error, response) => {
          if (!isEnded) {
            if (timer) {
              Meteor.clearTimeout(timer);
              timer = null;
            }

            isEnded = true;
            if (response && response.status === 200) {
              this._debug(`[FilesCollection] [load] Received: ${url}`);
              const result = this._dataToSchema({
                name: fileName,
                path: opts.path,
                meta: opts.meta,
                type: opts.type || response.headers.get('content-type') || this._getMimeType({path: opts.path}),
                size: opts.size || parseInt(response.headers.get('content-length') || 0),
                userId: opts.userId,
                extension
              });

              if (!result.size) {
                fs.stat(opts.path, (statErrorOnEnd, newStats) => {
                  bound(() => {
                    if (statErrorOnEnd) {
                      callback && callback(statErrorOnEnd);
                    } else {
                      result.versions.original.size = (result.size = newStats.size);
                      storeResult(result, callback);
                    }
                  });
                });
              } else {
                storeResult(result, callback);
              }
            } else {
              const error = _error || new Meteor.Error(response?.status || 408, response?.statusText || 'Bad response with empty details');
              this._debug(`[FilesCollection] [load] [fetch(${url})] Error:`, error);

              if (!wStream.destroyed) {
                wStream.destroy();
              }

              fs.unlink(opts.path, (unlinkError) => {
                bound(() => {
                  callback && callback(error);
                  if (unlinkError) {
                    this._debug(`[FilesCollection] [load] [fetch(${url})] [fs.unlink(${opts.path})] unlinkError:`, unlinkError);
                  }
                });
              });
            }
          }
        };

        let resp = void 0;
        wStream.on('error', (error) => {
          bound(() => {
            onEnd(error);
          });
        });
        wStream.on('close', () => {
          bound(() => {
            onEnd(void 0, resp);
          });
        });
        wStream.on('finish', () => {
          bound(() => {
            onEnd(void 0, resp);
          });
        });

        const controller = new AbortController();
        fetch(url, {
          headers: opts.headers || {},
          signal: controller.signal
        }).then((res) => {
          resp = res;
          res.body.on('error', (error) => {
            bound(() => {
              onEnd(error);
            });
          });
          res.body.pipe(wStream);
        }).catch((fetchError) => {
          onEnd(fetchError);
        });

        if (opts.timeout > 0) {
          timer = Meteor.setTimeout(() => {
            onEnd(new Meteor.Error(408, `Request timeout after ${opts.timeout}ms`));
            controller.abort();
          }, opts.timeout);
        }
      });
    });

    return this;
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name loadAsync
   * @param {String} url - URL to file
   * @param {Object} [opts] - Object with file-data
   * @param {Object} opts.headers - HTTP headers to use when requesting the file
   * @param {String} opts.name - File name, alias: `fileName`
   * @param {String} opts.type - File mime-type
   * @param {Object} opts.meta - File additional meta-data
   * @param {String} opts.userId - UserId, default *null*
   * @param {String} opts.fileId - _id, sanitized, max-length: 20; default *null*
   * @param {Number} opts.timeout - Timeout in milliseconds, default: 360000 (6 mins)
   * @param {Function} callback - function(error, fileObj){...}
   * @param {Boolean} [proceedAfterUpload] - Proceed onAfterUploadAsync hook
   * @summary Download file over HTTP, write stream to FS, and add to FilesCollection Collection
   * @returns {Promise<fileObj>} File Object
   */
  async loadAsync(url, _opts = {}, _proceedAfterUpload = false) {
    this._debug(`[FilesCollection] [loadAsync(${url}, ${JSON.stringify(_opts)}, callback)]`);
    let opts = _opts;
    let proceedAfterUpload = _proceedAfterUpload;

    if (helpers.isBoolean(_opts)) {
      proceedAfterUpload = _opts;
      opts = {};
    }

    check(url, String);
    check(opts, Match.Optional(Object));
    check(proceedAfterUpload, Match.Optional(Boolean));

    if (!helpers.isObject(opts)) {
      opts = {
        timeout: 360000
      };
    }

    if (!opts.timeout) {
      opts.timeout = 360000;
    }

    const fileId = (opts.fileId && this.sanitize(opts.fileId, 20, 'a')) || Random.id();
    const fsName = this.namingFunction ? this.namingFunction(opts) : fileId;
    const pathParts = url.split('/');
    const fileName = (opts.name || opts.fileName) ? (opts.name || opts.fileName) : pathParts[pathParts.length - 1].split('?')[0] || fsName;

    const {extension, extensionWithDot} = this._getExt(fileName);
    opts.path = `${this.storagePath(opts)}${nodePath.sep}${fsName}${extensionWithDot}`;

    // this will be the resolved fileRef
    let fileRef;

    // storeResult is a function that will be called after the file is downloaded and stored in the database
    // this might throw an error from collection.insertAsync or collection.findOneAsync
    const storeResult = async (result) => {
      result._id = fileId;
      const _id  = await this.collection.insertAsync(result);

      fileRef = await this.collection.findOneAsync(_id);
      if (proceedAfterUpload === true) {
        if (this.onAfterUpload){
          await this.onAfterUploadAsync.call(this, fileRef);
        }
        this.emit('afterUploadAsync', fileRef);
      }
      this._debug(`[FilesCollection] [load] [insert] ${fileName} -> ${this.collectionName}`);
    };

    // check if the file already exists, otherwise create it
    let mustCreateFileFirst = false;
    try {
      const stats = await fs.promises.stat(opts.path);
      if (!stats.isFile()) {
        mustCreateFileFirst = true;
      }
    } catch (statError) {
      mustCreateFileFirst = true;
    }
    if(mustCreateFileFirst) {
      const paths = opts.path.split('/');
      paths.pop();
      fs.mkdirSync(paths.join('/'), { recursive: true });
      fs.writeFileSync(opts.path, '');
    }

    const wStream = fs.createWriteStream(opts.path, {flags: 'w', mode: this.permissions, autoClose: true, emitClose: false });
    const controller = new AbortController();

    try {
      let timer;

      if (opts.timeout > 0) {
        timer = Meteor.setTimeout(() => {
          controller.abort();
          throw new Meteor.Error(408, `Request timeout after ${opts.timeout}ms`);
        }, opts.timeout);
      }

      const res = await fetch(url, {
        headers: opts.headers || {},
        signal: controller.signal
      });

      if (timer) {
        Meteor.clearTimeout(timer);
        timer = null;
      }

      if (!res.ok) {
        throw new Error(`Unexpected response ${res.statusText}`);
      }

      await pipeline(res.body, wStream);

      const result = this._dataToSchema({
        name: fileName,
        path: opts.path,
        meta: opts.meta,
        type: opts.type || res.headers.get('content-type') || this._getMimeType({path: opts.path}),
        size: opts.size || parseInt(res.headers.get('content-length') || 0),
        userId: opts.userId,
        extension
      });

      if (!result.size) {
        const newStats = await fs.promises.stat(opts.path);
        result.versions.original.size = (result.size = newStats.size);
        await storeResult(result);
      } else {
        await storeResult(result);
      }
      res.body.pipe(wStream);
    } catch(error){
      this._debug(`[FilesCollection] [loadAsync] [fetch(${url})] Error:`, error);

      if (fs.existsSync(opts.path)) {
        await fs.promises.unlink(opts.path);
      }

      throw error;
    }


    return fileRef;
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name addFile
   * @param {String} path          - Path to file
   * @param {String} opts          - [Optional] Object with file-data
   * @param {String} opts.type     - [Optional] File mime-type
   * @param {Object} opts.meta     - [Optional] File additional meta-data
   * @param {String} opts.fileId   - _id, sanitized, max-length: 20 symbols default *null*
   * @param {Object} opts.fileName - [Optional] File name, if not specified file name and extension will be taken from path
   * @param {String} opts.userId   - [Optional] UserId, default *null*
   * @param {Function} callback    - [Optional] function(error, fileObj){...}
   * @param {Boolean} proceedAfterUpload - Proceed onAfterUpload hook
   * @summary Add file from FS to FilesCollection
   * @returns {FilesCollection} Instance
   */
  addFile(path, _opts = {}, _callback, _proceedAfterUpload) {
    this._debug(`[FilesCollection] [addFile(${path})]`);
    let opts = _opts;
    let callback = _callback;
    let proceedAfterUpload = _proceedAfterUpload;

    if (helpers.isFunction(opts)) {
      proceedAfterUpload = callback;
      callback = opts;
      opts = {};
    } else if (helpers.isBoolean(callback)) {
      proceedAfterUpload = callback;
    } else if (helpers.isBoolean(opts)) {
      proceedAfterUpload = opts;
    }

    if (this.public) {
      throw new Meteor.Error(403, 'Can not run [addFile] on public collection! Just Move file to root of your server, then add record to Collection');
    }

    check(path, String);
    check(opts, Match.Optional(Object));
    check(callback, Match.Optional(Function));
    check(proceedAfterUpload, Match.Optional(Boolean));

    fs.stat(path, (statErr, stats) => bound(() => {
      if (statErr) {
        callback && callback(statErr);
      } else if (stats.isFile()) {
        if (!helpers.isObject(opts)) {
          opts = {};
        }
        opts.path = path;

        if (!opts.fileName) {
          const pathParts = path.split(nodePath.sep);
          opts.fileName = path.split(nodePath.sep)[pathParts.length - 1];
        }

        const {extension} = this._getExt(opts.fileName);

        if (!helpers.isString(opts.type)) {
          opts.type = this._getMimeType(opts);
        }

        if (!helpers.isObject(opts.meta)) {
          opts.meta = {};
        }

        if (!helpers.isNumber(opts.size)) {
          opts.size = stats.size;
        }

        const result = this._dataToSchema({
          name: opts.fileName,
          path,
          meta: opts.meta,
          type: opts.type,
          size: opts.size,
          userId: opts.userId,
          extension,
          _storagePath: path.replace(`${nodePath.sep}${opts.fileName}`, ''),
          fileId: (opts.fileId && this.sanitize(opts.fileId, 20, 'a')) || null
        });


        this.collection.insert(result, (insertErr, _id) => {
          if (insertErr) {
            callback && callback(insertErr);
            this._debug(`[FilesCollection] [addFile] [insert] Error: ${result.name} -> ${this.collectionName}`, insertErr);
          } else {
            const fileRef = this.collection.findOne(_id);
            callback && callback(null, fileRef);
            if (proceedAfterUpload === true) {
              this.onAfterUpload && this.onAfterUpload.call(this, fileRef);
              this.emit('afterUpload', fileRef);
            }
            this._debug(`[FilesCollection] [addFile]: ${result.name} -> ${this.collectionName}`);
          }
        });
      } else {
        callback && callback(new Meteor.Error(400, `[FilesCollection] [addFile(${path})]: File does not exist`));
      }
    }));
    return this;
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name addFileAsync
   * @param {String} path          - Path to file
   * @param {String} opts          - [Optional] Object with file-data
   * @param {String} opts.type     - [Optional] File mime-type
   * @param {Object} opts.meta     - [Optional] File additional meta-data
   * @param {String} opts.fileId   - _id, sanitized, max-length: 20 symbols default *null*
   * @param {Object} opts.fileName - [Optional] File name, if not specified file name and extension will be taken from path
   * @param {String} opts.userId   - [Optional] UserId, default *null*
   * @param {Boolean} proceedAfterUpload - Proceed onAfterUpload hook
   * @summary Add file from FS to FilesCollection
   * @throws {Meteor.Error} If file does not exist (400) or collection is public (403)
   * @returns {Promise<FilesCollection>} Instance
   */
  async addFileAsync(path, _opts = {}, _proceedAfterUpload) {
    this._debug(`[FilesCollection] [addFile(${path})]`);
    let opts = _opts;
    let proceedAfterUpload = _proceedAfterUpload;

    if (this.public) {
      throw new Meteor.Error(
        403,
        'Can not run [addFile] on public collection! Just Move file to root of your server, then add record to Collection'
      );
    }

    check(path, String);
    check(opts, Match.Optional(Object));
    check(proceedAfterUpload, Match.Optional(Boolean));

    let stats;
    try {
      stats = await fs.promises.stat(path);
    } catch (statErr) {
      if (statErr.code === 'ENOENT') {
        throw new Meteor.Error(
          400,
          `[FilesCollection] [addFile(${path})]: File does not exist`
        );
      }
      throw new Meteor.Error(statErr.code, statErr.message);
    }
    if (stats.isFile()) {
      if (!helpers.isObject(opts)) {
        opts = {};
      }
      opts.path = path;

      if (!opts.fileName) {
        const pathParts = path.split(nodePath.sep);
        opts.fileName = path.split(nodePath.sep)[pathParts.length - 1];
      }

      const { extension } = this._getExt(opts.fileName);

      if (!helpers.isString(opts.type)) {
        opts.type = this._getMimeType(opts);
      }

      if (!helpers.isObject(opts.meta)) {
        opts.meta = {};
      }

      if (!helpers.isNumber(opts.size)) {
        opts.size = stats.size;
      }

      const result = this._dataToSchema({
        name: opts.fileName,
        path,
        meta: opts.meta,
        type: opts.type,
        size: opts.size,
        userId: opts.userId,
        extension,
        _storagePath: path.replace(`${nodePath.sep}${opts.fileName}`, ''),
        fileId: (opts.fileId && this.sanitize(opts.fileId, 20, 'a')) || null,
      });

      let _id;
      try {
        _id = await this.collection.insertAsync(result);
      } catch (insertErr) {
        this._debug(
          `[FilesCollection] [addFileAsync] [insertAsync] Error: ${result.name} -> ${this.collectionName}`,
          insertErr
        );
        throw new Meteor.Error(insertErr.code, insertErr.message);
      }

      const fileRef = await this.collection.findOneAsync(_id);

      if (proceedAfterUpload === true) {
        this.onAfterUpload && this.onAfterUpload.call(this, fileRef);
        this.emit('afterUpload', fileRef);
      }
      this._debug(
        `[FilesCollection] [addFileAsync]: ${result.name} -> ${this.collectionName}`
      );
      return fileRef;
    }
    throw new Meteor.Error(
      400,
      `[FilesCollection] [addFile(${path})]: File does not exist`
    );
  }

  /**
   * @locus Anywhere
   * @memberOf FilesCollection
   * @name remove
   * @param {String|Object} selector - Mongo-Style selector (http://docs.meteor.com/api/collections.html#selectors)
   * @param {Function} callback - Callback with one `error` argument
   * @summary Remove documents from the collection
   * @returns {FilesCollection} Instance
   */
  remove(selector, callback) {
    this._debug(`[FilesCollection] [remove(${JSON.stringify(selector)})]`);
    if (selector === void 0) {
      return 0;
    }
    check(callback, Match.Optional(Function));

    const files = this.collection.find(selector);
    if (files.count() > 0) {
      files.forEach((file) => {
        this.unlink(file);
      });
    } else {
      callback && callback(new Meteor.Error(404, 'Cursor is empty, no files is removed'));
      return this;
    }

    if (this.onAfterRemove) {
      const docs = files.fetch();
      const self = this;
      this.collection.remove(selector, function () {
        callback && callback.apply(this, arguments);
        self.onAfterRemove(docs);
      });
    } else {
      this.collection.remove(selector, (callback || noop));
    }
    return this;
  }

  /**
   * @locus Anywhere
   * @memberOf FilesCollection
   * @name removeAsync
   * @param {String|Object} selector - Mongo-Style selector (http://docs.meteor.com/api/collections.html#selectors)
   * @throws {Meteor.Error} If cursor is empty
   * @summary Remove documents from the collection
   * @returns {Promise<FilesCollection>} Instance
   */
  async removeAsync(selector) {
    this._debug(`[FilesCollection] [removeAsync(${JSON.stringify(selector)})]`);
    if (selector === void 0) {
      return 0;
    }

    const files = this.collection.find(selector);
    if (files.count() > 0) {
      files.forEach((file) => {
        this.unlink(file);
      });
    } else {
      throw new Meteor.Error(404, 'Cursor is empty, no files is removed');
    }

    if (this.onAfterRemoveAsync) {
      const docs = files.fetch();
      await this.collection.removeAsync(selector);
      await this.onAfterRemoveAsync(docs);
    } else {
      await this.collection.removeAsync(selector);
    }
    return this;
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name deny
   * @param {Object} rules
   * @see  https://docs.meteor.com/api/collections.html#Mongo-Collection-deny
   * @summary link Mongo.Collection deny methods
   * @returns {Mongo.Collection} Instance
   */
  deny(rules) {
    this.collection.deny(rules);
    return this.collection;
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name allow
   * @param {Object} rules
   * @see https://docs.meteor.com/api/collections.html#Mongo-Collection-allow
   * @summary link Mongo.Collection allow methods
   * @returns {Mongo.Collection} Instance
   */
  allow(rules) {
    this.collection.allow(rules);
    return this.collection;
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name denyClient
   * @see https://docs.meteor.com/api/collections.html#Mongo-Collection-deny
   * @summary Shorthands for Mongo.Collection deny method
   * @returns {Mongo.Collection} Instance
   */
  denyClient() {
    this.collection.deny({
      insert() { return true; },
      update() { return true; },
      remove() { return true; }
    });
    return this.collection;
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name allowClient
   * @see https://docs.meteor.com/api/collections.html#Mongo-Collection-allow
   * @summary Shorthands for Mongo.Collection allow method
   * @returns {Mongo.Collection} Instance
   */
  allowClient() {
    this.collection.allow({
      insert() { return true; },
      update() { return true; },
      remove() { return true; }
    });
    return this.collection;
  }


  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name unlink
   * @param {Object} fileRef - fileObj
   * @param {String} version - [Optional] file's version
   * @param {Function} callback - [Optional] callback function
   * @summary Unlink files and it's versions from FS
   * @returns {FilesCollection} Instance
   */
  unlink(fileRef, version, callback) {
    this._debug(`[FilesCollection] [unlink(${fileRef._id}, ${version})]`);
    if (version) {
      if (helpers.isObject(fileRef.versions) && helpers.isObject(fileRef.versions[version]) && fileRef.versions[version].path) {
        fs.unlink(fileRef.versions[version].path, (callback || noop));
      }
    } else {
      if (helpers.isObject(fileRef.versions)) {
        for(let vKey in fileRef.versions) {
          if (fileRef.versions[vKey] && fileRef.versions[vKey].path) {
            fs.unlink(fileRef.versions[vKey].path, (callback || noop));
          }
        }
      } else {
        fs.unlink(fileRef.path, (callback || noop));
      }
    }
    return this;
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name _404
   * @summary Internal method, used to return 404 error
   * @returns {undefined}
   */
  _404(http) {
    this._debug(`[FilesCollection] [download(${http.request.originalUrl})] [_404] File not found`);
    const text = 'File Not Found :(';

    if (!http.response.headersSent) {
      http.response.writeHead(404, {
        'Content-Type': 'text/plain',
        'Content-Length': text.length
      });
    }

    if (!http.response.finished) {
      http.response.end(text);
    }
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name download
   * @param {Object} http    - Server HTTP object
   * @param {String} version - Requested file version
   * @param {Object} fileRef - Requested file Object
   * @summary Initiates the HTTP response
   * @returns {undefined}
   */
  download(http, version = 'original', fileRef) {
    let vRef;
    this._debug(`[FilesCollection] [download(${http.request.originalUrl}, ${version})]`);

    if (fileRef) {
      if (helpers.has(fileRef, 'versions') && helpers.has(fileRef.versions, version)) {
        vRef = fileRef.versions[version];
        vRef._id = fileRef._id;
      } else {
        vRef = fileRef;
      }
    } else {
      vRef = false;
    }

    if (!vRef || !helpers.isObject(vRef)) {
      return this._404(http);
    } else if (fileRef) {
      if (helpers.isFunction(this.downloadCallback) && !this.downloadCallback.call(Object.assign(http, this._getUser(http)), fileRef)) {
        return this._404(http);
      }

      if (this.interceptDownload && helpers.isFunction(this.interceptDownload) && this.interceptDownload(http, fileRef, version) === true) {
        return void 0;
      }

      fs.stat(vRef.path, (statErr, stats) => bound(() => {
        let responseType;
        if (statErr || !stats.isFile()) {
          return this._404(http);
        }

        if ((stats.size !== vRef.size) && !this.integrityCheck) {
          vRef.size = stats.size;
        }

        if ((stats.size !== vRef.size) && this.integrityCheck) {
          responseType = '400';
        }

        return this.serve(http, fileRef, vRef, version, null, (responseType || '200'));
      }));
      return void 0;
    }
    return this._404(http);
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name downloadAsync
   * @param {Object} http    - Server HTTP object
   * @param {String} version - Requested file version
   * @param {Object} fileRef - Requested file Object
   * @summary Initiates the HTTP response
   * @returns {Promise<undefined>}
   */
  async downloadAsync(http, version = 'original', fileRef) {
    let vRef;
    this._debug(
      `[FilesCollection] [download(${http.request.originalUrl}, ${version})]`
    );

    if (fileRef) {
      if (
        helpers.has(fileRef, 'versions') &&
        helpers.has(fileRef.versions, version)
      ) {
        vRef = fileRef.versions[version];
        vRef._id = fileRef._id;
      } else {
        vRef = fileRef;
      }
    } else {
      vRef = false;
    }

    if (!vRef || !helpers.isObject(vRef)) {
      return this._404(http);
    } else if (fileRef) {
      if (
        helpers.isFunction(this.downloadCallbackAsync) &&
        !(await this.downloadCallbackAsync(
          Object.assign(http, this._getUser(http)),
          fileRef
        ))
      ) {
        return this._404(http);
      }

      if (
        this.interceptDownloadAsync &&
        helpers.isFunction(this.interceptDownloadAsync) &&
        (await this.interceptDownloadAsync(http, fileRef, version)) === true
      ) {
        return void 0;
      }

      let stats;

      try {
        stats = await fs.promises.stat(vRef.path);
      } catch (statErr){
        if (statErr) {
          return this._404(http);
        }
      }
      if (!stats.isFile()) {
        return this._404(http);
      }
      let responseType;

      if (stats.size !== vRef.size && !this.integrityCheck) {
        vRef.size = stats.size;
      }

      if (stats.size !== vRef.size && this.integrityCheck) {
        responseType = '400';
      }

      this.serve(
        http,
        fileRef,
        vRef,
        version,
        null,
        responseType || '200'
      );

      return void 0;
    }
    return this._404(http);
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name serve
   * @param {Object} http    - Server HTTP object
   * @param {Object} fileRef - Requested file Object
   * @param {Object} vRef    - Requested file version Object
   * @param {String} version - Requested file version
   * @param {stream.Readable|null} readableStream - Readable stream, which serves binary file data
   * @param {String} responseType - Response code
   * @param {Boolean} force200 - Force 200 response code over 206
   * @summary Handle and reply to incoming request
   * @returns {undefined}
   */
  serve(http, fileRef, vRef, version = 'original', readableStream = null, _responseType = '200', force200 = false) {
    let partiral = false;
    let reqRange = false;
    let dispositionType = '';
    let start;
    let end;
    let take;
    let responseType = _responseType;

    if (http.params?.query?.download && (http.params.query.download === 'true')) {
      dispositionType = 'attachment; ';
    } else {
      dispositionType = 'inline; ';
    }

    const dispositionName = `filename=\"${encodeURI(vRef.name || fileRef.name).replace(/\,/g, '%2C')}\"; filename*=UTF-8''${encodeURIComponent(vRef.name || fileRef.name)}; `;
    const dispositionEncoding = 'charset=UTF-8';

    if (!http.response.headersSent) {
      http.response.setHeader('Content-Disposition', dispositionType + dispositionName + dispositionEncoding);
    }

    if (http.request.headers.range && !force200) {
      partiral = true;
      const array = http.request.headers.range.split(/bytes=([0-9]*)-([0-9]*)/);
      start = parseInt(array[1]);
      end = parseInt(array[2]);
      if (isNaN(end)) {
        end = vRef.size - 1;
      }
      take = end - start;
    } else {
      start = 0;
      end = vRef.size - 1;
      take = vRef.size;
    }

    if (partiral || (http.params?.query?.play && (http.params.query.play === 'true'))) {
      reqRange = {start, end};
      if (isNaN(start) && !isNaN(end)) {
        reqRange.start = end - take;
        reqRange.end = end;
      }
      if (!isNaN(start) && isNaN(end)) {
        reqRange.start = start;
        reqRange.end = start + take;
      }

      if ((start + take) >= vRef.size) {
        reqRange.end = vRef.size - 1;
      }

      if (this.strict && ((reqRange.start >= (vRef.size - 1)) || (reqRange.end > (vRef.size - 1)))) {
        responseType = '416';
      } else {
        responseType = '206';
      }
    } else {
      responseType = '200';
    }

    const streamErrorHandler = (error) => {
      this._debug(`[FilesCollection] [serve(${vRef.path}, ${version})] [500]`, error);
      if (!http.response.finished) {
        http.response.end(error.toString());
      }
    };

    const headers = helpers.isFunction(this.responseHeaders) ? this.responseHeaders(responseType, fileRef, vRef, version, http) : this.responseHeaders;

    if (!headers['Cache-Control']) {
      if (!http.response.headersSent) {
        http.response.setHeader('Cache-Control', this.cacheControl);
      }
    }

    for (let key in headers) {
      if (!http.response.headersSent) {
        http.response.setHeader(key, headers[key]);
      }
    }

    const respond = (stream, code) => {
      stream._isEnded = false;
      const closeStreamCb = (closeError) => {
        if (!closeError) {
          stream._isEnded = true;
        } else {
          this._debug(`[FilesCollection] [serve(${vRef.path}, ${version})] [respond] [closeStreamCb] (this is error on the stream we wish to forcefully close after it isn't needed anymore. It's okay that it throws errors. Consider this as purely informational message)`, closeError);
        }
      };

      const closeStream = () => {
        if (!stream._isEnded && !stream.destroyed) {
          try {
            if (typeof stream.close === 'function') {
              stream.close(closeStreamCb);
            } else if (typeof stream.end === 'function') {
              stream.end(closeStreamCb);
            } else if (typeof stream.destroy === 'function') {
              stream.destroy('Got to close this stream', closeStreamCb);
            }
          } catch (closeStreamError) {
            // Perhaps one of the method has thrown an error
            // or stream has been already ended/closed/exhausted
          }
        }
      };

      if (!http.response.headersSent && readableStream) {
        http.response.writeHead(code);
      }

      http.request.on('aborted', () => {
        http.request.aborted = true;
      });

      stream.on('open', () => {
        if (!http.response.headersSent) {
          http.response.writeHead(code);
        }
      }).on('abort', () => {
        closeStream();
        if (!http.response.finished) {
          http.response.end();
        }
        if (!http.request.aborted) {
          http.request.destroy();
        }
      }).on('error', (err) => {
        closeStream();
        streamErrorHandler(err);
      }).on('end', () => {
        if (!http.response.finished) {
          http.response.end();
        }
      }).pipe(http.response);
    };

    switch (responseType) {
    case '400':
      this._debug(`[FilesCollection] [serve(${vRef.path}, ${version})] [400] Content-Length mismatch!`);
      var text = 'Content-Length mismatch!';

      if (!http.response.headersSent) {
        http.response.writeHead(400, {
          'Content-Type': 'text/plain',
          'Content-Length': text.length
        });
      }

      if (!http.response.finished) {
        http.response.end(text);
      }
      break;
    case '404':
      this._404(http);
      break;
    case '416':
      this._debug(`[FilesCollection] [serve(${vRef.path}, ${version})] [416] Content-Range is not specified!`);
      if (!http.response.headersSent) {
        http.response.writeHead(416);
      }
      if (!http.response.finished) {
        http.response.end();
      }
      break;
    case '206':
      this._debug(`[FilesCollection] [serve(${vRef.path}, ${version})] [206]`);
      if (!http.response.headersSent) {
        http.response.setHeader('Content-Range', `bytes ${reqRange.start}-${reqRange.end}/${vRef.size}`);
      }
      respond(readableStream || fs.createReadStream(vRef.path, {start: reqRange.start, end: reqRange.end}), 206);
      break;
    default:
      if (!http.response.headersSent) {
        http.response.setHeader('Content-Length', `${vRef.size}`);
      }
      this._debug(`[FilesCollection] [serve(${vRef.path}, ${version})] [200]`);
      respond(readableStream || fs.createReadStream(vRef.path), 200);
      break;
    }
  }
}

export { FilesCollection, helpers };
