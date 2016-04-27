Template.file.onCreated ->
  @fetchedText = new ReactiveVar false
  @warning = new ReactiveVar false

Template.file.onRendered ->
  @warning.set false
  @fetchedText.set false

  if @data.isText
    self = @
    Meteor.call 'getTextFile', @data, (error, content) ->
      if error
        if error.reason is 'File too big to show, please download.'
          self.warning.set error.reason
        else
          console.error error
      else
        self.fetchedText.set content

Template.file.helpers
  fetchedText: -> Template.instance().fetchedText.get()
  warning: -> Template.instance().warning.get()
  getCode: -> if @type and !!~@type.indexOf('/') then @type.split('/')[1] else ''