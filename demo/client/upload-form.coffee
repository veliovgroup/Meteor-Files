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
            template.error.set error?.reason or error
          template.uploadInstance.set false
        onAbort: ->
          done = true
          template.uploadInstance.set false
        streams: 'dynamic'
        chunkSize: 'dynamic'
        # Set allowWebWorkers to false to disable WebWorkers
        # allowWebWorkers: false
      false