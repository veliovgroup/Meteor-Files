###
@private
@locus Anywhere
@class FileCursor
@param _fileRef    {Object} - Mongo-Style selector (http://docs.meteor.com/api/collections.html#selectors)
@param _collection {FilesCollection} - FilesCollection Instance
@summary Internal class, represents each record in `FilesCursor.each()` or document returned from `.findOne()` method
###
class FileCursor
  constructor: (@_fileRef, @_collection) ->
    self = @
    self = _.extend self, @_fileRef

  ###
  @locus Anywhere
  @memberOf FileCursor
  @name remove
  @param callback {Function} - Triggered asynchronously after item is removed or failed to be removed
  @summary Remove document
  @returns {FileCursor}
  ###
  remove: (callback) ->
    @_collection._debug '[FilesCollection] [FileCursor] [remove()]'
    if @_fileRef
      @_collection.remove(@_fileRef._id, callback)
    else
      callback and callback new Meteor.Error 404, 'No such file'
    return @

  ###
  @locus Anywhere
  @memberOf FileCursor
  @name link
  @param version {String} - Name of file's subversion
  @summary Returns downloadable URL to File
  @returns {String}
  ###
  link: (version) ->
    @_collection._debug "[FilesCollection] [FileCursor] [link(#{version})]"
    return if @_fileRef then @_collection.link(@_fileRef, version) else ''

  ###
  @locus Anywhere
  @memberOf FileCursor
  @name get
  @param property {String} - Name of sub-object property
  @summary Returns current document as a plain Object, if `property` is specified - returns value of sub-object property
  @returns {Object|mix}
  ###
  get: (property) ->
    @_collection._debug "[FilesCollection] [FileCursor] [get(#{property})]"
    if property
      return @_fileRef[property]
    else
      return @_fileRef

  ###
  @locus Anywhere
  @memberOf FileCursor
  @name fetch
  @summary Returns document as plain Object in Array
  @returns {[Object]}
  ###
  fetch: ->
    @_collection._debug '[FilesCollection] [FileCursor] [fetch()]'
    return [@_fileRef]

  ###
  @locus Anywhere
  @memberOf FileCursor
  @name with
  @summary Returns reactive version of current FileCursor, useful to use with `{{#with}}...{{/with}}` block template helper
  @returns {[Object]}
  ###
  with: ->
    @_collection._debug '[FilesCollection] [FileCursor] [with()]'
    self = @
    return _.extend self, @_collection.collection.findOne @_fileRef._id

###
@private
@locus Anywhere
@class FilesCursor
@param _selector   {String|Object}   - Mongo-Style selector (http://docs.meteor.com/api/collections.html#selectors)
@param options     {Object}          - Mongo-Style selector Options (http://docs.meteor.com/api/collections.html#selectors)
@param _collection {FilesCollection} - FilesCollection Instance
@summary Implementation of Cursor for FilesCollection
###
class FilesCursor
  constructor: (@_selector = {}, options, @_collection) ->
    @_current = -1
    @cursor   = @_collection.collection.find @_selector, options

  ###
  @locus Anywhere
  @memberOf FilesCursor
  @name get
  @summary Returns all matching document(s) as an Array. Alias of `.fetch()`
  @returns {[Object]}
  ###
  get: ->
    @_collection._debug "[FilesCollection] [FilesCursor] [get()]"
    return @cursor.fetch()

  ###
  @locus Anywhere
  @memberOf FilesCursor
  @name hasNext
  @summary Returns `true` if there is next item available on Cursor
  @returns {Boolean}
  ###
  hasNext: ->
    @_collection._debug '[FilesCollection] [FilesCursor] [hasNext()]'
    return @_current < @cursor.count() - 1

  ###
  @locus Anywhere
  @memberOf FilesCursor
  @name next
  @summary Returns next item on Cursor, if available
  @returns {Object|undefined}
  ###
  next: ->
    @_collection._debug '[FilesCollection] [FilesCursor] [next()]'
    if @hasNext()
      return @cursor.fetch()[++@_current]

  ###
  @locus Anywhere
  @memberOf FilesCursor
  @name hasPrevious
  @summary Returns `true` if there is previous item available on Cursor
  @returns {Boolean}
  ###
  hasPrevious: ->
    @_collection._debug '[FilesCollection] [FilesCursor] [hasPrevious()]'
    return @_current isnt -1

  ###
  @locus Anywhere
  @memberOf FilesCursor
  @name previous
  @summary Returns previous item on Cursor, if available
  @returns {Object|undefined}
  ###
  previous: ->
    @_collection._debug '[FilesCollection] [FilesCursor] [previous()]'
    if @hasPrevious()
      return @cursor.fetch()[--@_current]

  ###
  @locus Anywhere
  @memberOf FilesCursor
  @name fetch
  @summary Returns all matching document(s) as an Array.
  @returns {[Object]}
  ###
  fetch: ->
    @_collection._debug '[FilesCollection] [FilesCursor] [fetch()]'
    return @cursor.fetch()

  ###
  @locus Anywhere
  @memberOf FilesCursor
  @name first
  @summary Returns first item on Cursor, if available
  @returns {Object|undefined}
  ###
  first: ->
    @_collection._debug '[FilesCollection] [FilesCursor] [first()]'
    @_current = 0
    return @fetch()?[@_current]

  ###
  @locus Anywhere
  @memberOf FilesCursor
  @name last
  @summary Returns last item on Cursor, if available
  @returns {Object|undefined}
  ###
  last: ->
    @_collection._debug '[FilesCollection] [FilesCursor] [last()]'
    @_current = @count() - 1
    return @fetch()?[@_current]

  ###
  @locus Anywhere
  @memberOf FilesCursor
  @name count
  @summary Returns the number of documents that match a query
  @returns {Number}
  ###
  count: ->
    @_collection._debug '[FilesCollection] [FilesCursor] [count()]'
    return @cursor.count()

  ###
  @locus Anywhere
  @memberOf FilesCursor
  @name remove
  @param callback {Function} - Triggered asynchronously after item is removed or failed to be removed
  @summary Removes all documents that match a query
  @returns {FilesCursor}
  ###
  remove: (callback) ->
    @_collection._debug '[FilesCollection] [FilesCursor] [remove()]'
    @_collection.remove @_selector, callback
    return @

  ###
  @locus Anywhere
  @memberOf FilesCursor
  @name forEach
  @param callback {Function} - Function to call. It will be called with three arguments: the `file`, a 0-based index, and cursor itself
  @param context {Object} - An object which will be the value of `this` inside `callback`
  @summary Call `callback` once for each matching document, sequentially and synchronously.
  @returns {undefined}
  ###
  forEach: (callback, context = {}) ->
    @_collection._debug '[FilesCollection] [FilesCursor] [forEach()]'
    @cursor.forEach callback, context
    return

  ###
  @locus Anywhere
  @memberOf FilesCursor
  @name each
  @summary Returns an Array of FileCursor made for each document on current cursor
           Useful when using in {{#each FilesCursor#each}}...{{/each}} block template helper
  @returns {[FileCursor]}
  ###
  each: ->
    self = @
    return @map (file) ->
      return new FileCursor file, self._collection

  ###
  @locus Anywhere
  @memberOf FilesCursor
  @name map
  @param callback {Function} - Function to call. It will be called with three arguments: the `file`, a 0-based index, and cursor itself
  @param context {Object} - An object which will be the value of `this` inside `callback`
  @summary Map `callback` over all matching documents. Returns an Array.
  @returns {Array}
  ###
  map: (callback, context = {}) ->
    @_collection._debug '[FilesCollection] [FilesCursor] [map()]'
    return @cursor.map callback, context

  ###
  @locus Anywhere
  @memberOf FilesCursor
  @name current
  @summary Returns current item on Cursor, if available
  @returns {Object|undefined}
  ###
  current: ->
    @_collection._debug '[FilesCollection] [FilesCursor] [current()]'
    @_current = 0 if @_current < 0
    return @fetch()[@_current]

  ###
  @locus Anywhere
  @memberOf FilesCursor
  @name observe
  @param callbacks {Object} - Functions to call to deliver the result set as it changes
  @summary Watch a query. Receive callbacks as the result set changes.
  @url http://docs.meteor.com/api/collections.html#Mongo-Cursor-observe
  @returns {Object} - live query handle
  ###
  observe: (callbacks) ->
    @_collection._debug '[FilesCollection] [FilesCursor] [observe()]'
    return @cursor.observe callbacks

  ###
  @locus Anywhere
  @memberOf FilesCursor
  @name observeChanges
  @param callbacks {Object} - Functions to call to deliver the result set as it changes
  @summary Watch a query. Receive callbacks as the result set changes. Only the differences between the old and new documents are passed to the callbacks.
  @url http://docs.meteor.com/api/collections.html#Mongo-Cursor-observeChanges
  @returns {Object} - live query handle
  ###
  observeChanges: (callbacks) ->
    @_collection._debug '[FilesCollection] [FilesCursor] [observeChanges()]'
    return @cursor.observeChanges callbacks

`export { FilesCursor, FileCursor }`