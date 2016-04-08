##### Template Helper `fileURL` [*Client*]

```javascript
this.FilesCollection = new Meteor.Files({collectionName: 'Files'});

if (Meteor.isClient) {
  Meteor.subscribe('files.all');

  Template.example.helpers({
    fileRef: FilesCollection.collection.findOne({})
  })

} else {

  Meteor.publish('files.all', function () {
    return FilesCollection.collection.find({});
  });
}
```

To get download URL for file, you only need `fileRef` object, so there is no need for subscription:
```html
<a href="{{fileURL fileRef}}?download=true" target="_parent" download>
  {{fileRef.name}}
</a>
```

To get specific version of the file use second argument `version`:
__Note:__ If requested version of file is not available - the original file will be returned
```html
<a href="{{fileURL fileRef 'small'}}?download=true" target="_parent" download>
  {{fileRef.name}}
</a>
```

To display thumbnail:
__Note:__ If thumbnail (basically version of the file) is not available the original file will be returned
```html
<img src="{{fileURL fileRef 'thumb'}}" alt="{{fileRef.name}}" />
```

Example for video:
```html
<video width="80%" height="auto" controls="controls" poster="{{fileURL fileRef 'videoPoster'}}">
  <source src="{{fileURL fileRef 'ogg'}}?play=true" type="video/ogg" />
  <source src="{{fileURL fileRef 'mp4'}}?play=true" type="video/mp4" />
  <source src="{{fileURL fileRef 'webm'}}?play=true" type="video/webm" />
</video>
```
