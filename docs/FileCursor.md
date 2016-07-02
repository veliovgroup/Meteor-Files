##### FileCursor [*Anywhere*]

FileCursor Class represents each record in `FilesCursor#each()` or document returned from `FilesCollection#findOne()` method.
All document's original properties is available directly by name, like: `FileCursor#propertyName`

```js
var Images = new FilesCollection();
var cursor = Images.findOne(); // <-- Returns FileCursor Instance
```

##### Methods:
 - `remove(callback)` - {*undefined*} - Remove document. Callback has `error` argument
 - `link()` - {*String*} - Returns downloadable URL to File
 - `get(property)` - {*Object*|*mix*} - Returns current document as a plain Object, if `property` is specified - returns value of sub-object property
 - `fetch()` - {*[Object]*}- Returns current document as plain Object in Array
 - `with()` - {*FileCursor*} - Returns reactive version of current FileCursor, useful to use with `{{#with FileCursor#with}}...{{/with}}` block template helper