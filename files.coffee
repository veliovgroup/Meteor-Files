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
@param config           {Object}   - Configuration object with next properties:
@param config.debug     {Boolean}  - Turn on/of debugging and extra logging
@param config.schema    {Object}   - Collection Schema
@param config.public    {Boolean}  - Store files in folder accessible for proxy servers, for limits, and more - read docs
@param config.strict    {Boolean}  - Strict mode for partial content, if is `true` server will return `416` response code, when `range` is not specified, otherwise server return `206`
@param config.protected {Function} - If `true` - files will be served only to authorized users, if `function()` - you're able to check visitor's permissions in your own way function's context has:
  - `request` - On server only
  - `response` - On server only
  - `user()`
  - `userId`
@param config.chunkSize      {Number}  - Upload chunk size, default: 524288 bytes (0,5 Mb)
@param config.permissions    {Number}  - Permissions which will be set to uploaded files, like: `511` or `0o755`
@param config.storagePath    {String}  - Storage path on file system
@param config.cacheControl   {String}  - Default `Cache-Control` header
@param config.throttle       {Number}  - bps throttle threshold
@param config.downloadRoute  {String}  - Server Route used to retrieve files
@param config.collectionName {String}  - Collection name
@param config.namingFunction {Function}- Function which returns `String`
@param config.integrityCheck {Boolean} - Check file's integrity before serving to users
@param config.onBeforeUpload {Function}- Function which executes on server after receiving each chunk and on client right before beginning upload. Function context is `File` - so you are able to check for extension, mime-type, size and etc.
return `true` to continue
return `false` or `String` to abort upload
@param config.allowClientCode  {Boolean}  - Allow to run `remove` from client
@param config.downloadCallback {Function} - Callback triggered each time file is requested, return truthy value to continue download, or falsy to abort
@param config.onbeforeunloadMessage {String|Function} - Message shown to user when closing browser's window or tab while upload process is running
@description Create new instance of Meteor.Files
###
class Meteor.Files
  constructor: (config) ->
    {@storagePath, @collectionName, @downloadRoute, @schema, @chunkSize, @namingFunction, @debug, @onbeforeunloadMessage, @permissions, @allowClientCode, @onBeforeUpload, @integrityCheck, @protected, @public, @strict, @downloadCallback, @cacheControl, @throttle} = config if config

    self               = @
    @debug            ?= false
    @public           ?= false
    @strict           ?= true
    @protected        ?= false
    @chunkSize        ?= 1024*512
    @chunkSize         = Math.floor(@chunkSize / 8) * 8
    @permissions      ?= 0o755
    @cacheControl     ?= 'public, max-age=31536000, s-maxage=31536000'
    @collectionName   ?= 'MeteorUploadFiles'
    @namingFunction   ?= -> Random.id()
    @integrityCheck   ?= true
    @onBeforeUpload   ?= false
    @allowClientCode  ?= true
    @downloadCallback ?= false
    @onbeforeunloadMessage ?= 'Upload in a progress... Do you want to abort?'
    @throttle         ?= false

    cookie = new Cookies()
    if @protected and Meteor.isClient
      if not cookie.has('meteor_login_token') and Meteor._localStorage.getItem('Meteor.loginToken')
        cookie.set 'meteor_login_token', Meteor._localStorage.getItem('Meteor.loginToken'), null, '/'

    if not @storagePath
      @storagePath   = if @public then "../web.browser/app/uploads/#{@collectionName}" else "assets/app/uploads/#{@collectionName}"
      @downloadRoute = if @public then "/uploads/#{@collectionName}" else '/cdn/storage' if not @downloadRoute
    
    if not @downloadRoute
      @downloadRoute = '/cdn/storage'


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
    check @strict, Boolean
    check @throttle, Match.OneOf false, Number
    check @protected, Match.OneOf Boolean, Function
    check @chunkSize, Number
    check @permissions, Number
    check @storagePath, String
    check @downloadRoute, String
    check @integrityCheck, Boolean
    check @collectionName, String
    check @namingFunction, Function
    check @onBeforeUpload, Match.OneOf Boolean, Function
    check @allowClientCode, Boolean
    check @downloadCallback, Match.OneOf Boolean, Function
    check @onbeforeunloadMessage, Match.OneOf String, Function

    if @public and @protected
      throw new Meteor.Error 500, "[Meteor.File.#{@collectionName}]: Files can not be public and protected at the same time!"
    
    @cursor        = null
    @search        = {}
    @collection    = new Mongo.Collection @collectionName
    @currentFile   = null
    @storagePath   = @storagePath.replace /\/$/, ''
    @downloadRoute = @downloadRoute.replace /\/$/, ''

    @collection.attachSchema @schema
    @collection.deny
      insert: -> true
      update: -> true
      remove: -> true
    
    @_prefix = SHA256 @collectionName + @storagePath + @downloadRoute
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
          console.warn 'Access denied!' if self.debug
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
        console.info 'Meteor.Files Debugger: [MeteorFileUnlink]' if self.debug
        if self.allowClientCode
          self.remove.call cp(_insts[inst._prefix], inst), inst.search
        else
          throw new Meteor.Error 401, '[Meteor.Files] [remove()] Run code from client is not allowed!'

      _methods[self.methodNames.MeteorFileWrite] = (opts) ->
        @unblock()
        check opts, {
          meta: Object
          file: Object
          fileId: String
          binData: String
          chunkId: Number
          fileLength: Number
          _binSize: Number
          eof: Boolean
        }

        console.info "Meteor.Files Debugger: [MeteorFileWrite] {name: #{opts.fileId}, meta:#{opts.meta}}" if self.debug
        console.info "Meteor.Files Debugger: Received chunk ##{opts.chunkId} of #{opts.fileLength} chunks, file: #{opts.file.name or opts.file.fileName}" if self.debug

        if self.onBeforeUpload and _.isFunction self.onBeforeUpload
          isUploadAllowed = self.onBeforeUpload.call {file: opts.file}, opts.file
          if isUploadAllowed isnt true
            throw new Meteor.Error(403, if _.isString(isUploadAllowed) then isUploadAllowed else '@onBeforeUpload() returned false')

        fileName = self.getFileName opts.file
        {extension, extensionWithDot} = self.getExt fileName

        pathName = if self.public then "#{self.storagePath}/original-#{opts.fileId}" else "#{self.storagePath}/#{opts.fileId}"
        path     = if self.public then "#{self.storagePath}/original-#{opts.fileId}#{extensionWithDot}" else "#{self.storagePath}/#{opts.fileId}#{extensionWithDot}"
        pathPart = if opts.fileLength > 1 then "#{pathName}_#{opts.chunkId}#{extensionWithDot}" else path

        result = _.extend self.dataToSchema(_.extend(opts.file, {path, extension, name: fileName, meta: opts.meta})), {_id: opts.fileId, chunkId: opts.chunkId, _binSize: opts._binSize}

        action = (cb) ->
          binary = new Buffer opts.binData, 'base64'
          tries  = 0

          concatChunks = (num, files, cb) ->
            sindex = files.indexOf "#{opts.fileId}_1#{extensionWithDot}"
            files.splice sindex, 1 if !!~sindex
            findex = files.indexOf "#{opts.fileId}_#{num}#{extensionWithDot}"
            if !!~findex
              files.splice(findex, 1)
            else
              console.warn "finish as no more files", files, {sindex, findex}, "#{opts.fileId}_#{num}#{extensionWithDot}" if self.debug
              return finish cb

            _path   = "#{pathName}_#{num}#{extensionWithDot}"
            _source = pathName + '_1' + extensionWithDot

            fs.stat _path, (error, stats) ->
              if error or not stats.isFile()
                if tries >= 10
                  cb new Meteor.Error 500, "Chunk ##{num} is missing!"
                else
                  tries++
                  Meteor.setTimeout ->
                    concatChunks num, files, cb
                  , 100
              else
                fs.readFile _path, (error, _chunkData) ->
                  if error
                    cb new Meteor.Error 500, "Can't read #{_path}"
                  else
                    fs.appendFile _source, _chunkData, (error) ->
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
                console.info "Meteor.Files Debugger: The file #{fileName} (binary) was saved to #{path}" if self.debug
                cb null, result
          try
            if opts.eof
              if opts.fileLength > 1
                fs.readdir self.storagePath, (error, files) ->
                  if error
                    cb new Meteor.Error 500, error
                  else
                    concatChunks 2, files.filter((f) -> !!~f.indexOf opts.fileId), cb
              else
                finish cb
            else
              fs.outputFile pathPart, binary, 'binary', (error) ->
                cb error, result
          catch e
            cb e

        if opts.eof
          try
            return Meteor.wrapAsync(action)()
          catch e
            console.warn "Meteor.Files Debugger: Insert (Upload) Exception:", e if self.debug
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

        console.info "Meteor.Files Debugger: Abort for #{path}" if self.debug
        if opts.fileLength > 1
          i = 0
          while i <= opts.fileLength
            _path = "#{path}_#{i}#{ext}"
            fs.stat _path, ((error, stats) -> bound =>
              if not error and stats.isFile()
                fs.unlink @_path, NOOP
            ).bind({_path})
            i++

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
    console.info "Meteor.Files Debugger: [write(buffer, #{JSON.stringify(opts)}, callback)]" if @debug
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

      console.info "Meteor.Files Debugger: The file #{fileName} (binary) was added to #{@collectionName}" if @debug

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
    console.info "Meteor.Files Debugger: [load(#{url}, #{JSON.stringify(opts)}, callback)]" if @debug
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
      throw new Meteor.Error 500, "Error on [load(#{url}, #{opts})]; Error:" + JSON.stringify error
    ).on('response', (response) -> bound ->

      console.info "Meteor.Files Debugger: The file #{url} is received" if self.debug

      result = self.dataToSchema
        name:      fileName
        path:      path
        meta:      opts.meta
        type:      opts.type or response.headers['content-type']
        size:      opts.size or response.headers['content-length']
        extension: extension

      self.collection.insert _.clone(result), (error, fileRef) ->
        if error
          console.warn "Meteor.Files Debugger: Can't add file #{fileName} (binary) to #{self.collectionName}" if self.debug
          callback and callback error
        else
          console.info "Meteor.Files Debugger: The file #{fileName} (binary) was added to #{self.collectionName}" if self.debug
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
    console.info "[addFile(#{path})]" if @debug

    throw new Meteor.Error 403, 'Can not run [addFile()] on public collection' if @public
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
            console.warn "Can't add file #{fileName} (binary) to #{_cn}" if self.debug
            callback and callback error
          else
            console.info "The file #{fileName} (binary) was added to #{_cn}" if self.debug
            callback and callback null, result
      else
        callback and callback new Meteor.Error 400, "[Files.addFile(#{path})]: File does not exist"

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
    console.info "Meteor.Files Debugger: [findOne(#{JSON.stringify(search)})]" if @debug
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
    console.info "Meteor.Files Debugger: [find(#{JSON.stringify(search)})]" if @debug
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
    console.info 'Meteor.Files Debugger: [get()]' if @debug
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
    console.info 'Meteor.Files Debugger: [fetch()]' if @debug
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
      console.info 'Meteor.Files Debugger: [insert()]' if @debug
      {file, meta, onUploaded, onProgress, onBeforeUpload, onAbort, streams, onError, chunkSize, onReady, FileReadProgress} = config
      meta      ?= {}
      streams   ?= 2
      chunkSize ?= this.chunkSize

      check meta, Match.Optional Object
      check onAbort, Match.Optional Function
      check streams, Match.OneOf 'dynamic', Number
      check chunkSize, Match.OneOf 'dynamic', Number
      check onUploaded, Match.Optional Function
      check onProgress, Match.Optional Function
      check onBeforeUpload, Match.Optional Function
      check onError, Match.Optional Function
      check onReady, Match.Optional Function
      check FileReadProgress, Match.Optional Function

      if file
        console.time('insert') if @debug
        self       = @
        fileReader = new FileReader
        fileLength = 1
        fileId     = @namingFunction()
        fileData   =
          size: file.size
          type: file.type
          name: file.name

        fileData = _.extend fileData, @getExt(file.name), {mime: @getMimeType(fileData)}
        fileData['mime-type'] = fileData.mime

        beforeunload = (e) ->
          message = if _.isFunction(self.onbeforeunloadMessage) then self.onbeforeunloadMessage.call(null) else self.onbeforeunloadMessage
          e.returnValue = message if e
          return message
        window.addEventListener 'beforeunload', beforeunload, false

        result  =
          file: _.extend file, fileData
          onPause: new ReactiveVar false
          continueFunc: -> return
          pause: ->
            @onPause.set true
            @state.set 'paused'
          continue: ->
            @onPause.set false
            @state.set 'active'
            @continueFunc.call()
            @continueFunc = -> return
          toggle: ->
            if @onPause.get() then @continue() else @pause()
          progress: new ReactiveVar 0
          abort: ->
            window.removeEventListener 'beforeunload', beforeunload, false
            onAbort and onAbort.call @, fileData
            fileReader.abort()
            @pause()
            @state.set 'aborted'
            Meteor.call self.methodNames.MeteorFileAbort, {fileId, fileLength, fileData}
            delete upload
          state: new ReactiveVar 'active'
          readAsDataURL: -> fileReader?.result

        result.progress.set = _.throttle result.progress.set, 250

        Tracker.autorun ->
          if Meteor.status().connected
            result.continue()
            console.info 'Meteor.Files Debugger: Connection established continue() upload' if self.debug
          else
            result.pause()
            console.info 'Meteor.Files Debugger: Connection error set upload on pause()' if self.debug

        end = (error, data) ->
          console.timeEnd('insert') if self.debug
          window.removeEventListener 'beforeunload', beforeunload, false
          result.progress.set 0
          onUploaded and onUploaded.call result, error, data
          if error
            result.state.set 'aborted'
            onError and onError.call result, error, fileData
          else
            result.state.set 'completed'

        if onBeforeUpload and _.isFunction onBeforeUpload
          isUploadAllowed = onBeforeUpload.call result, fileData
          if isUploadAllowed isnt true
            end new Meteor.Error(403, if _.isString(isUploadAllowed) then isUploadAllowed else 'Files.onBeforeUpload() returned false'), null
            return false

        if @onBeforeUpload and _.isFunction @onBeforeUpload
          isUploadAllowed = @onBeforeUpload.call result, fileData
          if isUploadAllowed isnt true
            end new Meteor.Error(403, if _.isString(isUploadAllowed) then isUploadAllowed else 'this.onBeforeUpload() returned false'), null
            return false

        currentChunk = 0
        sentChunks   = 0
        binary   = ''
        _binSize = 0
        EOFsent  = false

        sendEOF = (opts) ->
          unless EOFsent
            EOFsent = true
            Meteor.setTimeout ->
              opts.binData  = 'EOF'
              opts.eof      = true
              opts.chunkId  = -1
              opts._binSize = -1
              Meteor.call self.methodNames.MeteorFileWrite, opts, end
            , 50

        upload = (fileLength) ->
          opts = 
            meta: meta
            file: fileData
            fileId: fileId
            fileLength: fileLength
            eof: false

          if result.onPause.get()
            result.continueFunc = -> upload fileLength
            return

          if _binSize > 0
            opts.chunkId = ++currentChunk
            opts.binData = binary.substring 0, chunkSize
            binary       = binary.substring chunkSize
            _binSize     = opts._binSize = _.clone binary.length

            Meteor.call self.methodNames.MeteorFileWrite, opts, (error, data) ->
              ++sentChunks
              if error
                end error
              else
                progress = (data.chunkId / fileLength) * 100
                result.progress.set Math.ceil(progress)
                onProgress and onProgress.call result, progress

                unless result.onPause.get()
                  if data._binSize <= 0
                    sendEOF opts
                  else
                    upload fileLength
                else
                  result.continueFunc = -> upload fileLength
          else
            sendEOF opts

        createStreams = (fileLength) ->
          i = 1
          while i <= streams
            Meteor.defer -> upload fileLength
            i++
          return

        readHandler = (chunk) ->
          binary    = (fileReader?.result or chunk.srcElement?.result or chunk.target?.result).split(',')[1]
          if binary and binary.length
            onReady and onReady.call result, fileData
            binSize   = _.clone binary.length
            _binSize  = _.clone binary.length
            if chunkSize is 'dynamic'
              if binSize >= 2048 * streams
                chunkSize = Math.ceil binSize / (8 * streams)
              else
                chunkSize = self.chunkSize
            if streams is 'dynamic'
              streams = Math.ceil binSize / chunkSize
              if streams > 32
                streams = 32
            chunkSize = Math.floor(chunkSize / 8) * 8
            _len = Math.ceil(binSize / chunkSize)
            fileLength = if _len <= 0 then 1 else _len
            if streams > fileLength
              streams = fileLength
            createStreams fileLength

        if FileReadProgress
          fileReader.onprogress = (e) -> FileReadProgress.call result, ((e.loaded / file.size) * 100)
        fileReader.onloadend = readHandler
        fileReader.onerror = (e) ->
          result.abort()
          error = (e.target or e.srcElement).error
          onError and onError.call result, error, fileData

        Meteor.defer -> fileReader.readAsDataURL file
        return result
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
    console.info "Meteor.Files Debugger: [remove(#{JSON.stringify(search)})]" if @debug
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
    console.warn "Meteor.Files Debugger: [download(#{http.request.originalUrl})] [404] File not found" if @debug
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
    console.info "Meteor.Files Debugger: [download(#{http.request.originalUrl}, #{version})]" if @debug
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
            console.warn "Meteor.Files Debugger: [download(#{fileRef.path}, #{version})] [400] Content-Length mismatch!" if self.debug
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
            console.info "Meteor.Files Debugger: [download(#{fileRef.path}, #{version})] [416] Content-Range is not specified!" if self.debug
            http.response.writeHead 416,
              'Content-Range': "bytes */#{fileRef.size}"
            http.response.end()
            break
          when '200'
            console.info "Meteor.Files Debugger: [download(#{fileRef.path}, #{version})] [200]" if self.debug
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
            console.info "Meteor.Files Debugger: [download(#{fileRef.path}, #{version})] [206]" if self.debug
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
    console.info 'Meteor.Files Debugger: [link()]' if @debug
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