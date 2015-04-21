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
@property {Object} obj - Initial object
@description Create object with only needed props
###
rcp = (obj) ->
  o = {
    currentFile:    obj.currentFile
    search:         obj.search
    storagePath:    obj.storagePath
    collectionName: obj.collectionName
    downloadRoute:  obj.downloadRoute
    chunkSize:      obj.chunkSize
    debug:          obj.debug
    _prefix:        obj._prefix
    cacheControl:   obj.cacheControl
  }
  return o

###
@function
@name cp
@property {Object} to   - Destanation
@property {Object} from - Source
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
  return to

###
@class
@namespace Meteor
@name Files
@property {Object} config - Configuration object with next properties:
  {String}    storagePath     - Storage path on file system
  {String}    collectionName  - Collection name
  {String}    downloadRoute   - Server Route used to retrieve files
  {Object}    schema          - Collection Schema
  {Number}    chunkSize       - Upload chunk size
  {Function}  namingFunction  - Function which returns `String`
  {Boolean}   debug           - Turn on/of debugging and extra logging
  {String|Function} onbeforeunloadMessage - Message shown to user when closing browser's window or tab while upload process is running
@description Create new instance of Meteor.Files
###
class Meteor.Files
  constructor: (config) ->
    {@storagePath, @collectionName, @downloadRoute, @schema, @chunkSize, @namingFunction, @debug, @onbeforeunloadMessage} = config

    @storagePath      = '/assets/app/uploads' if not @storagePath
    @collectionName   = 'MeteorUploadFiles' if not @collectionName
    @downloadRoute    = '/cdn/storage' if not @downloadRoute
    @chunkSize        = 272144 if not @chunkSize
    @namingFunction   = String.rand if not @namingFunction
    @debug            = false if not @debug
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

    Router.route "#{@downloadRoute}/#{@collectionName}/:_id/:name", ->
      self.findOne(this.params._id).download.call @, self
    , {where: 'server'}

    @_prefix = SHA256 @collectionName + @storagePath + @downloadRoute
    _insts[@_prefix] = @

    @methodNames =
      MeteorFileWrite:    "MeteorFileWrite#{@_prefix}"
      MeteorFileFind:     "MeteorFileFind#{@_prefix}"
      MeteorFileFindOne:  "MeteorFileFindOne#{@_prefix}"
      MeteorFileUnlink:   "MeteorFileUnlink#{@_prefix}"

    if Meteor.isServer
      _methods = {}

      _methods[self.methodNames.MeteorFileUnlink] = (inst) ->
        console.info "Meteor.Files Debugger: [MeteorFileUnlink]" if @debug
        self.remove.call cp(_insts[inst._prefix], inst), inst.search

      _methods[self.methodNames.MeteorFileWrite] = (unitArray, fileData, meta, first, chunksQty, currentChunk, totalSentChunks, randFileName, part, partsQty, fileSize, permissions) ->
        console.info "Meteor.Files Debugger: [MeteorFileWrite]" if @debug
        check unitArray, Match.OneOf Uint8Array, Object
        check fileData, Object
        check meta, Match.Optional Object
        check first, Boolean
        check chunksQty, Number
        check currentChunk, Number
        check randFileName, String
        check part, Number
        check partsQty, Number
        check fileSize, Number
        check permissions, Number

        console.info "Received chunk ##{currentChunk} of #{chunksQty} chunks, in part: #{part}, file: #{fileData.name or fileData.fileName}" if self.debug

        binary = String.fromCharCode.apply null, unitArray
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
            i = 1
            while i <= partsQty
              buffers.push fs.readFileSync pathName + '_' + i + '.' + ext
              fs.unlink pathName + '_' + i + '.' + ext
              i++

            buffer = new Buffer fileSize 
            fs.outputFileSync path, Buffer.concat(buffers), 'binary'

          fs.chmod path, permissions
          result._id = self.collection.insert _.clone result
          console.info "The file #{fileName} (binary) was saved to #{path}" if self.debug
        return result

      Meteor.methods _methods

  ###
  @isomorphic
  @function
  @class Meteor.Files
  @name findOne
  @property {String|Object} search - `_id` of the file or `Object` like, {prop:'val'}
  @description Load file
  @returns {Files} - Return this
  ###
  findOne: (search) ->
    console.info "Meteor.Files Debugger: [findOne(#{search})]" if @debug
    check search, Match.OneOf Object, String
    if _.isString search
      @search = 
        _id: search
    else
      @search = search

    @currentFile = @collection.findOne @search
    return @

  ###
  @isomorphic
  @function
  @class Meteor.Files
  @name find
  @property {String|Object} search - `_id` of the file or `Object` like, {prop:'val'}
  @description Load file or bunch of files
  @returns {Files} - Return this
  ###
  find: (search) ->
    console.info "Meteor.Files Debugger: [find(#{search})]" if @debug
    check search, Match.OneOf Object, String
    if _.isString search
      @search = 
        _id: search
    else
      @search = search

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
  @client
  @function
  @class Meteor.Files
  @name insert
  @property {Object} config - Configuration object with next properties:
    {File|Object} file           - HTML5 `files` item, like in change event: `e.currentTarget.files[0]`
    {Object}      meta           - Additional data as object, use later for search
    {Number}      streams        - Quantity of parallel upload streams
    {Number}      permissions    - Permissions or access rights in octal, like `0755` or `0777`
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
  insert: (config) ->
    console.info "Meteor.Files Debugger: [insert()]" if @debug
    {file, meta, onUploaded, onProgress, onBeforeUpload, streams, permissions} = config
    check meta, Match.Optional Object
    check onUploaded, Match.Optional Function
    check onProgress, Match.Optional Function
    check onBeforeUpload, Match.Optional Function
    check streams, Match.Optional Number
    check permissions, Match.Optional Number

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


    streams         = 1 if not streams
    permissions     = 0o777 if not permissions
    totalSentChunks = 0

    fileData      =
      size: file.size
      type: file.type
      name: file.name
      ext:  file.name.split('.').pop()
      extension: file.name.split('.').pop()

    file = _.extend file, fileData

    console.time('insert') if @debug

    randFileName  = @namingFunction.call null, true
    self          = @
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
          Meteor.call self.methodNames.MeteorFileWrite, unitArray, fileData, meta, first, chunksQtyInPart, currentChunk, totalSentChunks, randFileName, part, streams, file.size, permissions, (error, data) ->
            if data.last
              end error, data
        else
          Meteor.call self.methodNames.MeteorFileWrite, unitArray, fileData, meta, first, chunksQtyInPart, currentChunk, totalSentChunks, randFileName, part, streams, file.size, permissions, (error, data)->
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

    i = parts.length - 1
    while i >= 0
      Meteor.setTimeout ((parts, i) ->
        return () ->
          part = parts[i]
          fileReader = new FileReader
          upload(file.slice(part.from, part.to), i + 1, part.chunksQty, fileReader)
      )(parts, i)
      ,
        0
      --i

    return result

  ###
  @isomorphic
  @function
  @class Meteor.Files
  @name remove
  @property {String|Object} search - `_id` of the file or `Object` like, {prop:'val'}
  @description Remove file(s) on cursor or find and remove file(s) if search is set
  @returns {undefined}
  ###
  remove: (search) ->
    console.info "Meteor.Files Debugger: [remove(#{search})]" if @debug
    check search, Match.Optional Match.OneOf Object, String
    if search and _.isString search
      @search = 
        _id: search
    else
      @search = search

    if Meteor.isClient 
      Meteor.call @methodNames.MeteorFileUnlink, rcp(@)
      undefined

    if Meteor.isServer 
      files = @collection.find @search
      files.forEach (file) ->
        fs.removeSync file.path
      @collection.remove(@search)
      undefined

  ###
  @server
  @function
  @class Meteor.Files
  @name download
  @property {Object|Files} self - Instance of MEteor.Files
  @description Initiates the HTTP response
  @returns {undefined}
  ###
  download: (self) ->
    console.info "Meteor.Files Debugger: [download()]" if @debug
    check self.currentFile, Object
    if Meteor.isServer
      resp = @response

      if self.debug
        console.info "======================|Headers for: #{self.currentFile.path}|======================"
        console.info @request.headers

      if fs.existsSync self.currentFile.path
        if @params.query.download and @params.query.download == 'true'
          file = fs.readFileSync self.currentFile.path
          resp.writeHead 200, 
            'Cache-Control':        self.cacheControl
            'Content-Type':         self.currentFile.type
            'Content-Encoding':     'binary'
            'Content-Disposition':  'attachment; filename=' + encodeURI self.currentFile.name + '; charset=utf-8'
            'Content-Length':       self.currentFile.size
          resp.write file
          resp.end()

        else if @params.query.play and @params.query.play == 'true'
          if @request.headers.range
            array = @request.headers.range.split /bytes=([0-9]*)-([0-9]*)/
            start = parseInt array[1]
            end = parseInt array[2]
            result =
              Start: if isNaN(start) then 0 else start
              End: if isNaN(end) then (self.currentFile.size - 1) else end
            
            if not isNaN(start) and isNaN(end)
              result.Start = start
              result.End = self.currentFile.size - 1

            if isNaN(start) and not isNaN(end) 
              result.Start = self.currentFile.size - end
              result.End = self.currentFile.size - 1

            if result.Start >= self.currentFile.size or result.End >= self.currentFile.size
              resp.writeHead 416,
                'Content-Range': "bytes */#{self.currentFile.size}"
              resp.end()

            else
              stream = fs.createReadStream self.currentFile.path, {start: result.Start, end: result.End}
              resp.writeHead 206, 
                'Content-Range':        "bytes #{result.Start}-#{result.End}/#{self.currentFile.size}"
                'Cache-Control':        'no-cache'
                'Content-Type':         self.currentFile.type
                'Content-Encoding':     'binary'
                'Content-Disposition':  "attachment; filename=#{encodeURI(self.currentFile.name)}; charset=utf-8"
                'Content-Length':       if result.Start == result.End then 0 else (result.End - result.Start + 1);
                'Accept-Ranges':        'bytes'
              stream.pipe resp

          else
            stream = fs.createReadStream self.currentFile.path
            resp.writeHead 200, 
              'Content-Range':        "bytes 0-#{self.currentFile.size}/#{self.currentFile.size}"
              'Cache-Control':        self.cacheControl
              'Content-Type':         self.currentFile.type
              'Content-Encoding':     'binary'
              'Content-Disposition':  "attachment; filename=#{encodeURI(self.currentFile.name)}; charset=utf-8"
              'Content-Length':       self.currentFile.size
              'Accept-Ranges':        'bytes'
            stream.pipe resp

        else
          stream = fs.createReadStream self.currentFile.path
          resp.writeHead 200, 
            'Cache-Control':        self.cacheControl
            'Content-Type':         self.currentFile.type
            'Content-Encoding':     'binary'
            'Content-Disposition':  "attachment; filename=#{encodeURI(self.currentFile.name)}; charset=utf-8"
            'Content-Length':       self.currentFile.size
          stream.pipe resp

      else
        resp.writeHead 404,
          "Content-Type": "text/plain"
        resp.write "File Not Found :("
        resp.end()

    else
      new Meteor.Error 500, "Can't [download()] on client!"

  ###
  @isomorphic
  @function
  @class Meteor.Files
  @name link
  @description Returns link
  @returns {String}
  ###
  link: () ->
    console.info "Meteor.Files Debugger: [link()]" if @debug
    if @currentFile
      return  "#{@downloadRoute}/#{@currentFile._id}/#{@collectionName}"

if Meteor.isClient
  ###
  @description Get download URL for file by fileRef, even without subscription
  @example {{fileURL fileRef}}
  ###
  Template.registerHelper 'fileURL', (fileRef) ->
    if fileRef._id
      return "#{fileRef._downloadRoute}/#{fileRef._collectionName}/#{fileRef._id}/#{fileRef._id}.#{fileRef.extension}"
    else
      null