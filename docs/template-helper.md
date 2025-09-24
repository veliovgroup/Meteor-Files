### Template Helper `fileURL` [*Client*]

```js
import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { FilesCollection } from 'meteor/ostrio:files';

const files = new FilesCollection({ collectionName: 'Files' });

if (Meteor.isClient) {
  Meteor.subscribe('files.all');

  Template.example.helpers({
    fileRef: files.collection.findOne({})
  });
} else {
  Meteor.publish('files.all', function () {
    return files.collection.find({});
  });
}
```

#### Get download URL for file, pass `fileRef` object to helper:

```handlebars
<a href="{{fileURL fileRef}}?download=true" target="_parent" download="{{fileRef.name}}">
  {{fileRef.name}}
</a>
```

-----

#### Get specific version of the file, pass second argument `version`:

__Note:__ If requested version of file is not available - the original file will be returned.

For more info about file's subversions see: [create subversions](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/file-subversions.md) section

```handlebars
<a href="{{fileURL fileRef 'small'}}?download=true" target="_parent" download="{{compare fileRef.versions.small.name '||' fileRef.name}}">
  {{fileRef.name}}
</a>
<!-- For `compare` helper see ostrio:templatehelpers -->
```

For `compare` helper see [ostrio:templatehelpers](https://atmospherejs.com/ostrio/templatehelpers)

-----

#### Change base URI, pass third argument `URIBase`:

```handlebars
<img src="{{fileURL fileRef 'original' 'https://other-domain.com/'}}">
```

-----

#### Display thumbnail:

__Note:__ If thumbnail (*subversion of the file*) is not available the original file will be returned.

For more info about file's subversions see: [create subversions](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/file-subversions.md) section

```handlebars
<img src="{{fileURL fileRef 'thumb'}}" alt="{{fileRef.name}}" />
```

-----

#### Example for video with multiple subversions:

For more info about file's subversions see: [create subversions](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/file-subversions.md) section

```handlebars
<video width="80%" height="auto" controls="controls" poster="{{fileURL fileRef 'videoPoster'}}">
  <source src="{{fileURL fileRef 'ogg'}}?play=true" type="video/ogg" />
  <source src="{{fileURL fileRef 'mp4'}}?play=true" type="video/mp4" />
  <source src="{{fileURL fileRef 'webm'}}?play=true" type="video/webm" />
</video>
```
