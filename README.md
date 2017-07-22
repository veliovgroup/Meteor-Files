[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=FVDSXRFW9VGA2)
[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/VeliovGroup/Meteor-Files)
[![GitHub issues](https://img.shields.io/github/issues/VeliovGroup/Meteor-Files.svg)](https://github.com/VeliovGroup/Meteor-Files/issues)
[![GitHub forks](https://img.shields.io/github/forks/VeliovGroup/Meteor-Files.svg)](https://github.com/VeliovGroup/Meteor-Files/network)
[![GitHub stars](https://img.shields.io/github/stars/VeliovGroup/Meteor-Files.svg)](https://github.com/VeliovGroup/Meteor-Files/stargazers)
[![Twitter](https://img.shields.io/twitter/url/https/github.com/VeliovGroup/Meteor-Files.svg?style=social)](https://twitter.com/intent/tweet?url=https%3A%2F%2Fgithub.com%2FVeliovGroup%2FMeteor-Files)

ToC:
========
 - [Wiki](https://github.com/VeliovGroup/Meteor-Files/wiki) - Full documentation
 - [About this package](https://github.com/VeliovGroup/Meteor-Files#files-for-meteor)
 - [3rd-party storage integration](https://github.com/VeliovGroup/Meteor-Files/wiki/Third-party-storage) examples - AWS S3, DropBox, GridFS and Google Storage
 - [Help / Support](https://github.com/VeliovGroup/Meteor-Files#support)
 - [Support the *MF* project](https://github.com/VeliovGroup/Meteor-Files#support-meteor-files-project)
 - [Contribution](https://github.com/VeliovGroup/Meteor-Files#contribution)
 - [Awards](https://github.com/VeliovGroup/Meteor-Files#awards)
 - [Demo apps and examples](https://github.com/VeliovGroup/Meteor-Files#demo-application)
 - [Related Packages](https://github.com/VeliovGroup/Meteor-Files#related-packages)
 - [Why this package?](https://github.com/VeliovGroup/Meteor-Files#why-meteor-files)
 - [Installation](https://github.com/VeliovGroup/Meteor-Files#installation)
 - [ES6 Import](https://github.com/VeliovGroup/Meteor-Files#es6-import)
 - [FAQ](https://github.com/VeliovGroup/Meteor-Files#faq)
 - [API](https://github.com/VeliovGroup/Meteor-Files#api-overview-full-api):
   * [Initialize Collection](https://github.com/VeliovGroup/Meteor-Files#new-filescollectionconfig-isomorphic)
   * [Upload file](https://github.com/VeliovGroup/Meteor-Files#insertsettings-autostart-client)
   * [Stream files](https://github.com/VeliovGroup/Meteor-Files#stream-files)
   * [Download Button](https://github.com/VeliovGroup/Meteor-Files#download-button)
 - [Supporters](https://github.com/VeliovGroup/Meteor-Files#supporters)

Files for Meteor
========
[Award winning](https://themeteorchef.com/blog/giant-cotton-apron-awards-show), extremely fast and robust package for file uploading, managing and streaming (*Audio & Video & Images*), with support of server's file system (FS) or third party storage, like: *AWS*, *DropBox*, *Google Storage*, *Google Drive*, *GridFS* or any other with API.

Upload, Download, Serve and Stream files within your Meteor application. Without system dependencies, try [demo app](https://github.com/VeliovGroup/Meteor-Files#demo-application), which works smoothly on free/sandbox Heroku plan, [one click Heroku deploy](https://heroku.com/deploy?template=https://github.com/VeliovGroup/Meteor-Files-Demo)

Support:
========
 - [Ask a question via Gitter chat](https://gitter.im/VeliovGroup/Meteor-Files)
 - [Ask a question or submit an issue](https://github.com/VeliovGroup/Meteor-Files/issues)
 - [Releases / Changelog / History](https://github.com/VeliovGroup/Meteor-Files/releases)
 - For more docs and examples [read wiki](https://github.com/VeliovGroup/Meteor-Files/wiki)

Support Meteor-Files project:
========
 - Try [ostr.io](https://ostr.io) - The toolkit for web-developers. By using [ostr.io](https://ostr.io) you are not only [protecting domain names](https://ostr.io/info/domain-names-protection), [monitoring websites and servers](https://ostr.io/info/monitoring), using [Prerendering for better SEO](https://ostr.io/info/prerendering) of your JavaScript website, but support our Open Source activity, and great packages like this one are available for free.
 - [Donate via PayPal](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=FVDSXRFW9VGA2)
 - Star on [GitHub](https://github.com/VeliovGroup/Meteor-Files)
 - Star on [Atmosphere](https://atmospherejs.com/ostrio/files)
 - Share on [Facebook](https://www.facebook.com/sharer.php?u=https%3A%2F%2Fgithub.com%2FVeliovGroup%2FMeteor-Files) and [Twitter](https://twitter.com/share?url=https%3A%2F%2Fgithub.com%2FVeliovGroup%2FMeteor-Files)

Contribution:
========
All PRs is always welcome on [`dev` branch](https://github.com/VeliovGroup/Meteor-Files/tree/dev). Please, always give expressive description to your changes and additions.

Awards:
========
<a href="https://themeteorchef.com/blog/giant-cotton-apron-awards-show"><img src="https://raw.githubusercontent.com/VeliovGroup/Meteor-Files-Demos/master/GCAA.png"></a>

Demo application:
========
 - [Live](https://files.veliov.com)
 - [Source](https://github.com/VeliovGroup/Meteor-Files-Demos/tree/master/demo)
 - [Compiled Demo App](https://github.com/VeliovGroup/Meteor-Files-Demo)
 - [![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/VeliovGroup/Meteor-Files-Demo)

Related Packages:
========
 - [pyfiles (meteor-python-files)](https://github.com/VeliovGroup/meteor-python-files) Python Client for Meteor-Files package
 - [meteor-autoform-file](https://github.com/VeliovGroup/meteor-autoform-file) - Upload and manage files with [autoForm](https://github.com/aldeed/meteor-autoform)

Why `Meteor-Files`?
========
 - Support for `HTTP` and `DDP` transports for upload, [read about difference](https://github.com/VeliovGroup/Meteor-Files/wiki/About-Upload-Transports)
 - You need store to *[GridFS](https://github.com/VeliovGroup/Meteor-Files/wiki/GridFS-Integration)*, *[AWS S3](https://github.com/VeliovGroup/Meteor-Files/wiki/AWS-S3-Integration)*, *[Google Storage](https://github.com/VeliovGroup/Meteor-Files/wiki/Google-Cloud-Storage-Integration)* or *[DropBox](https://github.com/VeliovGroup/Meteor-Files/wiki/DropBox-Integration)*? (*[Use 3rd-party storage](https://github.com/VeliovGroup/Meteor-Files/wiki/Third-party-storage)*) - *Add it yourself*
 - You need to check file mime-type, size or extension? (*[`onBeforeUpload`](https://github.com/VeliovGroup/Meteor-Files/wiki/Constructor)*) - *Add it yourself*
 - You need to [resize images](https://github.com/VeliovGroup/Meteor-Files-Demos/blob/master/demo/server/image-processing.js) after upload? (*[`onAfterUpload`](https://github.com/VeliovGroup/Meteor-Files/wiki/Constructor)*, *[file's subversions](https://github.com/VeliovGroup/Meteor-Files/wiki/Create-and-Manage-Subversions)*) - *Add it yourself*

Easy-peasy kids, *yeah*?

Installation:
========
```shell
meteor add ostrio:files
```

ES6 Import:
========
```jsx
import { FilesCollection } from 'meteor/ostrio:files';
```

FAQ:
========
 1. __Where are files stored by default?__: by default if `config.storagePath` isn't passed into [*Constructor*](https://github.com/VeliovGroup/Meteor-Files/wiki/Constructor) it's equals to `assets/app/uploads` and relative to running script:
    * On `development` stage: `yourDevAppDir/.meteor/local/build/programs/server`. __Note: All files will be removed as soon as your application rebuilds__ or you run `meteor reset`. To keep your storage persistent during development use an absolute path *outside of your project folder*, e.g. `/data` directory.
    * On `production`: `yourProdAppDir/programs/server`. __Note: If using MeteorUp (MUP), Docker volumes must to be added to__ `mup.json`, see [MUP usage](https://github.com/VeliovGroup/Meteor-Files/wiki/MeteorUp-(MUP)-Usage)
 2. __How to pause/continue upload and get progress/speed/remaining time?__: see *Object* returned from [`insert` method](https://github.com/VeliovGroup/Meteor-Files/wiki/Insert-(Upload))
 3. When using any of `accounts` packages - package `accounts-base` must be explicitly added to `.meteor/packages` above `ostrio:files`
 4. __cURL/POST uploads__ - Take a look on [POST-Example](https://github.com/noris666/Meteor-Files-POST-Example) by [@noris666](https://github.com/noris666)

API overview (*[full API](https://github.com/VeliovGroup/Meteor-Files/wiki)*)
========

#### `new FilesCollection([config])` [*Isomorphic*]
Read full docs for [`FilesCollection` Constructor](https://github.com/VeliovGroup/Meteor-Files/wiki/Constructor)

Shared code:
```jsx
import { FilesCollection } from 'meteor/ostrio:files';

const Images = new FilesCollection({
  collectionName: 'Images',
  allowClientCode: false, // Disallow remove files from Client
  onBeforeUpload(file) {
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
```jsx
import { FilesCollection } from 'meteor/ostrio:files';
const Images = new FilesCollection({collectionName: 'Images'});
export default Images; // To be imported in other files
```

Client's code:
```jsx
Template.uploadForm.onCreated(function () {
  this.currentUpload = new ReactiveVar(false);
});

Template.uploadForm.helpers({
  currentUpload() {
    return Template.instance().currentUpload.get();
  }
});

Template.uploadForm.events({
  'change #fileInput'(e, template) {
    if (e.currentTarget.files && e.currentTarget.files[0]) {
      // We upload only one file, in case
      // multiple files were selected
      const upload = Images.insert({
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
For multiple file upload see [this demo code](https://github.com/VeliovGroup/Meteor-Files-Demos/blob/master/demo/client/upload/upload-form.js#L60).

Upload base64 string (*introduced in v1.7.1*):
```js
// As dataURI
Images.insert({
  file: 'data:image/png,base64str…',
  isBase64: true, // <— Mandatory
  fileName: 'pic.png' // <— Mandatory
});

// As plain base64:
Images.insert({
  file: 'base64str…',
  isBase64: true, // <— Mandatory
  fileName: 'pic.png', // <— Mandatory
  type: 'image/png' // <— Mandatory
});
```
For more expressive example see [Upload demo app](https://github.com/VeliovGroup/Meteor-Files-Demos/tree/master/demo-simplest-upload)

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
```jsx
const Images = new FilesCollection({collectionName: 'Images'});
const Videos = new FilesCollection({collectionName: 'Videos'});

if (Meteor.isServer) {
  // Upload sample files on server's startup:
  Meteor.startup(() => {
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
  // Subscribe to file's collections on Client
  Meteor.subscribe('files.images.all');
  Meteor.subscribe('files.videos.all');
}
```

Client's code:
```jsx
Template.file.helpers({
  imageFile() {
    return Images.findOne();
  },
  videoFile() {
    return Videos.findOne();
  }
});
```
For more expressive example see [Streaming demo app](https://github.com/VeliovGroup/Meteor-Files-Demos/tree/master/demo-simplest-streaming)

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
```jsx
const Images = new FilesCollection({collectionName: 'Images'});

if (Meteor.isServer) {
  // Load sample image into FilesCollection on server's startup:
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
  // Subscribe on the client
  Meteor.subscribe('files.images.all');
}
```

Client's code:
```jsx
Template.file.helpers({
  fileRef() {
    return Images.findOne();
  }
});
```
For more expressive example see [Download demo](https://github.com/VeliovGroup/Meteor-Files-Demos/tree/master/demo-simplest-download-button)

Supporters:
========
We would like to thank everyone who support this project. *Because of those guys this project can have 100% of our attention*.
 - [@rikyperdana](https://github.com/rikyperdana)
 - [@derwok](https://github.com/derwok), check out his project - [4minitz](https://www.4minitz.com/)
 - [@FinnFrotscher](https://github.com/FinnFrotscher)
 - [@Neobii](https://github.com/Neobii)
 - [@themeteorchef](https://github.com/themeteorchef)
 - [@MeDBejoHok](https://github.com/medbejohok)
 - [@martunta](https://github.com/martunta)

----

| Meteor-Files | Expressive package to manage files within Meteor |
|:-------------:|:------------- |
| [![logo](https://raw.githubusercontent.com/VeliovGroup/Meteor-Files/master/logo-bw.png)](https://github.com/VeliovGroup/Meteor-Files) | If you found this package useful, please do not hesitate to star it at both [GitHub](https://github.com/VeliovGroup/Meteor-Files) and [Atmosphere](https://atmospherejs.com/ostrio/files). Also you may like to [Tweet](https://twitter.com/share?url=https%3A%2F%2Fgithub.com%2FVeliovGroup%2FMeteor-Files&text=File%20upload%20and%20delivery%20in%20Meteorjs%20-%20now%20it's%20easy!) about it or share at [Facebook](https://www.facebook.com/sharer.php?u=https%3A%2F%2Fgithub.com%2FVeliovGroup%2FMeteor-Files) <br /> [![Donate](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=FVDSXRFW9VGA2) |
