Files for Meteor
========
Extremely fast and robust package for file uploading, managing and streaming (*Audio & Video & Images*), with support of server's file system (FS) or third party storage, like: *AWS*, *DropBox*, *Google Storage*, *Google Drive*, *GridFS* or any other with API.

Upload, Download, Serve and Stream files within your Meteor application. Without system dependencies, try [demo app](https://github.com/VeliovGroup/Meteor-Files#demo-application), which works smoothly on free/sandbox Heroku plan, [one click Heroku deploy](https://heroku.com/deploy?template=https://github.com/VeliovGroup/Meteor-Files-Demo)

For current upload *pause/continue*, *speed*, *remaining time* and *progress* see *Object* returned from [`insert` method](https://github.com/VeliovGroup/Meteor-Files/wiki/Insert-(Upload)).

Support:
========
 - [![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/VeliovGroup/Meteor-Files)
 - [Ask a question or submit an issue](https://github.com/VeliovGroup/Meteor-Files/issues)
 - [Releases / Changelog / History](https://github.com/VeliovGroup/Meteor-Files/releases)
 - For more docs and examples [read wiki](https://github.com/VeliovGroup/Meteor-Files/wiki)

Awards:
========
<a href="https://themeteorchef.com/blog/giant-cotton-apron-awards-show"><img src="https://s3.amazonaws.com/tmc-post-content/gcaa-2016-winner-badge.svg"></a>


Demo application:
========
 - [Live](https://meteor-files.herokuapp.com/) (*Unavailable after 6 hours of uptime, due to [free plan](https://www.heroku.com/pricing)*)
 - [Source](https://github.com/VeliovGroup/Meteor-Files/tree/master/demo)
 - [![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/VeliovGroup/Meteor-Files-Demo)

ToC:
========
 - [Wiki](https://github.com/VeliovGroup/Meteor-Files/wiki) - Full documentation
 - [Why this package?](https://github.com/VeliovGroup/Meteor-Files#why-meteor-files)
 - [Install](https://github.com/VeliovGroup/Meteor-Files#install)
 - [API](https://github.com/VeliovGroup/Meteor-Files#api-overview-full-api):
   * [Initialize Collection](https://github.com/VeliovGroup/Meteor-Files#new-filescollectionconfig-isomorphic)
   * [Upload file](https://github.com/VeliovGroup/Meteor-Files#insertsettings-client)
   * [Stream files](https://github.com/VeliovGroup/Meteor-Files#stream-files)
   * [Download Button](https://github.com/VeliovGroup/Meteor-Files#download-button)

Why `Meteor-Files`?
========
The `cfs` is a well known package, but it's huge monster which combines everything. In `Meteor-Files` is nothing to broke, it's simply upload/store/serve files to/from server.
 - Support for both `HTTP` and `DDP` transports for upload
 - You need store to *GridFS*, *[AWS S3](https://github.com/VeliovGroup/Meteor-Files/wiki/AWS-S3-Integration)* or *[DropBox](https://github.com/VeliovGroup/Meteor-Files/wiki/Third-party-storage)*? (*[Use 3rd-party storage](https://github.com/VeliovGroup/Meteor-Files/wiki/Third-party-storage)*) - *Add it yourself*
 - You need to check file mime-type, size or extension? (*[`onBeforeUpload`](https://github.com/VeliovGroup/Meteor-Files/wiki/Constructor)*) - *Add it yourself*
 - You need to resize images after upload? (*[`onAfterUpload`](https://github.com/VeliovGroup/Meteor-Files/wiki/Constructor)*, *[file's subversions](https://github.com/VeliovGroup/Meteor-Files/wiki/Create-and-Manage-Subversions)*) - *Add it yourself*

Easy-peasy kids, *yeah*?

Install:
========
```shell
meteor add ostrio:files
```

API overview (*[full API](https://github.com/VeliovGroup/Meteor-Files/wiki)*)
========
#### `new FilesCollection([config])` [*Isomorphic*]
Read full docs for [`FilesCollection` Constructor](https://github.com/VeliovGroup/Meteor-Files/wiki/Constructor)

Shared code:
```js
var Images = new FilesCollection({
  collectionName: 'Images',
  allowClientCode: false, // Disallow remove files from Client
  onBeforeUpload: function (file) {
    // Allow upload files under 10MB, and only in png/jpg/jpeg formats
    if (file.size <= 10485760 && /png|jpg|jpeg/i.test(file.extension)) {
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
    return Images.find().cursor;
  });
}
```


#### `insert(settings[, autoStart])` [*Client*]
Read full docs for [`insert()` method](https://github.com/VeliovGroup/Meteor-Files/wiki/Insert-(Upload))

Upload form (template):
```html
<template name="uploadForm">
  {{#with currentUpload}}
    Uploading <b>{{file.name}}</b>: 
    <span id="progress">{{progress.get}}%</span>
  {{else}}
    <input id="fileInput" type="file" />
  {{/with}}
</template>
```

Shared code:
```javascript
this.Images = new FilesCollection({collectionName: 'Images'});
```

Client's code:
```javascript
Template.uploadForm.onCreated(function () {
  this.currentUpload = new ReactiveVar(false);
});

Template.uploadForm.helpers({
  currentUpload: function () {
    return Template.instance().currentUpload.get();
  }
});

Template.uploadForm.events({
  'change #fileInput': function (e, template) {
    if (e.currentTarget.files && e.currentTarget.files[0]) {
      // We upload only one file, in case 
      // multiple files were selected
      var upload = Images.insert({
        file: e.currentTarget.files[0],
        streams: 'dynamic',
        chunkSize: 'dynamic'
      }, false);

      upload.on('start', function () {
        template.currentUpload.set(this);
      });

      upload.on('end', function (error, fileObj) {
        if (error) {
          alert('Error during upload: ' + error);
        } else {
          alert('File "' + fileObj.name + '" successfully uploaded');
        }
        template.currentUpload.set(false);
      });

      upload.start();
    }
  }
});
```
For more expressive example see [Upload demo app](https://github.com/VeliovGroup/Meteor-Files/tree/master/demo-simplest-upload)


#### Stream files
To display files you can use `fileURL` template helper or `.link()` method of `FileCursor`.

Template:
```html
<template name='file'>
  <img src="{{imageFile.link}}" alt="{{imageFile.name}}" />
  <!-- Same as: -->
  <!-- <img src="{{fileURL imageFile}}" alt="{{imageFile.name}}" /> -->
  <hr>
  <video height="auto" controls="controls">
    <source src="{{videoFile.link}}?play=true" type="{{videoFile.type}}" />
    <!-- Same as: -->
    <!-- <source src="{{fileURL videoFile}}?play=true" type="{{videoFile.type}}" /> -->
  </video>
</template>
```

Shared code:
```javascript
this.Images = new FilesCollection({collectionName: 'Images'});
this.Videos = new FilesCollection({collectionName: 'Videos'});

// Upload sample files on server's startup:
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
    return Images.find().cursor;
  });
  Meteor.publish('files.videos.all', function () {
    return Videos.find().cursor;
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
    return Images.findOne();
  },
  videoFile: function () {
    return Videos.findOne();
  }
});
```

For more expressive example see [Streaming demo app](https://github.com/VeliovGroup/Meteor-Files/tree/master/demo-simplest-streaming)


#### Download button
Template:
```html
<template name='file'>
  <a href="{{file.link}}?download=true" download="{{file.name}}" target="_parent">
    {{file.name}}
  </a>
</template>
```

Shared code:
```javascript
this.Images = new FilesCollection({collectionName: 'Images'});

// Load sample image into FilesCollection on server's startup:
if (Meteor.isServer) {
  Meteor.startup(function () {
    Images.load('https://raw.githubusercontent.com/VeliovGroup/Meteor-Files/master/logo.png', {
      fileName: 'logo.png',
      meta: {}
    });
  });

  Meteor.publish('files.images.all', function () {
    return Images.find().cursor;
  });
} else {
  Meteor.subscribe('files.images.all');
}
```

Client's code:
```javascript
Template.file.helpers({
  fileRef: function () {
    return Images.findOne();
  }
});
```
For more expressive example see [Download demo](https://github.com/VeliovGroup/Meteor-Files/tree/master/demo-simplest-download-button)


Supporters:
========
Big thanks to all supporters. *Only because of this guys this project can have 100% of our attention*.
 - [@themeteorchef](https://github.com/themeteorchef)
 - [@MeDBejoHok](https://github.com/medbejohok)

----

| Meteor-Files | Expressive package to manage files within Meteor |
|:-------------:|:------------- |
| [![logo](https://raw.githubusercontent.com/VeliovGroup/Meteor-Files/master/logo.png)](https://github.com/VeliovGroup/Meteor-Files) | If you found this package useful, please do not hesitate to star it at both [GitHub](https://github.com/VeliovGroup/Meteor-Files) and [Atmosphere](https://atmospherejs.com/ostrio/files). Also you may like to [Tweet](https://twitter.com/share?url=https%3A%2F%2Fgithub.com%2FVeliovGroup%2FMeteor-Files&text=File%20upload%20and%20delivery%20in%20Meteorjs%20-%20now%20it's%20easy!) about it or share at [Facebook](https://www.facebook.com/sharer.php?u=https%3A%2F%2Fgithub.com%2FVeliovGroup%2FMeteor-Files) |