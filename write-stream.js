import fs from 'fs-extra';
import nodePath from 'path';
import { Meteor } from 'meteor/meteor';
import { helpers } from './lib.js';
const noop = () => {};

/**
 * @const {Object} bound   - Meteor.bindEnvironment (Fiber wrapper)
 * @const {Object} fdCache - File Descriptors Cache
 */
const bound = Meteor.bindEnvironment(callback => callback());
const fdCache = {};

/**
 * @private
 * @locus Server
 * @class WriteStream
 * @param path        {String} - Path to file on FS
 * @param maxLength   {Number} - Max amount of chunks in stream
 * @param file        {Object} - fileRef Object
 * @param permissions {String} - Permissions which will be set to open descriptor (octal), like: `611` or `0o777`. Default: 0755
 * @summary writableStream wrapper class, makes sure chunks is written in given order. Implementation of queue stream.
 */
export default class WriteStream {
  constructor(path, maxLength, file, permissions) {
    this.path = path.trim();
    this.maxLength = maxLength;
    this.file = file;
    this.permissions = permissions;
    if (!this.path || !helpers.isString(this.path)) {
      return;
    }

    this.fd = null;
    this.ended = false;
    this.aborted = false;
    this.writtenChunks = 0;

    if (fdCache[this.path] && !fdCache[this.path].ended && !fdCache[this.path].aborted) {
      this.fd = fdCache[this.path].fd;
      this.writtenChunks = fdCache[this.path].writtenChunks;
    } else {
      fs.stat(this.path, (statError, stats) => {
        bound(() => {
          if (statError || !stats.isFile()) {
            const paths = this.path.split(nodePath.sep);
            paths.pop();
            try {
              fs.mkdirSync(paths.join(nodePath.sep), { recursive: true });
            } catch (mkdirError) {
              throw new Meteor.Error(500, `[FilesCollection] [writeStream] [constructor] [mkdirSync] ERROR: can not make/ensure directory "${paths.join(nodePath.sep)}"`, mkdirError);
            }

            try {
              fs.writeFileSync(this.path, '');
            } catch (writeFileError) {
              throw new Meteor.Error(500, `[FilesCollection] [writeStream] [constructor] [writeFileSync] ERROR: can not write file "${this.path}"`, writeFileError);
            }
          }

          fs.open(this.path, 'r+', this.permissions, (oError, fd) => {
            bound(() => {
              if (oError) {
                this.abort();
                throw new Meteor.Error(500, '[FilesCollection] [writeStream] [constructor] [open] [Error:]', oError);
              } else {
                this.fd = fd;
                fdCache[this.path] = this;
              }
            });
          });
        });
      });
    }
  }

  /**
   * @memberOf writeStream
   * @name write
   * @param {Number} num - Chunk position in a stream
   * @param {Buffer} chunk - Buffer (chunk binary data)
   * @param {Function} callback - Callback
   * @summary Write chunk in given order
   * @returns {Boolean} - True if chunk is sent to stream, false if chunk is set into queue
   */
  write(num, chunk, callback) {
    if (!this.aborted && !this.ended) {
      if (this.fd) {
        fs.write(this.fd, chunk, 0, chunk.length, (num - 1) * this.file.chunkSize, (error, written, buffer) => {
          bound(() => {
            callback && callback(error, written, buffer);
            if (error) {
              Meteor._debug('[FilesCollection] [writeStream] [write] [Error:]', error);
              this.abort();
            } else {
              ++this.writtenChunks;
            }
          });
        });
      } else {
        Meteor.setTimeout(() => {
          this.write(num, chunk, callback);
        }, 25);
      }
    }
    return false;
  }

  /**
   * @memberOf writeStream
   * @name end
   * @param {Function} callback - Callback
   * @summary Finishes writing to writableStream, only after all chunks in queue is written
   * @returns {Boolean} - True if stream is fulfilled, false if queue is in progress
   */
  end(callback) {
    if (!this.aborted && !this.ended) {
      if (this.writtenChunks === this.maxLength) {
        fs.close(this.fd, () => {
          bound(() => {
            delete fdCache[this.path];
            this.ended = true;
            callback && callback(void 0, true);
          });
        });
        return true;
      }

      fs.stat(this.path, (error, stat) => {
        bound(() => {
          if (!error && stat) {
            this.writtenChunks = Math.ceil(stat.size / this.file.chunkSize);
          }

          return Meteor.setTimeout(() => {
            this.end(callback);
          }, 25);
        });
      });
    } else {
      callback && callback(void 0, this.ended);
    }
    return false;
  }

  /**
   * @memberOf writeStream
   * @name abort
   * @param {Function} callback - Callback
   * @summary Aborts writing to writableStream, removes created file
   * @returns {Boolean} - True
   */
  abort(callback) {
    this.aborted = true;
    delete fdCache[this.path];
    fs.unlink(this.path, (callback || noop));
    return true;
  }

  /**
   * @memberOf writeStream
   * @name stop
   * @summary Stop writing to writableStream
   * @returns {Boolean} - True
   */
  stop() {
    this.aborted = true;
    delete fdCache[this.path];
    return true;
  }
}
