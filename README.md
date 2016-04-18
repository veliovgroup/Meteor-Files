Files for Meteor
========
Upload, Download, Serve and Stream files within your Meteor application. Without system dependencies, try [demo app](https://github.com/VeliovGroup/Meteor-Files#demo-application), which works smoothly on free/sandbox Heroku plan, [one click Heroku deploy](https://heroku.com/deploy?template=https://github.com/VeliovGroup/Meteor-Files-Demo)

Support:
========
 - [![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/VeliovGroup/Meteor-Files)
 - [Ask a question or submit an issue](https://github.com/VeliovGroup/Meteor-Files/issues)
 - [Releases / Changelog / History](https://github.com/VeliovGroup/Meteor-Files/releases)
 - For more docs and examples [read wiki](https://github.com/VeliovGroup/Meteor-Files/wiki)

Demo application:
========
 - [Live](https://meteor-files.herokuapp.com/)
 - [Source](https://github.com/VeliovGroup/Meteor-Files/tree/master/demo)
 - [![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/VeliovGroup/Meteor-Files-Demo)

ToC:
========
 - [Wiki](https://github.com/VeliovGroup/Meteor-Files/wiki) - Full documentation
 - [Why this package?](https://github.com/VeliovGroup/Meteor-Files#why-meteor-files)
 - [Install](https://github.com/VeliovGroup/Meteor-Files#install)
 - [API](https://github.com/VeliovGroup/Meteor-Files#api)
   * [Initialize Collection](https://github.com/VeliovGroup/Meteor-Files#new-meteorfilesconfig-isomorphic)
   * [Upload file](https://github.com/VeliovGroup/Meteor-Files#insertsettings-client)
   * [Stream files](https://github.com/VeliovGroup/Meteor-Files#stream-files)
   * [Download Button](https://github.com/VeliovGroup/Meteor-Files#download-button)

Why `Meteor-Files`?
========
`cfs` is a good package, but buggy as it's huge monster which combine everything. In `Meteor-Files` is nothing to broke, it's simply upload/store/retrieve files to/from server. 
 - You need store to GridFS, AWS or DropBox? (*[Use third-party storage](https://github.com/VeliovGroup/Meteor-Files/wiki/Third-party-storage)*) - *Add it yourself*
 - You need to check file mime-type or extensions? (*[`onBeforeUpload`](https://github.com/VeliovGroup/Meteor-Files/wiki/Constructor)*) - *Add it yourself*
 - You need to resize images after upload? (*[`onAfterUpload`](https://github.com/VeliovGroup/Meteor-Files/wiki/Constructor)*, *[file's subversions](https://github.com/VeliovGroup/Meteor-Files/wiki/Create-and-Manage-Subversions)*) - *Add it yourself*

Easy-peasy kids, *yeah*?

Install:
========
```shell
meteor add ostrio:files
```

API
========
#### `new Meteor.Files([config])` [*Isomorphic*]
Read full docs for [`Meteor.Files` Constructor](https://github.com/VeliovGroup/Meteor-Files/wiki/Constructor)

Shared code:
```js
var Images = new Meteor.Files({
  collectionName: 'Images',
  allowClientCode: false, // Disallow remove files from Client
  onBeforeUpload: function (file) {
    // Allow upload files under 10MB, and only in png/jpg/jpeg formats
    if (file.size <= 10485760 && /png|jpg|jpeg/i.test(file.ext)) {
      return true;
    } else {
      return 'Please upload image, with size equal or less than 10MB';
    }
  }
});

if (Meteor.isClient) {
  Meteor.subscribe('files.images.all');
}

if (Meteor.isServer) {
  Meteor.publish('files.images.all', function () {
    return Images.collection.find({});
  });
}
```


#### `insert(settings)` [*Client*]
Read full docs for [`insert()` method](https://github.com/VeliovGroup/Meteor-Files/wiki/Insert-(Upload))

Upload form (template):
```html
<template name="uploadForm">
  {{#if currentFile}}
    Uploading <b>{{currentFile.file.name}}</b>: 
    <span id="progress">{{progress}}%</span>
  {{else}}
    <input id="fileInput" type="file" />
  {{/if}}
</template>
```

Shared code:
```javascript
this.Images = new Meteor.Files({collectionName: 'Images'});
```

Client's code:
```javascript
Template.uploadForm.onCreated(function () {
  this.currentFile = new ReactiveVar(false);
});

Template.uploadForm.helpers({
  currentFile: function () {
    return Template.instance().currentFile.get();
  },
  progress: function () {
    var _cf = Template.instance().currentFile.get();
    if (_cf) {
      return _cf.progress.get();
    } else {
      return 0;
    }
  },
});

Template.uploadForm.events({
  'change #fileInput': function (e, template) {
    if (e.currentTarget.files && e.currentTarget.files[0]) {
      // We upload only one file, in case 
      // there was multiple files selected
      var file = e.currentTarget.files[0];

      template.currentFile.set(Images.insert({
        file: file,
        onUploaded: function (error, fileObj) {
          if (error) {
            alert('Error during upload: ' + error);
          } else {
            alert('File "' + fileObj.name + '" successfully uploaded');
          }
          template.currentFile.set(false);
        },
        streams: 'dynamic',
        chunkSize: 'dynamic'
      }));
    }
  }
});
```
For more expressive example see [demo app](https://github.com/VeliovGroup/Meteor-Files/tree/master/demo/client)


#### Stream files
To display files you will use `fileURL` template helper.

Template:
```html
<template name='file'>
  <img src="{{fileURL imageFile}}" alt="{{imageFile.name}}" />
  <hr>
  <video height="auto" controls="controls">
    <source src="{{fileURL videoFile}}?play=true" type="{{videoFile.type}}" />
  </video>
</template>
```

Shared code:
```javascript
this.Images = new Meteor.Files({collectionName: 'Images'});
this.Videos = new Meteor.Files({collectionName: 'Videos'});

// To have sample files in DB we will upload them on server startup:
if (Meteor.isServer) {
  Meteor.startup(function () {
    Images.load('https://raw.githubusercontent.com/VeliovGroup/Meteor-Files/master/logo.png', {
      fileName: 'logo.png'
    });
    Videos.load('http://www.sample-videos.com/video/mp4/240/big_buck_bunny_240p_5mb.mp4', {
      fileName: 'Big-Buck-Bunny.mp4'
    });
  });

  Meteor.publish('files.images.all', function () {
    return Images.collection.find({});
  });
  Meteor.publish('files.videos.all', function () {
    return Videos.collection.find({});
  });

} else {
  Meteor.subscribe('files.images.all');
  Meteor.subscribe('files.videos.all');
}
```

Client's code:
```javascript
Template.file.helpers({
  imageFile: function () {
    return Images.collection.findOne({});
  },
  videoFile: function () {
    return Videos.collection.findOne({});
  }
});
```

For more expressive example see [demo app](https://github.com/VeliovGroup/Meteor-Files/tree/master/demo/client)


#### Download button
Template:
```html
<template name='file'>
  <a href="{{fileURL fileRef}}?download=true" target="_parent" download>
    {{fileRef.name}}
  </a>
</template>
```

Shared code:
```javascript
this.Images = new Meteor.Files({collectionName: 'Images'});

// To have sample image in DB we will upload it on server startup:
if (Meteor.isServer) {
  Meteor.startup(function () {
    Images.load('https://raw.githubusercontent.com/VeliovGroup/Meteor-Files/master/logo.png', {
      fileName: 'logo.png',
      meta: {}
    });
  });

  Meteor.publish('files.images.all', function () {
    return Images.collection.find({});
  });
} else {
  Meteor.subscribe('files.images.all');
}
```

Client's code:
```javascript
Template.file.helpers({
  fileRef: function () {
    return Images.collection.findOne({});
  }
});
```
For more expressive example see [demo app](https://github.com/VeliovGroup/Meteor-Files/tree/master/demo/client)

----

| Meteor-Files | Expressive package to manage files within Meteor |
|:-------------:|:------------- |
| [![logo](https://raw.githubusercontent.com/VeliovGroup/Meteor-Files/master/logo.png)](https://github.com/VeliovGroup/Meteor-Files) | If you found this package useful, please do not hesitate to star it at both [GitHub](https://github.com/VeliovGroup/Meteor-Files) and [Atmosphere](https://atmospherejs.com/ostrio/files). Also you may like to [Tweet](https://twitter.com/share?url=https%3A%2F%2Fgithub.com%2FVeliovGroup%2FMeteor-Files&text=File%20upload%20and%20delivery%20in%20Meteorjs%20-%20now%20it's%20easy!) about it or share at [Facebook](https://www.facebook.com/sharer.php?u=https%3A%2F%2Fgithub.com%2FVeliovGroup%2FMeteor-Files) |