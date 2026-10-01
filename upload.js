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
 * @const {number} RETRY_BASE_DELAY - First retry delay in milliseconds, doubled on each next attempt
 */
const RETRY_BASE_DELAY = 500;
/**
 * @const {number} RETRY_MAX_DELAY - Upper limit of a retry delay in milliseconds
 */
const RETRY_MAX_DELAY = 10000;
/**
 * @const {number} MAX_ATTEMPTS - Max consecutive failed attempts of a Start or EOF request, and of a chunk rejected by the server with a retryable status
 */
const MAX_ATTEMPTS = 5;
/**
 * @const {number} MAX_CHUNK_NETWORK_ATTEMPTS - Max consecutive attempts of one chunk that fail at the network level (no response from the server)
 */
const MAX_CHUNK_NETWORK_ATTEMPTS = 10;
/**
 * @const {Set<number>} RETRYABLE_STATUS - Server statuses that mean "try again"
 */
const RETRYABLE_STATUS = new Set([502, 503, 504]);
/**
 * @const {number} MAX_CHUNK_SIZE - Largest chunk the server accepts, in bytes (see `MAX_CHUNK_SIZE` in server.js)
 */
const MAX_CHUNK_SIZE = 16 * 1024 * 1024;

/**
 * @private
 * @summary Returns `true` when the DDP connection used for the upload is connected. Reactive
 * @param {DDP.DDPStatic} [ddp] - `Meteor` or a connection returned from `DDP.connect()`
 * @returns {boolean}
 */
const isDdpConnected = (ddp) => {
  if (ddp && helpers.isFunction(ddp.status)) {
    return !!ddp.status().connected;
  }
  return Meteor.status().connected;
};

/**
 * @private
 * @summary Wrap any thrown value into a `Meteor.Error`
 * @param {*} error - Error to wrap
 * @param {number} [code=500] - Error code to use for non-Meteor errors
 * @returns {Meteor.Error}
 */
const toMeteorError = (error, code = 500) => {
  if (error instanceof Meteor.Error) {
    return error;
  }
  return new Meteor.Error(code, `${error?.message || error}`);
};

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
    this.isAutoPaused = false;
    this.estimateTime = new ReactiveVar(1000);
    this.estimateSpeed = new ReactiveVar(0);
    this.remainingTime = new ReactiveVar('00:00:00');
    // Created when the upload starts, see `_startEstimateTimer()`
    this.estimateTimer = null;
  }

  /**
   * Starts the "remaining time" countdown. Called when the upload starts.
   * @returns {void}
   */
  _startEstimateTimer() {
    if (this.estimateTimer) {
      return;
    }

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
   * Stops the "remaining time" countdown.
   * @returns {void}
   */
  _stopEstimateTimer() {
    if (this.estimateTimer) {
      Meteor.clearInterval(this.estimateTimer);
      this.estimateTimer = null;
    }
  }

  /**
   * Returns `true` when the upload is aborted, failed, or completed.
   * @returns {boolean}
   */
  _isFinished() {
    const state = this.state.get();
    return state === 'aborted' || state === 'completed';
  }

  /**
   * Pauses the file upload.
   * @returns {void}
   */
  pause() {
    this.config._debug('[FilesCollection] [insert] [.pause()]');
    this._pause(false);
  }

  /**
   * Pauses the upload.
   * @param {boolean} isAuto - `true` when paused because the connection is lost. Only such pause is resumed automatically on reconnect
   * @returns {void}
   */
  _pause(isAuto) {
    if (this._isFinished()) {
      return;
    }

    if (!this.onPause.get()) {
      this.isAutoPaused = isAuto;
      this.onPause.set(true);
      this.state.set('paused');
      this.emit('pause', this.file);
    } else if (!isAuto) {
      // Paused by the user while auto-paused: do not resume on reconnect
      this.isAutoPaused = false;
    }
  }

  /**
   * Resumes the file upload if paused.
   * @returns {void}
   */
  continue() {
    this.config._debug('[FilesCollection] [insert] [.continue()]');
    if (this._isFinished()) {
      return;
    }

    if (this.onPause.get() && isDdpConnected(this.config.ddp)) {
      this.isAutoPaused = false;
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
   * Aborts the file upload. Does nothing when the upload is already aborted, failed, or completed.
   * @returns {Promise<void>} A promise that resolves when the abort process is complete. Never rejects
   */
  async abort() {
    this.config._debug('[FilesCollection] [insert] [.abort()]');
    if (this._isFinished()) {
      return;
    }

    this.pause();
    this.config._onEnd();
    this.state.set('aborted');
    if (this.config.onAbort) {
      this.config.onAbort.call(this, this.file);
    }
    this.emit('abort', this.file);

    if (helpers.isFunction(this.config._abortOnServer)) {
      await this.config._abortOnServer();
      return;
    }

    try {
      await this.config.ddp.callAsync(this.config._Abort, this.config.fileId);
    } catch (abortError) {
      this.config._debug('[FilesCollection] [insert] [.abort()] [_Abort] Error:', abortError);
    }
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
 *
 * Upload runs one request at a time: Start, then chunks `1..fileLength` in order, then EOF.
 * `_upload()` sends the next request, unless the upload is ended, paused, waiting for a retry, or a request is in flight.
 * `sentChunks` grows only when the server acknowledges chunk `sentChunks + 1`.
 * Network failures and retryable server statuses (502, 503, 504) are retried with capped exponential backoff.
 * A chunk that fails at the network level 10 times in a row ends the upload with an error.
 * Other server errors end the upload with `Meteor.Error(status, reason)`.
 */
export class UploadInstance extends EventEmitter {
  /**
   * Constructs an UploadInstance.
   * @param {UploadInstanceConfig} config - The upload instance configuration.
   * @param {FilesCollection} collection - The FilesCollection instance.
   */
  constructor(config, collection) {
    super();
    // Own copy: the user's config object can be reused for another upload
    this.config = Object.assign({}, config);
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
        throw new Meteor.Error(400, '"fileName" must be specified for base64 upload!');
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
        throw new Meteor.Error(400, '"type" must be specified for base64 upload! And represent mime-type of the file');
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
      throw new Meteor.Error(500, '[FilesCollection] [insert] Did you forget to pass a File itself?');
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

    // Web Worker, `beforeunload` listener, and timers are created in `start()`
    this.worker = null;
    this.fetchControllers = {};
    this.fetchTimeouts = {};
    this.config._debug = this.collection._debug;
    this.config.debug = this.collection.debug;
    this.transferTime = 0;
    this.trackerCompConnection = null;
    this.trackerCompPause = null;
    this.sentChunks = 0;
    this.fileLength = 1;
    this.startTime = {};
    this.EOFsent = false;
    this.isStarted = false;
    this.startSent = false;
    this.startMaybeReceived = false;
    this.inFlight = null;
    this.retryAttempt = 0;
    this.retryTimer = null;
    this.isReadEnd = false;
    this.hasTimers = false;
    this.fileId = this.config.fileId || Random.id();
    this.pipes = [];

    this.fileData = Object.assign(this.fileData, this.collection._getExt(this.fileData.name), { mime: this.collection._getMimeType(this.fileData) });
    this.fileData['mime-type'] = this.fileData.mime;

    this.result = new FileUpload(Object.assign({}, this.config, {
      fileData: this.fileData,
      fileId: this.fileId,
      _Abort: this.collection._methodNames._Abort
    }));

    this.beforeunload = (e) => {
      const message = helpers.isFunction(this.collection.onbeforeunloadMessage) ? this.collection.onbeforeunloadMessage.call(this.result, this.fileData) : this.collection.onbeforeunloadMessage;

      if (e) {
        e.returnValue = message;
      }
      return message;
    };

    this.result.config.beforeunload = this.beforeunload;
    this.result.config._onEnd = () => this.emit('_onEnd');
    this.result.config._abortOnServer = () => this._abortOnServer();

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
    this.addListener('start', () => {
      this.start().catch((error) => {
        this.collection._debug('[FilesCollection] [UploadInstance] [start] Error:', error);
      });
    });

    this.addListener('calculateStats', helpers.throttle(() => {
      if (this.config.isEnded || this.result.progress.get() >= 100) {
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
      this._cancelPending(new Meteor.Error(200, 'Upload has finished'));
      this.result._stopEstimateTimer();
      if (this.worker) {
        this.worker.terminate();
        this.worker = null;
      }
      if (this.trackerCompConnection) {
        this.trackerCompConnection.stop();
        this.trackerCompConnection = null;
      }
      if (this.trackerCompPause) {
        this.trackerCompPause.stop();
        this.trackerCompPause = null;
      }
      window.removeEventListener('beforeunload', this.beforeunload, false);
      if (this.hasTimers) {
        this.hasTimers = false;
        // eslint-disable-next-line no-console
        console.timeEnd(`insert ${this.fileData.name}`);
        if (!this.isReadEnd) {
          // eslint-disable-next-line no-console
          console.timeEnd(`loadFile ${this.fileData.name}`);
        }
      }
    });
  }

  /**
   * Returns `true` when the DDP connection of this upload is connected. Reactive
   * @returns {boolean}
   */
  _isConnected() {
    return isDdpConnected(this.config.ddp);
  }

  /**
   * Returns DDP session id of `Meteor.connection`, sent as `x-mtok` header over HTTP. Same value as the `x_mtok` cookie
   * @returns {string|null}
   */
  _getSessionToken() {
    const connection = Meteor.connection;
    const sessionId = helpers.isObject(connection) ? connection._lastSessionId : null;
    return (helpers.isString(sessionId) && sessionId.length) ? sessionId : null;
  }

  /**
   * Aborts HTTP requests in flight and the scheduled retry.
   * @param {Meteor.Error} reason - Abort reason passed to `AbortController#abort()`
   * @returns {void}
   */
  _cancelPending(reason) {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    for (const uid of Object.keys(this.fetchControllers)) {
      this.fetchControllers[uid].abort(reason);
      delete this.fetchControllers[uid];
    }

    for (const uid of Object.keys(this.fetchTimeouts)) {
      clearTimeout(this.fetchTimeouts[uid]);
      delete this.fetchTimeouts[uid];
    }
  }

  /**
   * Removes the upload on the server. Only when the server may have the upload: Start succeeded, is in flight, or failed without a response. Never rejects
   * @returns {Promise<void>}
   */
  async _abortOnServer() {
    if (!this.isStarted && !this.startMaybeReceived && this.inFlight?.kind !== 'start') {
      return;
    }

    try {
      await this.config.ddp.callAsync(this.collection._methodNames._Abort, this.fileId);
    } catch (abortError) {
      // 404 when the upload is unknown, finished, or already removed
      this.collection._debug('[FilesCollection] [UploadInstance] [_abortOnServer] Error:', this.fileId, abortError);
    }
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
   * Finalizes the upload process. Runs once, does nothing after the upload is ended or aborted.
   * On error: sets state to `'aborted'`, removes the upload on the server, emits `error` and calls `onError`.
   * On success: sets progress to 100 and state to `'completed'`, then emits `uploaded` and calls `onUploaded`.
   * @param {Meteor.Error} [error] - An optional error if the upload failed.
   * @param {*} [data] - Additional data associated with the upload.
   * @returns {FileUpload} Returns the FileUpload result.
   */
  _end(error, data) {
    this.collection._debug('[FilesCollection] [UploadInstance] [end]', this.fileId, { error, data });
    if (this.config.isEnded) {
      return this.result;
    }

    if (error) {
      this.collection._debug('[FilesCollection] [insert] [end] Error:', error);
      this.emit('_onEnd');
      this.result.state.set('aborted');
      this._abortOnServer();
      this._runCallback('error', () => this.result.emit('error', error, this.fileData));
      if (this.config.onError) {
        this._runCallback('onError', () => this.config.onError.call(this.result, error, this.fileData));
      }
    } else {
      this._setProgress(100);
      this.emit('_onEnd');
      this.result.state.set('completed');
      this._runCallback('uploaded', () => this.result.emit('uploaded', error, data));
      if (this.config.onUploaded) {
        this._runCallback('onUploaded', () => this.config.onUploaded.call(this.result, error, data));
      }
      this._runCallback('afterUpload', () => this.collection.emit('afterUpload', data));
    }
    this._runCallback('end', () => this.result.emit('end', error, (data || this.fileData)));
    return this.result;
  }

  /**
   * Runs a user callback or event emit from `_end()`. A thrown exception is reported with `console.error` and does not stop the next callbacks
   * @param {string} name - Callback name, used in the log
   * @param {function} func - Callback
   * @returns {void}
   */
  _runCallback(name, func) {
    try {
      func();
    } catch (callbackError) {
      // A bug in user code: report it at error level, not as a debug message
      // eslint-disable-next-line no-console
      console.error(`[FilesCollection] [insert] Exception in "${name}" callback:`, callbackError);
    }
  }

  /**
   * Runs `_upload()` without waiting for it, errors end the upload.
   * @returns {void}
   */
  _pump() {
    this._upload().catch((error) => {
      this.emit('error', toMeteorError(error));
    });
  }

  /**
   * Handles the outcome of a Start, chunk, or EOF request: schedules a retry, auto-pauses, ends the upload with an error, or sends the next request.
   * @param {Object} outcome - Value returned from `_sendRequest()`
   * @returns {void}
   */
  _afterRequest(outcome) {
    const request = this.inFlight;
    this.inFlight = null;
    if (this.config.isEnded) {
      return;
    }

    if (outcome.ok) {
      this.retryAttempt = 0;
      this._pump();
      return;
    }

    if (outcome.kind === 'fatal') {
      this.emit('error', outcome.error);
      return;
    }

    if (outcome.kind === 'cancelled' || this.result.onPause.get()) {
      // Paused, `continue()` sends the request again
      return;
    }

    if (outcome.kind === 'network' && !this._isConnected()) {
      // Resumed by the connection tracker on reconnect
      this.result._pause(true);
      return;
    }

    this.retryAttempt++;
    const isLimited = outcome.kind === 'retry' || request?.kind !== 'chunk';
    if (isLimited && this.retryAttempt >= MAX_ATTEMPTS) {
      this.emit('error', outcome.error || new Meteor.Error(503, 'Upload failed after several attempts, try again later'));
      return;
    }

    if (!isLimited && this.retryAttempt >= MAX_CHUNK_NETWORK_ATTEMPTS) {
      // The server may also close the connection on a chunk body that is too large (for example a pipe that grows the chunk)
      this.emit('error', new Meteor.Error(503, `Upload failed: chunk ${request.chunkId} failed after ${MAX_CHUNK_NETWORK_ATTEMPTS} attempts. Check your connection and try again. One possible cause is a chunk larger than chunkSize, for example from a pipe that grows the data, which the server rejects`));
      return;
    }

    const delay = Math.min(RETRY_BASE_DELAY * (2 ** (this.retryAttempt - 1)), RETRY_MAX_DELAY);
    this.collection._debug('[FilesCollection] [UploadInstance] [retry]', this.fileId, { request, attempt: this.retryAttempt, delay, error: outcome.error });
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this._pump();
    }, delay);
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
    const chunkId = evt.data.chunkId;
    this.collection._debug('[FilesCollection] [UploadInstance] [sendChunk]', this.fileId, chunkId);
    if (this.config.isEnded || this.inFlight?.kind !== 'chunk' || this.inFlight.chunkId !== chunkId) {
      // Stale read result
      return;
    }

    if (this.result.onPause.get()) {
      // Paused while reading, `continue()` reads this chunk again
      this.inFlight = null;
      return;
    }

    const opts = {
      fileId: this.fileId,
      binData: evt.data.bin,
      chunkId
    };

    try {
      if (this.config.isBase64 && helpers.isString(opts.binData)) {
        const pad = (4 - (opts.binData.length % 4)) % 4;
        opts.binData += '='.repeat(pad);
      }

      this.result.emit('data', evt.data.bin);
      // Pipes run in reverse order of registration: the last added pipe runs first
      for (let i = this.pipes.length - 1; i >= 0; i--) {
        opts.binData = this.pipes[i](opts.binData);
      }
    } catch (pipeError) {
      this.inFlight = null;
      this.emit('error', toMeteorError(pipeError));
      return;
    }

    if (this.fileLength === chunkId && !this.isReadEnd) {
      this.isReadEnd = true;
      if (this.hasTimers) {
        // eslint-disable-next-line no-console
        console.timeEnd(`loadFile ${this.fileData.name}`);
      }
      this.result.emit('readEnd');
    }

    if (!opts.binData) {
      this.collection._debug('[FilesCollection] [sendChunk] binData is empty! Can not send empty chunk!');
      this.inFlight = null;
      this.emit('error', new Meteor.Error(400, `Can not read chunk #${chunkId} of the file`));
      return;
    }

    this.startTime[chunkId] = Date.now();
    const outcome = await this._sendRequest({
      methodName: this.collection._methodNames._Write,
      payload: opts,
      timeout: 25000,
      headers: {
        'x-fileid': opts.fileId,
        'x-chunkid': `${opts.chunkId}`,
        'content-type': 'text/plain'
      }
    });

    if (outcome.ok && !this.config.isEnded && chunkId === this.sentChunks + 1) {
      this.sentChunks = chunkId;
      this.transferTime += Date.now() - this.startTime[chunkId];
      delete this.startTime[chunkId];
      this.emit('calculateStats');
    }
    this._afterRequest(outcome);
  }

  /**
   * Sends the Start request. A 409 "Upload already exists" after an attempt without a response means the earlier attempt reached the server.
   * @returns {Promise<void>}
   */
  async _sendStart() {
    this.collection._debug('[FilesCollection] [UploadInstance] [sendStart]', this.fileId);
    this.inFlight = { kind: 'start' };
    this.startSent = true;
    let outcome = await this._sendRequest({
      methodName: this.collection._methodNames._Start,
      payload: this.startOpts,
      timeout: 10000,
      headers: {
        'x-start': '1',
        'content-type': 'application/json',
      }
    });

    this.collection._debug('[FilesCollection] [UploadInstance] [sendStart] [response]', this.fileId, outcome);
    if (outcome.ok) {
      this.isStarted = true;
    } else if (outcome.kind === 'fatal' && this.startMaybeReceived && outcome.error?.error === 409 && outcome.error.reason === 'Upload already exists') {
      // Upload is owned by this user, otherwise chunks fail with 403
      this.isStarted = true;
      outcome = { ok: true };
    } else if (outcome.kind !== 'fatal') {
      this.startMaybeReceived = true;
    }
    this._afterRequest(outcome);
  }

  /**
   * Sends an EOF (end-of-file) marker to the server. Ends the upload when the server returns the file.
   * @returns {Promise<void>}
   */
  async _sendEOF() {
    this.collection._debug('[FilesCollection] [UploadInstance] [sendEOF]', this.fileId, this.EOFsent, this.config.isEnded);
    if (this.EOFsent) {
      return;
    }

    this.inFlight = { kind: 'eof' };
    const opts = {
      eof: true,
      fileId: this.fileId,
      binData: '',
    };

    const outcome = await this._sendRequest({
      methodName: this.collection._methodNames._Write,
      payload: opts,
      // Server runs `onAfterUpload` before it responds
      timeout: 60000,
      headers: {
        'x-eof': '1',
        'x-fileid': opts.fileId,
        'content-type': 'text/plain',
      }
    });

    if (outcome.ok && outcome.result?.status === 200) {
      this.inFlight = null;
      this.EOFsent = true;
      this.retryAttempt = 0;
      if (!this.config.isEnded) {
        this._end(outcome.result.error, outcome.result);
      }
      return;
    }

    if (outcome.ok) {
      this._afterRequest({ ok: false, kind: 'fatal', error: new Meteor.Error(500, 'Unexpected response to EOF request') });
      return;
    }
    this._afterRequest(outcome);
  }

  /**
   * Classifies a failed request.
   * @param {*} error - Error thrown by the request, or `Meteor.Error` built from the response
   * @param {boolean} isNetwork - `true` when the request got no response from the server
   * @returns {{ok: false, kind: 'cancelled'|'network'|'retry'|'fatal', error: Meteor.Error}}
   */
  _failure(error, isNetwork) {
    if (this.config.isEnded) {
      return { ok: false, kind: 'cancelled', error };
    }

    if (isNetwork) {
      return { ok: false, kind: 'network', error: toMeteorError(error, 503) };
    }

    if (RETRYABLE_STATUS.has(error?.error)) {
      return { ok: false, kind: 'retry', error };
    }
    return { ok: false, kind: 'fatal', error: toMeteorError(error) };
  }

  /**
   * Sends a network request for file upload.
   * @param {Object} conf - The configuration for the network request.
   * @param {string} conf.methodName - The method name to call.
   * @param {Object} conf.payload - The payload to send.
   * @param {number} [conf.timeout=25000] - HTTP request timeout in milliseconds.
   * @param {Object} conf.headers - HTTP request headers.
   * @returns {Promise<{ok: boolean, result?: Object, kind?: 'cancelled'|'network'|'retry'|'fatal', error?: Meteor.Error}>} `ok: true` with `result` (`{status: 200|204, ...}`) on success. Never rejects
   */
  async _sendRequest(conf) {
    this.collection._debug('[FilesCollection] [UploadInstance] [sendRequest]', this.fileId, { conf });
    if (this.config.transport === 'ddp') {
      try {
        // No `noRetry` option: DDP re-sends this call after reconnect, and `inFlight` blocks a duplicate request meanwhile.
        // `noRetry` makes ddp-client 3.x throw "No methods outstanding but nonempty block" on reconnect
        const result = await this.config.ddp.applyAsync(conf.methodName, [conf.payload], { returnServerResultPromise: true });
        if (result?.status === 200 || result?.status === 204) {
          return { ok: true, result };
        }
        return this._failure(new Meteor.Error(500, 'Unexpected response from the server'), false);
      } catch (ddpError) {
        this.collection._debug('[FilesCollection] [UploadInstance] [sendRequest] [DDP] [ERROR:]', this.fileId, ddpError);
        // DDP re-sends a call after reconnect, so a rejection is a server error, unless the connection is down
        return this._failure(ddpError, !this._isConnected());
      }
    }

    let body;
    if (helpers.isString(conf.payload?.binData) && conf.payload.binData.length) {
      body = conf.payload.binData;
    } else {
      // Deep copy: do not turn Dates in the user's `meta` into strings
      const payload = helpers.cloneDeep(conf.payload || {});
      if (helpers.isObject(payload?.file?.meta)) {
        payload.file.meta = fixJSONStringify(payload.file.meta);
      }
      body = JSON.stringify(payload);
    }

    const headers = { ...conf.headers };
    const sessionToken = this._getSessionToken();
    if (sessionToken) {
      headers['x-mtok'] = sessionToken;
    }

    const uid = Random.id();
    const controller = new AbortController();
    let isTimedOut = false;
    this.fetchControllers[uid] = controller;
    this.fetchTimeouts[uid] = setTimeout(() => {
      isTimedOut = true;
      controller.abort(new Meteor.Error(503, 'Send Request Timeout'));
    }, conf.timeout || 25000);

    let response;
    let jsonData = null;
    try {
      response = await fetch(`${_rootUrl}${this.collection.downloadRoute}/${this.collection.collectionName}/__upload`, {
        method: 'POST',
        signal: controller.signal,
        body,
        cache: 'no-cache',
        credentials: 'include',
        mode: 'cors',
        headers
      });

      if ((response.headers.get('content-type') || '').includes('application/json')) {
        try {
          jsonData = await response.json();
        } catch (jsonError) {
          if (jsonError?.name === 'AbortError' || controller.signal.aborted) {
            throw jsonError;
          }
          this.collection._debug('[FilesCollection] [UploadInstance] [sendRequest] [parseJSON] [ERROR:]', this.fileId, jsonError, response);
        }
      }
    } catch (requestError) {
      this.collection._debug('[FilesCollection] [UploadInstance] [sendRequest] [CAUGHT ERROR:]', this.fileId, requestError, conf);
      if (!isTimedOut && this.result.onPause.get()) {
        // Aborted by `pause()`
        return { ok: false, kind: 'cancelled', error: toMeteorError(requestError) };
      }

      // `TypeError` from `fetch()` is a network failure; `AbortError` here is the request timeout
      const isNetwork = isTimedOut || requestError instanceof TypeError || requestError?.name === 'AbortError' || requestError?.name === 'TimeoutError';
      return this._failure(isTimedOut ? new Meteor.Error(503, 'Send Request Timeout') : requestError, isNetwork);
    } finally {
      clearTimeout(this.fetchTimeouts[uid]);
      delete this.fetchControllers[uid];
      delete this.fetchTimeouts[uid];
    }

    const status = response.status;
    if (status === 200 || status === 204) {
      const result = { status, ...(helpers.isObject(jsonData) ? jsonData : {}) };
      if (helpers.isObject(result.meta)) {
        result.meta = fixJSONParse(result.meta);
      }
      return { ok: true, result };
    }

    let reason = (helpers.isObject(jsonData) && helpers.isString(jsonData.reason)) ? jsonData.reason : null;
    if (!reason) {
      if (status === 408) {
        reason = 'Can\'t continue upload, session expired. Please, start upload again.';
      } else if (status === 405) {
        reason = 'Uploads are disabled';
      } else {
        reason = response.statusText || 'Unexpected error occurred during upload, try again later';
      }
    }
    return this._failure(new Meteor.Error(status, reason), false);
  }

  /**
   * Reads and sends a specific chunk from the file in the main thread.
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

    if (!window.FileReader) {
      this.emit('error', new Meteor.Error(400, 'File API is not supported in this Browser!'));
      return;
    }

    const fileReader = new window.FileReader();
    fileReader.onload = () => {
      const dataUrl = helpers.isString(fileReader.result) ? fileReader.result : '';
      this._sendChunk({
        data: {
          bin: dataUrl.split(',')[1],
          chunkId
        }
      }).catch((error) => {
        this.emit('error', toMeteorError(error));
      });
    };

    fileReader.onerror = () => {
      this.emit('error', new Meteor.Error(500, `Can not read the file: ${fileReader.error?.message || 'FileReader error'}`));
    };

    fileReader.readAsDataURL(chunk);
  }

  /**
   * Sends the next request: Start, the next chunk, or EOF.
   * Does nothing when the upload is ended or paused, a request is in flight, or a retry is scheduled.
   * @returns {Promise<UploadInstance>} Resolves with the current UploadInstance.
   */
  async _upload() {
    if (this.config.isEnded || this.result.onPause.get() || this.inFlight || this.retryTimer) {
      return this;
    }

    if (!this.isStarted) {
      if (!this.startOpts) {
        // `_prepare()` is still running (async `namingFunction`), it sends Start when ready
        return this;
      }
      await this._sendStart();
      return this;
    }

    if (this.sentChunks < this.fileLength) {
      const chunkId = this.sentChunks + 1;
      this.inFlight = { kind: 'chunk', chunkId };
      if (this.worker) {
        this.worker.postMessage({
          f: this.config.file,
          cc: chunkId,
          cs: this.config.chunkSize,
          ib: this.config.isBase64
        });
      } else {
        await this._proceedChunk(chunkId);
      }
      return this;
    }

    await this._sendEOF();
    return this;
  }

  /**
   * Prepares the file upload by setting chunk sizes and sends the Start request.
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
      // 4 base64 characters are 3 bytes
      const maxBase64ChunkSize = Math.floor((MAX_CHUNK_SIZE / 3)) * 4;
      this.config.chunkSize = Math.min(Math.max(4, Math.floor(this.config.chunkSize / 4) * 4), maxBase64ChunkSize);
      _len = Math.ceil(this.config.file.length / this.config.chunkSize);
    } else {
      this.config.chunkSize = Math.min(Math.max(8, Math.floor(this.config.chunkSize / 8) * 8), MAX_CHUNK_SIZE);
      _len = Math.ceil(this.fileData.size / this.config.chunkSize);
    }

    this.fileLength = _len <= 0 ? 1 : _len;
    this.result.config.fileLength = this.fileLength;

    const opts = {
      file: this.fileData,
      fileId: this.fileId,
      chunkSize: this.config.isBase64 ? ((this.config.chunkSize / 4) * 3) : this.config.chunkSize,
      fileLength: this.fileLength
    };

    this.FSName = this.collection.namingFunction ? (await this.collection.namingFunction(this.fileData)) : this.fileId;
    if (this.FSName !== this.fileId) {
      opts.FSName = this.FSName;
    }

    this.startOpts = opts;
    await this._upload();
  }

  /**
   * Adds a transformation function to the upload pipeline.
   * Pipes run in reverse order of registration: the last added pipe runs first.
   * @param {function(string): string} func - A function to process the binary data.
   * @returns {UploadInstance} Returns the current UploadInstance for chaining.
   */
  pipe(func) {
    this.pipes.push(func);
    return this;
  }

  /**
   * Creates the Web Worker, the `beforeunload` listener, timers, and trackers. Called once from `start()`.
   * @returns {void}
   */
  _setup() {
    if (this.collection.debug) {
      this.hasTimers = true;
      // eslint-disable-next-line no-console
      console.time(`insert ${this.fileData.name}`);
      // eslint-disable-next-line no-console
      console.time(`loadFile ${this.fileData.name}`);
    }

    if (this.collection._supportWebWorker && this.config.allowWebWorkers) {
      try {
        this.worker = new Worker(this.collection._webWorkerUrl);
      } catch (wwError) {
        this.worker = null;
        this.collection._debug('[FilesCollection] [insert] [create WebWorker]: Can\'t create WebWorker, fallback to MainThread', wwError);
      }
    }

    if (this.worker) {
      this.collection._debug('[FilesCollection] [insert] using WebWorkers', this.fileId);
      this.worker.onmessage = (evt) => {
        if (evt.data.error) {
          this.collection._debug('[FilesCollection] [insert] [worker] [onmessage] [ERROR:]', this.fileId, evt.data.error);
          if (!this.config.isEnded && this.inFlight?.kind === 'chunk' && this.inFlight.chunkId === evt.data.chunkId) {
            // Read this chunk in the main thread
            this._proceedChunk(evt.data.chunkId).catch((error) => {
              this.emit('error', toMeteorError(error));
            });
          }
          return;
        }

        this._sendChunk(evt).catch((error) => {
          this.emit('error', toMeteorError(error));
        });
      };

      this.worker.onerror = (e) => {
        this.collection._debug('[FilesCollection] [insert] [worker] [onerror] [ERROR:]', this.fileId, e);
        this.emit('error', new Meteor.Error(500, e.message));
      };
    } else {
      this.collection._debug('[FilesCollection] [insert] using MainThread', this.fileId);
    }

    window.addEventListener('beforeunload', this.beforeunload, false);
    this.result._startEstimateTimer();

    // Pause when the connection is lost, resume on reconnect. Does not resume an upload paused by the user
    this.trackerCompConnection = Tracker.autorun(() => {
      const isConnected = this._isConnected();
      const isPaused = this.result.onPause.get();
      Tracker.nonreactive(() => {
        if (!isConnected && this.inFlight?.kind === 'start') {
          // DDP re-sends Start after reconnect, the first call may have reached the server
          this.startMaybeReceived = true;
        }

        if (!isPaused && !isConnected) {
          this.collection._debug('[FilesCollection] [insert] [Tracker connection] [pause]', this.fileId);
          this.result._pause(true);
        } else if (isPaused && isConnected && this.result.isAutoPaused) {
          this.collection._debug('[FilesCollection] [insert] [Tracker connection] [continue]', this.fileId);
          this.result.continue();
        }
      });
    });

    this.trackerCompPause = Tracker.autorun(() => {
      if (this.result.onPause.get() === true) {
        this.collection._debug('[FilesCollection] [insert] [Tracker pause] [abort]', this.fileId);
        Tracker.nonreactive(() => {
          this._cancelPending(new Meteor.Error(412, 'Upload set to pause'));
        });
      }
    });

    this.result.continueFunc = () => {
      this.collection._debug('[FilesCollection] [insert] [continueFunc]', this.fileId);
      // Fresh retry budget after pause and continue
      this.retryAttempt = 0;
      this._pump();
    };
  }

  /**
   * Starts the file upload process. Runs once.
   * @returns {Promise<FileUpload>} Resolves with the FileUpload instance. Rejects, after emitting `error`, on an unexpected exception
   */
  async start() {
    if (this.isStartCalled || this.config.isEnded) {
      return this.result;
    }
    this.isStartCalled = true;

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

    if (this.config.isEnded) {
      // Aborted while `onBeforeUpload` was running
      return this.result;
    }

    try {
      this._setup();
      await this._prepare();
    } catch (startError) {
      this.collection._debug('[FilesCollection] [UploadInstance] [start] Error:', this.fileId, startError);
      const error = toMeteorError(startError);
      this.emit('error', error);
      throw error;
    }
    return this.result;
  }

  /**
   * Configures the upload instance for manual control.
   * @returns {FileUpload} Returns the FileUpload instance.
   */
  manual() {
    this.result.start = async () => {
      await this.start();
    };

    const self = this;
    this.result.pipe = function (func) {
      self.pipe(func);
      return this;
    };
    return this.result;
  }
}
