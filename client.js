import { DDP } from 'meteor/ddp-client';
import { Mongo } from 'meteor/mongo';
import { Meteor } from 'meteor/meteor';
import { Cookies } from 'meteor/ostrio:cookies';
import { check, Match } from 'meteor/check';
import { UploadInstance } from './upload.js';
import FilesCollectionCore from './core.js';
import { formatFleURL, helpers } from './lib.js';

const NOOP = () => { };
const allowedParams = ['allowClientCode', 'allowQueryStringCookies', 'chunkSize', 'collection', 'collectionName', 'ddp', 'debug', 'disableSetTokenCookie', 'disableUpload', 'downloadRoute', 'namingFunction', 'onBeforeUpload', 'onbeforeunloadMessage', 'public', 'sanitize', 'schema'];

/**
 * @locus Client
 * @class FilesCollection
 * @param config {FilesCollectionConfig} - [anywhere] configuration object with the following properties:
 * @param config.debug {boolean} - [anywhere] turn on/off debugging and extra logging
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
    });

    if (!helpers.isBoolean(this.debug)) {
      this.debug = false;
    }

    if (!helpers.isBoolean(this.public)) {
      this.public = false;
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
      this.onbeforeunloadMessage = 'Upload in a progress... Do you want to abort?';
    }

    if (!config.disableSetTokenCookie) {
      const setTokenCookie = () => {
        if (Meteor.connection._lastSessionId) {
          cookie.set('x_mtok', Meteor.connection._lastSessionId, { path: '/', sameSite: 'Lax' });
          if ((Meteor.isCordova || Meteor.isDesktop) && this.allowQueryStringCookies) {
            cookie.send();
          }
        }
      };

      const _accounts = (Package && Package['accounts-base'] && Package['accounts-base'].Accounts) ? Package['accounts-base'].Accounts : undefined;
      if (_accounts) {
        DDP.onReconnect((conn) => {
          conn.onReconnect = setTokenCookie;
        });
        Meteor.startup(setTokenCookie);
        _accounts.onLogin(setTokenCookie);
      }
    }

    // eslint-disable-next-line new-cap
    check(this.onbeforeunloadMessage, Match.OneOf(String, Function));

    try {
      const _URL = window.URL || window.webkitURL || window.mozURL || window.msURL || window.oURL || false;
      if (window.Worker && window.Blob && _URL && helpers.isFunction(_URL.createObjectURL)) {
        this._supportWebWorker = true;
        this._webWorkerUrl = _URL.createObjectURL(new window.Blob(['!function(a){"use strict";a.onmessage=function(b){var c=b.data.f.slice(b.data.cs*(b.data.cc-1),b.data.cs*b.data.cc);if(b.data.ib===!0)postMessage({bin:c,chunkId:b.data.cc});else{var d;a.FileReader?(d=new FileReader,d.onloadend=function(a){postMessage({bin:(d.result||a.srcElement||a.target).split(",")[1],chunkId:b.data.cc,s:b.data.s})},d.onerror=function(a){throw(a.target||a.srcElement).error},d.readAsDataURL(c)):a.FileReaderSync?(d=new FileReaderSync,postMessage({bin:d.readAsDataURL(c).split(",")[1],chunkId:b.data.cc})):postMessage({bin:null,chunkId:b.data.cc,error:"File API is not supported in WebWorker!"})}}}(this);'], { type: 'application/javascript' }));
      } else if (window.Worker) {
        this._supportWebWorker = true;
        this._webWorkerUrl = Meteor.absoluteUrl('packages/ostrio_files/worker.min.js');
      } else {
        this._supportWebWorker = false;
      }
    } catch (e) {
      self._debug('[FilesCollection] [Check WebWorker Availability] Error:', e);
      this._supportWebWorker = false;
    }

    if (!this.schema) {
      this.schema = FilesCollectionCore.schema;
    }

    check(this.debug, Boolean);
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
   * @summary Returns an object with userId and a user() method that returns the user object
   * @returns {ContextUser}
   */
  _getUser() {
    const result = {
      user() {
        return null;
      },
      userId: null
    };

    if (helpers.isFunction(Meteor.userId)) {
      result.user = () => Meteor.user();
      result.userId = Meteor.userId();
    }

    return result;
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
   * @param {boolean} autoStart - whether to start upload immediately (if false, call .start() manually)
   * @summary Uploads a file to the server over DDP or HTTP
   * @returns {UploadInstance} An instance with properties:
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
    if (this.disableUpload) {
      this._debug('[FilesCollection] [insert()] Upload is disabled with [disableUpload]!');
      return {};
    }
    const uploadInstance = new UploadInstance(config, this);
    if (autoStart) {
      uploadInstance.start().catch((error) => {
        uploadInstance.emit('error', new Meteor.Error(500, '[FilesCollection] [insert] Error starting upload:', error));
      });
    }
    return uploadInstance;
  }

  /**
   * Asynchronously uploads a file to the server over DDP or HTTP.
   * @locus Client
   * @memberOf FilesCollection
   * @name insertAsync
   * @returns {Promise<UploadInstance>}
   * @see FilesCollection#insert for usage
   */
  async insertAsync(config, autoStart = true) {
    this._debug('[FilesCollection] [insertAsync()]', config, { autoStart });
    if (this.disableUpload) {
      this._debug('[FilesCollection] [insertAsync()] Upload is disabled with [disableUpload]!');
      return {};
    }
    const uploadInstance = new UploadInstance(config, this);
    if (autoStart) {
      await uploadInstance.start();
    }
    return uploadInstance;
  }

  /**
   * Removes documents from the collection.
   * @locus Client
   * @memberOf FilesCollection
   * @name remove
   * @param {MeteorFilesSelector} selector - mongo-style selector (see http://docs.meteor.com/api/collections.html#selectors)
   * @param {function(error, number): void} callback - callback with (error, number) arguments
   * @summary Removes documents from the collection
   * @returns {FilesCollection} Instance
   */
  remove(selector = {}, callback) {
    this._debug(`[FilesCollection] [remove(${JSON.stringify(selector)})]`);
    /* eslint-disable new-cap */
    check(selector, Match.OneOf(Object, String));
    check(callback, Match.Optional(Function));
    /* eslint-enable new-cap */

    if (this.allowClientCode) {
      this.ddp.call(this._methodNames._Remove, selector, (callback || NOOP));
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
   * @param {MeteorFilesSelector} selector - mongo-style selector (see http://docs.meteor.com/api/collections.html#selectors)
   * @summary Removes documents from the collection
   * @returns {Promise<number>} number of matched and removed files/records
   */
  async removeAsync(selector = {}) {
    this._debug(`[FilesCollection] [removeAsync(${JSON.stringify(selector)})]`);
    // eslint-disable-next-line new-cap
    check(selector, Match.OneOf(Object, String));

    if (this.allowClientCode) {
      return await this.ddp.callAsync(this._methodNames._Remove, selector);
    }

    this._debug('[FilesCollection] [removeAsync] Run code from client is not allowed!');
    return 0;
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
      return formatFleURL(fileObj, version, uriBase);
    });
  }
});

export { FilesCollection, helpers };
