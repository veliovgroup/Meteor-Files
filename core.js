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

  /*
   * @locus Anywhere
   * @memberOf FilesCollectionCore
   * @name _debug
   * @summary Print logs in debug mode
   * @returns {void}
   */
  _debug() {
    if (this.debug) {
      // eslint-disable-next-line no-console
      (console.info || console.log || function () {}).apply(void 0, arguments);
    }
  }

  /*
   * @locus Anywhere
   * @memberOf FilesCollectionCore
   * @name _getFileName
   * @param {Object} fileData - File Object
   * @summary Returns file's name
   * @returns {String}
   */
  _getFileName(fileData) {
    const fileName = fileData.name || fileData.fileName;
    if (helpers.isString(fileName) && (fileName.length > 0)) {
      return (fileData.name || fileData.fileName).replace(/^\.\.+/, '').replace(/\.{2,}/g, '.').replace(/\//g, '');
    }
    return '';
  }

  /*
   * @locus Anywhere
   * @memberOf FilesCollectionCore
   * @name _getExt
   * @param {String} FileName - File name
   * @summary Get extension from FileName
   * @returns {Object}
   */
  _getExt(fileName) {
    if (fileName.includes('.')) {
      const extension = (fileName.split('.').pop().split('?')[0] || '').toLowerCase().replace(/([^a-z0-9\-\_\.]+)/gi, '').substring(0, 20);
      return { ext: extension, extension, extensionWithDot: `.${extension}` };
    }
    return { ext: '', extension: '', extensionWithDot: '' };
  }

  /*
   * @locus Anywhere
   * @memberOf FilesCollectionCore
   * @name _updateFileTypes
   * @param {Object} data - File data
   * @summary Internal method. Classify file based on 'type' field
   */
  _updateFileTypes(data) {
    data.isVideo = /^video\//i.test(data.type);
    data.isAudio = /^audio\//i.test(data.type);
    data.isImage = /^image\//i.test(data.type);
    data.isText = /^text\//i.test(data.type);
    data.isJSON = /^application\/json$/i.test(data.type);
    data.isPDF = /^application\/(x-)?pdf$/i.test(data.type);
  }

  /*
   * @locus Anywhere
   * @memberOf FilesCollectionCore
   * @name _dataToSchema
   * @param {Object} data - File data
   * @summary Internal method. Build object in accordance with default schema from File data
   * @returns {Object}
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

    //Optional fileId
    if (data.fileId) {
      ds._id = data.fileId;
    }

    this._updateFileTypes(ds);
    ds._storagePath = data._storagePath || this.storagePath(Object.assign({}, data, ds));
    return ds;
  }

  /*
   * @locus Anywhere
   * @memberOf FilesCollectionCore
   * @name findOneAsync
   * @param {String|Object} selector - Mongo-Style selector (http://docs.meteor.com/api/collections.html#selectors)
   * @param {Object} options - Mongo-Style selector Options (http://docs.meteor.com/api/collections.html#sortspecifiers)
   * @summary Find and return Cursor for matching document Object
   * @returns {Promise<FileCursor>} Instance
   */
  async findOneAsync(selector = {}, options) {
    this._debug(`[FilesCollection] [findOneAsync(${JSON.stringify(selector)}, ${JSON.stringify(options)})]`);
    check(selector, Match.Optional(Match.OneOf(Object, String, Boolean, Number, null)));
    check(options, Match.Optional(Object));

    const doc = await this.collection.findOneAsync(selector, options);
    if (doc) {
      return new FileCursor(doc, this);
    }
    return doc;
  }

  /*
   * @locus Anywhere
   * @memberOf FilesCollectionCore
   * @name find
   * @param {String|Object} selector - Mongo-Style selector (http://docs.meteor.com/api/collections.html#selectors)
   * @param {Object}        options  - Mongo-Style selector Options (http://docs.meteor.com/api/collections.html#sortspecifiers)
   * @summary Find and return Cursor for matching documents
   * @returns {FilesCursor} Instance
   */
  find(selector = {}, options) {
    this._debug(`[FilesCollection] [find(${JSON.stringify(selector)}, ${JSON.stringify(options)})]`);
    check(selector, Match.Optional(Match.OneOf(Object, String, Boolean, Number, null)));
    check(options, Match.Optional(Object));

    return new FilesCursor(selector, options, this);
  }

  /*
   * @locus Anywhere
   * @memberOf FilesCollectionCore
   * @name updateAsync
   * @see http://docs.meteor.com/#/full/update
   * @summary link Mongo.Collection update method
   * @returns {Promise<Mongo.Collection>} Instance
   */
  async updateAsync() {
    await this.collection.updateAsync.apply(this.collection, arguments);
    return this.collection;
  }

  /*
   * @locus Anywhere
   * @memberOf FilesCollectionCore
   * @name link
   * @param {Object} fileRef - File reference object
   * @param {String} version - Version of file you would like to request
   * @param {String} uriBase - [Optional] URI base, see - https://github.com/veliovgroup/Meteor-Files/issues/626
   * @summary Returns downloadable URL
   * @returns {String} Empty string returned in case if file not found in DB
   */
  link(fileRef, version = 'original', uriBase) {
    this._debug(`[FilesCollection] [link(${(helpers.isObject(fileRef) ? fileRef._id : void 0)}, ${version})]`);
    check(fileRef, Object);

    if (!fileRef) {
      return '';
    }
    return formatFleURL(fileRef, version, uriBase);
  }
}
