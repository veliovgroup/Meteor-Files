### FilesCursor [*Anywhere*]

Implementation of Cursor for FilesCollection. Returned from `FilesCollection#find()`.

```js
import { FilesCollection } from 'meteor/ostrio:files';

const imagesCollection = new FilesCollection();
const cursor = imagesCollection.find(); // <-- Returns FilesCursor Instance
```

#### Methods:

- `get()` - {*object[]*} - Returns all matching document(s) as an Array. Alias of `.fetch()`
- `getAsync()` - {*Promise<object[]>*} - Resolves to matching document(s) as an Array. Alias of `.fetchAsync()`
- `hasNext()`- {*boolean*} - Returns `true` if there is next item available on Cursor
- `hasNextAsync()`- {*Promise<boolean>*} - Resolves to `true` if there is next item available on Cursor
- `next()` - {*object*|*undefined*} - Returns next available object on Cursor
- `nextAsync()` - {*Promise<object|undefined>*} - Resolves to next available object on Cursor
- `hasPrevious()` - {*boolean*} - Returns `true` if there is previous item available on Cursor
- `hasPreviousAsync()` - {*Promise<boolean>*} - Resolves to `true` if there is previous item available on Cursor
- `previous()` - {*object*|*undefined*} - Returns previous object on Cursor
- `previousAsync()` - {*Promise<object|undefined>*} - Resolves to previous object on Cursor
- `fetch()` - {*object[]*} - Returns all matching document(s) as an Array
- `fetchAsync()` - {*Promise<object[]>*} - Resolves to array with all matching document(s)
- `first()` - {*object*|*undefined*} - Returns first item on Cursor, if available
- `firstAsync()` - {*Promise<object|undefined>*} - Resolves to first item on Cursor, if available
- `last()` - {*object*|*undefined*} - Returns last item on Cursor, if available
- `lastAsync()` - {*Promise<object|undefined>*} - Resolves to the last item on Cursor, if available
- `current()` - {*object*|*undefined*} - Returns current item on Cursor, if available
- `currentAsync()` - {*Promise<object|undefined>*} - Resolves to current item on Cursor, if available
- `count()` - {*number*} - Returns the number of documents that match a query
- `countAsync()` - {*Promise<number>*} - Resolves to the number of documents that match a query
- `countDocuments(opts: Mongo.CountDocumentsOptions)` - {*Promise<number>*} - Resolves to the number of documents that match a query
- `remove(callback)` - {*undefined*} - Removes all documents that match a query. Callback has `error` argument
- `removeAsync()` - {*Promise<number>*} - Removes all documents that match a query. Resolves into number of removed records
- `forEach(callback, context)` - {*undefined*} - *Same as `forEachAsync` in arguments and context*
- `forEachAsync(callback, context)` - {*undefined*} - Call `callback` once for each matching document, sequentially and synchronously.
  - `callback` - {*Function*} - Function to call. It will be called with three arguments: the `file`, a 0-based index, and cursor itself
  - `context` - {*object*} - An object which will be the value of `this` inside `callback`
- `each()` - {*FileCursor[]*} - *Same as `eachAsync` in arguments and context*
- `eachAsync()` - {*Promise<FileCursor[]>*} - Returns an Array of `FileCursor` made for each document on current Cursor. Useful when using in `{{#each cursor.each}}...{{/each}}` block template helper
- `map(callback, context)` - {*object[]*} - *Same as `mapAsync` in arguments and context*
- `mapAsync(callback, context)` - {*Promise<object[]>*} - Map `callback` over all matching documents. Returns an Array
  - `callback` - {*Function*} - Function to call. It will be called with three arguments: the `file`, a 0-based index, and cursor itself
  - `context` - {*object*} - An object which will be the value of `this` inside `callback`
- `observe(callbacks: Mongo.ObserveCallbacks)` - {*Meteor.LiveQueryHandle*} - *Same as `observeAsync` in arguments and context*
- `observeAsync(callbacks: Mongo.ObserveCallbacks)` - {*Promise<Meteor.LiveQueryHandle>*} - Functions to call to deliver the result set as it changes. Watch a query. Receive callbacks as the result set changes. Read more [here](http://docs.meteor.com/api/collections.html#Mongo-Cursor-observe)
- `observeChanges(callbacks: Mongo.ObserveChangesCallbacks)` - {*Meteor.LiveQueryHandle*} - *Same as `observeChangesAsync` in arguments and context*
- `observeChangesAsync(callbacks: Mongo.ObserveChangesCallbacks)` - {*Promise<Meteor.LiveQueryHandle>*} - Watch a query. Receive callbacks as the result set changes. Only the differences between the old and new documents are passed to the callbacks.. Read more [here](http://docs.meteor.com/api/collections.html#Mongo-Cursor-observeChanges)
