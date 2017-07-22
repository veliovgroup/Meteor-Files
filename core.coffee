`import { FilesCursor, FileCursor } from './cursor.coffee'`
`import { fixJSONParse, fixJSONStringify, formatFleURL } from './lib.coffee'`

class FilesCollectionCore
  constructor: () ->
  ###
  @locus Anywhere
  @memberOf FilesCollection
  @name _getFileName
  @param {Object} fileData - File Object
  @summary Returns file's name
  @returns {String}
  ###
  _getFileName: (fileData) ->
    fileName = fileData.name or fileData.fileName
    if _.isString(fileName) and fileName.length > 0
      return (fileData.name or fileData.fileName).replace(/\.\./g, '').replace /\//g, ''
    else
      return ''

  ###
  @locus Anywhere
  @memberOf FilesCollection
  @name _getExt
  @param {String} FileName - File name
  @summary Get extension from FileName
  @returns {Object}
  ###
  _getExt: (fileName) ->
    if !!~fileName.indexOf('.')
      extension = (fileName.split('.').pop().split('?')[0] or '').toLowerCase()
      return { ext: extension, extension, extensionWithDot: '.' + extension }
    else
      return { ext: '', extension: '', extensionWithDot: '' }

  ###
  @locus Anywhere
  @memberOf FilesCollection
  @name _updateFileTypes
  @param {Object} data - File data
  @summary Internal method. Classify file based on 'type' field
  ###
  _updateFileTypes: (data) ->
    data.isVideo  = /^video\//i.test data.type
    data.isAudio  = /^audio\//i.test data.type
    data.isImage  = /^image\//i.test data.type
    data.isText   = /^text\//i.test data.type
    data.isJSON   = /^application\/json$/i.test data.type
    data.isPDF    = /^application\/(x-)?pdf$/i.test data.type
    return

  ###
  @locus Anywhere
  @memberOf FilesCollection
  @name _dataToSchema
  @param {Object} data - File data
  @summary Internal method. Build object in accordance with default schema from File data
  @returns {Object}
  ###
  _dataToSchema: (data) ->
    ds =
      name:       data.name
      extension:  data.extension
      path:       data.path
      meta:       data.meta
      type:       data.type
      size:       data.size
      userId:     data.userId or null
      versions:
        original:
          path: data.path
          size: data.size
          type: data.type
          extension: data.extension
      _downloadRoute:  data._downloadRoute or @downloadRoute
      _collectionName: data._collectionName or @collectionName
    
    #Optional fileId
    if data.fileId
       ds._id = data.fileId;
    
    @_updateFileTypes ds
    ds._storagePath = data._storagePath or @storagePath(_.extend(data, ds))
    return ds

  ###
  @locus Anywhere
  @memberOf FilesCollection
  @name findOne
  @param {String|Object} selector - Mongo-Style selector (http://docs.meteor.com/api/collections.html#selectors)
  @param {Object} options - Mongo-Style selector Options (http://docs.meteor.com/api/collections.html#sortspecifiers)
  @summary Find and return Cursor for matching document Object
  @returns {FileCursor} Instance
  ###
  findOne: (selector, options) ->
    @_debug "[FilesCollection] [findOne(#{JSON.stringify(selector)}, #{JSON.stringify(options)})]"
    check selector, Match.Optional Match.OneOf Object, String, Boolean, Number, null
    check options, Match.Optional Object

    selector = {} unless arguments.length
    doc = @collection.findOne selector, options
    return if doc then new FileCursor(doc, @) else doc

  ###
  @locus Anywhere
  @memberOf FilesCollection
  @name find
  @param {String|Object} selector - Mongo-Style selector (http://docs.meteor.com/api/collections.html#selectors)
  @param {Object}        options  - Mongo-Style selector Options (http://docs.meteor.com/api/collections.html#sortspecifiers)
  @summary Find and return Cursor for matching documents
  @returns {FilesCursor} Instance
  ###
  find: (selector, options) ->
    @_debug "[FilesCollection] [find(#{JSON.stringify(selector)}, #{JSON.stringify(options)})]"
    check selector, Match.Optional Match.OneOf Object, String, Boolean, Number, null
    check options, Match.Optional Object

    selector = {} unless arguments.length
    return new FilesCursor selector, options, @

  ###
  @locus Anywhere
  @memberOf FilesCollection
  @name update
  @see http://docs.meteor.com/#/full/update
  @summary link Mongo.Collection update method
  @returns {Mongo.Collection} Instance
  ###
  update: ->
    @collection.update.apply @collection, arguments
    return @collection

  ###
  @locus Anywhere
  @memberOf FilesCollection
  @name link
  @param {Object} fileRef - File reference object
  @param {String} version - Version of file you would like to request
  @summary Returns downloadable URL
  @returns {String} Empty string returned in case if file not found in DB
  ###
  link: (fileRef, version = 'original') ->
    @_debug "[FilesCollection] [link(#{fileRef?._id}, #{version})]"
    check fileRef, Object
    check version, String
    return '' if not fileRef
    return formatFleURL fileRef, version

`export { FilesCollectionCore }`