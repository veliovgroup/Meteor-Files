Template.index.onCreated ->
  self            = @
  @take           = new ReactiveVar 10
  @filesLength    = new ReactiveVar 0
  @getFilesLenght = ->
    Meteor.call 'filesLenght', (error, length) ->
      if error
        console.error error
      else
        self.filesLength.set length
      return
    return
  @getFilesLenght()

  @autorun -> 
    _app.subs.subscribe 'latest', self.take.get()
    return

Template.index.helpers
  take:             -> Template.instance().take.get()
  uploads:          -> _app.uploads.get()
  removedIn:        -> moment(@meta.expireAt).fromNow()
  filesLength:      -> Template.instance().filesLength.get()
  estimateBitrate:  -> filesize(@estimateSpeed.get(), {bits: true}) + '/s'
  getProgressClass: ->
    progress = @progress.get()
    progress = Math.ceil(progress / 5) * 5
    progress = 100 if progress > 100
    return progress
  estimateDuration: ->
    duration = moment.duration(@estimateTime.get())
    hours    = "#{duration.hours()}"
    hours    = "0" + hours if hours.length <= 1
    minutes  = "#{duration.minutes()}"
    minutes  = "0" + minutes if minutes.length <= 1
    seconds  = "#{duration.seconds()}"
    seconds  = "0" + seconds if seconds.length <= 1
    return "#{hours}:#{minutes}:#{seconds}"

Template.index.events
  'click #loadMore': (e, template) ->
    template.take.set template.take.get() + 10
    return
  # Remove example, won't work with allowClientCode: false
  'click #remove': (e, template) ->
    Collections.files.remove @_id, (error) ->
      if error
        console.log error
      else
        template.getFilesLenght()
      return
    return
  'click #showFile': (e, template) ->
    e.preventDefault()
    FlowRouter.go 'file', _id: e.currentTarget.dataset.id
    false
  'click #pause':    (e, template) ->
    e.preventDefault()
    @pause()
    false
  'click #continue': (e, template) ->
    e.preventDefault()
    @continue()
    false