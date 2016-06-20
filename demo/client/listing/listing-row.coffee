Template.listingRow.helpers
  removedIn: -> moment(@meta.expireAt).fromNow()

Template.listingRow.events
  'click #remove': (e, template) ->
    e.stopPropagation()
    e.preventDefault()
    Collections.files.remove @_id, (error) ->
      if error
        console.log error
      return
    return
  'click #showFile': (e, template) ->
    e.preventDefault()
    FlowRouter.go 'file', _id: e.currentTarget.dataset.id
    false