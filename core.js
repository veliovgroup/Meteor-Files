import { EventEmitter } from 'eventemitter3';
import { check, Match } from 'meteor/check';
import { formatFleURL, helpers } from './lib.js';
import { FilesCursor, FileCursor } from './cursor.js';

export default class FilesCollectionCore extends EventEmitter {
  constructor() {
    super();
  }

  static __helpers = helpers;

  static schema = {
    _id: {
      type: String
    },
    size: {
      type: Number
    },
    name: {
      type: String
    },
    type: {
      type: String
    },
    path: {
      type: String
    },
    isVideo: {
      type: Boolean
    },
    isAudio: {
      type: Boolean
    },
    isImage: {
      type: Boolean
    },
    isText: {
      type: Boolean
    },
    isJSON: {
      type: Boolean
    },
    isPDF: {
      type: Boolean
    },
    extension: {
      type: String,
      optional: true
    },
    ext: {
      type: String,
      optional: true
    },
    extensionWithDot: {
      type: String,
      optional: true
    },
    mime: {
      type: String,
      optional: true
    },
    'mime-type': {
      type: String,
      optional: true
    },
    _storagePath: {
      type: String
    },
    _downloadRoute: {
      type: String
    },
    _collectionName: {
      type: String
    },
    public: {
      type: Boolean,
      optional: true
    },
    meta: {
      type: Object,
      blackbox: true,
      optional: true
    },
    userId: {
      type: String,
      optional: true
    },
    updatedAt: {
      type: Date,
      optional: true
    },
    versions: {
      type: Object,
      blackbox: true
    }
  };

  /**
   * Print logs in debug mode.
   * @locus Anywhere
   * @memberOf FilesCollectionCore
   * @returns {void}
   */
  _debug() {
    if (this.debug) {
      // eslint-disable-next-line no-console
      (console.info || console.log || function () {}).apply(undefined, arguments);
    }
  }

  /**
   * Returns file's name.
   * @locus Anywhere
   * @memberOf FilesCollectionCore
   * @param {FileData} fileData - File data object
   * @returns {string} The sanitized file name
   */
  _getFileName(fileData) {
    const fileName = fileData.name || fileData.fileName;
    if (helpers.isString(fileName) && fileName.length > 0) {
      return fileName.replace(/^\.\.+/, '').replace(/\.{2,}/g, '.').replace(/\//g, '');
    }
    return '';
  }

  /**
   * Extracts extension information from a file name.
   * @locus Anywhere
   * @memberOf FilesCollectionCore
   * @param {string} fileName - The file name
   * @returns {Partial<FileData>} An object with properties: ext, extension, and extensionWithDot
   */
  _getExt(fileName) {
    if (fileName.includes('.')) {
      const extension = (fileName.split('.').pop().split('?')[0] || '')
        .toLowerCase()
        .replace(/([^a-z0-9\-\_\.]+)/gi, '')
        .substring(0, 20);
      return { ext: extension, extension, extensionWithDot: `.${extension}` };
    }
    return { ext: '', extension: '', extensionWithDot: '' };
  }

  /**
   * Classifies the file based on its MIME type.
   * @locus Anywhere
   * @memberOf FilesCollectionCore
   * @param {FileData} data - File data object
   * @returns {void}
   */
  _updateFileTypes(data) {
    data.isVideo = /^video\//i.test(data.type);
    data.isAudio = /^audio\//i.test(data.type);
    data.isImage = /^image\//i.test(data.type);
    data.isText = /^text\//i.test(data.type);
    data.isJSON = /^application\/json$/i.test(data.type);
    data.isPDF = /^application\/(x-)?pdf$/i.test(data.type);
  }

  /**
   * Builds an object that conforms to the default schema from file data.
   * @locus Anywhere
   * @memberOf FilesCollectionCore
   * @param {FileData & Partial<FileObj>} data - File data combined with optional FileObj properties
   * @returns {Partial<FileObj>} The schema-compliant file object
   */
  _dataToSchema(data) {
    const ds = {
      name: data.name,
      extension: data.extension,
      ext: data.extension,
      extensionWithDot: `.${data.extension}`,
      path: data.path,
      meta: data.meta,
      type: data.type,
      mime: data.type,
      'mime-type': data.type,
      size: data.size,
      userId: data.userId || null,
      versions: {
        original: {
          path: data.path,
          size: data.size,
          type: data.type,
          extension: data.extension
        }
      },
      _downloadRoute: data._downloadRoute || this.downloadRoute,
      _collectionName: data._collectionName || this.collectionName
    };

    // Optional fileId
    if (data.fileId) {
      ds._id = data.fileId;
    }

    this._updateFileTypes(ds);
    ds._storagePath = data._storagePath || this.storagePath(Object.assign({}, data, ds));
    return ds;
  }

  /**
   * Finds and returns a FileCursor for a matching document asynchronously.
   * @locus Anywhere
   * @memberOf FilesCollectionCore
   * @param {MeteorFilesSelector} [selector={}] - Mongo-style selector
   * @param {MeteorFilesOptions} [options] - Mongo query options
   * @returns {Promise<FileCursor|null>} A FileCursor instance, or null if not found
   */
  async findOneAsync(selector = {}, options) {
    this._debug(`[FilesCollection] [findOneAsync(${JSON.stringify(selector)}, ${JSON.stringify(options)})]`);
    /* eslint-disable new-cap */
    check(selector, Match.Optional(Match.OneOf(Object, String, Boolean, Number, null)));
    check(options, Match.Optional(Object));
    /* eslint-enable new-cap */

    const doc = await this.collection.findOneAsync(selector, options);
    if (doc) {
      return new FileCursor(doc, this);
    }
    return null;
  }

  /**
   * Finds and returns a FileCursor for a matching document (client only).
   * @locus Client
   * @memberOf FilesCollectionCore
   * @param {MeteorFilesSelector} [selector={}] - Mongo-style selector
   * @param {MeteorFilesOptions} [options] - Mongo query options
   * @returns {FileCursor|null} A FileCursor instance, or null if not found
   */
  findOne(selector = {}, options) {
    this._debug(`[FilesCollection] [findOne(${JSON.stringify(selector)}, ${JSON.stringify(options)})]`);
    if (Meteor.isServer) {
      throw new Meteor.Error(404, 'FilesCollection#findOne() not available in server! Use .findOneAsync instead');
    }
    /* eslint-disable new-cap */
    check(selector, Match.Optional(Match.OneOf(Object, String, Boolean, Number, null)));
    check(options, Match.Optional(Object));
    /* eslint-enable new-cap */

    const doc = this.collection.findOne(selector, options);
    if (doc) {
      return new FileCursor(doc, this);
    }
    return null;
  }

  /**
   * Finds and returns a FilesCursor for matching documents.
   * @locus Anywhere
   * @memberOf FilesCollectionCore
   * @param {MeteorFilesSelector} [selector={}] - Mongo-style selector
   * @param {MeteorFilesOptions} [options] - Mongo query options
   * @returns {FilesCursor} A FilesCursor instance
   */
  find(selector = {}, options) {
    this._debug(`[FilesCollection] [find(${JSON.stringify(selector)}, ${JSON.stringify(options)})]`);
    /* eslint-disable new-cap */
    check(selector, Match.Optional(Match.OneOf(Object, String, Boolean, Number, null)));
    check(options, Match.Optional(Object));
    /* eslint-enable new-cap */

    return new FilesCursor(selector, options, this);
  }

  /**
   * Links to the underlying Mongo.Collection update method
   * @locus Client
   * @memberOf FilesCollectionCore
   * @param {...*} args - Update method arguments
   * @returns {Mongo.Collection} The underlying collection
   */
  update(...args) {
    this.collection.update.apply(this.collection, args);
    return this.collection;
  }

  /**
   * Links to the underlying Mongo.Collection updateAsync method.
   * @locus Anywhere
   * @memberOf FilesCollectionCore
   * @param {...*} args - Update method arguments
   * @returns {Promise<number>} The number of updated records
   */
  async updateAsync(...args) {
    return await this.collection.updateAsync.apply(this.collection, args);
  }

  /**
   * Counts records matching a selector.
   * @locus Anywhere
   * @memberOf FilesCollectionCore
   * @param {MeteorFilesSelector} [selector={}] - Mongo-style selector
   * @param {MeteorFilesOptions} [options] - Mongo query options
   * @returns {Promise<number>} The number of matching records
   */
  async countDocuments(selector = {}, options) {
    this._debug(`[FilesCollection] [countDocuments(${JSON.stringify(selector)}, ${JSON.stringify(options)})]`);
    /* eslint-disable new-cap */
    check(selector, Match.Optional(Match.OneOf(Object, String, Boolean, Number, null)));
    check(options, Match.Optional(Object));
    /* eslint-enable new-cap */

    return await this.collection.countDocuments(selector, options);
  }

  /**
   * Returns a downloadable URL for a file.
   * @locus Anywhere
   * @memberOf FilesCollectionCore
   * @param {Partial<FileObj>} fileObj - A partial file object reference
   * @param {string} [version='original'] - The file version
   * @param {string} [uriBase] - Optional URI base
   * @returns {string} The download URL, or an empty string if the file is not found
   */
  link(fileObj, version = 'original', uriBase) {
    this._debug(`[FilesCollection] [link(${helpers.isObject(fileObj) ? fileObj._id : undefined}, ${version})]`);
    check(fileObj, Object);

    if (!fileObj) {
      return '';
    }
    return formatFleURL(fileObj, version, uriBase);
  }
}
