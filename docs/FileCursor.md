### FileCursor [*Isomorphic*]

FileCursor Class represents each record in `FilesCursor#each()` or document returned from `FilesCollection#findOneAsync()` method.
All document's original properties is available directly by name, like: `FileCursor#propertyName`

```js
import { FilesCollection } from 'meteor/ostrio:files';

const imagesCollection = new FilesCollection();
const cursor = await imagesCollection.findOneAsync(); // <-- Returns FileCursor Instance
```

#### Methods:

- `remove(callback)` - {*FileCursor*} - Remove document, [*Client*] only (throws `Meteor.Error 404` on the Server, use `removeAsync()`). Callback has `error` argument
- `removeAsync()` - {*Promise<FileCursor>*} - Remove document. Throws `Meteor.Error 404` if the cursor has no file. Takes no callback
- `link()` - {*string*} - Returns downloadable URL to File
  - `link('version')` - {*string*} - Returns downloadable URL to File's subversion
  - `link('original', 'https://other-domain.com/')` - {*string*} - Returns downloadable URL to File located on other domain
  - `link('original', '/')` - {*string*} - Returns __relative__ downloadable URL to File
- `get(property)` - {*object*|*mix*} - Returns current document as a plain Object, if `property` is specified - returns value of sub-object property
- `fetch()` - {*object[]*} - Returns current document as plain Object in Array
- `fetchAsync()` - {*Promise<object[]>*}- Returns current document as plain Object in Array
- `with()` - {*FileCursor*} - [*Client*] only (throws `Meteor.Error 404` on the Server, use `withAsync()`). Returns reactive version of current FileCursor, useful to use with `{{#with cursor.with}}...{{/with}}` block template helper
- `withAsync()` - {*Promise<FileCursor>*} - Returns reactive version of current FileCursor
