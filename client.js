import { Mongo } from 'meteor/mongo';
import { Meteor } from 'meteor/meteor';
import { Tracker } from 'meteor/tracker';
import { Cookies } from 'meteor/ostrio:cookies';
import { check, Match } from 'meteor/check';
import { UploadInstance } from './upload.js';
import FilesCollectionCore, { SELECTOR_PATTERN } from './core.js';
import { FileCursor } from './cursor.js';
import { formatFileURL, helpers } from './lib.js';

const NOOP = () => { };
const WORKER_SOURCE = '!function(r){"use strict";r.onmessage=function(e){var n=e.data.cc,o=e.data.f.slice(e.data.cs*(n-1),e.data.cs*n),a;if(e.data.ib===!0){postMessage({bin:o,chunkId:n});return}r.FileReader?(a=new FileReader,a.onload=function(){postMessage({bin:String(a.result).split(",")[1],chunkId:n})},a.onerror=function(){postMessage({bin:null,chunkId:n,error:"FileReader error: "+(a.error&&a.error.message||"unknown")})},a.readAsDataURL(o)):r.FileReaderSync?function(){try{a=new FileReaderSync,postMessage({bin:a.readAsDataURL(o).split(",")[1],chunkId:n})}catch(t){postMessage({bin:null,chunkId:n,error:"FileReaderSync error: "+(t&&t.message)})}}():postMessage({bin:null,chunkId:n,error:"File API is not supported in WebWorker!"})}}(this);';

/**
 * @private
 * @summary Web Worker script URL, created once per page and shared by all collections
 * @type {{supported: boolean, url: string|undefined}|null}
 */
let webWorker = null;

/**
 * @private
 * @summary Returns Web Worker support and the script URL. A Blob URL is created once and kept for the page lifetime, so it is never revoked
 * @param {function} debug - Logger
 * @returns {{supported: boolean, url: string|undefined}}
 */
const getWebWorker = (debug) => {
  if (webWorker) {
    return webWorker;
  }

  try {
    const _URL = window.URL || window.webkitURL || window.mozURL || window.msURL || window.oURL || false;
    if (window.Worker && window.Blob && _URL && helpers.isFunction(_URL.createObjectURL)) {
      webWorker = { supported: true, url: _URL.createObjectURL(new window.Blob([WORKER_SOURCE], { type: 'application/javascript' })) };
    } else if (window.Worker) {
      webWorker = { supported: true, url: Meteor.absoluteUrl('packages/ostrio_files/worker.min.js') };
    } else {
      webWorker = { supported: false, url: undefined };
    }
  } catch (e) {
    debug('[FilesCollection] [Check WebWorker Availability] Error:', e);
    webWorker = { supported: false, url: undefined };
  }
  return webWorker;
};

/**
 * @private
 * @summary DDP connections that already have an `x_mtok` cookie setter. One setter per connection, shared by all collections
 * @type {WeakSet<object>}
 */
const tokenCookieConnections = new WeakSet();

/**
 * @private
 * @summary Keep the `x_mtok` cookie equal to the DDP session id of `connection`. Sets it on startup, on login, and after every reconnect
 * @param {object} connection - DDP connection, always `Meteor.connection`
 * @param {function(string): void} setCookie - Writes the cookie
 * @param {object} [accounts] - `Accounts` from `accounts-base`, when installed
 * @returns {void}
 */
const watchTokenCookie = (connection, setCookie, accounts) => {
  if (!helpers.isObject(connection) || tokenCookieConnections.has(connection)) {
    return;
  }
  tokenCookieConnections.add(connection);

  let lastSessionId = null;
  let pollTimer = null;
  const sync = (force = false) => {
    const sessionId = connection._lastSessionId;
    if (helpers.isString(sessionId) && sessionId.length && (force || sessionId !== lastSessionId)) {
      lastSessionId = sessionId;
      setCookie(sessionId);
      return true;
    }
    return false;
  };

  // Session id arrives after the socket connects (DDP "connected" message), poll for it briefly
  const waitForNewSession = (attempt = 0) => {
    pollTimer = null;
    if (sync() || attempt >= 100 || !connection.status().connected) {
      return;
    }
    pollTimer = setTimeout(() => waitForNewSession(attempt + 1), 100);
  };

  // Not owned by a computation that may be running while a collection is constructed
  Tracker.nonreactive(() => {
    Tracker.autorun(() => {
      if (connection.status().connected && !pollTimer) {
        Tracker.nonreactive(() => waitForNewSession());
      }
    });
  });

  Meteor.startup(() => sync());
  if (accounts) {
    // Always rewrite on login, like 3.0.x, in case app code cleared the cookie
    accounts.onLogin(() => sync(true));
  }
};

const allowedParams = ['allowClientCode', 'allowedCordovaOrigins', 'allowQueryStringCookies', 'chunkSize', 'collection', 'collectionName', 'ddp', 'debug', 'disableSetTokenCookie', 'disableUpload', 'downloadRoute', 'namingFunction', 'onBeforeUpload', 'onbeforeunloadMessage', 'public', 'sanitize', 'schema'];

/**
 * @locus Client
 * @class FilesCollection
 * @param config {FilesCollectionConfig} - [anywhere] configuration object with the following properties:
 * @param config.debug {boolean|function} - [anywhere] Turn on/off debugging and extra logging to console, or pass your own function to handle debug messages on your own
 * @param config.ddp {DDP.DDPStatic} - [client] custom DDP connection; object returned from `DDP.connect()`
 * @param config.schema {object} - [anywhere] collection schema
 * @param config.public {boolean} - [anywhere] store files in folder accessible for proxy servers, for limits, etc.
 * @param config.chunkSize {number} - [anywhere] upload chunk size, default: 524288 bytes (0.5 mb)
 * @param config.downloadRoute {string} - [anywhere] server route used to retrieve files
 * @param config.collection {Mongo.Collection} - [anywhere] mongo collection instance
 * @param config.collectionName {string} - [anywhere] collection name
 * @param config.namingFunction {function} - [anywhere] function that returns a string
 * @param config.onBeforeUpload {function} - [anywhere] function executed on server after receiving each chunk and on client before starting upload; return `true` to continue, `false` or `string` (error message) to abort
 * @param config.allowClientCode {boolean} - [anywhere] allow to run remove from client
 * @param config.onbeforeunloadMessage {string|function} - [client] message shown to user when closing window/tab during upload
 * @param config.disableUpload {boolean} - disable file upload; useful for server-only solutions
 * @param config.disableSetTokenCookie {boolean} - disable cookie setting; useful when using multiple file collections or custom authorization
 * @param config.allowedCordovaOrigins {boolean|RegExp|string} - [Client] origins allowed to set cookies cross-site, passed to `ostrio:cookies`; default: `undefined`
 * @param config.allowQueryStringCookies {boolean} - allow passing cookies in query string (primarily in cordova); default: false
 * @param config.sanitize {function} - override default sanitize function
 * @summary Creates a new instance of FilesCollection
 */
class FilesCollection extends FilesCollectionCore {
  constructor(config) {
    super();
    if (config) {
      Object.keys(config).forEach((param) => {
        if (allowedParams.includes(param)) {
          this[param] = config[param];
        }
      });
    }

    const self = this;
    const cookie = new Cookies({
      allowQueryStringCookies: this.allowQueryStringCookies,
      allowedCordovaOrigins: this.allowedCordovaOrigins,
    });

    if (!helpers.isBoolean(this.debug) && !helpers.isFunction(this.debug)) {
      this.debug = false;
    }

    if (!helpers.isBoolean(this.public)) {
      this.public = false;
    }

    if (!this.chunkSize) {
      this.chunkSize = 1024 * 512;
    }
    // Server and upload code expect a multiple of 8 bytes, at least 8
    this.chunkSize = Math.max(8, Math.floor(this.chunkSize / 8) * 8);

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

    if (!helpers.isBoolean(this.disableUpload)) {
      this.disableUpload = false;
    }

    if (!helpers.isBoolean(this.disableSetTokenCookie)) {
      this.disableSetTokenCookie = false;
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

    if (!helpers.isBoolean(this.allowClientCode)) {
      this.allowClientCode = true;
    }

    if (!this.ddp) {
      this.ddp = Meteor;
    }

    if (!this.onbeforeunloadMessage) {
      this.onbeforeunloadMessage = 'Upload in progress... Do you want to abort?';
    }

    if (!this.disableSetTokenCookie) {
      const setTokenCookie = (sessionId) => {
        cookie.set('x_mtok', sessionId, { path: '/', sameSite: 'Lax', secure: window.location.protocol === 'https:' });
        if ((Meteor.isCordova || Meteor.isDesktop) && this.allowQueryStringCookies) {
          cookie.send();
        }
      };

      const _accounts = (Package && Package['accounts-base'] && Package['accounts-base'].Accounts) ? Package['accounts-base'].Accounts : undefined;
      if (_accounts) {
        // Always the default connection: the cookie is page-wide and the server resolves it against its own sessions.
        // HTTP uploads send the same id in `x-mtok`
        watchTokenCookie(Meteor.connection, setTokenCookie, _accounts);
      }
    }

    // eslint-disable-next-line new-cap
    check(this.onbeforeunloadMessage, Match.OneOf(String, Function));

    const _webWorker = getWebWorker((...args) => self._debug(...args));
    this._supportWebWorker = _webWorker.supported;
    this._webWorkerUrl = _webWorker.url;

    if (!this.schema) {
      this.schema = FilesCollectionCore.schema;
    }

    // eslint-disable-next-line new-cap
    check(this.debug, Match.OneOf(Boolean, Function));
    check(this.schema, Object);
    check(this.public, Boolean);
    check(this.chunkSize, Number);
    check(this.downloadRoute, String);
    check(this.disableUpload, Boolean);
    /* eslint-disable new-cap */
    check(this.namingFunction, Match.OneOf(false, Function));
    check(this.onBeforeUpload, Match.OneOf(false, Function));
    /* eslint-enable new-cap */
    check(this.allowClientCode, Boolean);
    check(this.ddp, Match.Any);

    this._methodNames = {
      _Abort: `_FilesCollectionAbort_${this.collectionName}`,
      _Write: `_FilesCollectionWrite_${this.collectionName}`,
      _Start: `_FilesCollectionStart_${this.collectionName}`,
      _Remove: `_FilesCollectionRemove_${this.collectionName}`
    };
  }

  /**
   * Returns file's mime-type.
   * @locus Anywhere
   * @memberOf FilesCollection
   * @name _getMimeType
   * @param {FileData} fileData - file object
   * @returns {string}
   */
  _getMimeType(fileData) {
    let mime;
    check(fileData, Object);
    if (helpers.isObject(fileData)) {
      mime = fileData.type;
    }
    if (!mime || !helpers.isString(mime)) {
      mime = 'application/octet-stream';
    }
    return mime;
  }

  /**
   * Returns an object with user's information.
   * @locus Anywhere
   * @memberOf FilesCollection
   * @name _getUser
   * @summary Returns an object with userId, a user() method that returns the user object, and userAsync(), same as on server
   * @returns {ContextUser}
   */
  _getUser() {
    const result = {
      user() {
        return null;
      },
      async userAsync() {
        return null;
      },
      userId: null
    };

    if (helpers.isFunction(Meteor.userId)) {
      result.user = () => Meteor.user();
      result.userAsync = async () => (helpers.isFunction(Meteor.userAsync) ? await Meteor.userAsync() : Meteor.user());
      result.userId = Meteor.userId();
    }

    return result;
  }

  /**
   * Finds and returns a FileCursor for a matching document.
   * @locus Client
   * @memberOf FilesCollection
   * @name findOne
   * @param {MeteorFilesSelector} [selector={}] - Mongo-style selector
   * @param {MeteorFilesOptions} [options] - Mongo query options
   * @returns {FileCursor|null} A FileCursor instance, or null if not found
   */
  findOne(selector = {}, options) {
    this._debug(`[FilesCollection] [findOne(${JSON.stringify(selector)}, ${JSON.stringify(options)})]`);
    /* eslint-disable new-cap */
    check(selector, SELECTOR_PATTERN);
    check(options, Match.Optional(Object));
    /* eslint-enable new-cap */

    const doc = this.collection.findOne(selector, options);
    return doc ? new FileCursor(doc, this) : null;
  }

  /**
   * Uploads a file to the server over DDP or HTTP.
   * @locus Client
   * @memberOf FilesCollection
   * @name insert
   * @see https://developer.mozilla.org/en-US/docs/Web/API/FileReader
   * @param {InsertOptions} config - configuration object with properties:
   *   {File} file - HTML5 file object (e.g. from e.currentTarget.files[0])
   *   {string} fileId - optional fileId used at insert
   *   {MetadataType} meta - additional data as an object, used later for search
   *   {boolean} allowWebWorkers - allow/deny use of web workers
   *   {number|string} chunkSize - chunk size for upload (or 'dynamic')
   *   {MeteorFilesTransportType} transport - upload transport ('http' or 'ddp')
   *   {DDP.DDPStatic} ddp - custom DDP connection (returned from DDP.connect())
   *   {function} onUploaded - callback triggered when upload finishes; receives (error, fileObj)
   *   {function} onStart - callback triggered when upload starts; receives (error, fileObj) (error always null)
   *   {function} onError - callback triggered on error during upload/FileReader; receives (error, fileData)
   *   {function} onProgress - callback triggered when a chunk is sent; receives (progress)
   *   {function} onBeforeUpload - callback triggered before upload starts; return true to continue, false or string to abort
   * @param {boolean} [autoStart=true] - whether to start upload immediately (if false, call .start() manually)
   * @summary Uploads a file to the server over DDP or HTTP
   * @returns {FileUpload|UploadInstance} An instance with properties:
   *   {ReactiveVar} onPause - whether the upload is paused
   *   {ReactiveVar} state - 'active' | 'paused' | 'aborted' | 'completed'
   *   {ReactiveVar} progress - upload progress (percentage)
   *   {function} pause - pauses the upload
   *   {function} continue - continues a paused upload
   *   {function} toggle - toggles pause/continue
   *   {function} abort - aborts the upload
   *   {function} readAsDataURL - returns the file as a data URL (for preview); note: big files may crash the browser
   */
  insert(config, autoStart = true) {
    this._debug('[FilesCollection] [insert()]', config, { autoStart });
    let _config = config;
    if (this.disableUpload) {
      this._debug('[FilesCollection] [insert()] Upload is disabled with [disableUpload]!');
      _config = Object.assign({}, config, { disableUpload: true });
    }

    const uploadInstance = new UploadInstance(_config, this);
    if (autoStart) {
      uploadInstance.start().catch((error) => {
        // Already emitted as `error` event and passed to `onError`
        this._debug('[FilesCollection] [insert] Error starting upload:', error);
      });
      return uploadInstance;
    }

    return uploadInstance.manual();
  }

  /**
   * Asynchronously uploads a file to the server over DDP or HTTP.
   * @locus Client
   * @memberOf FilesCollection
   * @name insertAsync
   * @param {InsertOptions} config - configuration object with properties:
   * @param {boolean} [autoStart=true] - whether to start upload immediately (if false, call .start() manually)
   * @returns {Promise<FileUpload|UploadInstance>} Rejects after emitting `error` and cleaning up, if the upload can not start
   * @see FilesCollection#insert for usage
   */
  async insertAsync(config, autoStart = true) {
    this._debug('[FilesCollection] [insertAsync()]', config, { autoStart });
    let _config = config;
    if (this.disableUpload) {
      this._debug('[FilesCollection] [insertAsync()] Upload is disabled with [disableUpload]!');
      _config = Object.assign({}, config, { disableUpload: true });
    }

    const uploadInstance = new UploadInstance(_config, this);
    if (autoStart) {
      await uploadInstance.start();
      return uploadInstance;
    }

    return uploadInstance.manual();
  }

  /**
   * Removes documents from the collection.
   * @locus Client
   * @memberOf FilesCollection
   * @name remove
   * @param {string} _id - `_id` of the file to remove
   * @param {function(error, number): void} callback - callback with (error, number) arguments
   * @summary Removes one file from the collection
   * @returns {FilesCollection} Instance
   */
  remove(_id, callback) {
    this._debug(`[FilesCollection] [remove(${JSON.stringify(_id)})]`);
    check(_id, String);
    // eslint-disable-next-line new-cap
    check(callback, Match.Optional(Function));

    if (this.allowClientCode) {
      this.ddp.call(this._methodNames._Remove, _id, (callback || NOOP));
    } else {
      callback && callback(new Meteor.Error(401, '[FilesCollection] [remove] Run code from client is not allowed!'));
      this._debug('[FilesCollection] [remove] Run code from client is not allowed!');
    }

    return this;
  }

  /**
   * Removes documents from the collection asynchronously.
   * @locus Anywhere
   * @memberOf FilesCollection
   * @name removeAsync
   * @param {string} _id - `_id` of the file to remove
   * @summary Removes one file from the collection
   * @throws {Meteor.Error} 401 when `allowClientCode` is `false`
   * @returns {Promise<number>} number of removed files, `0` or `1`
   */
  async removeAsync(_id) {
    this._debug(`[FilesCollection] [removeAsync(${JSON.stringify(_id)})]`);
    check(_id, String);

    if (this.allowClientCode) {
      return await this.ddp.callAsync(this._methodNames._Remove, _id);
    }

    this._debug('[FilesCollection] [removeAsync] Run code from client is not allowed!');
    throw new Meteor.Error(401, '[FilesCollection] [removeAsync] Run code from client is not allowed!');
  }
}

Meteor.startup(() => {
  const _template = (Package && Package.templating && Package.templating.Template) ? Package.templating.Template : undefined;
  if (_template) {
    _template.registerHelper('fileURL', (fileObj, _version = 'original', _uriBase) => {
      if (!helpers.isObject(fileObj)) {
        return '';
      }

      const version = (!helpers.isString(_version)) ? 'original' : _version;
      const uriBase = (!helpers.isString(_uriBase)) ? void 0 : _uriBase;
      // FileCursor knows its collection: use its route and name
      const collection = (fileObj._collection instanceof FilesCollection) ? fileObj._collection : void 0;
      return formatFileURL(fileObj, version, uriBase, collection);
    });
  }
});

export { FilesCollection, helpers };
