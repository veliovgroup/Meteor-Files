NOOP = -> return

if Meteor.isServer
  ###
  @summary Require NPM packages
  ###
  fs       = Npm.require 'fs-extra'
  events   = Npm.require 'events'
  request  = Npm.require 'request'
  Throttle = Npm.require 'throttle'
  fileType = Npm.require 'file-type'
  nodePath = Npm.require 'path'

  ###
  @var {Object} bound - Meteor.bindEnvironment (Fiber wrapper)
  ###
  bound = Meteor.bindEnvironment (callback) -> return callback()

  ###
  @private
  @locus Server
  @class writeStream
  @param path      {String} - Path to file on FS
  @param maxLength {Number} - Max amount of chunks in stream
  @param file      {Object} - fileRef Object
  @summary writableStream wrapper class, makes sure chunks is written in given order
  ###
  class writeStream
    constructor: (@path, @maxLength, @file) ->
      self           = @
      @stream        = fs.createWriteStream @path, {flags: 'a', mode: self.permissions, highWaterMark: 0}
      @drained       = true
      @writtenChunks = 0

      @stream.on 'drain', -> bound ->
        ++self.writtenChunks
        self.drained = true
        return

      @stream.on 'error', (error) -> bound ->
        return

    ###
    @memberOf writeStream
    @name write
    @param {Number} num - Chunk position in stream
    @param {Buffer} chunk - Chunk binary data
    @param {Function} callback - Callback
    @summary Write chunk in given order
    @returns {Boolean} - True if chunk is sent to stream, false if chunk is set into queue
    ###
    write: (num, chunk, callback) ->
      if not @stream._writableState.ended and num > @writtenChunks
        if @drained and num is (@writtenChunks + 1)
          @drained = false
          @stream.write chunk, callback
          return true
        else
          self = @
          Meteor.setTimeout ->
            self.write num, chunk
          , 25
      return false

    ###
    @memberOf writeStream
    @name end
    @param {Function} callback - Callback
    @summary Write chunk in given order
    @returns {Boolean} - True if stream is fulfilled, false if queue is in progress
    ###
    end: (callback) ->
      unless @stream._writableState.ended
        if @writtenChunks is @maxLength
          @stream.end callback
          return true
        else
          self = @
          Meteor.setTimeout ->
            self.end callback
          , 25
      return false

###
@private
@locus Anywhere
@class FileCursor
@param _fileRef    {Object} - Mongo-Style selector (http://docs.meteor.com/api/collections.html#selectors)
@param _collection {FilesCollection} - FilesCollection Instance
@summary Internal class, represents each record in `FilesCursor.each()` or document returned from `.findOne()` method
###
class FileCursor
  constructor: (@_fileRef, @_collection) ->
    self = @
    self = _.extend self, @_fileRef

  ###
  @locus Anywhere
  @memberOf FileCursor
  @name remove
  @param callback {Function} - Triggered asynchronously after item is removed or failed to be removed
  @summary Remove document
  @returns {FileCursor}
  ###
  remove: (callback) ->
    console.info '[FilesCollection] [FileCursor] [remove()]' if @_collection.debug
    if @_fileRef then @_collection.remove(@_fileRef._id, callback) else callback new Meteor.Error 404, 'No such file'
    return @

  ###
  @locus Anywhere
  @memberOf FileCursor
  @name link
  @param version {String} - Name of file's subversion
  @summary Returns downloadable URL to File
  @returns {String}
  ###
  link: (version) ->
    console.info "[FilesCollection] [FileCursor] [link(#{version})]" if @_collection.debug
    return if @_fileRef then @_collection.link(@_fileRef, version) else ''

  ###
  @locus Anywhere
  @memberOf FileCursor
  @name get
  @param property {String} - Name of sub-object property
  @summary Returns current document as a plain Object, if `property` is specified - returns value of sub-object property
  @returns {Object|mix}
  ###
  get: (property) ->
    console.info "[FilesCollection] [FileCursor] [get(#{property})]" if @_collection.debug
    if property
      return @_fileRef[property]
    else
      return @_fileRef

  ###
  @locus Anywhere
  @memberOf FileCursor
  @name fetch
  @summary Returns document as plain Object in Array
  @returns {[Object]}
  ###
  fetch: ->
    console.info '[FilesCollection] [FileCursor] [fetch()]' if @_collection.debug
    return [@_fileRef]

  ###
  @locus Anywhere
  @memberOf FileCursor
  @name with
  @summary Returns reactive version of current FileCursor, useful to use with `{{#with}}...{{/with}}` block template helper
  @returns {[Object]}
  ###
  with: ->
    console.info '[FilesCollection] [FileCursor] [with()]' if @_collection.debug
    self = @
    return _.extend self, @_collection.collection.findOne @_fileRef._id

###
@private
@locus Anywhere
@class FilesCursor
@param _selector   {String|Object}   - Mongo-Style selector (http://docs.meteor.com/api/collections.html#selectors)
@param options     {Object}          - Mongo-Style selector Options (http://docs.meteor.com/api/collections.html#selectors)
@param _collection {FilesCollection} - FilesCollection Instance
@summary Implementation of Cursor for FilesCollection
###
class FilesCursor
  constructor: (@_selector = {}, options, @_collection) ->
    @_current = -1
    @cursor   = @_collection.collection.find @_selector, options

  ###
  @locus Anywhere
  @memberOf FilesCursor
  @name get
  @summary Returns all matching document(s) as an Array. Alias of `.fetch()`
  @returns {[Object]}
  ###
  get: ->
    console.info "[FilesCollection] [FilesCursor] [get()]" if @_collection.debug
    return @cursor.fetch()

  ###
  @locus Anywhere
  @memberOf FilesCursor
  @name hasNext
  @summary Returns `true` if there is next item available on Cursor
  @returns {Boolean}
  ###
  hasNext: ->
    console.info '[FilesCollection] [FilesCursor] [hasNext()]' if @_collection.debug
    return @_current < @cursor.count() - 1

  ###
  @locus Anywhere
  @memberOf FilesCursor
  @name next
  @summary Returns next item on Cursor, if available
  @returns {Object|undefined}
  ###
  next: ->
    console.info '[FilesCollection] [FilesCursor] [next()]' if @_collection.debug
    if @hasNext()
      return @cursor.fetch()[++@_current]

  ###
  @locus Anywhere
  @memberOf FilesCursor
  @name hasPrevious
  @summary Returns `true` if there is previous item available on Cursor
  @returns {Boolean}
  ###
  hasPrevious: ->
    console.info '[FilesCollection] [FilesCursor] [hasPrevious()]' if @_collection.debug
    return @_current isnt -1

  ###
  @locus Anywhere
  @memberOf FilesCursor
  @name previous
  @summary Returns previous item on Cursor, if available
  @returns {Object|undefined}
  ###
  previous: ->
    console.info '[FilesCollection] [FilesCursor] [previous()]' if @_collection.debug
    if @hasPrevious()
      return @cursor.fetch()[--@_current]

  ###
  @locus Anywhere
  @memberOf FilesCursor
  @name fetch
  @summary Returns all matching document(s) as an Array.
  @returns {[Object]}
  ###
  fetch: ->
    console.info '[FilesCollection] [FilesCursor] [fetch()]' if @_collection.debug
    return @cursor.fetch()

  ###
  @locus Anywhere
  @memberOf FilesCursor
  @name first
  @summary Returns first item on Cursor, if available
  @returns {Object|undefined}
  ###
  first: ->
    console.info '[FilesCollection] [FilesCursor] [first()]' if @_collection.debug
    @_current = 0
    return @fetch()?[@_current]

  ###
  @locus Anywhere
  @memberOf FilesCursor
  @name last
  @summary Returns last item on Cursor, if available
  @returns {Object|undefined}
  ###
  last: ->
    console.info '[FilesCollection] [FilesCursor] [last()]' if @_collection.debug
    @_current = @count() - 1
    return @fetch()?[@_current]

  ###
  @locus Anywhere
  @memberOf FilesCursor
  @name count
  @summary Returns the number of documents that match a query
  @returns {Number}
  ###
  count: ->
    console.info '[FilesCollection] [FilesCursor] [count()]' if @_collection.debug
    return @cursor.count()

  ###
  @locus Anywhere
  @memberOf FilesCursor
  @name remove
  @param callback {Function} - Triggered asynchronously after item is removed or failed to be removed
  @summary Removes all documents that match a query
  @returns {FilesCursor}
  ###
  remove: (callback) ->
    console.info '[FilesCollection] [FilesCursor] [remove()]' if @_collection.debug
    @_collection.remove @_selector, callback, @
    return @

  ###
  @locus Anywhere
  @memberOf FilesCursor
  @name forEach
  @param callback {Function} - Function to call. It will be called with three arguments: the `file`, a 0-based index, and cursor itself
  @param context {Object} - An object which will be the value of `this` inside `callback`
  @summary Call `callback` once for each matching document, sequentially and synchronously.
  @returns {undefined}
  ###
  forEach: (callback, context = {}) ->
    console.info '[FilesCollection] [FilesCursor] [forEach()]' if @_collection.debug
    @cursor.forEach callback, context
    return

  ###
  @locus Anywhere
  @memberOf FilesCursor
  @name each
  @summary Returns an Array of FileCursor made for each document on current cursor
           Useful when using in {{#each FilesCursor#each}}...{{/each}} block template helper
  @returns {[FileCursor]}
  ###
  each: ->
    self = @
    return @map (file) ->
      return new FileCursor file, self._collection

  ###
  @locus Anywhere
  @memberOf FilesCursor
  @name map
  @param callback {Function} - Function to call. It will be called with three arguments: the `file`, a 0-based index, and cursor itself
  @param context {Object} - An object which will be the value of `this` inside `callback`
  @summary Map `callback` over all matching documents. Returns an Array.
  @returns {Array}
  ###
  map: (callback, context = {}) ->
    console.info '[FilesCollection] [FilesCursor] [map()]' if @_collection.debug
    return @cursor.map callback, context

  ###
  @locus Anywhere
  @memberOf FilesCursor
  @name current
  @summary Returns current item on Cursor, if available
  @returns {Object|undefined}
  ###
  current: ->
    console.info '[FilesCollection] [FilesCursor] [current()]' if @_collection.debug
    @_current = 0 if @_current < 0
    return @fetch()[@_current]

  ###
  @locus Anywhere
  @memberOf FilesCursor
  @name observe
  @param callbacks {Object} - Functions to call to deliver the result set as it changes
  @summary Watch a query. Receive callbacks as the result set changes.
  @url http://docs.meteor.com/api/collections.html#Mongo-Cursor-observe
  @returns {Object} - live query handle
  ###
  observe: (callbacks) ->
    console.info '[FilesCollection] [FilesCursor] [observe()]' if @_collection.debug
    return @cursor.observe callbacks

  ###
  @locus Anywhere
  @memberOf FilesCursor
  @name observeChanges
  @param callbacks {Object} - Functions to call to deliver the result set as it changes
  @summary Watch a query. Receive callbacks as the result set changes. Only the differences between the old and new documents are passed to the callbacks.
  @url http://docs.meteor.com/api/collections.html#Mongo-Cursor-observeChanges
  @returns {Object} - live query handle
  ###
  observeChanges: (callbacks) ->
    console.info '[FilesCollection] [FilesCursor] [observeChanges()]' if @_collection.debug
    return @cursor.observeChanges callbacks

###
@var {Function} fixJSONParse - Fix issue with Date parse
###
fixJSONParse = (obj) ->
  for key, value of obj
    if _.isString(value) and !!~value.indexOf '=--JSON-DATE--='
      value = value.replace '=--JSON-DATE--=', ''
      obj[key] = new Date parseInt value
    else if _.isObject value
      obj[key] = fixJSONParse value
    else if _.isArray value
      for v, i in value
        if _.isObject(v)
          obj[key][i] = fixJSONParse v
        else if _.isString(v) and !!~v.indexOf '=--JSON-DATE--='
          v = v.replace '=--JSON-DATE--=', ''
          obj[key][i] = new Date parseInt v
  return obj

###
@var {Function} fixJSONStringify - Fix issue with Date stringify
###
fixJSONStringify = (obj) ->
  for key, value of obj
    if _.isDate value
      obj[key] = '=--JSON-DATE--=' + (+value)
    else if _.isObject value
      obj[key] = fixJSONStringify value
    else if _.isArray value
      for v, i in value
        if _.isObject(v)
          obj[key][i] = fixJSONStringify v
        else if _.isDate v
          obj[key][i] = '=--JSON-DATE--=' + (+v)
  return obj

###
@locus Anywhere
@class FilesCollection
@param config           {Object}   - [Both]   Configuration object with next properties:
@param config.debug     {Boolean}  - [Both]   Turn on/of debugging and extra logging
@param config.schema    {Object}   - [Both]   Collection Schema
@param config.public    {Boolean}  - [Both]   Store files in folder accessible for proxy servers, for limits, and more - read docs
@param config.strict    {Boolean}  - [Server] Strict mode for partial content, if is `true` server will return `416` response code, when `range` is not specified, otherwise server return `206`
@param config.protected {Function} - [Both]   If `true` - files will be served only to authorized users, if `function()` - you're able to check visitor's permissions in your own way function's context has:
  - `request` - On server only
  - `response` - On server only
  - `user()`
  - `userId`
@param config.chunkSize      {Number}  - [Both] Upload chunk size, default: 524288 bytes (0,5 Mb)
@param config.permissions    {Number}  - [Server] Permissions which will be set to uploaded files (octal), like: `511` or `0o755`. Default: 0644
@param config.parentDirPermissions {Number}  - [Server] Permissions which will be set to parent directory of uploaded files (octal), like: `611` or `0o777`. Default: 0755
@param config.storagePath    {String|Function}  - [Server] Storage path on file system
@param config.cacheControl   {String}  - [Server] Default `Cache-Control` header
@param config.throttle       {Number}  - [Server] bps throttle threshold
@param config.downloadRoute  {String}  - [Both]   Server Route used to retrieve files
@param config.collection     {Mongo.Collection} - [Both] Mongo Collection Instance
@param config.collectionName {String}  - [Both]   Collection name
@param config.namingFunction {Function}- [Both]   Function which returns `String`
@param config.integrityCheck {Boolean} - [Server] Check file's integrity before serving to users
@param config.onAfterUpload  {Function}- [Server] Called right after file is ready on FS. Use to transfer file somewhere else, or do other thing with file directly
@param config.onAfterRemove  {Function} - [Server] Called right after file is removed. Removed objects is passed to callback
@param config.continueUploadTTL {Number} - [Server] Time in seconds, during upload may be continued, default 3 hours (10800 seconds)
@param config.onBeforeUpload {Function}- [Both]   Function which executes on server after receiving each chunk and on client right before beginning upload. Function context is `File` - so you are able to check for extension, mime-type, size and etc.
return `true` to continue
return `false` or `String` to abort upload
@param config.onBeforeRemove {Function} - [Server] Executes before removing file on server, so you can check permissions. Return `true` to allow action and `false` to deny.
@param config.allowClientCode  {Boolean}  - [Both]   Allow to run `remove` from client
@param config.downloadCallback {Function} - [Server] Callback triggered each time file is requested, return truthy value to continue download, or falsy to abort
@param config.interceptDownload {Function} - [Server] Intercept download request, so you can serve file from third-party resource, arguments {http: {request: {...}, response: {...}}, fileRef: {...}}
@param config.onbeforeunloadMessage {String|Function} - [Client] Message shown to user when closing browser's window or tab while upload process is running
@summary Create new instance of FilesCollection
###
class FilesCollection
  __proto__: do -> if Meteor.isServer then events.EventEmitter.prototype else EventEmitter.prototype
  constructor: (config) ->
    if Meteor.isServer
      events.EventEmitter.call @
    else
      EventEmitter.call @
    {storagePath, @collection, @collectionName, @downloadRoute, @schema, @chunkSize, @namingFunction, @debug, @onbeforeunloadMessage, @permissions, @parentDirPermissions, @allowClientCode, @onBeforeUpload, @integrityCheck, @protected, @public, @strict, @downloadCallback, @cacheControl, @throttle, @onAfterUpload, @onAfterRemove, @interceptDownload, @onBeforeRemove, @continueUploadTTL} = config if config

    self        = @
    cookie      = new Cookies()
    @debug     ?= false
    @public    ?= false
    @protected ?= false
    @chunkSize ?= 1024*512
    @chunkSize  = Math.floor(@chunkSize / 8) * 8

    if @public and not @downloadRoute
      throw new Meteor.Error 500, "[FilesCollection.#{@collectionName}]: \"downloadRoute\" must be precisely provided on \"public\" collections! Note: \"downloadRoute\" must be equal on be inside of your web/proxy-server (relative) root."

    @collection        ?= new Mongo.Collection @collectionName
    @collectionName    ?= @collection._name
    check @collectionName, String
    @downloadRoute     ?= '/cdn/storage'
    @downloadRoute      = @downloadRoute.replace /\/$/, ''
    @collectionName    ?= 'MeteorUploadFiles'
    @namingFunction    ?= false
    @onBeforeUpload    ?= false
    @allowClientCode   ?= true
    @interceptDownload ?= false

    if Meteor.isClient
      @onbeforeunloadMessage ?= 'Upload in a progress... Do you want to abort?'
      delete @strict
      delete @throttle
      delete @permissions
      delete @parentDirPermissions
      delete @cacheControl
      delete @onAfterUpload
      delete @onAfterRemove
      delete @onBeforeRemove
      delete @integrityCheck
      delete @downloadCallback
      delete @interceptDownload
      delete @continueUploadTTL

      if _.has(Package, 'accounts-base') and Accounts
        setTokenCookie = ->
          if (not cookie.has('meteor_login_token') and Accounts._lastLoginTokenWhenPolled) or (cookie.has('meteor_login_token') and (cookie.get('meteor_login_token') isnt Accounts._lastLoginTokenWhenPolled))
            cookie.set 'meteor_login_token', Accounts._lastLoginTokenWhenPolled, null, '/'
            cookie.send()

        unsetTokenCookie = ->
          if cookie.has 'meteor_login_token'
            cookie.remove 'meteor_login_token'
            cookie.send()

        Accounts.onLogin ->
          setTokenCookie()
          return
        Accounts.onLogout ->
          unsetTokenCookie()
          return

        if Accounts._lastLoginTokenWhenPolled
          setTokenCookie()
        else
          unsetTokenCookie()

      check @onbeforeunloadMessage, Match.OneOf String, Function
    else
      @strict            ?= true
      @throttle          ?= false
      @permissions       ?= parseInt('644', 8)
      @parentDirPermissions ?= parseInt('755', 8)
      @cacheControl      ?= 'public, max-age=31536000, s-maxage=31536000'
      @onAfterUpload     ?= false
      @onAfterRemove     ?= false
      @onBeforeRemove    ?= false
      @integrityCheck    ?= true
      @_currentUploads   ?= {}
      @downloadCallback  ?= false
      @continueUploadTTL ?= 10800

      if @public and not storagePath
        throw new Meteor.Error 500, "[FilesCollection.#{@collectionName}] \"storagePath\" must be set on \"public\" collections! Note: \"storagePath\" must be equal on be inside of your web/proxy-server (absolute) root."

      storagePath ?=  "assets/app/uploads/#{@collectionName}"
      Object.defineProperty self, 'storagePath', {
        get: ->
          sp = ''
          if _.isString storagePath
            sp = storagePath
          else if _.isFunction storagePath
            sp = storagePath.call self, "assets/app/uploads/#{self.collectionName}"
          
          unless _.isString sp
            throw new Meteor.Error 400, "[FilesCollection.#{self.collectionName}] \"storagePath\" function must return a String!"

          sp = sp.replace /\/$/, ''
          return nodePath.normalize sp
      }

      console.info('[FilesCollection.storagePath] Set to:', @storagePath) if @debug

      fs.mkdirs @storagePath, {mode: @parentDirPermissions}, (error) ->
        if error
          throw new Meteor.Error 401, "[FilesCollection.#{self.collectionName}] Path \"#{self.storagePath}\" is not writable!", error
        return

      check @strict, Boolean
      check @throttle, Match.OneOf false, Number
      check @permissions, Number
      check @storagePath, String
      check @cacheControl, String
      check @onAfterRemove, Match.OneOf false, Function
      check @onAfterUpload, Match.OneOf false, Function
      check @integrityCheck, Boolean
      check @onBeforeRemove, Match.OneOf false, Function
      check @downloadCallback, Match.OneOf false, Function
      check @interceptDownload, Match.OneOf false, Function
      check @continueUploadTTL, Number

      @_preCollection = new Mongo.Collection '__pre_' + @collectionName
      @_preCollection._ensureIndex {'createdAt': 1}, {expireAfterSeconds: @continueUploadTTL, background: true}
      _preCollectionCursor = @_preCollection.find {}
      _preCollectionCursor.observeChanges removed: (_id) ->
        # Free memory after upload is done
        # Or if upload is unfinished
        console.info "[FilesCollection] [_preCollectionCursor.observeChanges] [removed]: #{_id}" if self.debug
        if self._currentUploads?[_id]
          self._currentUploads[_id].end()
          delete self._currentUploads[_id]
        return

      @_createStream = (_id, path, opts) ->
        self._currentUploads[_id] = new writeStream path, opts.fileLength, opts
        return self._currentUploads[_id]

      # This little function allows to continue upload
      # even after server is restarted (*not on dev-stage*)
      @_continueUpload = (_id) ->
        if self._currentUploads?[_id]?.file
          unless self._currentUploads[_id].stream._writableState.ended
            return self._currentUploads[_id].file
          else
            self._createStream _id, self._currentUploads[_id].file.file.path, self._currentUploads[_id].file
            return self._currentUploads[_id].file
        else
          contUpld = self._preCollection.findOne {_id}
          if contUpld
            self._createStream _id, contUpld.file.path, contUpld.file
          return contUpld

    if not @schema
      @schema =
        size: type: Number
        name: type: String
        type: type: String
        path: type: String
        isVideo: type: Boolean
        isAudio: type: Boolean
        isImage: type: Boolean
        isText: type: Boolean
        isJSON: type: Boolean
        isPDF: type: Boolean
        extension:
          type: String
          optional: true
        _storagePath: type: String
        _downloadRoute: type: String
        _collectionName: type: String
        public:
          type: Boolean
          optional: true
        meta:
          type: Object
          blackbox: true
          optional: true
        userId:
          type: String
          optional: true
        updatedAt: 
          type: Date
          optional: true
        versions:
          type: Object
          blackbox: true

    check @debug, Boolean
    check @schema, Object
    check @public, Boolean
    check @protected, Match.OneOf Boolean, Function
    check @chunkSize, Number
    check @downloadRoute, String
    check @namingFunction, Match.OneOf false, Function
    check @onBeforeUpload, Match.OneOf false, Function
    check @allowClientCode, Boolean

    if @public and @protected
      throw new Meteor.Error 500, "[FilesCollection.#{@collectionName}]: Files can not be public and protected at the same time!"

    @_checkAccess = (http) ->
      if self.protected
        user = false
        userFuncs = self._getUser http
        {user, userId} = userFuncs
        user = user()

        if _.isFunction self.protected
          if http?.params?._id
            fileRef = self.collection.findOne http.params._id

          result = if http then self.protected.call(_.extend(http, userFuncs), (fileRef or null)) else self.protected.call userFuncs, (fileRef or null)
        else
          result = !!user

        if (http and result is true) or not http
          return true
        else
          rc = if _.isNumber(result) then result else 401
          console.warn '[FilesCollection._checkAccess] WARN: Access denied!' if self.debug
          if http
            text = 'Access denied!'
            http.response.writeHead rc,
              'Content-Length': text.length
              'Content-Type':   'text/plain'
            http.response.end text
          return false
      else
        return true

    @_methodNames =
      _Abort:  "_FilesCollectionAbort_#{@collectionName}"
      _Write:  "_FilesCollectionWrite_#{@collectionName}"
      _Start:  "_FilesCollectionStart_#{@collectionName}"
      _Remove: "_FilesCollectionRemove_#{@collectionName}"

    if Meteor.isServer
      @on '_handleUpload', @_handleUpload
      @on '_finishUpload', @_finishUpload

      WebApp.connectHandlers.use (request, response, next) ->
        if !!~request._parsedUrl.path.indexOf "#{self.downloadRoute}/#{self.collectionName}/__upload"
          if request.method is 'POST'

            body        = ''
            handleError = (error) ->
              console.warn "[FilesCollection] [Upload] [HTTP] Exception:", e
              response.writeHead 500
              response.end JSON.stringify {error}
              return

            request.on 'data', (data) -> bound ->
              body += data
              return

            request.on 'end', -> bound ->
              try
                opts            = JSON.parse body
                user            = self._getUser {request, response}
                _continueUpload = self._continueUpload opts.fileId
                unless _continueUpload
                  throw new Meteor.Error 408, 'Can\'t continue upload, session expired. Start upload again.'

                {result, opts}  = self._prepareUpload _.extend(opts, _continueUpload), user.userId, 'HTTP'

                if opts.eof
                  Meteor.wrapAsync(self._handleUpload.bind(self, result, opts))()
                  response.writeHead 200
                  result.file.meta = fixJSONStringify result.file.meta if result?.file?.meta
                  response.end JSON.stringify result
                else
                  self.emit '_handleUpload', result, opts, NOOP

                response.writeHead 200
                response.end JSON.stringify {success: true}
              catch error
                handleError error
              return
          else
            next()
          return

        unless self.public
          if !!~request._parsedUrl.path.indexOf "#{self.downloadRoute}/#{self.collectionName}"
            uri = request._parsedUrl.path.replace "#{self.downloadRoute}/#{self.collectionName}", ''
            if uri.indexOf('/') is 0
              uri = uri.substring 1

            uris = uri.split '/'
            if uris.length is 3
              params = 
                query: if request._parsedUrl.query then JSON.parse('{"' + decodeURI(request._parsedUrl.query).replace(/"/g, '\\"').replace(/&/g, '","').replace(/=/g,'":"') + '"}') else {}
                _id: uris[0]
                version: uris[1]
                name: uris[2]
              http = {request, response, params}
              self.download http, uris[1], self.collection.findOne(uris[0]) if self._checkAccess http
            else
              next()
          else
            next()
        else
          if !!~request._parsedUrl.path.indexOf "#{self.downloadRoute}"
            uri = request._parsedUrl.path.replace "#{self.downloadRoute}", ''
            if uri.indexOf('/') is 0
              uri = uri.substring 1

            uris  = uri.split '/'
            _file = uris[uris.length - 1]
            if _file
              if !!~_file.indexOf '-'
                version = _file.split('-')[0]
                _file   = _file.split('-')[1].split('?')[0]
              else
                version = 'original'
                _file   = _file.split('?')[0]

              params = 
                query: if request._parsedUrl.query then JSON.parse('{"' + decodeURI(request._parsedUrl.query).replace(/"/g, '\\"').replace(/&/g, '","').replace(/=/g,'":"') + '"}') else {}
                file: _file
                _id: _file.split('.')[0]
                version: version
                name: _file
              http = {request, response, params}
              self.download http, version, self.collection.findOne params._id
            else
              next()
          else
            next()
        return

      _methods = {}


      # Method used to remove file
      # from Client side
      _methods[self._methodNames._Remove] = (selector) ->
        check selector, Match.OneOf String, Object
        console.info "[FilesCollection] [Unlink Method] [.remove(#{selector})]" if self.debug
        
        if self.allowClientCode
          if self.onBeforeRemove and _.isFunction self.onBeforeRemove
            user = false
            userFuncs = {
              userId: @userId
              user: -> if Meteor.users then Meteor.users.findOne(@userId) else null
            }

            unless self.onBeforeRemove.call userFuncs, (self.find(selector) or null)
              throw new Meteor.Error 403, '[FilesCollection] [remove] Not permitted!'

          self.remove selector
          return true
        else
          throw new Meteor.Error 401, '[FilesCollection] [remove] Run code from client is not allowed!'
        return


      # Method used to receive "first byte" of upload
      # and all file's meta-data, so 
      # it won't be transferred with every chunk
      # Basically it prepares everything
      # So user can pause/disconnect and
      # continue upload later, during `continueUploadTTL`
      _methods[self._methodNames._Start] = (opts) ->
        check opts, {
          file:       Object
          fileId:     String
          FSName:     Match.Optional String
          chunkSize:  Number
          fileLength: Number
        }

        console.info "[FilesCollection] [File Start Method] #{opts.file.name} - #{opts.fileId}" if self.debug
        {result}       = self._prepareUpload _.clone(opts), @userId, 'Start Method'
        opts._id       = opts.fileId
        opts.createdAt = new Date()
        self._preCollection.insert opts
        self._createStream result._id, result.path, opts
        return true


      # Method used to write file chunks
      # it receives very limited amount of meta-data
      # This method also responsible for EOF
      _methods[self._methodNames._Write] = (opts) ->
        check opts, {
          eof:     Match.Optional Boolean
          fileId:  String
          binData: Match.Optional String
          chunkId: Match.Optional Number
        }

        _continueUpload = self._continueUpload opts.fileId
        unless _continueUpload
          throw new Meteor.Error 408, 'Can\'t continue upload, session expired. Start upload again.'

        @unblock()
        {result, opts} = self._prepareUpload _.extend(opts, _continueUpload), @userId, 'DDP'

        if opts.eof
          try
            return Meteor.wrapAsync(self._handleUpload.bind(self, result, opts))()
          catch e
            console.warn "[FilesCollection] [Write Method] [DDP] Exception:", e if self.debug
            throw e
        else
          self.emit '_handleUpload', result, opts, NOOP
        return true

      # Method used to Abort upload
      # - Feeing memory by .end()ing writableStreams
      # - Removing temporary record from @_preCollection
      # - Removing record from @collection
      # - .unlink()ing chunks from FS
      _methods[self._methodNames._Abort] = (_id) ->
        check _id, String

        _continueUpload = self._continueUpload _id
        console.info "[FilesCollection] [Abort Method]: #{_id} - #{_continueUpload?.file?.path}" if self.debug
        if _continueUpload
          self._preCollection.remove {_id}
          self.remove {_id}
          self.unlink {_id, path: _continueUpload.file.path}
        return true

      Meteor.methods _methods

  ###
  @locus Server
  @memberOf FilesCollection
  @name _prepareUpload
  @summary Internal method. Used to optimize received data and check upload permission
  @returns {Object}
  ###
  _prepareUpload: if Meteor.isServer then (opts, userId, transport) ->
    opts.eof       ?= false
    opts.binData   ?= 'EOF'
    opts.chunkId   ?= -1
    opts.FSName    ?= opts.fileId
    opts.file.meta ?= {}

    console.info "[FilesCollection] [Upload] [#{transport}] Got ##{opts.chunkId}/#{opts.fileLength} chunks, dst: #{opts.file.name or opts.file.fileName}" if @debug

    fileName = @_getFileName opts.file
    {extension, extensionWithDot} = @_getExt fileName

    result           = opts.file
    result.path      = "#{@storagePath}/#{opts.FSName}#{extensionWithDot}"
    result.name      = fileName
    result.meta      = opts.file.meta
    result.extension = extension
    result.ext       = extension
    result           = @_dataToSchema result
    result._id       = opts.fileId
    result.userId    = userId if userId

    if @onBeforeUpload and _.isFunction @onBeforeUpload
      isUploadAllowed = @onBeforeUpload.call(_.extend({
        file: opts.file
      }, {
        chunkId: opts.chunkId
        userId:  result.userId
        user:    -> if Meteor.users then Meteor.users.findOne(result.userId) else null
        eof:     opts.eof
      }), result)

      if isUploadAllowed isnt true
        throw new Meteor.Error(403, if _.isString(isUploadAllowed) then isUploadAllowed else '@onBeforeUpload() returned false')

    return {result, opts}
  else undefined

  ###
  @locus Server
  @memberOf FilesCollection
  @name _finishUpload
  @summary Internal method. Finish upload, close Writable stream, add recored to MongoDB and flush used memory
  @returns {undefined}
  ###
  _finishUpload: if Meteor.isServer then (result, opts, cb) ->
    console.info "[FilesCollection] [Upload] [finish(ing)Upload] -> #{result.path}" if @debug
    fs.chmod result.path, @permissions, NOOP
    self          = @
    result.type   = @_getMimeType opts.file
    result.public = @public

    @collection.insert _.clone(result), (error, _id) ->
      if error
        cb and cb error
        console.error '[FilesCollection] [Upload] [_finishUpload] Error:', error if self.debug
      else
        self._preCollection.remove {_id: opts.fileId}, (error) ->
          if error
            cb and cb error
            console.error '[FilesCollection] [Upload] [_finishUpload] Error:', error if self.debug
          else
            result._id = _id
            console.info "[FilesCollection] [Upload] [finish(ed)Upload] -> #{result.path}" if self.debug
            self.onAfterUpload and self.onAfterUpload.call self, result
            self.emit 'afterUpload', result
            cb and cb null, result
          return
      return
    return
  else undefined

  ###
  @locus Server
  @memberOf FilesCollection
  @name _handleUpload
  @summary Internal method to handle upload process, pipe incoming data to Writable stream
  @returns {undefined}
  ###
  _handleUpload: if Meteor.isServer then (result, opts, cb) ->
    self = @

    try
      if opts.eof
        @_currentUploads[result._id].end -> bound ->
          self.emit '_finishUpload', result, opts, cb
          return
      else
        @_currentUploads[result._id].write opts.chunkId, new Buffer(opts.binData, 'base64'), cb
    catch e
      cb and cb e
    return
  else undefined

  ###
  @locus Anywhere
  @memberOf FilesCollection
  @name _getMimeType
  @param {Object} fileData - File Object
  @summary Returns file's mime-type
  @returns {String}
  ###
  _getMimeType: (fileData) ->
    check fileData, Object
    mime = fileData.type if fileData?.type
    if Meteor.isServer and fileData.path and (not mime or not _.isString mime)
      try
        buf = new Buffer 262
        fd  = fs.openSync fileData.path, 'r'
        br  = fs.readSync fd, buf, 0, 262, 0
        fs.close fd, NOOP
        buf = buf.slice 0, br if br < 262
        {mime, ext} = fileType buf
      catch error
    if not mime or not _.isString mime
      mime = 'application/octet-stream' 
    return mime

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
      cleanName = (str) -> str.replace(/\.\./g, '').replace /\//g, ''
      return cleanName(fileData.name or fileData.fileName)
    else
      return ''

  ###
  @locus Anywhere
  @memberOf FilesCollection
  @name _getUser
  @summary Returns object with `userId` and `user()` method which return user's object
  @returns {Object}
  ###
  _getUser: (http) ->
    result = 
      user: -> return null
      userId: null
      
    if Meteor.isServer
      if http
        cookie = http.request.Cookies
        if _.has(Package, 'accounts-base') and Accounts and cookie.has 'meteor_login_token'
          user = Meteor.users.findOne 'services.resume.loginTokens.hashedToken': Accounts._hashLoginToken cookie.get 'meteor_login_token'
          if user
            result.user = () -> return user
            result.userId = user._id
    else
      if _.has(Package, 'accounts-base') and Accounts and Meteor.userId()
        result.user = -> return Meteor.user()
        result.userId = Meteor.userId()

    return result

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
      extension = fileName.split('.').pop()
      return { ext: extension, extension, extensionWithDot: '.' + extension }
    else
      return { ext: '', extension: '', extensionWithDot: '' }

  ###
  @locus Anywhere
  @memberOf FilesCollection
  @name _dataToSchema
  @param {Object} data - File data
  @summary Internal method. Build object in accordance with default schema from File data
  @returns {Object}
  ###
  _dataToSchema: (data) ->
    return {
      name:       data.name
      extension:  data.extension
      path:       data.path
      meta:       data.meta
      type:       data.type
      size:       data.size
      versions:
        original:
          path: data.path
          size: data.size
          type: data.type
          extension: data.extension
      isVideo: !!~data.type.toLowerCase().indexOf('video')
      isAudio: !!~data.type.toLowerCase().indexOf('audio')
      isImage: !!~data.type.toLowerCase().indexOf('image')
      isText:  !!~data.type.toLowerCase().indexOf('text')
      isJSON:  !!~data.type.toLowerCase().indexOf('json')
      isPDF:   !!~data.type.toLowerCase().indexOf('pdf')
      _storagePath:    data._storagePath or @storagePath
      _downloadRoute:  data._downloadRoute or @downloadRoute
      _collectionName: data._collectionName or @collectionName
    }

  ###
  @locus Server
  @memberOf FilesCollection
  @name write
  @param {Buffer} buffer - Binary File's Buffer
  @param {Object} opts - Object with file-data
  @param {String} opts.name - File name, alias: `fileName`
  @param {String} opts.type - File mime-type
  @param {Object} opts.meta - File additional meta-data
  @param {Function} callback - function(error, fileObj){...}
  @summary Write buffer to FS and add to FilesCollection Collection
  @returns {FilesCollection} Instance
  ###
  write: if Meteor.isServer then (buffer, opts = {}, callback) ->
    console.info '[FilesCollection] [write()]' if @debug

    if _.isFunction opts
      callback = opts
      opts     = {}

    check opts, Match.Optional Object
    check callback, Match.Optional Function

    fileId   = Random.id()
    FSName   = if @namingFunction then @namingFunction() else fileId
    fileName = if (opts.name or opts.fileName) then (opts.name or opts.fileName) else FSName

    {extension, extensionWithDot} = @_getExt fileName

    self       = @
    opts      ?= {}
    opts.path  = "#{@storagePath}/#{FSName}#{extensionWithDot}"
    opts.type  = @_getMimeType opts
    opts.meta ?= {}
    opts.size ?= buffer.length

    result = @_dataToSchema
      name:      fileName
      path:      opts.path
      meta:      opts.meta
      type:      opts.type
      size:      opts.size
      extension: extension

    result._id = fileId

    stream = fs.createWriteStream opts.path, {flags: 'w', mode: @permissions}
    stream.end buffer, (error) -> bound ->
      if error
        callback and callback error
      else
        self.collection.insert _.clone(result), (error) ->
          if error
            callback and callback error
            console.warn "[FilesCollection] [write] [insert] Error: #{fileName} -> #{self.collectionName}", error if self.debug
          else
            callback and callback null, result
            console.info "[FilesCollection] [write]: #{fileName} -> #{self.collectionName}" if self.debug
    return @
  else
    undefined

  ###
  @locus Server
  @memberOf FilesCollection
  @name load
  @param {String} url - URL to file
  @param {Object} opts - Object with file-data
  @param {String} opts.name - File name, alias: `fileName`
  @param {String} opts.type - File mime-type
  @param {Object} opts.meta - File additional meta-data
  @param {Function} callback - function(error, fileObj){...}
  @summary Download file, write stream to FS and add to FilesCollection Collection
  @returns {FilesCollection} Instance
  ###
  load: if Meteor.isServer then (url, opts, callback) ->
    console.info "[FilesCollection] [load(#{url}, #{JSON.stringify(opts)}, callback)]" if @debug

    if _.isFunction opts
      callback = opts
      opts     = {}

    check url, String
    check opts, Match.Optional Object
    check callback, Match.Optional Function

    self      = @
    opts     ?= {}
    fileId    = Random.id()
    FSName    = if @namingFunction then @namingFunction() else fileId
    pathParts = url.split('/')
    fileName  = if (opts.name or opts.fileName) then (opts.name or opts.fileName) else pathParts[pathParts.length - 1] or FSName
    
    {extension, extensionWithDot} = @_getExt fileName
    opts.meta ?= {}
    opts.path  = "#{@storagePath}/#{FSName}#{extensionWithDot}"

    storeResult = (result, callback) ->
      result._id = fileId

      self.collection.insert result, (error) ->
        if error
          callback and callback error
          console.error "[FilesCollection] [load] [insert] Error: #{fileName} -> #{self.collectionName}", error if self.debug
        else
          callback and callback null, result
          console.info "[FilesCollection] [load] [insert] #{fileName} -> #{self.collectionName}" if self.debug
        return
      return

    request.get(url).on('error', (error)-> bound ->
      callback and callback error
      console.error "[FilesCollection] [load] [request.get(#{url})] Error:", error if self.debug
    ).on('response', (response) -> bound ->
      response.on 'end', -> bound ->
        console.info "[FilesCollection] [load] Received: #{url}" if self.debug
        result = self._dataToSchema
          name:      fileName
          path:      opts.path
          meta:      opts.meta
          type:      opts.type or response.headers['content-type'] or self._getMimeType {path: opts.path}
          size:      opts.size or parseInt(response.headers['content-length'] or 0)
          extension: extension

        unless result.size
          fs.stat opts.path, (error, stats) -> bound ->
            if error
              callback and callback error
            else
              result.versions.original.size = result.size = stats.size
              storeResult result, callback
            return
        else
          storeResult result, callback
        return
      return

    ).pipe fs.createWriteStream(opts.path, {flags: 'w', mode: @permissions})

    return @
  else
    undefined

  ###
  @locus Server
  @memberOf FilesCollection
  @name addFile
  @param {String} path - Path to file
  @param {String} opts - Object with file-data
  @param {String} opts.type - File mime-type
  @param {Object} opts.meta - File additional meta-data
  @param {Function} callback - function(error, fileObj){...}
  @summary Add file from FS to FilesCollection
  @returns {FilesCollection} Instance
  ###
  addFile: if Meteor.isServer then (path, opts, callback) ->
    console.info "[FilesCollection] [addFile(#{path})]" if @debug

    if _.isFunction opts
      callback = opts
      opts     = {}

    throw new Meteor.Error 403, 'Can not run [addFile] on public collection! Just Move file to root of your server, then add record to Collection' if @public
    check path, String
    check opts, Match.Optional Object
    check callback, Match.Optional Function

    self = @
    fs.stat path, (error, stats) -> bound ->
      if error
        callback and callback error
      else if stats.isFile()
        pathParts = path.split '/'
        fileName  = pathParts[pathParts.length - 1]

        {extension, extensionWithDot} = self._getExt fileName

        opts      ?= {}
        opts.path  = path
        opts.type ?= self._getMimeType opts
        opts.meta ?= {}
        opts.size ?= stats.size

        result = self._dataToSchema
          name:         fileName
          path:         path
          meta:         opts.meta
          type:         opts.type
          size:         opts.size
          extension:    extension
          _storagePath: path.replace "/#{fileName}", ''

        result._id = Random.id()

        self.collection.insert _.clone(result), (error) ->
          if error
            callback and callback error
            console.warn "[FilesCollection] [addFile] [insert] Error: #{fileName} -> #{self.collectionName}", error if self.debug
          else
            callback and callback null, result
            console.info "[FilesCollection] [addFile]: #{fileName} -> #{self.collectionName}" if self.debug
      else
        callback and callback new Meteor.Error 400, "[FilesCollection] [addFile(#{path})]: File does not exist"

    return @
  else
    undefined

  ###
  @locus Anywhere
  @memberOf FilesCollection
  @name findOne
  @param {String|Object} selector - Mongo-Style selector (http://docs.meteor.com/api/collections.html#selectors)
  @param {Object} options - Mongo-Style selector Options (http://docs.meteor.com/api/collections.html#sortspecifiers)
  @summary Find and return Cursor for matching document Object
  @returns {FileCursor} Instance
  ###
  findOne: (selector = {}, options) ->
    console.info "[FilesCollection] [findOne(#{JSON.stringify(selector)})]" if @debug
    check selector, Match.OneOf Object, String
    check options, Match.Optional Object
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
  find: (selector = {}, options) ->
    console.info "[FilesCollection] [find(#{JSON.stringify(selector)}, #{JSON.stringify(options)})]" if @debug
    check selector, Match.OneOf Object, String
    check options, Match.Optional Object
    return new FilesCursor selector, options, @

  ###
  @locus Client
  @memberOf FilesCollection
  @name insert
  @see https://developer.mozilla.org/en-US/docs/Web/API/FileReader
  @param {Object} config - Configuration object with next properties:
    {File|Object} file           - HTML5 `files` item, like in change event: `e.currentTarget.files[0]`
    {Object}      meta           - Additional data as object, use later for search
    {Boolean}     allowWebWorkers- Allow/Deny WebWorkers usage
    {Number|dynamic} streams     - Quantity of parallel upload streams, default: 2
    {Number|dynamic} chunkSize   - Chunk size for upload
    {String}      transport      - Upload transport `http` or `ddp`
    {Function}    onUploaded     - Callback triggered when upload is finished, with two arguments `error` and `fileRef`
    {Function}    onStart        - Callback triggered when upload is started after all successful validations, with two arguments `error` (always null) and `fileRef`
    {Function}    onError        - Callback triggered on error in upload and/or FileReader, with two arguments `error` and `fileData`
    {Function}    onProgress     - Callback triggered when chunk is sent, with only argument `progress`
    {Function}    onBeforeUpload - Callback triggered right before upload is started:
        return true to continue
        return false to abort upload
  @param {Boolean} autoStart     - Start upload immediately. If set to false, you need manually call .start() method on returned class. Useful to set EventListeners.
  @summary Upload file to server over DDP
  @returns {UploadInstance} Instance. UploadInstance has next properties:
    {ReactiveVar} onPause  - Is upload process on the pause?
    {ReactiveVar} state    - active|paused|aborted|completed
    {ReactiveVar} progress - Current progress in percentage
    {Function}    pause    - Pause upload process
    {Function}    continue - Continue paused upload process
    {Function}    toggle   - Toggle continue/pause if upload process
    {Function}    abort    - Abort upload
    {Function}    readAsDataURL - Current file as data URL, use to create image preview and etc. Be aware of big files, may lead to browser crash
  ###
  insert: if Meteor.isClient then (config, autoStart = true) ->
    mName = if autoStart then 'start' else 'manual'
    return (new @_UploadInstance(config, @))[mName]()
  else undefined

  ###
  @locus Client
  @memberOf FilesCollection
  @name _UploadInstance
  @class UploadInstance
  @summary Internal Class, used in upload
  ###
  _UploadInstance: if Meteor.isClient then class UploadInstance
    __proto__: EventEmitter.prototype
    constructor: (@config, @collection) ->
      EventEmitter.call @
      console.info '[FilesCollection] [insert()]' if @collection.debug
      self                     = @
      @config.meta            ?= {}
      @config.streams         ?= 2
      @config.streams          = 2 if @config.streams < 1
      @config.transport       ?= 'ddp'
      @config.chunkSize       ?= @collection.chunkSize
      @config.allowWebWorkers ?= true
      @config.transport        = @config.transport.toLowerCase()

      check @config, {
        file:            Match.Any
        fileName:        Match.Optional String
        meta:            Match.Optional Object
        onError:         Match.Optional Function
        onAbort:         Match.Optional Function
        streams:         Match.OneOf 'dynamic', Number
        onStart:         Match.Optional Function
        transport:       Match.OneOf 'http', 'ddp'
        chunkSize:       Match.OneOf 'dynamic', Number
        onUploaded:      Match.Optional Function
        onProgress:      Match.Optional Function
        onBeforeUpload:  Match.Optional Function
        allowWebWorkers: Boolean
      }

      if @config.file
        if @collection.debug
          console.time('insert ' + @config.file.name)
          console.time('loadFile ' + @config.file.name)

        if Worker and @config.allowWebWorkers
          @worker = new Worker '/packages/ostrio_files/worker.js'
        else
          @worker = null

        @config.debug = @collection.debug
        @currentChunk = 0
        @transferTime = 0
        @trackerComp  = null
        @sentChunks   = 0
        @fileLength   = 1
        @EOFsent      = false
        @FSName       = if @collection.namingFunction then @collection.namingFunction(@config.file) else @fileId
        @fileId       = Random.id()
        @pipes        = []
        @fileData     =
          size: @config.file.size
          type: @config.file.type
          name: @config.fileName or @config.file.name
          meta: @config.meta

        @fileData = _.extend @fileData, @collection._getExt(self.config.file.name), {mime: @collection._getMimeType(@fileData)}
        @fileData['mime-type'] = @fileData.mime

        @result = new @collection._FileUpload _.extend self.config, {@fileData, @fileId, _Abort: @collection._methodNames._Abort}

        @beforeunload = (e) ->
          message = if _.isFunction(self.collection.onbeforeunloadMessage) then self.collection.onbeforeunloadMessage.call(self.result, self.fileData) else self.collection.onbeforeunloadMessage
          e.returnValue = message if e
          return message
        @result.config.beforeunload = @beforeunload
        window.addEventListener 'beforeunload', @beforeunload, false

        @result.config._onEnd = -> self.emitEvent '_onEnd'

        @addListener 'end', @end
        @addListener 'start', @start
        @addListener 'upload', @upload
        @addListener 'sendEOF', @sendEOF
        @addListener 'prepare', @prepare
        @addListener 'sendChunk', @sendChunk
        @addListener 'proceedChunk', @proceedChunk
        @addListener 'createStreams', @createStreams

        @addListener 'calculateStats', _.throttle ->
          _t = (self.transferTime / self.sentChunks) / self.config.streams
          self.result.estimateTime.set (_t * (self.fileLength - self.sentChunks))
          self.result.estimateSpeed.set (self.config.chunkSize / (_t / 1000))
          progress = Math.round((self.sentChunks / self.fileLength) * 100)
          self.result.progress.set progress
          self.config.onProgress and self.config.onProgress.call self.result, progress, self.fileData
          self.result.emitEvent 'progress', [progress, self.fileData]
          return
        , 250

        @addListener '_onEnd', ->
          Meteor.clearInterval(self.result.estimateTimer) if self.result.estimateTimer
          self.worker.terminate() if self.worker
          self.trackerComp.stop() if self.trackerComp
          window.removeEventListener('beforeunload', self.beforeunload, false) if self.beforeunload
          self.result.progress.set(0) if self.result
      else
        throw new Meteor.Error 500, '[FilesCollection] [insert] Have you forget to pass a File itself?'

    end: (error, data) ->
      console.timeEnd('insert ' + @config.file.name) if @collection.debug
      @emitEvent '_onEnd'
      @result.emitEvent 'uploaded', [error, data]
      @config.onUploaded and @config.onUploaded.call @result, error, data
      if error
        console.error '[FilesCollection] [insert] [end] Error:', error if @collection.debug
        @result.abort()
        @result.state.set 'aborted'
        @result.emitEvent 'error', [error, @fileData]
        @config.onError and @config.onError.call @result, error, @fileData
      else
        @result.state.set 'completed'
        @collection.emitEvent 'afterUpload', [data]
      @result.emitEvent 'end', [error, (data or @fileData)]
      return @result

    sendChunk: (evt) ->
      self = @
      opts =
        fileId:     @fileId
        binData:    evt.data.bin
        chunkId:    evt.data.chunkId

      @emitEvent 'data', [evt.data.bin]
      if @pipes.length
        for pipeFunc in @pipes
          opts.binData = pipeFunc opts.binData

      if @fileLength is evt.data.chunkId
        console.timeEnd('loadFile ' + @config.file.name) if @collection.debug
        @emitEvent 'readEnd'

      if opts.binData and opts.binData.length
        if @config.transport is 'ddp'
          Meteor.call @collection._methodNames._Write, opts, (error) ->
            self.transferTime += (+new Date) - evt.data.start
            if error
              if self.result.state.get() isnt 'aborted'
                self.emitEvent 'end', [error]
            else
              ++self.sentChunks
              if self.sentChunks >= self.fileLength
                self.emitEvent 'sendEOF', [opts]
              else if self.currentChunk < self.fileLength
                self.emitEvent 'upload'
              self.emitEvent 'calculateStats'
            return
        else
          opts.file.meta = fixJSONStringify opts.file.meta if opts?.file?.meta
          HTTP.call 'POST', "#{@collection.downloadRoute}/#{@collection.collectionName}/__upload", {data: opts}, (error, result) ->
            self.transferTime += (+new Date) - evt.data.start
            if error
              if "#{error}" is "Error: network"
                self.result.pause()
              else
                if self.result.state.get() isnt 'aborted'
                  self.emitEvent 'end', [error]
            else
              ++self.sentChunks
              if self.sentChunks >= self.fileLength
                self.emitEvent 'sendEOF', [opts]
              else if self.currentChunk < self.fileLength
                self.emitEvent 'upload'
              self.emitEvent 'calculateStats'
            return
      return

    sendEOF: (opts) ->
      unless @EOFsent
        @EOFsent = true
        self = @
        opts =
          eof:    true
          fileId: @fileId

        if @config.transport is 'ddp'
          Meteor.call @collection._methodNames._Write, opts, ->
            self.emitEvent 'end', arguments
            return
        else
          HTTP.call 'POST', "#{@collection.downloadRoute}/#{@collection.collectionName}/__upload", {data: opts}, (error, result) ->
            res      = JSON.parse result?.content or {}
            res.meta = fixJSONParse res.meta if res?.meta
            self.emitEvent 'end', [error, res]
            return
      return

    proceedChunk: (chunkId, start) ->
      self       = @
      chunk      = @config.file.slice (@config.chunkSize * (chunkId - 1)), (@config.chunkSize * chunkId)
      fileReader = new FileReader

      fileReader.onloadend = (evt) ->
        self.emitEvent 'sendChunk', [{
          data: {
            bin: (fileReader?.result or evt.srcElement?.result or evt.target?.result).split(',')[1]
            chunkId: chunkId
            start: start
          }
        }]
        return

      fileReader.onerror = (e) ->
        self.emitEvent 'end', [(e.target or e.srcElement).error]
        return

      fileReader.readAsDataURL chunk
      return

    upload: -> 
      start = +new Date
      if @result.onPause.get()
        return

      if @result.state.get() is 'aborted'
        return @

      if @currentChunk <= @fileLength
        ++@currentChunk
        if @worker
          @worker.postMessage({@sentChunks, start, @currentChunk, chunkSize: @config.chunkSize, file: @config.file})
        else
          @emitEvent 'proceedChunk', [@currentChunk, start]
      return

    createStreams: ->
      i    = 1
      self = @
      while i <= @config.streams
        self.emitEvent 'upload'
        i++
      return

    prepare: ->
      self = @

      @config.onStart and @config.onStart.call @result, null, @fileData
      @result.emitEvent 'start', [null, @fileData]

      if @config.chunkSize is 'dynamic'
        @config.chunkSize = @config.file.size / 1000
        if @config.chunkSize < 327680
          @config.chunkSize = 327680
        else if @config.chunkSize > 1048576
          @config.chunkSize = 1048576

        if @config.transport is 'http'
          @config.chunkSize = Math.round @config.chunkSize / 2

      @config.chunkSize = Math.floor(@config.chunkSize / 8) * 8
      _len = Math.ceil(@config.file.size / @config.chunkSize)
      if @config.streams is 'dynamic'
        @config.streams = _.clone _len
        @config.streams = 24 if @config.streams > 24

        if @config.transport is 'http'
          @config.streams = Math.round @config.streams / 2

      @fileLength               = if _len <= 0 then 1 else _len
      @config.streams           = @fileLength if @config.streams > @fileLength
      @result.config.fileLength = @fileLength

      opts =
        file:       @fileData
        fileId:     @fileId
        chunkSize:  @config.chunkSize
        fileLength: @fileLength
      opts.FSName = @FSName if @FSName isnt @fileId

      Meteor.call @collection._methodNames._Start, opts, (error) ->
        if error
          console.error '[FilesCollection] [.call(_Start)] Error:', error if self.collection.debug
          self.emitEvent 'end', [error]
        else
          self.result.continueFunc = ->
            console.info '[FilesCollection] [insert] [continueFunc]' if self.collection.debug
            self.emitEvent 'createStreams'
            return
          self.emitEvent 'createStreams'
        return
      return

    pipe: (func) -> 
      @pipes.push func
      return @

    start: ->
      self = @
      if @config.file.size <= 0
        @end new Meteor.Error 400, 'Can\'t upload empty file'
        return @result

      if @config.onBeforeUpload and _.isFunction @config.onBeforeUpload
        isUploadAllowed = @config.onBeforeUpload.call _.extend(@result, @collection._getUser()), @fileData
        if isUploadAllowed isnt true
          return @end new Meteor.Error(403, if _.isString(isUploadAllowed) then isUploadAllowed else 'config.onBeforeUpload() returned false')

      if @collection.onBeforeUpload and _.isFunction @collection.onBeforeUpload
        isUploadAllowed = @collection.onBeforeUpload.call _.extend(@result, @collection._getUser()), @fileData
        if isUploadAllowed isnt true
          return @end new Meteor.Error(403, if _.isString(isUploadAllowed) then isUploadAllowed else 'collection.onBeforeUpload() returned false')

      Tracker.autorun (computation) ->
        self.trackerComp = computation
        unless self.result.onPause.get()
          if Meteor.status().connected
            console.info '[FilesCollection] [insert] [Tracker] [continue]' if self.collection.debug
            self.result.continue()
          else
            console.info '[FilesCollection] [insert] [Tracker] [pause]' if self.collection.debug
            self.result.pause()
        return

      if @worker
        @worker.onmessage = (evt) ->
          if evt.data.error
            console.warn evt.data.error if self.collection.debug
            self.emitEvent 'proceedChunk', [evt.data.chunkId, evt.data.start]
          else
            self.emitEvent 'sendChunk', [evt]
          return
        @worker.onerror   = (e) -> 
          self.emitEvent 'end', [e.message]
          return

      if @collection.debug
        if @worker
          console.info '[FilesCollection] [insert] using WebWorkers'
        else
          console.info '[FilesCollection] [insert] using MainThread'

      self.emitEvent 'prepare'
      return @result

    manual: -> 
      self = @
      @result.start = ->
        self.emitEvent 'start'
        return
      @result.pipe = (func) ->
        self.pipe func
        return @
      return @result
  else undefined

  ###
  @locus Client
  @memberOf FilesCollection
  @name _FileUpload
  @class FileUpload
  @summary Internal Class, instance of this class is returned from `insert()` method
  ###
  _FileUpload: if Meteor.isClient then class FileUpload
    __proto__: EventEmitter.prototype
    constructor: (@config) ->
      EventEmitter.call @
      self           = @
      @file          = _.extend @config.file, @config.fileData
      @state         = new ReactiveVar 'active'
      @onPause       = new ReactiveVar false
      @progress      = new ReactiveVar 0
      @estimateTime  = new ReactiveVar 1000
      @estimateSpeed = new ReactiveVar 0
      @estimateTimer = Meteor.setInterval ->
        if self.state.get() is 'active'
          _currentTime = self.estimateTime.get()
          if _currentTime > 1000
            self.estimateTime.set _currentTime - 1000
        return
      , 1000
    continueFunc:  -> return
    pause: ->
      console.info '[FilesCollection] [insert] [.pause()]' if @config.debug
      unless @onPause.get()
        @onPause.set true
        @state.set 'paused'
        @emitEvent 'pause', [@file]
      return
    continue: ->
      console.info '[FilesCollection] [insert] [.continue()]' if @config.debug
      if @onPause.get()
        @onPause.set false
        @state.set 'active'
        @emitEvent 'continue', [@file]
        @continueFunc()
      return
    toggle: ->
      console.info '[FilesCollection] [insert] [.toggle()]' if @config.debug
      if @onPause.get() then @continue() else @pause()
      return
    abort: ->
      console.info '[FilesCollection] [insert] [.abort()]' if @config.debug
      window.removeEventListener 'beforeunload', @config.beforeunload, false
      @config.onAbort and @config.onAbort.call @, @file
      @emitEvent 'abort', [@file]
      @pause()
      @config._onEnd()
      @state.set 'aborted'
      console.timeEnd('insert ' + @config.file.name) if @config.debug
      Meteor.call @config._Abort, @config.fileId
      return
  else undefined

  ###
  @locus Anywhere
  @memberOf FilesCollection
  @name remove
  @param {String|Object} selector - Mongo-Style selector (http://docs.meteor.com/api/collections.html#selectors)
  @param {Function} callback - Callback with one `error` argument
  @summary Remove documents from the collection
  @returns {FilesCollection} Instance
  ###
  remove: (selector, callback) ->
    console.info "[FilesCollection] [remove(#{JSON.stringify(selector)})]" if @debug
    check selector, Match.Optional Match.OneOf Object, String
    check callback, Match.Optional Function

    if Meteor.isClient
      if @allowClientCode
        Meteor.call @_methodNames._Remove, selector, (callback or NOOP)
      else
        callback and callback new Meteor.Error 401, '[FilesCollection] [remove] Run code from client is not allowed!'
        console.warn '[FilesCollection] [remove] Run code from client is not allowed!' if @debug
    else
      files = @collection.find selector
      if files.count() > 0
        self = @
        files.forEach (file) -> self.unlink file
      
      if @onAfterRemove
        self = @
        docs = files.fetch()

        @collection.remove selector, ->
          callback and callback.apply @, arguments
          self.onAfterRemove docs
          return
      else
        @collection.remove selector, (callback or NOOP)
    return @

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
  @locus Server
  @memberOf FilesCollection
  @name deny
  @name allow
  @param {Object} rules
  @see http://docs.meteor.com/#/full/allow
  @summary link Mongo.Collection allow/deny methods
  @returns {Mongo.Collection} Instance
  ###
  deny: if Meteor.isServer then (rules) ->
    @collection.deny rules
    return @collection
  else undefined
  allow: if Meteor.isServer then (rules) ->
    @collection.allow rules
    return @collection
  else undefined

  ###
  @locus Server
  @memberOf FilesCollection
  @name denyClient
  @name allowClient
  @see http://docs.meteor.com/#/full/allow
  @summary Shorthands for Mongo.Collection allow/deny methods
  @returns {Mongo.Collection} Instance
  ###
  denyClient: if Meteor.isServer then ->
    @collection.deny
      insert: -> true
      update: -> true
      remove: -> true
    return @collection
  else undefined
  allowClient: if Meteor.isServer then ->
    @collection.allow
      insert: -> true
      update: -> true
      remove: -> true
    return @collection
  else undefined


  ###
  @locus Server
  @memberOf FilesCollection
  @name unlink
  @param {Object} fileRef - fileObj
  @param {String} version - [Optional] file's version
  @summary Unlink files and it's versions from FS
  @returns {FilesCollection} Instance
  ###
  unlink: if Meteor.isServer then (fileRef, version) ->
    console.info "[FilesCollection] [unlink(#{fileRef._id}, #{version})]" if @debug
    if version
      if fileRef.versions?[version] and fileRef.versions[version]?.path
        fs.unlink fileRef.versions[version].path, NOOP
    else
      if fileRef.versions and not _.isEmpty fileRef.versions
        _.each fileRef.versions, (vRef) -> bound ->
          fs.unlink vRef.path, NOOP
      fs.unlink fileRef.path, NOOP
    return @
  else undefined

  ###
  @locus Server
  @memberOf FilesCollection
  @name _404
  @summary Internal method, used to return 404 error
  @returns {undefined}
  ###
  _404: if Meteor.isServer then (http) ->
    console.warn "[FilesCollection] [download(#{http.request.originalUrl})] [_404] File not found" if @debug
    text = 'File Not Found :('
    http.response.writeHead 404,
      'Content-Length': text.length
      'Content-Type':   'text/plain'
    http.response.end text
    return
  else undefined

  ###
  @locus Server
  @memberOf FilesCollection
  @name download
  @param {Object} http    - Server HTTP object
  @param {String} version - Requested file version
  @param {Object} fileRef - Requested file Object
  @summary Initiates the HTTP response
  @returns {undefined}
  ###
  download: if Meteor.isServer then (http, version = 'original', fileRef) ->
    console.info "[FilesCollection] [download(#{http.request.originalUrl}, #{version})]" if @debug
    if fileRef
      if _.has(fileRef, 'versions') and _.has fileRef.versions, version
        vRef = fileRef.versions[version]
        vRef._id = fileRef._id
      else
        vRef = fileRef
    else
      vRef = false

    if not vRef or not _.isObject(vRef)
      return @_404 http
    else if fileRef
      self = @

      if @downloadCallback
        unless @downloadCallback.call _.extend(http, @_getUser(http)), fileRef
          return @_404 http

      if @interceptDownload and _.isFunction @interceptDownload
        if @interceptDownload(http, fileRef, version) is true
          return

      fs.stat vRef.path, (statErr, stats) -> bound ->
        if statErr or not stats.isFile()
          return self._404 http

        vRef.size    = stats.size if stats.size isnt vRef.size and not self.integrityCheck
        responseType = '400' if stats.size isnt vRef.size and self.integrityCheck
        self.serve http, fileRef, vRef, version, null, (responseType or '200')
      return
    else
      return @_404 http
  else undefined

  ###
  @locus Server
  @memberOf FilesCollection
  @name serve
  @param {Object} http    - Server HTTP object
  @param {Object} fileRef - Requested file Object
  @param {Object} vRef    - Requested file version Object
  @param {String} version - Requested file version
  @param {stream.Readable|null} readableStream - Readable stream, which serves binary file data
  @param {String} responseType - Response code
  @param {Boolean} force200 - Force 200 response code over 206
  @summary Handle and reply to incoming request
  @returns {undefined}
  ###
  serve: if Meteor.isServer then (http, fileRef, vRef, version = 'original', readableStream = null, responseType = '200', force200 = false) ->
    self     = @
    partiral = false
    reqRange = false

    if http.params.query.download and http.params.query.download == 'true'
      dispositionType = 'attachment; '
    else
      dispositionType = 'inline; '

    dispositionName     = "filename=\"#{encodeURIComponent(fileRef.name)}\"; filename=*UTF-8\"#{encodeURIComponent(fileRef.name)}\"; "
    dispositionEncoding = 'charset=utf-8'

    http.response.setHeader 'Content-Type', vRef.type
    http.response.setHeader 'Content-Disposition', dispositionType + dispositionName + dispositionEncoding
    http.response.setHeader 'Accept-Ranges', 'bytes'
    http.response.setHeader 'Last-Modified', fileRef?.updatedAt?.toUTCString() if fileRef?.updatedAt?.toUTCString()
    http.response.setHeader 'Connection', 'keep-alive'

    if http.request.headers.range and not force200
      partiral = true
      array    = http.request.headers.range.split /bytes=([0-9]*)-([0-9]*)/
      start    = parseInt array[1]
      end      = parseInt array[2]
      end      = vRef.size - 1 if isNaN(end)
      take     = end - start
    else
      start    = 0
      end      = vRef.size - 1
      take     = vRef.size

    if partiral or (http.params.query.play and http.params.query.play == 'true')
      reqRange = {start, end}
      if isNaN(start) and not isNaN end
        reqRange.start = end - take
        reqRange.end   = end
      if not isNaN(start) and isNaN end
        reqRange.start = start
        reqRange.end   = start + take

      reqRange.end = vRef.size - 1 if ((start + take) >= vRef.size)
      http.response.setHeader 'Pragma', 'private'
      http.response.setHeader 'Expires', new Date(+new Date + 1000*32400).toUTCString()
      http.response.setHeader 'Cache-Control', 'private, maxage=10800, s-maxage=32400'

      if self.strict and (reqRange.start >= (vRef.size - 1) or reqRange.end > (vRef.size - 1))
        responseType = '416'
      else
        responseType = '206'
    else
      http.response.setHeader 'Cache-Control', self.cacheControl
      responseType = '200'

    streamErrorHandler = (error) ->
      http.response.writeHead 500
      http.response.end error.toString()
      console.error "[FilesCollection] [serve(#{vRef.path}, #{version})] [500]", error if self.debug
      return

    switch responseType
      when '400'
        console.warn "[FilesCollection] [serve(#{vRef.path}, #{version})] [400] Content-Length mismatch!" if self.debug
        text = 'Content-Length mismatch!'
        http.response.writeHead 400,
          'Content-Type':   'text/plain'
          'Cache-Control':  'no-cache'
          'Content-Length': text.length
        http.response.end text
        break
      when '404'
        return self._404 http
        break
      when '416'
        console.warn "[FilesCollection] [serve(#{vRef.path}, #{version})] [416] Content-Range is not specified!" if self.debug
        http.response.writeHead 416,
          'Content-Range': "bytes */#{vRef.size}"
        http.response.end()
        break
      when '200'
        console.info "[FilesCollection] [serve(#{vRef.path}, #{version})] [200]" if self.debug
        stream = readableStream or fs.createReadStream vRef.path
        http.response.writeHead 200 if readableStream
        stream.on('open', ->
          http.response.writeHead 200
          return
        ).on('error', streamErrorHandler
        ).on 'end', ->
          http.response.end()
          return
        stream.pipe new Throttle {bps: self.throttle, chunksize: self.chunkSize} if self.throttle
        stream.pipe http.response
        break
      when '206'
        console.info "[FilesCollection] [serve(#{vRef.path}, #{version})] [206]" if self.debug
        http.response.setHeader 'Content-Range', "bytes #{reqRange.start}-#{reqRange.end}/#{vRef.size}"
        http.response.setHeader 'Trailer', 'expires'
        http.response.setHeader 'Transfer-Encoding', 'chunked'
        stream = readableStream or fs.createReadStream vRef.path, {start: reqRange.start, end: reqRange.end}
        http.response.writeHead 206 if readableStream
        stream.on('open', -> 
          http.response.writeHead 206
          return
        ).on('error', streamErrorHandler
        ).on 'end', ->
          http.response.end()
          return
        stream.pipe new Throttle {bps: self.throttle, chunksize: self.chunkSize} if self.throttle
        stream.pipe http.response
        break
    return
  else undefined

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
    console.info "[FilesCollection] [link(#{fileRef?._id}, #{version})]" if @debug
    check fileRef, Object
    check version, String
    return '' if not fileRef
    return formatFleURL fileRef, version

###
@locus Anywhere
@private
@name formatFleURL
@param {Object} fileRef - File reference object
@param {String} version - [Optional] Version of file you would like build URL for
@summary Returns formatted URL for file
@returns {String} Downloadable link
###
formatFleURL = (fileRef, version = 'original') ->
  check fileRef, Object
  check version, String

  root = __meteor_runtime_config__.ROOT_URL.replace(/\/+$/, '')

  if fileRef.extension?.length
    ext = '.' + fileRef.extension
  else
    ext = ''

  if fileRef.public is true
    return root + (if version is 'original' then "#{fileRef._downloadRoute}/#{fileRef._id}#{ext}" else "#{fileRef._downloadRoute}/#{version}-#{fileRef._id}#{ext}")
  else
    return root + "#{fileRef._downloadRoute}/#{fileRef._collectionName}/#{fileRef._id}/#{version}/#{fileRef._id}#{ext}"

if Meteor.isClient
  ###
  @locus Client
  @TemplateHelper
  @name fileURL
  @param {Object} fileRef - File reference object
  @param {String} version - [Optional] Version of file you would like to request
  @summary Get download URL for file by fileRef, even without subscription
  @example {{fileURL fileRef}}
  @returns {String}
  ###
  Template.registerHelper 'fileURL', (fileRef, version) ->
    return undefined if not fileRef or not _.isObject fileRef
    version = if not version or not _.isString(version) then 'original' else version
    if fileRef._id
      return formatFleURL fileRef, version
    else
      return ''

Meteor.Files = FilesCollection