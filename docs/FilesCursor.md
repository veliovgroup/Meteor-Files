### FilesCursor [*Isomorphic*]

Implementation of Cursor for FilesCollection. Returned from `FilesCollection#find()`.

```js
import { FilesCollection } from 'meteor/ostrio:files';

const imagesCollection = new FilesCollection();
const cursor = imagesCollection.find(); // <-- Returns FilesCursor Instance
```

#### Properties:

- `cursor` - {*Mongo.Cursor*} - The underlying Mongo cursor. Return it from a publication: `return imagesCollection.find(selector).cursor;`

#### Methods:

On the Server the synchronous methods `get()`, `hasNext()`, `next()`, `previous()`, `fetch()`, `first()`, `last()`, `count()`, `remove()`, `forEach()`, `each()`, `map()`, and `current()` throw `Meteor.Error 404` with a message that names the `*Async` method to use. They work on the Client only. `hasPrevious()`, `observe()`, and `observeChanges()` work on both sides.

- [*Client*] `get()` - {*object[]*} - Returns all matching document(s) as an Array. Alias of `.fetch()`
- `getAsync()` - {*Promise<object[]>*} - Resolves to matching document(s) as an Array. Alias of `.fetchAsync()`
- __Deprecated__ [*Client*] `hasNext()` - {*boolean*} - Returns `true` if there is next item available on Cursor
- `hasNextAsync()` - {*Promise<boolean>*} - Resolves to `true` if there is next item available on Cursor
- [*Client*] `next()` - {*object*|*undefined*} - Returns next available object on Cursor
- `nextAsync()` - {*Promise<object|undefined>*} - Resolves to next available object on Cursor
- `hasPrevious()` - {*boolean*} - Returns `true` if there is previous item available on Cursor
- `hasPreviousAsync()` - {*Promise<boolean>*} - Resolves to `true` if there is previous item available on Cursor
- [*Client*] `previous()` - {*object*|*undefined*} - Returns previous object on Cursor
- `previousAsync()` - {*Promise<object|undefined>*} - Resolves to previous object on Cursor
- [*Client*] `fetch()` - {*object[]*} - Returns all matching document(s) as an Array
- `fetchAsync()` - {*Promise<object[]>*} - Resolves to array with all matching document(s)
- [*Client*] `first()` - {*object*|*undefined*} - Returns first item on Cursor, if available
- `firstAsync()` - {*Promise<object|undefined>*} - Resolves to first item on Cursor, if available
- [*Client*] `last()` - {*object*|*undefined*} - Returns last item on Cursor, if available
- `lastAsync()` - {*Promise<object|undefined>*} - Resolves to the last item on Cursor, if available
- [*Client*] `current()` - {*object*|*undefined*} - Returns current item on Cursor, if available
- `currentAsync()` - {*Promise<object|undefined>*} - Resolves to current item on Cursor, if available
- __Deprecated__ [*Client*] `count()` - {*number*} - Returns the number of documents that match a query
- __Deprecated__ `countAsync()` - {*Promise<number>*} - Resolves to the number of documents that match a query. Use `countDocuments()`
- `countDocuments(opts: Mongo.CountDocumentsOptions)` - {*Promise<number>*} - Resolves to the number of documents that match a query
- [*Client*] `remove(callback)` - {*FilesCursor*} - Removes all documents that match a query, [*Client*] only. Callback has `error` argument
- `removeAsync()` - {*Promise<number>*} - Removes all documents that match a query. Resolves into number of removed records
- [*Client*] `forEach(callback, context)` - {*FilesCursor*} - *Same as `forEachAsync` in arguments and context*
- `forEachAsync(callback, context)` - {*Promise<FilesCursor>*} - Call `callback` once for each matching document, sequentially. The callback can be `async`
  - `callback` - {*Function*} - Function to call. It will be called with three arguments: the `file`, a 0-based index, and cursor itself
  - `context` - {*object*} - An object which will be the value of `this` inside `callback`
- [*Client*] `each()` - {*FileCursor[]*} - *Same as `eachAsync` in arguments and context*
- `eachAsync()` - {*Promise<FileCursor[]>*} - Returns an Array of `FileCursor` made for each document on current Cursor. Useful when using in `{{#each cursor.each}}...{{/each}}` block template helper
- [*Client*] `map(callback, context)` - {*object[]*} - *Same as `mapAsync` in arguments and context*
- `mapAsync(callback, context)` - {*Promise<object[]>*} - Map `callback` over all matching documents. Returns an Array
  - `callback` - {*Function*} - Function to call. It will be called with three arguments: the `file`, a 0-based index, and cursor itself
  - `context` - {*object*} - An object which will be the value of `this` inside `callback`
- `observe(callbacks: Mongo.ObserveCallbacks)` - {*Meteor.LiveQueryHandle*} - *Same as `observeAsync` in arguments and context*
- `observeAsync(callbacks: Mongo.ObserveCallbacks)` - {*Promise<Meteor.LiveQueryHandle>*} - Functions to call to deliver the result set as it changes. Watch a query. Receive callbacks as the result set changes. Read more [here](https://docs.meteor.com/api/collections.html#Mongo-Cursor-observe)
- `observeChanges(callbacks: Mongo.ObserveChangesCallbacks)` - {*Meteor.LiveQueryHandle*} - *Same as `observeChangesAsync` in arguments and context*
- `observeChangesAsync(callbacks: Mongo.ObserveChangesCallbacks)` - {*Promise<Meteor.LiveQueryHandle>*} - Watch a query. Receive callbacks as the result set changes. Only the differences between the old and new documents are passed to the callbacks. Read more [here](https://docs.meteor.com/api/collections.html#Mongo-Cursor-observeChanges)
