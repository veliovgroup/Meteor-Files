Meteor.startup ->
  Template.uploadForm.onCreated ->
    @error          = new ReactiveVar false
    @uploadInstance = new ReactiveVar false

  Template.uploadForm.helpers
    error:            -> Template.instance().error.get()
    uploadInstance:   -> Template.instance().uploadInstance.get()
    estimateBitrate:  -> filesize(@estimateSpeed.get(), {bits: true}) + '/s'
    estimateDuration: -> 
      duration = moment.duration(@estimateTime.get())
      hours    = "#{duration.hours()}"
      hours    = "0" + hours if hours.length <= 1
      minutes  = "#{duration.minutes()}"
      minutes  = "0" + minutes if minutes.length <= 1
      seconds  = "#{duration.seconds()}"
      seconds  = "0" + seconds if seconds.length <= 1
      return "#{hours}:#{minutes}:#{seconds}"

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

      if files.length > 6
        template.error.set "Please select not more than 6 files"
        return

      cleanUploaded = (current) ->
        _uploads = _.clone template.uploadInstance.get()
        if _.isArray _uploads
          _.each _uploads, (upInst, index) ->
            if upInst.file.name is current.file.name
              _uploads.splice index, 1
              if _uploads.length
                template.uploadInstance.set _uploads
              else
                template.uploadInstance.set false
        return

      created_at = +new Date
      uploads = []
      _.each files, (file) ->
        fileUpload = Collections.files.insert
          file: file
          meta: {expireAt: new Date(created_at + _app.storeTTL), created_at, downloads: 0}
          onUploaded: (error, fileObj) ->
            unless error
              # Redirect to uploaded file
              # Only then we upload one file
              Router.go('file', _id: fileObj._id) if uploads.length is 1
            else
              template.error.set error?.reason or error
              Meteor.setTimeout ->
                template.error.set false
              , 5000
            cleanUploaded @
            return
          onAbort: -> cleanUploaded @
          onError: -> cleanUploaded @
          streams: 'dynamic'
          chunkSize: 'dynamic'
          # Set allowWebWorkers to false to disable WebWorkers
          # allowWebWorkers: false

        # Filter failed and aborted uploads
        uploads.push fileUpload if fileUpload.state.get() isnt 'aborted'
      template.uploadInstance.set uploads
      false