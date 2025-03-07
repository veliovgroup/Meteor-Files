import fs from 'fs';
import nodePath from 'path';
import { Meteor } from 'meteor/meteor';
import { helpers } from './lib.js';

/**
 * @const {FileHandleCache} fhCache - FileHandle Cache
 */
const fhCache = new Map();

/**
 * @private
 * @locus Server
 * @class WriteStream
 * @param path {string} - Path to file on FS
 * @param maxLength {number} - Max amount of chunks in stream
 * @param file {FileObj} - FileObj Object
 * @param permissions {string} - Permissions which will be set to open descriptor (octal), like: `611` or `0o777`. Default: 0755
 * @summary writableStream wrapper class, makes sure chunks is written in given order. Implementation of queue stream.
 */
export default class WriteStream {
  constructor(path, maxLength, file, permissions) {
    this.path = path.trim();
    if (!this.path || !helpers.isString(this.path)) {
      throw new Meteor.Error(400, '[FilesCollection] [new WriteStream(path)] [constructor] {path} must be a String!', this.path);
    }
    this.maxLength = maxLength;
    this.file = file;
    this.permissions = permissions;

    this.fh = null;
    this.ended = false;
    this.aborted = false;
    this.writtenChunks = 0;
    this.endRetries = 0;
  }

  /**
   * @memberOf writeStream
   * @name init
   * @summary Initialize WriteStream, create fileHandle, ensure directory and file is writable
   * @returns {Promise<writeStream>}
   */
  async init() {
    const fhCached = fhCache.get(this.path);
    if (fhCached && !fhCached.ended && !fhCached.aborted) {
      this.fh = fhCached.fh;
      this.writtenChunks = fhCached.writtenChunks;
    } else {
      let statError;
      let stats;
      try {
        stats = await fs.promises.stat(this.path);
      } catch (err) {
        statError = err;
      }

      if (statError || (stats && !stats.isFile())) {
        const paths = this.path.split(nodePath.sep);
        paths.pop();
        try {
          await fs.promises.mkdir(paths.join(nodePath.sep), { recursive: true, flush: true });
        } catch (mkdirError) {
          throw new Meteor.Error(500, `[FilesCollection] [writeStream] [constructor] [mkdirSync] ERROR: can not make/ensure directory "${paths.join(nodePath.sep)}"`, mkdirError);
        }

        try {
          await fs.promises.writeFile(this.path, '');
        } catch (writeFileError) {
          throw new Meteor.Error(500, `[FilesCollection] [writeStream] [constructor] [writeFileSync] ERROR: can not write file "${this.path}"`, writeFileError);
        }
      } else {
        this.writtenChunks = Math.ceil(stats.size / this.file.chunkSize);
      }

      try {
        const fh = await fs.promises.open(this.path, 'r+', this.permissions);
        // await fh.truncate(this.file.size);
        this.fh = fh;
        fhCache.set(this.path, this);
      } catch (fsOpenError) {
        await this.abort();
        throw new Meteor.Error(500, '[FilesCollection] [writeStream] [constructor] [open] [Error:]', fsOpenError);
      }
    }

    return this;
  }

  /**
   * @memberOf writeStream
   * @name write
   * @param {number} num - Chunk position in a stream
   * @param {Buffer} chunk - Buffer (chunk binary data)
   * @summary Write chunk in given order
   * @returns {Promise<boolean>} - True if chunk was written to a file, false if chunk wasn't written
   */
  async write(num, chunk) {
    if (this.aborted || this.ended) {
      return false;
    }

    try {
      const { bytesWritten } = await this.fh.write(chunk, 0, chunk.byteLength, (num - 1) * this.file.chunkSize);
      await this.fh.sync();
      if (bytesWritten !== chunk.byteLength) {
        return false;
      }
      ++this.writtenChunks;
      return true;
    } catch (error) {
      Meteor._debug('[FilesCollection] [writeStream] [write] [Error:]', error);
      await this.abort();
    }

    return false;
  }

  /**
   * @memberOf writeStream
   * @name waitForCompletion
   * @summary Waits for 25 seconds to all chunks to complete writing
   * @returns {Promise<boolean>} - `true` if file was fully written, `false` if writing was aborted and file removed
   */
  async waitForCompletion() {
    while ((!this.aborted && !this.ended && this.writtenChunks < this.maxLength) && this.endRetries < 1000) {
      ++this.endRetries;
      const stats = await fs.promises.stat(this.path);
      this.writtenChunks = Math.ceil(stats.size / this.file.chunkSize);
      await new Promise(resolve => setTimeout(resolve, 25));
    }

    if (this.writtenChunks >= this.maxLength) {
      return await this.stop(false);
    }

    await this.abort();
    return false;
  }

  /**
   * @memberOf writeStream
   * @name end
   * @summary Finishes writing to writableStream, only after all chunks in queue is written
   * @returns {Promise<boolean>} - True if stream is fulfilled, false if queue is in progress
   */
  async end() {
    if (this.aborted || this.ended) {
      return true;
    }

    if (this.writtenChunks >= this.maxLength) {
      return await this.stop(false);
    }

    if (await this.waitForCompletion()) {
      return true;
    }

    Meteor._debug('[FilesCollection] [writeStream] [end] waitForCompletion waited for 25 seconds to complete writing and failed with timeout', this.path);
    return this.ended;
  }

  /**
   * @memberOf writeStream
   * @name abort
   * @summary Aborts writing to writableStream, removes created file
   * @returns {Promise<boolean>} - True
   */
  async abort() {
    if (this.aborted) {
      return true;
    }

    await this.stop(true);
    try {
      await fs.promises.unlink(this.path);
    } catch (unlinkError) {
      Meteor._debug('[FilesCollection] [writeStream] [abort] [unlink] [ERROR:]', this.path, unlinkError);
    }
    return true;
  }

  /**
   * @memberOf writeStream
   * @name stop
   * @param {boolean} [isAborted=false] - was stop called because it was aborted?
   * @summary Stop writing to writableStream
   * @returns {Promise<boolean>} - true
   */
  async stop(isAborted = false) {
    if (this.ended) {
      return true;
    }

    this.ended = true;
    if (isAborted) {
      this.aborted = true;
    } else {
      try {
        await this.fh.datasync();
      } catch (dsError) {
        Meteor._debug('[FilesCollection] [writeStream] [stop] fh.datasync resulted in Error:', this.path, dsError);
      }
    }

    await this.fh.close();
    fhCache.delete(this.path);
    return true;
  }
}
