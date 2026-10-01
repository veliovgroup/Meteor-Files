import { Mongo } from 'meteor/mongo';
import { fetch } from 'meteor/fetch';
import { WebApp } from 'meteor/webapp';
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { Cookies } from 'meteor/ostrio:cookies';
import { check, Match } from 'meteor/check';

import WriteStream, { fileIdentity, isSameFile } from './write-stream.js';
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
 * @const {number} MAX_CHUNK_SIZE - Largest accepted upload chunk, in bytes (16 MiB)
 */
const MAX_CHUNK_SIZE = 16 * 1024 * 1024;

/**
 * @const {number} MAX_META_BODY_SIZE - Largest accepted HTTP body for upload start requests, in bytes (1 MiB)
 */
const MAX_META_BODY_SIZE = 1024 * 1024;

/**
 * @const {number} MAX_EOF_BODY_SIZE - Largest accepted HTTP body for EOF requests, in bytes. The body is not used
 */
const MAX_EOF_BODY_SIZE = 64 * 1024;

/**
 * @const {RegExp} TEXT_TYPE_RE - Mime types that are text and need a charset to display non-ASCII characters
 */
const TEXT_TYPE_RE = /^(?:text\/[^;\s]+|application\/json|application\/javascript|image\/svg\+xml)\s*(?:;|$)/i;

/**
 * @function withCharset
 * @param {string} type - Mime type
 * @summary Add `; charset=utf-8` to text mime types without a charset
 * @returns {string}
 */
const withCharset = (type) => {
  if (helpers.isString(type) && TEXT_TYPE_RE.test(type) && !/;\s*charset=/i.test(type)) {
    return `${type.replace(/[;\s]+$/, '')}; charset=utf-8`;
  }
  return type;
};

/**
 * @const {string[]} RESERVED_FILE_KEYS - Keys of client-supplied `file` object the server computes itself
 */
const RESERVED_FILE_KEYS = ['_id', 'fileId', '_downloadRoute', '_collectionName', '_storagePath', 'path', 'versions', 'userId', 'public', 'extension', 'ext', 'extensionWithDot', 'isVideo', 'isAudio', 'isImage', 'isText', 'isJSON', 'isPDF', 'mime', 'mime-type', '__proto__', 'constructor', 'prototype'];

/**
 * Returns `code` if it is an HTTP error status (400-599), otherwise `fallback`
 * @function toHttpErrorCode
 * @param {*} code - Candidate status code
 * @param {number} fallback - Status code to use when `code` is not usable
 * @returns {number}
 */
const toHttpErrorCode = (code, fallback) => {
  return (Number.isInteger(code) && code >= 400 && code <= 599) ? code : fallback;
};

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
 * @param config.debug     {boolean|function}  - [Both]   Turn on/off debugging and extra logging to console, or pass your own function to handle debug messages on your own
 * @param config.schema    {Object}   - [Both]   Collection Schema
 * @param config.public    {boolean}  - [Both]   Store files in folder accessible for proxy servers, for limits, and more - read docs
 * @param config.strict    {boolean}  - [Server] Strict mode for partial content. When `true` (default) the server responds `416` to a `Range` that starts outside of the file. When `false` it ignores such `Range` and responds `200`
 * @param config.protected {function} - [Server] If `true` - files will be served only to authorized users, if `function()` - you're able to check visitor's permissions in your own way function's context has:
 *  - `request`
 *  - `response`
 *  - `userAsync()`
 *  - `userId`
 * @param config.chunkSize      {number}  - [Both] Upload chunk size, default: 524288 bytes (0,5 Mb)
 * @param config.permissions    {number}  - [Server] Permissions which will be set to uploaded files (octal), like: `511` or `0o755`. Default: 0644
 * @param config.parentDirPermissions {number}  - [Server] Permissions which will be set to parent directory of uploaded files (octal), like: `0o611` or `0o777`. Default: 0755
 * @param config.storagePath    {string|function}  - [Server] Storage path on file system. The function can be async
 * @param config.cacheControl   {string}  - [Server] Default `Cache-Control` header
 * @param config.responseHeaders {object|function} - [Server] Custom response headers, if function is passed, must return Object
 * @param config.nosniff        {boolean} - [Server] Send `X-Content-Type-Options: nosniff` header with served files. Default: `true`
 * @param config.uploadIdleTimeout {number} - [Server] Close file handle of an upload after this many ms without new chunks, it is reopened on the next chunk. Default: 900000 (15 minutes)
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
 * @param config.getUser        {function} - [Server] Replace default way of recognizing user, useful when you want to auth user based on custom cookie (or other way). arguments {http: {request: {...}, response: {...}}}, need to return {userId: String, userAsync: Function}
 * @param config.onInitiateUpload {function} - [Server] Function which executes on server right before upload is begin and right after `onBeforeUpload` hook. This hook is fully asynchronous.
 * @param config.onBeforeRemove {function} - [Server] Executes before removing file on server, so you can check permissions. Return `true` to allow physical file removal and `false` to deny.
 * @param config.allowClientCode  {boolean}  - [Both]   Allow to run `remove` from client. Default: `false`
 * @param config.downloadCallback {function} - [Server] Callback triggered each time file is requested, return truthy value to continue download, or falsy to abort
 * @param config.interceptRequest {function} - [Server] Intercept incoming HTTP request, so you can do whatever you want, no checks or preprocessing, argument: http {request, response, params}
 * @param config.interceptDownload {function} - [Server] Intercept download request, so you can serve file from third-party resource, arguments {http: {request: {...}, response: {...}}, fileRef: {...}}
 * @param config.disableUpload {boolean} - Disable file upload, useful for server only solutions
 * @param config.disableDownload {boolean} - Disable file download (serving), useful for file management only solutions
 * @param config.allowedOrigins  {Regex|boolean}  - [Server]   Regex of Origins that are allowed CORS access or `false` to disable completely. Defaults to `/^http:\/\/localhost:12[0-9]{3}$/` for allowing Meteor-Cordova builds access
 * @param config.allowedCordovaOrigins {boolean|RegExp|string} - [Server] Origins allowed to set cookies via `/___cookie___/set` cross-site (Cordova, Meteor-Desktop), passed to `ostrio:cookies`. `true` allows `^http://localhost:12[0-9]{3}$`. Default: value of `allowedOrigins`
 * @param config.allowQueryStringCookies {boolean} - Allow passing Cookies in a query string (in URL). Primarily should be used only in Cordova environment. Note: this option will be used only on Cordova. Default: `false`
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
        allowedCordovaOrigins: this.allowedCordovaOrigins,
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
        nosniff: this.nosniff,
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
        uploadIdleTimeout: this.uploadIdleTimeout,
      } = config);
    }

    const self = this;

    if (!helpers.isBoolean(this.debug) && !helpers.isFunction(this.debug)) {
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
      this.allowClientCode = false;
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

    // EOFs in progress, keyed by fileId: `{ userId, promise }`. A repeated EOF waits for the first one
    this._finishingUploads = new Map();

    if (!helpers.isFunction(this.downloadCallback)) {
      this.downloadCallback = false;
    }

    if (!helpers.isNumber(this.continueUploadTTL)) {
      this.continueUploadTTL = 10800;
    }

    if (!helpers.isFunction(this.sanitize)) {
      this.sanitize = helpers.sanitize;
    }

    if (this.nosniff === void 0) {
      this.nosniff = true;
    }

    if (this.uploadIdleTimeout === void 0) {
      this.uploadIdleTimeout = 900000;
    }

    if (!helpers.isFunction(this.responseHeaders) && !helpers.isObject(this.responseHeaders)) {
      this.responseHeaders = (responseCode, _fileObj, versionRef) => {
        const headers = {};
        switch (responseCode) {
        case '206':
          headers.Pragma = 'private';
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
        headers['Content-Type'] = withCharset(versionRef.type || 'application/octet-stream');
        headers['Accept-Ranges'] = 'bytes';
        return headers;
      };
    }

    if (this.public && !storagePath) {
      throw new Meteor.Error(500, `[FilesCollection.${this.collectionName}] "storagePath" must be set on "public" collections! Note: "storagePath" must be equal or be inside of your web/proxy-server (absolute) root.`);
    }

    if (!storagePath) {
      storagePath = function () {
        return `assets${nodePath.sep}app${nodePath.sep}uploads${nodePath.sep}${self.collectionName}`;
      };
    }

    if (helpers.isString(storagePath)) {
      const normalizedStoragePath = nodePath.normalize(storagePath).replace(/(.)[\/\\]+$/, '$1');
      this.storagePath = () => normalizedStoragePath;
    } else {
      const normalizeStoragePath = (sp) => {
        if (!helpers.isString(sp)) {
          throw new Meteor.Error(400, `[FilesCollection.${self.collectionName}] "storagePath" function must return a String!`);
        }
        return nodePath.normalize(sp.replace(/\/$/, ''));
      };

      // Returns a String, or a Promise of a String when the function is async
      this.storagePath = function () {
        const sp = storagePath.apply(self, arguments);
        return helpers.isFunction(sp?.then) ? sp.then(normalizeStoragePath) : normalizeStoragePath(sp);
      };
    }

    const initialStoragePath = this.storagePath({});
    if (helpers.isFunction(initialStoragePath?.then)) {
      // Async `storagePath` may depend on the file, so the directory is created per upload.
      // Creating the directory for an empty file is best effort and never throws
      initialStoragePath.then((dir) => {
        this._debug('[FilesCollection.storagePath] Set to:', dir);
        return fs.promises.mkdir(dir, { mode: this.parentDirPermissions, recursive: true });
      }).catch((error) => {
        this._debug('[FilesCollection.storagePath] Skipped creating the directory for an empty file object:', error);
      });
    } else {
      this._debug('[FilesCollection.storagePath] Set to:', initialStoragePath);

      try {
        fs.mkdirSync(initialStoragePath, {
          mode: this.parentDirPermissions,
          recursive: true
        });
      } catch (error) {
        if (error) {
          throw new Meteor.Error(401, `[FilesCollection.${self.collectionName}] Path "${initialStoragePath}" is not writable!`, error);
        }
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
    check(this.nosniff, Boolean);
    check(this.uploadIdleTimeout, Number);
    /* eslint-disable new-cap */
    check(this.onAfterRemove, Match.OneOf(false, Function));
    check(this.onAfterUpload, Match.OneOf(false, Function));
    check(this.onBeforeRemove, Match.OneOf(false, Function));
    check(this.downloadCallback, Match.OneOf(false, Function));
    check(this.interceptRequest, Match.OneOf(false, Function));
    check(this.interceptDownload, Match.OneOf(false, Function));
    check(this.responseHeaders, Match.OneOf(Object, Function));
    check(this.allowedOrigins, Match.OneOf(Boolean, RegExp));
    check(this.allowedCordovaOrigins, Match.Optional(Match.OneOf(Boolean, RegExp, String)));
    /* eslint-enable new-cap */

    this._cookies = new Cookies({
      allowQueryStringCookies: this.allowQueryStringCookies,
      allowedCordovaOrigins: this.allowedCordovaOrigins ?? this.allowedOrigins
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

      createIndex(this._preCollection, { createdAt: 1 }, { expireAfterSeconds: this.continueUploadTTL, background: true }).catch((indexError) => {
        this._debug(`[FilesCollection] [createIndex] Can not create TTL index on "${this._preCollectionName}"`, indexError);
      });
      // Start checks if a pending upload already claims the target path
      createIndex(this._preCollection, { path: 1 }, { background: true }).catch((indexError) => {
        this._debug(`[FilesCollection] [createIndex] Can not create path index on "${this._preCollectionName}"`, indexError);
      });
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
          const upload = self._currentUploads[doc._id];
          if (helpers.isObject(upload) && !upload.ended && !upload.aborted) {
            // We can be unlucky to run into a race condition where another server removed this document before the change of `isFinished` is registered on this server.
            // Therefore it's better to double-check with the main collection if the file is referenced there. Issue: https://github.com/veliovgroup/Meteor-Files/issues/672
            if (!doc.isFinished && (await self.collection.countDocuments({ _id: doc._id })) === 0) {
              self._debug(`[FilesCollection] [_preCollectionCursor.observe] [removeUnfinishedUpload]: ${doc._id}`);
              await upload.abort();
            } else {
              await upload.end();
            }
          }
          delete self._currentUploads[doc._id];
        }
      });

      this._resumingUploads = {};

      // Creates and initializes WriteStream, does not register it in `_currentUploads`
      this._createStream = async (_id, path, opts, streamOpts = {}) => {
        const stream = new WriteStream(path, opts.fileLength, opts, this.permissions, this.parentDirPermissions, {
          fileId: _id,
          idleTimeout: this.uploadIdleTimeout,
          identity: opts.fileIdentity,
          onAbort: async () => {
            // Aborted upload can not be continued, drop its record
            await this._preCollection.removeAsync({ _id });
          },
          ...streamOpts,
        });
        return await stream.init();
      };

      // This little function allows to continue upload
      // even after server is restarted (*not on dev-stage*)
      // When `userId` is passed, upload owned by another user is rejected with 403 before any file is opened
      this._continueUpload = async (_id, userId) => {
        const checkOwner = (record) => {
          if (userId !== void 0 && (record.userId ?? null) !== (userId ?? null)) {
            throw new Meteor.Error(403, 'Upload belongs to another user');
          }
        };

        const upload = this._currentUploads[_id];
        if (upload && upload.file) {
          if (!upload.aborted && !upload.ended) {
            checkOwner(upload.file);
            return upload.file;
          }
          // Finished or aborted upload can not receive more data
          return false;
        }

        // One WriteStream per upload: concurrent requests wait for the same reconstruction
        if (!this._resumingUploads[_id]) {
          this._resumingUploads[_id] = (async () => {
            const contUpld = await this._preCollection.findOneAsync({_id});
            if (!contUpld || contUpld.isFinished || !helpers.isString(contUpld.path)) {
              return false;
            }

            checkOwner(contUpld);
            if (!helpers.isObject(contUpld.fileIdentity)) {
              // Record from an older version, the file can not be verified
              throw new Meteor.Error(410, 'Upload can not be resumed. Start upload again.');
            }

            let stream;
            try {
              stream = await this._createStream(_id, contUpld.path, contUpld, { exclusive: false });
            } catch (streamError) {
              if (streamError?.error === 409 || streamError?.error === 410) {
                // File is gone or replaced: drop the upload, do not touch the file
                await this._preCollection.removeAsync({ _id });
                throw new Meteor.Error(streamError.error, streamError.error === 409 ? 'Upload file was replaced. Start upload again.' : 'Upload file is gone. Start upload again.');
              }
              throw streamError;
            }

            const activeUpload = this._currentUploads[_id];
            if (activeUpload && !activeUpload.ended && !activeUpload.aborted) {
              // Another stream registered meanwhile, keep it and close this one without touching the file
              await stream.stop(true);
              return activeUpload.file;
            }

            this._currentUploads[_id] = stream;
            return stream.file;
          })().finally(() => {
            delete this._resumingUploads[_id];
          });
        }

        const record = await this._resumingUploads[_id];
        if (record) {
          checkOwner(record);
        }
        return record;
      };
    }


    if (!this.schema) {
      this.schema = FilesCollectionCore.schema;
    }

    // eslint-disable-next-line new-cap
    check(this.debug, Match.OneOf(Boolean, Function));
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

    if (!this.disableUpload && this.allowClientCode && !this.onBeforeRemove) {
      // eslint-disable-next-line no-console
      console.warn(`[FilesCollection.${this.collectionName}] "allowClientCode" is on and "onBeforeRemove" is not set: any client can remove files. Set "onBeforeRemove" or remove "allowClientCode: true".`);
    }

    this._checkAccess = async (http) => {
      if (!this.protected) {
        return true;
      }

      if (!helpers.isObject(http)) {
        this._debug('[FilesCollection._checkAccess] WARN: Access denied, no HTTP context');
        return false;
      }

      let result;
      const {userAsync, userId} = this._getUser(http);

      if (helpers.isFunction(this.protected)) {
        let fileObj;
        if (helpers.isObject(http.params) && http.params._id) {
          fileObj = await this.collection.findOneAsync(http.params._id);
        }

        result = await this.protected.call(Object.assign(http, {userAsync, userId}), (fileObj || null));
      } else {
        result = !!userId;
      }

      if (result === true) {
        return true;
      }

      const rc = toHttpErrorCode(result, 401);
      this._debug('[FilesCollection._checkAccess] WARN: Access denied!');
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

      return false;
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
    (WebApp.handlers || WebApp.connectHandlers).use(async (httpReq, httpResp, next) => {
      const { pathname, query } = this._parseRequestUrl(httpReq);

      if (this.allowedOrigins && pathname.startsWith(`${this.downloadRoute}/`) && !httpResp.headersSent) {
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

      if (pathname === `${this.downloadRoute}/${this.collectionName}/__upload`) {
        if (this.disableUpload) {
          next();
          return;
        }

        if (httpReq.method !== 'POST') {
          next();
          return;
        }

        await this._handleHttpUpload(httpReq, httpResp);
        return;
      }

      if (this.disableDownload) {
        next();
        return;
      }

      // Errors thrown by hooks, `download()` or `serve()` must not leave the request hanging
      const handleDownloadError = (error) => {
        this._debug(`[FilesCollection] [download] [${pathname}] Error:`, error);
        if (!httpResp.headersSent) {
          const text = 'Internal Server Error';
          httpResp.writeHead(500, {
            'Content-Type': 'text/plain',
            'Content-Length': text.length
          });
          httpResp.end(text);
        } else if (!httpResp.writableEnded) {
          httpResp.destroy();
        }
      };

      if (this.public) {
        // HANDLE FILES UPLOADED TO DIRECTORY ACCESSIBLE BY WEB SERVER
        // AND/OR WITHOUT PERMISSION CONTROL
        if (!pathname.startsWith(`${this.downloadRoute}/`)) {
          next();
          return;
        }

        const uris = pathname.substring(this.downloadRoute.length + 1).split('/');
        const _file = uris[uris.length - 1];
        if (!_file) {
          next();
          return;
        }

        // Versioned files are served as `${version}-${_id}.${ext}`, original as `${_id}.${ext}`
        let version = 'original';
        let fileName = _file;
        const dashIndex = _file.indexOf('-');
        if (dashIndex > 0) {
          version = _file.substring(0, dashIndex);
          fileName = _file.substring(dashIndex + 1);
        }

        const params = {
          query: query ? nodeQs.parse(query) : {},
          file: fileName,
          _id: fileName.split('.')[0],
          version,
          name: fileName
        };
        const http = {request: httpReq, response: httpResp, params};

        try {
          // CHECK IF SETUP HAS CUSTOM FUNCTION TO SERVE UPLOADED FILES VIA `interceptRequest`
          if (this.interceptRequest && helpers.isFunction(this.interceptRequest) && (await this.interceptRequest(http)) === true) {
            return;
          }

          let fileRef = await this.collection.findOneAsync(params._id);
          if (!fileRef && dashIndex > 0) {
            // `_id` itself may contain "-"
            const fullId = _file.split('.')[0];
            fileRef = await this.collection.findOneAsync(fullId);
            if (fileRef) {
              params.version = version = 'original';
              params.file = params.name = _file;
              params._id = fullId;
            }
          }
          await this.download(http, version, fileRef);
        } catch (downloadError) {
          handleDownloadError(downloadError);
        }
        return;
      }

      // HANDLE FILES UPLOADED TO OBFUSCATED STORAGE WITH PERMISSION CONTROL
      if (!pathname.startsWith(`${this.downloadRoute}/${this.collectionName}/`)) {
        next();
        return;
      }

      const uris = pathname.substring(`${this.downloadRoute}/${this.collectionName}/`.length).split('/');
      if (uris.length !== 3) {
        next();
        return;
      }

      const params = {
        _id: uris[0],
        query: query ? nodeQs.parse(query) : {},
        name: uris[2],
        version: uris[1]
      };

      const http = {request: httpReq, response: httpResp, params};

      try {
        // CHECK IF SETUP HAS CUSTOM FUNCTION TO SERVE UPLOADED FILES VIA `interceptRequest`
        if (this.interceptRequest && helpers.isFunction(this.interceptRequest) && (await this.interceptRequest(http)) === true) {
          return;
        }

        if (await this._checkAccess(http)) {
          await this.download(http, uris[1], await this.collection.findOneAsync(uris[0]));
        }
      } catch (downloadError) {
        handleDownloadError(downloadError);
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
      // One file per call: a client can not pass a query selector
      check(selector, String);
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

      const result = await self._startUpload(opts, this.userId, 'DDP Start Method');

      if (returnMeta) {
        return {
          status: 204,
          uploadRoute: `${self.downloadRoute}/${self.collectionName}/__upload`,
          file: self._toClientFileObj(result),
        };
      }
      return { status: 204 };
    };


    // Method used to write file chunks
    // it receives very limited amount of meta-data
    // This method also responsible for EOF
    _methods[this._methodNames._Write] = async function (opts) {
      /* eslint-disable new-cap */
      check(opts, {
        eof: Match.Optional(Boolean),
        fileId: String,
        binData: Match.Optional(String),
        chunkId: Match.Optional(Number)
      });
      /* eslint-enable new-cap */

      self._debug('[FilesCollection] [Write Method] Chunk received', opts.fileId);

      const result = await self._writeUpload({
        eof: opts.eof === true,
        fileId: self.sanitize(opts.fileId, 20, 'a'),
        binData: opts.binData ? Buffer.from(opts.binData, 'base64') : void 0,
        chunkId: opts.chunkId,
      }, this.userId, 'DDP', () => this.unblock());

      if (result) {
        return Object.assign(self._toClientFileObj(result), { status: 200 });
      }
      return { status: 204 };
    };

    // Method used to Abort upload
    // - Freeing memory by ending writableStreams
    // - Removing temporary record from @_preCollection
    // - .unlink()ing partially written file from FS
    // Only the user who started the upload can abort it
    _methods[this._methodNames._Abort] = async function (_id) {
      check(_id, String);
      this.unblock();
      const fileId = self.sanitize(_id, 20, 'a');
      self._debug(`[FilesCollection] [Abort Method]: ${fileId}`);

      const contUpld = await self._preCollection.findOneAsync({ _id: fileId });
      if (!contUpld || (contUpld.userId ?? null) !== (this.userId ?? null)) {
        throw new Meteor.Error(404, 'Upload not found');
      }

      const upload = self._currentUploads[fileId];
      if (upload) {
        if (!upload.ended && !upload.aborted) {
          await upload.abort();
        }
      } else {
        // No stream in memory (server restart): remove the partial file, but only the file this upload created
        await self._removePartialFile(contUpld);
      }

      await self._preCollection.removeAsync({ _id: fileId });
      return { status: 499 };
    };

    Meteor.methods(_methods);
  }


  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name findOne
   * @summary Not available on the server, where collections are async only
   * @throws {Meteor.Error} 404, always. Use `findOneAsync()`
   */
  findOne() {
    throw new Meteor.Error(404, 'FilesCollection#findOne() is not available on the server! Use .findOneAsync() instead');
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name _parseRequestUrl
   * @param {IncomingMessage} httpReq - Incoming request
   * @summary Internal method. Returns `pathname` (without querystring) and raw `query` of the request
   * @returns {{pathname: string, query: string}}
   */
  _parseRequestUrl(httpReq) {
    if (helpers.isObject(httpReq._parsedUrl) && helpers.isString(httpReq._parsedUrl.pathname)) {
      return {
        pathname: httpReq._parsedUrl.pathname,
        query: httpReq._parsedUrl.query || ''
      };
    }

    try {
      const url = new URL(httpReq.url || '/', 'http://localhost');
      return { pathname: url.pathname, query: url.search.replace(/^\?/, '') };
    } catch (_urlError) {
      return { pathname: '', query: '' };
    }
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name _isPathInside
   * @param {string} root - Directory
   * @param {string} target - Path to check
   * @summary Internal method. Check that `target` resolves to a path inside of `root` directory (not `root` itself)
   * @returns {boolean}
   */
  _isPathInside(root, target) {
    if (!helpers.isString(root) || !helpers.isString(target) || !root || !target) {
      return false;
    }

    const relative = nodePath.relative(nodePath.resolve(root), nodePath.resolve(target));
    return !!relative && relative !== '..' && !relative.startsWith(`..${nodePath.sep}`) && !nodePath.isAbsolute(relative);
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name _sanitizeFSName
   * @param {*} name - Value returned from `namingFunction`
   * @param {string} fallback - Name to use when `name` is empty
   * @summary Internal method. Sanitize every `/`-separated segment of `namingFunction` result, drop `.` and `..` segments. Nested directories are kept
   * @returns {string}
   */
  _sanitizeFSName(name, fallback) {
    if (!helpers.isString(name)) {
      return fallback;
    }

    const segments = name.split(/[\\/]+/)
      .filter((segment) => segment && segment !== '.' && segment !== '..')
      .map((segment) => this.sanitize(segment, 255, '-'))
      .filter((segment) => segment && segment !== '.' && segment !== '..');

    return segments.length ? segments.join(nodePath.sep) : fallback;
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name _pickClientFileFields
   * @param {Object} file - Client-supplied `file` object
   * @summary Internal method. Deep copy of client `file` object without keys the server computes itself
   * @returns {Object}
   */
  _pickClientFileFields(file) {
    const picked = {};
    if (!helpers.isObject(file)) {
      return picked;
    }

    for (const key of Object.keys(file)) {
      if (!RESERVED_FILE_KEYS.includes(key)) {
        picked[key] = helpers.cloneDeep(file[key]);
      }
    }
    return picked;
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name _toClientFileObj
   * @param {Partial<FileObj>} fileObj - File object
   * @summary Internal method. Copy of file object without server file system paths, safe to send to a client
   * @returns {Partial<FileObj>}
   */
  _toClientFileObj(fileObj) {
    const copy = helpers.cloneDeep(fileObj);
    if (!helpers.isObject(copy)) {
      return copy;
    }

    delete copy.path;
    delete copy._storagePath;
    if (helpers.isObject(copy.versions)) {
      for (const version of Object.keys(copy.versions)) {
        if (helpers.isObject(copy.versions[version])) {
          delete copy.versions[version].path;
        }
      }
    }
    return copy;
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name _prepareUpload
   * @summary Internal method. Build file object from upload record and check upload permission via `onBeforeUpload` hook. `onInitiateUpload` runs later, in `_startUpload`
   * @returns {Promise<Object>}
   */
  async _prepareUpload(opts = {}, userId, transport) {
    let ctx;
    const isStart = opts.___s === true;
    if (!helpers.isBoolean(opts.eof)) {
      opts.eof = false;
    }

    if (!helpers.isNumber(opts.chunkId)) {
      opts.chunkId = -1;
    }

    const file = helpers.isObject(opts.file) ? opts.file : {};
    this._debug(`[FilesCollection] [Upload] [${transport}] Got #${opts.chunkId}/${opts.fileLength} chunks, dst: ${file.name || file.fileName}`);

    const fileName = this._getFileName(file);
    const {extension, extensionWithDot} = this._getExt(fileName);

    let result = this._pickClientFileFields(file);
    result.name = fileName;
    result.meta = helpers.isObject(result.meta) ? result.meta : {};
    result.extension = extension;
    result.ext = extension;
    result._id = opts.fileId;
    result.userId = (isStart ? userId : opts.userId) || null;

    if (isStart) {
      let FSName = this.sanitize(helpers.isString(opts.FSName) && opts.FSName ? opts.FSName : opts.fileId);
      if (this.namingFunction) {
        FSName = this._sanitizeFSName(await this.namingFunction(Object.assign({}, opts, { file: result, FSName })), FSName);
      }
      opts.FSName = FSName;

      const storagePath = await this.storagePath(result);
      result._storagePath = storagePath;
      result.path = `${storagePath}${nodePath.sep}${FSName}${extensionWithDot}`;
      if (!this._isPathInside(storagePath, result.path)) {
        this._debug(`[FilesCollection] [Upload] [${transport}] Path is outside of storagePath`, result.path);
        throw new Meteor.Error(400, 'Invalid file name');
      }
    } else {
      // Path and storage path are fixed at the start of the upload, `storagePath` does not run again
      result.path = opts.path || file.path;
      result._storagePath = helpers.isString(opts._storagePath) && opts._storagePath ? opts._storagePath : nodePath.dirname(result.path);
    }

    result = Object.assign(result, this._dataToSchema(result));

    ctx = {
      file: result,
      chunkId: opts.chunkId,
      userId: result.userId,
      async userAsync() {
        if (Meteor.users && result.userId) {
          return await Meteor.users.findOneAsync(result.userId);
        }
        return null;
      },
      eof: opts.eof
    };

    if (this.onBeforeUpload) {
      const isUploadAllowed = await this.onBeforeUpload.call(ctx, result);

      if (isUploadAllowed !== true) {
        throw new Meteor.Error(403, helpers.isString(isUploadAllowed) ? isUploadAllowed : '@onBeforeUpload() returned false');
      }
    }

    return { result, opts, ctx };
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name _startUpload
   * @param {Object} opts - Start request: `{file, fileId, FSName, chunkSize, fileLength}`
   * @param {string|null} userId - Caller's userId
   * @param {string} transport - Transport name, used in logs
   * @summary Internal method. Validate start request, create upload record in `_preCollection` and an empty file on FS
   * @throws {Meteor.Error} 400 on invalid request, 409 if upload or file already exists
   * @returns {Promise<Partial<FileObj>>}
   */
  async _startUpload(opts, userId, transport) {
    const { chunkSize, fileLength } = opts;
    if (!Number.isInteger(chunkSize) || chunkSize < 1 || chunkSize > MAX_CHUNK_SIZE) {
      throw new Meteor.Error(400, 'Invalid chunkSize');
    }

    const size = opts.file?.size;
    // An empty file has no chunk to send, so its upload could never finish
    if (!Number.isInteger(size) || size < 1) {
      throw new Meteor.Error(400, 'Invalid file size');
    }

    if (fileLength !== Math.max(1, Math.ceil(size / chunkSize))) {
      throw new Meteor.Error(400, 'Invalid fileLength');
    }

    const fileId = this.sanitize(opts.fileId, 20, 'a');
    if (!fileId) {
      throw new Meteor.Error(400, 'Invalid fileId');
    }

    if (await this._preCollection.findOneAsync({ _id: fileId })) {
      throw new Meteor.Error(409, 'Upload already exists');
    }

    if (await this.collection.findOneAsync(fileId)) {
      throw new Meteor.Error(400, 'Can\'t start upload, data substitution detected!');
    }

    const { result, opts: prepared, ctx } = await this._prepareUpload({
      file: opts.file,
      fileId,
      FSName: opts.FSName,
      chunkSize,
      fileLength,
      ___s: true,
    }, userId, transport);

    let fileExists = true;
    try {
      await fs.promises.lstat(result.path);
    } catch (statError) {
      fileExists = statError?.code !== 'ENOENT';
    }

    if (fileExists) {
      this._debug(`[FilesCollection] [Upload] [${transport}] File already exists`, result.path);
      throw new Meteor.Error(409, 'File already exists');
    }

    // A pending upload may own this path while its file is temporarily missing
    if (await this._preCollection.findOneAsync({ path: result.path, isFinished: { $ne: true } })) {
      this._debug(`[FilesCollection] [Upload] [${transport}] Path is claimed by another upload`, result.path);
      throw new Meteor.Error(409, 'File already exists');
    }

    const session = {
      _id: fileId,
      fileId,
      file: this._pickClientFileFields(opts.file),
      FSName: prepared.FSName,
      size,
      chunkSize,
      fileLength,
      maxLength: fileLength,
      userId: userId || null,
      path: result.path,
      _storagePath: result._storagePath,
      createdAt: new Date(),
    };

    // Create the file first (O_EXCL), then save the record with the file identity
    let stream;
    try {
      stream = await this._createStream(fileId, result.path, session, { exclusive: true });
    } catch (streamError) {
      this._debug(`[FilesCollection] [Upload] [${transport}] [_createStream] Error:`, streamError);
      if (streamError?.error === 409) {
        throw new Meteor.Error(409, 'File already exists');
      }
      throw new Meteor.Error(500, 'Can\'t start');
    }
    session.fileIdentity = stream.identity;

    const activeUpload = this._currentUploads[fileId];
    if (activeUpload && !activeUpload.ended && !activeUpload.aborted) {
      // Concurrent start with the same id
      stream.onAbort = null;
      await stream.abort();
      throw new Meteor.Error(409, 'Upload already exists');
    }

    // Register the stream before the record is visible, so a concurrent chunk can not build a second stream
    this._currentUploads[fileId] = stream;
    try {
      await this._preCollection.insertAsync(session);
    } catch (insertError) {
      this._debug(`[FilesCollection] [Upload] [${transport}] [_preCollection.insertAsync] Error:`, insertError);
      if (this._currentUploads[fileId] === stream) {
        delete this._currentUploads[fileId];
      }
      // The record may belong to a concurrent start with the same id, keep it
      stream.onAbort = null;
      await stream.abort();
      if (insertError?.code === 11000) {
        throw new Meteor.Error(409, 'Upload already exists');
      }
      throw new Meteor.Error(500, 'Can\'t start');
    }

    if (this.onInitiateUpload) {
      try {
        await this.onInitiateUpload.call(ctx, result);
      } catch (initiateError) {
        // Drops the record via `onAbort` and removes the empty file
        await stream.abort();
        if (this._currentUploads[fileId] === stream) {
          delete this._currentUploads[fileId];
        }
        throw initiateError;
      }
    }

    return result;
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name _getUploadSession
   * @param {string} fileId - Upload id
   * @param {string|null} userId - Caller's userId
   * @summary Internal method. Returns in-progress upload record owned by the caller
   * @throws {Meteor.Error} 408 if upload is unknown or expired, 403 if it belongs to another user, 409 or 410 if its file was replaced or removed
   * @returns {Promise<Object>}
   */
  async _getUploadSession(fileId, userId) {
    const session = fileId ? await this._continueUpload(fileId, userId ?? null) : false;
    if (!session) {
      throw new Meteor.Error(408, 'Can\'t continue upload, session expired. Start upload again.');
    }

    if ((session.userId ?? null) !== (userId ?? null)) {
      throw new Meteor.Error(403, 'Upload belongs to another user');
    }
    return session;
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name _findFinishedUpload
   * @param {string} fileId - Upload id
   * @param {string|null} userId - Caller's userId
   * @summary Internal method. Returns the finished file document with this `_id` uploaded by the same authenticated user, used to answer a repeated EOF. Always `null` for anonymous callers
   * @returns {Promise<Object|null>}
   */
  async _findFinishedUpload(fileId, userId) {
    // Only authenticated callers: anonymous callers can not prove they own a file
    if (!helpers.isString(fileId) || !fileId || !helpers.isString(userId) || !userId) {
      return null;
    }

    const fileObj = await this.collection.findOneAsync({ _id: fileId });
    if (fileObj && fileObj.userId === userId) {
      return fileObj;
    }
    return null;
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name _removePartialFile
   * @param {Object} record - Upload record from `_preCollection`
   * @summary Internal method. Remove the partial file of an unfinished upload that has no stream in memory. Removes it only when its device, inode, and birth time match the stored identity, and never when the upload finished
   * @returns {Promise<boolean>} - `true` if the file was removed
   */
  async _removePartialFile(record) {
    if (!helpers.isObject(record) || record.isFinished || !helpers.isString(record.path) || !helpers.isObject(record.fileIdentity) || !record.fileIdentity.dev || !record.fileIdentity.ino) {
      return false;
    }

    if ((await this.collection.countDocuments({ _id: record._id })) !== 0) {
      // Finished on this or another server, the file is in use
      return false;
    }

    let stats;
    try {
      stats = await fs.promises.lstat(record.path, { bigint: true });
    } catch (_statError) {
      return false;
    }

    if (!isSameFile(fileIdentity(record.fileIdentity), stats)) {
      this._debug(`[FilesCollection] [_removePartialFile] File was replaced, keep it: ${record._id}`);
      return false;
    }

    try {
      await fs.promises.unlink(record.path);
      return true;
    } catch (unlinkError) {
      this._debug(`[FilesCollection] [_removePartialFile] Can not remove partial file of ${record._id}:`, unlinkError?.code);
      return false;
    }
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name _getFinishingUpload
   * @param {string} fileId - Upload id
   * @param {string|null} userId - Caller's userId
   * @summary Internal method. Returns the in-progress EOF of this upload when the caller started the upload, used to answer an EOF that races the first one (DDP reconnect)
   * @returns {Promise<Partial<FileObj>>|null}
   */
  _getFinishingUpload(fileId, userId) {
    const finishing = this._finishingUploads.get(fileId);
    if (finishing && finishing.userId === (userId ?? null)) {
      return finishing.promise;
    }
    return null;
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name _writeUpload
   * @param {Object} opts - `{fileId, eof, chunkId, binData}`, `binData` is a `Buffer`
   * @param {string|null} userId - Caller's userId
   * @param {string} transport - Transport name, used in logs
   * @param {function} [unblock] - Called after permission checks pass
   * @summary Internal method. Write one chunk, or finish upload on EOF. A repeated EOF for an upload the caller already finished returns the stored file object
   * @throws {Meteor.Error} 400 on invalid chunk, 403 on foreign upload, 408 on expired upload, 503 if chunk was not written
   * @returns {Promise<Partial<FileObj>|null>} File object on EOF, `null` after a chunk
   */
  async _writeUpload(opts, userId, transport, unblock) {
    const eof = opts.eof === true;
    const waitForFinishing = (finishing) => {
      this._debug(`[FilesCollection] [Upload] [${transport}] Repeated EOF waits for the first one: ${opts.fileId}`);
      if (helpers.isFunction(unblock)) {
        unblock();
      }
      return finishing;
    };

    if (eof) {
      const finishing = this._getFinishingUpload(opts.fileId, userId);
      if (finishing) {
        return await waitForFinishing(finishing);
      }
    }

    let session;
    try {
      session = await this._getUploadSession(opts.fileId, userId);
    } catch (sessionError) {
      if (eof && sessionError?.error === 408) {
        // The first EOF may have ended the stream while this call waited for the session
        const finishing = this._getFinishingUpload(opts.fileId, userId);
        if (finishing) {
          return await waitForFinishing(finishing);
        }
        // EOF is idempotent: a retried EOF after a lost response gets the finished file of the same user
        const fileObj = await this._findFinishedUpload(opts.fileId, userId);
        if (fileObj) {
          this._debug(`[FilesCollection] [Upload] [${transport}] Repeated EOF for finished upload: ${opts.fileId}`);
          return fileObj;
        }
      }
      throw sessionError;
    }

    if (!eof) {
      if (!Number.isInteger(opts.chunkId) || opts.chunkId < 1 || opts.chunkId > session.fileLength) {
        throw new Meteor.Error(400, 'Invalid chunkId');
      }

      if (!Buffer.isBuffer(opts.binData) || opts.binData.length === 0 || opts.binData.length > session.chunkSize) {
        throw new Meteor.Error(400, 'Invalid chunk size');
      }

      // Last chunk can not grow the file past the declared size
      const declaredSize = Number.isInteger(session.size) ? session.size : session.file?.size;
      if (opts.chunkId === session.fileLength && Number.isInteger(declaredSize) && opts.binData.length > (declaredSize - ((session.fileLength - 1) * session.chunkSize))) {
        throw new Meteor.Error(400, 'Invalid chunk size');
      }
    }

    if (eof) {
      // Checked again after the await above: two EOFs can pass the session check together
      const finishing = this._getFinishingUpload(opts.fileId, userId);
      if (finishing) {
        return await waitForFinishing(finishing);
      }
    }

    const uploadOpts = Object.assign({}, session, {
      fileId: session.fileId || session._id,
      eof,
      chunkId: eof ? -1 : opts.chunkId,
      binData: eof ? void 0 : opts.binData,
    });

    const write = async () => {
      const { result } = await this._prepareUpload(uploadOpts, userId, transport);
      if (helpers.isFunction(unblock)) {
        unblock();
      }

      let isWritten;
      try {
        isWritten = await this._handleUpload(result, uploadOpts);
      } catch (handleUploadError) {
        this._debug(`[FilesCollection] [Upload] [${transport}] [_handleUpload] Exception:`, handleUploadError);
        throw handleUploadError;
      }

      if (!isWritten) {
        throw new Meteor.Error(503, 'Corrupted chunk. Try again');
      }
      return result;
    };

    if (!eof) {
      await write();
      return null;
    }

    const promise = write();
    const finishing = { userId: userId ?? null, promise };
    this._finishingUploads.set(opts.fileId, finishing);
    try {
      return await promise;
    } finally {
      if (this._finishingUploads.get(opts.fileId) === finishing) {
        this._finishingUploads.delete(opts.fileId);
      }
    }
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name _readHttpBody
   * @param {IncomingMessage} httpReq - Incoming request
   * @param {number} limit - Max body size in bytes
   * @summary Internal method. Read request body as UTF-8 string
   * @throws {Meteor.Error} 413 if body is larger than `limit`, 503 on timeout or request error
   * @returns {Promise<string>}
   */
  _readHttpBody(httpReq, limit) {
    return new Promise((resolve, reject) => {
      if (helpers.isObject(httpReq.body) && Object.keys(httpReq.body).length !== 0) {
        const body = JSON.stringify(httpReq.body);
        if (Buffer.byteLength(body) > limit) {
          reject(new Meteor.Error(413, 'Payload Too Large'));
        } else {
          resolve(body);
        }
        return;
      }

      const chunks = [];
      let received = 0;
      let isDone = false;

      const onData = (data) => {
        received += data.length;
        if (received > limit) {
          // eslint-disable-next-line no-use-before-define
          finish(new Meteor.Error(413, 'Payload Too Large'));
          return;
        }
        chunks.push(data);
      };

      const onEnd = () => {
        // eslint-disable-next-line no-use-before-define
        finish(null, Buffer.concat(chunks).toString('utf8'));
      };

      const onError = (error) => {
        // eslint-disable-next-line no-use-before-define
        finish(new Meteor.Error(503, 'Request Error. Try again.', error?.code));
      };

      const onClose = () => {
        // eslint-disable-next-line no-use-before-define
        finish(new Meteor.Error(503, 'Request closed. Try again.'));
      };

      const finish = (error, body) => {
        if (isDone) {
          return;
        }
        isDone = true;
        httpReq.removeListener('data', onData);
        httpReq.removeListener('end', onEnd);
        httpReq.removeListener('error', onError);
        httpReq.removeListener('close', onClose);
        if (error) {
          httpReq.pause();
          reject(error);
        } else {
          resolve(body);
        }
      };

      httpReq.setTimeout(26000, () => {
        finish(new Meteor.Error(503, 'Timeout. Try again.'));
      });

      httpReq.on('data', onData);
      httpReq.on('end', onEnd);
      httpReq.on('error', onError);
      httpReq.on('close', onClose);
    });
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name _handleHttpUpload
   * @param {IncomingMessage} httpReq - Incoming request
   * @param {ServerResponse} httpResp - Outgoing response
   * @summary Internal method. Handle upload over HTTP: start (`x-start: 1`), chunk (`x-chunkid`), and EOF (`x-eof: 1`) requests
   * @returns {Promise<void>}
   */
  async _handleHttpUpload(httpReq, httpResp) {
    const respond = (code, payload) => {
      if (!httpResp.headersSent) {
        httpResp.writeHead(code, payload === void 0 ? {} : { 'Content-Type': 'application/json' });
      }

      if (!httpResp.writableEnded) {
        httpResp.end(payload === void 0 ? void 0 : JSON.stringify(payload));
      }
    };

    const handleError = (error) => {
      this._debug('[FilesCollection] [Upload] [HTTP] [handleError]', error);
      let errorCode = 500;
      let reason = 'Internal Server Error';
      let isClientSafe = false;

      if (error instanceof Match.Error || error?.errorType === 'Match.Error') {
        errorCode = 400;
        reason = 'Bad Request';
        isClientSafe = true;
      } else if (helpers.isObject(error) && error.isClientSafe === true) {
        errorCode = toHttpErrorCode(error.error, 500);
        if (errorCode < 500) {
          reason = helpers.isString(error.reason) ? error.reason : 'Bad Request';
          isClientSafe = true;
        } else if (errorCode === 503) {
          reason = 'Service Unavailable. Try again.';
        }
      }

      const payload = { error: errorCode, reason };
      if (isClientSafe) {
        payload.isClientSafe = true;
      }
      respond(errorCode, payload);
    };

    const isStart = httpReq.headers['x-start'] === '1';
    const isEOF = !isStart && httpReq.headers['x-eof'] === '1';
    let user;
    let fileId;
    let limit = MAX_META_BODY_SIZE;

    try {
      user = (await this._getUser({request: httpReq, response: httpResp})) || {};
      if (!isStart) {
        fileId = this.sanitize(`${httpReq.headers['x-fileid'] || ''}`, 20, 'a');
        if (isEOF) {
          // Cheap check before reading any body: the caller's pending upload, or the caller's finished upload (repeated EOF)
          limit = MAX_EOF_BODY_SIZE;
          try {
            await this._getUploadSession(fileId, user.userId);
          } catch (sessionError) {
            if (sessionError?.error !== 408 || !(this._getFinishingUpload(fileId, user.userId) || await this._findFinishedUpload(fileId, user.userId))) {
              throw sessionError;
            }
          }
        } else {
          const session = await this._getUploadSession(fileId, user.userId);
          limit = Math.ceil((session.chunkSize * 4) / 3) + 4096;
        }
      }
    } catch (sessionError) {
      // Reject without reading the body
      httpResp.setHeader('Connection', 'close');
      httpResp.once('finish', () => {
        httpReq.destroy();
      });
      handleError(sessionError);
      return;
    }

    let body;
    try {
      body = await this._readHttpBody(httpReq, limit);
    } catch (bodyError) {
      // Stop receiving the rest of the body
      if (!httpResp.headersSent) {
        httpResp.setHeader('Connection', 'close');
      }
      httpResp.once('finish', () => {
        httpReq.destroy();
      });
      handleError(bodyError);
      return;
    }

    try {
      if (isStart) {
        // START SCENARIO:
        let opts;
        try {
          opts = JSON.parse(body);
        } catch (_jsonErr) {
          throw new Meteor.Error(400, 'Can\'t parse incoming JSON');
        }

        /* eslint-disable new-cap */
        check(opts, {
          file: Object,
          fileId: String,
          FSName: Match.Optional(String),
          chunkSize: Number,
          fileLength: Number,
          returnMeta: Match.Optional(Boolean)
        });
        /* eslint-enable new-cap */

        this._debug(`[FilesCollection] [File Start HTTP] ${opts.file.name || '[no-name]'} - ${opts.fileId}`);
        if (helpers.isObject(opts.file.meta)) {
          opts.file.meta = fixJSONParse(opts.file.meta);
        }

        const result = await this._startUpload(helpers.omit(opts, 'returnMeta'), user.userId, 'HTTP Start Method');

        if (opts.returnMeta) {
          respond(200, {
            uploadRoute: `${this.downloadRoute}/${this.collectionName}/__upload`,
            file: this._toClientFileObj(result)
          });
        } else {
          respond(204);
        }
        return;
      }

      const result = await this._writeUpload({
        fileId,
        eof: isEOF,
        binData: isEOF ? void 0 : Buffer.from(body, 'base64'),
        chunkId: isEOF ? void 0 : Number(httpReq.headers['x-chunkid']),
      }, user.userId, 'HTTP');

      if (isEOF) {
        // FINISH UPLOAD SCENARIO:
        const clientResult = this._toClientFileObj(result);
        if (helpers.isObject(clientResult.meta)) {
          clientResult.meta = fixJSONStringify(clientResult.meta);
        }
        respond(200, clientResult);
        return;
      }

      // CHUNK UPLOAD SCENARIO:
      respond(204);
    } catch (httpRespErr) {
      handleError(httpRespErr);
    }
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name _finishUpload
   * @summary Internal method. Finish upload, add record to MongoDB, and run `onAfterUpload` hook
   * @throws {Error} If record can not be inserted into the collection
   * @returns {Promise<Partial<FileObj>>}
   */
  async _finishUpload(result, opts) {
    this._debug(`[FilesCollection] [_finishUpload] [finish(ing)Upload] -> ${result.path}`);
    await fs.promises.chmod(result.path, this.permissions);
    const { size } = await fs.promises.stat(result.path);
    result.size = size;
    if (helpers.isObject(result.versions) && helpers.isObject(result.versions.original)) {
      result.versions.original.size = size;
    }
    result.type = this._getMimeType(opts.file);
    result.public = this.public;
    this._updateFileTypes(result);

    let _id;
    try {
      _id = await this.collection.insertAsync(helpers.cloneDeep(result));
    } catch (colInsertError) {
      this._debug('[FilesCollection] [_finishUpload] [insert] Error:', colInsertError);
      try {
        await fs.promises.unlink(result.path);
      } catch (unlinkError) {
        this._debug('[FilesCollection] [_finishUpload] [unlink] Error:', unlinkError);
      }
      throw colInsertError;
    }

    if (_id) {
      result._id = _id;
    }

    try {
      await this._preCollection.updateAsync({_id: opts.fileId}, {$set: {isFinished: true}});
    } catch (preUpdateError) {
      this._debug('[FilesCollection] [_finishUpload] [update] Error:', preUpdateError);
    }

    this._debug(`[FilesCollection] [_finishUpload] [finish(ed)Upload] -> ${result.path}`);
    try {
      if (this.onAfterUpload) {
        await this.onAfterUpload.call(this, result);
      }
      this.emit('afterUpload', result);
    } catch (hookError) {
      this._debug('[FilesCollection] [_finishUpload] [onAfterUpload] Error:', hookError);
    }
    return result;
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name _handleUpload
   * @summary Internal method to handle upload process, write chunk to the file or finish the upload on EOF
   * @returns {Promise<boolean>} - `true` if chunk was written as expected
   */
  async _handleUpload(result, opts) {
    const upload = this._currentUploads[result._id];
    if (!upload) {
      return false;
    }

    if (opts.eof) {
      if (await upload.end()) {
        await this._finishUpload(result, opts);
        return true;
      }
      return false;
    }

    return await upload.write(opts.chunkId, opts.binData);
  }

  /**
   * @locus Server
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
   * @locus Server
   * @memberOf FilesCollection
   * @name _getUserId
   * @summary Returns `userId` matching the xmtok token derived from Meteor.server.sessions
   * @returns {string|null}
   */
  _getUserId(xmtok) {
    if (!xmtok || !helpers.isString(xmtok)) {
      return null;
    }

    const sessions = Meteor.server.sessions;
    if (!(sessions instanceof Map)) {
      // Meteor 3 keeps sessions in a Map. Fail loudly if that changes
      throw new Error('Received incompatible type of Meteor.server.sessions');
    }

    const session = sessions.get(xmtok);
    return helpers.isObject(session) ? (session.userId || null) : null;
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name _getUser
   * @summary Returns object with `userId` and `userAsync()` method which return user's object
   * @returns {Object}
   */
  _getUser() {
    return this.getUser ? this.getUser(...arguments) : this._getUserDefault(...arguments);
  }

  /**
   * @locus Server
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
        if (cookie && helpers.isFunction(cookie.has) && cookie.has('x_mtok')) {
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
   * @name writeAsync
   * @param {Buffer} buffer - Binary File's Buffer
   * @param {WriteOpts} [opts] - Object with file-data
   * @param {string} opts.name - File name, alias: `fileName`
   * @param {string} opts.type - File mime-type
   * @param {Object} opts.meta - File additional meta-data
   * @param {string} opts.userId - UserId, default *null*
   * @param {string} opts.fileId - _id, sanitized, max-length: 20; default *null*
   * @param {boolean} proceedAfterUpload - Proceed onAfterUpload hook
   * @summary Write buffer to FS and add to FilesCollection Collection
   * @throws {Meteor.Error} If there is an error writing the file or inserting the document, 409 if a file with `opts.fileId` already exists
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
    if (opts.fileId && (await this.collection.countDocuments({ _id: fileId }, { limit: 1 })) > 0) {
      throw new Meteor.Error(409, `[FilesCollection] [writeAsync] File with _id "${fileId}" already exists`);
    }

    const fsName = this.namingFunction ? this._sanitizeFSName(await this.namingFunction(opts), fileId) : fileId;
    const fileName = (opts.name || opts.fileName) ? (opts.name || opts.fileName) : fsName;

    const {extension, extensionWithDot} = this._getExt(fileName);

    const storagePath = await this.storagePath(opts);
    opts.path = `${storagePath}${nodePath.sep}${fsName}${extensionWithDot}`;
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
      extension,
      _storagePath: storagePath
    });

    result._id = fileId;

    let fileObj;
    let fh;
    try {
      await fs.promises.mkdir(nodePath.dirname(opts.path), { recursive: true, mode: this.parentDirPermissions });
      fh = await fs.promises.open(opts.path, 'w', this.permissions);
      await fh.writeFile(buffer);
      await fh.datasync();
    } catch (openWriteErr) {
      this._debug(`[FilesCollection] [writeAsync] [open] [write] Error: ${fileName} -> ${this.collectionName}`, openWriteErr);
      throw new Meteor.Error('writeAsync', openWriteErr);
    } finally {
      try {
        await fh?.close();
      } catch (closeError) {
        this._debug(`[FilesCollection] [writeAsync] [close] Error: ${fileName} -> ${this.collectionName}`, closeError);
      }
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
   * @param {number} opts.timeout - Timeout in milliseconds to wait for response headers, default: 360000 (6 mins)
   * @param {boolean} [proceedAfterUpload] - Proceed onAfterUpload hook
   * @summary Download file over HTTP, write stream to FS, and add to FilesCollection Collection
   * @throws {Meteor.Error} 408 on timeout, 409 if a file with `opts.fileId` already exists
   * @returns {Promise<FileObj>} File Object from DB
   */
  async loadAsync(url, _opts = {}, _proceedAfterUpload = false) {
    this._debug(`[FilesCollection] [loadAsync(${url})]`);
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
    if (opts.fileId && (await this.collection.countDocuments({ _id: fileId }, { limit: 1 })) > 0) {
      throw new Meteor.Error(409, `[FilesCollection] [loadAsync] File with _id "${fileId}" already exists`);
    }

    const fsName = this.namingFunction ? this._sanitizeFSName(await this.namingFunction(opts), fileId) : fileId;
    const pathParts = url.split('/');
    const fileName = (opts.name || opts.fileName) ? (opts.name || opts.fileName) : pathParts[pathParts.length - 1].split('?')[0] || fsName;

    const {extension, extensionWithDot} = this._getExt(fileName);
    const storagePath = await this.storagePath(opts);
    opts.path = `${storagePath}${nodePath.sep}${fsName}${extensionWithDot}`;

    let fileObj;
    let isFileCreated = false;
    const controller = new AbortController();
    let timer = null;

    try {
      if (opts.timeout > 0) {
        timer = setTimeout(() => {
          controller.abort();
        }, opts.timeout);
      }

      let res;
      try {
        res = await fetch(url, {
          headers: opts.headers || {},
          signal: controller.signal
        });
      } catch (fetchError) {
        if (controller.signal.aborted) {
          throw new Meteor.Error(408, `Request timeout after ${opts.timeout}ms`);
        }
        throw fetchError;
      } finally {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      }

      if (!res.ok) {
        throw new Meteor.Error(res.status, `Unexpected response ${res.statusText}`);
      }

      await fs.promises.mkdir(nodePath.dirname(opts.path), { recursive: true, mode: this.parentDirPermissions });
      const wStream = fs.createWriteStream(opts.path, { flags: 'w', mode: this.permissions });
      isFileCreated = true;
      await pipeline(res.body, wStream);

      // Content-Length is wrong for compressed responses, use size on disk
      const { size } = await fs.promises.stat(opts.path);
      const result = this._dataToSchema({
        name: fileName,
        path: opts.path,
        meta: opts.meta,
        type: opts.type || res.headers.get('content-type') || this._getMimeType({path: opts.path}),
        size,
        userId: opts.userId,
        extension,
        _storagePath: storagePath
      });

      result._id = fileId;
      const _id = await this.collection.insertAsync(result);
      fileObj = await this.collection.findOneAsync(_id);
      this._debug(`[FilesCollection] [load] [insert] ${fileName} -> ${this.collectionName}`);
    } catch (error) {
      this._debug(`[FilesCollection] [loadAsync] [fetch(${url})] Error:`, error);

      if (isFileCreated) {
        try {
          await fs.promises.unlink(opts.path);
        } catch (unlinkError) {
          this._debug(`[FilesCollection] [loadAsync] [unlink(${url})] Error:`, unlinkError);
        }
      }

      throw error;
    }

    if (proceedAfterUpload === true) {
      if (this.onAfterUpload){
        await this.onAfterUpload.call(this, fileObj);
      }
      this.emit('afterUpload', fileObj);
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
   * @param {string} opts.fileId   - [Optional] _id, sanitized, max-length: 20 symbols default *null*
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
      opts.fileName = nodePath.basename(path);
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
      _storagePath: nodePath.dirname(path),
      fileId: (opts.fileId && this.sanitize(opts.fileId, 20, 'a')) || null,
    });

    let _id;
    try {
      _id = await this.collection.insertAsync(result);
    } catch (insertErr) {
      this._debug(`[FilesCollection] [addFile] [insertAsync] Error: ${result.name} -> ${this.collectionName}`, insertErr);
      throw new Meteor.Error(insertErr.code, insertErr.message);
    }

    const fileObj = await this.collection.findOneAsync(_id);

    if (proceedAfterUpload === true) {
      this.onAfterUpload && await this.onAfterUpload.call(this, fileObj);
      this.emit('afterUpload', fileObj);
    }
    this._debug(`[FilesCollection] [addFile]: ${result.name} -> ${this.collectionName}`);
    return fileObj;
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name removeAsync
   * @param {MeteorFilesSelector} [selector] - Mongo-Style selector (http://docs.meteor.com/api/collections.html#selectors)
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
   * @summary Shorthand for Mongo.Collection allow method. Warning: clients can then edit `path` and `versions.*.path`, which downloads and `unlinkAsync()` trust
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
   * @summary Unlink files and its versions from FS
   * @deprecated since v3.0.0. use {@link FilesCollection#unlinkAsync} instead.
   * @returns {FilesCollection} Instance
   */
  unlink(fileRef, version, _callback) {
    this._debug(`[FilesCollection] [unlink(${fileRef._id}, ${version})]`);
    Meteor.deprecate('FilesCollection#unlink() is deprecated! Use `unlinkAsync` instead');
    // A file that is already gone counts as removed
    const callback = (error) => {
      if (error?.code === 'ENOENT') {
        this._debug(`[FilesCollection] [unlink] File is already removed: ${error.path}`);
        (_callback || noop)(null);
        return;
      }
      (_callback || noop)(error);
    };
    if (version) {
      if (helpers.isObject(fileRef.versions) && helpers.isObject(fileRef.versions[version]) && fileRef.versions[version].path) {
        fs.unlink(fileRef.versions[version].path, callback);
      }
    } else {
      if (helpers.isObject(fileRef.versions)) {
        for(let vKey in fileRef.versions) {
          if (fileRef.versions[vKey] && fileRef.versions[vKey].path) {
            fs.unlink(fileRef.versions[vKey].path, callback);
          }
        }
      } else {
        fs.unlink(fileRef.path, callback);
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
   * @summary Remove files and all its versions from FS, or only particular version if `version` param is passed. Paths stored in the document are trusted, so do not let clients edit documents (see `allowClient()`)
   * @returns {Promise<FilesCollection>} Instance
   */
  async unlinkAsync(fileRef, version) {
    this._debug(`[FilesCollection] [unlinkAsync(${fileRef._id}, ${version})]`);
    if (version) {
      if (helpers.isObject(fileRef.versions) && helpers.isObject(fileRef.versions[version]) && fileRef.versions[version].path) {
        await this._unlinkFile(fileRef.versions[version].path, `[${version}]`);
      }
    } else {
      if (helpers.isObject(fileRef.versions)) {
        for(let vKey in fileRef.versions) {
          if (fileRef.versions[vKey] && fileRef.versions[vKey].path) {
            await this._unlinkFile(fileRef.versions[vKey].path, '[versions]');
          }
        }
      } else {
        await this._unlinkFile(fileRef.path, '');
      }
    }
    return this;
  }

  /**
   * @locus Server
   * @memberOf FilesCollection
   * @name _unlinkFile
   * @param {string} path - File path
   * @param {string} label - Log label
   * @summary Internal method. Remove a file, a file that is already gone counts as removed. Never throws
   * @returns {Promise<void>}
   */
  async _unlinkFile(path, label) {
    try {
      await fs.promises.unlink(path);
    } catch (unlinkError) {
      if (unlinkError?.code === 'ENOENT') {
        this._debug(`[FilesCollection] [unlinkAsync] ${label}${label ? ' ' : ''}File is already removed: ${path}`);
        return;
      }
      this._debug(`[FilesCollection] [unlinkAsync] ${label}${label ? ' ' : ''}Caught silent error`, unlinkError);
    }
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
   * @name _parseRange
   * @param {string} rangeHeader - Value of `Range` request header
   * @param {number} size - File size in bytes
   * @summary Internal method. Parse single `bytes=` range
   * @returns {{start: number, end: number}|false|null} - Range, `false` if range can not be satisfied, `null` if header must be ignored (malformed or multi-range)
   */
  _parseRange(rangeHeader, size) {
    if (!helpers.isString(rangeHeader)) {
      return null;
    }

    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (!match || (match[1] === '' && match[2] === '')) {
      return null;
    }

    let start;
    let end;
    if (match[1] === '') {
      // Suffix range: last N bytes
      const suffix = parseInt(match[2], 10);
      if (suffix === 0) {
        return false;
      }
      start = Math.max(0, size - suffix);
      end = size - 1;
    } else {
      start = parseInt(match[1], 10);
      end = match[2] === '' ? size - 1 : Math.min(parseInt(match[2], 10), size - 1);
    }

    if (start >= size || start > end) {
      return false;
    }
    return { start, end };
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
    let reqRange = false;
    let responseType = _responseType;

    let disposition = (http.params?.query?.download === 'true') ? 'attachment' : 'inline';
    const name = vRef.name || fileRef.name;
    if (helpers.isString(name) && name.length) {
      // RFC 6266: ASCII fallback in `filename` (no `%`, some clients decode it), RFC 8187 encoded value in `filename*`
      const fallbackName = name.replace(/[^\x20-\x7e]|["\\%]/g, '_');
      const encodedName = encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
      disposition += `; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`;
    }

    if (!http.response.headersSent) {
      http.response.setHeader('Content-Disposition', disposition);
    }

    if (responseType === '200' && Number.isInteger(vRef.size) && vRef.size >= 0) {
      const size = vRef.size;
      if (http.request.headers.range && !force200) {
        const range = this._parseRange(http.request.headers.range, size);
        if (range) {
          reqRange = range;
          responseType = '206';
        } else if (range === false && this.strict) {
          responseType = '416';
        }
      }
    }

    const headers = (helpers.isFunction(this.responseHeaders) ? this.responseHeaders(responseType, fileRef, vRef, version, http) : this.responseHeaders) || {};

    if (this.nosniff && !http.response.headersSent) {
      http.response.setHeader('X-Content-Type-Options', 'nosniff');
    }

    if (!headers['Cache-Control']) {
      if (!http.response.headersSent) {
        http.response.setHeader('Cache-Control', this.cacheControl);
      }
    }

    for (const key of Object.keys(headers)) {
      if (!http.response.headersSent) {
        http.response.setHeader(key, headers[key]);
      }
    }

    const respond = (stream, code) => {
      const writeHead = () => {
        if (!http.response.headersSent) {
          http.response.writeHead(code);
        }
      };

      if (readableStream) {
        writeHead();
      } else {
        stream.once('open', writeHead);
      }

      // Free the file descriptor when the client goes away
      http.response.once('close', () => {
        if (!stream.destroyed) {
          stream.destroy();
        }
      });

      stream.once('error', (error) => {
        this._debug(`[FilesCollection] [serve(${vRef.path}, ${version})] [500]`, error);
        if (!stream.destroyed) {
          stream.destroy();
        }

        if (!http.response.headersSent) {
          const text = 'Internal Server Error';
          http.response.removeHeader('Content-Length');
          http.response.removeHeader('Content-Range');
          http.response.writeHead(500, {
            'Content-Type': 'text/plain',
            'Content-Length': text.length
          });
          http.response.end(text);
        } else if (!http.response.writableEnded) {
          http.response.destroy();
        }
      });

      stream.pipe(http.response);
    };

    switch (responseType) {
    case '400': {
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
    }
    case '404':
      this._404(http);
      break;
    case '416':
      this._debug(`[FilesCollection] [serve(${vRef.path}, ${version})] [416] Range Not Satisfiable`);
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
        if (!readableStream) {
          // serve() reads exactly this range from the file. The length of a caller's stream is unknown, so it is sent chunked
          http.response.setHeader('Content-Length', `${reqRange.end - reqRange.start + 1}`);
          // A message with Content-Length must not be chunked
          http.response.removeHeader('Transfer-Encoding');
        }
      }
      respond(readableStream || fs.createReadStream(vRef.path, { start: reqRange.start, end: reqRange.end }), 206);
      break;
    default:
      if (!http.response.headersSent && Number.isInteger(vRef.size) && vRef.size >= 0) {
        // As in 3.0, also for a caller's stream: it must send the whole stored file
        http.response.setHeader('Content-Length', `${vRef.size}`);
        http.response.removeHeader('Transfer-Encoding');
      }
      this._debug(`[FilesCollection] [serve(${vRef.path}, ${version})] [200]`);
      respond(readableStream || fs.createReadStream(vRef.path), 200);
      break;
    }
  }
}

export { FilesCollection, WriteStream, helpers };
