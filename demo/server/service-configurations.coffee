_sc = {}
ServiceConfiguration.configurations.remove {}

if process.env['ACCOUNTS_METEOR_ID'] and process.env['ACCOUNTS_METEOR_SEC']
  _sc.meteor = true
  ServiceConfiguration.configurations.upsert
    service: 'meteor-developer'
  ,
    $set:
      secret: process.env['ACCOUNTS_METEOR_SEC']
      clientId: process.env['ACCOUNTS_METEOR_ID']
      loginStyle: 'popup'

if process.env['ACCOUNTS_GITHUB_ID'] and process.env['ACCOUNTS_GITHUB_SEC']
  _sc.github = true
  ServiceConfiguration.configurations.upsert
    service: 'github'
  ,
    $set:
      secret: process.env['ACCOUNTS_GITHUB_SEC']
      clientId: process.env['ACCOUNTS_GITHUB_ID']
      loginStyle: 'popup'

if process.env['ACCOUNTS_TWITTER_ID'] and process.env['ACCOUNTS_TWITTER_SEC']
  _sc.twitter = true
  ServiceConfiguration.configurations.upsert
    service: 'twitter'
  ,
    $set:
      loginStyle: 'popup'
      secret: process.env['ACCOUNTS_TWITTER_SEC']
      consumerKey: process.env['ACCOUNTS_TWITTER_ID'] # consumerKey, really?! F*** this should be in docs

if process.env['ACCOUNTS_FACEBOOK_ID'] and process.env['ACCOUNTS_FACEBOOK_SEC']
  _sc.facebook = true
  ServiceConfiguration.configurations.upsert
    service: 'facebook'
  ,
    $set:
      secret: process.env['ACCOUNTS_FACEBOOK_SEC']
      appId: process.env['ACCOUNTS_FACEBOOK_ID'] # appId, really?! F*** this should be in docs
      loginStyle: 'popup'

Meteor.methods
  'getServiceConfiguration': ->
    return _sc