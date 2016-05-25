Template.uploadForm.onCreated ->
  @error          = new ReactiveVar false
  @uploadInstance = new ReactiveVar false

  @initiateUpload = (event, files, template) ->
    unless files.length
      template.error.set "Please select a file to upload"
      return false

    if files.length > 6
      template.error.set "Please select up to 6 files"
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
      return

    transport = event.currentTarget?.transport?.value or 'ddp'
    ClientStorage.set 'uploadTransport', transport

    created_at = +new Date
    uploads = []
    _.each files, (file) ->
      Collections.files.insert(
        file: file
        meta: 
          expireAt: new Date(created_at + _app.storeTTL)
          created_at: created_at
          downloads: 0
        streams: 'dynamic'
        chunkSize: 'dynamic'
        transport: transport
      ,
        false # Use manual start, so we can attach event listeners
      ).on('end', (error, fileObj) ->
        if not error and files.length is 1
          # Redirect to uploaded file
          # Only then we upload one file
          FlowRouter.go('file', _id: fileObj._id)
        cleanUploaded @
        return
      ).on('abort', ->
        cleanUploaded @
        return
      ).on('error', (error) ->
        template.error.set error?.reason or error
        Meteor.setTimeout ->
          template.error.set false
        , 5000
        cleanUploaded @
        return
      ).on('start', ->
        uploads.push @
        template.uploadInstance.set uploads
        return
      ).start()

Template.uploadForm.helpers
  error:            -> Template.instance().error.get()
  uploadInstance:   -> Template.instance().uploadInstance.get()
  estimateBitrate:  -> filesize(@estimateSpeed.get(), {bits: true}) + '/s'
  uploadTransport:  -> ClientStorage.get 'uploadTransport'
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
  'dragenter #uploadFile, dragstart #uploadFile': (e, template) ->
    $(e.currentTarget).addClass 'file-over'
    return
  'dragleave #uploadFile, dragend #uploadFile': (e, template) ->
    $(e.currentTarget).removeClass 'file-over'
    return
  'dragover #uploadFile': (e, template) ->
    e.preventDefault()
    $(e.currentTarget).addClass 'file-over'
    e.originalEvent.dataTransfer.dropEffect = 'copy'
    return
  'drop #uploadFile': (e, template) ->
    e.preventDefault()
    template.error.set false
    $(e.currentTarget).removeClass 'file-over'
    template.initiateUpload e, e.originalEvent.dataTransfer.files, template
    false
  'change input[name="userfile"]': (e, template) -> template.$('form#uploadFile').submit()
  'submit form#uploadFile': (e, template) ->
    e.preventDefault()
    template.error.set false
    template.initiateUpload e, e.currentTarget.userfile.files, template
    false