Template.listingRow.onCreated ->
  @showSettings = new ReactiveVar false

Template.listingRow.helpers
  removedIn:    -> moment(@meta.expireAt).fromNow()
  showSettings: -> Template.instance().showSettings.get() is @_id

Template.listingRow.events
  'click [data-remove-file]': (e) ->
    e.stopPropagation()
    e.preventDefault()
    @remove (error) ->
      if error
        console.log error
      return
    return
  'click [data-change-access]': (e) ->
    e.stopPropagation()
    e.preventDefault()
    Meteor.call 'changeAccess', @_id, (error) ->
      if error
        console.log error
      return
    return
  'click [data-change-privacy]': (e) ->
    e.stopPropagation()
    e.preventDefault()
    Meteor.call 'changePrivacy', @_id, (error) ->
      if error
        console.log error
      return
    return
  'click [data-show-file]': (e) ->
    e.preventDefault()
    FlowRouter.go 'file', _id: @_id
    false
  'click [data-show-settings]': (e, template) ->
    e.stopPropagation()
    e.preventDefault()
    template.showSettings.set if template.showSettings.get() is @_id then false else @_id
    false
  'click [data-close-settings]': (e, template) ->
    e.stopPropagation()
    e.preventDefault()
    template.showSettings.set false
    false