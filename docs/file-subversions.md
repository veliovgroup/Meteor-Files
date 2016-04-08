##### Create and Manage File's subversion

```coffeescript
FilesCollection = new Meteor.Files()

if Meteor.isClient
  'change #upload': (e, template) ->
    _.each e.currentTarget.files, (file) ->
      Collections.FilesCollection.insert 
        file: file
        onUploaded: (error, fileObj) ->
          if error
            alert error.message
            throw Meteor.log.warn "File Upload Error", error
          template.$(e.target).val('')
          template.$(e.currentTarget).val('')

          Meteor.call 'convertVideo', fileObj, () ->
            alert "File \"#{fileObj.name}\" successfully uploaded"

        onProgress: _.throttle (progress) ->
          template.$('input#progress').val progress
        ,
          500

        onBeforeUpload: () ->
          if ['ogg', 'mp4', 'avi', 'webm'].inArray(@ext) and @size < 512 * 1048 * 1048
            true
          else
            "Please upload file in next formats: 'ogg', 'mp4', 'avi', 'webm' with size less than 512 Mb. You have tried to upload file with \"#{@ext}\" extension and with \"#{Math.round((@size/(1024*1024)) * 100) / 100}\" Mb"
        streams: 8

if Meteor.isServer
  ###
  @var {object} bound - Meteor.bindEnvironment aka Fiber wrapper
  ###
  bound = Meteor.bindEnvironment (callback) ->
    return callback()

  ###
  @description Require "fs-extra" npm package
  ###
  fs = Npm.require "fs-extra"

  Meteor.methods
    convertVideo: (fileRef) ->
      check fileRef, Object

      sourceFile = ffmpeg(fileRef.path).noProfile()

      formats =
        ogg: true
        mp4: true
        webm: true

      _.each formats, (convert, format) ->
        file = _.clone sourceFile
        bound ->
          version = file.someHowConvertVideoAndReturnFileData(format)
          upd = 
            $set: {}
          upd['$set']['versions.' + name] = 
            path: version.path
            size: version.size
            type: version.type
            extension: version.extension
          FilesCollection.collection.update fileRef._id, upd
      return true
```