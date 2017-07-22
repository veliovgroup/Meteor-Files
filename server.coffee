`import { Cookies } from 'meteor/ostrio:cookies'`
`import { FilesCursor, FileCursor } from './files-cursor.coffee`
`import { writeStream } from './files-write-stream.coffee'`
`import { fixJSONParse, fixJSONStringify, formatFleURL } from './files-lib.coffee`
NOOP = -> return

###
@summary Require NPM packages
###
`import fs       from 'fs-extra'`
`import events   from 'events'`
`import request  from 'request'`
`import Throttle from 'throttle'`
`import fileType from 'file-type'`
`import nodePath from 'path'`

###
@var {Object} bound - Meteor.bindEnvironment (Fiber wrapper)
###
bound = Meteor.bindEnvironment (callback) -> return callback()

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
@param config.responseHeaders {Object|Function} - [Server] Custom response headers, if function is passed, must return Object
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
@param config.onInitiateUpload {Function} - [Server] Function which executes on server right before upload is begin and right after `onBeforeUpload` hook. This hook is fully asynchronous.
@param config.onBeforeRemove {Function} - [Server] Executes before removing file on server, so you can check permissions. Return `true` to allow action and `false` to deny.
@param config.allowClientCode  {Boolean}  - [Both]   Allow to run `remove` from client
@param config.downloadCallback {Function} - [Server] Callback triggered each time file is requested, return truthy value to continue download, or falsy to abort
@param config.interceptDownload {Function} - [Server] Intercept download request, so you can serve file from third-party resource, arguments {http: {request: {...}, response: {...}}, fileRef: {...}}
@summary Create new instance of FilesCollection
###
class FilesCollection
  __proto__: do -> events.EventEmitter.prototype
  constructor: (config) ->
    events.EventEmitter.call @
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
        return nodePath.normalize(sp)

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
    @responseHeaders   ?= (responseCode, fileRef, versionRef) ->
      headers = {}
      switch responseCode
        when '206'
          headers['Pragma']            = 'private'
          headers['Trailer']           = 'expires'
          headers['Transfer-Encoding'] = 'chunked'
        when '400'
          headers['Cache-Control']     = 'no-cache'
        when '416'
          headers['Content-Range']     = "bytes */#{versionRef.size}"

      headers['Connection']    = 'keep-alive'
      headers['Content-Type']  = versionRef.type or 'application/octet-stream'
      headers['Accept-Ranges'] = 'bytes'
      return headers

    if @public and not storagePath
      throw new Meteor.Error 500, "[FilesCollection.#{@collectionName}] \"storagePath\" must be set on \"public\" collections! Note: \"storagePath\" must be equal on be inside of your web/proxy-server (absolute) root."

    console.info('[FilesCollection.storagePath] Set to:', @storagePath({})) if @debug

    fs.mkdirs @storagePath({}), {mode: @parentDirPermissions}, (error) ->
      if error
        throw new Meteor.Error 401, "[FilesCollection.#{self.collectionName}] Path \"#{self.storagePath({})}\" is not writable!", error
      return

    check @strict, Boolean
    check @throttle, Match.OneOf false, Number
    check @permissions, Number
    check @storagePath, Function
    check @cacheControl, String
    check @onAfterRemove, Match.OneOf false, Function
    check @onAfterUpload, Match.OneOf false, Function
    check @integrityCheck, Boolean
    check @onBeforeRemove, Match.OneOf false, Function
    check @downloadCallback, Match.OneOf false, Function
    check @interceptDownload, Match.OneOf false, Function
    check @continueUploadTTL, Number
    check @responseHeaders, Match.OneOf Object, Function

    @_preCollection = new Mongo.Collection '__pre_' + @collectionName
    @_preCollection._ensureIndex {createdAt: 1}, {expireAfterSeconds: @continueUploadTTL, background: true}
    _preCollectionCursor = @_preCollection.find {}, {
      fields:
        _id: 1
        isFinished: 1
    }
    _preCollectionCursor.observe
      changed: (doc) ->
        if doc.isFinished
          console.info "[FilesCollection] [_preCollectionCursor.observe] [changed]: #{doc._id}" if self.debug
          self._preCollection.remove {_id: doc._id}, NOOP
        return
      removed: (doc) ->
        # Free memory after upload is done
        # Or if upload is unfinished
        console.info "[FilesCollection] [_preCollectionCursor.observe] [removed]: #{doc._id}" if self.debug
        if self._currentUploads?[doc._id]
          self._currentUploads[doc._id].stop()
          self._currentUploads[doc._id].end()

          unless doc.isFinished
            console.info "[FilesCollection] [_preCollectionCursor.observe] [removeUnfinishedUpload]: #{doc._id}" if self.debug
            self._currentUploads[doc._id].abort()

          delete self._currentUploads[doc._id]
        return

    @_createStream = (_id, path, opts) ->
      return self._currentUploads[_id] = new writeStream path, opts.fileLength, opts, self.permissions

    # This little function allows to continue upload
    # even after server is restarted (*not on dev-stage*)
    @_continueUpload = (_id) ->
      if self._currentUploads?[_id]?.file
        if not self._currentUploads[_id].aborted and not self._currentUploads[_id].ended
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

    @on '_handleUpload', @_handleUpload
    @on '_finishUpload', @_finishUpload

    WebApp.connectHandlers.use (request, response, next) ->
      if !!~request._parsedUrl.path.indexOf "#{self.downloadRoute}/#{self.collectionName}/__upload"
        if request.method is 'POST'

          handleError = (error) ->
            console.warn "[FilesCollection] [Upload] [HTTP] Exception:", error
            if !response.headersSent
              response.writeHead 500
            if !response.finished
              response.end JSON.stringify {error}
            return

          body = ''
          request.on 'data', (data) -> bound ->
            body += data
            return

          request.on 'end', -> bound ->
            try
              if request.headers['x-mtok'] and Meteor.server.sessions?[request.headers['x-mtok']]
                user = userId: Meteor.server.sessions[request.headers['x-mtok']]?.userId
              else
                user = self._getUser {request, response}

              unless request.headers['x-start'] is '1'
                opts = fileId: request.headers['x-fileid']
                if request.headers['x-eof'] is '1'
                  opts.eof = true
                else
                  if typeof Buffer.from is 'function'
                    try
                      opts.binData = Buffer.from body, 'base64'
                    catch e
                      opts.binData = new Buffer body, 'base64'
                  else
                    opts.binData = new Buffer body, 'base64'
                  opts.chunkId = parseInt request.headers['x-chunkid']

                _continueUpload = self._continueUpload opts.fileId
                unless _continueUpload
                  throw new Meteor.Error 408, 'Can\'t continue upload, session expired. Start upload again.'

                {result, opts}  = self._prepareUpload _.extend(opts, _continueUpload), user.userId, 'HTTP'

                if opts.eof
                  self._handleUpload result, opts, ->
                    if !response.headersSent
                      response.writeHead 200
                    result.file.meta = fixJSONStringify result.file.meta if result?.file?.meta
                    if !response.finished
                      response.end JSON.stringify result
                    return
                  return
                else
                  self.emit '_handleUpload', result, opts, NOOP

                if !response.headersSent
                  response.writeHead 204
                if !response.finished
                  response.end()

              else
                try
                  opts         = JSON.parse body
                catch e
                  console.error 'Can\'t parse incoming JSON from Client on [.insert() | upload], something went wrong!'
                  console.error e
                  opts         = file: {}

                opts.___s      = true
                console.info "[FilesCollection] [File Start HTTP] #{opts.file.name} - #{opts.fileId}" if self.debug
                opts.file.meta = fixJSONParse opts.file.meta if opts?.file?.meta
                {result}       = self._prepareUpload _.clone(opts), user.userId, 'HTTP Start Method'
                if self.collection.findOne result._id
                  throw new Meteor.Error 400, 'Can\'t start upload, data substitution detected!'
                opts._id       = opts.fileId
                opts.createdAt = new Date()
                self._preCollection.insert _.omit(opts, '___s')
                self._createStream result._id, result.path, _.omit(opts, '___s')

                if opts.returnMeta
                  if !response.headersSent
                    response.writeHead 200
                  if !response.finished
                    response.end JSON.stringify {
                      uploadRoute: "#{self.downloadRoute}/#{self.collectionName}/__upload"
                      file: result
                    }
                else
                  if !response.headersSent
                    response.writeHead 204
                  if !response.finished
                    response.end()
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

        cursor = self.find selector
        if cursor.count() > 0
          self.remove selector
          return true
        else
          throw new Meteor.Error 404, 'Cursor is empty, no files is removed'
      else
        throw new Meteor.Error 401, '[FilesCollection] [remove] Run code from client is not allowed!'
      return


    # Method used to receive "first byte" of upload
    # and all file's meta-data, so
    # it won't be transferred with every chunk
    # Basically it prepares everything
    # So user can pause/disconnect and
    # continue upload later, during `continueUploadTTL`
    _methods[self._methodNames._Start] = (opts, returnMeta) ->
      check opts, {
        file:       Object
        fileId:     String
        FSName:     Match.Optional String
        chunkSize:  Number
        fileLength: Number
      }

      check returnMeta, Match.Optional Boolean

      console.info "[FilesCollection] [File Start Method] #{opts.file.name} - #{opts.fileId}" if self.debug
      opts.___s      = true
      {result}       = self._prepareUpload _.clone(opts), @userId, 'DDP Start Method'
      if self.collection.findOne result._id
        throw new Meteor.Error 400, 'Can\'t start upload, data substitution detected!'
      opts._id       = opts.fileId
      opts.createdAt = new Date()
      self._preCollection.insert _.omit(opts, '___s')
      self._createStream result._id, result.path, _.omit(opts, '___s')

      if returnMeta
        return {
          uploadRoute: "#{self.downloadRoute}/#{self.collectionName}/__upload"
          file: result
        }
      else
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

      if opts.binData
        if typeof Buffer.from is 'function'
          try
            opts.binData = Buffer.from opts.binData, 'base64'
          catch e
            opts.binData = new Buffer opts.binData, 'base64'
        else
          opts.binData = new Buffer opts.binData, 'base64'

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

      if self._currentUploads?[_id]
        self._currentUploads[_id].stop()
        self._currentUploads[_id].abort()

      if _continueUpload
        self._preCollection.remove {_id}
        self.remove {_id}
        self.unlink {_id, path: _continueUpload.file.path} if _continueUpload?.file?.path
      return true

    Meteor.methods _methods

  ###
  @locus Server
  @memberOf FilesCollection
  @name _prepareUpload
  @summary Internal method. Used to optimize received data and check upload permission
  @returns {Object}
  ###
  _prepareUpload: (opts, userId, transport) ->
    opts.eof       ?= false
    opts.binData   ?= 'EOF'
    opts.chunkId   ?= -1
    opts.FSName    ?= opts.fileId
    opts.file.meta ?= {}

    console.info "[FilesCollection] [Upload] [#{transport}] Got ##{opts.chunkId}/#{opts.fileLength} chunks, dst: #{opts.file.name or opts.file.fileName}" if @debug

    fileName = @_getFileName opts.file
    {extension, extensionWithDot} = @_getExt fileName

    result           = opts.file
    result.name      = fileName
    result.meta      = opts.file.meta
    result.extension = extension
    result.ext       = extension
    result._id       = opts.fileId
    result.userId    = userId or null
    opts.FSName      = opts.FSName.replace(/([^a-z0-9\-\_]+)/gi, '-')
    result.path      = "#{@storagePath(result)}#{nodePath.sep}#{opts.FSName}#{extensionWithDot}"
    result           = _.extend result, @_dataToSchema result

    if @onBeforeUpload and _.isFunction @onBeforeUpload
      ctx = _.extend {
        file: opts.file
      }, {
        chunkId: opts.chunkId
        userId:  result.userId
        user:    -> if (Meteor.users && result.userId) then Meteor.users.findOne(result.userId) else null
        eof:     opts.eof
      }
      isUploadAllowed = @onBeforeUpload.call ctx, result

      if isUploadAllowed isnt true
        throw new Meteor.Error(403, if _.isString(isUploadAllowed) then isUploadAllowed else '@onBeforeUpload() returned false')
      else
        if opts.___s is true and @onInitiateUpload and _.isFunction @onInitiateUpload
          @onInitiateUpload.call ctx, result
    else if opts.___s is true and @onInitiateUpload and _.isFunction @onInitiateUpload
      ctx = _.extend {
        file: opts.file
      }, {
        chunkId: opts.chunkId
        userId:  result.userId
        user:    -> if (Meteor.users && result.userId) then Meteor.users.findOne(result.userId) else null
        eof:     opts.eof
      }
      @onInitiateUpload.call ctx, result

    return {result, opts}

  ###
  @locus Server
  @memberOf FilesCollection
  @name _finishUpload
  @summary Internal method. Finish upload, close Writable stream, add record to MongoDB and flush used memory
  @returns {undefined}
  ###
  _finishUpload: (result, opts, cb) ->
    console.info "[FilesCollection] [Upload] [finish(ing)Upload] -> #{result.path}" if @debug
    fs.chmod result.path, @permissions, NOOP
    self          = @
    result.type   = @_getMimeType opts.file
    result.public = @public
    @_updateFileTypes result

    @collection.insert _.clone(result), (error, _id) ->
      if error
        cb and cb error
        console.error '[FilesCollection] [Upload] [_finishUpload] Error:', error if self.debug
      else
        self._preCollection.update {_id: opts.fileId}, {$set: {isFinished: true}}
        result._id = _id
        console.info "[FilesCollection] [Upload] [finish(ed)Upload] -> #{result.path}" if self.debug
        self.onAfterUpload and self.onAfterUpload.call self, result
        self.emit 'afterUpload', result
        cb and cb null, result
      return
    return

  ###
  @locus Server
  @memberOf FilesCollection
  @name _handleUpload
  @summary Internal method to handle upload process, pipe incoming data to Writable stream
  @returns {undefined}
  ###
  _handleUpload: (result, opts, cb) ->
    try
      if opts.eof
        self = @
        @_currentUploads[result._id].end -> bound ->
          self.emit '_finishUpload', result, opts, cb
          return
      else
        @_currentUploads[result._id].write opts.chunkId, opts.binData, cb
    catch e
      console.warn "[_handleUpload] [EXCEPTION:]", e if @debug
      cb and cb e
    return

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
    if fileData.path and (not mime or not _.isString mime)
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

    if http
      mtok = null
      if http.request.headers['x-mtok']
        mtok = http.request.headers['x-mtok']
      else
        cookie = http.request.Cookies
        if cookie.has 'x_mtok'
          mtok = cookie.get 'x_mtok'

      if mtok
        userId = Meteor.server.sessions?[mtok]?.userId
        if userId
          result.user   = -> Meteor.users.findOne userId
          result.userId = userId

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
  @locus Server
  @memberOf FilesCollection
  @name write
  @param {Buffer} buffer - Binary File's Buffer
  @param {Object} opts - Object with file-data
  @param {String} opts.name - File name, alias: `fileName`
  @param {String} opts.type - File mime-type
  @param {Object} opts.meta - File additional meta-data
  @param {String} opts.userId - UserId, default *null*
  @param {String} opts.fileId - _id, default *null*
  @param {Function} callback - function(error, fileObj){...}
  @param {Boolean} proceedAfterUpload - Proceed onAfterUpload hook
  @summary Write buffer to FS and add to FilesCollection Collection
  @returns {FilesCollection} Instance
  ###
  write: (buffer, opts = {}, callback, proceedAfterUpload) ->
    console.info '[FilesCollection] [write()]' if @debug

    if _.isFunction opts
      proceedAfterUpload = callback
      callback = opts
      opts     = {}
    else if _.isBoolean callback
      proceedAfterUpload = callback
    else if _.isBoolean opts
      proceedAfterUpload = opts

    check opts, Match.Optional Object
    check callback, Match.Optional Function
    check proceedAfterUpload, Match.Optional Boolean

    fileId   = opts.fileId or Random.id()
    FSName   = if @namingFunction then @namingFunction(opts) else fileId
    fileName = if (opts.name or opts.fileName) then (opts.name or opts.fileName) else FSName

    {extension, extensionWithDot} = @_getExt fileName

    self         = @
    opts        ?= {}
    opts.path    = "#{@storagePath(opts)}#{nodePath.sep}#{FSName}#{extensionWithDot}"
    opts.type    = @_getMimeType opts
    opts.meta   ?= {}
    opts.size   ?= buffer.length

    result = @_dataToSchema
      name:      fileName
      path:      opts.path
      meta:      opts.meta
      type:      opts.type
      size:      opts.size
      userId:    opts.userId
      extension: extension

    result._id = fileId

    stream = fs.createWriteStream opts.path, {flags: 'w', mode: @permissions}
    stream.end buffer, (error) -> bound ->
      if error
        callback and callback error
      else
        self.collection.insert result, (error, _id) ->
          if error
            callback and callback error
            console.warn "[FilesCollection] [write] [insert] Error: #{fileName} -> #{self.collectionName}", error if self.debug
          else
            fileRef = self.collection.findOne _id
            callback and callback null, fileRef
            if proceedAfterUpload is true
              self.onAfterUpload and self.onAfterUpload.call self, fileRef
              self.emit 'afterUpload', fileRef
            console.info "[FilesCollection] [write]: #{fileName} -> #{self.collectionName}" if self.debug
          return
      return
    return @

  ###
  @locus Server
  @memberOf FilesCollection
  @name load
  @param {String} url - URL to file
  @param {Object} opts - Object with file-data
  @param {String} opts.name - File name, alias: `fileName`
  @param {String} opts.type - File mime-type
  @param {Object} opts.meta - File additional meta-data
  @param {String} opts.userId - UserId, default *null*
  @param {String} opts.fileId - _id, default *null*
  @param {Function} callback - function(error, fileObj){...}
  @param {Boolean} proceedAfterUpload - Proceed onAfterUpload hook
  @summary Download file, write stream to FS and add to FilesCollection Collection
  @returns {FilesCollection} Instance
  ###
  load: (url, opts, callback, proceedAfterUpload) ->
    console.info "[FilesCollection] [load(#{url}, #{JSON.stringify(opts)}, callback)]" if @debug

    if _.isFunction opts
      proceedAfterUpload = callback
      callback = opts
      opts     = {}
    else if _.isBoolean callback
      proceedAfterUpload = callback
    else if _.isBoolean opts
      proceedAfterUpload = opts

    check url, String
    check opts, Match.Optional Object
    check callback, Match.Optional Function
    check proceedAfterUpload, Match.Optional Boolean

    self      = @
    opts     ?= {}
    fileId    = opts.fileId or Random.id()
    FSName    = if @namingFunction then @namingFunction(opts) else fileId
    pathParts = url.split('/')
    fileName  = if (opts.name or opts.fileName) then (opts.name or opts.fileName) else pathParts[pathParts.length - 1] or FSName

    {extension, extensionWithDot} = @_getExt fileName
    opts.meta ?= {}
    opts.path  = "#{@storagePath(opts)}#{nodePath.sep}#{FSName}#{extensionWithDot}"

    storeResult = (result, callback) ->
      result._id = fileId

      self.collection.insert result, (error, _id) ->
        if error
          callback and callback error
          console.error "[FilesCollection] [load] [insert] Error: #{fileName} -> #{self.collectionName}", error if self.debug
        else
          fileRef = self.collection.findOne _id
          callback and callback null, fileRef
          if proceedAfterUpload is true
            self.onAfterUpload and self.onAfterUpload.call self, fileRef
            self.emit 'afterUpload', fileRef
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
          userId:    opts.userId
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

  ###
  @locus Server
  @memberOf FilesCollection
  @name addFile
  @param {String} path          - Path to file
  @param {String} opts          - [Optional] Object with file-data
  @param {String} opts.type     - [Optional] File mime-type
  @param {Object} opts.meta     - [Optional] File additional meta-data
  @param {Object} opts.fileName - [Optional] File name, if not specified file name and extension will be taken from path
  @param {String} opts.userId   - [Optional] UserId, default *null*
  @param {Function} callback    - [Optional] function(error, fileObj){...}
  @param {Boolean} proceedAfterUpload - Proceed onAfterUpload hook
  @summary Add file from FS to FilesCollection
  @returns {FilesCollection} Instance
  ###
  addFile: (path, opts, callback, proceedAfterUpload) ->
    console.info "[FilesCollection] [addFile(#{path})]" if @debug

    if _.isFunction opts
      proceedAfterUpload = callback
      callback = opts
      opts     = {}
    else if _.isBoolean callback
      proceedAfterUpload = callback
    else if _.isBoolean opts
      proceedAfterUpload = opts

    throw new Meteor.Error 403, 'Can not run [addFile] on public collection! Just Move file to root of your server, then add record to Collection' if @public
    check path, String
    check opts, Match.Optional Object
    check callback, Match.Optional Function
    check proceedAfterUpload, Match.Optional Boolean

    self = @
    fs.stat path, (error, stats) -> bound ->
      if error
        callback and callback error
      else if stats.isFile()
        opts      ?= {}
        opts.path  = path

        unless opts.fileName
          pathParts     = path.split nodePath.sep
          opts.fileName = pathParts[pathParts.length - 1]

        {extension, extensionWithDot} = self._getExt opts.fileName

        opts.type ?= self._getMimeType opts
        opts.meta ?= {}
        opts.size ?= stats.size

        result = self._dataToSchema
          name:         opts.fileName
          path:         path
          meta:         opts.meta
          type:         opts.type
          size:         opts.size
          userId:       opts.userId
          extension:    extension
          _storagePath: path.replace "#{nodePath.sep}#{opts.fileName}", ''
          fileId:       opts.fileId or null


        self.collection.insert result, (error, _id) ->
          if error
            callback and callback error
            console.warn "[FilesCollection] [addFile] [insert] Error: #{result.name} -> #{self.collectionName}", error if self.debug
          else
            fileRef = self.collection.findOne _id
            callback and callback null, fileRef
            if proceedAfterUpload is true
              self.onAfterUpload and self.onAfterUpload.call self, fileRef
              self.emit 'afterUpload', fileRef
            console.info "[FilesCollection] [addFile]: #{result.name} -> #{self.collectionName}" if self.debug
          return
      else
        callback and callback new Meteor.Error 400, "[FilesCollection] [addFile(#{path})]: File does not exist"
      return

    return @

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

    files = @collection.find selector
    if files.count() > 0
      self = @
      files.forEach (file) ->
        self.unlink file
        return
    else
      callback and callback new Meteor.Error 404, 'Cursor is empty, no files is removed'
      return @

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
  @param {Object} rules
  @see  https://docs.meteor.com/api/collections.html#Mongo-Collection-deny
  @summary link Mongo.Collection deny methods
  @returns {Mongo.Collection} Instance
  ###
  deny: (rules) ->
    @collection.deny rules
    return @collection

  ###
  @locus Server
  @memberOf FilesCollection
  @name allow
  @param {Object} rules
  @see https://docs.meteor.com/api/collections.html#Mongo-Collection-allow
  @summary link Mongo.Collection allow methods
  @returns {Mongo.Collection} Instance
  ###
  allow: (rules) ->
    @collection.allow rules
    return @collection

  ###
  @locus Server
  @memberOf FilesCollection
  @name denyClient
  @see https://docs.meteor.com/api/collections.html#Mongo-Collection-deny
  @summary Shorthands for Mongo.Collection deny method
  @returns {Mongo.Collection} Instance
  ###
  denyClient: ->
    @collection.deny
      insert: -> true
      update: -> true
      remove: -> true
    return @collection

  ###
  @locus Server
  @memberOf FilesCollection
  @name allowClient
  @see https://docs.meteor.com/api/collections.html#Mongo-Collection-allow
  @summary Shorthands for Mongo.Collection allow method
  @returns {Mongo.Collection} Instance
  ###
  allowClient: ->
    @collection.allow
      insert: -> true
      update: -> true
      remove: -> true
    return @collection


  ###
  @locus Server
  @memberOf FilesCollection
  @name unlink
  @param {Object} fileRef - fileObj
  @param {String} version - [Optional] file's version
  @param {Function} callback - [Optional] callback function
  @summary Unlink files and it's versions from FS
  @returns {FilesCollection} Instance
  ###
  unlink: (fileRef, version, callback) ->
    console.info "[FilesCollection] [unlink(#{fileRef._id}, #{version})]" if @debug
    if version
      if fileRef.versions?[version] and fileRef.versions[version]?.path
        fs.unlink fileRef.versions[version].path, (callback or NOOP)
    else
      if fileRef.versions and not _.isEmpty fileRef.versions
        _.each fileRef.versions, (vRef) -> bound ->
          fs.unlink vRef.path, (callback or NOOP)
          return
      else
        fs.unlink fileRef.path, (callback or NOOP)
    return @

  ###
  @locus Server
  @memberOf FilesCollection
  @name _404
  @summary Internal method, used to return 404 error
  @returns {undefined}
  ###
  _404: (http) ->
    console.warn "[FilesCollection] [download(#{http.request.originalUrl})] [_404] File not found" if @debug
    text = 'File Not Found :('

    if !http.response.headersSent
      http.response.writeHead 404,
        'Content-Length': text.length
        'Content-Type':   'text/plain'
    if !http.response.finished
      http.response.end text
    return

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
  download: (http, version = 'original', fileRef) ->
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
  serve: (http, fileRef, vRef, version = 'original', readableStream = null, responseType = '200', force200 = false) ->
    self     = @
    partiral = false
    reqRange = false

    if http.params.query.download and http.params.query.download == 'true'
      dispositionType = 'attachment; '
    else
      dispositionType = 'inline; '

    dispositionName     = "filename=\"#{encodeURI(fileRef.name)}\"; filename*=UTF-8''#{encodeURI(fileRef.name)}; "
    dispositionEncoding = 'charset=UTF-8'

    if !http.response.headersSent
      http.response.setHeader 'Content-Disposition', dispositionType + dispositionName + dispositionEncoding

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

      if self.strict and (reqRange.start >= (vRef.size - 1) or reqRange.end > (vRef.size - 1))
        responseType = '416'
      else
        responseType = '206'
    else
      responseType = '200'

    streamErrorHandler = (error) ->
      console.error "[FilesCollection] [serve(#{vRef.path}, #{version})] [500]", error if self.debug
      if !http.response.finished
        http.response.end error.toString()
      return

    headers = if _.isFunction(self.responseHeaders) then self.responseHeaders(responseType, fileRef, vRef, version) else self.responseHeaders

    unless headers['Cache-Control']
      if !http.response.headersSent
        http.response.setHeader 'Cache-Control', self.cacheControl

    for key, value of headers
      if !http.response.headersSent
        http.response.setHeader key, value

    switch responseType
      when '400'
        console.warn "[FilesCollection] [serve(#{vRef.path}, #{version})] [400] Content-Length mismatch!" if self.debug
        text = 'Content-Length mismatch!'

        if !http.response.headersSent
          http.response.writeHead 400,
            'Content-Type':   'text/plain'
            'Content-Length': text.length
        if !http.response.finished
          http.response.end text
        break
      when '404'
        return self._404 http
        break
      when '416'
        console.warn "[FilesCollection] [serve(#{vRef.path}, #{version})] [416] Content-Range is not specified!" if self.debug
        if !http.response.headersSent
          http.response.writeHead 416
        if !http.response.finished
          http.response.end()
        break
      when '200'
        console.info "[FilesCollection] [serve(#{vRef.path}, #{version})] [200]" if self.debug
        stream = readableStream or fs.createReadStream vRef.path
        if !http.response.headersSent
          http.response.writeHead 200 if readableStream

        http.response.on 'close', ->
          stream.abort?()
          stream.end?()
          return

        http.request.on 'abort', ->
          stream.abort?()
          stream.end?()
          return

        stream.on('open', ->
          if !http.response.headersSent
            http.response.writeHead 200
          return
        ).on('abort', ->
          if !http.response.finished
            http.response.end()
          if !http.request.aborted
            http.request.abort()
          return
        ).on('error', streamErrorHandler
        ).on 'end', ->
          if !http.response.finished
            http.response.end()
          return
        stream.pipe new Throttle {bps: self.throttle, chunksize: self.chunkSize} if self.throttle
        stream.pipe http.response
        break
      when '206'
        console.info "[FilesCollection] [serve(#{vRef.path}, #{version})] [206]" if self.debug
        if !http.response.headersSent
          http.response.setHeader 'Content-Range', "bytes #{reqRange.start}-#{reqRange.end}/#{vRef.size}"
        stream = readableStream or fs.createReadStream vRef.path, {start: reqRange.start, end: reqRange.end}
        if !http.response.headersSent
          http.response.writeHead 206 if readableStream

        http.response.on 'close', ->
          stream.abort?()
          stream.end?()
          return

        http.request.on 'abort', ->
          stream.abort?()
          stream.end?()
          return

        stream.on('open', ->
          if !http.response.headersSent
            http.response.writeHead 206
          return
        ).on('abort', ->
          if !http.response.finished
            http.response.end()
          if !http.request.aborted
            http.request.abort()
          return
        ).on('error', streamErrorHandler
        ).on 'end', ->
          if !http.response.finished
            http.response.end()
          return
        stream.pipe new Throttle {bps: self.throttle, chunksize: self.chunkSize} if self.throttle
        stream.pipe http.response
        break
    return

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
Export the FilesCollection class
###
Meteor.Files = FilesCollection
`export { FilesCollection }`
