# *FilesCollection* Instances and *Mongo.Collection* Instances

While *FilesCollection* has a direct reference to a [`Mongo.Collection`](http://docs.meteor.com/#/full/mongo_collection),
the `Mongo.Collection` has a back-reference to the *FilesCollection* itself.

The reference chain is as the following:

```js
const Images = new FilesCollection({collectionName: 'Images'});

// get the underlying Mongo.Collection
const collection = Images.collection;

// get the 'parent' FilesCollection
// of this collection instance
const parent = collection.filesCollection;

// returns true
console.log(parent === Images);
```

## Using `dburles:mongo-collection-instances`

In Meteor for `Mongo.Collection` instances management, we suggest to use [dburles:mongo-collection-instances](https://github.com/dburles/mongo-collection-instances).
It allows to retrieve `Mongo.Collection` instances by its name in any module or file.

__Note:__ This package comes with no dependency to `dburles:mongo-collection-instances`.
To make use of it, install it to your Meteor project first.

```bash
meteor add dburles:mongo-collection-instances
```

Then initialize *FilesCollection*, which itself will create a new `Mongo.Collection`, that is automatically added to a hidden `Mongo.Collection` instances list.

```js
const Images = new FilesCollection({collectionName: 'Images'});
```

To retrieve *FilesCollection* use - `Mongo.Collection.get('collectionName')`:

```js
const ImagesCollection = Mongo.Collection.get('Images');
const Images = ImagesCollection.filesCollection;
```

## Using a custom collection instance management

This simplified example shows, how to make use of that technique in your own implementation.
Assume having a map of all `Mongo.Collection` instances:

```js
const collectionsMap = {};
```

Since you may not want to store the *FilesCollection* instance (*because it is not a* `Mongo.Collection`), you can still reference the underlying Mongo.Collection:

```js
const Images = new FilesCollection({collectionName: 'Images'});
collectionsMap.Images = Images.collection;
```

Access the *FilesCollection* by reference:

```js
const Images = collectionsMap.Images.filesCollection;
```
