FlowRouter.route '/',
  name: 'index'
  action: (params, queryParams) ->
    @render '_layout', 'index'
    return
  waitOn: (params) -> [_app.subs.subscribe('latest', 10, _app.userOnly.get())]
  whileWaiting: ->
    @render '_layout', '_loading'
    return

FlowRouter.route '/login',
  name: 'login'
  title: -> if Meteor.userId() then 'Your account settings' else 'Login into Meteor Files'
  meta:
    keywords: 
      name: 'keywords'
      itemprop: 'keywords'
      content: 'private, unlisted, files, upload, meteor, open source, javascript'
    description:
      name: 'description'
      itemprop: 'description'
      property: 'og:description'
      content: 'Login into Meteor files. After you logged in you can make files private and unlisted'
    'twitter:description': 'Login into Meteor files. After you logged in you can make files private and unlisted'
  action: ->
    @render '_layout', 'login'
    return

FlowRouter.route '/:_id',
  name: 'file'
  title: (params, queryParams, file) ->
    if file
      return "View File: #{file.get('name')}"
    else
      return '404: Page not found'
  meta: (params, queryParams, file) ->
    keywords: 
      name: 'keywords'
      itemprop: 'keywords'
      content: if file then "file, view, preview, uploaded, shared, #{file.get('name')}, #{file.get('extension')}, #{file.get('type')}, meteor, open source, javascript" else '404, page, not found'
    description:
      name: 'description'
      itemprop: 'description'
      property: 'og:description'
      content: if file then "View uploaded and shared file: #{file.get('name')}" else '404: No such page'
    'twitter:description': if file then "View uploaded and shared file: #{file.get('name')}" else '404: No such page'
    'og:image':
      property: 'og:image'
      content: if file and file.get('isImage') then file.link('preview') else Meteor.absoluteUrl 'icon_1200x630.png'
    'twitter:image':
      name: 'twitter:image'
      content: if file and file.get('isImage') then file.link('preview') else Meteor.absoluteUrl 'icon_750x560.png'
  action: (params, queryParams, file) ->
    @render '_layout', 'file', {file}
    return
  waitOn: (params) -> [_app.subs.subscribe('file', params._id)]
  whileWaiting: ->
    @render '_layout', '_loading'
    return
  onNoData: ->
    @render '_layout', '_404'
    return
  data: (params) -> 
    file = Collections.files.findOne params._id
    if file
      return file
    else
      return false