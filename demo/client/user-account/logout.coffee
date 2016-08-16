Template.logout.events
  'click [data-logout]': (e) ->
    e.preventDefault()
    Meteor.logout()
    return
