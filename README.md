[![support](https://img.shields.io/badge/support-GitHub-white)](https://github.com/sponsors/dr-dimitru)
[![support](https://img.shields.io/badge/support-PayPal-white)](https://paypal.me/veliovgroup)
[![Mentioned in Awesome ostrio:files](https://awesome.re/mentioned-badge.svg)](https://project-awesome.org/Urigo/awesome-meteor#files)
[![GitHub stars](https://img.shields.io/github/stars/veliovgroup/Meteor-Files.svg)](https://github.com/veliovgroup/Meteor-Files/stargazers)
<a href="https://ostr.io/info/built-by-developers-for-developers">
  <img src="https://ostr.io/apple-touch-icon-60x60.png" height="20">
</a>

# Files for Meteor.js

Stable, fast, robust, and well-maintained Meteor.js package for files management using MongoDB Collection API. What does exactly this means? Calling [`.insert()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/insert.md) method would initiate a file upload and then insert new record into collection. Calling [`.remove()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/remove.md) method would erase stored file and record from MongoDB Collection. And so on, no need to learn new APIs. It's flavored with extra low-level methods like [`.unlink()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/unlink.md) and [`.write()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/write.md) for complex integrations.

## ToC:

- [Wiki](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/toc.md) - Full documentation
- [Installation](https://github.com/veliovgroup/Meteor-Files#installation)
  - [ES6 Import](https://github.com/veliovgroup/Meteor-Files#es6-import)
- [API](https://github.com/veliovgroup/Meteor-Files#api-overview-full-api):
  - [Initialize Collection](https://github.com/veliovgroup/Meteor-Files#new-filescollectionconfig-isomorphic)
  - [Upload file](https://github.com/veliovgroup/Meteor-Files#insertsettings-autostart-client)
  - [Stream files](https://github.com/veliovgroup/Meteor-Files#stream-files)
  - [Download Button](https://github.com/veliovgroup/Meteor-Files#download-button)
- [Documentation and tutorials](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/toc.md)
  - [__Demo apps and examples__](https://github.com/veliovgroup/Meteor-Files#demo-application)
  - [3rd-party storage integration](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/3rd-party-storage.md) examples - AWS S3, DropBox, GridFS and Google Storage
  - [TypeScript Definitions](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/typescript-definitions.md)
- [Related Packages](https://github.com/veliovgroup/Meteor-Files#related-packages)
- [Why this package?](https://github.com/veliovgroup/Meteor-Files#why-meteor-files)
- [Help / Support](https://github.com/veliovgroup/Meteor-Files#get-support)
- [FAQ](https://github.com/veliovgroup/Meteor-Files#faq)
- [Awards](https://github.com/veliovgroup/Meteor-Files#awards)
- [Help & Contribute](https://github.com/veliovgroup/Meteor-Files#contribution)
- [Support this project](https://github.com/veliovgroup/Meteor-Files#support-meteor-files-project)
- [Supporters](https://github.com/veliovgroup/Meteor-Files#supporters)

## Why `Meteor-Files`?

- Compatible with all front-end frameworks from Blaze to [React](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/react-example.md)
- Upload via `HTTP` and `DDP` transports, [read about difference](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/about-transports.md)
- Sustainable and resumable uploads, which will survive connection interruption and server reboot (*if a server has persistent storage*)
- Upload files through computing cloud without persistent File System, like Heroku
- You need store files at *[GridFS](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/gridfs-bucket-integration.md#use-gridfs-with-gridfsbucket-as-a-storage)*, *[AWS S3](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/aws-s3-integration.md)*, *[Google Storage](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/google-cloud-storage-integration.md)* or *[DropBox](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/dropbox-integration.md)*? (*[Use 3rd-party storage](hhttps://github.com/veliovgroup/Meteor-Files/blob/master/docs/3rd-party-storage.md)*)
- You need to check file mime-type, size or extension? Easy! Use *[`onBeforeUpload`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/constructor.md)* hook
- You need to [resize images](https://github.com/veliovgroup/meteor-files-website/blob/master/imports/server/image-processing.js#L19) after upload? Easy too! Use *[`onAfterUpload`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/constructor.md)* hook, and *[manage file's subversions](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/file-subversions.md)* in a single record

## Installation:

```shell
meteor add ostrio:files
```

### ES6 Import:

```js
import { FilesCollection } from 'meteor/ostrio:files';
```

## API overview (*[full API](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/readme.md)*)

### `new FilesCollection([config])` [*Isomorphic*]

Read full docs for [`FilesCollection` Constructor](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/constructor.md)

Shared code:

```js
import { Meteor } from 'meteor/meteor';
import { FilesCollection } from 'meteor/ostrio:files';

const Images = new FilesCollection({
  collectionName: 'Images',
  allowClientCode: false, // Disallow remove files from Client
  onBeforeUpload(file) {
    // Allow upload files under 10MB, and only in png/jpg/jpeg formats
    if (file.size <= 10485760 && /png|jpg|jpeg/i.test(file.extension)) {
      return true;
    }
    return 'Please upload image, with size equal or less than 10MB';
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

### `insert(settings[, autoStart])` [*Client*]

Read full docs for [`insert()` method](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/insert.md)

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

```js
import { FilesCollection } from 'meteor/ostrio:files';
const Images = new FilesCollection({collectionName: 'Images'});
export default Images; // import in other files
```

Client's code:

```js
import { Template }    from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
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
        chunkSize: 'dynamic'
      }, false);

      upload.on('start', function () {
        template.currentUpload.set(this);
      });

      upload.on('end', function (error, fileObj) {
        if (error) {
          alert(`Error during upload: ${error}`);
        } else {
          alert(`File "${fileObj.name}" successfully uploaded`);
        }
        template.currentUpload.set(false);
      });

      upload.start();
    }
  }
});
```

For multiple file upload see [this demo code](https://github.com/veliovgroup/meteor-files-website/blob/master/imports/client/upload/upload-form.js#L130).

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

For more expressive example see [Upload demo app](https://github.com/veliovgroup/Meteor-Files-Demos/tree/master/demo-simplest-upload)

### Stream files

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

```js
import { Meteor } from 'meteor/meteor';
import { FilesCollection } from 'meteor/ostrio:files';

const Images = new FilesCollection({collectionName: 'Images'});
const Videos = new FilesCollection({collectionName: 'Videos'});

if (Meteor.isServer) {
  // Upload sample files on server's startup:
  Meteor.startup(() => {
    Images.load('https://raw.githubusercontent.com/veliovgroup/Meteor-Files/master/logo.png', {
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

```js
Template.file.helpers({
  imageFile() {
    return Images.findOne();
  },
  videoFile() {
    return Videos.findOne();
  }
});
```

For more expressive example see [Streaming demo app](https://github.com/veliovgroup/Meteor-Files-Demos/tree/master/demo-simplest-streaming)

### Download button

Template:

```html
<template name='file'>
  <a href="{{file.link}}?download=true" download="{{file.name}}" target="_parent">
    {{file.name}}
  </a>
</template>
```

Shared code:

```js
import { Meteor } from 'meteor/meteor';
import { FilesCollection } from 'meteor/ostrio:files';
const Images = new FilesCollection({collectionName: 'Images'});

if (Meteor.isServer) {
  // Load sample image into FilesCollection on server's startup:
  Meteor.startup(function () {
    Images.load('https://raw.githubusercontent.com/veliovgroup/Meteor-Files/master/logo.png', {
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

```js
Template.file.helpers({
  fileRef() {
    return Images.findOne();
  }
});
```

For more expressive example see [Download demo](https://github.com/veliovgroup/Meteor-Files-Demos/tree/master/demo-simplest-download-button)

## FAQ:

1. __Where are files stored by default?__: by default if `config.storagePath` isn't passed into [*Constructor*](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/constructor.md) it's equals to `assets/app/uploads` and relative to running script:
    - __a.__ On `development` stage: `yourDevAppDir/.meteor/local/build/programs/server`. __Note: All files will be removed as soon as your application rebuilds__ or you run `meteor reset`. To keep your storage persistent during development use an absolute path *outside of your project folder*, e.g. `/data` directory.
    - __b.__ On `production`: `yourProdAppDir/programs/server`. __Note: If using MeteorUp (MUP), Docker volumes must to be added to__ `mup.json`, see [MUP usage](hhttps://github.com/veliovgroup/Meteor-Files/blob/master/docs/meteorup-usage.md)
2. __Cordova usage and development__: With support of community we do regular testing on virtual and real devices. To make sure `Meteor-Files` library runs smoothly in Cordova environment — enable [withCredentials](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/withCredentials); enable `{allowQueryStringCookies: true}` and `{allowedOrigins: true}` on both `Client` and `Server`. For more details read [Cookie's repository FAQ](https://github.com/veliovgroup/Meteor-Cookies#faq)
3. __How to pause/continue upload and get progress/speed/remaining time?__: see *Object* returned from [`insert` method](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/insert.md)
4. When using any of `accounts` packages - package `accounts-base` must be explicitly added to `.meteor/packages` above `ostrio:files`
5. __cURL/POST uploads__ - Take a look on [POST-Example](https://github.com/noris666/Meteor-Files-POST-Example) by [@noris666](https://github.com/noris666)
6. In __Safari__ (Mobile and Desktop) for `DDP` chunk size is reduced by algorithm, due to error thrown if frame is too big. Limit simultaneous uploads to `6` is recommended for Safari. This issue should be fixed in Safari 11. Switching to `http` transport (*which has no such issue*) is recommended for Safari. See [#458](https://github.com/veliovgroup/Meteor-Files/issues/458)
7. Make sure you're using single domain for the Meteor app, and the same domain for hosting Meteor-Files endpoints, see [#737](https://github.com/veliovgroup/Meteor-Files/issues/737) for details
8. When proxying requests to Meteor-Files endpoint make sure protocol `http/1.1` is used, see [#742](https://github.com/veliovgroup/Meteor-Files/issues/742) for details

## Awards:

<a href="https://themeteorchef.com/blog/giant-cotton-apron-awards-show">
  <img src="https://raw.githubusercontent.com/veliovgroup/Meteor-Files-Demos/master/GCAA.png" width="160">
</a>

## Get Support:

- [Ask a question via Gitter chat](https://gitter.im/veliovgroup/Meteor-Files)
- [Ask a question or submit an issue](https://github.com/veliovgroup/Meteor-Files/issues)
- [Releases / Changelog / History](https://github.com/veliovgroup/Meteor-Files/releases)
- For more docs and examples [read wiki](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/readme.md)

## Demo application:

- [Live: __files.veliov.com__](https://files.veliov.com)
- [Source Code Rep](https://github.com/veliovgroup/meteor-files-website#file-sharing-web-app)

## Related Packages:

- [pyfiles (meteor-python-files)](https://github.com/veliovgroup/meteor-python-files) Python Client for Meteor-Files package
- [meteor-autoform-file](https://github.com/veliovgroup/meteor-autoform-file) - Upload and manage files with [autoForm](https://github.com/aldeed/meteor-autoform)

## Support Meteor-Files project:

- Star on [GitHub](https://github.com/veliovgroup/Meteor-Files)
- Star on [Atmosphere](https://atmospherejs.com/ostrio/files)
- Share via [Facebook](https://www.facebook.com/sharer.php?u=https%3A%2F%2Fgithub.com%2FVeliovGroup%2FMeteor-Files) and [Twitter](https://twitter.com/share?url=https%3A%2F%2Fgithub.com%2FVeliovGroup%2FMeteor-Files)
- [Sponsor via GitHub](https://github.com/sponsors/dr-dimitru)
- [Support via PayPal](https://paypal.me/veliovgroup) — support my open source contributions once or on regular basis
- Use [ostr.io](https://ostr.io) — [Monitoring](https://snmp-monitoring.com), [Analytics](https://ostr.io/info/web-analytics), [WebSec](https://domain-protection.info), [Web-CRON](https://web-cron.info) and [Pre-rendering](https://prerendering.com) for a website

## Contribution:

- __Want to help?__ Please check [issues](https://github.com/veliovgroup/Meteor-Files/issues) for open and tagged as [`help wanted` issues](https://github.com/veliovgroup/Meteor-Files/issues?q=is%3Aissue+is%3Aopen+label%3A"help+wanted");
- __Want to contribute?__ Read and follow [PR rules](https://github.com/veliovgroup/Meteor-Files/blob/master/.github/PULL_REQUEST_TEMPLATE). All PRs are welcome on [`dev` branch](https://github.com/veliovgroup/Meteor-Files/tree/dev). Please, always give expressive description to your changes and additions.

## Supporters:

We would like to thank everyone who support this project. *Because of those guys this project can have 100% of our attention*.

- [@vanshady](https://github.com/vanshady)
- [@Neophen](https://github.com/Neophen)
- [@rikyperdana](https://github.com/rikyperdana)
- [@derwok](https://github.com/derwok), check out his project - [4minitz](https://www.4minitz.com/)
- [@FinnFrotscher](https://github.com/FinnFrotscher)
- [@Neobii](https://github.com/Neobii)
- [@themeteorchef](https://github.com/themeteorchef)
- [@MeDBejoHok](https://github.com/medbejohok)
- [@martunta](https://github.com/martunta)
