Template.uploadRow.helpers
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

Template.uploadRow.events
  'click [data-toggle-upload]': (e, template) ->
    e.preventDefault()
    @toggle()
    false