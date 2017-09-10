###
@var {Function} fixJSONParse - Fix issue with Date parse
###
fixJSONParse = (obj) ->
  for key, value of obj
    if _.isString(value) and !!~value.indexOf '=--JSON-DATE--='
      value = value.replace '=--JSON-DATE--=', ''
      obj[key] = new Date parseInt value
    else if _.isObject value
      obj[key] = fixJSONParse value
    else if _.isArray value
      for v, i in value
        if _.isObject(v)
          obj[key][i] = fixJSONParse v
        else if _.isString(v) and !!~v.indexOf '=--JSON-DATE--='
          v = v.replace '=--JSON-DATE--=', ''
          obj[key][i] = new Date parseInt v
  return obj

###
@var {Function} fixJSONStringify - Fix issue with Date stringify
###
fixJSONStringify = (obj) ->
  for key, value of obj
    if _.isDate value
      obj[key] = '=--JSON-DATE--=' + (+value)
    else if _.isObject value
      obj[key] = fixJSONStringify value
    else if _.isArray value
      for v, i in value
        if _.isObject(v)
          obj[key][i] = fixJSONStringify v
        else if _.isDate v
          obj[key][i] = '=--JSON-DATE--=' + (+v)
  return obj

###
@locus Anywhere
@private
@name formatFleURL
@param {Object} fileRef - File reference object
@param {String} version - [Optional] Version of file you would like build URL for
@summary Returns formatted URL for file
@returns {String} Downloadable link
###
formatFleURL = (fileRef, version = 'original') ->
  check fileRef, Object
  check version, String

  root = __meteor_runtime_config__.ROOT_URL.replace(/\/+$/, '')
  vRef = ((fileRef.versions and fileRef.versions[version]) or fileRef)

  if vRef.extension?.length
    ext = '.' + vRef.extension.replace(/^\./, '')
  else
    ext = ''

  if fileRef.public is true
    return root + (if version is 'original' then "#{fileRef._downloadRoute}/#{fileRef._id}#{ext}" else "#{fileRef._downloadRoute}/#{version}-#{fileRef._id}#{ext}")
  else
    return root + "#{fileRef._downloadRoute}/#{fileRef._collectionName}/#{fileRef._id}/#{version}/#{fileRef._id}#{ext}"

`export { fixJSONParse, fixJSONStringify, formatFleURL }`