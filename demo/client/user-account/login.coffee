Template.login.onCreated ->
  self = @
  @serviceConfiguration = new ReactiveVar {}
  Meteor.call 'getServiceConfiguration', (error, serviceConfiguration) ->
    if error
      console.error error
    else
      self.serviceConfiguration.set serviceConfiguration
    return
  return

Template.login.helpers
  serviceConfiguration: -> Template.instance().serviceConfiguration.get()

Template.login.events
  'click #logout': (e) ->
    e.preventDefault()
    Meteor.logout()
    return
  'click #withMeteor': (e) ->
    e.preventDefault()
    Meteor.loginWithMeteorDeveloperAccount()
    return
  'click #withGitHub': (e) ->
    e.preventDefault()
    Meteor.loginWithGithub()
    return
  'click #withTwitter': (e) ->
    e.preventDefault()
    Meteor.loginWithTwitter({}) # Won't work without argument
    return
  'click #withFacebook': (e) ->
    e.preventDefault()
    Meteor.loginWithFacebook({}) # Whoot?! Docs?
    return