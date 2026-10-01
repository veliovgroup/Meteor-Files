import fs from 'node:fs';
import nodePath from 'node:path';
import { Meteor } from 'meteor/meteor';
import { helpers } from './lib.js';

/**
 * @const {FileHandleCache} fhCache - FileHandle Cache, keyed by `${fileId}:${path}`
 */
const fhCache = new Map();

/**
 * @const {function} noop - No Operation function
 */
const noop = () => {};

/**
 * @function fileIdentity
 * @param {{dev: *, ino: *, birth?: *}} identity - Device, inode, and birth time in nanoseconds
 * @summary Normalize a file identity to strings, so it can be stored in MongoDB and compared with BigInt stats.
 * A birth time of `0` means the file system does not report it, so it is left out
 * @returns {{dev: string, ino: string, birth?: string}}
 */
const fileIdentity = ({ dev, ino, birth }) => {
  const identity = { dev: `${dev}`, ino: `${ino}` };
  if (birth !== undefined && birth !== null && `${birth}` !== '0') {
    identity.birth = `${birth}`;
  }
  return identity;
};

/**
 * @function isSameFile
 * @param {{dev: string, ino: string, birth?: string}|null} identity - Stored identity, see `fileIdentity`
 * @param {fs.BigIntStats|null} stats - Stats of an open or existing file
 * @summary Check that `stats` belong to the file with this identity.
 * Linux reuses an inode number right after unlink, so a replaced file can have the same dev and ino.
 * Birth time tells them apart. Records saved without it, and file systems without birth time, fall back to dev and ino
 * @returns {boolean}
 */
const isSameFile = (identity, stats) => {
  if (!identity || !stats || !stats.isFile() || `${stats.dev}` !== identity.dev || `${stats.ino}` !== identity.ino) {
    return false;
  }
  return !identity.birth || `${stats.birthtimeNs}` === identity.birth;
};

/**
 * @private
 * @locus Server
 * @class WriteStream
 * @param path {string} - Path to file on FS
 * @param maxLength {number} - Max amount of chunks in stream
 * @param file {Object} - Upload record, must have `chunkSize` (bytes per chunk)
 * @param permissions {number} - Permissions which will be set to open descriptor (octal), like: `0o611` or `0o777`. Default: 0644
 * @param parentDirPermissions {number} - Permissions which will be set to parent directory (octal), like: `0o611` or `0o777`. Default: 0755
 * @param [options] {Object} - Extra options
 * @param [options.exclusive=false] {boolean} - Create a new file, fail with `Meteor.Error(409)` if the file already exists. When `false` the file must already exist, it is never created
 * @param [options.identity] {{dev: string, ino: string, birth?: string}} - Expected identity of an existing file. When set, opening a different file fails with `Meteor.Error(409)`
 * @param [options.idleTimeout=0] {number} - Close the file handle after this many ms without writes, reopen on the next write. `0` disables
 * @param [options.fileId] {string} - Upload id, used as part of the file handle cache key
 * @param [options.onAbort] {function} - Called after the stream is aborted
 * @summary Writes chunks at their offsets into one file and tracks which chunks are written
 */
export default class WriteStream {
  constructor(path, maxLength, file, permissions, parentDirPermissions, options = {}) {
    this.path = helpers.isString(path) ? path.trim() : '';
    if (!this.path) {
      throw new Meteor.Error(400, '[FilesCollection] [new WriteStream(path)] [constructor] {path} must be a String!');
    }
    this.maxLength = maxLength;
    this.file = file;
    this.permissions = permissions;
    this.parentDirPermissions = parentDirPermissions;
    this.exclusive = options.exclusive === true;
    this.idleTimeout = (helpers.isNumber(options.idleTimeout) && options.idleTimeout > 0) ? options.idleTimeout : 0;
    this.cacheKey = `${options.fileId || file?.fileId || file?._id || ''}:${this.path}`;
    this.identity = (helpers.isObject(options.identity) && options.identity.dev && options.identity.ino) ? fileIdentity(options.identity) : null;
    this.onAbort = helpers.isFunction(options.onAbort) ? options.onAbort : null;
    this.opening = null;

    this.fh = null;
    this.ended = false;
    this.aborted = false;
    this.chunkIds = new Set();
    this.writtenChunks = 0;
    this.endRetries = 0;
    this.maxEndRetries = 1000;
    this.idleTimer = null;
    this.pendingWrites = 0;
  }

  /**
   * @memberOf WriteStream
   * @name init
   * @summary Initialize WriteStream, create fileHandle, ensure directory and file is writable
   * @returns {Promise<WriteStream>}
   */
  async init() {
    let fh;
    if (this.exclusive) {
      const dir = nodePath.dirname(this.path);
      try {
        await fs.promises.mkdir(dir, { recursive: true, mode: this.parentDirPermissions });
      } catch (mkdirError) {
        throw new Meteor.Error(500, '[FilesCollection] [writeStream] [init] [mkdir] ERROR: can not make/ensure directory', mkdirError?.code);
      }

      try {
        fh = await fs.promises.open(this.path, fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_EXCL, this.permissions);
      } catch (fsOpenError) {
        // Do not unlink here: the file belongs to someone else
        await this.stop(true);
        if (fsOpenError?.code === 'EEXIST') {
          throw new Meteor.Error(409, '[FilesCollection] [writeStream] [init] File already exists');
        }
        throw new Meteor.Error(500, '[FilesCollection] [writeStream] [init] [open] Error', fsOpenError?.code);
      }

      const stats = await fh.stat({ bigint: true });
      this.identity = fileIdentity({ dev: stats.dev, ino: stats.ino, birth: stats.birthtimeNs });
    } else {
      // Resume: never create the file, it must be the same file created at the start of the upload
      try {
        fh = await this._openExisting();
      } catch (openError) {
        await this.stop(true);
        throw openError;
      }

      const stats = await fh.stat();
      if (stats.size > 0) {
        // Chunks are written in order, so the existing size tells how many chunks are on disk
        const written = Math.min(this.maxLength, Math.ceil(stats.size / this.file.chunkSize));
        for (let i = 1; i <= written; i++) {
          this.chunkIds.add(i);
        }
        this.writtenChunks = this.chunkIds.size;
      }
    }

    this.fh = fh;
    fhCache.set(this.cacheKey, this);
    this._touch();
    return this;
  }

  /**
   * @memberOf WriteStream
   * @name _isSameFile
   * @param {fs.BigIntStats} stats - Stats of an open or existing file
   * @summary Check that `stats` belong to the file this stream created
   * @returns {boolean}
   */
  _isSameFile(stats) {
    return isSameFile(this.identity, stats);
  }

  /**
   * @memberOf WriteStream
   * @name _openExisting
   * @summary Open the existing upload file without creating it, and check its identity
   * @throws {Meteor.Error} 410 if the file is gone, 409 if it is a different file
   * @returns {Promise<FileHandle>}
   */
  async _openExisting() {
    let fh;
    try {
      fh = await fs.promises.open(this.path, fs.constants.O_RDWR);
    } catch (openError) {
      if (openError?.code === 'ENOENT') {
        throw new Meteor.Error(410, '[FilesCollection] [writeStream] Upload file is gone');
      }
      throw new Meteor.Error(500, '[FilesCollection] [writeStream] [open] Error', openError?.code);
    }

    let stats;
    try {
      stats = await fh.stat({ bigint: true });
    } catch (_statError) {
      stats = null;
    }

    if (!this._isSameFile(stats)) {
      await fh.close().catch(noop);
      throw new Meteor.Error(409, '[FilesCollection] [writeStream] Upload file was replaced');
    }
    return fh;
  }

  /**
   * @memberOf WriteStream
   * @name _touch
   * @summary Restart the idle timer, it closes the file handle after `idleTimeout` ms without writes
   * @returns {void}
   */
  _touch() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    if (!this.idleTimeout || this.ended) {
      return;
    }

    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      this._closeIdle();
    }, this.idleTimeout);

    if (typeof this.idleTimer?.unref === 'function') {
      this.idleTimer.unref();
    }
  }

  /**
   * @memberOf WriteStream
   * @name _closeIdle
   * @summary Close the file handle of an idle upload. The next `write()` reopens it
   * @returns {Promise<void>}
   */
  async _closeIdle() {
    if (this.ended || this.pendingWrites > 0 || this.opening || !this.fh) {
      return;
    }

    const fh = this.fh;
    this.fh = null;
    if (fhCache.get(this.cacheKey) === this) {
      fhCache.delete(this.cacheKey);
    }

    try {
      await fh.close();
    } catch (closeError) {
      Meteor._debug('[FilesCollection] [writeStream] [_closeIdle] [close] Error:', closeError);
    }
  }

  /**
   * @memberOf WriteStream
   * @name _ensureOpen
   * @summary Reopen the file handle closed by the idle timer
   * @returns {Promise<void>}
   */
  async _ensureOpen() {
    if (this.fh) {
      return;
    }

    if (!this.opening) {
      this.opening = (async () => {
        const fh = await this._openExisting();
        if (this.ended) {
          await fh.close().catch(noop);
          return;
        }
        this.fh = fh;
        fhCache.set(this.cacheKey, this);
      })().finally(() => {
        this.opening = null;
      });
    }

    await this.opening;
    if (!this.fh && !this.ended) {
      throw new Meteor.Error(500, '[FilesCollection] [writeStream] Can not reopen file');
    }
  }

  /**
   * @memberOf WriteStream
   * @name write
   * @param {number} num - Chunk position in a stream
   * @param {Buffer} chunk - Buffer (chunk binary data)
   * @summary Write chunk at its offset
   * @throws {Meteor.Error} 409 or 410 if the file was replaced or removed while the handle was closed
   * @returns {Promise<boolean>} - True if chunk was written to a file, false if chunk wasn't written
   */
  async write(num, chunk) {
    if (this.aborted || this.ended) {
      return false;
    }

    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    ++this.pendingWrites;
    try {
      await this._ensureOpen();
      if (this.aborted || this.ended) {
        return false;
      }

      const { bytesWritten } = await this.fh.write(chunk, 0, chunk.byteLength, (num - 1) * this.file.chunkSize);
      if (this.aborted || this.ended) {
        return false;
      }

      await this.fh.sync();
      if (bytesWritten !== chunk.byteLength) {
        return false;
      }

      this.chunkIds.add(num);
      this.writtenChunks = this.chunkIds.size;
      return true;
    } catch (error) {
      const isFileLost = error?.error === 409 || error?.error === 410;
      if (!isFileLost) {
        Meteor._debug('[FilesCollection] [writeStream] [write] [Error:]', error);
      }

      if (!this.ended) {
        await this.abort();
      }

      if (isFileLost) {
        // The upload file is gone or replaced, the upload can not continue
        throw error;
      }
    } finally {
      --this.pendingWrites;
      this._touch();
    }

    return false;
  }

  /**
   * @memberOf WriteStream
   * @name isComplete
   * @summary Check if every chunk from 1 to `maxLength` is written
   * @returns {boolean}
   */
  isComplete() {
    return this.chunkIds.size >= this.maxLength;
  }

  /**
   * @memberOf WriteStream
   * @name waitForCompletion
   * @summary Waits up to 25 seconds for all chunks to complete writing
   * @returns {Promise<boolean>} - `true` if file was fully written, `false` if writing was aborted and file removed
   */
  async waitForCompletion() {
    while (!this.aborted && !this.ended && !this.isComplete() && this.endRetries < this.maxEndRetries) {
      ++this.endRetries;
      await new Promise(resolve => setTimeout(resolve, 25));
    }

    if (this.aborted) {
      return false;
    }

    if (this.isComplete()) {
      return await this.stop(false);
    }

    await this.abort();
    return false;
  }

  /**
   * @memberOf WriteStream
   * @name end
   * @summary Finishes writing, only after all chunks are written
   * @returns {Promise<boolean>} - `true` if every chunk is written and the file is closed, `false` if the upload was aborted or is incomplete
   */
  async end() {
    if (this.aborted) {
      return false;
    }

    if (this.ended) {
      return true;
    }

    if (this.isComplete()) {
      return await this.stop(false);
    }

    if (await this.waitForCompletion()) {
      return true;
    }

    Meteor._debug('[FilesCollection] [writeStream] [end] waitForCompletion waited for 25 seconds to complete writing and failed with timeout', this.path);
    return false;
  }

  /**
   * @memberOf WriteStream
   * @name abort
   * @summary Aborts writing and removes created file, only if the file on disk is still the file this stream created. Does nothing when the stream already finished successfully
   * @returns {Promise<boolean>} - `true` if the stream is aborted, `false` if it already finished successfully
   */
  async abort() {
    if (this.aborted) {
      return true;
    }

    if (this.ended) {
      // Finished file must stay on disk
      return false;
    }

    await this.stop(true);

    let stats = null;
    try {
      stats = await fs.promises.lstat(this.path, { bigint: true });
    } catch (_statError) {
      stats = null;
    }

    if (this._isSameFile(stats)) {
      try {
        await fs.promises.unlink(this.path);
      } catch (unlinkError) {
        Meteor._debug('[FilesCollection] [writeStream] [abort] [unlink] [ERROR:]', this.path, unlinkError);
      }
    }

    if (this.onAbort) {
      try {
        await this.onAbort(this);
      } catch (onAbortError) {
        Meteor._debug('[FilesCollection] [writeStream] [abort] [onAbort] [ERROR:]', onAbortError);
      }
    }
    return true;
  }

  /**
   * @memberOf WriteStream
   * @name stop
   * @param {boolean} [isAborted=false] - was stop called because it was aborted?
   * @summary Stop writing and close the file handle
   * @returns {Promise<boolean>} - true
   */
  async stop(isAborted = false) {
    if (this.ended) {
      return true;
    }

    this.ended = true;
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    if (isAborted) {
      this.aborted = true;
    } else if (this.fh) {
      try {
        await this.fh.datasync();
      } catch (dsError) {
        Meteor._debug('[FilesCollection] [writeStream] [stop] fh.datasync resulted in Error:', this.path, dsError);
      }
    }

    try {
      await this.fh?.close();
    } catch (closeError) {
      Meteor._debug('[FilesCollection] [writeStream] [stop] fh.close resulted in Error:', this.path, closeError);
    }
    this.fh = null;

    if (fhCache.get(this.cacheKey) === this) {
      fhCache.delete(this.cacheKey);
    }
    return true;
  }
}

export { fileIdentity, isSameFile };
