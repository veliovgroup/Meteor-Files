fs = Npm.require 'fs'

Meteor.methods
  getTextFile: (fileRef) ->
    check fileRef, Object
    text = false
    if fileRef.size < 1024 * 64
      try
        text = fs.readFileSync fileRef.path, {encoding: 'utf8'}
      catch error
        console.error "[getTextFile] Error happens", error
    else
      throw new Meteor.Error 500, 'File too big to show, please download.'
    return text