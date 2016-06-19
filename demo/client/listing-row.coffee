Template.listingRow.helpers
  removedIn: -> moment(@meta.expireAt).fromNow()

Template.listingRow.events
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