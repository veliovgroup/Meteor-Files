##### FilesCursor [*Anywhere*]

Implementation of Cursor for FilesCollection. Returned from `FilesCollection#find()`.

```js
var Images = new FilesCollection();
var cursor = Images.find(); // <-- Returns FilesCursor Instance
```

##### Methods:
 - `get()` - {*[Object]*} - Returns all matching document(s) as an Array. Alias of `.fetch()`
 - `hasNext()`- {*Boolean*} - Returns `true` if there is next item available on Cursor
 - `next()` - {*Object*|*undefined*} - Returns next available object on Cursor
 - `hasPrevious()` - {*Boolean*} - Returns `true` if there is previous item available on Cursor
 - `previous()` - {*Object*|*undefined*} - Returns previous object on Cursor
 - `fetch()` - {*[Object]*} - Returns all matching document(s) as an Array
 - `first()` - {*Object*|*undefined*} - Returns first item on Cursor, if available
 - `last()` - {*Object*|*undefined*} - Returns last item on Cursor, if available
 - `count()` - {*Number*} - Returns the number of documents that match a query
 - `remove(callback)` - {*undefined*} - Removes all documents that match a query. Callback has `error` argument
 - `forEach(callback, context)` - {*undefined*} - Call `callback` once for each matching document, sequentially and synchronously. 
   * `callback` - {*Function*} - Function to call. It will be called with three arguments: the `file`, a 0-based index, and cursor itself
   * `context` - {*Object*} - An object which will be the value of `this` inside `callback`
 - `each()` - {*[FileCursor]*} - Returns an Array of `FileCursor` made for each document on current Cursor. Useful when using in `{{#each FilesCursor#each}}...{{/each}}` block template helper
 - `map(callback, context)` - {*Array*} - Map `callback` over all matching documents. Returns an Array
   * `callback` - {*Function*} - Function to call. It will be called with three arguments: the `file`, a 0-based index, and cursor itself
   * `context` - {*Object*} - An object which will be the value of `this` inside `callback`
 - `current()` - {*Object*|*undefined*} - Returns current item on Cursor, if available
 - `observe(callbacks)` - {*Object*} - Functions to call to deliver the result set as it changes. Watch a query. Receive callbacks as the result set changes. Read more [here](http://docs.meteor.com/api/collections.html#Mongo-Cursor-observe)
 - `observeChanges(callbacks)` - {*Object*} - Watch a query. Receive callbacks as the result set changes. Only the differences between the old and new documents are passed to the callbacks.. Read more [here](http://docs.meteor.com/api/collections.html#Mongo-Cursor-observeChanges)