import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Meteor } from 'meteor/meteor';
import { MongoInternals } from 'meteor/mongo';
import { helpers } from './lib.js';

const { GridFSBucket, ObjectId } = MongoInternals.NpmModules.mongodb.module;

/**
 * @typedef {'upload'|'write'|'load'|'addFile'} StorageSource
 * @summary Where the local file passed to `put()` comes from. `upload`, `write` (`writeAsync()`), and `load` (`loadAsync()`) files were created by the package. `addFile` is the caller's own file
 */

/**
 * @function isStorageAdapter
 * @param {*} adapter - Value of the `storage` option
 * @summary An object with `put`, `createReadStream`, and `remove` functions
 * @returns {boolean}
 */
export const isStorageAdapter = (adapter) => helpers.isObject(adapter)
  && helpers.isFunction(adapter.put)
  && helpers.isFunction(adapter.createReadStream)
  && helpers.isFunction(adapter.remove);

/**
 * @private
 * @summary `fileRef.versions[versionName]` when it is an object, otherwise `null`
 */
const versionOf = (fileRef, versionName) => {
  return (helpers.isObject(fileRef?.versions) && helpers.isObject(fileRef.versions[versionName])) ? fileRef.versions[versionName] : null;
};

/**
 * @locus Server
 * @class FSStorage
 * @summary Default adapter: files stay where the upload wrote them, at `versions.<name>.path`
 */
export class FSStorage {
  constructor() {
    this.name = 'fs';
  }

  /**
   * @summary Nothing to move, the file is already in place
   * @param {FileObj} _fileRef - File object
   * @param {string} _versionName - Version
   * @param {string} _localPath - File on disk
   * @param {{source: StorageSource}} [_opts] - Origin of the local file
   * @returns {Promise<undefined>}
   */
  async put() {
    return void 0;
  }

  /**
   * @param {FileObj} fileRef - File document
   * @param {string} versionName - Version
   * @returns {Promise<{size: number}|null>} `null` when the file is missing or not a regular file
   */
  async stat(fileRef, versionName) {
    const vRef = versionOf(fileRef, versionName);
    if (!helpers.isString(vRef?.path)) {
      return null;
    }

    try {
      const stats = await fs.promises.stat(vRef.path);
      return stats.isFile() ? { size: stats.size } : null;
    } catch (_statError) {
      return null;
    }
  }

  /**
   * @param {FileObj} fileRef - File document
   * @param {string} versionName - Version
   * @param {{start?: number, end?: number}} [range] - Byte range, `end` inclusive
   * @throws {Meteor.Error} 404 when the version has no path
   * @returns {Promise<fs.ReadStream>}
   */
  async createReadStream(fileRef, versionName, range = {}) {
    const vRef = versionOf(fileRef, versionName);
    if (!helpers.isString(vRef?.path)) {
      throw new Meteor.Error(404, 'File not found');
    }
    return fs.createReadStream(vRef.path, Number.isInteger(range.start) ? { start: range.start, end: range.end } : {});
  }

  /**
   * @param {FileObj} fileRef - File document
   * @param {string} versionName - Version
   * @summary Unlink the version file. fs errors, `ENOENT` included, are rethrown for the caller to log
   * @returns {Promise<void>}
   */
  async remove(fileRef, versionName) {
    const vRef = versionOf(fileRef, versionName);
    if (helpers.isString(vRef?.path)) {
      await fs.promises.unlink(vRef.path);
    }
  }
}

/**
 * @locus Server
 * @class GridFSStorage
 * @param {Object} [opts]
 * @param {string} [opts.bucketName='fs'] - GridFS bucket
 * @param {number} [opts.chunkSizeBytes] - GridFS chunk size, driver default when not set
 * @param {Db} [opts.db] - Database, default: the app's default database
 * @summary Copies finished files into a GridFS bucket and deletes the local copy, except for `addFile()` where the file belongs to the caller. Stores `{ name: 'gridfs', bucketName, id }` at `versions.<name>.meta.storage`
 */
export class GridFSStorage {
  constructor({ bucketName = 'fs', chunkSizeBytes, db } = {}) {
    if (!helpers.isString(bucketName) || !bucketName) {
      throw new Meteor.Error(500, '[GridFSStorage] "bucketName" must be a non-empty String');
    }
    this.name = 'gridfs';
    this.bucketName = bucketName;
    this.chunkSizeBytes = chunkSizeBytes;
    this.db = db || null;
    this._bucket = null;
  }

  /**
   * @summary Created on first use, after Meteor connected to MongoDB
   * @returns {GridFSBucket}
   */
  get bucket() {
    if (!this._bucket) {
      const options = { bucketName: this.bucketName };
      if (Number.isInteger(this.chunkSizeBytes) && this.chunkSizeBytes > 0) {
        options.chunkSizeBytes = this.chunkSizeBytes;
      }
      this._bucket = new GridFSBucket(this.db || MongoInternals.defaultRemoteCollectionDriver().mongo.db, options);
    }
    return this._bucket;
  }

  /**
   * @private
   * @returns {ObjectId|null} Bucket file id stored at `versions[versionName].meta.storage.id`
   */
  _fileId(fileRef, versionName) {
    const id = versionOf(fileRef, versionName)?.meta?.storage?.id;
    return (helpers.isString(id) && /^[a-f0-9]{24}$/.test(id)) ? new ObjectId(id) : null;
  }

  /**
   * @param {FileObj} fileRef - File object
   * @param {string} versionName - Version
   * @param {string} localPath - File on disk
   * @param {{source: StorageSource}} [opts] - Origin of the local file. The local file is kept when `source` is `'addFile'`
   * @returns {Promise<{name: 'gridfs', bucketName: string, id: string}>}
   */
  async put(fileRef, versionName, localPath, { source } = {}) {
    const id = new ObjectId();
    const vRef = versionOf(fileRef, versionName) || {};
    await pipeline(
      fs.createReadStream(localPath),
      this.bucket.openUploadStreamWithId(id, fileRef.name || `${fileRef._id}`, {
        metadata: { fileId: fileRef._id, versionName, type: vRef.type || fileRef.type },
      })
    );
    // The bucket holds the file now. `addFile()` files belong to the caller, keep them
    if (source !== 'addFile') {
      await fs.promises.unlink(localPath);
    }
    return { name: this.name, bucketName: this.bucketName, id: id.toHexString() };
  }

  async stat(fileRef, versionName) {
    const id = this._fileId(fileRef, versionName);
    if (!id) {
      return null;
    }
    const doc = await this.bucket.find({ _id: id }).next();
    return doc ? { size: doc.length } : null;
  }

  async createReadStream(fileRef, versionName, range = {}) {
    const id = this._fileId(fileRef, versionName);
    if (!id) {
      throw new Meteor.Error(404, 'File not found');
    }

    const options = {};
    if (Number.isInteger(range.start)) {
      options.start = range.start;
      // GridFS `end` is exclusive
      options.end = range.end + 1;
    }
    return this.bucket.openDownloadStream(id, options);
  }

  async remove(fileRef, versionName) {
    const id = this._fileId(fileRef, versionName);
    if (!id) {
      return;
    }

    try {
      await this.bucket.delete(id);
    } catch (deleteError) {
      if (!/not found/i.test(`${deleteError?.message}`)) {
        throw deleteError;
      }
    }
  }
}
