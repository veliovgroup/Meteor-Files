if Meteor.isServer
  ###
  @description Require "fs-extra" npm package
  ###
  fs       = Npm.require 'fs-extra'
  request  = Npm.require 'request'
  Throttle = Npm.require 'throttle'
  util     = Npm.require 'util'
  NOOP     = -> return

  ###
  @var {object} bound - Meteor.bindEnvironment aka Fiber wrapper
  ###
  bound = Meteor.bindEnvironment (callback) -> return callback()

###
@private
@object
@name _insts
@description Object of Meteor.Files instances
###
_insts = {}

###
@private
@function
@name rcp
@param {Object} obj - Initial object
@description Create object with only needed props
###
rcp = (obj) ->
  o =
    currentFile:    obj.currentFile
    search:         obj.search
    storagePath:    obj.storagePath
    collectionName: obj.collectionName
    downloadRoute:  obj.downloadRoute
    chunkSize:      obj.chunkSize
    debug:          obj.debug
    _prefix:        obj._prefix
    cacheControl:   obj.cacheControl
    versions:       obj.versions
  return o

###
@private
@function
@name cp
@param {Object} to   - Destanation
@param {Object} from - Source
@description Copy-Paste only needed props from one to another object
###
cp = (to, from) ->
  to.currentFile    = from.currentFile
  to.search         = from.search
  to.storagePath    = from.storagePath
  to.collectionName = from.collectionName
  to.downloadRoute  = from.downloadRoute
  to.chunkSize      = from.chunkSize
  to.debug          = from.debug
  to._prefix        = from._prefix
  to.cacheControl   = from.cacheControl
  to.versions       = from.versions
  return to

###
@isomorphic
@class
@namespace Meteor
@name Files
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
@param config.permissions    {Number}  - [Server] Permissions which will be set to uploaded files, like: `511` or `0o755`
@param config.storagePath    {String}  - [Server] Storage path on file system
@param config.cacheControl   {String}  - [Server] Default `Cache-Control` header
@param config.throttle       {Number}  - [Server] bps throttle threshold
@param config.downloadRoute  {String}  - [Both]   Server Route used to retrieve files
@param config.collectionName {String}  - [Both]   Collection name
@param config.namingFunction {Function}- [Both]   Function which returns `String`
@param config.integrityCheck {Boolean} - [Server] Check file's integrity before serving to users
@param config.onAfterUpload  {Function}- [Server] Called right after file is ready on FS. Use to transfer file somewhere else, or do other thing with file directly
@param config.onBeforeUpload {Function}- [Both]   Function which executes on server after receiving each chunk and on client right before beginning upload. Function context is `File` - so you are able to check for extension, mime-type, size and etc.
return `true` to continue
return `false` or `String` to abort upload
@param config.allowClientCode  {Boolean}  - [Both]   Allow to run `remove` from client
@param config.downloadCallback {Function} - [Server] Callback triggered each time file is requested, return truthy value to continue download, or falsy to abort
@param config.onbeforeunloadMessage {String|Function} - [Client] Message shown to user when closing browser's window or tab while upload process is running
@description Create new instance of Meteor.Files
###
class Meteor.Files
  constructor: (config) ->
    {@storagePath, @collectionName, @downloadRoute, @schema, @chunkSize, @namingFunction, @debug, @onbeforeunloadMessage, @permissions, @allowClientCode, @onBeforeUpload, @integrityCheck, @protected, @public, @strict, @downloadCallback, @cacheControl, @throttle, @onAfterUpload} = config if config

    self               = @
    cookie             = new Cookies()
    @debug            ?= false
    @public           ?= false
    @protected        ?= false
    @chunkSize        ?= 1024*512
    @chunkSize         = Math.floor(@chunkSize / 8) * 8
    @downloadRoute    ?= if @public then "/uploads/#{@collectionName}" else '/cdn/storage'
    @downloadRoute     = @downloadRoute.replace /\/$/, ''
    @collectionName   ?= 'MeteorUploadFiles'
    @namingFunction   ?= -> Random.id()
    @onBeforeUpload   ?= false
    @allowClientCode  ?= true

    if Meteor.isClient
      @onbeforeunloadMessage ?= 'Upload in a progress... Do you want to abort?'
      if Worker
        @ReaderWorker = new Worker '/packages/ostrio_files/worker.js'
      delete @strict
      delete @throttle
      delete @storagePath
      delete @permissions
      delete @cacheControl
      delete @onAfterUpload
      delete @integrityCheck
      delete @downloadCallback
      if @protected
        if not cookie.has('meteor_login_token') and Meteor._localStorage.getItem('Meteor.loginToken')
          cookie.set 'meteor_login_token', Meteor._localStorage.getItem('Meteor.loginToken'), null, '/'

      check @onbeforeunloadMessage, Match.OneOf String, Function
    else
      @strict           ?= true
      @throttle         ?= false
      @permissions      ?= 0o755
      @cacheControl     ?= 'public, max-age=31536000, s-maxage=31536000'
      @onAfterUpload    ?= false
      @integrityCheck   ?= true
      @downloadCallback ?= false
      @storagePath      ?= if @public then "../web.browser/app/uploads/#{@collectionName}" else "assets/app/uploads/#{@collectionName}"
      @storagePath       = @storagePath.replace /\/$/, ''

      check @strict, Boolean
      check @throttle, Match.OneOf false, Number
      check @permissions, Number
      check @storagePath, String
      check @cacheControl, String
      check @onAfterUpload, Match.OneOf Boolean, Function
      check @integrityCheck, Boolean
      check @downloadCallback, Match.OneOf Boolean, Function

    if not @schema
      @schema =
        size: type: Number
        name: type: String
        type: type: String
        path: type: String
        isVideo: type: Boolean
        isAudio: type: Boolean
        isImage: type: Boolean
        _prefix: type: String
        extension:
          type: String
          optional: true
        _storagePath: type: String
        _downloadRoute: type: String
        _collectionName: type: String
        meta:
          type: Object
          blackbox: true
          optional: true
        userId:
          type: String
          optional: true
        updatedAt: 
          type: Date
          autoValue: -> new Date()
        versions:
          type: Object
          blackbox: true

    check @debug, Boolean
    check @schema, Object
    check @public, Boolean
    check @protected, Match.OneOf Boolean, Function
    check @chunkSize, Number
    check @downloadRoute, String
    check @collectionName, String
    check @namingFunction, Function
    check @onBeforeUpload, Match.OneOf Boolean, Function
    check @allowClientCode, Boolean

    if @public and @protected
      throw new Meteor.Error 500, "[Meteor.Files.#{@collectionName}]: Files can not be public and protected at the same time!"
    
    @cursor        = null
    @search        = {}
    @collection    = new Mongo.Collection @collectionName
    @currentFile   = null

    @collection.attachSchema @schema
    @collection.deny
      insert: -> true
      update: -> true
      remove: -> true
    
    @_prefix = SHA256 @collectionName + @downloadRoute
    _insts[@_prefix] = @

    @checkAccess = (http) ->
      if self.protected
        user = false
        userFuncs = self.getUser http
        {user, userId} = userFuncs
        user = user()

        if _.isFunction self.protected
          result = if http then self.protected.call(_.extend(http, userFuncs), self.currentFile or null) else self.protected.call userFuncs, self.currentFile or null
        else
          result = !!user

        if (http and result is true) or not http
          return true
        else
          rc = if _.isNumber(result) then result else 401
          console.warn '[Meteor.Files.checkAccess] WARN: Access denied!' if self.debug
          if http
            text = 'Access denied!'
            http.response.writeHead rc,
              'Content-Length': text.length
              'Content-Type':   'text/plain'
            http.response.end text
          return false
      else
        return true

    @methodNames =
      MeteorFileAbort:  "MeteorFileAbort#{@_prefix}"
      MeteorFileWrite:  "MeteorFileWrite#{@_prefix}"
      MeteorFileUnlink: "MeteorFileUnlink#{@_prefix}"

    if Meteor.isServer
      WebApp.connectHandlers.use (request, response, next) ->
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
              self.findOne(uris[0]).download.call(self, http, uris[1]) if self.checkAccess http
            else
              next()
          else
            next()
        else
          if !!~request._parsedUrl.path.indexOf "#{self.downloadRoute}"
            uri = request._parsedUrl.path.replace "#{self.downloadRoute}", ''
            if uri.indexOf('/') is 0
              uri = uri.substring 1

            uris = uri.split '/'
            if uris.length is 1
              params = 
                query: if request._parsedUrl.query then JSON.parse('{"' + decodeURI(request._parsedUrl.query).replace(/"/g, '\\"').replace(/&/g, '","').replace(/=/g,'":"') + '"}') else {}
                file: uris[0]
              http = {request, response, params}

              if !!~params.file.indexOf '-'
                version = params.file.split('-')[0]
                self.download.call self, http, version
              else
                self._404 http
            else
              next()
          else
            next()

      _methods = {}
      _methods[self.methodNames.MeteorFileUnlink] = (inst) ->
        check inst, Object
        console.info '[Meteor.Files] [Unlink Method]' if self.debug
        if self.allowClientCode
          self.remove.call cp(_insts[inst._prefix], inst), inst.search
        else
          throw new Meteor.Error 401, '[Meteor.Files] [remove] Run code from client is not allowed!'

      _methods[self.methodNames.MeteorFileWrite] = (opts) ->
        @unblock()
        check opts, {
          eof:        Boolean
          meta:       Object
          file:       Object
          fileId:     String
          binData:    Match.Any
          chunkId:    Number
          fileLength: Number
        }

        console.info "[Meteor.Files] [Write Method] Got ##{opts.chunkId}/#{opts.fileLength} chunks, dst: #{opts.file.name or opts.file.fileName}" if self.debug

        if self.onBeforeUpload and _.isFunction self.onBeforeUpload
          isUploadAllowed = self.onBeforeUpload.call {file: opts.file}, opts.file
          if isUploadAllowed isnt true
            throw new Meteor.Error(403, if _.isString(isUploadAllowed) then isUploadAllowed else '@onBeforeUpload() returned false')

        fileName = self.getFileName opts.file
        {extension, extensionWithDot} = self.getExt fileName

        pathName = if self.public then "#{self.storagePath}/original-#{opts.fileId}" else "#{self.storagePath}/#{opts.fileId}"
        path     = if self.public then "#{self.storagePath}/original-#{opts.fileId}#{extensionWithDot}" else "#{self.storagePath}/#{opts.fileId}#{extensionWithDot}"
        pathPart = if opts.fileLength > 1 then "#{pathName}_#{opts.chunkId}#{extensionWithDot}" else path

        result = _.extend self.dataToSchema(_.extend(opts.file, {path, extension, name: fileName, meta: opts.meta})), {_id: opts.fileId, chunkId: opts.chunkId}

        action = (cb) -> Meteor.defer ->
          if opts.eof
            binary = opts.binData
          else
            binary = new Buffer opts.binData, 'base64'
          tries  = 0

          concatChunks = (num, files, cb) ->
            sindex = files.indexOf "#{opts.fileId}_1#{extensionWithDot}"
            files.splice sindex, 1 if !!~sindex
            findex = files.indexOf "#{opts.fileId}_#{num}#{extensionWithDot}"
            if !!~findex
              files.splice(findex, 1)
            else
              console.warn "[Meteor.Files] [Write Method] [concatChunks] finish as no more file's chunks", files, {sindex, findex}, "#{opts.fileId}_#{num}#{extensionWithDot}" if self.debug
              return finish cb

            _path   = "#{pathName}_#{num}#{extensionWithDot}"
            _source = pathName + '_1' + extensionWithDot

            fs.stat _path, (error, stats) -> bound ->
              if error or not stats.isFile()
                if tries >= 10
                  cb new Meteor.Error 500, "Chunk ##{num} is missing!"
                else
                  tries++
                  Meteor.setTimeout ->
                    concatChunks num, files, cb
                  , 100
              else
                fs.readFile _path, (error, _chunkData) -> bound ->
                  if error
                    cb new Meteor.Error 500, "Can't read #{_path}"
                  else
                    fs.appendFile _source, _chunkData, (error) -> bound ->
                      if error
                        cb new Meteor.Error 500, "Can't append #{_path} to #{_source}"
                      else
                        fs.unlink _path, NOOP
                        if files.length <= 0
                          fs.rename _source, path, (error) -> bound ->
                            if error
                              cb new Meteor.Error 500, "Can't rename #{_source} to #{path}"
                            else
                              finish cb
                        else
                          concatChunks ++num, files, cb

          finish = (cb) ->
            fs.chmod path, self.permissions, NOOP
            result.type = self.getMimeType opts.file

            self.collection.insert _.clone(result), (error, _id) ->
              if error
                cb new Meteor.Error 500, error
              else
                result._id = _id
                console.info "[Meteor.Files] [Write Method] [finish] #{fileName} -> #{path}" if self.debug
                self.onAfterUpload and self.onAfterUpload null, result
                cb null, result
          try
            if opts.eof
              if opts.fileLength > 1
                fs.readdir self.storagePath, (error, files) -> bound ->
                  if error
                    cb new Meteor.Error 500, error
                  else
                    concatChunks 2, files.filter((f) -> !!~f.indexOf opts.fileId), cb
              else
                finish cb
            else
              fs.outputFile pathPart, binary, 'binary', (error) -> bound -> cb error, result
          catch e
            cb e
          return

        if opts.eof
          try
            return Meteor.wrapAsync(action)()
          catch e
            console.warn "[Meteor.Files] [Write Method] Exception:", e if self.debug
            throw e
        else
          action NOOP
          return result

      _methods[self.methodNames.MeteorFileAbort] = (opts) ->
        check opts, {
          fileId: String
          fileData: Object
          fileLength: Number
        }

        ext  = ".#{opts.fileData.ext}"
        path = if self.public then "#{self.storagePath}/original-#{opts.fileId}" else "#{self.storagePath}/#{opts.fileId}"

        console.info "[Meteor.Files] [Abort Method]: For #{path}" if self.debug
        if opts.fileLength > 1
          i = 0
          while i <= opts.fileLength
            _path = "#{path}_#{i}#{ext}"
            fs.stat _path, ((error, stats) -> bound =>
              if not error and stats.isFile()
                fs.unlink @_path, NOOP
            ).bind({_path})
            i++
        Meteor.setTimeout -> 
          self.remove opts.fileId
        , 250

      Meteor.methods _methods

  ###
  Extend Meteor.Files with mime library
  @url https://github.com/broofa/node-mime
  @description Temporary removed from package due to unstability
  ###
  # fileType: if Meteor.isServer then Npm.require "file-type" else undefined

  ###
  @isomorphic
  @function
  @class Meteor.Files
  @name getMimeType
  @param {Object} fileData - File Object
  @description Returns file's mime-type
  @returns {String}
  ###
  getMimeType: (fileData) ->
    check fileData, Object
    mime = fileData.type if fileData?.type
    mime = 'application/octet-stream' if not mime or not _.isString mime
    mime

  ###
  @isomorphic
  @function
  @class Meteor.Files
  @name getFileName
  @param {Object} fileData - File Object
  @description Returns file's name
  @returns {String}
  ###
  getFileName: (fileData) ->
    fileName = fileData.name or fileData.fileName
    if _.isString(fileName) and fileName.length > 0
      cleanName = (str) -> str.replace(/\.\./g, '').replace /\//g, ''
      return cleanName(fileData.name or fileData.fileName)
    else
      return ''

  ###
  @isomorphic
  @function
  @class Meteor.Files
  @name getUser
  @description Returns object with `userId` and `user()` method which return user's object
  @returns {Object}
  ###
  getUser: (http) ->
    result = 
      user: -> return null
      userId: null
      
    if Meteor.isServer
      if http
        cookie = http.request.Cookies
        if _.has(Package, 'accounts-base') and cookie.has 'meteor_login_token'
          user = Meteor.users.findOne 'services.resume.loginTokens.hashedToken': Accounts._hashLoginToken cookie.get 'meteor_login_token'
          if user
            result.user = () -> return user
            result.userId = user._id
    else
      if _.has(Package, 'accounts-base') and Meteor.userId()
        result.user = -> return Meteor.user()
        result.userId = Meteor.userId()

    return result

  ###
  @isomorphic
  @function
  @class Meteor.Files
  @name getExt
  @param {String} FileName - File name
  @description Get extension from FileName
  @returns {Object}
  ###
  getExt: (fileName) ->
    if !!~fileName.indexOf('.')
      extension = fileName.split('.').pop()
      return { ext: extension, extension, extensionWithDot: '.' + extension }
    else
      return { ext: '', extension: '', extensionWithDot: '' }

  ###
  @isomorphic
  @function
  @class Meteor.Files
  @name dataToSchema
  @param {Object} data - File data
  @description Build object in accordance with schema from File data
  @returns {Object}
  ###
  dataToSchema: (data) ->
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
      _prefix: data._prefix or @_prefix
      _storagePath:    data._storagePath or @storagePath
      _downloadRoute:  data._downloadRoute or @downloadRoute
      _collectionName: data._collectionName or @collectionName
    }

  ###
  @isomorphic
  @function
  @class Meteor.Files
  @name srch
  @param {String|Object} search - Search data
  @description Build search object
  @returns {Object}
  ###
  srch: (search) ->
    if search and _.isString search
      @search =
        _id: search
    else
      @search = search or {}
    @search

  ###
  @server
  @function
  @class Meteor.Files
  @name write
  @param {Buffer} buffer - Binary File's Buffer
  @param {Object} opts - {fileName: '', type: '', size: 0, meta: {...}}
  @param {Function} callback - function(error, fileObj){...}
  @description Write buffer to FS and add to Meteor.Files Collection
  @returns {Files} - Returns current Meteor.Files instance
  ###
  write: if Meteor.isServer then (buffer, opts = {}, callback) ->
    console.info "[Meteor.Files] [write()]" if @debug
    check opts, Match.Optional Object
    check callback, Match.Optional Function

    if @checkAccess()
      randFileName  = @namingFunction()
      fileName      = if opts.name or opts.fileName then opts.name or opts.fileName else randFileName

      {extension, extensionWithDot} = @getExt fileName

      path      = if @public then "#{@storagePath}/original-#{randFileName}#{extensionWithDot}" else "#{@storagePath}/#{randFileName}#{extensionWithDot}"
      
      opts.type = @getMimeType opts
      opts.meta = {} if not opts.meta
      opts.size = buffer.length if not opts.size

      result    = @dataToSchema
        name:      fileName
        path:      path
        meta:      opts.meta
        type:      opts.type
        size:      opts.size
        extension: extension

      console.info "[Meteor.Files] [write]: #{fileName} -> #{@collectionName}" if @debug

      fs.outputFile path, buffer, 'binary', (error) -> bound ->
        if error
          callback and callback error
        else
          result._id = @collection.insert _.clone result
          callback and callback null, result
      
      return @
  else
    undefined

  ###
  @server
  @function
  @class Meteor.Files
  @name load
  @param {String} url - URL to file
  @param {Object} opts - {fileName: '', meta: {...}}
  @param {Function} callback - function(error, fileObj){...}
  @description Download file, write stream to FS and add to Meteor.Files Collection
  @returns {Files} - Return this
  ###
  load: if Meteor.isServer then (url, opts = {}, callback) ->
    console.info "[Meteor.Files] [load(#{url}, #{JSON.stringify(opts)}, callback)]" if @debug
    check url, String
    check opts, Match.Optional Object
    check callback, Match.Optional Function

    self          = @
    randFileName = @namingFunction()
    fileName     = if opts.name or opts.fileName then opts.name or opts.fileName else randFileName
    
    {extension, extensionWithDot} = @getExt fileName
    path      = if @public then "#{@storagePath}/original-#{randFileName}#{extensionWithDot}" else "#{@storagePath}/#{randFileName}#{extensionWithDot}"
    opts.meta = {} if not opts.meta

    request.get(url).on('error', (error)-> bound ->
      throw new Meteor.Error 500, "Error on [load(#{url})]:" + JSON.stringify error
    ).on('response', (response) -> bound ->

      console.info "[Meteor.Files] [load] Received: #{url}" if self.debug

      result = self.dataToSchema
        name:      fileName
        path:      path
        meta:      opts.meta
        type:      opts.type or response.headers['content-type']
        size:      opts.size or response.headers['content-length']
        extension: extension

      self.collection.insert _.clone(result), (error, fileRef) ->
        if error
          console.warn "[Meteor.Files] [load] [insert] Error: #{fileName} -> #{self.collectionName}", error if self.debug
          callback and callback error
        else
          console.info "[Meteor.Files] [load] [insert] #{fileName} -> #{self.collectionName}" if self.debug
          callback and callback null, fileRef

    ).pipe fs.createOutputStream path

    return @
  else
    undefined

  ###
  @server
  @function
  @class Meteor.Files
  @name addFile
  @param {String} path - Path to file
  @param {String} path - Path to file
  @description Add file from FS to Meteor.Files
  @returns {Files} - Return this
  ###
  addFile: if Meteor.isServer then (path, opts = {}, callback) ->
    console.info "[Meteor.Files] [addFile(#{path})]" if @debug

    throw new Meteor.Error 403, 'Can not run [addFile] on public collection' if @public
    check path, String
    check opts, Match.Optional Object
    check callback, Match.Optional Function

    self = @
    fs.stat path, (error, stats) -> bound ->
      if error
        callback and callback error
      else if stats.isFile()
        fileStats = util.inspect stats
        fileSize  = fileStats.size
        pathParts = path.split '/'
        fileName  = pathParts[pathParts.length - 1]

        {extension, extensionWithDot} = self.getExt fileName

        opts.type = 'application/*' if not opts.type
        opts.meta = {} if not opts.meta
        opts.size = fileSize if not opts.size

        result = self.dataToSchema
          name:         fileName
          path:         path
          meta:         opts.meta
          type:         opts.type
          size:         opts.size
          extension:    extension
          _storagePath: path.replace "/#{fileName}", ''

        _cn = self.collectionName
        self.collection.insert _.clone(result), (error, record) ->
          if error
            console.warn "[Meteor.Files] [addFile] [insert] Error: #{fileName} -> #{_cn}", error if self.debug
            callback and callback error
          else
            console.info "[Meteor.Files] [addFile] [insert]: #{fileName} -> #{_cn}" if self.debug
            callback and callback null, result
      else
        callback and callback new Meteor.Error 400, "[Meteor.Files] [addFile(#{path})]: File does not exist"

    return @
  else
    undefined

  ###
  @isomorphic
  @function
  @class Meteor.Files
  @name findOne
  @param {String|Object} search - `_id` of the file or `Object` like, {prop:'val'}
  @description Load file
  @returns {Files} - Return this
  ###
  findOne: (search) ->
    console.info "[Meteor.Files] [findOne(#{JSON.stringify(search)})]" if @debug
    check search, Match.Optional Match.OneOf Object, String
    @srch search

    if @checkAccess()
      @currentFile = @collection.findOne @search
      @cursor      = null
    return @

  ###
  @isomorphic
  @function
  @class Meteor.Files
  @name find
  @param {String|Object} search - `_id` of the file or `Object` like, {prop:'val'}
  @description Load file or bunch of files
  @returns {Files} - Return this
  ###
  find: (search) ->
    console.info "[Meteor.Files] [find(#{JSON.stringify(search)})]" if @debug
    check search, Match.Optional Match.OneOf Object, String
    @srch search

    if @checkAccess
      @currentFile = null
      @cursor = @collection.find @search
    return @

  ###
  @isomorphic
  @function
  @class Meteor.Files
  @name get
  @description Return value of current cursor or file
  @returns {Object|[Object]}
  ###
  get: () ->
    console.info '[Meteor.Files] [get()]' if @debug
    return @cursor.fetch() if @cursor
    return @currentFile

  ###
  @isomorphic
  @function
  @class Meteor.Files
  @name fetch
  @description Alias for `get()` method
  @returns {[Object]}
  ###
  fetch: () ->
    console.info '[Meteor.Files] [fetch()]' if @debug
    data = @get()
    if not _.isArray data
      return [data]
    else
      data

  ###
  @client
  @function
  @class Meteor.Files
  @name insert
  @param {Object} config - Configuration object with next properties:
    {File|Object} file           - HTML5 `files` item, like in change event: `e.currentTarget.files[0]`
    {Object}      meta           - Additional data as object, use later for search
    {Boolean}     allowWebWorkers- Allow/Deny WebWorkers usage
    {Number|dynamic} streams     - Quantity of parallel upload streams, default: 2
    {Number|dynamic} chunkSize   - Chunk size for upload
    {Function}    onUploaded     - Callback triggered when upload is finished, with two arguments `error` and `fileRef`
    {Function}    onError        - Callback triggered on error in upload and/or FileReader, with two arguments `error` and `fileRef`
    {Function}    onProgress     - Callback triggered when chunk is sent, with only argument `progress`
    {Function}    onBeforeUpload - Callback triggered right before upload is started, with only `FileReader` argument:
        context is `File` - so you are able to check for extension, mime-type, size and etc.
        return true to continue
        return false to abort upload
  @description Upload file to server over DDP
  @url https://developer.mozilla.org/en-US/docs/Web/API/FileReader
  @returns {Object} with next properties:
    {ReactiveVar} onPause  - Is upload process on the pause?
    {ReactiveVar} state    - active|paused|aborted|completed
    {ReactiveVar} progress - Current progress in percentage
    {Function}    pause    - Pause upload process
    {Function}    continue - Continue paused upload process
    {Function}    toggle   - Toggle continue/pause if upload process
    {Function}    abort    - Abort upload
    {Function}    readAsDataURL - Current file as data URL, use to create image preview and etc. Be aware of big files, may lead to browser crash
  ###
  insert: if Meteor.isClient then (config) ->
    if @checkAccess()
      console.info '[Meteor.Files] [insert()]' if @debug
      config.meta            ?= {}
      config.streams         ?= 2
      config.streams          = 2 if config.streams < 1
      config.chunkSize       ?= @chunkSize
      config.allowWebWorkers ?= true

      check config, {
        file:            Match.Any
        meta:            Match.Optional Object
        onError:         Match.Optional Function
        onAbort:         Match.Optional Function
        streams:         Match.OneOf 'dynamic', Number
        chunkSize:       Match.OneOf 'dynamic', Number
        onUploaded:      Match.Optional Function
        onProgress:      Match.Optional Function
        onBeforeUpload:  Match.Optional Function
        allowWebWorkers: Boolean
      }

      if config.file
        if Worker and config.allowWebWorkers
          worker   = @ReaderWorker
        else
          worker   = null
        console.time('insert') if @debug
        console.time('loadFile') if @debug
        self       = @
        fileLength = 1
        fileId     = @namingFunction()
        fileData   =
          size: config.file.size
          type: config.file.type
          name: config.file.name

        fileData = _.extend fileData, @getExt(config.file.name), {mime: @getMimeType(fileData)}
        fileData['mime-type'] = fileData.mime

        beforeunload = (e) ->
          message = if _.isFunction(self.onbeforeunloadMessage) then self.onbeforeunloadMessage.call(null) else self.onbeforeunloadMessage
          e.returnValue = message if e
          return message
        window.addEventListener 'beforeunload', beforeunload, false

        result  =
          file:          _.extend config.file, fileData
          state:         new ReactiveVar 'active'
          onPause:       new ReactiveVar false
          progress:      new ReactiveVar 0
          estimateTime:  new ReactiveVar 1000
          estimateSpeed: new ReactiveVar 0
          continueFunc:  -> return
          pause: ->
            unless @onPause.get()
              @onPause.set true
              @state.set 'paused'
            return
          continue: ->
            if @onPause.get()
              @onPause.set false
              @state.set 'active'
              @continueFunc.call()
              @continueFunc = -> return
            return
          toggle: ->
            if @onPause.get() then @continue() else @pause()
            return
          abort: ->
            window.removeEventListener 'beforeunload', beforeunload, false
            config.onAbort and config.onAbort.call @, fileData
            @pause()
            @state.set 'aborted'
            console.timeEnd('insert') if self.debug
            Meteor.call self.methodNames.MeteorFileAbort, {fileId, fileLength, fileData}
            worker.terminate() if worker
            delete upload
            return

        Tracker.autorun ->
          unless result.onPause.get()
            if Meteor.status().connected
              result.continue()
              console.info '[Meteor.Files] [insert] [Tracker] [continue]' if self.debug
            else
              result.pause()
              console.info '[Meteor.Files] [insert] [Tracker] [pause]' if self.debug
          return

        end = (error, data) ->
          console.timeEnd('insert') if self.debug
          window.removeEventListener 'beforeunload', beforeunload, false
          result.progress.set 0
          config.onUploaded and config.onUploaded.call result, error, data
          if error
            console.warn "[Meteor.Files] [insert] [end] Error: ", error if self.debug
            result.state.set 'aborted'
            config.onError and config.onError.call result, error, fileData
          else
            result.state.set 'completed'
          worker.terminate() if worker
          return

        if config.onBeforeUpload and _.isFunction config.onBeforeUpload
          isUploadAllowed = config.onBeforeUpload.call result, fileData
          if isUploadAllowed isnt true
            end new Meteor.Error(403, if _.isString(isUploadAllowed) then isUploadAllowed else 'config.onBeforeUpload() returned false'), null
            return false

        if @onBeforeUpload and _.isFunction @onBeforeUpload
          isUploadAllowed = @onBeforeUpload.call result, fileData
          if isUploadAllowed isnt true
            end new Meteor.Error(403, if _.isString(isUploadAllowed) then isUploadAllowed else 'this.onBeforeUpload() returned false'), null
            return false

        currentChunk = 0
        sentChunks   = 0
        EOFsent      = false
        transferTime = 0

        calculateStats = _.throttle ->
          _t = (transferTime / sentChunks) / config.streams
          result.estimateTime.set (_t * (fileLength - sentChunks))
          result.estimateSpeed.set (config.chunkSize / (_t / 1000))
          progress = Math.round((sentChunks / fileLength) * 100)
          result.progress.set progress
          config.onProgress and config.onProgress.call result, progress
          return
        , 250

        sendViaDDP = (evt) -> Meteor.defer ->
          console.timeEnd('loadFile') if self.debug
          opts =
            eof:        false
            meta:       config.meta
            file:       fileData
            fileId:     fileId
            binData:    evt.data.bin
            chunkId:    evt.data.chunkId
            fileLength: fileLength

          if opts.binData and opts.binData.length
            Meteor.call self.methodNames.MeteorFileWrite, opts, (error) ->
              ++sentChunks
              transferTime += (+new Date) - evt.data.start
              if error
                end error
              else
                if sentChunks >= fileLength
                  sendEOF opts
                else if currentChunk < fileLength
                  upload()
                calculateStats()
              return
          else
            sendEOF opts
          return

        sendEOF = (opts) -> Meteor.defer ->
          unless EOFsent
            EOFsent = true
            opts =
              eof:       true
              meta:      config.meta
              file:      fileData
              fileId:    fileId
              binData:   'EOF'
              chunkId:    -1
              fileLength: fileLength
            Meteor.call self.methodNames.MeteorFileWrite, opts, end
          return

        if worker
          worker.onmessage = sendViaDDP
          worker.onerror   = (e) -> 
            end e.message
            return

        if self.debug
          if worker
            console.info "[Meteor.Files] [insert] using WebWorkers"
          else
            console.info "[Meteor.Files] [insert] using MainThread"

        upload = -> Meteor.defer ->
          start = +new Date
          if result.onPause.get()
            result.continueFunc = -> createStreams()
            return

          ++currentChunk
          if worker
            worker.postMessage({sentChunks, start, currentChunk, chunkSize: config.chunkSize, file: config.file})
          else
            ((chunkId) ->
              fileReader = new FileReader
              chunk = config.file.slice (config.chunkSize * (chunkId - 1)), (config.chunkSize * chunkId)
              readHandler = (evt) ->
                sendViaDDP data: 
                  bin: (fileReader?.result or evt.srcElement?.result or evt.target?.result).split(',')[1]
                  chunkId: chunkId
                  start: start
                return

              fileReader.onloadend = readHandler
              fileReader.onerror = (e) ->
                result.abort()
                onError and onError.call result, (e.target or e.srcElement).error, fileData
                return

              fileReader.readAsDataURL chunk
              return
            )(currentChunk)
          return

        createStreams = ->
          i = 1
          while i <= config.streams
            upload()
            i++
          return

        prepare = ->
          if config.chunkSize is 'dynamic'
            if config.file.size >= 104857600
              config.chunkSize = 1048576
            else if config.file.size >= 52428800
              config.chunkSize = 524288
            else
              config.chunkSize = 262144
          
          _len = Math.ceil(config.file.size / config.chunkSize)
          if config.streams is 'dynamic'
            config.streams = _.clone _len
            config.streams = 32 if config.streams > 32

          fileLength     = if _len <= 0 then 1 else _len
          config.streams = fileLength if config.streams > fileLength
          console.log {config, fileLength}
          createStreams()
          return
        prepare()
        return result
      else
        console.warn "[Meteor.Files] [insert] Have you forget to pass a File itself?"
  else
    undefined

  ###
  @isomorphic
  @function
  @class Meteor.Files
  @name remove
  @param {String|Object} search - `_id` of the file or `Object` like, {prop:'val'}
  @description Remove file(s) on cursor or find and remove file(s) if search is set
  @returns {undefined}
  ###
  remove: (search) ->
    console.info "[Meteor.Files] [remove(#{JSON.stringify(search)})]" if @debug
    check search, Match.Optional Match.OneOf Object, String

    if @checkAccess()
      @srch search
      if Meteor.isClient
        Meteor.call @methodNames.MeteorFileUnlink, rcp(@)

      if Meteor.isServer
        files = @collection.find @search
        if files.count() > 0
          self = @
          files.forEach (file) -> self.unlink file
        @collection.remove @search
    return @

  ###
  @sever
  @function
  @class Meteor.Files
  @name unlink
  @param {Object} file - fileObj
  @description Unlink files and it's versions from FS
  @returns {undefined}
  ###
  unlink: if Meteor.isServer then (file) ->
    if file.versions and not _.isEmpty file.versions
      _.each file.versions, (version) -> bound ->
        fs.unlink version.path, NOOP
    fs.unlink file.path, NOOP
    return @
  else undefined


  _404: if Meteor.isServer then (http) ->
    console.warn "[Meteor.Files] [download(#{http.request.originalUrl})] [_404] File not found" if @debug
    text = 'File Not Found :('
    http.response.writeHead 404,
      'Content-Length': text.length
      'Content-Type':   'text/plain'
    http.response.end text
  else undefined

  ###
  @server
  @function
  @class Meteor.Files
  @name download
  @param {Object|Files} self - Instance of MEteor.Files
  @description Initiates the HTTP response
  @returns {undefined}
  ###
  download: if Meteor.isServer then (http, version = 'original') ->
    console.info "[Meteor.Files] [download(#{http.request.originalUrl}, #{version})]" if @debug
    responseType = '200'
    if not @public
      if @currentFile
        if _.has(@currentFile, 'versions') and _.has @currentFile.versions, version
          fileRef = @currentFile.versions[version]
        else
          fileRef = @currentFile
      else
        fileRef = false

    if @public
      fileRef =
        path: "#{@storagePath}/#{http.params.file}"

    if not fileRef or not _.isObject(fileRef)
      return @_404 http
    else if @currentFile
      self = @

      if @downloadCallback
        unless @downloadCallback.call _.extend(http, @getUser(http)), @currentFile
          return @_404 http

      fs.stat fileRef.path, (statErr, stats) -> bound ->
        if statErr or not stats.isFile()
          return self._404 http

        fileStats    = util.inspect stats
        fileRef.size = fileStats.size if fileStats.size isnt fileRef.size and not self.integrityCheck
        responseType = '400' if fileStats.size isnt fileRef.size and self.integrityCheck
        partiral     = false
        reqRange     = false

        if http.params.query.download and http.params.query.download == 'true'
          dispositionType = 'attachment; '
        else
          dispositionType = 'inline; '

        dispositionName     = "filename=\"#{encodeURIComponent(self.currentFile.name)}\"; filename=*UTF-8\"#{encodeURIComponent(self.currentFile.name)}\"; "
        dispositionEncoding = 'charset=utf-8'

        http.response.setHeader 'Content-Type', fileRef.type
        http.response.setHeader 'Content-Disposition', dispositionType + dispositionName + dispositionEncoding
        http.response.setHeader 'Accept-Ranges', 'bytes'
        http.response.setHeader 'Last-Modified', self.currentFile?.updatedAt?.toUTCString() if self.currentFile?.updatedAt?.toUTCString()
        http.response.setHeader 'Connection', 'keep-alive'

        if http.request.headers.range
          partiral = true
          array    = http.request.headers.range.split /bytes=([0-9]*)-([0-9]*)/
          start    = parseInt array[1]
          end      = parseInt array[2]
          if isNaN(end)
            end    = fileRef.size - 1
          take     = end - start
        else
          start    = 0
          end      = fileRef.size - 1
          take     = fileRef.size

        if partiral or (http.params.query.play and http.params.query.play == 'true')
          reqRange = {start, end}
          if isNaN(start) and not isNaN end
            reqRange.start = end - take
            reqRange.end   = end
          if not isNaN(start) and isNaN end
            reqRange.start = start
            reqRange.end   = start + take

          reqRange.end = fileRef.size - 1 if ((start + take) >= fileRef.size)
          http.response.setHeader 'Pragma', 'private'
          http.response.setHeader 'Expires', new Date(+new Date + 1000*32400).toUTCString()
          http.response.setHeader 'Cache-Control', 'private, maxage=10800, s-maxage=32400'

          if self.strict and (reqRange.start >= (fileRef.size - 1) or reqRange.end > (fileRef.size - 1))
            responseType = '416'
          else
            responseType = '206'
        else
          http.response.setHeader 'Cache-Control', self.cacheControl
          responseType = '200'

        streamErrorHandler = (error) ->
          http.response.writeHead 500
          http.response.end error.toString()

        switch responseType
          when '400'
            console.warn "[Meteor.Files] [download(#{fileRef.path}, #{version})] [400] Content-Length mismatch!" if self.debug
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
            console.info "[Meteor.Files] [download(#{fileRef.path}, #{version})] [416] Content-Range is not specified!" if self.debug
            http.response.writeHead 416,
              'Content-Range': "bytes */#{fileRef.size}"
            http.response.end()
            break
          when '200'
            console.info "[Meteor.Files] [download(#{fileRef.path}, #{version})] [200]" if self.debug
            stream = fs.createReadStream fileRef.path
            stream.on('open', =>
              http.response.writeHead 200
              if self.throttle
                stream.pipe( new Throttle {bps: self.throttle, chunksize: self.chunkSize}
                ).pipe http.response
              else
                stream.pipe http.response
            ).on 'error', streamErrorHandler
            break
          when '206'
            console.info "[Meteor.Files] [download(#{fileRef.path}, #{version})] [206]" if self.debug
            http.response.setHeader 'Content-Range', "bytes #{reqRange.start}-#{reqRange.end}/#{fileRef.size}"
            http.response.setHeader 'Trailer', 'expires'
            http.response.setHeader 'Transfer-Encoding', 'chunked'
            if self.throttle
              stream = fs.createReadStream fileRef.path, {start: reqRange.start, end: reqRange.end}
              stream.on('open', -> http.response.writeHead 206
              ).on('error', streamErrorHandler
              ).on('end', -> http.response.end()
              ).pipe( new Throttle {bps: self.throttle, chunksize: self.chunkSize}
              ).pipe http.response
            else
              stream = fs.createReadStream fileRef.path, {start: reqRange.start, end: reqRange.end}
              stream.on('open', -> http.response.writeHead 206
              ).on('error', streamErrorHandler
              ).on('end', -> http.response.end()
              ).pipe http.response
            break
    else
      return @_404 http
  else undefined

  ###
  @isomorphic
  @function
  @class Meteor.Files
  @name link
  @param {Object}   fileRef - File reference object
  @param {String}   version - [Optional] Version of file you would like to request
  @param {Boolean}  pub     - [Optional] is file located in publicity available folder?
  @description Returns URL to file
  @returns {String} Empty string returned in case if file not found in DB
  ###
  link: (fileRef, version = 'original', pub = false) ->
    console.info '[Meteor.Files] [link()]' if @debug
    if _.isString fileRef
      version = fileRef
      fileRef = null
    return '' if not fileRef and not @currentFile
    return formatFleURL (fileRef or @currentFile), version, @public

###
@isomorphic
@private
@function
@name formatFleURL
@param {Object} fileRef - File reference object
@param {String} version - [Optional] Version of file you would like build URL for
@param {Boolean}  pub   - [Optional] is file located in publicity available folder?
@description Returns formatted URL for file
@returns {String}
###
formatFleURL = (fileRef, version = 'original', pub = false) ->
  root = __meteor_runtime_config__.ROOT_URL.replace(/\/+$/, '')

  if fileRef?.extension?.length > 0
    ext = '.' + fileRef.extension
  else
    ext = ''

  if pub
    return root + "#{fileRef._downloadRoute}/#{version}-#{fileRef._id}#{ext}"
  else
    return root + "#{fileRef._downloadRoute}/#{fileRef._collectionName}/#{fileRef._id}/#{version}/#{fileRef._id}#{ext}"

if Meteor.isClient
  ###
  @client
  @TemplateHelper
  @name fileURL
  @param {Object} fileRef - File reference object
  @param {String} version - [Optional] Version of file you would like to request
  @description Get download URL for file by fileRef, even without subscription
  @example {{fileURL fileRef}}
  @returns {String}
  ###
  Template.registerHelper 'fileURL', (fileRef, version) ->
    return undefined if not fileRef or not _.isObject fileRef
    version = if not version or not _.isString(version) then 'original' else version
    if fileRef._id
      return formatFleURL fileRef, version, !!~fileRef._storagePath?.indexOf?('../web.browser')
    else
      return ''