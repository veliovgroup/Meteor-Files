bound = Meteor.bindEnvironment (callback) -> return callback()
fs    = Npm.require 'fs-extra'

_app.createThumbnails = (collection, fileRef, cb) ->
  check fileRef, Object
  isLast = false

  finish = (error) -> bound ->
    if error
      console.error "[_app.createThumbnails] [finish]", error
    else
      if isLast
        cb and cb(fileRef)
    return true

  fs.exists fileRef.path, (exists) -> bound ->
    throw Meteor.log.error "File #{fileRef.path} not found in [createThumbnails] Method" if not exists

    image = gm(fileRef.path)

    sizes =
      preview:
        width: 400
      thumbnail40:
        width: 40
        square: true

    image.size (error, features) -> bound ->
      throw new Meteor.Error "[_app.createThumbnails] [_.each sizes]", error if error
      i = 0

      collection.collection.update fileRef._id, {
        $set:
          'meta.width': features.width
          'meta.height': features.height
      }, _app.NOOP

      _.each sizes, (size, name) ->
        path = "#{collection.storagePath}/#{name}-#{fileRef._id}.#{fileRef.extension}"

        copyPaste = ->
          fs.copy fileRef.path, path, (error) -> bound ->
            if error
              console.error "[_app.createThumbnails] [_.each sizes] [fs.copy]", error
            else
              upd = 
                $set: {}
              upd['$set']['versions.' + name] = 
                path: path
                size: fileRef.size
                type: fileRef.type
                extension: fileRef.extension
                meta:
                  width: features.width
                  height: features.height
              collection.collection.update fileRef._id, upd, (error) ->
                ++i
                isLast = true if i is Object.keys(sizes).length
                finish(error)
            return
          return

        if !!~['jpg', 'jpeg', 'png'].indexOf fileRef.extension.toLowerCase()
          img  = gm(fileRef.path).define('filter:support=2').define('jpeg:fancy-upsampling=false').define('jpeg:fancy-upsampling=off').define('png:compression-filter=5').define('png:compression-level=9').define('png:compression-strategy=1').define('png:exclude-chunk=all').noProfile().strip().dither(false).filter('Triangle')
          updateAndSave = (error) -> bound ->
            if error
              console.error "[_app.createThumbnails] [_.each sizes] [img.resize]", error
            else
              fs.stat path, (err, stat) -> bound ->
                gm(path).size (error, imgInfo) -> bound ->
                  if error
                    console.error "[_app.createThumbnails] [_.each sizes] [img.resize] [fs.stat] [gm(path).size]", error
                  else
                    upd = $set: {}
                    upd['$set']['versions.' + name] = 
                      path: path
                      size: stat.size
                      type: fileRef.type
                      extension: fileRef.extension
                      meta:
                        width: imgInfo.width
                        height: imgInfo.height
                    collection.collection.update fileRef._id, upd, (error) ->
                      ++i
                      isLast = true if i is Object.keys(sizes).length
                      finish(error)
                  return
                return
            return

          if not size.square
            if features.width > size.width
              img.resize(size.width).interlace('Line').write path, updateAndSave
            else
              copyPaste()
          else
            x = 0
            y = 0
            widthRatio  = features.width / size.width
            heightRatio = features.height / size.width

            widthNew    = size.width
            heightNew   = size.width

            if heightRatio < widthRatio
              widthNew = (size.width * features.width) / features.height
              x = (widthNew - size.width) / 2

            if heightRatio > widthRatio
              heightNew = (size.width * features.height) / features.width
              y = (heightNew - size.width) / 2

            img.resize(widthNew, heightNew).crop(size.width, size.width, x, y).interlace('Line').write path, updateAndSave
        else
          copyPaste()
        return
  return true