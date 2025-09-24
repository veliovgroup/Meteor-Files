import { fetch } from 'meteor/fetch';
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { Tracker } from 'meteor/tracker';
import { ReactiveVar } from 'meteor/reactive-var';
import { EventEmitter } from 'eventemitter3';
import { check, Match } from 'meteor/check';
import { fixJSONParse, fixJSONStringify, helpers } from './lib.js';

const _rootUrl = (window.__meteor_runtime_config__.MOBILE_ROOT_URL || window.__meteor_runtime_config__.ROOT_URL).replace(/\/+$/, '');
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

/**
 * @locus Client
 * @name FileUpload
 * @class FileUpload
 * @summary Internal Class, instance of this class is returned from `.insert()` method
 */
export class FileUpload extends EventEmitter {
  /**
   * Constructs a FileUpload instance.
   * @param {FileUploadConfig} config - The configuration for the file upload.
   */
  constructor(config) {
    super();
    this.config = config;
    this.config._debug('[FilesCollection] [FileUpload] [constructor]');

    if (!this.config.isBase64) {
      this.file = Object.assign({}, helpers.clone(this.config.file), this.config.fileData);
    } else {
      this.file = this.config.fileData;
    }

    this.state = new ReactiveVar('active');
    this.onPause = new ReactiveVar(false);
    this.progress = new ReactiveVar(0);
    this.continueFunc = () => {};
    this.estimateTime = new ReactiveVar(1000);
    this.estimateSpeed = new ReactiveVar(0);
    this.remainingTime = new ReactiveVar('00:00:00');
    this.estimateTimer = Meteor.setInterval(() => {
      if (this.state.get() === 'active') {
        const _currentTime = this.estimateTime.get();
        if (_currentTime > 1000) {
          const ms = _currentTime - 1000;
          this.estimateTime.set(ms);
          this.remainingTime.set(this._formatDuration(ms));
        } else {
          this.remainingTime.set('00:00:00');
        }
      }
    }, 1000);
  }

  /**
   * Pauses the file upload.
   * @returns {void}
   */
  pause() {
    this.config._debug('[FilesCollection] [insert] [.pause()]');
    if (!this.onPause.get()) {
      this.onPause.set(true);
      this.state.set('paused');
      this.emit('pause', this.file);
    }
  }

  /**
   * Resumes the file upload if paused.
   * @returns {void}
   */
  continue() {
    this.config._debug('[FilesCollection] [insert] [.continue()]');
    if (this.onPause.get() && Meteor.status().connected) {
      this.onPause.set(false);
      this.state.set('active');
      this.emit('continue', this.file);
      this.continueFunc();
    }
  }

  /**
   * Toggles the file upload state between paused and active.
   * @returns {void}
   */
  toggle() {
    this.config._debug('[FilesCollection] [insert] [.toggle()]');
    if (this.onPause.get()) {
      this.continue();
    } else {
      this.pause();
    }
  }

  /**
   * Aborts the file upload.
   * @returns {Promise<void>} A promise that resolves when the abort process is complete.
   */
  async abort() {
    this.config._debug('[FilesCollection] [insert] [.abort()]');
    this.pause();
    this.config._onEnd();
    this.state.set('aborted');
    if (this.config.onAbort) {
      this.config.onAbort.call(this, this.file);
    }
    this.emit('abort', this.file);
    if (this.config.debug) {
      // eslint-disable-next-line no-console
      console.timeEnd(`insert ${this.config.fileData.name}`);
    }

    await this.config.ddp.callAsync(this.config._Abort, this.config.fileId);
  }

  _formatDuration(ms) {
    const hh = `${Math.floor(ms / (1000 * 60 * 60))}`.padStart(2, '0');
    const mm = `${Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))}`.padStart(2, '0');
    const ss = `${Math.floor((ms % (1000 * 60)) / 1000)}`.padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
}

/**
 * @locus Client
 * @name UploadInstance
 * @class UploadInstance
 * @summary Internal Class, used for file upload
 */
export class UploadInstance extends EventEmitter {
  /**
   * Constructs an UploadInstance.
   * @param {UploadInstanceConfig} config - The upload instance configuration.
   * @param {FilesCollection} collection - The FilesCollection instance.
   */
  constructor(config, collection) {
    super();
    this.config = config;
    this.collection = collection;
    this.collection._debug('[FilesCollection] [new UploadInstance()]');

    if (!this.config.ddp) {
      this.config.ddp = this.collection.ddp;
    }

    if (!this.config.meta) {
      this.config.meta = {};
    }

    if (!helpers.isString(this.config.transport)) {
      this.config.transport = 'ddp';
    }

    this.config.transport = this.config.transport.toLowerCase();

    if (this.config.transport !== 'ddp' && this.config.transport !== 'http') {
      this.config.transport = 'ddp';
    }

    if (!this.config.chunkSize) {
      this.config.chunkSize = this.collection.chunkSize;
    }

    if (!helpers.isBoolean(this.config.allowWebWorkers)) {
      this.config.allowWebWorkers = true;
    }

    /* eslint-disable new-cap */
    check(this.config, {
      ddp: Match.Any,
      file: Match.Any,
      fileId: Match.Optional(String),
      meta: Match.Optional(Object),
      type: Match.Optional(String),
      onError: Match.Optional(Function),
      onAbort: Match.Optional(Function),
      onStart: Match.Optional(Function),
      fileName: Match.Optional(String),
      isBase64: Match.Optional(Boolean),
      transport: Match.OneOf('http', 'ddp'),
      chunkSize: Match.OneOf('dynamic', Number),
      onUploaded: Match.Optional(Function),
      disableUpload: Match.Optional(Boolean),
      onProgress: Match.Optional(Function),
      onBeforeUpload: Match.Optional(Function),
      allowWebWorkers: Boolean
    });
    /* eslint-enable new-cap */

    this.config.isEnded = false;

    if (this.config.isBase64 === true) {
      check(this.config.file, String);

      if (!this.config.fileName) {
        throw new Meteor.Error(400, '"fileName" must me specified for base64 upload!');
      }

      if (this.config.file.includes('data:')) {
        this.config.file = this.config.file.replace('data:', '');
      }

      if (this.config.file.includes(',')) {
        const _file = this.config.file.split(',');
        this.fileData = {
          size: Math.floor(((_file[1].replace(/\=/g, '')).length / 4) * 3),
          type: _file[0].split(';')[0],
          name: this.config.fileName,
          meta: this.config.meta
        };
        this.config.file = _file[1];
      } else if (!this.config.type) {
        throw new Meteor.Error(400, '"type" must me specified for base64 upload! And represent mime-type of the file');
      } else {
        this.fileData = {
          size: Math.floor(((this.config.file.replace(/\=/g, '')).length / 4) * 3),
          type: this.config.type,
          name: this.config.fileName,
          meta: this.config.meta
        };
      }
    }

    if (!this.config.file) {
      throw new Meteor.Error(500, '[FilesCollection] [insert] Have you forget to pass a File itself?');
    }

    if (!this.config.isBase64) {
      try {
        if (!this.config.file.name || isNaN(this.config.file.size)) {
          throw new Meteor.Error(500, 'Not a File!');
        }
      } catch (err) {
        throw new Meteor.Error(500, '[FilesCollection] [insert] Insert method accepts File, not a FileList. You need to provide a real File. File must have `.name` property, and its size must be larger than zero.', err);
      }

      this.fileData = {
        size: this.config.file.size,
        type: this.config.type || this.config.file.type,
        name: this.config.fileName || this.config.file.name,
        meta: this.config.meta
      };
    }

    if (this.collection.debug) {
      // eslint-disable-next-line no-console
      console.time(`insert ${this.fileData.name}`);
      // eslint-disable-next-line no-console
      console.time(`loadFile ${this.fileData.name}`);
    }

    if (this.collection._supportWebWorker && this.config.allowWebWorkers) {
      try {
        this.worker = new Worker(this.collection._webWorkerUrl);
      } catch (wwError) {
        this.worker = false;
        this.collection._debug('[FilesCollection] [insert] [create WebWorker]: Can\'t create WebWorker, fallback to MainThread', wwError);
      }
    } else {
      this.worker = null;
    }

    this.disonnectRe = /network|connection|fetch/i;
    this.fetchControllers = {};
    this.fetchTimeouts = {};
    this.config._debug = this.collection._debug;
    this.config.debug = this.collection.debug;
    this.transferTime = 0;
    this.trackerCompConnection = null;
    this.trackerCompPause = null;
    this.sentChunks = -1;
    this.fileLength = 1;
    this.startTime = {};
    this.EOFsent = false;
    this.fileId = this.config.fileId || Random.id();
    this.pipes = [];

    this.fileData = Object.assign(this.fileData, this.collection._getExt(this.fileData.name), { mime: this.collection._getMimeType(this.fileData) });
    this.fileData['mime-type'] = this.fileData.mime;

    this.result = new FileUpload(Object.assign({}, this.config, {
      fileData: this.fileData,
      fileId: this.fileId,
      _Abort: this.collection._methodNames._Abort
    }));

    this._handleNetworkError = (error) => {
      this.collection._debug('[FilesCollection] [_handleNetworkError] Error:', error);
      if (!Meteor.status().connected || this.disonnectRe.test(`${error}`)) {
        this.result.pause();
      } else if (error?.error === 503) {
        this._upload();
      } else if (this.result.state.get() !== 'aborted' && this.result.state.get() !== 'paused') {
        this.emit('error', error);
      }
    };

    this.beforeunload = (e) => {
      const message = helpers.isFunction(this.collection.onbeforeunloadMessage) ? this.collection.onbeforeunloadMessage.call(this.result, this.fileData) : this.collection.onbeforeunloadMessage;

      if (e) {
        e.returnValue = message;
      }
      return message;
    };

    this.result.config.beforeunload = this.beforeunload;
    window.addEventListener('beforeunload', this.beforeunload, false);

    this.result.config._onEnd = () => this.emit('_onEnd');

    this._setProgress = (progress) => {
      if (this.result.progress.get() >= 100) {
        return;
      }

      let sentBytes = this.config.chunkSize * this.sentChunks;
      if (sentBytes > this.fileData.size) {
        // this case often occurs, when the last chunk
        // is smaller than chunkSize, so we limit to fileSize
        sentBytes = this.fileData.size;
      }

      this.result.progress.set(progress);
      this.config.onProgress && this.config.onProgress.call(this.result, progress, this.fileData);
      this.result.emit('progress', progress, this.fileData, { chunksSent: this.sentChunks, chunksLength: this.fileLength, bytesSent: sentBytes });
    };

    this.addListener('end', this._end);
    this.addListener('error', this._error);
    this.addListener('start', this.start);

    this.addListener('calculateStats', helpers.throttle(() => {
      if (this.result.progress.get() >= 100) {
        return;
      }

      const t = (this.transferTime / (this.sentChunks || 1));
      const ms = (t * (this.fileLength - this.sentChunks));
      this.result.estimateTime.set(ms);
      this.result.remainingTime.set(this.result._formatDuration(ms));
      this.result.estimateSpeed.set((this.config.chunkSize / (t / 1000)));

      const progress = Math.round((this.sentChunks / this.fileLength) * 100);
      this._setProgress(progress);
    }, 250));

    this.addListener('_onEnd', () => {
      if (this.config.isEnded) {
        return;
      }
      this.config.isEnded = true;
      this.result.remainingTime.set('00:00:00');
      // eslint-disable-next-line guard-for-in
      for (const uid in this.fetchControllers) {
        if (this.fetchControllers[uid]) {
          this.fetchControllers[uid].abort(new Meteor.Error(200, 'Upload has finished'));
          delete this.fetchControllers[uid];
        }
        if (this.fetchTimeouts[uid]) {
          clearTimeout(this.fetchTimeouts[uid]);
          delete this.fetchTimeouts[uid];
        }
      }
      if (this.result.estimateTimer) {
        Meteor.clearInterval(this.result.estimateTimer);
      }
      if (this.worker) {
        this.worker.terminate();
      }
      if (this.trackerCompConnection) {
        this.trackerCompConnection.stop();
      }
      if (this.trackerCompPause) {
        this.trackerCompPause.stop();
      }
      if (this.beforeunload) {
        window.removeEventListener('beforeunload', this.beforeunload, false);
      }
      return;
    });
  }

  /**
   * Handles an error during the upload process.
   * @param {Meteor.Error} error - The error that occurred.
   * @param {*} data - Additional error data.
   * @returns {UploadInstance} Returns the current UploadInstance.
   */
  _error(error, data) {
    this.collection._debug('[FilesCollection] [UploadInstance] [error]', this.fileId, { error, data });
    this._end(error, data);
    return this;
  }

  /**
   * Finalizes the upload process.
   * @param {Meteor.Error} [error] - An optional error if the upload failed.
   * @param {*} [data] - Additional data associated with the upload.
   * @returns {FileUpload} Returns the FileUpload result.
   */
  _end(error, data) {
    this.collection._debug('[FilesCollection] [UploadInstance] [end]', this.fileId, { error, data });
    if (this.collection.debug) {
      // eslint-disable-next-line no-console
      console.timeEnd(`insert ${this.fileData.name}`);
    }

    this._setProgress(100);
    this.emit('_onEnd');

    if (error) {
      this.collection._debug('[FilesCollection] [insert] [end] Error:', error);
      this.result.abort();
      this.result.state.set('aborted');
      this.result.emit('error', error, this.fileData);
      if (this.config.onError) {
        this.config.onError.call(this.result, error, this.fileData);
      }
    } else {
      this.result.emit('uploaded', error, data);
      if (this.config.onUploaded) {
        this.config.onUploaded.call(this.result, error, data);
      }
      this.result.state.set('completed');
      this.collection.emit('afterUpload', data);
    }
    this.result.emit('end', error, (data || this.fileData));
    return this.result;
  }

  /**
   * Sends a file chunk to the server.
   * @param {Object} evt - The event containing chunk data.
   * @param {Object} evt.data - Data related to the chunk.
   * @param {string} evt.data.bin - The binary data of the chunk.
   * @param {number} evt.data.chunkId - The chunk identifier.
   * @returns {Promise<void>}
   */
  async _sendChunk(evt) {
    this.collection._debug('[FilesCollection] [UploadInstance] [sendChunk]', this.fileId, evt.data.chunkId);
    const opts = {
      fileId: this.fileId,
      binData: evt.data.bin,
      chunkId: evt.data.chunkId
    };

    if (this.config.isBase64) {
      const pad = opts.binData.length % 4;
      if (pad) {
        let p = 0;
        while (p < pad) {
          opts.binData += '=';
          p++;
        }
      }
    }

    this.result.emit('data', evt.data.bin);
    if (this.pipes.length) {
      for (let i = this.pipes.length - 1; i >= 0; i--) {
        opts.binData = this.pipes[i](opts.binData);
      }
    }

    if (this.fileLength === evt.data.chunkId) {
      if (this.collection.debug) {
        // eslint-disable-next-line no-console
        console.timeEnd(`loadFile ${this.fileData.name}`);
      }
      this.result.emit('readEnd');
    }

    if (!opts.binData) {
      this.collection._debug('[FilesCollection] [sendChunk] binData is empty! Can not send empty chunk!');
      return;
    }

    const response = await this._sendRequest({
      methodName: this.collection._methodNames._Write,
      payload: opts,
      timeout: 25000,
      headers: {
        'x-fileid': opts.fileId,
        'x-chunkid': opts.chunkId,
        'content-type': 'text/plain'
      }
    });

    if (!this.config.isEnded && response?.status === 204) {
      this.transferTime += Date.now() - this.startTime[opts.chunkId];
      this.emit('calculateStats');
    }
  }

  /**
   * Sends an EOF (end-of-file) marker to the server.
   * @returns {Promise<void>}
   */
  async _sendEOF() {
    this.collection._debug('[FilesCollection] [UploadInstance] [sendEOF]', this.fileId, this.EOFsent, this.config.isEnded);
    if (this.EOFsent) {
      return;
    }

    this.EOFsent = true;
    const opts = {
      eof: true,
      fileId: this.fileId,
      binData: '',
    };

    const response = await this._sendRequest({
      methodName: this.collection._methodNames._Write,
      payload: opts,
      timeout: 10000,
      headers: {
        'x-eof': '1',
        'x-fileId': opts.fileId,
        'content-type': 'text/plain',
      }
    });

    if (response && !this.config.isEnded) {
      this.emit('end', response.error, response);
    }
  }

  /**
   * Sends a network request for file upload.
   * @param {Object} conf - The configuration for the network request.
   * @param {string} conf.methodName - The method name to call.
   * @param {Object} conf.payload - The payload to send.
   * @param {number} [conf.timeout=25000] - Request timeout in milliseconds.
   * @param {Object} conf.headers - Request headers.
   * @returns {Promise<any>} Resolves with the response.
   */
  async _sendRequest(conf) {
    this.collection._debug('[FilesCollection] [UploadInstance] [sendRequest]', this.fileId, { conf });
    let result = false;
    try {
      if (this.config.transport === 'ddp') {
        result = await this.config.ddp.callAsync(conf.methodName, conf.payload);
      } else {
        const payload = helpers.clone(conf.payload?.binData || conf.payload || '');
        if (helpers.isObject(payload?.file?.meta)) {
          payload.file.meta = fixJSONStringify(payload.file.meta);
        }

        const uid = Random.id();
        this.fetchControllers[uid] = new AbortController();
        this.fetchTimeouts[uid] = setTimeout(() => {
          if (this.fetchControllers[uid]) {
            this.fetchControllers[uid].abort(new Meteor.Error(503, 'Send Request Timeout'));
          }
        }, conf.timeout || 25000);

        const response = await fetch(`${_rootUrl}${this.collection.downloadRoute}/${this.collection.collectionName}/__upload`, {
          method: 'POST',
          signal: this.fetchControllers[uid].signal,
          body: helpers.isObject(payload) ? JSON.stringify(payload) : payload,
          cache: 'no-cache',
          credentials: 'include',
          type: 'cors',
          headers: {
            ...conf.headers,
            'x-mtok': (helpers.isObject(Meteor.connection) ? Meteor.connection._lastSessionId : void 0) || null
          }
        });

        clearTimeout(this.fetchTimeouts[uid]);
        delete this.fetchControllers[uid];
        delete this.fetchTimeouts[uid];
        result = response;

        if ((response.headers.get('content-type') || '').includes('application/json')) {
          try {
            const jsonData = await response.json();
            if (jsonData.meta) {
              jsonData.meta = fixJSONParse(jsonData.meta);
            }
            result = { status: response.status, ...jsonData };
          } catch (jsonError) {
            this.collection._debug('[FilesCollection] [UploadInstance] [sendRequest] [parseJSON] [ERROR:]', this.fileId, jsonError, response);
          }
        }
      }

      if (!this.config.isEnded) {
        if (result.status === 200) {
          return result;
        }

        if (result.status === 204) {
          ++this.sentChunks;
          this._upload();
        } else if (result.status === 503) {
          this._upload();
        } else if (result.status === 408) {
          this.emit('error', new Meteor.Error(result.status, 'Can\'t continue upload, session expired. Please, start upload again.'));
        } else if (result.status === 405) {
          this.emit('error', new Meteor.Error(405, 'Uploads are disabled'));
        } else if (result.status === 403) {
          if (result.error && result.isClientSafe) {
            this.emit('error', new Meteor.Error(result.error, result.reason));
          } else {
            this.emit('error', new Meteor.Error(500, 'Unexpected error occurred during upload, try again later'));
          }
        } else {
          this._handleNetworkError(new Meteor.Error(500, 'Unexpected error occurred during upload, make sure you\'re connected to the Internet. Reload the page or try again later.', result));
        }
      }
    } catch (requestError) {
      this.collection._debug('[FilesCollection] [UploadInstance] [sendRequest] [CAUGHT ERROR:]', this.fileId, requestError, conf);
      setTimeout(() => {
        this._handleNetworkError(requestError);
      }, 128);
    }

    return result;
  }

  /**
   * Reads and sends a specific chunk from the file.
   * @param {number} chunkId - The 1-indexed chunk number to process.
   * @returns {Promise<void>}
   */
  async _proceedChunk(chunkId) {
    this.collection._debug('[FilesCollection] [UploadInstance] [proceedChunk]', this.fileId, chunkId);
    const chunk = this.config.file.slice((this.config.chunkSize * (chunkId - 1)), (this.config.chunkSize * chunkId));

    if (this.config.isBase64) {
      await this._sendChunk({
        data: {
          bin: chunk,
          chunkId
        }
      });
      return;
    }

    let fileReader;
    if (!window.FileReader && !window.FileReaderSync) {
      this.emit('error', new Meteor.Error(400, 'File API is not supported in this Browser!'));
      return;
    }

    if (window.FileReader) {
      fileReader = new window.FileReader;

      fileReader.onloadend = (evt) => {
        this._sendChunk({
          data: {
            bin: ((helpers.isObject(fileReader) ? fileReader.result : void 0) || (evt.srcElement ? evt.srcElement.result : void 0) || (evt.target ? evt.target.result : void 0)).split(',')[1],
            chunkId
          }
        });
      };

      fileReader.onerror = (e) => {
        this.emit('error', (e.target || e.srcElement).error);
      };

      fileReader.readAsDataURL(chunk);
      return;
    }

    fileReader = new window.FileReaderSync;

    await this._sendChunk({
      data: {
        bin: fileReader.readAsDataURL(chunk).split(',')[1],
        chunkId
      }
    });
  }

  /**
   * Initiates or continues the upload process by processing the next chunk.
   * @returns {Promise<UploadInstance>} Resolves with the current UploadInstance.
   */
  async _upload() {
    if (this.result.onPause.get()) {
      return this;
    }

    if (this.result.state.get() === 'aborted') {
      return this;
    }

    if (this.sentChunks + 1 <= this.fileLength) {
      if (this.worker) {
        this.worker.postMessage({
          f: this.config.file,
          cc: this.sentChunks + 1,
          cs: this.config.chunkSize,
          ib: this.config.isBase64
        });
      } else {
        await this._proceedChunk(this.sentChunks + 1);
      }
    } else {
      await this._sendEOF();
    }
    this.startTime[this.sentChunks + 1] = Date.now();
    return this;
  }

  /**
   * Prepares the file upload by setting chunk sizes and initiating the upload process.
   * @returns {Promise<void>}
   */
  async _prepare() {
    let _len;

    if (this.config.onStart) {
      this.config.onStart.call(this.result, null, this.fileData);
    }
    this.result.emit('start', null, this.fileData);

    if (this.config.chunkSize === 'dynamic') {
      this.config.chunkSize = this.fileData.size / 1000;
      if (this.config.chunkSize < 327680) {
        this.config.chunkSize = 327680;
      } else if (this.config.chunkSize > 1048576) {
        this.config.chunkSize = 1048576;
      }

      if (this.config.transport === 'http') {
        this.config.chunkSize = Math.round(this.config.chunkSize / 2);
      } else if (isSafari) {
        this.config.chunkSize = Math.ceil(this.config.chunkSize / 8);
      }
    }

    if (this.config.isBase64) {
      this.config.chunkSize = Math.floor(this.config.chunkSize / 4) * 4;
      _len = Math.ceil(this.config.file.length / this.config.chunkSize);
    } else {
      this.config.chunkSize = Math.floor(this.config.chunkSize / 8) * 8;
      _len = Math.ceil(this.fileData.size / this.config.chunkSize);
    }

    this.fileLength = _len <= 0 ? 1 : _len;
    this.result.config.fileLength = this.fileLength;

    const opts = {
      file: this.fileData,
      fileId: this.fileId,
      chunkSize: this.config.isBase64 ? ((this.config.chunkSize  / 4) * 3) : this.config.chunkSize,
      fileLength: this.fileLength
    };

    this.FSName = this.collection.namingFunction ? (await this.collection.namingFunction(this.fileData)) : this.fileId;
    if (this.FSName !== this.fileId) {
      opts.FSName = this.FSName;
    }

    const response = await this._sendRequest({
      methodName: this.collection._methodNames._Start,
      payload: opts,
      timeout: 10000,
      headers: {
        'x-start': '1',
        'content-type': 'application/json',
      }
    });

    this.collection._debug('[FilesCollection] [UploadInstance] [prepare] [response]', this.fileId, response);
    if (!this.config.isEnded && response?.status === 204) {
      this.result.continueFunc = () => {
        this.collection._debug('[FilesCollection] [insert] [continueFunc]', this.fileId);
        this._upload();
      };
    }
  }

  /**
   * Adds a transformation function to the upload pipeline.
   * @param {function(string): string} func - A function to process the binary data.
   * @returns {UploadInstance} Returns the current UploadInstance for chaining.
   */
  pipe(func) {
    this.pipes.push(func);
    return this;
  }

  /**
   * Starts the file upload process.
   * @returns {Promise<FileUpload>} Resolves with the FileUpload instance.
   */
  async start() {
    let isUploadAllowed;
    if (this.config.disableUpload) {
      this.emit('error', new Meteor.Error(403, 'Uploads are disabled'), this);
      return this.result;
    }

    if (this.fileData.size <= 0) {
      this.emit('error', new Meteor.Error(400, 'Can\'t upload empty file'));
      return this.result;
    }

    try {
      if (this.config.onBeforeUpload && helpers.isFunction(this.config.onBeforeUpload)) {
        isUploadAllowed = await Promise.resolve(this.config.onBeforeUpload.call(Object.assign({}, this.result, this.collection._getUser()), this.fileData));
        if (isUploadAllowed !== true) {
          this.emit('error', new Meteor.Error(403, helpers.isString(isUploadAllowed) ? isUploadAllowed : 'config.onBeforeUpload() returned false'));
          return this.result;
        }
      }

      if (this.collection.onBeforeUpload && helpers.isFunction(this.collection.onBeforeUpload)) {
        isUploadAllowed = await Promise.resolve(this.collection.onBeforeUpload.call(Object.assign({}, this.result, this.collection._getUser()), this.fileData));
        if (isUploadAllowed !== true) {
          this.emit('error', new Meteor.Error(403, helpers.isString(isUploadAllowed) ? isUploadAllowed : 'collection.onBeforeUpload() returned false'));
          return this.result;
        }
      }
    } catch (error) {
      this.emit('error', new Meteor.Error(500, `Error in onBeforeUpload: ${error.message}`));
      return this.result;
    }

    this.trackerCompConnection = Tracker.autorun(() => {
      if (!this.result.onPause.curValue && !Meteor.status().connected) {
        this.collection._debug('[FilesCollection] [insert] [Tracker connection] [pause]', this.fileId);
        this.result.pause();
      } else if (this.result.onPause.curValue && Meteor.status().connected) {
        this.collection._debug('[FilesCollection] [insert] [Tracker connection] [continue]', this.fileId);
        this.result.continue();
      }
    });

    this.trackerCompPause = Tracker.autorun(() => {
      if (this.result.onPause.get() === true) {
        this.collection._debug('[FilesCollection] [insert] [Tracker pause] [abort]', this.fileId);
        // eslint-disable-next-line guard-for-in
        for (const uid in this.fetchControllers) {
          if (this.fetchControllers[uid]) {
            this.fetchControllers[uid].abort(new Meteor.Error(412, 'Upload set to pause'));
            delete this.fetchControllers[uid];
          }
          if (this.fetchTimeouts[uid]) {
            clearTimeout(this.fetchTimeouts[uid]);
            delete this.fetchTimeouts[uid];
          }
        }
      }
    });

    if (this.worker) {
      this.collection._debug('[FilesCollection] [insert] using WebWorkers', this.fileId);
      this.worker.onmessage = (evt) => {
        if (evt.data.error) {
          this.collection._debug('[FilesCollection] [insert] [worker] [onmessage] [ERROR:]', this.fileId, evt.data.error);
          this._proceedChunk(evt.data.chunkId);
        } else {
          this._sendChunk(evt);
        }
      };

      this.worker.onerror = (e) => {
        this.collection._debug('[FilesCollection] [insert] [worker] [onerror] [ERROR:]', this.fileId, e);
        this.emit('error', new Meteor.Error(500, e.message));
      };
    } else {
      this.collection._debug('[FilesCollection] [insert] using MainThread', this.fileId);
    }

    await this._prepare();
    return this.result;
  }

  /**
   * Configures the upload instance for manual control.
   * @returns {FileUpload} Returns the FileUpload instance.
   */
  manual() {
    this.result.start = async () => {
      this.emit('start');
    };

    const self = this;
    this.result.pipe = function (func) {
      self.pipe(func);
      return this;
    };
    return this.result;
  }
}
