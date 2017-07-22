`import { Cookies } from 'meteor/ostrio:cookies'`
`import { FilesCursor, FileCursor } from './files-cursor.coffee`
`import { fixJSONParse, fixJSONStringify, formatFleURL } from './files-lib.coffee`
NOOP = -> return
EventEmitter = require('./event-emitter.jsx').EventEmitter

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
  __proto__: do -> EventEmitter.prototype
  constructor: (config) ->
    EventEmitter.call @
    {storagePath, @ddp, @collection, @collectionName, @downloadRoute, @schema, @chunkSize, @namingFunction, @debug, @onbeforeunloadMessage, @permissions, @parentDirPermissions, @allowClientCode, @onBeforeUpload, @onInitiateUpload, @integrityCheck, @protected, @public, @strict, @downloadCallback, @cacheControl, @responseHeaders, @throttle, @onAfterUpload, @onAfterRemove, @interceptDownload, @onBeforeRemove, @continueUploadTTL} = config if config

    self        = @
    cookie      = new Cookies()
    @debug     ?= false
    @public    ?= false
    @protected ?= false
    @chunkSize ?= 1024*512
    @chunkSize  = Math.floor(@chunkSize / 8) * 8

    if @public and not @downloadRoute
      throw new Meteor.Error 500, "[FilesCollection.#{@collectionName}]: \"downloadRoute\" must be precisely provided on \"public\" collections! Note: \"downloadRoute\" must be equal or be inside of your web/proxy-server (relative) root."

    @collection        ?= new Mongo.Collection @collectionName
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
      console.warn('[FilesCollection] [Check WebWorker Availability] Error:', e) if self.debug
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
          console.warn '[FilesCollection._checkAccess] WARN: Access denied!' if self.debug
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
    console.info "[FilesCollection] [findOne(#{JSON.stringify(selector)}, #{JSON.stringify(options)})]" if @debug
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
    console.info "[FilesCollection] [find(#{JSON.stringify(selector)}, #{JSON.stringify(options)})]" if @debug
    check selector, Match.Optional Match.OneOf Object, String, Boolean, Number, null
    check options, Match.Optional Object

    selector = {} unless arguments.length
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
      console.info '[FilesCollection] [insert()]' if @collection.debug
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
            console.warn '[FilesCollection] [insert] [create WebWorker]: Can\'t create WebWorker, fallback to MainThread', wwError if @collection.debug
        else
          @worker = null

        @startTime    = {}
        @config.debug = @collection.debug
        @currentChunk = 0
        @transferTime = 0
        @trackerComp  = null
        @sentChunks   = 0
        @fileLength   = 1
        @EOFsent      = false
        @fileId       = Random.id()
        @FSName       = if @collection.namingFunction then @collection.namingFunction(@fileData) else @fileId
        @pipes        = []

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
      console.timeEnd('insert ' + @fileData.name) if @collection.debug
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
          }, (error, result) ->
            try
              result    = JSON.parse result?.content or {}
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
      @startTime[@currentChunk] = +new Date
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
        @config.chunkSize = @fileData.size / 1000
        if @config.chunkSize < 327680
          @config.chunkSize = 327680
        else if @config.chunkSize > 1048576
          @config.chunkSize = 1048576

        if @config.transport is 'http'
          @config.chunkSize = Math.round @config.chunkSize / 2

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
          console.error '[FilesCollection] [_Start] Error:', error if self.collection.debug
          self.emitEvent 'end', [error]
        else
          self.result.continueFunc = ->
            console.info '[FilesCollection] [insert] [continueFunc]' if self.collection.debug
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
            console.warn '[FilesCollection] [insert] [worker] [onmessage] [ERROR:]', evt.data.error if self.collection.debug
            self.emitEvent 'proceedChunk', [evt.data.chunkId]
          else
            self.emitEvent 'sendChunk', [evt]
          return
        @worker.onerror   = (e) ->
          console.error '[FilesCollection] [insert] [worker] [onerror] [ERROR:]', e if self.collection.debug
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
    console.info "[FilesCollection] [remove(#{JSON.stringify(selector)})]" if @debug
    check selector, Match.OneOf Object, String
    check callback, Match.Optional Function

    if @allowClientCode
      @ddp.call @_methodNames._Remove, selector, (callback or NOOP)
    else
      callback and callback new Meteor.Error 401, '[FilesCollection] [remove] Run code from client is not allowed!'
      console.warn '[FilesCollection] [remove] Run code from client is not allowed!' if @debug
    
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
