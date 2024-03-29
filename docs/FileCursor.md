### FileCursor [*Anywhere*]

FileCursor Class represents each record in `FilesCursor#each()` or document returned from `FilesCollection#findOne()` method.
All document's original properties is available directly by name, like: `FileCursor#propertyName`

```js
import { FilesCollection } from 'meteor/ostrio:files';

const imagesCollection = new FilesCollection();
const cursor = imagesCollection.findOne(); // <-- Returns FileCursor Instance
```

#### Methods:

- `remove(callback)` - {*undefined*} - Remove document. Callback has `error` argument
- `link()` - {*String*} - Returns downloadable URL to File
  - `link('version')` - {*String*} - Returns downloadable URL to File's subversion
  - `link('original', 'https://other-domain.com/')` - {*String*} - Returns downloadable URL to File located on other domain
  - `link('original', '/')` - {*String*} - Returns __relative__ downloadable URL to File
- `get(property)` - {*Object*|*mix*} - Returns current document as a plain Object, if `property` is specified - returns value of sub-object property
- `fetch()` - {*[Object]*}- Returns current document as plain Object in Array
- `with()` - {*FileCursor*} - Returns reactive version of current FileCursor, useful to use with `{{#with cursor.with}}...{{/with}}` block template helper
