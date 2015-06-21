if Meteor.isServer
  ###
  @description Require "fs-extra" npm package
  ###
  fs = Npm.require "fs-extra"

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
@param {Object} config - Configuration object with next properties:
  {String}    storagePath     - Storage path on file system
  {String}    collectionName  - Collection name
  {String}    downloadRoute   - Server Route used to retrieve files
  {Object}    schema          - Collection Schema
  {Number}    chunkSize       - Upload chunk size
  {Function}  namingFunction  - Function which returns `String`
  {Boolean}   debug           - Turn on/of debugging and extra logging
  {Boolean}   allowClientCode - Allow to run `remove`, `addVersion`, `removeVersion` from client
  {String|Function} onbeforeunloadMessage - Message shown to user when closing browser's window or tab while upload process is running
@description Create new instance of Meteor.Files
###
class Meteor.Files
  constructor: (config) ->
    {@storagePath, @collectionName, @downloadRoute, @schema, @chunkSize, @namingFunction, @debug, @onbeforeunloadMessage, @permissions, @allowClientCode} = config if config

    @storagePath      = '/assets/app/uploads' if not @storagePath
    @collectionName   = 'MeteorUploadFiles' if not @collectionName
    @downloadRoute    = '/cdn/storage' if not @downloadRoute
    @chunkSize        = 272144 if not @chunkSize
    @namingFunction   = String.rand if not @namingFunction
    @debug            = false if not @debug
    @permissions      = 0o777 if not @permissions
    @allowClientCode  = true if not @allowClientCode
    @onbeforeunloadMessage = 'Upload in a progress... Do you want to abort?' if not @onbeforeunloadMessage

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

    Router.route "#{@downloadRoute}/#{@collectionName}/:_id/:version/:name", ->
      self.findOne(@params._id).download.call @, self, @params.version
    , {where: 'server'}

    @methodNames =
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

      _methods[self.methodNames.MeteorFileWrite] = (unitArray, fileData, meta, first, chunksQty, currentChunk, totalSentChunks, randFileName, part, partsQty, fileSize) ->
        console.info "Meteor.Files Debugger: [MeteorFileWrite]" if self.debug
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

        console.info "Received chunk ##{currentChunk} of #{chunksQty} chunks, in part: #{part}, file: #{fileData.name or fileData.fileName}" if self.debug

        i = 0
        binary = ''
        while i < unitArray.byteLength
          binary += String.fromCharCode unitArray[i]
          i++
        last   = (chunksQty * partsQty <= totalSentChunks)

        cleanName = (str) ->
          str.replace(/\.\./g, '').replace /\//g, ''

        fileName  = cleanName(fileData.name or fileData.fileName)
        ext       = fileName.split('.').pop()
        pathName  = "#{self.storagePath}/#{randFileName}"
        path      = "#{self.storagePath}/#{randFileName}.#{ext}"
        pathPart  = if partsQty > 1 then "#{self.storagePath}/#{randFileName}_#{part}.#{ext}" else path
        result    = 
          name:       fileName
          extension:  ext
          path:       path
          meta:       meta
          type:       fileData.type
          size:       fileData.size
          chunk:      currentChunk
          versions:
            original:
              path: path
              size: fileData.size
              type: fileData.type
              extension: ext
          last:       last
          isVideo:    fileData.type.toLowerCase().indexOf("video") > -1
          isAudio:    fileData.type.toLowerCase().indexOf("audio") > -1
          isImage:    fileData.type.toLowerCase().indexOf("image") > -1
          _prefix:    self._prefix
          _collectionName: self.collectionName
          _storagePath:    self.storagePath
          _downloadRoute:  self.downloadRoute

        
        if first
          fs.outputFileSync pathPart, binary, 'binary'
        else
          fs.appendFileSync pathPart, binary, 'binary'

        if (chunksQty is currentChunk) and self.debug
          console.info "The part ##{part} of file #{fileName} (binary) was saved to #{pathPart}"

        if last
          if partsQty > 1
            buffers = []
            i = 2
            while i <= partsQty
              fs.appendFileSync pathName + '_1.' + ext, fs.readFileSync(pathName + '_' + i + '.' + ext), 'binary'
              fs.unlink pathName + '_' + i + '.' + ext
              i++
            fs.renameSync pathName + '_1.' + ext, path

          fs.chmod path, self.permissions
          result._id = self.collection.insert _.clone result
          console.info "The file #{fileName} (binary) was saved to #{path}" if self.debug
        return result

      Meteor.methods _methods

  srch: (search) ->
    if search and _.isString search
      @search =
        _id: search
    else
      @search = search

  ###
  @server
  @function
  @class Meteor.Files
  @name write
  @param {String} path - Path to file
  @param {String} path - Path to file
  @description Write buffer to FS and add to Meteor.Files Collection
  @returns {Files} - Return this
  ###
  write: if Meteor.isServer then (buffer, opts, callback) ->
    console.info "[write(buffer, #{opts}, callback)]" if @debug
    check opts, Match.Optional Object
    check callback, Match.Optional Function

    randFileName  = @namingFunction.call null, true
    fileName      = if opts.name or opts.fileName then opts.name or opts.fileName else randFileName
    extension     = fileName.split('.').pop()
    path          = "#{@storagePath}/#{randFileName}.#{extension}"

    result        = 
      name:       fileName
      extension:  extension
      path:       path
      meta:       opts.meta
      type:       if opts.type then opts.type else 'application/*'
      size:       if opts.size then opts.size else buffer.length
      isVideo:    if opts.type then opts.type.toLowerCase().indexOf("video") > -1 else false
      isAudio:    if opts.type then opts.type.toLowerCase().indexOf("audio") > -1 else false
      isImage:    if opts.type then opts.type.toLowerCase().indexOf("image") > -1 else false
      _prefix:    @_prefix
      _collectionName: @collectionName
      _storagePath:    @storagePath
      _downloadRoute:  @downloadRoute

    console.info "The file #{fileName} (binary) was added to #{@collectionName}" if @debug

    callback and callback null, result

    if callback
      fs.outputFile path, buffer, 'binary', callback
    else
      fs.outputFileSync path, buffer, 'binary'

    result._id = @collection.insert _.clone result
    return result
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
  # addFile: if Meteor.isServer then (path, opts, callback) ->
  #   console.info "[addFile(#{path})]" if @debug
  #   check path, String
  #   check opts, Match.Optional Object
  #   check callback, Match.Optional Function

  #   try
  #     fs.statSync path
  #     buffer    = fs.readFileSync path
  #     pathParts = path.split '/'
  #     fileName  = pathParts[pathParts.length - 1]
  #     ext       = fileName.split('.').pop()
  #     result    = 
  #       name:       fileName
  #       extension:  ext
  #       path:       path
  #       meta:       opts.meta
  #       type:       if opts.type then opts.type else 'application/*'
  #       size:       if opts.size then opts.size else buffer.length
  #       isVideo:    if opts.type then opts.type.toLowerCase().indexOf("video") > -1 else false
  #       isAudio:    if opts.type then opts.type.toLowerCase().indexOf("audio") > -1 else false
  #       isImage:    if opts.type then opts.type.toLowerCase().indexOf("image") > -1 else false
  #       _prefix:    @_prefix
  #       _collectionName: @collectionName
  #       _storagePath:    path.replace "/#{fileName}", ''
  #       _downloadRoute:  @downloadRoute

  #     result._id = @collection.insert _.clone result
  #     console.info "The file #{fileName} (binary) was added to #{@collectionName}" if @debug

  #     callback and callback null, result
  #     return result

  #   catch error
  #     callback and callback error, undefined
  #     return error
  # else
  #   undefined

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
  ###
  insert: if Meteor.isClient then (config) ->
    console.info "Meteor.Files Debugger: [insert()]" if @debug
    {file, meta, onUploaded, onProgress, onBeforeUpload, streams} = config
    check meta, Match.Optional Object
    check onUploaded, Match.Optional Function
    check onProgress, Match.Optional Function
    check onBeforeUpload, Match.Optional Function
    check streams, Match.Optional Number

    if file
      console.time('insert') if @debug
      self    = @
      result  = 
        onPause: new ReactiveVar false
        continueFrom: []
        pause: () ->
          @onPause.set true
        continue: () ->
          @onPause.set false
          for func in @continueFrom
            func.call null
          @continueFrom = []
        toggle: () ->
          if @onPause.get() then @continue() else @pause()
        progress: new ReactiveVar 0

      Tracker.autorun ->
        if Meteor.status().connected
          result.continue()
          console.info "Meteor.Files Debugger: Connection established continue() upload" if self.debug
        else
          result.pause()
          console.info "Meteor.Files Debugger: Connection error set upload on pause()" if self.debug

      streams         = 1 if not streams
      totalSentChunks = 0

      fileData      =
        size: file.size
        type: file.type
        name: file.name
        ext:  file.name.split('.').pop()
        extension: file.name.split('.').pop()

      file          = _.extend file, fileData
      randFileName  = @namingFunction.call null, true
      partSize      = Math.ceil file.size / streams
      parts         = []
      uploaded      = 0
      last          = false

      window.onbeforeunload = (e) ->
        message = if _.isFunction(self.onbeforeunloadMessage) then self.onbeforeunloadMessage.call(null) else self.onbeforeunloadMessage
        if e
          e.returnValue = message
        return message

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
        window.onbeforeunload = null
        result.progress.set 0
        onUploaded and onUploaded.call self, error, data

      if onBeforeUpload
        chres = onBeforeUpload.call file
        if chres isnt true
          end new Meteor.Error(500, if _.isString(chres) then chres else "onBeforeUpload() returned false"), null
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
              if data.last
                end error, data
          else
            Meteor.call self.methodNames.MeteorFileWrite, unitArray, fileData, meta, first, chunksQtyInPart, currentChunk, totalSentChunks, randFileName, part, streams, file.size, (error, data)->
              if not result.onPause.get()
                if data.chunk + 1 <= chunksQtyInPart
                  from         = currentChunk * self.chunkSize
                  to           = from + self.chunkSize

                  fileReader.readAsArrayBuffer filePart.slice from, to
                  currentChunk = ++data.chunk
                else if data.last
                  end error, data
              else
                result.continueFrom.push () ->
                  if data.chunk + 1 <= chunksQtyInPart
                    from         = currentChunk * self.chunkSize
                    to           = from + self.chunkSize

                    fileReader.readAsArrayBuffer filePart.slice from, to
                    currentChunk = ++data.chunk
                  else if data.last
                    end error, data
          first = false

        fileReader.readAsArrayBuffer filePart.slice 0, self.chunkSize

      for part, i in parts
        part = parts[i]
        fileReader = new FileReader
        upload.call null, file.slice(part.from, part.to), i + 1, part.chunksQty, fileReader
        --i

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
    console.info "Meteor.Files Debugger: [remove(#{search})]" if @debug
    check search, Match.Optional Match.OneOf Object, String

    @srch search
    if Meteor.isClient 
      Meteor.call @methodNames.MeteorFileUnlink, rcp(@)
      undefined

    if Meteor.isServer 
      files = @collection.find @search
      if files.count() > 0
        files.forEach (file) ->
          if file.versions and not _.isEmpty file.versions
            _.each file.versions, (version) ->
              fs.remove version.path
          else
            fs.remove file.path
      @collection.remove @search
      undefined

  ###
  @server
  @function
  @class Meteor.Files
  @name download
  @param {Object|Files} self - Instance of MEteor.Files
  @description Initiates the HTTP response
  @returns {undefined}
  ###
  download: if Meteor.isServer then (self, version = original) ->
    console.info "Meteor.Files Debugger: [download(#{self}, #{version})]" if @debug

    if Meteor.isServer
      resp = @response
      
      if self.currentFile
        fileRef = if not version or version is 'original' then {path: self.currentFile.path, size: self.currentFile.size} else self.currentFile.versions[version]
      else
        fileRef = falset

      unless _.isObject(fileRef) and fs.existsSync fileRef.path
        if self.debug
          console.info "======================|404|======================"
          console.info @request.headers

        resp.writeHead 404,
          "Content-Type": "text/plain"
        resp.write "File Not Found :("
        resp.end()

      else if self.currentFile


        if self.debug
          console.info "======================|Headers for: #{self.currentFile.path}|======================"
          console.info @request.headers

        if @params.query.download and @params.query.download == 'true'
          file = fs.readFileSync fileRef.path
          resp.writeHead 200, 
            'Cache-Control':        self.cacheControl
            'Content-Type':         fileRef.type
            'Content-Encoding':     'binary'
            'Content-Disposition':  "attachment; filename=\"#{encodeURI self.currentFile.name}\"; charset=utf-8"
            'Content-Length':       fileRef.size
          resp.write file
          resp.end()

        else if @params.query.play and @params.query.play == 'true'
          if @request.headers.range
            array = @request.headers.range.split /bytes=([0-9]*)-([0-9]*)/
            start = parseInt array[1]
            end = parseInt array[2]
            result =
              Start: if isNaN(start) then 0 else start
              End: if isNaN(end) then (fileRef.size - 1) else end
            
            if not isNaN(start) and isNaN(end)
              result.Start = start
              result.End = fileRef.size - 1

            if isNaN(start) and not isNaN(end) 
              result.Start = fileRef.size - end
              result.End = fileRef.size - 1

            if result.Start >= fileRef.size or result.End >= fileRef.size
              resp.writeHead 416,
                'Content-Range': "bytes */#{fileRef.size}"
              resp.end()

            else
              stream = fs.createReadStream fileRef.path, {start: result.Start, end: result.End}
              resp.writeHead 206, 
                'Content-Range':        "bytes #{result.Start}-#{result.End}/#{fileRef.size}"
                'Cache-Control':        'no-cache'
                'Content-Type':         fileRef.type
                'Content-Encoding':     'binary'
                'Content-Disposition':  "attachment; filename=\"#{encodeURI(self.currentFile.name)}\"; charset=utf-8"
                'Content-Length':       if result.Start == result.End then 0 else (result.End - result.Start + 1);
                'Accept-Ranges':        'bytes'
              stream.pipe resp

          else
            stream = fs.createReadStream fileRef.path
            resp.writeHead 200, 
              'Content-Range':        "bytes 0-#{fileRef.size}/#{fileRef.size}"
              'Cache-Control':        self.cacheControl
              'Content-Type':         fileRef.type
              'Content-Encoding':     'binary'
              'Content-Disposition':  "attachment; filename=\"#{encodeURI(self.currentFile.name)}\"; charset=utf-8"
              'Content-Length':       fileRef.size
              'Accept-Ranges':        'bytes'
            stream.pipe resp

        else
          stream = fs.createReadStream fileRef.path
          resp.writeHead 200, 
            'Cache-Control':        self.cacheControl
            'Content-Type':         fileRef.type
            'Content-Encoding':     'binary'
            'Content-Disposition':  "attachment; filename=\"#{encodeURI(self.currentFile.name)}\"; charset=utf-8"
            'Content-Length':       fileRef.size
          stream.pipe resp

    else
      new Meteor.Error 500, "Can't [download()] on client!"
  else
    undefined

  ###
  @isomorphic
  @function
  @class Meteor.Files
  @name link
  @param {Object} fileRef - File reference object
  @description Returns link
  @returns {String}
  ###
  link: (fileRef, version = original) ->
    console.info "Meteor.Files Debugger: [link()]" if @debug
    check @currentFile or fileRef, Object
    return if fileRef then "#{fileRef._downloadRoute}/#{fileRef._collectionName}/#{fileRef._id}/#{fileRef._id}.#{fileRef.extension}" else "#{@currentFile._downloadRoute}/#{@currentFile._collectionName}/#{@currentFile._id}/#{version}/#{@currentFile._id}.#{@currentFile.extension}"

if Meteor.isClient
  ###
  @description Get download URL for file by fileRef, even without subscription
  @example {{fileURL fileRef}}
  ###
  Template.registerHelper 'fileURL', (fileRef, version) ->
    version = if not _.isString version then 'original' else version
    if fileRef._id
      return "#{fileRef._downloadRoute}/#{fileRef._collectionName}/#{fileRef._id}/#{version}/#{fileRef._id}.#{fileRef.extension}"
    else
      null