`import { Cookies } from 'meteor/ostrio:cookies'`
`import { EventEmitter} from './event-emitter.jsx'`
`import { FilesCollectionCore } from './core.coffee'`
`import { fixJSONParse, fixJSONStringify, formatFleURL } from './lib.coffee'`

isSafari = /^((?!chrome|android).)*safari/i.test navigator.userAgent
NOOP     = -> return

###
@locus Anywhere
@class FilesCollection
@param config           {Object}   - [Both]   Configuration object with next properties:
@param config.debug     {Boolean}  - [Both]   Turn on/of debugging and extra logging
@param config.ddp       {Object}   - [Client] Custom DDP connection. Object returned form `DDP.connect()`
@param config.schema    {Object}   - [Both]   Collection Schema
@param config.public    {Boolean}  - [Both]   Store files in folder accessible for proxy servers, for limits, and more - read docs`
@param config.protected {Function} - [Both]   If `true` - files will be served only to authorized users, if `function()` - you're able to check visitor's permissions in your own way function's context has:
  - `user()`
  - `userId`
@param config.chunkSize      {Number}  - [Both] Upload chunk size, default: 524288 bytes (0,5 Mb)
@param config.downloadRoute  {String}  - [Both]   Server Route used to retrieve files
@param config.collection     {Mongo.Collection} - [Both] Mongo Collection Instance
@param config.collectionName {String}  - [Both]   Collection name
@param config.namingFunction {Function}- [Both]   Function which returns `String`
@param config.onBeforeUpload {Function}- [Both]   Function which executes on server after receiving each chunk and on client right before beginning upload. Function context is `File` - so you are able to check for extension, mime-type, size and etc.
return `true` to continue
return `false` or `String` to abort upload
@param config.allowClientCode  {Boolean}  - [Both]   Allow to run `remove` from client
@param config.onbeforeunloadMessage {String|Function} - [Client] Message shown to user when closing browser's window or tab while upload process is running
@summary Create new instance of FilesCollection
###
class FilesCollection
  __proto__: do -> _.extend EventEmitter.prototype, FilesCollectionCore.prototype
  constructor: (config) ->
    EventEmitter.call @
    {storagePath, @ddp, @collection, @collectionName, @downloadRoute, @schema, @chunkSize, @namingFunction, @debug, @onbeforeunloadMessage, @permissions, @parentDirPermissions, @allowClientCode, @onBeforeUpload, @onInitiateUpload, @integrityCheck, @protected, @public, @strict, @downloadCallback, @cacheControl, @responseHeaders, @throttle, @onAfterUpload, @onAfterRemove, @interceptDownload, @onBeforeRemove, @continueUploadTTL} = config if config

    self        = @
    cookie      = new Cookies()
    @debug     ?= false
    @_debug     = ->
      (console.info || console.log).apply undefined, arguments if self.debug
    @public    ?= false
    @protected ?= false
    @chunkSize ?= 1024*512
    @chunkSize  = Math.floor(@chunkSize / 8) * 8

    if @public and not @downloadRoute
      throw new Meteor.Error 500, "[FilesCollection.#{@collectionName}]: \"downloadRoute\" must be precisely provided on \"public\" collections! Note: \"downloadRoute\" must be equal or be inside of your web/proxy-server (relative) root."

    @collection        ?= new Mongo.Collection @collectionName
    @collection.filesCollection = @
    @collectionName    ?= @collection._name
    check @collectionName, String
    @downloadRoute     ?= '/cdn/storage'
    @downloadRoute      = @downloadRoute.replace /\/$/, ''
    @collectionName    ?= 'MeteorUploadFiles'
    @namingFunction    ?= false
    @onBeforeUpload    ?= false
    @allowClientCode   ?= true
    @ddp               ?= Meteor
    @onInitiateUpload  ?= false
    @interceptDownload ?= false
    storagePath        ?= -> "assets#{nodePath.sep}app#{nodePath.sep}uploads#{nodePath.sep}#{@collectionName}"

    if _.isString storagePath
      @storagePath = -> storagePath
    else
      @storagePath = ->
        sp = storagePath.apply @, arguments
        unless _.isString sp
          throw new Meteor.Error 400, "[FilesCollection.#{self.collectionName}] \"storagePath\" function must return a String!"
        sp = sp.replace /\/$/, ''
        return sp

    @onbeforeunloadMessage ?= 'Upload in a progress... Do you want to abort?'
    delete @strict
    delete @throttle
    delete @permissions
    delete @parentDirPermissions
    delete @cacheControl
    delete @onAfterUpload
    delete @onAfterRemove
    delete @onBeforeRemove
    @onInitiateUpload = false
    delete @integrityCheck
    delete @downloadCallback
    delete @interceptDownload
    delete @continueUploadTTL
    delete @responseHeaders

    setTokenCookie = ->
      Meteor.setTimeout ->
        if (not cookie.has('x_mtok') and Meteor.connection._lastSessionId) or (cookie.has('x_mtok') and (cookie.get('x_mtok') isnt Meteor.connection._lastSessionId))
          cookie.set 'x_mtok', Meteor.connection._lastSessionId, path: '/'
        return
      , 25
      return

    unsetTokenCookie = ->
      cookie.remove('x_mtok', '/') if cookie.has 'x_mtok'
      return

    if Accounts?
      Meteor.startup ->
        setTokenCookie()
        return
      Accounts.onLogin ->
        setTokenCookie()
        return
      Accounts.onLogout ->
        unsetTokenCookie()
        return

    check @onbeforeunloadMessage, Match.OneOf String, Function

    try
      _URL = window.URL || window.webkitURL || window.mozURL || window.msURL || window.oURL || false
      if window?.Worker and window?.Blob and _URL
        @_supportWebWorker = true
        @_webWorkerUrl     = _URL.createObjectURL(new Blob(['!function(a){"use strict";a.onmessage=function(b){var c=b.data.f.slice(b.data.cs*(b.data.cc-1),b.data.cs*b.data.cc);if(b.data.ib===!0)postMessage({bin:c,chunkId:b.data.cc});else{var d;a.FileReader?(d=new FileReader,d.onloadend=function(a){postMessage({bin:(d.result||a.srcElement||a.target).split(",")[1],chunkId:b.data.cc,s:b.data.s})},d.onerror=function(a){throw(a.target||a.srcElement).error},d.readAsDataURL(c)):a.FileReaderSync?(d=new FileReaderSync,postMessage({bin:d.readAsDataURL(c).split(",")[1],chunkId:b.data.cc})):postMessage({bin:null,chunkId:b.data.cc,error:"File API is not supported in WebWorker!"})}}}(this);'], {type: 'application/javascript'}))
      else if window?.Worker
        @_supportWebWorker = true
        @_webWorkerUrl     = Meteor.absoluteUrl 'packages/ostrio_files/worker.min.js'
      else
        @_supportWebWorker = false
    catch e
      self._debug '[FilesCollection] [Check WebWorker Availability] Error:', e
      @_supportWebWorker = false

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
    check @onInitiateUpload, Match.OneOf false, Function
    check @allowClientCode, Boolean
    check @ddp, Match.Any

    if @public and @protected
      throw new Meteor.Error 500, "[FilesCollection.#{@collectionName}]: Files can not be public and protected at the same time!"

    @_checkAccess = (http) ->
      if self.protected
        {user, userId} = self._getUser http

        if _.isFunction self.protected
          if http?.params?._id
            fileRef = self.collection.findOne http.params._id

          result = if http then self.protected.call(_.extend(http, {user, userId}), (fileRef or null)) else self.protected.call {user, userId}, (fileRef or null)
        else
          result = !!userId

        if (http and result is true) or not http
          return true
        else
          rc = if _.isNumber(result) then result else 401
          self._debug '[FilesCollection._checkAccess] WARN: Access denied!'
          if http
            text = 'Access denied!'
            if !http.response.headersSent
              http.response.writeHead rc,
                'Content-Length': text.length
                'Content-Type':   'text/plain'
            if !http.response.finished
              http.response.end text
          return false
      else
        return true

    @_methodNames =
      _Abort:  "_FilesCollectionAbort_#{@collectionName}"
      _Write:  "_FilesCollectionWrite_#{@collectionName}"
      _Start:  "_FilesCollectionStart_#{@collectionName}"
      _Remove: "_FilesCollectionRemove_#{@collectionName}"

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

    if not mime or not _.isString mime
      mime = 'application/octet-stream'
    return mime

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

    if Meteor.userId?()
      result.user = -> return Meteor.user()
      result.userId = Meteor.userId()

    return result

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
    {Object}      ddp            - Custom DDP connection. Object returned form `DDP.connect()`
    {Function}    onUploaded     - Callback triggered when upload is finished, with two arguments `error` and `fileRef`
    {Function}    onStart        - Callback triggered when upload is started after all successful validations, with two arguments `error` (always null) and `fileRef`
    {Function}    onError        - Callback triggered on error in upload and/or FileReader, with two arguments `error` and `fileData`
    {Function}    onProgress     - Callback triggered when chunk is sent, with only argument `progress`
    {Function}    onBeforeUpload - Callback triggered right before upload is started:
        return true to continue
        return false to abort upload
  @param {Boolean} autoStart     - Start upload immediately. If set to false, you need manually call .start() method on returned class. Useful to set EventListeners.
  @summary Upload file to server over DDP or HTTP
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
  insert: (config, autoStart = true) ->
    return (new @_UploadInstance(config, @))[if autoStart then 'start' else 'manual']()

  ###
  @locus Client
  @memberOf FilesCollection
  @name _UploadInstance
  @class UploadInstance
  @summary Internal Class, used in upload
  ###
  _UploadInstance: class UploadInstance
    __proto__: EventEmitter.prototype
    constructor: (@config, @collection) ->
      EventEmitter.call @
      @collection._debug '[FilesCollection] [insert()]'
      self                     = @
      @config.ddp             ?= @collection.ddp
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
        type:            Match.Optional String
        onError:         Match.Optional Function
        onAbort:         Match.Optional Function
        streams:         Match.OneOf 'dynamic', Number
        onStart:         Match.Optional Function
        isBase64:        Match.Optional Boolean
        transport:       Match.OneOf 'http', 'ddp'
        chunkSize:       Match.OneOf 'dynamic', Number
        onUploaded:      Match.Optional Function
        onProgress:      Match.Optional Function
        onBeforeUpload:  Match.Optional Function
        allowWebWorkers: Boolean
        ddp:             Match.Any
      }

      if not @config.fileName and not @config.file.name
        throw new Meteor.Error 400, '"fileName" must me specified for base64 upload!'

      if @config.isBase64 is true
        check @config.file, String
        if !!~@config.file.indexOf('data:')
          @config.file = @config.file.replace 'data:', ''
        if !!~@config.file.indexOf(',')
          _file = @config.file.split ','
          @fileData =
            size: Math.floor (_file[1].replace(/\=/g, '')).length / 4 * 3
            type: _file[0].split(';')[0]
            name: @config.fileName
            meta: @config.meta
          @config.file = _file[1]
        else if not @config.type
          throw new Meteor.Error 400, '"type" must me specified for base64 upload! And represent mime-type of the file'
        else
          @fileData =
            size: Math.floor (@config.file.replace(/\=/g, '')).length / 4 * 3
            type: @config.type
            name: @config.fileName
            meta: @config.meta

      if @config.file
        unless @config.isBase64
          @fileData =
            size: @config.file.size
            type: @config.type or @config.file.type
            name: @config.fileName or @config.file.name
            meta: @config.meta

        if @collection.debug
          console.time('insert ' + @fileData.name)
          console.time('loadFile ' + @fileData.name)

        if @collection._supportWebWorker and @config.allowWebWorkers
          try
            @worker = new Worker @collection._webWorkerUrl
          catch wwError
            @worker = false
            @collection._debug '[FilesCollection] [insert] [create WebWorker]: Can\'t create WebWorker, fallback to MainThread', wwError
        else
          @worker = null

        @startTime     = {}
        @config.debug  = @collection.debug
        @config._debug = @collection._debug
        @currentChunk  = 0
        @transferTime  = 0
        @trackerComp   = null
        @sentChunks    = 0
        @fileLength    = 1
        @EOFsent       = false
        @fileId        = Random.id()
        @FSName        = if @collection.namingFunction then @collection.namingFunction(@fileData) else @fileId
        @pipes         = []

        @fileData = _.extend @fileData, @collection._getExt(self.fileData.name), {mime: @collection._getMimeType(@fileData)}
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
      @collection._debug '[FilesCollection] [UploadInstance] [end]', @fileData.name
      console.timeEnd('insert ' + @fileData.name) if @collection.debug
      @emitEvent '_onEnd'
      @result.emitEvent 'uploaded', [error, data]
      @config.onUploaded and @config.onUploaded.call @result, error, data
      if error
        @collection._debug '[FilesCollection] [insert] [end] Error:', error
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
        fileId:  @fileId
        binData: evt.data.bin
        chunkId: evt.data.chunkId

      if @config.isBase64
        pad = opts.binData.length % 4
        if pad
          p = 0
          while p < pad
            opts.binData += '='
            p++

      @emitEvent 'data', [evt.data.bin]
      if @pipes.length
        for pipeFunc in @pipes
          opts.binData = pipeFunc opts.binData

      if @fileLength is evt.data.chunkId
        console.timeEnd('loadFile ' + @fileData.name) if @collection.debug
        @emitEvent 'readEnd'

      if opts.binData
        if @config.transport is 'ddp'
          @config.ddp.call @collection._methodNames._Write, opts, (error) ->
            self.transferTime += (+new Date) - self.startTime[opts.chunkId]
            if error
              if self.result.state.get() isnt 'aborted'
                self.emitEvent 'end', [error]
            else
              ++self.sentChunks
              if self.sentChunks >= self.fileLength
                self.emitEvent 'sendEOF'
              else if self.currentChunk < self.fileLength
                self.emitEvent 'upload'
              self.emitEvent 'calculateStats'
            return
        else
          HTTP.call 'POST', "#{@collection.downloadRoute}/#{@collection.collectionName}/__upload", {
            content: opts.binData
            headers:
              'x-mtok':       Meteor.connection?._lastSessionId or null
              'x-fileid':     opts.fileId
              'x-chunkid':    opts.chunkId
              'content-type': 'text/plain'
          }, (error) ->
            self.transferTime += (+new Date) - self.startTime[opts.chunkId]
            if error
              if "#{error}" is "Error: network"
                self.result.pause()
              else
                if self.result.state.get() isnt 'aborted'
                  self.emitEvent 'end', [error]
            else
              ++self.sentChunks
              if self.sentChunks >= self.fileLength
                self.emitEvent 'sendEOF'
              else if self.currentChunk < self.fileLength
                self.emitEvent 'upload'
              self.emitEvent 'calculateStats'
            return
      return

    sendEOF: ->
      @collection._debug '[FilesCollection] [UploadInstance] [sendEOF]', @EOFsent
      unless @EOFsent
        @EOFsent = true
        self = @
        opts =
          eof:    true
          fileId: @fileId

        if @config.transport is 'ddp'
          @config.ddp.call @collection._methodNames._Write, opts, ->
            self.emitEvent 'end', arguments
            return
        else
          HTTP.call 'POST', "#{@collection.downloadRoute}/#{@collection.collectionName}/__upload", {
            content: ''
            headers:
              'x-mtok':       Meteor.connection?._lastSessionId or null
              'x-eof':        '1'
              'x-fileId':     opts.fileId
              'content-type': 'text/plain'
          }, (error, _result) ->
            try
              result    = JSON.parse _result?.content or {}
            catch e
              console.warn 'Something went wrong! [sendEOF] method doesn\'t returned JSON! Looks like you\'re on Cordova app or behind proxy, switching to DDP transport is recommended.'
              result    = {}
            result.meta = fixJSONParse result.meta if result?.meta
            self.emitEvent 'end', [error, result]
            return
      return

    proceedChunk: (chunkId) ->
      self  = @
      chunk = @config.file.slice (@config.chunkSize * (chunkId - 1)), (@config.chunkSize * chunkId)

      if @config.isBase64
        self.emitEvent 'sendChunk', [{
          data: {
            bin: chunk
            chunkId: chunkId
          }
        }]
      else
        if FileReader
          fileReader = new FileReader

          fileReader.onloadend = (evt) ->
            self.emitEvent 'sendChunk', [{
              data: {
                bin: (fileReader?.result or evt.srcElement?.result or evt.target?.result).split(',')[1]
                chunkId: chunkId
              }
            }]
            return

          fileReader.onerror = (e) ->
            self.emitEvent 'end', [(e.target or e.srcElement).error]
            return

          fileReader.readAsDataURL chunk

        else if FileReaderSync
          fileReader = new FileReaderSync

          self.emitEvent 'sendChunk', [{
            data: {
              bin: fileReader.readAsDataURL(chunk).split(',')[1]
              chunkId: chunkId
            }
          }]
        else
          self.emitEvent 'end', ['File API is not supported in this Browser!']
      return

    upload: ->
      if @result.onPause.get()
        return

      if @result.state.get() is 'aborted'
        return @

      if @currentChunk <= @fileLength
        ++@currentChunk
        if @worker
          @worker.postMessage({sc: @sentChunks, cc: @currentChunk, cs: @config.chunkSize, f: @config.file, ib: @config.isBase64})
        else
          @emitEvent 'proceedChunk', [@currentChunk]
      else
        @emitEvent 'sendEOF'
      @startTime[@currentChunk] = +new Date
      return

    createStreams: ->
      @collection._debug '[FilesCollection] [UploadInstance] [createStreams]'
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
        @config.chunkSize = @fileData.size / 1000
        if @config.chunkSize < 327680
          @config.chunkSize = 327680
        else if @config.chunkSize > 1048576
          @config.chunkSize = 1048576

        if @config.transport is 'http'
          @config.chunkSize = Math.round @config.chunkSize / 2
        else if isSafari
          @config.chunkSize = Math.ceil @config.chunkSize / 8

      if @config.isBase64
        @config.chunkSize = Math.floor(@config.chunkSize / 4) * 4
        _len = Math.ceil(@config.file.length / @config.chunkSize)
      else
        @config.chunkSize = Math.floor(@config.chunkSize / 8) * 8
        _len = Math.ceil(@fileData.size / @config.chunkSize)

      if @config.streams is 'dynamic'
        @config.streams = _.clone _len
        @config.streams = 24 if @config.streams > 24

        if @config.transport is 'http'
          @config.streams = Math.round @config.streams / 2
        else if isSafari
          @config.streams = 1

      @fileLength               = if _len <= 0 then 1 else _len
      @config.streams           = @fileLength if @config.streams > @fileLength
      @result.config.fileLength = @fileLength

      opts =
        file:       @fileData
        fileId:     @fileId
        chunkSize:  if @config.isBase64 then ((@config.chunkSize  / 4) * 3) else @config.chunkSize
        fileLength: @fileLength
      opts.FSName = @FSName if @FSName isnt @fileId

      handleStart = (error) ->
        if error
          self.collection._debug '[FilesCollection] [_Start] Error:', error
          self.emitEvent 'end', [error]
        else
          self.result.continueFunc = ->
            self.collection._debug '[FilesCollection] [insert] [continueFunc]'
            self.emitEvent 'createStreams'
            return
          self.emitEvent 'createStreams'
        return

      if @config.transport is 'ddp'
        @config.ddp.call @collection._methodNames._Start, opts, handleStart
      else
        opts.file.meta = fixJSONStringify opts.file.meta if opts.file?.meta
        HTTP.call 'POST', "#{@collection.downloadRoute}/#{@collection.collectionName}/__upload", {
          data: opts
          headers:
            'x-start': '1'
            'x-mtok': Meteor.connection?._lastSessionId or null
        }, handleStart
      return

    pipe: (func) ->
      @pipes.push func
      return @

    start: ->
      self = @
      if @fileData.size <= 0
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
        if not self.result.onPause.curValue and not Meteor.status().connected
          self.collection._debug '[FilesCollection] [insert] [Tracker] [pause]'
          self.result.pause()
        return

      if @worker
        @collection._debug '[FilesCollection] [insert] using WebWorkers'
        @worker.onmessage = (evt) ->
          if evt.data.error
            self.collection._debug '[FilesCollection] [insert] [worker] [onmessage] [ERROR:]', evt.data.error
            self.emitEvent 'proceedChunk', [evt.data.chunkId]
          else
            self.emitEvent 'sendChunk', [evt]
          return
        @worker.onerror   = (e) ->
          self.collection._debug '[FilesCollection] [insert] [worker] [onerror] [ERROR:]', e
          self.emitEvent 'end', [e.message]
          return
      else
        @collection._debug '[FilesCollection] [insert] using MainThread'

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

  ###
  @locus Client
  @memberOf FilesCollection
  @name _FileUpload
  @class FileUpload
  @summary Internal Class, instance of this class is returned from `insert()` method
  ###
  _FileUpload: class FileUpload
    __proto__: EventEmitter.prototype
    constructor: (@config) ->
      @config._debug '[FilesCollection] [FileUpload] [constructor]'
      EventEmitter.call @
      self           = @
      unless @config.isBase64
        @file        = _.extend @config.file, @config.fileData
      else
        @file        = @config.fileData
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
      @config._debug '[FilesCollection] [insert] [.pause()]'
      unless @onPause.get()
        @onPause.set true
        @state.set 'paused'
        @emitEvent 'pause', [@file]
      return
    continue: ->
      @config._debug '[FilesCollection] [insert] [.continue()]'
      if @onPause.get()
        @onPause.set false
        @state.set 'active'
        @emitEvent 'continue', [@file]
        @continueFunc()
      return
    toggle: ->
      @config._debug '[FilesCollection] [insert] [.toggle()]'
      if @onPause.get() then @continue() else @pause()
      return
    abort: ->
      @config._debug '[FilesCollection] [insert] [.abort()]'
      window.removeEventListener 'beforeunload', @config.beforeunload, false
      @config.onAbort and @config.onAbort.call @, @file
      @emitEvent 'abort', [@file]
      @pause()
      @config._onEnd()
      @state.set 'aborted'
      console.timeEnd('insert ' + @config.fileData.name) if @config.debug
      @config.ddp.call @config._Abort, @config.fileId
      return

  ###
  @locus Anywhere
  @memberOf FilesCollection
  @name remove
  @param {String|Object} selector - Mongo-Style selector (http://docs.meteor.com/api/collections.html#selectors)
  @param {Function} callback - Callback with one `error` argument
  @summary Remove documents from the collection
  @returns {FilesCollection} Instance
  ###
  remove: (selector = {}, callback) ->
    @_debug "[FilesCollection] [remove(#{JSON.stringify(selector)})]"
    check selector, Match.OneOf Object, String
    check callback, Match.Optional Function

    if @allowClientCode
      @ddp.call @_methodNames._Remove, selector, (callback or NOOP)
    else
      callback and callback new Meteor.Error 401, '[FilesCollection] [remove] Run code from client is not allowed!'
      @_debug '[FilesCollection] [remove] Run code from client is not allowed!'
    
    return @

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
Meteor.startup ->
  if Template?
    Template.registerHelper 'fileURL', (fileRef, version) ->
      return undefined if not fileRef or not _.isObject fileRef
      version = if not version or not _.isString(version) then 'original' else version
      if fileRef._id
        return formatFleURL fileRef, version
      else
        return ''
  return

###
Export the FilesCollection class
###
Meteor.Files = FilesCollection
`export { FilesCollection }`
