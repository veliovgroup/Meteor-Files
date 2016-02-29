Router.map ->
  @route 'index',
    template: 'index'
    path: '/'
    waitOn: -> _app.subs.subscribe 'latest', 50

  @route 'file',
    template: 'file'
    path: '/:_id'
    waitOn: -> _app.subs.subscribe 'file', @params._id
    data: -> Collections.files.collection.findOne @params._id
    title: -> 
      file = @data()
      return "View File: #{file.name}" if @params._id and file