if Meteor.isServer
  ###
  @description Require "fs-extra" npm package
  ###
  fs      = Npm.require "fs-extra"
  request = Npm.require "request"

  ###
  @var {object} bound - Meteor.bindEnvironment aka Fiber wrapper
  ###
  bound = Meteor.bindEnvironment (callback) ->
    return callback()

###
@object
@name _insts
@description Object of Meteor.Files instances
###
_insts = {}

###
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
@class
@namespace Meteor
@name Files
@param config {Object}                 - Configuration object with next properties:
@param config.storagePath {String}     - Storage path on file system
@param config.collectionName {String}  - Collection name
@param config.downloadRoute {String}   - Server Route used to retrieve files
@param config.schema {Object}          - Collection Schema
@param config.chunkSize {Number}       - Upload chunk size
@param config.namingFunction {Function}- Function which returns `String`
@param config.debug {Boolean}          - Turn on/of debugging and extra logging
@param config.permissions {Number}     - Permissions which will be set to uploaded files, like: `511` or `0o777`
@param config.onBeforeUpload {Function}- Function which executes on server after receiving each chunk and on client right before beginning upload. Function context is `File` - so you are able to check for extension, mime-type, size and etc.
return `true` to continue
return `false` or `String` to abort upload
@param config.integrityCheck {Boolean} - Check file's integrity before serving to users
@param config.protected {Function}     - If `true` - files will be served only to authorized users, if `function()` - you're able to check visitor's permissions in your own way function's context has:
  - `request` - On server only
  - `response` - On server only
  - `user()`
  - `userId`
@param config.public {Boolean}         - Store files in folder accessible for proxy servers, for limits, and more - read docs
@param config.strict {Boolean}         - Strict mode for partial content, if is `true` server will return `416` response code, when `range` is not specified, otherwise server return `206`
@param config.allowClientCode {Boolean}   - Allow to run `remove` from client
@param config.downloadCallback {Function} - Callback triggered each time file is requested
@param config.onbeforeunloadMessage {String|Function} - Message shown to user when closing browser's window or tab while upload process is running
@description Create new instance of Meteor.Files
###
class Meteor.Files
  constructor: (config) ->
    {@storagePath, @collectionName, @downloadRoute, @schema, @chunkSize, @namingFunction, @debug, @onbeforeunloadMessage, @permissions, @allowClientCode, @onBeforeUpload, @integrityCheck, @protected, @public, @strict, @downloadCallback} = config if config

    @collectionName   ?= 'MeteorUploadFiles'
    @chunkSize        ?= 272144
    @namingFunction   ?= -> Random._randomString 17, 'AZQWXSECDRFVTBGYNHUJMIKOLPzaqwsxecdrfvtgbyhnujimkolp'
    @debug            ?= false
    @permissions      ?= 0o777
    @allowClientCode  ?= true
    @integrityCheck   ?= true
    @protected        ?= false
    @public           ?= false
    @strict           ?= true
    @onBeforeUpload   ?= false
    @downloadCallback ?= false
    @onbeforeunloadMessage ?= 'Upload in a progress... Do you want to abort?'



    cookie = new Cookies()
    if @protected and Meteor.isClient
      if not cookie.has('meteor_login_token') and Meteor._localStorage.getItem('Meteor.loginToken')
        cookie.set 'meteor_login_token', Meteor._localStorage.getItem('Meteor.loginToken'), null, '/'
    
    if @public and @storagePath
      @downloadRoute  = if @storagePath.indexOf('/') isnt 1 then "/uploads/#{@storagePath}" else "/uploads#{@storagePath}"
      @storagePath    = if @storagePath.indexOf('/') isnt 1 then "../web.browser/#{@storagePath}" else "../web.browser#{@storagePath}"

    if not @storagePath
      @storagePath    = if @public then "../web.browser/uploads/#{@collectionName}" else "/assets/app/uploads/#{@collectionName}"
      @downloadRoute  = if @public then "/uploads/#{@collectionName}" else '/cdn/storage' if not @downloadRoute
    
    if not @downloadRoute
      @downloadRoute  = '/cdn/storage'


    if not @schema
      @schema =
        name:
          type: String
        type:
          type: String
        extension:
          type: String
        path:
          type: String
        meta:
          type: Object
          blackbox: true
          optional: true
        userId:
          type: String
          optional: true
        versions:
          type: Object
          blackbox: true
        isVideo:
          type: Boolean
        isAudio:
          type: Boolean
        isImage:
          type: Boolean
        size:
          type: Number
        _prefix:
          type: String
        _collectionName:
          type: String
        _storagePath:
          type: String
        _downloadRoute:
          type: String

    check @storagePath, String
    check @collectionName, String
    check @downloadRoute, String
    check @chunkSize, Number
    check @namingFunction, Function
    check @allowClientCode, Boolean
    check @debug, Boolean
    check @onbeforeunloadMessage, Match.OneOf String, Function
    check @integrityCheck, Boolean
    check @public, Boolean
    check @protected, Match.OneOf Boolean, Function
    check @downloadCallback, Match.OneOf Boolean, Function
    check @strict, Boolean
    check @onBeforeUpload, Match.OneOf Boolean, Function
    check @permissions, Number
    check @schema, Object

    if @public and @protected
      throw new Meteor.Error 500, "[Meteor.File.#{@collectionName}]: Files can not be public and protected at the same time!"
    
    @storagePath    = @storagePath.replace /\/$/, ''
    @downloadRoute  = @downloadRoute.replace /\/$/, ''
    @collection     = new Mongo.Collection @collectionName

    self          = @
    @currentFile  = null
    @cursor       = null
    @search       = {}
    @cacheControl = 'public, max-age=31536000'

    @collection.attachSchema @schema

    @collection.deny
      insert: ->
        true
      update: ->
        true
      remove: ->
        true
    
    @_prefix = SHA256 @collectionName + @storagePath + @downloadRoute
    _insts[@_prefix] = @

    @checkAccess = (http) ->
      if @protected
        user = false
        userFuncs = @getUser http
        {user, userId} = userFuncs
        user = user()

        if _.isFunction @protected
          result = if http then @protected.call(_.extend(http, userFuncs)) else @protected.call userFuncs
        else
          result = !!user

        if http and not result
          console.warn "Access denied!" if @debug
          if http
            text = "Access denied!"
            http.response.writeHead 401,
              'Content-Length': text.length
              'Content-Type':   "text/plain"
            http.response.end text
          return false
        else
          return true
      else
        return true

    unless @public
      Router.route "#{@downloadRoute}/#{@collectionName}/:_id/:version/:name", ->
        self.findOne(@params._id).download.call(self, @, @params.version) if self.checkAccess @
      , {where: 'server'}
    else
      Router.route "#{@downloadRoute}/:file", ->
        if @params.file.indexOf('-') isnt -1
          version = @params.file.split('-')[0]
          self.download.call self, @, version
        else
          @response.writeHead 404
      , {where: 'server'}

    @methodNames =
      MeteorFileAbort:  "MeteorFileAbort#{@_prefix}"
      MeteorFileWrite:  "MeteorFileWrite#{@_prefix}"
      MeteorFileUnlink: "MeteorFileUnlink#{@_prefix}"

    if Meteor.isServer
      _methods = {}

      _methods[self.methodNames.MeteorFileUnlink] = (inst) ->
        check inst, Object
        console.info "Meteor.Files Debugger: [MeteorFileUnlink]" if self.debug
        if self.allowClientCode
          self.remove.call cp(_insts[inst._prefix], inst), inst.search
        else
          throw new Meteor.Error 401, '[Meteor.Files] [remove()] Run code from client is not allowed!'

      _methods[self.methodNames.MeteorFileWrite] = (unitArray, fileData, meta = {}, first, chunksQty, currentChunk, totalSentChunks, randFileName, part, partsQty, fileSize) ->
        check unitArray, Match.OneOf Uint8Array, Object
        check fileData, Object
        check meta, Match.Optional Object
        check first, Boolean
        check chunksQty, Number
        check currentChunk, Number
        check totalSentChunks, Number
        check randFileName, String
        check part, Number
        check partsQty, Number
        check fileSize, Number

        console.info "Meteor.Files Debugger: [MeteorFileWrite] {name: #{randFileName}, meta:#{meta}}" if self.debug
        console.info "Meteor.Files Debugger: Received chunk ##{currentChunk} of #{chunksQty} chunks, in part: #{part}, file: #{fileData.name or fileData.fileName}" if self.debug

        if self.onBeforeUpload and _.isFunction self.onBeforeUpload
          isUploadAllowed = self.onBeforeUpload.call fileData
          if isUploadAllowed isnt true
            throw new Meteor.Error(403, if _.isString(isUploadAllowed) then isUploadAllowed else "@onBeforeUpload() returned false")

        @unblock()

        i = 0
        binary = ''
        while i < unitArray.byteLength
          binary += String.fromCharCode unitArray[i]
          i++
        last = (chunksQty * partsQty <= totalSentChunks)

        fileName = self.getFileName fileData
        {extension, extensionWithDot} = self.getExt fileName

        pathName  = if self.public then "#{self.storagePath}/original-#{randFileName}" else "#{self.storagePath}/#{randFileName}"
        path      = if self.public then "#{self.storagePath}/original-#{randFileName}#{extensionWithDot}" else "#{self.storagePath}/#{randFileName}#{extensionWithDot}"
        pathPart  = if partsQty > 1 then "#{pathName}_#{part}#{extensionWithDot}" else path


        result = self.dataToSchema
          name:       fileName
          extension:  extension
          path:       path
          meta:       meta
          type:       self.getMimeType unitArray, fileData
          size:       fileData.size

        result.chunk = currentChunk
        result.last  = last
        
        if first
          fs.outputFileSync pathPart, binary, 'binary'
        else
          fs.appendFileSync pathPart, binary, 'binary'
        
        console.info "Meteor.Files Debugger: The part ##{part} of file #{fileName} (binary) was saved to #{pathPart}" if (chunksQty is currentChunk) and self.debug

        if last
          if partsQty > 1
            i = 2
            while i <= partsQty
              _path = "#{pathName}_#{i}#{extensionWithDot}"
              fs.appendFileSync pathName + '_1' + extensionWithDot, fs.readFileSync(_path), 'binary'
              fs.unlink _path
              i++
            fs.renameSync pathName + '_1' + extensionWithDot, path

          fs.chmod path, self.permissions
          result._id = randFileName if self.public
          result._id = self.collection.insert _.clone result

          console.info "Meteor.Files Debugger: The file #{fileName} (binary) was saved to #{path}" if self.debug
        return result

      _methods[self.methodNames.MeteorFileAbort] = (randFileName, partsQty, fileData) ->
        check randFileName, String
        check partsQty, Number
        check fileData, Object

        pathName  = if self.public then "#{self.storagePath}/original-#{randFileName}" else "#{self.storagePath}/#{randFileName}"
        extensionWithDot = ".#{fileData.ext}"

        if partsQty > 1
          i = 0
          while i <= partsQty
            path = "#{pathName}_#{i}#{extensionWithDot}"
            fs.unlink path if fs.existsSync path
            i++

      Meteor.methods _methods

  ###
  Extend Meteor.Files with mime library
  @url https://github.com/broofa/node-mime
  ###
  fileType: if Meteor.isServer then Npm.require "file-type" else undefined

  ###
  @isomorphic
  @function
  @class Meteor.Files
  @name getMimeType
  @param {binary} binary   - Binary file-data
  @param {Object} fileData - File Object
  @description Returns file's mime-type
  @returns {String}
  ###
  getMimeType: (binary, fileData) ->
    check fileData, Object

    mime = 'application/octet-stream'
    unless fileData.type
      if Meteor.isServer
        ft = @fileType binary
        {ext, mime} = ft if ft
    else if fileData.type
      mime = fileData.type

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
      user: -> return undefined
      userId: undefined
      
    if Meteor.isServer
      if http
        cookie = http.request.Cookies 
        if _.has(Package, 'accounts-base') and cookie.has 'meteor_login_token'
          user = Meteor.users.findOne "services.resume.loginTokens.hashedToken": Accounts._hashLoginToken cookie.get 'meteor_login_token'
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
      return { extension, extensionWithDot: '.' + extension }
    else
      return { extension: '', extensionWithDot: '' }

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
      isVideo: !!~data.type.toLowerCase().indexOf("video")
      isAudio: !!~data.type.toLowerCase().indexOf("audio")
      isImage: !!~data.type.toLowerCase().indexOf("image")
      _prefix: data._prefix or @_prefix
      _collectionName: data._collectionName or @collectionName
      _storagePath:    data._storagePath or @storagePath
      _downloadRoute:  data._downloadRoute or @downloadRoute
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
      @search = search
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
  @returns {Files} - Return this
  ###
  write: if Meteor.isServer then (buffer, opts = {}, callback) ->
    console.info "Meteor.Files Debugger: [write(buffer, #{opts}, callback)]" if @debug
    check opts, Match.Optional Object
    check callback, Match.Optional Function

    if @checkAccess()
      randFileName  = @namingFunction()
      fileName      = if opts.name or opts.fileName then opts.name or opts.fileName else randFileName

      {extension, extensionWithDot} = @getExt fileName

      path      = if @public then "#{@storagePath}/original-#{randFileName}#{extensionWithDot}" else "#{@storagePath}/#{randFileName}#{extensionWithDot}"
      
      opts.type = @getMimeType buffer, opts
      opts.meta = {} if not opts.meta
      opts.size = buffer.length if not opts.size

      result    = @dataToSchema
        name:       fileName
        extension:  extension
        path:       path
        meta:       opts.meta
        type:       opts.type
        size:       opts.size

      console.info "Meteor.Files Debugger: The file #{fileName} (binary) was added to #{@collectionName}" if @debug

      fs.outputFileSync path, buffer, 'binary'

      result._id = @collection.insert _.clone result
      callback and callback null, result
      return result
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
    console.info "Meteor.Files Debugger: [load(#{url}, #{opts}, callback)]" if @debug
    check url, String
    check opts, Match.Optional Object
    check callback, Match.Optional Function

    self = @
    if @checkAccess()
      randFileName  = @namingFunction()
      fileName      = if opts.name or opts.fileName then opts.name or opts.fileName else randFileName
      
      {extension, extensionWithDot} = @getExt fileName
      path      = if @public then "#{@storagePath}/original-#{randFileName}#{extensionWithDot}" else "#{@storagePath}/#{randFileName}#{extensionWithDot}"
      opts.meta = {} if not opts.meta

      request.get(url).on('error', (error)->
        throw new Meteor.Error 500, "Error on [load(#{url}, #{opts})]; Error:" + JSON.stringify error
      ).on('response', (response) ->
        bound ->
          result = self.dataToSchema
            name:       fileName
            extension:  extension
            path:       path
            meta:       opts.meta
            type:       response.headers['content-type']
            size:       response.headers['content-length']

          console.info "Meteor.Files Debugger: The file #{fileName} (binary) was loaded to #{@collectionName}" if @debug

          result._id = self.collection.insert _.clone result
          callback and callback null, result

      ).pipe fs.createOutputStream path

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

    throw new Meteor.Error 403, "Can not run [addFile()] on public collection" if @public
    check path, String
    check opts, Match.Optional Object
    check callback, Match.Optional Function

    try
      stats     = fs.statSync path

      if stat.isFile()
        fileSize  = stats.size
        pathParts = path.split '/'
        fileName  = pathParts[pathParts.length - 1]

        {extension, extensionWithDot} = @getExt fileName

        opts.type = 'application/*' if not opts.type
        opts.meta = {} if not opts.meta
        opts.size = fileSize if not opts.size

        result = @dataToSchema
          name:         fileName
          extension:    extension
          path:         path
          meta:         opts.meta
          type:         opts.type
          size:         opts.size
          _storagePath: path.replace "/#{fileName}", ''

        result._id = @collection.insert _.clone result
        console.info "The file #{fileName} (binary) was added to #{@collectionName}" if @debug

        callback and callback null, result
        return result
      else
        error = new Meteor.Error 400, "[Files.addFile(#{path})]: File does not exist"
        callback and callback error
        return error

    catch error
      callback and callback error
      return error
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
    console.info "Meteor.Files Debugger: [findOne(#{search})]" if @debug
    check search, Match.OneOf Object, String
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
    console.info "Meteor.Files Debugger: [find(#{search})]" if @debug
    check search, Match.OneOf Object, String
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
    console.info "Meteor.Files Debugger: [get()]" if @debug
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
    console.info "Meteor.Files Debugger: [fetch()]" if @debug
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
    {Number}      streams        - Quantity of parallel upload streams
    {Function}    onUploaded     - Callback triggered when upload is finished, with two arguments `error` and `fileRef`
    {Function}    onProgress     - Callback triggered when chunk is sent, with only argument `progress`
    {Function}    onBeforeUpload - Callback triggered right before upload is started, with only `FileReader` argument:
                                   context is `File` - so you are able to check for extension, mime-type, size and etc.
                                   return true to continue
                                   return false to abort upload
  @description Upload file to server over DDP
  @url https://developer.mozilla.org/en-US/docs/Web/API/FileReader
  @returns {Object} with next properties:
    {ReactiveVar} onPause      - Is upload process on the pause?
    {Function}    pause        - Pause upload process
    {Function}    continue     - Continue paused upload process
    {Function}    toggle       - Toggle continue/pause if upload process
    {Function}    abort        - Abort upload
  ###
  insert: if Meteor.isClient then (config) ->
    if @checkAccess()
      console.info "Meteor.Files Debugger: [insert()]" if @debug
      {file, meta, onUploaded, onProgress, onBeforeUpload, onAbort, streams} = config
      meta ?= {}

      check meta, Match.Optional Object
      check onAbort, Match.Optional Function
      check onUploaded, Match.Optional Function
      check onProgress, Match.Optional Function
      check onBeforeUpload, Match.Optional Function
      check streams, Match.Optional Number

      if file
        console.time('insert') if @debug

        beforeunload = (e) ->
          message = if _.isFunction(self.onbeforeunloadMessage) then self.onbeforeunloadMessage.call(null) else self.onbeforeunloadMessage
          e.returnValue = message if e
          return message
        window.addEventListener "beforeunload", beforeunload, false

        self    = @
        result  =
          onPause: new ReactiveVar false
          continueFrom: []
          pause: () ->
            @onPause.set true
          continue: () ->
            @onPause.set false
            func.call null for func in @continueFrom
            @continueFrom = []
          toggle: () ->
            if @onPause.get() then @continue() else @pause()
          progress: new ReactiveVar 0
          abort: () ->
            window.removeEventListener "beforeunload", beforeunload, false
            onAbort and onAbort.call file, fileData
            @pause()
            Meteor.call self.methodNames.MeteorFileAbort, randFileName, streams, file
            delete upload

        result.progress.set = _.throttle result.progress.set, 250

        Tracker.autorun ->
          if Meteor.status().connected
            result.continue()
            console.info "Meteor.Files Debugger: Connection established continue() upload" if self.debug
          else
            result.pause()
            console.info "Meteor.Files Debugger: Connection error set upload on pause()" if self.debug

        streams         = 1 if not streams
        totalSentChunks = 0

        {extension, extensionWithDot} = @getExt file.name

        if not file.type
          {ext, mime} = @getMimeType file, {}
          file.type = mime

        fileData =
          size: file.size
          type: file.type
          name: file.name
          ext:  extension
          extension:   extension
          'mime-type': file.type

        file          = _.extend file, fileData
        result.file   = file
        randFileName  = @namingFunction()
        partSize      = Math.ceil file.size / streams
        parts         = []
        uploaded      = 0
        last          = false

        i = 1
        while i <= streams
          parts.push
            from: partSize * (i-1)
            to:   partSize * i
            size: partSize
            part: i
            chunksQty: if @chunkSize < partSize then Math.ceil(partSize / @chunkSize) else 1
          i++

        end = (error, data) ->
          console.timeEnd('insert') if self.debug
          window.removeEventListener "beforeunload", beforeunload, false
          result.progress.set 0
          onUploaded and onUploaded.call self, error, data

        if onBeforeUpload and _.isFunction onBeforeUpload
          isUploadAllowed = onBeforeUpload.call file
          if isUploadAllowed isnt true
            end new Meteor.Error(403, if _.isString(isUploadAllowed) then isUploadAllowed else "onBeforeUpload() returned false"), null
            return false

        if @onBeforeUpload and _.isFunction @onBeforeUpload
          isUploadAllowed = @onBeforeUpload.call file
          if isUploadAllowed isnt true
            end new Meteor.Error(403, if _.isString(isUploadAllowed) then isUploadAllowed else "@onBeforeUpload() returned false"), null
            return false

        upload = (filePart, part, chunksQtyInPart, fileReader) ->
          currentChunk = 1
          first = true
          console.time("insertPart#{part}") if @debug

          fileReader.onload = (chunk) ->
            ++totalSentChunks
            progress = (uploaded / file.size) * 100
            result.progress.set progress
            onProgress and onProgress(progress)

            uploaded   += self.chunkSize
            arrayBuffer = chunk.srcElement or chunk.target
            unitArray   = new Uint8Array arrayBuffer.result
            last        = (part is streams and currentChunk >= chunksQtyInPart)

            if chunksQtyInPart is 1
              Meteor.call self.methodNames.MeteorFileWrite, unitArray, fileData, meta, first, chunksQtyInPart, currentChunk, totalSentChunks, randFileName, part, streams, file.size, (error, data) ->
                return end error if error
                if data.last
                  end error, data
            else
              Meteor.call self.methodNames.MeteorFileWrite, unitArray, fileData, meta, first, chunksQtyInPart, currentChunk, totalSentChunks, randFileName, part, streams, file.size, (error, data)->
                return end error if error
                next = () ->
                  if data.chunk + 1 <= chunksQtyInPart
                    from = currentChunk * self.chunkSize
                    to   = from + self.chunkSize

                    fileReader.readAsArrayBuffer filePart.slice from, to
                    currentChunk = ++data.chunk
                  else if data.last
                    end error, data

                unless result.onPause.get()
                  next.call null
                else
                  result.continueFrom.push next
                  
            first = false

          fileReader.readAsArrayBuffer filePart.slice 0, self.chunkSize unless result.onPause.get()

        for part, i in parts
          fileReader = new FileReader
          upload.call null, file.slice(part.from, part.to), i + 1, part.chunksQty, fileReader

        return result
      else
        console.warn "Meteor.Files: [insert({file: 'file', ..})]: file property is required"
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
    console.info "Meteor.Files Debugger: [remove(#{search})]" if @debug
    check search, Match.Optional Match.OneOf Object, String

    if @checkAccess()
      @srch search
      if Meteor.isClient
        Meteor.call @methodNames.MeteorFileUnlink, rcp(@)
        undefined

      if Meteor.isServer
        files = @collection.find @search
        if files.count() > 0
          files.forEach (file) => @unlink file
        @collection.remove @search
        undefined

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
      _.each file.versions, (version) ->
        fs.remove version.path
    else
      fs.remove file.path

    undefined
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
    console.info "Meteor.Files Debugger: [download(#{http}, #{version})]" if @debug
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
      responseType = if fs.existsSync fileRef.path then '200' else '404'
    else if not fileRef or not _.isObject(fileRef) or not fs.existsSync fileRef.path
      responseType = '404'
    else if @currentFile

      if @downloadCallback
        unless @downloadCallback.call _.extend(http, @getUser(http)), @currentFile
          responseType = '404'

      partiral   = false
      reqRange   = false
      fileStats  = fs.statSync fileRef.path

      fileRef.size = fileStats.size if fileStats.size isnt fileRef.size and not @integrityCheck
      responseType = '400' if fileStats.size isnt fileRef.size and @integrityCheck

      if http.params.query.download and http.params.query.download == 'true'
        dispositionType = 'attachment; '
      else
        dispositionType = 'inline; '

      dispositionName     = "filename=\"#{encodeURI(@currentFile.name)}\"; "
      dispositionEncoding = 'charset=utf-8'

      http.response.setHeader 'Content-Type', fileRef.type
      http.response.setHeader 'Content-Disposition', dispositionType + dispositionName + dispositionEncoding
      http.response.setHeader 'Cache-Control', if (http.params.query.play and http.params.query.play == 'true') then 'public, must-revalidate, post-check=0, pre-check=0' else @cacheControl
      http.response.setHeader 'Accept-Ranges', 'bytes'

      if http.request.headers.range
        partiral = true
        array    = http.request.headers.range.split /bytes=([0-9]*)-([0-9]*)/
        start    = parseInt array[1]
        end      = parseInt array[2]
        if isNaN(end)
          end    = if (start + @chunkSize) < fileRef.size then start + @chunkSize else fileRef.size
        take     = end - start
      else
        start    = 0
        end      = undefined
        take     = @chunkSize

      if partiral or (http.params.query.play and http.params.query.play == 'true')
        reqRange = {start, end}
        if isNaN(start) and not isNaN(end)
          reqRange.start = end - take
          reqRange.end   = end
        if not isNaN(start) and isNaN(end)
          reqRange.start = start
          reqRange.end   = start + take

        reqRange.end = reqRange.end - 1 if ((start + @chunkSize) >= fileRef.size)
        http.response.setHeader 'Pragma', 'public'
        http.response.setHeader 'Expires', -1

        if (@strict and not http.request.headers.range) or reqRange.start >= fileRef.size or reqRange.end > fileRef.size
          responseType = '416'
        else
          responseType = '206'
      else
        responseType = '200'

    streamErrorHandler = (error) ->
      http.response.writeHead 500
      http.response.end error.toString()

    switch responseType
      when '400'
        console.warn "Meteor.Files Debugger: [download(#{http}, #{version})] [400] Content-Length mismatch!: #{fileRef.path}" if @debug
        text = "Content-Length mismatch!"
        http.response.writeHead 400,
          'Cache-Control': 'no-cache'
          'Content-Length': text.length
          'Content-Type':   "text/plain"
        http.response.end text
        break
      when '404'
        console.warn "Meteor.Files Debugger: [download(#{http}, #{version})] [404] File not found: #{if fileRef and fileRef.path then fileRef.path else undefined}" if @debug
        text = "File Not Found :("
        http.response.writeHead 404,
          'Content-Length': text.length
          'Content-Type':   "text/plain"
        http.response.end text
        break
      when '416'
        console.info "Meteor.Files Debugger: [download(#{http}, #{version})] [416] Content-Range is not specified!: #{fileRef.path}" if @debug
        http.response.writeHead 416,
          'Content-Range': "bytes */#{fileRef.size}"
        http.response.end()
        break
      when '200'
        console.info "Meteor.Files Debugger: [download(#{http}, #{version})] [200]: #{fileRef.path}" if @debug
        stream = fs.createReadStream fileRef.path
        stream.on('open', ->
          http.response.writeHead 200
          stream.pipe http.response
        ).on 'error', streamErrorHandler
        break
      when '206'
        console.info "Meteor.Files Debugger: [download(#{http}, #{version})] [206]: #{fileRef.path}" if @debug
        http.response.setHeader 'Content-Range', "bytes #{reqRange.start}-#{reqRange.end}/#{fileRef.size}"
        http.response.setHeader 'Content-Length', if (start + @chunkSize) < fileRef.size then take + 1 else take

        stream = fs.createReadStream fileRef.path, {start: reqRange.start, end: reqRange.end}
        stream.on('open', ->
          http.response.writeHead 206
          stream.pipe http.response
        ).on 'error', streamErrorHandler
        break

    undefined
  else
    undefined

  ###
  @isomorphic
  @function
  @class Meteor.Files
  @name link
  @param {Object}   fileRef - File reference object
  @param {String}   version - [Optional] Version of file you would like to request
  @param {Boolean}  pub     - [Optional] is file located in publicity available folder?
  @description Returns URL to file
  @returns {String}
  ###
  link: (fileRef, version = 'original', pub = false) ->
    console.info "Meteor.Files Debugger: [link()]" if @debug
    if _.isString fileRef
      version = fileRef
      fileRef = undefined
    return undefined if not fileRef and not @currentFile

    if @public
      return formatFleURL fileRef or @currentFile, version, true
    else
      return formatFleURL fileRef or @currentFile, version, false

###
@isomorphic
@function
@name formatFleURL
@param {Object} fileRef - File reference object
@param {String} version - [Optional] Version of file you would like build URL for
@param {Boolean}  pub   - [Optional] is file located in publicity available folder?
@description Returns formatted URL for file
@returns {String}
###
formatFleURL = (fileRef, version = 'original', pub = false) ->
  root = __meteor_runtime_config__.ROOT_URL.replace(/\/+$/, "")

  if fileRef.extension.length > 0
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
    version = if not _.isString version then 'original' else version
    if fileRef._id
      if fileRef._storagePath.indexOf('../web.browser') isnt -1
        return formatFleURL fileRef, version, true
      else
        return formatFleURL fileRef, version, false
    else
      null