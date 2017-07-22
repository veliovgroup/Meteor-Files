`import fs from 'fs-extra'`
NOOP = -> return

###
@var {Object} bound - Meteor.bindEnvironment (Fiber wrapper)
###
bound   = Meteor.bindEnvironment (callback) -> return callback()
fdCache = {}

###
@private
@locus Server
@class writeStream
@param path      {String} - Path to file on FS
@param maxLength {Number} - Max amount of chunks in stream
@param file      {Object} - fileRef Object
@summary writableStream wrapper class, makes sure chunks is written in given order. Implementation of queue stream.
###
class writeStream
  constructor: (@path, @maxLength, @file, @permissions) ->
    if not @path or not _.isString @path
      return

    self           = @
    @fd            = null
    @writtenChunks = 0
    @ended         = false
    @aborted       = false

    if fdCache[@path] && !fdCache[@path].ended && !fdCache[@path].aborted
      @fd = fdCache[@path].fd
      @writtenChunks = fdCache[@path].writtenChunks
    else
      fs.ensureFile @path, (efError) -> bound ->
        if efError
          throw new Meteor.Error 500, '[FilesCollection] [writeStream] [ensureFile] [Error:]', efError
        else
          fs.open self.path, 'r+', self.permissions, (oError, fd) -> bound ->
            if oError
              throw new Meteor.Error 500, '[FilesCollection] [writeStream] [ensureFile] [open] [Error:]', oError
            else
              self.fd = fd
              fdCache[self.path] = self
            return
        return

  ###
  @memberOf writeStream
  @name write
  @param {Number} num - Chunk position in a stream
  @param {Buffer} chunk - Buffer (chunk binary data)
  @param {Function} callback - Callback
  @summary Write chunk in given order
  @returns {Boolean} - True if chunk is sent to stream, false if chunk is set into queue
  ###
  write: (num, chunk, callback) ->
    if not @aborted and not @ended
      self = @
      if @fd
        fs.write @fd, chunk, 0, chunk.length, (num - 1) * @file.chunkSize, (error, written, buffer) -> bound ->
          callback and callback(error, written, buffer)
          if error
            console.warn '[FilesCollection] [writeStream] [write] [Error:]', error
            self.abort()
          else
            ++self.writtenChunks
          return
      else
        Meteor.setTimeout ->
          self.write num, chunk, callback
          return
        , 25
    return false

  ###
  @memberOf writeStream
  @name end
  @param {Function} callback - Callback
  @summary Finishes writing to writableStream, only after all chunks in queue is written
  @returns {Boolean} - True if stream is fulfilled, false if queue is in progress
  ###
  end: (callback) ->
    if not @aborted and not @ended
      if @writtenChunks is @maxLength
        self = @
        fs.close @fd, -> bound ->
          delete fdCache[@path]
          self.ended = true
          callback and callback(undefined, true)
          return
        return true
      else
        self = @
        fs.stat self.path, (error, stat) -> bound ->
          if not error and stat
            self.writtenChunks = Math.ceil stat.size / self.file.chunkSize

          Meteor.setTimeout ->
            self.end callback
            return
          , 25
    else
      callback and callback(undefined, @ended)
    return false

  ###
  @memberOf writeStream
  @name abort
  @param {Function} callback - Callback
  @summary Aborts writing to writableStream, removes created file
  @returns {Boolean} - True
  ###
  abort: (callback) ->
    @aborted = true
    delete fdCache[@path]
    fs.unlink @path, (callback or NOOP)
    return true

  ###
  @memberOf writeStream
  @name stop
  @summary Stop writing to writableStream
  @returns {Boolean} - True
  ###
  stop: ->
    @aborted = true
    delete fdCache[@path]
    return true

`export { writeStream }`
