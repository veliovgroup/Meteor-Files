import { Meteor } from 'meteor/meteor';

/*
 * @private
 * @locus Anywhere
 * @class FileCursor
 * @param _fileRef    {Object} - Mongo-Style selector (http://docs.meteor.com/api/collections.html#selectors)
 * @param _collection {FilesCollection} - FilesCollection Instance
 * @summary Internal class, represents each record in `FilesCursor.each()` or document returned from `.findOne()` method
 */
export class FileCursor {
  constructor(_fileRef, _collection) {
    this._fileRef = _fileRef;
    this._collection = _collection;
    Object.assign(this, _fileRef);
  }

  /*
   * @locus Anywhere
   * @memberOf FileCursor
   * @name removeAsync
   * @throws {Meteor.Error} - If no file reference is provided
   * @summary Remove document
   * @returns {Promise<FileCursor>}
   */
  async removeAsync() {
    this._collection._debug('[FilesCollection] [FileCursor] [removeAsync()]');
    if (this._fileRef) {
      await this._collection.removeAsync(this._fileRef._id);
    } else {
      throw new Meteor.Error(404, 'No such file');
    }
    return this;
  }

  /*
   * @locus Anywhere
   * @memberOf FileCursor
   * @name link
   * @param version {String} - Name of file's subversion
   * @param uriBase {String} - [Optional] URI base, see - https://github.com/veliovgroup/Meteor-Files/issues/626
   * @summary Returns downloadable URL to File
   * @returns {String}
   */
  link(version = 'original', uriBase) {
    this._collection._debug(`[FilesCollection] [FileCursor] [link(${version})]`);
    if (this._fileRef) {
      return this._collection.link(this._fileRef, version, uriBase);
    }
    return '';
  }

  /*
   * @locus Anywhere
   * @memberOf FileCursor
   * @name get
   * @param property {String} - Name of sub-object property
   * @summary Returns current document as a plain Object, if `property` is specified - returns value of sub-object property
   * @returns {Object|mix}
   */
  get(property) {
    this._collection._debug(`[FilesCollection] [FileCursor] [get(${property})]`);
    if (property) {
      return this._fileRef[property];
    }
    return this._fileRef;
  }

  /*
   * @locus Anywhere
   * @memberOf FileCursor
   * @name fetch
   * @summary Returns document as plain Object in Array
   * @returns {[Object]}
   */
  fetch() {
    this._collection._debug('[FilesCollection] [FileCursor] [fetch()]');
    return [this._fileRef];
  }

  /*
   * @locus Anywhere
   * @memberOf FileCursor
   * @name with
   * @summary Returns reactive version of current FileCursor, useful to use with `{{#with}}...{{/with}}` block template helper
   * @returns {[Object]}
   */
  with() {
    this._collection._debug('[FilesCollection] [FileCursor] [with()]');
    return Object.assign(this, this._collection.collection.findOne(this._fileRef._id));
  }
}

/*
 * @private
 * @locus Anywhere
 * @class FilesCursor
 * @param _selector   {String|Object}   - Mongo-Style selector (http://docs.meteor.com/api/collections.html#selectors)
 * @param options     {Object}          - Mongo-Style selector Options (http://docs.meteor.com/api/collections.html#selectors)
 * @param _collection {FilesCollection} - FilesCollection Instance
 * @summary Implementation of Cursor for FilesCollection
 */
export class FilesCursor {
  constructor(_selector = {}, options, _collection) {
    this._collection = _collection;
    this._selector = _selector;
    this._current = -1;
    this.cursor = this._collection.collection.find(this._selector, options);
  }

  /*
   * @locus Anywhere
   * @memberOf FilesCursor
   * @name get
   * @summary Returns all matching document(s) as an Array. Alias of `.fetch()`
   * @returns {Promise<[Object]>}
   */
  async get() {
    this._collection._debug('[FilesCollection] [FilesCursor] [getAsync()]');
    return this.cursor.fetchAsync();
  }

  /*
   * @locus Anywhere
   * @memberOf FilesCursor
   * @name hasNext
   * @summary Returns `true` if there is next item available on Cursor
   * @returns {Boolean}
   */
  async hasNext() {
    this._collection._debug('[FilesCollection] [FilesCursor] [hasNextAsync()]');
    return this._current < (await this.cursor.countAsync()) - 1;
  }

  /*
   * @locus Anywhere
   * @memberOf FilesCursor
   * @name next
   * @summary Returns next item on Cursor, if available
   * @returns {Promise<Object|undefined>}
   */
  async next() {
    this._collection._debug('[FilesCollection] [FilesCursor] [nextAsync()]');
    return (await this.cursor.fetchAsync())[++this._current];
  }

  /*
   * @locus Anywhere
   * @memberOf FilesCursor
   * @name hasPrevious
   * @summary Returns `true` if there is previous item available on Cursor
   * @returns {Boolean}
   */
  hasPrevious() {
    this._collection._debug('[FilesCollection] [FilesCursor] [hasPrevious()]');
    return this._current !== -1;
  }

  /*
   * @locus Anywhere
   * @memberOf FilesCursor
   * @name previous
   * @summary Returns previous item on Cursor, if available
   * @returns {Promise<Object|undefined>}
   */
  async previous() {
    this._collection._debug('[FilesCollection] [FilesCursor] [previousAsync()]');
    return (this.cursor.fetchAsync())[--this._current];
  }

  /*
   * @locus Anywhere
   * @memberOf FilesCursor
   * @name fetchAsync
   * @summary Returns all matching document(s) as an Array.
   * @returns {Promise<[Object]>}
   */
  async fetchAsync() {
    this._collection._debug('[FilesCollection] [FilesCursor] [fetchAsync()]');
    return (await this.cursor.fetchAsync()) || [];
  }

  /*
   * @locus Anywhere
   * @memberOf FilesCursor
   * @name first
   * @summary Returns first item on Cursor, if available
   * @returns {Promise<Object|undefined>}
   */
  async first() {
    this._collection._debug('[FilesCollection] [FilesCursor] [firstAsync()]');
    this._current = 0;
    return (await this.fetchAsync())[this._current];
  }

  /*
   * @locus Anywhere
   * @memberOf FilesCursor
   * @name last
   * @summary Returns last item on Cursor, if available
   * @returns {Promise<Object|undefined>}
   */
  async last() {
    this._collection._debug('[FilesCollection] [FilesCursor] [last()]');
    this._current = (await this.countAsync()) - 1;
    return (await this.fetchAsync())[this._current];
  }

  /*
   * @locus Anywhere
   * @memberOf FilesCursor
   * @name countAsync
   * @summary Returns the number of documents that match a query
   * @returns {Promise<Number>}
   */
  async countAsync() {
    this._collection._debug('[FilesCollection] [FilesCursor] [countAsync()]');
    return this.cursor.countAsync();
  }

  /*
   * @locus Anywhere
   * @memberOf FilesCursor
   * @name removeAsync
   * @summary Removes all documents that match a query
   * @returns {Promise<FilesCursor>}
   */
  async removeAsync() {
    this._collection._debug('[FilesCollection] [FilesCursor] [removeAsync()]');
    await this._collection.removeAsync(this._selector);
    return this;
  }

  /*
   * @locus Anywhere
   * @memberOf FilesCursor
   * @name forEachAsync
   * @param callback {Function} - Function to call. It will be called with three arguments: the `file`, a 0-based index, and cursor itself
   * @param context {Object} - An object which will be the value of `this` inside `callback`
   * @summary Call `callback` once for each matching document, sequentially and synchronously.
   * @returns {Promise<undefined>}
   */
  async forEachAsync(callback, context = {}) {
    this._collection._debug('[FilesCollection] [FilesCursor] [forEachAsync()]');
    await this.cursor.forEachAsync(callback, context);
  }

  /*
   * @locus Anywhere
   * @memberOf FilesCursor
   * @name each
   * @summary Returns an Array of FileCursor made for each document on current cursor
   *          Useful when using in {{#each FilesCursor#each}}...{{/each}} block template helper
   * @returns {Promise<[FileCursor]>}
   */
  async each() {
    return this.mapAsync((file) => {
      return new FileCursor(file, this._collection);
    });
  }

  /*
   * @locus Anywhere
   * @memberOf FilesCursor
   * @name mapAsync
   * @param callback {Function} - Function to call. It will be called with three arguments: the `file`, a 0-based index, and cursor itself
   * @param context {Object} - An object which will be the value of `this` inside `callback`
   * @summary Map `callback` over all matching documents. Returns an Array.
   * @returns {Promise<Array>}
   */
  async mapAsync(callback, context = {}) {
    this._collection._debug('[FilesCollection] [FilesCursor] [mapAsync()]');
    return this.cursor.mapAsync(callback, context);
  }

  /*
   * @locus Anywhere
   * @memberOf FilesCursor
   * @name current
   * @summary Returns current item on Cursor, if available
   * @returns {Promise<Object|undefined>}
   */
  async current() {
    this._collection._debug('[FilesCollection] [FilesCursor] [currentAsync()]');
    if (this._current < 0) {
      this._current = 0;
    }
    return (await this.fetchAsync())[this._current];
  }

  /*
   * @locus Anywhere
   * @memberOf FilesCursor
   * @name observe
   * @param callbacks {Object} - Functions to call to deliver the result set as it changes
   * @summary Watch a query. Receive callbacks as the result set changes.
   * @url http://docs.meteor.com/api/collections.html#Mongo-Cursor-observe
   * @returns {Promise<Object>} - live query handle
   */
  async observe(callbacks) {
    this._collection._debug('[FilesCollection] [FilesCursor] [observe()]');
    return this.cursor.observe(callbacks);
  }

  /*
   * @locus Anywhere
   * @memberOf FilesCursor
   * @name observeChanges
   * @param callbacks {Object} - Functions to call to deliver the result set as it changes
   * @summary Watch a query. Receive callbacks as the result set changes. Only the differences between the old and new documents are passed to the callbacks.
   * @url http://docs.meteor.com/api/collections.html#Mongo-Cursor-observeChanges
   * @returns {Object} - live query handle
   */
  observeChanges(callbacks) {
    this._collection._debug('[FilesCollection] [FilesCursor] [observeChanges()]');
    return this.cursor.observeChanges(callbacks);
  }
}
