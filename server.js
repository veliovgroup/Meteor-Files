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

import fs from 'node:fs';
import nodeQs from 'node:querystring';
import nodePath from 'node:path';
import { pipeline } from 'node:stream/promises';

/**
 * @const {function} noop - No Operation function, placeholder for required callbacks
 */
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
 * @locus Server
 * @class FilesCollection
 * @param config           {FilesCollectionConfig}   - [Both]   Configuration object with next properties:
 * @param config.debug     {boolean}  - [Both]   Turn on/of debugging and extra logging
 * @param config.schema    {Object}   - [Both]   Collection Schema
 * @param config.public    {boolean}  - [Both]   Store files in folder accessible for proxy servers, for limits, and more - read docs
 * @param config.strict    {boolean}  - [Server] Strict mode for partial content, if is `true` server will return `416` response code, when `range` is not specified, otherwise server return `206`
 * @param config.protected {function} - [Server] If `true` - files will be served only to authorized users, if `function()` - you're able to check visitor's permissions in your own way function's context has:
 *  - `request`
 *  - `response`
 *  - `userAsync()`
 *  - `userId`
 * @param config.chunkSize      {number}  - [Both] Upload chunk size, default: 524288 bytes (0,5 Mb)
 * @param config.permissions    {number}  - [Server] Permissions which will be set to uploaded files (octal), like: `511` or `0o755`. Default: 0644
 * @param config.parentDirPermissions {number}  - [Server] Permissions which will be set to parent directory of uploaded files (octal), like: `611` or `0o777`. Default: 0755
 * @param config.storagePath    {string|function}  - [Server] Storage path on file system
 * @param config.cacheControl   {string}  - [Server] Default `Cache-Control` header
 * @param config.responseHeaders {object|function} - [Server] Custom response headers, if function is passed, must return Object
 * @param config.throttle       {number}  - [Server] DEPRECATED bps throttle threshold
 * @param config.downloadRoute  {string}  - [Both]   Server Route used to retrieve files
 * @param config.collection     {Mongo.Collection} - [Both] Mongo Collection Instance
 * @param config.collectionName {string}  - [Both]   Collection name
 * @param config.namingFunction {function}- [Both]   Function which returns `String`
 * @param config.integrityCheck {boolean} - [Server] Check file's integrity before serving to users
 * @param config.onAfterUpload  {function}- [Server] Called right after file is ready on FS. Use to transfer file somewhere else, or do other thing with file directly
 * @param config.onAfterRemove  {function(fileObj[]): boolean} - [Server] Called with single argument with array of removed `fileObj[]` right after file(s) is removed. Return `true` to intercept `.unlinkAsync` method; return `false` to continue default behavior
 * @param config.continueUploadTTL {number} - [Server] Time in seconds, during upload may be continued, default 3 hours (10800 seconds)
 * @param config.onBeforeUpload {function}- [Both]   Function which executes on server after receiving each chunk and on client right before beginning upload. Function context is `File` - so you are able to check for extension, mime-type, size and etc.:
 *  - return or resolve `true` to continue
 *  - return or resolve `false` or `String` to abort upload
 * @param config.getUser        {function} - [Server] Replace default way of recognizing user, useful when you want to auth user based on custom cookie (or other way). arguments {http: {request: {...}, response: {...}}}, need to return {userId: String, user: Function}
 * @param config.onInitiateUpload {function} - [Server] Function which executes on server right before upload is begin and right after `onBeforeUpload` hook. This hook is fully asynchronous.
 * @param config.onBeforeRemove {function} - [Server] Executes before removing file on server, so you can check permissions. Return `true` to allow physical file removal and `false` to deny.
 * @param config.allowClientCode  {boolean}  - [Both]   Allow to run `remove` from client
 * @param config.downloadCallback {function} - [Server] Callback triggered each time file is requested, return truthy value to continue download, or falsy to abort
 * @param config.interceptRequest {function} - [Server] Intercept incoming HTTP request, so you can whatever you want, no checks or preprocessing, arguments {http: {request: {...}, response: {...}}, params: {...}}
 * @param config.interceptDownload {function} - [Server] Intercept download request, so you can serve file from third-party resource, arguments {http: {request: {...}, response: {...}}, fileRef: {...}}
 * @param config.disableUpload {boolean} - Disable file upload, useful for server only solutions
 * @param config.disableDownload {boolean} - Disable file download (serving), useful for file management only solutions
 * @param config.allowedOrigins  {Regex|boolean}  - [Server]   Regex of Origins that are allowed CORS access or `false` to disable completely. Defaults to `/^http:\/\/localhost:12[0-9]{3}$/` for allowing Meteor-Cordova builds access
 * @param config.allowQueryStringCookies {boolean} - Allow passing Cookies in a query string (in URL). Primary should be used only in Cordova environment. Note: this option will be used only on Cordova. Default: `false`
 * @param config.sanitize {function} - Override default sanitize function
 * @param config._preCollection  {Mongo.Collection} - [Server] Mongo preCollection Instance
 * @param config._preCollectionName {string}  - [Server]  preCollection name
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
        downloadRoute: this.downloadRoute,
        getUser: this.getUser,
        integrityCheck: this.integrityCheck,
        interceptDownload: this.interceptDownload,
        interceptRequest: this.interceptRequest,
        namingFunction: this.namingFunction,
        onAfterRemove: this.onAfterRemove,
        onAfterUpload: this.onAfterUpload,
        onBeforeRemove: this.onBeforeRemove,
        onBeforeUpload: this.onBeforeUpload,
        onInitiateUpload: this.onInitiateUpload,
        parentDirPermissions: this.parentDirPermissions,
        permissions: this.permissions,
        protected: this.protected,
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

    if (!helpers.isBoolean(this.disableUpload)) {
      this.disableUpload = false;
    }

    if (!helpers.isFunction(this.onAfterRemove)) {
      this.onAfterRemove = false;
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

    if (!helpers.isNumber(this.continueUploadTTL)) {
      this.continueUploadTTL = 10800;
    }

    if (!helpers.isFunction(this.sanitize)) {
      this.sanitize = helpers.sanitize;
    }

    if (!helpers.isFunction(this.responseHeaders)) {
      this.responseHeaders = (responseCode, _fileObj, versionRef) => {
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
    check(this.disableUpload, Boolean);
    check(this.integrityCheck, Boolean);
    check(this.disableDownload, Boolean);
    check(this.continueUploadTTL, Number);
    check(this.allowQueryStringCookies, Boolean);
    /* eslint-disable new-cap */
    check(this.onAfterRemove, Match.OneOf(false, Function));
    check(this.onAfterUpload, Match.OneOf(false, Function));
    check(this.onBeforeRemove, Match.OneOf(false, Function));
    check(this.downloadCallback, Match.OneOf(false, Function));
    check(this.interceptRequest, Match.OneOf(false, Function));
    check(this.interceptDownload, Match.OneOf(false, Function));
    check(this.responseHeaders, Match.OneOf(Object, Function));
    check(this.allowedOrigins, Match.OneOf(Boolean, RegExp));
    /* eslint-enable new-cap */

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
        async changed(doc) {
          if (doc.isFinished) {
            self._debug(`[FilesCollection] [_preCollectionCursor.observe] [changed]: ${doc._id}`);
            await self._preCollection.removeAsync({_id: doc._id});
          }
        },
        async removed(doc) {
          // Free memory after upload is done
          // Or if upload is unfinished
          self._debug(`[FilesCollection] [_preCollectionCursor.observe] [removed]: ${doc._id}`);
          if (helpers.isObject(self._currentUploads[doc._id]) && !self._currentUploads[doc._id].ended && !self._currentUploads[doc._id].aborted) {
            await self._currentUploads[doc._id].end();

            // We can be unlucky to run into a race condition where another server removed this document before the change of `isFinished` is registered on this server.
            // Therefore it's better to double-check with the main collection if the file is referenced there. Issue: https://github.com/veliovgroup/Meteor-Files/issues/672
            if (!doc.isFinished && (await self.collection.countDocuments({ _id: doc._id })) === 0) {
              self._debug(`[FilesCollection] [_preCollectionCursor.observe] [removeUnfinishedUpload]: ${doc._id}`);
              await self._currentUploads[doc._id].abort();
            }
          }
          delete self._currentUploads[doc._id];
        }
      });

      this._createStream = async (_id, path, opts) => {
        const stream = new WriteStream(path, opts.fileLength, opts, this.permissions, this.parentDirPermissions);
        this._currentUploads[_id] = await stream.init();
      };

      // This little function allows to continue upload
      // even after server is restarted (*not on dev-stage*)
      this._continueUpload = async (_id) => {
        if (this._currentUploads[_id] && this._currentUploads[_id].file) {
          if (!this._currentUploads[_id].aborted && !this._currentUploads[_id].ended) {
            return this._currentUploads[_id].file;
          }
          await this._createStream(_id, this._currentUploads[_id].file.file.path, this._currentUploads[_id].file);
          return this._currentUploads[_id].file;
        }

        const contUpld = await this._preCollection.findOneAsync({_id});
        if (contUpld) {
          await this._createStream(_id, contUpld.file.path, contUpld);
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
    check(this.chunkSize, Number);
    check(this.downloadRoute, String);
    check(this.allowClientCode, Boolean);
    /* eslint-disable new-cap */
    check(this.getUser, Match.OneOf(false, Function));
    check(this.protected, Match.OneOf(Boolean, Function));
    check(this.namingFunction, Match.OneOf(false, Function));
    check(this.onBeforeUpload, Match.OneOf(false, Function));
    check(this.onInitiateUpload, Match.OneOf(false, Function));
    /* eslint-enable new-cap */

    if (this.public && this.protected) {
      throw new Meteor.Error(500, `[FilesCollection.${this.collectionName}]: Files can not be public and protected at the same time!`);
    }

    this._checkAccess = async (http) => {
      if (this.protected) {
        let result;
        const {userAsync, userId} = this._getUser(http);

        if (helpers.isFunction(this.protected)) {
          let fileObj;
          if (helpers.isObject(http.params) &&  http.params._id) {
            fileObj = await this.collection.findOneAsync(http.params._id);
          }

          result = http ? await this.protected.call(Object.assign(http, {userAsync, userId}), (fileObj || null)) : await this.protected.call({userAsync, userId}, (fileObj || null));
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

    if (this.disableUpload && this.disableDownload) {
      return;
    }
    WebApp.connectHandlers.use(async (httpReq, httpResp, next) => {
      if (this.allowedOrigins && httpReq._parsedUrl.path.includes(`${this.downloadRoute}/`) && !httpResp.headersSent) {
        if (httpReq.headers.origin && this.allowedOrigins.test(httpReq.headers.origin)) {
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

      if (httpReq._parsedUrl.path.includes(`${this.downloadRoute}/${this.collectionName}/__upload`)) {
        if (this.disableUpload) {
          next();
          return;
        }

        if (httpReq.method !== 'POST') {
          next();
          return;
        }

        const handleError = (_error) => {
          let error = _error;
          let errorCode = 500;
          this._debug('[FilesCollection] [Upload] [HTTP] [handleError]', error);

          if (helpers.isObject(error)) {
            if (typeof error?.error === 'number') {
              errorCode = error.error;
            }

            if (helpers.isFunction(error?.toString)) {
              error = error.toString();
            }
          }

          if (!helpers.isString(error)) {
            error = 'Unexpected error!';
          }

          if (!httpResp.headersSent) {
            httpResp.writeHead(errorCode, {
              'Content-Type': 'application/json',
            });
          }

          if (!httpResp.finished && !httpResp.writableEnded) {
            httpResp.end(JSON.stringify({ error }));
          }
        };

        let body = '';
        const handleData = async () => {
          try {
            let opts;
            let result;
            let user = this._getUser({request: httpReq, response: httpResp});

            if (httpReq.headers['x-start'] === '1') {
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

              try {
                ({result} = await this._prepareUpload(helpers.clone(opts), user.userId, 'HTTP Start Method'));
              } catch (prepareError) {
                handleError(prepareError);
                return;
              }

              let res;
              res = await this.collection.findOneAsync(result._id);

              if (res) {
                throw new Meteor.Error(400, 'Can\'t start upload, data substitution detected!');
              }

              opts._id = opts.fileId;
              opts.createdAt = new Date();
              opts.maxLength = opts.fileLength;

              await this._preCollection.insertAsync(helpers.omit(opts, '___s'));
              await this._createStream(result._id, result.path, helpers.omit(opts, '___s'));

              if (opts.returnMeta) {
                if (!httpResp.headersSent) {
                  httpResp.writeHead(200, {
                    'Content-Type': 'application/json',
                  });
                }

                if (!httpResp.finished && !httpResp.writableEnded) {
                  httpResp.end(JSON.stringify({
                    uploadRoute: `${this.downloadRoute}/${this.collectionName}/__upload`,
                    file: result
                  }));
                }
              } else {
                if (!httpResp.headersSent) {
                  httpResp.writeHead(204);
                }

                if (!httpResp.finished && !httpResp.writableEnded) {
                  httpResp.end();
                }
              }
              return;
            }

            // GET FILE'S UPLAOD META-DATA
            opts = {
              fileId: this.sanitize(httpReq.headers['x-fileid'], 20, 'a')
            };

            if (httpReq.headers['x-eof'] === '1') {
              opts.eof = true;
            } else {
              opts.binData = Buffer.from(body, 'base64');
              opts.chunkId = parseInt(httpReq.headers['x-chunkid']);
            }

            const _continueUpload = await this._continueUpload(opts.fileId);
            if (!_continueUpload) {
              throw new Meteor.Error(408, 'Can\'t continue upload, session expired. Start upload again.');
            }

            try {
              ({result, opts} = await this._prepareUpload(Object.assign(opts, _continueUpload), user.userId, 'HTTP'));
            } catch (prepareError) {
              handleError(prepareError);
              return;
            }

            if (opts.eof) {
              // FINISH UPLOAD SCENARIO:
              try {
                const isWritten = await this._handleUpload(result, opts);

                if (!isWritten) {
                  handleError(new Meteor.Error(503, 'Corrupted chunk. Try again'));
                  return;
                }

                if (!httpResp.headersSent) {
                  httpResp.writeHead(200, {
                    'Content-Type': 'application/json',
                  });
                }

                if (helpers.isObject(result.file) && result.file.meta) {
                  result.file.meta = fixJSONStringify(result.file.meta);
                }

                if (!httpResp.finished && !httpResp.writableEnded) {
                  httpResp.end(JSON.stringify(result));
                }
              } catch (handleUploadError) {
                handleError(handleUploadError);
              }
              return;
            }

            // CHUNK UPLOAD SCENARIO:
            await self._handleUpload(result, opts);

            if (!httpResp.headersSent) {
              httpResp.writeHead(204);
            }

            if (!httpResp.finished && !httpResp.writableEnded) {
              httpResp.end();
            }
          } catch (httpRespErr) {
            handleError(httpRespErr);
          }
        };

        httpReq.setTimeout(26000, () => {
          handleError(new Meteor.Error(503, 'Timeout. Try again.'));
        });

        httpReq.on('error', (error) => {
          handleError(new Meteor.Error(503, 'Request Error. Try again.', error?.toString?.() || ''));
        });

        if (typeof httpReq.body === 'object' && Object.keys(httpReq.body).length !== 0) {
          body = JSON.stringify(httpReq.body);
          handleData();
        } else {
          httpReq.on('data', (data) => {
            body += data;
          });

          httpReq.on('end', () => {
            handleData();
          });
        }
        return;
      }

      if (this.disableDownload) {
        next();
        return;
      }
      let uri;

      if (this.public) {
        // HANDLE FILES UPLOADED TO DIRECTORY ACCESSIBLE BY WEB SERVER
        // AND/OR WITHOUT PERMISSION CONTROL
        if (!httpReq._parsedUrl.path.includes(`${this.downloadRoute}`)) {
          next();
          return;
        }
        uri = httpReq._parsedUrl.path.replace(`${this.downloadRoute}`, '');
        if (uri.indexOf('/') === 0) {
          uri = uri.substring(1);
        }

        const uris = uri.split('/');
        let _file = uris[uris.length - 1];
        if (!_file) {
          next();
          return;
        }
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

        // CHECK IF SETUP HAS CUSTOM FUNCTION TO SERVE UPLOADED FILES VIA `interceptRequest`
        if (this.interceptRequest && helpers.isFunction(this.interceptRequest) && (await this.interceptRequest(http)) === true) {
          return;
        }
        await this.download(http, version, await this.collection.findOneAsync(params._id));
        return;
      }

      // HANDLE FILES UPLOADED TO OBFUSCATED STORAGE WITH PERMISSION CONTROL
      if (!httpReq._parsedUrl.path.includes(`${this.downloadRoute}/${this.collectionName}`)) {
        next();
        return;
      }

      uri = httpReq._parsedUrl.path.replace(`${this.downloadRoute}/${this.collectionName}`, '');
      if (uri.indexOf('/') === 0) {
        uri = uri.substring(1);
      }

      const uris = uri.split('/');
      if (uris.length !== 3) {
        next();
        return;
      }

      const params = {
        _id: uris[0],
        query: httpReq._parsedUrl.query ? nodeQs.parse(httpReq._parsedUrl.query) : {},
        name: uris[2].split('?')[0],
        version: uris[1]
      };

      const http = {request: httpReq, response: httpResp, params};

      // CHECK IF SETUP HAS CUSTOM FUNCTION TO SERVE UPLOADED FILES VIA `interceptRequest`
      if (this.interceptRequest && helpers.isFunction(this.interceptRequest) && (await this.interceptRequest(http)) === true) {
        return;
      }

      if (await this._checkAccess(http)) {
        await this.download(http, uris[1], await this.collection.findOneAsync(uris[0]));
      }
      return;
    });

    this._debug('[FilesCollection] initiated', this);

    if (this.disableUpload) {
      // SKIP REGISTERING SERVER METHODS WHEN {disableUpload: true}
      return;
    }
    const _methods = {};
    // Method used to remove file
    // from Client side
    _methods[this._methodNames._Remove] = async function (selector) {
      // eslint-disable-next-line new-cap
      check(selector, Match.OneOf(String, Object));
      self._debug(`[FilesCollection] [Unlink Method] [.removeAsync(${selector})]`);

      if (self.allowClientCode) {
        if (self.onBeforeRemove) {
          const userId = this.userId;
          const userFuncs = {
            userId: this.userId,
            async userAsync(){
              if (Meteor.users) {
                return await Meteor.users.findOneAsync(userId);
              }
              return null;
            }
          };

          if (!(await self.onBeforeRemove.call(userFuncs, (self.find(selector) || null)))) {
            throw new Meteor.Error(403, '[FilesCollection] [remove] Not permitted!');
          }
        }

        const count = await self.countDocuments(selector);
        if (count > 0) {
          await self.removeAsync(selector);
        }
        return count;
      }

      throw new Meteor.Error(405, '[FilesCollection] [remove] Running code on a client is not allowed!');
    };


    // Method used to receive "first byte" of upload
    // and all file's meta-data, so
    // it won't be transferred with every chunk
    // Basically it prepares everything
    // So user can pause/disconnect and
    // continue upload later, during `continueUploadTTL`
    _methods[this._methodNames._Start] = async function (opts, returnMeta) {
      /* eslint-disable new-cap */
      check(opts, {
        file: Object,
        fileId: String,
        FSName: Match.Optional(String),
        chunkSize: Number,
        fileLength: Number
      });
      check(returnMeta, Match.Optional(Boolean));
      /* eslint-enable new-cap */
      self._debug(`[FilesCollection] [File Start Method] ${opts.file.name} - ${opts.fileId}`);

      opts.fileId = self.sanitize(opts.fileId, 20, 'a');
      opts.___s = true;
      const { result } = await self._prepareUpload(helpers.clone(opts), this.userId, 'DDP Start Method');

      if (await self.collection.findOneAsync(result._id)) {
        throw new Meteor.Error(400, 'Can\'t start upload, data substitution detected!');
      }

      opts._id = opts.fileId;
      opts.createdAt = new Date();
      opts.maxLength = opts.fileLength;
      try {
        await self._preCollection.insertAsync(helpers.omit(opts, '___s'));
        await self._createStream(result._id, result.path, helpers.omit(opts, '___s'));
      } catch (e) {
        self._debug(`[FilesCollection] [File Start Method] [EXCEPTION:] ${opts.file.name} - ${opts.fileId}`, e);
        throw new Meteor.Error(500, 'Can\'t start');
      }

      if (returnMeta) {
        return {
          status: 204,
          uploadRoute: `${self.downloadRoute}/${self.collectionName}/__upload`,
          file: result,
        };
      }
      return { status: 204 };
    };


    // Method used to write file chunks
    // it receives very limited amount of meta-data
    // This method also responsible for EOF
    _methods[this._methodNames._Write] = async function (_opts) {
      let opts = _opts;
      let result;
      /* eslint-disable new-cap */
      check(opts, {
        eof: Match.Optional(Boolean),
        fileId: String,
        binData: Match.Optional(String),
        chunkId: Match.Optional(Number)
      });
      /* eslint-enable new-cap */

      self._debug('[FilesCollection] [Write Method] Chunk received', opts.fileId);

      opts.fileId = self.sanitize(opts.fileId, 20, 'a');
      if (opts.binData) {
        opts.binData = Buffer.from(opts.binData, 'base64');
      }

      const _continueUpload = await self._continueUpload(opts.fileId);
      if (!_continueUpload) {
        throw new Meteor.Error(408, 'Can\'t continue upload, session expired. Start upload again.');
      }

      ({result, opts} = await self._prepareUpload(Object.assign(opts, _continueUpload), this.userId, 'DDP'));
      this.unblock();
      if (opts.eof) {
        try {
          const isWritten = await self._handleUpload(result, opts);
          if (!isWritten) {
            throw new Meteor.Error(503, 'try again');
          }
          result.status = 200;
          return result;
        } catch (handleUploadErr) {
          self._debug('[FilesCollection] [Write Method] [DDP] Exception:', handleUploadErr);
          throw handleUploadErr;
        }
      } else {
        await self._handleUpload(result, opts);
      }
      return { status: 204 };
    };

    // Method used to Abort upload
    // - Freeing memory by ending writableStreams
    // - Removing temporary record from @_preCollection
    // - Removing record from @collection
    // - .unlink()ing chunks from FS
    _methods[this._methodNames._Abort] = async function (_id) {
      check(_id, String);
      self._debug(`[FilesCollection] [Abort Method]: ${_id}`, self._currentUploads[_id]);
      this.unblock();

      if (self._currentUploads) {
        if (self._currentUploads[_id] && !self._currentUploads[_id].ended && !self._currentUploads[_id].aborted) {
          await self._currentUploads[_id].abort();
        }
      } else {
        const _continueUpload = await self._continueUpload(_id);
        self._debug(`[FilesCollection] [Abort Method]: ${_id} - ${(helpers.isObject(_continueUpload.file) ? _continueUpload.file.path : '')}`);

        if (_continueUpload) {
          if (helpers.isObject(_continueUpload.file) && _continueUpload.file.path) {
            await self.unlinkAsync({_id, path: _continueUpload.file.path});
          }
        }
      }

      await self._preCollection.removeAsync({_id});
      await self.collection.removeAsync({_id});
      return { status: 499 };
    };

    Meteor.methods(_methods);
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name _prepareUpload
   * @summary Internal method. Used to optimize received data and check upload permission
   * @returns {Promise<Object>}
   */
  async _prepareUpload(opts = {}, userId, transport) {
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
      opts.FSName = await this.namingFunction(opts);
    }

    result.path = `${this.storagePath(result)}${nodePath.sep}${opts.FSName}${extensionWithDot}`;
    result = Object.assign(result, this._dataToSchema(result));

    if (this.onBeforeUpload) {
      ctx = Object.assign({
        file: opts.file
      }, {
        chunkId: opts.chunkId,
        userId: result.userId,
        async userAsync() {
          if (Meteor.users && result.userId) {
            return await Meteor.users.findOneAsync(result.userId);
          }
          return null;
        },
        eof: opts.eof
      });
      const isUploadAllowed = await this.onBeforeUpload.call(ctx, result);

      if (isUploadAllowed !== true) {
        throw new Meteor.Error(403, helpers.isString(isUploadAllowed) ? isUploadAllowed : '@onBeforeUpload() returned false');
      } else {
        if ((opts.___s === true) && this.onInitiateUpload) {
          await this.onInitiateUpload.call(ctx, result);
        }
      }
    } else if ((opts.___s === true) && this.onInitiateUpload) {
      ctx = Object.assign({
        file: opts.file
      }, {
        chunkId: opts.chunkId,
        userId: result.userId,
        async userAsync() {
          if (Meteor.users && result.userId) {
            return await Meteor.users.findOneAsync(result.userId);
          }
          return null;
        },
        eof: opts.eof
      });
      await this.onInitiateUpload.call(ctx, result);
    }

    return { result, opts };
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name _finishUpload
   * @summary Internal method. Finish upload, close Writable stream, add record to MongoDB and flush used memory
   * @returns {Promise<undefined>}
   */
  async _finishUpload(result, opts) {
    this._debug(`[FilesCollection] [_finishUpload] [finish(ing)Upload] -> ${result.path}`);
    await fs.promises.chmod(result.path, this.permissions);
    result.type = this._getMimeType(opts.file);
    result.public = this.public;
    this._updateFileTypes(result);

    let _id;
    try {
      _id = await this.collection.insertAsync(helpers.clone(result));
      try {
        await this._preCollection.updateAsync({_id: opts.fileId}, {$set: {isFinished: true}});
        if (_id) {
          result._id = _id;
        }

        this._debug(`[FilesCollection] [_finishUpload] [finish(ed)Upload] -> ${result.path}`);
        if (this.onAfterUpload) {
          await this.onAfterUpload.call(this, result);
        }
        this.emit('afterUpload', result);
      } catch (prrUpdateError) {
        this._debug('[FilesCollection] [_finishUpload] [update] Error:', prrUpdateError);
      }
    } catch (colInsert){
      this._debug('[FilesCollection] [_finishUpload] [insert] Error:', colInsert);
    }
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name _handleUpload
   * @summary Internal method to handle upload process, pipe incoming data to Writable stream
   * @returns {Promise<boolean>} - `true` if chunk was written as expected
   */
  async _handleUpload(result, opts) {
    if (opts.eof) {
      if (await this._currentUploads[result._id].end()) {
        await this._finishUpload(result, opts);
        return true;
      }
    } else {
      if (await this._currentUploads[result._id].write(opts.chunkId, opts.binData)) {
        return true;
      }
    }
    return false;
  }

  /**
   * @locus Anywhere
   * @memberOf FilesCollection
   * @name _getMimeType
   * @param {Object} fileData - File Object
   * @summary Returns file's mime-type
   * @returns {string}
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
   * @returns {string}
   */
  _getUserId(xmtok) {
    if (!xmtok) {
      return null;
    }

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
   * @summary Returns object with `userId` and `userAsync()` method which return user's object
   * @returns {Object}
   */
  _getUser() {
    return this.getUser ? this.getUser(...arguments) : this._getUserDefault(...arguments);
  }

  /**
   * @locus Anywhere
   * @memberOf FilesCollection
   * @name _getUserDefault
   * @summary Default way of recognizing user based on 'x_mtok' cookie, can be replaced by 'config.getUser' if defined. Returns object with `userId` and `userAsync()` method which return user's object
   * @returns {Object}
   */
  _getUserDefault(http) {
    const result = {
      async userAsync() { return null; },
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
          result.userAsync = async () => {
            if (Meteor.users) {
              return await Meteor.users.findOneAsync(userId);
            }
            return null;
          };
          result.userId = userId;
        }
      }
    }

    return result;
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name writAsync
   * @param {Buffer} buffer - Binary File's Buffer
   * @param {WriteOpts} [opts] - Object with file-data
   * @param {string} opts.name - File name, alias: `fileName`
   * @param {string} opts.type - File mime-type
   * @param {Object} opts.meta - File additional meta-data
   * @param {string} opts.userId - UserId, default *null*
   * @param {string} opts.fileId - _id, sanitized, max-length: 20; default *null*
   * @param {boolean} proceedAfterUpload - Proceed onAfterUpload hook
   * @summary Write buffer to FS and add to FilesCollection Collection
   * @throws {Meteor.Error} If there is an error writing the file or inserting the document
   * @returns {Promise<FileObj>} File Object from DB
   */
  async writeAsync(buffer, _opts = {}, _proceedAfterUpload) {
    this._debug('[FilesCollection] [writeAsync()]');
    let opts = _opts;
    let proceedAfterUpload = _proceedAfterUpload;

    if (helpers.isBoolean(opts)) {
      proceedAfterUpload = opts;
      opts = {};
    }
    /* eslint-disable new-cap */
    check(opts, Match.Optional(Object));
    check(proceedAfterUpload, Match.Optional(Boolean));
    /* eslint-enable new-cap */

    opts.fileId = opts.fileId && this.sanitize(opts.fileId, 20, 'a');
    const fileId = opts.fileId || Random.id();
    const fsName = this.namingFunction ? await this.namingFunction(opts) : fileId;
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

    let fileObj;

    let mustCreateFileFirst = false;
    try {
      const stats = await fs.promises.stat(opts.path);
      if (!stats.isFile()) {
        mustCreateFileFirst = true;
      }
    } catch (_statError) {
      mustCreateFileFirst = true;
    }

    if (mustCreateFileFirst) {
      const paths = opts.path.split('/');
      paths.pop();
      await fs.promises.mkdir(paths.join('/'), { recursive: true, mode: this.parentDirPermissions, });
      await fs.promises.writeFile(opts.path, '', { mode: this.permissions, });
    }

    try {
      const fh = await fs.promises.open(opts.path, fs.constants.O_WRONLY | fs.constants.O_CREAT, this.permissions);
      await fh.write(buffer);
      await fh.datasync();
      await fh.close();
    } catch (openWriteErr) {
      this._debug(`[FilesCollection] [writeAsync] [open] [write] Error: ${fileName} -> ${this.collectionName}`, openWriteErr);
      throw new Meteor.Error('writeAsync', openWriteErr);
    }

    try {
      const _id = await this.collection.insertAsync(result);
      fileObj = await this.collection.findOneAsync(_id);

      if (proceedAfterUpload === true) {
        if (this.onAfterUpload){
          await this.onAfterUpload.call(this, fileObj);
        }
        this.emit('afterUpload', fileObj);
      }
      this._debug(`[FilesCollection] [write]: ${fileName} -> ${this.collectionName}`);
    } catch (insertErr) {
      this._debug(`[FilesCollection] [write] [insert] Error: ${fileName} -> ${this.collectionName}`, insertErr);
      throw new Meteor.Error('writeAsync', insertErr);
    }

    return fileObj;
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name loadAsync
   * @param {string} url - URL to file
   * @param {LoadOpts} [opts] - Object with file-data
   * @param {Object} opts.headers - HTTP headers to use when requesting the file
   * @param {string} opts.name - File name, alias: `fileName`
   * @param {string} opts.type - File mime-type
   * @param {Object} opts.meta - File additional meta-data
   * @param {string} opts.userId - UserId, default *null*
   * @param {string} opts.fileId - _id, sanitized, max-length: 20; default *null*
   * @param {number} opts.timeout - Timeout in milliseconds, default: 360000 (6 mins)
   * @param {boolean} [proceedAfterUpload] - Proceed onAfterUpload hook
   * @summary Download file over HTTP, write stream to FS, and add to FilesCollection Collection
   * @returns {Promise<FileObj>} File Object from DB
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
    /* eslint-disable new-cap */
    check(opts, Match.Optional(Object));
    check(proceedAfterUpload, Match.Optional(Boolean));
    /* eslint-enable new-cap */

    if (!helpers.isObject(opts)) {
      opts = {
        timeout: 360000
      };
    }

    if (!opts.timeout) {
      opts.timeout = 360000;
    }

    const fileId = (opts.fileId && this.sanitize(opts.fileId, 20, 'a')) || Random.id();
    const fsName = this.namingFunction ? await this.namingFunction(opts) : fileId;
    const pathParts = url.split('/');
    const fileName = (opts.name || opts.fileName) ? (opts.name || opts.fileName) : pathParts[pathParts.length - 1].split('?')[0] || fsName;

    const {extension, extensionWithDot} = this._getExt(fileName);
    opts.path = `${this.storagePath(opts)}${nodePath.sep}${fsName}${extensionWithDot}`;

    // this will be the resolved fileObj
    let fileObj;

    // storeResult is a function that will be called after the file is downloaded and stored in the database
    // this might throw an error from collection.insertAsync or collection.findOneAsync
    const storeResult = async (result) => {
      result._id = fileId;
      const _id  = await this.collection.insertAsync(result);

      fileObj = await this.collection.findOneAsync(_id);
      if (proceedAfterUpload === true) {
        if (this.onAfterUpload){
          await this.onAfterUpload.call(this, fileObj);
        }
        this.emit('afterUpload', fileObj);
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
    } catch (_statError) {
      mustCreateFileFirst = true;
    }

    if (mustCreateFileFirst) {
      const paths = opts.path.split('/');
      paths.pop();
      await fs.promises.mkdir(paths.join('/'), { recursive: true, mode: this.parentDirPermissions, });
      await fs.promises.writeFile(opts.path, '', { mode: this.permissions, });
    }

    const wStream = fs.createWriteStream(opts.path, { flags: fs.constants.O_WRONLY | fs.constants.O_CREAT, mode: this.permissions, autoClose: true, emitClose: false });
    const controller = new AbortController();

    try {
      let timer;

      if (opts.timeout && opts.timeout > 0) {
        timer = setTimeout(() => {
          controller.abort();
          throw new Meteor.Error(408, `Request timeout after ${opts.timeout}ms`);
        }, opts.timeout);
      }

      const res = await fetch(url, {
        headers: opts.headers || {},
        signal: controller.signal
      });

      if (timer) {
        clearTimeout(timer);
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


    return fileObj;
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name addFile
   * @param {string} path          - Path to file
   * @param {AddFileOpts} [opts]   - [Optional] Object with file-data
   * @param {string} opts.type     - [Optional] File mime-type
   * @param {Object} opts.meta     - [Optional] File additional meta-data
   * @param {string} opts.fileId   - [optional] _id, sanitized, max-length: 20 symbols default *null*
   * @param {string} opts.fileName - [Optional] File name, if not specified file name and extension will be taken from path
   * @param {string} opts.userId   - [Optional] UserId, default *null*
   * @param {boolean} proceedAfterUpload - Proceed onAfterUpload hook
   * @summary Add file from FS to FilesCollection
   * @throws {Meteor.Error} If file does not exist (400) or collection is public (403)
   * @returns {Promise<FileObj>} Instance
   */
  async addFile(path, _opts = {}, _proceedAfterUpload) {
    this._debug(`[FilesCollection] [addFile(${path})]`);
    let opts = _opts;
    let proceedAfterUpload = _proceedAfterUpload;

    if (this.public) {
      throw new Meteor.Error(403, 'Can not run [addFile] on public collection! Just Move file to root of your server, then add record to Collection');
    }

    check(path, String);
    /* eslint-disable new-cap */
    check(opts, Match.Optional(Object));
    check(proceedAfterUpload, Match.Optional(Boolean));
    /* eslint-enable new-cap */

    let stats;
    try {
      stats = await fs.promises.stat(path);
    } catch (statErr) {
      if (statErr.code === 'ENOENT') {
        throw new Meteor.Error(400, `[FilesCollection] [addFile(${path})]: File does not exist`);
      }
      throw new Meteor.Error(statErr.code, statErr.message);
    }

    if (!stats.isFile()) {
      throw new Meteor.Error(400, `[FilesCollection] [addFile(${path})]: File does not exist`);
    }

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
      this._debug(`[FilesCollection] [addFileAsync] [insertAsync] Error: ${result.name} -> ${this.collectionName}`, insertErr);
      throw new Meteor.Error(insertErr.code, insertErr.message);
    }

    const fileObj = await this.collection.findOneAsync(_id);

    if (proceedAfterUpload === true) {
      this.onAfterUpload && await this.onAfterUpload.call(this, fileObj);
      this.emit('afterUpload', fileObj);
    }
    this._debug(`[FilesCollection] [addFileAsync]: ${result.name} -> ${this.collectionName}`);
    return fileObj;
  }

  /**
   * @locus Anywhere
   * @memberOf FilesCollection
   * @name removeAsync
   * @param {MeteorFilesSelector} [selector] - Mongo-Style selector (http://docs.meteor.com/api/collections.html#selectors)
   * @throws {Meteor.Error} If cursor is empty
   * @summary Remove documents from the collection
   * @returns {Promise<Number>} number of matched and removed files/records
   */
  async removeAsync(selector) {
    this._debug(`[FilesCollection] [removeAsync(${JSON.stringify(selector)})]`);
    if (selector === void 0) {
      return 0;
    }

    const files = this.find(selector);
    const count = await files.countDocuments();

    if (count > 0) {
      if (this.onAfterRemove) {
        const docs = await files.fetchAsync();
        await this.collection.removeAsync(selector);

        if (!(await this.onAfterRemove(docs))) {
          let i = 0;
          for (; i < docs.length; i++) {
            await this.unlinkAsync(docs[i]);
          }
        }
      } else {
        await files.forEachAsync(async (file) => {
          await this.unlinkAsync(file);
        });
        await this.collection.removeAsync(selector);
      }
    }

    return count;
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
   * @summary Shorthand for Mongo.Collection deny method
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
   * @summary Shorthand for Mongo.Collection allow method
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
   * @param {fileObj} fileRef - fileObj
   * @param {string} [version] - [Optional] file's version
   * @param {function} [callback] - [Optional] callback function
   * @summary Unlink files and it's versions from FS
   * @deprecated since v3.0.0. use {@link FilesCollection#unlinkAsync} instead.
   * @returns {FilesCollection} Instance
   */
  unlink(fileRef, version, callback) {
    this._debug(`[FilesCollection] [unlink(${fileRef._id}, ${version})]`);
    Meteor.deprecate('FilesCollection#unlink() is deprecated! Use `unlinkAsync` instead');
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
   * @name unlinkAsync
   * @param {fileObj} fileRef - fileObj
   * @param {string} [version] - file's version
   * @summary Remove files and all it's versions from FS, or only particular version of `version` param is passed
   * @returns {Promise<FilesCollection>} Instance
   */
  async unlinkAsync(fileRef, version) {
    this._debug(`[FilesCollection] [unlinkAsync(${fileRef._id}, ${version})]`);
    if (version) {
      if (helpers.isObject(fileRef.versions) && helpers.isObject(fileRef.versions[version]) && fileRef.versions[version].path) {
        await fs.promises.unlink(fileRef.versions[version].path);
      }
    } else {
      if (helpers.isObject(fileRef.versions)) {
        for(let vKey in fileRef.versions) {
          if (fileRef.versions[vKey] && fileRef.versions[vKey].path) {
            try {
              await fs.promises.unlink(fileRef.versions[vKey].path);
            } catch (unlinkError) {
              this._debug('[FilesCollection] [unlinkAsync] [versions] Caught silent error', unlinkError);
            }
          }
        }
      } else {
        try {
          await fs.promises.unlink(fileRef.path);
        } catch (unlinkError) {
          this._debug('[FilesCollection] [unlinkAsync] Caught silent error', unlinkError);
        }
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
   * @param {ContextHTTP} http - Server HTTP object
   * @param {string} version - Requested file version
   * @param {fileObj} fileRef - Requested file Object
   * @summary Initiates the HTTP response
   * @returns {Promise<undefined>}
   */
  async download(http, version = 'original', fileRef) {
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
      if (helpers.isFunction(this.downloadCallback) && !(await this.downloadCallback(Object.assign(http, this._getUser(http)), fileRef))) {
        return this._404(http);
      }

      if (this.interceptDownload && helpers.isFunction(this.interceptDownload) && (await this.interceptDownload(http, fileRef, version)) === true) {
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

      return this.serve(http, fileRef, vRef, version, null, responseType || '200');
    }
    return this._404(http);
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name serve
   * @param {ContextHTTP} http - Server HTTP object
   * @param {fileObj} fileRef - Requested file Object
   * @param {Object} vRef - Requested file version Object
   * @param {string} version - Requested file version
   * @param {stream.Readable|null} readableStream - Readable stream, which serves binary file data
   * @param {string} responseType - Response code
   * @param {boolean} force200 - Force 200 response code over 206
   * @summary Handle and reply to incoming request
   * @returns {undefined}
   */
  serve(http, fileRef, vRef, version = 'original', readableStream = null, _responseType = '200', force200 = false) {
    let partial = false;
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
      partial = true;
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

    if (partial || (http.params?.query?.play && (http.params.query.play === 'true'))) {
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
          } catch (_closeStreamError) {
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
      const text = 'Content-Length mismatch!';

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
      respond(readableStream || fs.createReadStream(vRef.path, { start: reqRange.start, end: reqRange.end }), 206);
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

export { FilesCollection, WriteStream, helpers };
