import { Meteor } from 'meteor/meteor';

/**
 * @class FileCursor
 * @private
 * @locus Anywhere
 * @param {FileObj} _fileRef - Mongo–style file document or selector.
 * @param {FilesCollection} _collection - FilesCollection instance.
 * @summary Internal class representing a single file document (as returned from `.findOne()` or iterated via `.each()`).
 */
export class FileCursor {
  constructor(_fileRef, _collection) {
    if (!_fileRef) {
      throw new Meteor.Error(404, 'No file reference provided');
    }
    this._fileRef = _fileRef;
    this._collection = _collection;
    // Merge file document properties into this instance.
    Object.assign(this, _fileRef);
  }

  /**
   * Remove document.
   * @returns {FileCursor}
   * @throws {Meteor.Error} If no file reference is provided.
   */
  remove() {
    this._collection._debug('[FilesCollection] [FileCursor] [remove()]');
    if (this._fileRef && this._fileRef._id) {
      this._collection.remove(this._fileRef._id);
    } else {
      throw new Meteor.Error(404, 'No such file');
    }
    return this;
  }

  /**
   * Remove document asynchronously.
   * @returns {Promise<FileCursor>}
   * @throws {Meteor.Error} If no file reference is provided.
   */
  async removeAsync() {
    this._collection._debug('[FilesCollection] [FileCursor] [removeAsync()]');
    if (this._fileRef && this._fileRef._id) {
      await this._collection.removeAsync(this._fileRef._id);
    } else {
      throw new Meteor.Error(404, 'No such file');
    }
    return this;
  }

  /**
   * Returns a downloadable URL to the file.
   * @param {string} [version='original'] - Name of the file’s subversion.
   * @param {string} [uriBase] - Optional URI base.
   * @returns {string}
   */
  link(version = 'original', uriBase) {
    this._collection._debug(`[FilesCollection] [FileCursor] [link(${version})]`);
    if (this._fileRef && this._fileRef._id) {
      return this._collection.link(this._fileRef, version, uriBase);
    }
    return '';
  }

  /**
   * Returns the underlying file document (or the value of a specified property).
   * @param {string} [property] - Name of the property to return.
   * @returns {FileObj | any}
   */
  get(property) {
    this._collection._debug(`[FilesCollection] [FileCursor] [get(${property})]`);
    if (property) {
      return this._fileRef[property];
    }
    return this._fileRef;
  }

  /**
   * Returns the file document wrapped in an array.
   * @returns {Array<FileObj>}
   */
  fetch() {
    this._collection._debug('[FilesCollection] [FileCursor] [fetch()]');
    return [this._fileRef];
  }

  /**
   * Asynchronously returns the file document wrapped in an array.
   * @returns {Promise<Array<FileObj>>}
   */
  async fetchAsync() {
    this._collection._debug('[FilesCollection] [FileCursor] [fetchAsync()]');
    return [this._fileRef];
  }

  /**
   * Returns a reactive version of the current FileCursor by merging in reactive fields.
   * Useful for Blaze template helpers (e.g. `{{#with}}`).
   * @returns {FileCursor}
   */
  with() {
    this._collection._debug('[FilesCollection] [FileCursor] [with()]');
    const reactiveProps = this._collection.collection.findOne(this._fileRef._id);
    Object.assign(this, reactiveProps);
    return this;
  }
}

/**
 * @class FilesCursor
 * @private
 * @locus Anywhere
 * @param {Mongo.Selector | Mongo.ObjectID | string} _selector - Mongo–style selector for the query.
 * @param {Mongo.Options} options - Query options.
 * @param {FilesCollection} _collection - FilesCollection instance.
 * @summary Implementation of a cursor for FilesCollection.
 */
export class FilesCursor {
  constructor(_selector = {}, options = {}, _collection) {
    this._collection = _collection;
    this._selector = _selector;
    // Initialize the current index for iteration.
    this._current = -1;
    // Underlying Mongo cursor.
    this.cursor = this._collection.collection.find(this._selector, options);
  }

  /**
   * Returns all matching file documents as an array.
   * Alias of `.fetch()`.
   * @returns {Array<FileObj>}
   */
  get() {
    this._collection._debug('[FilesCollection] [FilesCursor] [get()]');
    return this.fetch();
  }

  /**
   * Asynchronously returns all matching file documents as an array.
   * @returns {Promise<Array<FileObj>>}
   */
  async getAsync() {
    this._collection._debug('[FilesCollection] [FilesCursor] [getAsync()]');
    return await this.fetchAsync();
  }

  /**
   * Returns `true` if there is a next item available.
   * @deprecated since v3.0.0. use {@link FilesCursor#hasNextAsync} instead.
   * @returns {boolean}
   */
  hasNext() {
    this._collection._debug('[FilesCollection] [FilesCursor] [hasNext()]');
    Meteor.deprecate('FilesCursor#hasNext() is deprecated! Use `hasNextAsync` instead');
    return this._current < this.count() - 1;
  }

  /**
   * Asynchronously returns `true` if there is a next item available.
   * @returns {Promise<boolean>}
   */
  async hasNextAsync() {
    this._collection._debug('[FilesCollection] [FilesCursor] [hasNextAsync()]');
    const count = await this.countDocuments();
    return this._current < count - 1;
  }

  /**
   * Returns the next file document, if available.
   * @returns {FileObj | undefined}
   */
  next() {
    this._collection._debug('[FilesCollection] [FilesCursor] [next()]');
    const allFiles = this.fetch();
    this._current++;
    return allFiles[this._current];
  }

  /**
   * Asynchronously returns the next file document, if available.
   * @returns {Promise<FileObj | undefined>}
   */
  async nextAsync() {
    this._collection._debug('[FilesCollection] [FilesCursor] [nextAsync()]');
    const allFiles = await this.fetchAsync();
    this._current++;
    return allFiles[this._current];
  }

  /**
   * Returns `true` if there is a previous item available.
   * @returns {boolean}
   */
  hasPrevious() {
    this._collection._debug('[FilesCollection] [FilesCursor] [hasPrevious()]');
    return this._current > 0;
  }

  /**
   * Asynchronously returns `true` if there is a previous item available.
   * @returns {Promise<boolean>}
   */
  async hasPreviousAsync() {
    this._collection._debug('[FilesCollection] [FilesCursor] [hasPreviousAsync()]');
    return this._current > 0;
  }

  /**
   * Returns the previous file document, if available.
   * @returns {FileObj | undefined}
   */
  previous() {
    this._collection._debug('[FilesCollection] [FilesCursor] [previous()]');
    this._current = Math.max(this._current - 1, 0);
    return this.fetch()[this._current];
  }

  /**
   * Asynchronously returns the previous file document, if available.
   * @returns {Promise<FileObj | undefined>}
   */
  async previousAsync() {
    this._collection._debug('[FilesCollection] [FilesCursor] [previousAsync()]');
    this._current = Math.max(this._current - 1, 0);
    const allFiles = await this.fetchAsync();
    return allFiles[this._current];
  }

  /**
   * Returns all matching file documents as an array.
   * @returns {Array<FileObj>}
   */
  fetch() {
    this._collection._debug('[FilesCollection] [FilesCursor] [fetch()]');
    return this.cursor.fetch() || [];
  }

  /**
   * Asynchronously returns all matching file documents as an array.
   * @returns {Promise<Array<FileObj>>}
   */
  async fetchAsync() {
    this._collection._debug('[FilesCollection] [FilesCursor] [fetchAsync()]');
    return (await this.cursor.fetchAsync()) || [];
  }

  /**
   * Returns the first file document, if available.
   * @returns {FileObj | undefined}
   */
  first() {
    this._collection._debug('[FilesCollection] [FilesCursor] [first()]');
    this._current = 0;
    const allFiles = this.fetch();
    return allFiles[this._current];
  }

  /**
   * Asynchronously returns the first file document, if available.
   * @returns {Promise<FileObj | undefined>}
   */
  async firstAsync() {
    this._collection._debug('[FilesCollection] [FilesCursor] [firstAsync()]');
    this._current = 0;
    const allFiles = await this.fetchAsync();
    return allFiles[this._current];
  }

  /**
   * Returns the last file document, if available.
   * @returns {FileObj | undefined}
   */
  last() {
    this._collection._debug('[FilesCollection] [FilesCursor] [last()]');
    const count = this.count();
    this._current = count - 1;
    const allFiles = this.fetch();
    return count > 0 ? allFiles[this._current] : undefined;
  }

  /**
   * Asynchronously returns the last file document, if available.
   * @returns {Promise<FileObj | undefined>}
   */
  async lastAsync() {
    this._collection._debug('[FilesCollection] [FilesCursor] [lastAsync()]');
    const count = await this.countDocuments();
    this._current = count - 1;
    const allFiles = await this.fetchAsync();
    return count > 0 ? allFiles[this._current] : undefined;
  }

  /**
   * Returns the number of file documents that match the query.
   * @deprecated since v3.0.0. use {@link FilesCursor#countDocuments} instead.
   * @returns {number}
   */
  count() {
    this._collection._debug('[FilesCollection] [FilesCursor] [count()]');
    Meteor.deprecate('FilesCursor#count() is deprecated! Use `countDocuments` instead');
    return this.cursor.count();
  }

  /**
   * Asynchronously returns the number of file documents that match the query.
   * @deprecated since v3.0.0. use {@link FilesCursor#countDocuments} instead.
   * @returns {Promise<number>}
   */
  async countAsync() {
    this._collection._debug('[FilesCollection] [FilesCursor] [countAsync()]');
    Meteor.deprecate('FilesCursor#countAsync() is deprecated! Use `countDocuments` instead');
    return await this.cursor.countAsync();
  }

  /**
   * Asynchronously returns the number of file documents that match the query.
   * @param {Mongo.CountDocumentsOptions} [options] - CountDocumentsOptions
   * @returns {Promise<number>}
   */
  async countDocuments(options) {
    this._collection._debug('[FilesCollection] [FilesCursor] [countDocuments()]');
    return await this._collection.countDocuments(this._selector, options);
  }

  /**
   * Removes all file documents that match the query.
   * @param {Function} [callback=() => {}] - Callback with error and number of removed records.
   * @returns {FilesCursor}
   */
  remove(callback = () => {}) {
    this._collection._debug('[FilesCollection] [FilesCursor] [remove()]');
    this._collection.remove(this._selector, callback);
    return this;
  }

  /**
   * Asynchronously removes all file documents that match the query.
   * @returns {Promise<number>}
   */
  async removeAsync() {
    this._collection._debug('[FilesCollection] [FilesCursor] [removeAsync()]');
    return await this._collection.removeAsync(this._selector);
  }

  /**
   * Synchronously iterates over each matching file document.
   * @param {Function} callback - Function invoked with (file, index, cursor).
   * @param {Object} [context={}] - The context for the callback.
   * @returns {FilesCursor}
   */
  forEach(callback, context = {}) {
    this._collection._debug('[FilesCollection] [FilesCursor] [forEach()]');
    this.cursor.forEach(callback, context);
    return this;
  }

  /**
   * Asynchronously iterates over each matching file document.
   * @param {Function} callback - Function invoked with (file, index, cursor).
   * @param {Object} [context={}] - The context for the callback.
   * @returns {Promise<FilesCursor>}
   */
  async forEachAsync(callback, context = {}) {
    this._collection._debug('[FilesCollection] [FilesCursor] [forEachAsync()]');
    await this.cursor.forEachAsync(callback, context);
    return this;
  }

  /**
   * Returns an array of FileCursor instances (one per file document).
   * Useful for Blaze’s `{{#each}}` helper.
   * @returns {Array<FileCursor>}
   */
  each() {
    this._collection._debug('[FilesCollection] [FilesCursor] [each()]');
    return this.map((file) => new FileCursor(file, this._collection));
  }

  /**
   * Asynchronously returns an array of FileCursor instances (one per file document).
   * @returns {Promise<Array<FileCursor>>}
   */
  async eachAsync() {
    this._collection._debug('[FilesCollection] [FilesCursor] [eachAsync()]');
    return await this.mapAsync((file) => new FileCursor(file, this._collection));
  }

  /**
   * Synchronously maps a callback over all matching file documents.
   * @param {Function} callback - Function invoked with (file, index, cursor).
   * @param {Object} [context={}] - The context for the callback.
   * @returns {Array<any>}
   */
  map(callback, context = {}) {
    this._collection._debug('[FilesCollection] [FilesCursor] [map()]');
    return this.cursor.map(callback, context);
  }

  /**
   * Asynchronously maps a callback over all matching file documents.
   * @param {Function} callback - Function invoked with (file, index, cursor).
   * @param {Object} [context={}] - The context for the callback.
   * @returns {Promise<Array<any>>}
   */
  async mapAsync(callback, context = {}) {
    this._collection._debug('[FilesCollection] [FilesCursor] [mapAsync()]');
    return await this.cursor.mapAsync(callback, context);
  }

  /**
   * Returns the current file document in the cursor.
   * @returns {FileObj | undefined}
   */
  current() {
    this._collection._debug('[FilesCollection] [FilesCursor] [current()]');
    if (this._current < 0) {
      this._current = 0;
    }
    return this.fetch()[this._current];
  }

  /**
   * Asynchronously returns the current file document in the cursor.
   * @returns {Promise<FileObj | undefined>}
   */
  async currentAsync() {
    this._collection._debug('[FilesCollection] [FilesCursor] [currentAsync()]');
    if (this._current < 0) {
      this._current = 0;
    }
    const files = await this.fetchAsync();
    return files[this._current];
  }

  /**
   * Watches a query and receives callbacks as the result set changes.
   * @param {Mongo.ObserveCallbacks} callbacks - The observe callbacks.
   * @returns {Meteor.LiveQueryHandle}
   */
  observe(callbacks) {
    this._collection._debug('[FilesCollection] [FilesCursor] [observe()]');
    return this.cursor.observe(callbacks);
  }

  /**
   * Asynchronously watches a query and receives callbacks as the result set changes.
   * @param {Mongo.ObserveCallbacks} callbacks - The observe callbacks.
   * @returns {Promise<Meteor.LiveQueryHandle>}
   */
  async observeAsync(callbacks) {
    this._collection._debug('[FilesCollection] [FilesCursor] [observeAsync()]');
    return await this.cursor.observeAsync(callbacks);
  }

  /**
   * Watches a query for changes (only the differences) and receives callbacks.
   * @param {Mongo.ObserveChangesCallbacks} callbacks - The observeChanges callbacks.
   * @returns {Meteor.LiveQueryHandle}
   */
  observeChanges(callbacks) {
    this._collection._debug('[FilesCollection] [FilesCursor] [observeChanges()]');
    return this.cursor.observeChanges(callbacks);
  }

  /**
   * Asynchronously watches a query for changes (only the differences) and receives callbacks.
   * @param {Mongo.ObserveChangesCallbacks} callbacks - The observeChanges callbacks.
   * @returns {Promise<Meteor.LiveQueryHandle>}
   */
  async observeChangesAsync(callbacks) {
    this._collection._debug('[FilesCollection] [FilesCursor] [observeChangesAsync()]');
    return await this.cursor.observeChangesAsync(callbacks);
  }
}

