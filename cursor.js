import { Meteor } from 'meteor/meteor';

/**
 * @private
 * @locus Anywhere
 * @class FileCursor
 * @param _fileRef {Mongo.Selector | Mongo.ObjectID | string} - Mongo-Style selector (https://docs.meteor.com/api/collections.html#selectors)
 * @param _collection {FilesCollection} - FilesCollection Instance
 * @summary Internal class, represents each record in `FilesCursor.each()` or document returned from `.findOne()` method
 */
export class FileCursor {
  constructor(_fileRef, _collection) {
    this._fileRef = _fileRef;
    this._collection = _collection;
    Object.assign(this, _fileRef);
  }

  /**
   * @locus Client
   * @memberOf FileCursor
   * @name remove
   * @throws {Meteor.Error} - If no file reference is provided
   * @summary Remove document
   * @returns {FileCursor}
   */
  remove() {
    this._collection._debug('[FilesCollection] [FileCursor] [remove()]');
    if (this._fileRef) {
      this._collection.remove(this._fileRef._id);
    } else {
      throw new Meteor.Error(404, 'No such file');
    }
    return this;
  }

  /**
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

  /**
   * @locus Anywhere
   * @memberOf FileCursor
   * @name link
   * @param version? {string} - Name of file's subversion
   * @param uriBase? {string} - [Optional] URI base, see - https://github.com/veliovgroup/Meteor-Files/issues/626
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

  /**
   * @locus Anywhere
   * @memberOf FileCursor
   * @name get
   * @param property? {string} - Name of sub-object property
   * @summary Returns current document as a plain Object, if `property` is specified - returns value of sub-object property
   * @returns {FileObj|any}
   */
  get(property) {
    this._collection._debug(`[FilesCollection] [FileCursor] [get(${property})]`);
    if (property) {
      return this._fileRef[property];
    }
    return this._fileRef;
  }

  /**
   * @locus Anywhere
   * @memberOf FileCursor
   * @name fetch
   * @summary Returns document as plain Object in Array
   * @returns {FileObj[]}
   */
  fetch() {
    this._collection._debug('[FilesCollection] [FileCursor] [fetch()]');
    return [this._fileRef];
  }

  /**
   * @locus Anywhere
   * @memberOf FileCursor
   * @name fetchAsync
   * @summary Returns document as plain Object in Array
   * @returns {Promise<FileObj[]>}
   */
  async fetchAsync() {
    this._collection._debug('[FilesCollection] [FileCursor] [fetchAsync()]');
    return [this._fileRef];
  }

  /**
   * @locus Anywhere
   * @memberOf FileCursor
   * @name with
   * @summary Returns reactive version of current FileCursor, useful to use with `{{#with}}...{{/with}}` block template helper
   * @returns {FileObj[]}
   */
  with() {
    this._collection._debug('[FilesCollection] [FileCursor] [with()]');
    return Object.assign(this, this._collection.collection.findOne(this._fileRef._id));
  }
}

/**
 * @private
 * @locus Anywhere
 * @class FilesCursor
 * @param _selector {Mongo.Selector | Mongo.ObjectID | string} - Mongo-Style selector (https://docs.meteor.com/api/collections.html#selectors)
 * @param options {Mongo.Options} - Mongo-Style selector Options (https://docs.meteor.com/api/collections.html#selectors)
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

  /**
   * @locus Client
   * @memberOf FilesCursor
   * @name get
   * @summary Returns all matching document(s) as an Array. Alias of `.fetch()`
   * @returns {FileObj[]}
   */
  get() {
    this._collection._debug('[FilesCollection] [FilesCursor] [get()]');
    return this.cursor.fetch();
  }

  /**
   * @locus Anywhere
   * @memberOf FilesCursor
   * @name getAsync
   * @summary Returns all matching document(s) as an Array. Alias of `.fetch()`
   * @returns {Promise<FileObj[]>}
   */
  async getAsync() {
    this._collection._debug('[FilesCollection] [FilesCursor] [getAsync()]');
    return await this.cursor.fetchAsync();
  }

  /**
   * @locus Client
   * @memberOf FilesCursor
   * @name hasNext
   * @summary Returns `true` if there is next item available on Cursor
   * @returns {boolean}
   */
  hasNext() {
    this._collection._debug('[FilesCollection] [FilesCursor] [hasNext()]');
    return this._current < (this.cursor.count()) - 1;
  }

  /**
   * @locus Anywhere
   * @memberOf FilesCursor
   * @name hasNextAsync
   * @summary Returns `true` if there is next item available on Cursor
   * @returns {Promise<boolean>}
   */
  async hasNextAsync() {
    this._collection._debug('[FilesCollection] [FilesCursor] [hasNextAsync()]');
    return this._current < (await this.cursor.countAsync()) - 1;
  }

  /**
   * @locus Client
   * @memberOf FilesCursor
   * @name next
   * @summary Returns next item on Cursor, if available
   * @returns {FileObj|undefined}
   */
  next() {
    this._collection._debug('[FilesCollection] [FilesCursor] [next()]');
    return this.cursor.fetch()[++this._current];
  }

  /**
   * @locus Anywhere
   * @memberOf FilesCursor
   * @name nextAsync
   * @summary Returns next item on Cursor, if available
   * @returns {Promise<FileObj|undefined>}
   */
  async nextAsync() {
    this._collection._debug('[FilesCollection] [FilesCursor] [nextAsync()]');
    return (await this.cursor.fetchAsync())[++this._current];
  }

  /**
   * @locus Anywhere
   * @memberOf FilesCursor
   * @name hasPrevious
   * @summary Returns `true` if there is previous item available on Cursor
   * @returns {boolean}
   */
  hasPrevious() {
    this._collection._debug('[FilesCollection] [FilesCursor] [hasPrevious()]');
    return this._current !== -1;
  }

  /**
   * @locus Anywhere
   * @memberOf FilesCursor
   * @name hasPreviousAsync
   * @summary Returns `true` if there is previous item available on Cursor
   * @returns {Promise<boolean>}
   */
  async hasPreviousAsync() {
    this._collection._debug('[FilesCollection] [FilesCursor] [hasPreviousAsync()]');
    return this._current !== -1;
  }

  /**
   * @locus Client
   * @memberOf FilesCursor
   * @name previous
   * @summary Returns previous item on Cursor, if available
   * @returns {FileObj|undefined}
   */
  previous() {
    this._collection._debug('[FilesCollection] [FilesCursor] [previous()]');
    return this.cursor.fetch()[--this._current];
  }

  /**
   * @locus Anywhere
   * @memberOf FilesCursor
   * @name previousAsync
   * @summary Returns previous item on Cursor, if available
   * @returns {Promise<FileObj|undefined>}
   */
  async previousAsync() {
    this._collection._debug('[FilesCollection] [FilesCursor] [previousAsync()]');
    return (await this.cursor.fetchAsync())[--this._current];
  }

  /**
   * @locus Client
   * @memberOf FilesCursor
   * @name fetch
   * @summary Returns all matching document(s) as an Array.
   * @returns {FileObj[]}
   */
  fetch() {
    this._collection._debug('[FilesCollection] [FilesCursor] [fetch()]');
    return this.cursor.fetch() || [];
  }

  /**
   * @locus Anywhere
   * @memberOf FilesCursor
   * @name fetchAsync
   * @summary Returns all matching document(s) as an Array.
   * @returns {Promise<FileObj[]>}
   */
  async fetchAsync() {
    this._collection._debug('[FilesCollection] [FilesCursor] [fetchAsync()]');
    return (await this.cursor.fetchAsync()) || [];
  }

  /**
   * @locus Client
   * @memberOf FilesCursor
   * @name first
   * @summary Returns first item on Cursor, if available
   * @returns {FileObj|undefined}
   */
  first() {
    this._collection._debug('[FilesCollection] [FilesCursor] [first()]');
    this._current = 0;
    return this.fetch()[this._current];
  }

  /**
   * @locus Anywhere
   * @memberOf FilesCursor
   * @name firstAsync
   * @summary Returns first item on Cursor, if available
   * @returns {Promise<FileObj|undefined>}
   */
  async firstAsync() {
    this._collection._debug('[FilesCollection] [FilesCursor] [firstAsync()]');
    this._current = 0;
    return (await this.fetchAsync())[this._current];
  }

  /**
   * @locus Client
   * @memberOf FilesCursor
   * @name last
   * @summary Returns last item on Cursor, if available
   * @returns {FileObj|undefined}
   */
  last() {
    this._collection._debug('[FilesCollection] [FilesCursor] [last()]');
    this._current = this.count() - 1;
    if (this._current >= 0) {
      return this.fetch()[this._current];
    }
    return void 0;
  }

  /**
   * @locus Anywhere
   * @memberOf FilesCursor
   * @name lastAsync
   * @summary Returns last item on Cursor, if available
   * @returns {Promise<FileObj|undefined>}
   */
  async lastAsync() {
    this._collection._debug('[FilesCollection] [FilesCursor] [lastAsync()]');
    this._current = (await this.countAsync()) - 1;
    return (await this.fetchAsync())[this._current];
  }

  /**
   * @locus Client
   * @memberOf FilesCursor
   * @name count
   * @summary Returns the number of documents that match a query
   * @returns {number}
   */
  count() {
    this._collection._debug('[FilesCollection] [FilesCursor] [count()]');
    return this.cursor.count();
  }

  /**
   * @locus Anywhere
   * @memberOf FilesCursor
   * @name countAsync
   * @summary Returns the number of documents that match a query
   * @returns {Promise<number>}
   */
  async countAsync() {
    this._collection._debug('[FilesCollection] [FilesCursor] [countAsync()]');
    return await this.cursor.countAsync();
  }

  /**
   * @locus Client
   * @memberOf FilesCursor
   * @name remove
   * @summary Removes all documents that match a query; Callback has two arguments: `error` and `number` of removed records
   * @returns {FilesCursor}
   */
  remove(callback = () => {}) {
    this._collection._debug('[FilesCollection] [FilesCursor] [remove()]');
    this._collection.remove(this._selector, callback);
    return this;
  }

  /**
   * @locus Anywhere
   * @memberOf FilesCursor
   * @name removeAsync
   * @summary Removes all documents that match a query; Returns number of removed records
   * @returns {Promise<number>}
   */
  async removeAsync() {
    this._collection._debug('[FilesCollection] [FilesCursor] [removeAsync()]');
    return await this._collection.removeAsync(this._selector);
  }

  /**
   * @locus Client
   * @memberOf FilesCursor
   * @name forEach
   * @param callback {Function} - Function to call. It will be called with three arguments: the `file`, a 0-based index, and cursor itself
   * @param context? {object} - An object which will be the value of `this` inside `callback`
   * @summary Call `callback` once for each matching document, sequentially and synchronously.
   * @returns {FilesCursor}
   */
  forEach(callback, context = {}) {
    this._collection._debug('[FilesCollection] [FilesCursor] [forEach()]');
    this.cursor.forEach(callback, context);
    return this;
  }

  /**
   * @locus Anywhere
   * @memberOf FilesCursor
   * @name forEachAsync
   * @param callback {Function} - Function to call. It will be called with three arguments: the `file`, a 0-based index, and cursor itself
   * @param context? {object} - An object which will be the value of `this` inside `callback`
   * @summary Call `callback` once for each matching document, sequentially and synchronously.
   * @returns {Promise<FilesCursor>}
   */
  async forEachAsync(callback, context = {}) {
    this._collection._debug('[FilesCollection] [FilesCursor] [forEachAsync()]');
    await this.cursor.forEachAsync(callback, context);
    return this;
  }

  /**
   * @locus Client
   * @memberOf FilesCursor
   * @name each
   * @summary Returns an Array of FileCursor made for each document on current cursor
   *          Useful when using in {{#each FilesCursor#each}}...{{/each}} block template helper
   * @returns {FileCursor[]}
   */
  each() {
    return this.map((file) => {
      return new FileCursor(file, this._collection);
    });
  }

  /**
   * @locus Anywhere
   * @memberOf FilesCursor
   * @name eachAsync
   * @summary Returns an Array of FileCursor made for each document on current cursor
   *          Useful when using in {{#each FilesCursor#each}}...{{/each}} block template helper
   * @returns {Promise<FileCursor[]>}
   */
  async eachAsync() {
    return await this.mapAsync((file) => {
      return new FileCursor(file, this._collection);
    });
  }

  /**
   * @locus Client
   * @memberOf FilesCursor
   * @name map
   * @param callback {Function} - Function to call. It will be called with three arguments: the `file`, a 0-based index, and cursor itself
   * @param context? {object} - An object which will be the value of `this` inside `callback`
   * @summary Map `callback` over all matching documents. Returns an Array.
   * @returns {FileObj[]}
   */
  async map(callback, context = {}) {
    this._collection._debug('[FilesCollection] [FilesCursor] [map()]');
    return this.cursor.map(callback, context);
  }

  /**
   * @locus Anywhere
   * @memberOf FilesCursor
   * @name mapAsync
   * @param callback {Function} - Function to call. It will be called with three arguments: the `file`, a 0-based index, and cursor itself
   * @param context {Object} - An object which will be the value of `this` inside `callback`
   * @summary Map `callback` over all matching documents. Returns an Array.
   * @returns {Promise<FileObj[]>}
   */
  async mapAsync(callback, context = {}) {
    this._collection._debug('[FilesCollection] [FilesCursor] [mapAsync()]');
    return await this.cursor.mapAsync(callback, context);
  }

  /**
   * @locus Client
   * @memberOf FilesCursor
   * @name current
   * @summary Returns current item on Cursor, if available
   * @returns {FileObj|undefined}
   */
  current() {
    this._collection._debug('[FilesCollection] [FilesCursor] [current()]');
    if (this._current < 0) {
      this._current = 0;
    }
    return this.fetch()[this._current];
  }

  /**
   * @locus Anywhere
   * @memberOf FilesCursor
   * @name currentAsync
   * @summary Returns current item on Cursor, if available
   * @returns {Promise<FileObj|undefined>}
   */
  async currentAsync() {
    this._collection._debug('[FilesCollection] [FilesCursor] [currentAsync()]');
    if (this._current < 0) {
      this._current = 0;
    }
    return (await this.fetchAsync())[this._current];
  }

  /**
   * @locus Client
   * @memberOf FilesCursor
   * @name observe
   * @param callbacks {Mongo.ObserveCallbacks} - Functions to call to deliver the result set as it changes
   * @summary Watch a query. Receive callbacks as the result set changes.
   * @url https://docs.meteor.com/api/collections.html#Mongo-Cursor-observe
   * @returns {Meteor.LiveQueryHandle} - live query handle
   */
  observe(callbacks) {
    this._collection._debug('[FilesCollection] [FilesCursor] [observe()]');
    return this.cursor.observe(callbacks);
  }

  /**
   * @locus Anywhere
   * @memberOf FilesCursor
   * @name observeAsync
   * @param callbacks {Mongo.ObserveCallbacks} - Functions to call to deliver the result set as it changes
   * @summary Watch a query. Receive callbacks as the result set changes.
   * @url https://docs.meteor.com/api/collections.html#Mongo-Cursor-observeAsync
   * @returns {Promise<Meteor.LiveQueryHandle>} - live query handle
   */
  async observeAsync(callbacks) {
    this._collection._debug('[FilesCollection] [FilesCursor] [observeAsync()]');
    return await this.cursor.observeAsync(callbacks);
  }

  /**
   * @locus Client
   * @memberOf FilesCursor
   * @name observeChanges
   * @param callbacks {Mongo.ObserveChangesCallbacks} - Functions to call to deliver the result set as it changes
   * @summary Watch a query. Receive callbacks as the result set changes. Only the differences between the old and new documents are passed to the callbacks.
   * @url https://docs.meteor.com/api/collections.html#Mongo-Cursor-observeChanges
   * @returns {Meteor.LiveQueryHandle} - live query handle
   */
  observeChanges(callbacks) {
    this._collection._debug('[FilesCollection] [FilesCursor] [observeChanges()]');
    return this.cursor.observeChanges(callbacks);
  }

  /**
   * @locus Anywhere
   * @memberOf FilesCursor
   * @name observeChangesAsync
   * @param callbacks {Mongo.ObserveChangesCallbacks} - Functions to call to deliver the result set as it changes
   * @summary Watch a query. Receive callbacks as the result set changes. Only the differences between the old and new documents are passed to the callbacks.
   * @url https://docs.meteor.com/api/collections.html#Mongo-Cursor-observeChangesAsync
   * @returns {Promise<Meteor.LiveQueryHandle>} - live query handle
   */
  async observeChangesAsync(callbacks) {
    this._collection._debug('[FilesCollection] [FilesCursor] [observeChangesAsync()]');
    return await this.cursor.observeChangesAsync(callbacks);
  }
}
