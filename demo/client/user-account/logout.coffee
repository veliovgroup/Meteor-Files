Template.logout.events
  'click #logout': (e) ->
    e.preventDefault()
    Meteor.logout()
    return
