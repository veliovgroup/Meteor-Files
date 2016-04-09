Meteor.startup ->
  Template.uploadForm.onCreated ->
    @error          = new ReactiveVar false
    @uploadInstance = new ReactiveVar false

  Template.uploadForm.helpers
    error:         -> Template.instance().error.get()
    uploadInstance:-> Template.instance().uploadInstance.get()

  Template.uploadForm.events
    'click #pause':    -> @pause()
    'click #abort':    -> @abort()
    'click #continue': -> @continue()
    'change input[name="userfile"]': (e, template) -> template.$('form#uploadFile').submit()
    'submit form#uploadFile': (e, template) ->
      e.preventDefault()
      template.error.set false
      files = e.currentTarget.userfile.files

      unless files.length
        template.error.set "Please select a file to upload"
        return false

      done = false
      created_at = +new Date
      template.uploadInstance.set Collections.files.insert 
        file: files[0]
        meta: {expireAt: new Date(created_at + _app.storeTTL), created_at, downloads: 0}
        onUploaded: (error, fileObj) ->
          done = true
          unless error
            Router.go 'file', _id: fileObj._id
          else
            template.error.set error.reason
          template.uploadInstance.set false
        FileReadProgress: (p) -> 
          $('.progress-bar').addClass 'preload'
          if p >= 100
            @progress.set 0
          else
            @progress.set p
        onReady: ->
          @progress.set 0
          Meteor.setTimeout ->
            $('.progress-bar').removeClass 'preload'
          , 250
        onAbort: ->
          done = true
          template.uploadInstance.set false
        onBeforeUpload: -> if @file.size <= 100000 * 10 * 128 then true else "Max. file size is 128MB you've tried to upload #{filesize(@file.size)}"
        streams: 'dynamic'
        chunkSize: 'dynamic'
      false