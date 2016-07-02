Template.accounts.helpers
  userOnly: -> _app.userOnly.get()

Template.accounts.events
  'click [data-show-user-only]': (e) ->
    e.preventDefault()
    _app.userOnly.set !_app.userOnly.get()
    return