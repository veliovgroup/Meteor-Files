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
@property {String}    storagePath     - Storage path on file system
@property {String}    collectionName  - Collection name
@property {String}    downloadRoute   - Server Route used to retrieve files
@property {Object}    schema          - Collection Schema
@property {Number}    chunkSize       - Upload chunk size
@property {Function}  namingFunction  - Function which returns `String`
@property {Boolean}   debug           - Turn on/of debugging and extra logging
@description Create new instance of Meteor.Files
###
class Meteor.Files
  constructor: (@storagePath =  "/assets/app/uploads", @collectionName = 'MeteorUploadFiles', @downloadRoute = '/cdn/storage', @schema, @chunkSize = 272144, @namingFunction = String.rand, @debug = false) ->
    check @storagePath, String
    check @collectionName, String
    check @downloadRoute, String
    check @chunkSize, Number
    check @namingFunction, Function
    check @debug, Boolean

    @storagePath    = @storagePath.replace /\/$/, ""
    @downloadRoute  = @downloadRoute.replace /\/$/, ""
    @collection     = new Mongo.Collection @collectionName

    self          = @
    @currentFile  = null
    @cursor       = null
    @search       = {}
    @cacheControl = 'public, max-age=31536000'

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

      _methods[self.methodNames.MeteorFileWrite] = (file, fileData, meta, first, chunksQty, currentChunk, randFileName) ->
        console.info "Meteor.Files Debugger: [MeteorFileWrite]" if @debug
        # check file, Object
        check fileData, Object
        check meta, Match.Optional Object
        check first, Boolean
        check chunksQty, Number
        check currentChunk, Number
        check randFileName, String

        console.info 'Receive chunk #' + currentChunk + ' of ' + chunksQty + ' chunks, file: ' + fileData.name or fileData.fileName if self.debug

        i = 0
        binary = ''
        while i < file.byteLength
          binary += String.fromCharCode(file.buffer[i])
          i++

        cleanName = (str) ->
          str.replace(/\.\./g, '').replace /\//g, ''

        fileName  = cleanName(fileData.name or fileData.fileName)
        ext       = fileName.split('.').pop()
        path      = "#{self.storagePath}/#{randFileName}.#{ext}"
        result    = 
          name:       fileName
          extension:  ext
          path:       path
          meta:       meta
          type:       fileData.type
          size:       fileData.size
          chunk:      currentChunk
          isVideo:    fileData.type.toLowerCase().indexOf("video") > -1
          isAudio:    fileData.type.toLowerCase().indexOf("audio") > -1
          isImage:    fileData.type.toLowerCase().indexOf("image") > -1
          _prefix:    self._prefix
          _collectionName: self.collectionName
          _storagePath:    self.storagePath
          _downloadRoute:  self.downloadRoute
        
        if first
          fs.outputFileSync path, binary, 'binary'
        else
          fs.appendFileSync path, binary, 'binary'


        if chunksQty - 1 is currentChunk
          delete result.chunk
          result._id = self.collection.insert result
          console.info 'The file ' + fileName + ' (binary) was saved to ' + path if self.debug

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
  @property {File|Object} file             - HTML5 `files` item, like in change event: `e.currentTarget.files[0]`
  @property {Object}      meta             - Additional data as object, use later for search
  @property {Function}    onUploaded       - Callback triggered when upload is finished, with two arguments `error` and `fileRef`
  @property {Function}    onProgress       - Callback triggered when chunk is sent, with only argument `progress`
  @property {Function}    onBeforeUpload   - Callback triggered right before upload is started, with only `FileReader` argument:
                                             context is `File` - so you are able to check for extension, mime-type, size and etc.
                                             return true to continue
                                             return false to abort upload
  @description Upload file to server over DDP
  @url https://developer.mozilla.org/en-US/docs/Web/API/FileReader
  @returns {FileReader}
  ###
  insert: (file, meta, onUploaded, onProgress, onBeforeUpload) ->
    console.info "Meteor.Files Debugger: [insert()]" if @debug
    check meta, Match.Optional Object
    check onUploaded, Match.Optional Function
    check onProgress, Match.Optional Function
    check onBeforeUpload, Match.Optional Function

    window.onbeforeunload = (e) ->
      message = "Upload in progress..."
      if e
        e.returnValue = message
      return message

    fileReader    = new FileReader
    fileData      =
      size: file.size
      type: file.type
      name: file.name
      ext:  file.name.split('.').pop()
      extension: file.name.split('.').pop()

    file = _.extend file, fileData

    console.time('insert') if @debug

    randFileName  = @namingFunction.call null, true
    currentChunk  = 0
    first         = true
    chunksQty     = if @chunkSize < file.size then Math.ceil(file.size / @chunkSize) else 1
    self          = @

    end = (error, data) ->
      console.timeEnd('insert') if self.debug
      window.onbeforeunload = null
      onUploaded and onUploaded.call self, error, data

    if onBeforeUpload
      if not onBeforeUpload.call file, fileReader
        end new Meteor.Error(500, "FORBIDDEN"), null
        return false

    fileReader.onload = (chunk) ->
      onProgress and onProgress((currentChunk / chunksQty) * 100)

      binary      = chunk.srcElement or chunk.target
      arrayBuffer = new Uint8Array binary.result

      if chunksQty is 1
        Meteor.call self.methodNames.MeteorFileWrite, arrayBuffer, fileData, meta, first, chunksQty, currentChunk, randFileName, (error, data) ->
          end error, data
      else
        Meteor.call self.methodNames.MeteorFileWrite, arrayBuffer, fileData, meta, first, chunksQty, currentChunk, randFileName, (error, data)->
          if data.chunk <= chunksQty
            currentChunk = data.chunk + 1
            from         = currentChunk * self.chunkSize
            to           = from + self.chunkSize
            fileReader.readAsArrayBuffer file.slice from, to
          else
            end error, data
      first = false



    if chunksQty is 1
      fileReader.readAsArrayBuffer file
    else
      fileReader.readAsArrayBuffer file.slice 0, @chunkSize
    
    return fileReader

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