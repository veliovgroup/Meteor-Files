##### `FilesCollection Instances and Mongo Collection Instances`

While FilesCollection has a direct reference to a [`Mongo.Collection`](http://docs.meteor.com/#/full/mongo_collection),
the Mongo.Collection has a back-reference to the FilesCollection itself.
 
The reference chain is as the following:

```javascript
var Images = new FilesCollection({collectionName: 'Images'});

// get the underlying Mongo.Collection
var collection = Images.collection;

// get the 'parent' FilesCollection 
// of this collection instance
var parent = collection.filesCollection;

// returns true
console.log(parent === Images);
```


##### Using dburles:mongo-collection-instances

In Meteor you can use a Mongo.Collection instances management, such as [dburles:mongo-collection-instances](https://github.com/dburles/mongo-collection-instances).
It allows you to retrieve Mongo.Collection instances by name in any module or file.

**Note:** This package comes with no dependency to dburles:mongo-collection-instances. 
If you want to make use of it, you need to install it to your meteor project first.

```bash
meteor add dburles:mongo-collection-instances
```

You can then instantiate your FilesCollection, which itself creates a new Mongo.Collection, that is now automatically added
to a hidden Mongo.Collection instances list.

```javascript
var Images = new FilesCollection({collectionName: 'Images'}); 
````

You can retrieve your FilesCollection now anywhere using Mongo.Collection.get 

```javascript
var ImagesCollection = Mongo.Collection.get('Images');
var Images = ImagesCollection.filesCollection;
```` 

##### Using a custom collection instance management

This simplified example shows you, how to make use of that technique in your own implementation.
Assume you have a map of all your Mongo.Collection instances:
 
 ```javascript
 var collectionsMap = {}; 
 ````
 
Since you don't want to store the FilesCollection (because it is no Mongo.Collection),
you can still reference the underlying Mongo.Collection:

```javascript
var Images = new FilesCollection({collectionName: 'Images'});
collectionsMap['Images'] = Images.collection;
````

Having your collection instances available, you can access the FilesCollection by reference:

```javascript
var Images = collectionsMap['Images'].filesCollection;
````