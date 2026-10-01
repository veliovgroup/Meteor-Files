[![support](https://img.shields.io/badge/support-GitHub-white)](https://github.com/sponsors/dr-dimitru)
[![support](https://img.shields.io/badge/support-PayPal-white)](https://paypal.me/veliovgroup)
[![Mentioned in Awesome ostrio:files](https://awesome.re/mentioned-badge.svg)](https://project-awesome.org/Urigo/awesome-meteor#files)
[![GitHub stars](https://img.shields.io/github/stars/veliovgroup/Meteor-Files.svg)](https://github.com/veliovgroup/Meteor-Files/stargazers)
<a href="https://ostr.io/info/built-by-developers-for-developers?ref=github-files-repo-top"><img src="https://ostr.io/apple-touch-icon-60x60.png" alt="ostr.io" height="20"></a>
<a href="https://meteor-files.com/?ref=github-files-repo-top"><img src="https://meteor-files.com/apple-touch-icon-60x60.png" alt="meteor-files.com" height="20"></a>

# Files for Meteor.js

Stable, fast, robust, and well-maintained Meteor.js package for files management using MongoDB Collection API. Call [`.insertAsync()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/insertAsync.md) method to initiate a file upload and to insert new record into MongoDB collection after upload is complete. Calling [`.removeAsync()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/removeAsync.md) method would erase stored file and record from MongoDB Collection. And so on, no need to learn new APIs. Hackable via hooks and events. Supports uploads to AWS:S3, GridFS, Google Storage, DropBox, and other 3rd party storage.

## ToC:

- [📔 Documentation](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/toc.md) - Docs, API, Demos, Examples
- [✨ Key features](https://github.com/veliovgroup/Meteor-Files#key-features)
- [📔 API Documentation](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/readme.md)
- [🔒 Security guide](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/security.md)
- [🚚 Migration to v4](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/migration-to-v4.md)
- [🚚 Migration to v3](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/migration-to-v3.md)
- __⚡️ Quick start__:
  - [🔧 Installation](https://github.com/veliovgroup/Meteor-Files#installation)
  - [👨‍💻 Usage example](https://github.com/veliovgroup/Meteor-Files#api-overview)
- [🤔 FAQ](https://github.com/veliovgroup/Meteor-Files#faq)
- [🏅 Awards](https://github.com/veliovgroup/Meteor-Files#awards)
- [🙋‍♂️ Get Help](https://github.com/veliovgroup/Meteor-Files#get-support)
- [🗂️ Demo applications](https://github.com/veliovgroup/Meteor-Files#demo-applications)
- [📦 Related Packages](https://github.com/veliovgroup/Meteor-Files#related-packages)
- [🎗 Support this project](https://github.com/veliovgroup/Meteor-Files#support-meteor-files-project)
- [👨‍💻 Contribute to this project](https://github.com/veliovgroup/Meteor-Files#contribution)
- [🙏 Supporters](https://github.com/veliovgroup/Meteor-Files#supporters)

## Key features

- Compatible with all front-end frameworks from Blaze to [React](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/react-example.md)
- Upload via `HTTP` and `DDP` transports, [read about difference](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/about-transports.md)
- Sustainable and "resumable" uploads will auto-resume when connection interrupted or server rebooted
- Signed download links with `createDownloadToken()`, they work without a cookie and on any server instance, see the [security guide](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/security.md#signed-download-links)
- Built-in [GridFS storage adapter](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/gridfs-bucket-integration.md#use-gridfs-with-gridfsbucket-as-a-storage) (`GridFSStorage`) and a `storage` option for your own adapter
- Content-based MIME type detection, the server does not trust the type sent by the client
- Uploads resume after a server restart, the server records every written chunk
- Upload files through computing cloud without persistent File System, like Heroku (*"resumable" uploads are not supported on Heroku and alike*)
- Use *[GridFS](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/gridfs-bucket-integration.md#use-gridfs-with-gridfsbucket-as-a-storage)*, *[AWS S3](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/aws-s3-integration.md)*, *[Google Storage](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/google-cloud-storage-integration.md)* or *[DropBox](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/dropbox-integration.md)* and other (*[3rd-party storage](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/3rd-party-storage.md)*)
- APIs for checking file mime-type, size, extension, and other file's properties before upload using *[`onBeforeUpload` hook](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/constructor.md)*
- APIs for [resizing images](https://github.com/veliovgroup/meteor-files-website/blob/master/imports/server/image-processing.js#L19), *[subversions management](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/file-subversions.md)*, and other post-processing tasks using *[`onAfterUpload`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/constructor.md)* and *[`onAfterRemove`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/constructor.md)* hooks

## Installation:

Install [`ostrio:files` from Atmosphere](https://atmospherejs.com/ostrio/files)

```shell
meteor add ostrio:files
```

Requires Meteor 3.2 or newer (v3.1.0 and later).

### Upgrade

Upgrading from 3.x to 4.0.0 changes defaults and removes APIs. Read the [migration guide to v4](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/migration-to-v4.md) and its upgrade checklist first. Coming from 2.x, read [migration to v3](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/migration-to-v3.md) as well.

### ES6 Import:

Import in isomorphic location (e.g. on server and client)

```js
import { FilesCollection } from 'meteor/ostrio:files';
```

## API overview

For detailed docs, examples, and API, read the [documentation section](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/readme.md).

__Main methods:__

- [`FilesCollection` Constructor](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/constructor.md) [*Isomorphic*] - Initialize FilesCollection
- [`insertAsync()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/insertAsync.md) [*Client*] - Upload a file to server, returns a `Promise` that resolves with the `UploadInstance` (`FileUpload`) when `autoStart` is `true`
- [`link()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/link.md) [*Isomorphic*] - Generate downloadable link
- [`find()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/find.md) [*Isomorphic*] - Find all files matching selector, returns [`FilesCursor` instance](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/FilesCursor.md)
- [`findOneAsync()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/findOneAsync.md) [*Isomorphic*] - Find a single file record matching selector, returns [`FileCursor` instance](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/FileCursor.md)
- [`removeAsync()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/removeAsync.md) [*Isomorphic*] - Asynchronously remove files from FilesCollection and "unlink" (e.g. remove) from Server
- [`addFile()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/addFile.md) [*Server*] - Add local file to FilesCollection from FS
- [`loadAsync()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/loadAsync.md) [*Server*] - Write file to FS and FilesCollection from remote URL
- [`writeAsync()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/writeAsync.md) [*Server*] - Write `Buffer` to FS and FilesCollection

### Constructor

__[*Isomorphic*]__. Initiate file's collection in the similar way to `Mongo.Collection` with optional settings related to file-uploads. Read full docs for [`FilesCollection` Constructor in the API documentation](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/constructor.md).

```js
import { FilesCollection } from 'meteor/ostrio:files';
new FilesCollection(FilesCollectionConfig);
```

Pass additional options to control upload-flow

```js
// shared: /imports/lib/collections/images.collection.js
import { Meteor } from 'meteor/meteor';
import { FilesCollection } from 'meteor/ostrio:files';

const imagesCollection = new FilesCollection({
  collectionName: 'images',
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
  // SUBSCRIBE TO ALL UPLOADED FILES ON THE CLIENT
  Meteor.subscribe('files.images.all');
}

if (Meteor.isServer) {
  // PUBLISH ALL UPLOADED FILES ON THE SERVER
  // Demo only: publishes every file record to every client. Filter by `userId` in production, see docs/security.md
  Meteor.publish('files.images.all', function () {
    return imagesCollection.collection.find();
  });
}
```

### Upload a file

```ts
import { FilesCollection } from 'meteor/ostrio:files';
const files = new FilesCollection(FilesCollectionConfig);
files.insertAsync(config: InsertOptions, autoStart?: boolean): Promise<FileUpload | UploadInstance>;
```

Read full docs for [`insertAsync()` method](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/insertAsync.md)

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
const imagesCollection = new FilesCollection({collectionName: 'images'});
export default imagesCollection; // import in other files
```

Client's code:

```js
import { Template } from 'meteor/templating';
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
  async 'change #fileInput'(e, template) {
    if (e.currentTarget.files && e.currentTarget.files[0]) {
      // We upload only one file, in case
      // multiple files were selected
      const upload = await imagesCollection.insertAsync({
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

      await upload.start();
    }
  }
});
```

For multiple file upload see [this demo code](https://github.com/veliovgroup/meteor-files-website/blob/master/imports/client/upload/upload-form.js#L130).

Upload base64 string (*introduced in v1.7.1*):

```js
// As dataURI
await imagesCollection.insertAsync({
  file: 'data:image/png;base64,base64str…',
  isBase64: true, // <— Mandatory
  fileName: 'pic.png' // <— Mandatory
});

// As plain base64:
await imagesCollection.insertAsync({
  file: 'base64str…',
  isBase64: true, // <— Mandatory
  fileName: 'pic.png', // <— Mandatory
  type: 'image/png' // <— Mandatory
});
```

For more expressive example see [Upload demo app](https://github.com/veliovgroup/Meteor-Files-Demos/tree/master/demo-simplest-upload)

### Stream files

To display files you can use [`fileURL`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/template-helper.md) template helper or [`link()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/link.md) method of [`FileCursor` instance](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/FileCursor.md).

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
// imports/lib/collections/files.collection.js
import { Meteor } from 'meteor/meteor';
import { FilesCollection } from 'meteor/ostrio:files';

export const imagesCollection = new FilesCollection({ collectionName: 'images' });
export const videosCollection = new FilesCollection({ collectionName: 'videos' });

if (Meteor.isServer) {
  // Upload sample files on server's startup:
  Meteor.startup(async () => {
    await imagesCollection.loadAsync('https://raw.githubusercontent.com/veliovgroup/Meteor-Files/master/logo.png', {
      fileName: 'logo.png'
    });
    await videosCollection.loadAsync('https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4', {
      fileName: 'Big-Buck-Bunny.mp4'
    });
  });

  // Demo only: publishes every file record to every client. Filter by `userId` in production, see docs/security.md
  Meteor.publish('files.images.all', function () {
    return imagesCollection.collection.find();
  });

  Meteor.publish('files.videos.all', function () {
    return videosCollection.collection.find();
  });
} else {
  // Subscribe to file's collections on Client
  Meteor.subscribe('files.images.all');
  Meteor.subscribe('files.videos.all');
}
```

Client's code. The synchronous `findOne()` works on the Client only. Use [`findOneAsync()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/findOneAsync.md) on the Server.

```js
// imports/client/file/file.js
import { Template } from 'meteor/templating';
import '/imports/client/file/file.html';
import { imagesCollection, videosCollection } from '/imports/lib/collections/files.collection.js';

Template.file.helpers({
  imageFile() {
    return imagesCollection.findOne();
  },
  videoFile() {
    return videosCollection.findOne();
  }
});
```

For more expressive example see [Streaming demo app](https://github.com/veliovgroup/Meteor-Files-Demos/tree/master/demo-simplest-streaming)

### Download button

Create collection available to Client and Server

```js
// imports/lib/collections/images.collection.js
import { Meteor } from 'meteor/meteor';
import { FilesCollection } from 'meteor/ostrio:files';
const imagesCollection = new FilesCollection({ collectionName: 'images' });
export default imagesCollection;

if (Meteor.isServer) {
  // Load sample image into FilesCollection on server's startup:
  Meteor.startup(async () => {
    await imagesCollection.loadAsync('https://raw.githubusercontent.com/veliovgroup/Meteor-Files/master/logo.png', {
      fileName: 'logo.png',
    });
  });

  // Demo only: publishes every file record to every client. Filter by `userId` in production, see docs/security.md
  Meteor.publish('files.images.all', function () {
    return imagesCollection.collection.find();
  });
} else {
  // Subscribe on the client
  Meteor.subscribe('files.images.all');
}
```

Create template, call `.link` method on the `FileCursor` returned from `file` helper

```html
<!-- imports/client/file/file.html -->
<template name='file'>
  <a href="{{file.link}}?download=true" download="{{file.name}}" target="_parent">
    {{file.name}}
  </a>
</template>
```

Create controller for `file` template with `file` helper that returns `FileCursor` with `.link()` method

```js
// imports/client/file/file.js
import { Template } from 'meteor/templating';
import '/imports/client/file/file.html';
import imagesCollection from '/imports/lib/collections/images.collection.js';

Template.file.helpers({
  file() {
    return imagesCollection.findOne();
  }
});
```

For more expressive example see [Download demo](https://github.com/veliovgroup/Meteor-Files-Demos/tree/master/demo-simplest-download-button)

## FAQ:

1. __Where are files stored by default?__: by default if `config.storagePath` isn't set in [*Constructor* options](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/constructor.md) it equals `assets/app/uploads/<collectionName>` and is relative to the running script:
    - __a.__ On `development` stage: `yourDevAppDir/.meteor/local/build/programs/server`. __Note: All files will be removed as soon as your application rebuilds__ or you run `meteor reset`. To keep your storage persistent during development use an absolute path *outside of your project folder*, e.g. `/data` directory.
    - __b.__ On `production`: `yourProdAppDir/programs/server`. __Note: If using MeteorUp (MUP), Docker volumes must be added to__ `mup.js`, see [MUP usage](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/meteorup-usage.md)
2. __Cordova usage and development__: To use `Meteor-Files` in a Cordova app, enable [withCredentials](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/withCredentials); enable `{allowQueryStringCookies: true}` and `{allowedCordovaOrigins: true}` on both `Client` and `Server` (see [security notes](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/security.md)). For more details read [Cookie's repository FAQ](https://github.com/veliovgroup/Meteor-Cookies#faq)
3. __meteor-desktop usage and development__: Meteor-Files can be used in [meteor-desktop](https://github.com/Meteor-Community-Packages/meteor-desktop) projects as well. As meteor-desktop works exactly like Cordova, all Cordova requirements and recommendations apply
4. __How to pause/continue upload and get progress/speed/remaining time?__: see *FileUpload* instance returned from [`insertAsync` method](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/insertAsync.md)
5. When using any of `accounts` packages - package `accounts-base` must be explicitly added to `.meteor/packages` __above__ `ostrio:files`
6. __cURL/POST uploads__ - Take a look on [POST-Example](https://github.com/noris666/Meteor-Files-POST-Example) by [@noris666](https://github.com/noris666)
7. In __Safari__ (Mobile and Desktop) for `DDP` the algorithm reduces the chunk size, because Safari throws an error if a frame is too big. Switching to `http` transport (*which has no such issue*) is recommended for Safari. See [#458](https://github.com/veliovgroup/Meteor-Files/issues/458)
8. Make sure you're using single domain for the Meteor app, and the same domain for hosting Meteor-Files endpoints, see [#737](https://github.com/veliovgroup/Meteor-Files/issues/737) for details
9. When requests are proxied to `FilesCollection` endpoint make sure protocol `http/1.1` is used, see [#742](https://github.com/veliovgroup/Meteor-Files/issues/742) for details

## Awards:

<a href="https://github.com/themeteorchef">
  <img src="https://raw.githubusercontent.com/veliovgroup/Meteor-Files-Demos/master/GCAA.png" alt="GCAA award" width="120">
</a>

## Get Support:

- [Ask a question or submit an issue](https://github.com/veliovgroup/Meteor-Files/issues)
- [Releases / Changelog / History](https://github.com/veliovgroup/Meteor-Files/releases)
- For more docs and examples [read the documentation](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/readme.md)

## Demo applications:

Fully-featured file-sharing app:

- [Live: __files.veliov.com__](https://files.veliov.com)
- [Source Code Rep](https://github.com/veliovgroup/meteor-files-website)

Other demos:

- [Simplest Upload demo app](https://github.com/veliovgroup/Meteor-Files-Demos/tree/master/demo-simplest-upload)
- [Simplest Download demo](https://github.com/veliovgroup/Meteor-Files-Demos/tree/master/demo-simplest-download-button)
- [Simplest Streaming demo app](https://github.com/veliovgroup/Meteor-Files-Demos/tree/master/demo-simplest-streaming)

## Related Packages:

- [pyfiles (meteor-python-files)](https://github.com/veliovgroup/meteor-python-files) Python Client for Meteor-Files package
- [meteor-autoform-file](https://github.com/veliovgroup/meteor-autoform-file) - Upload and manage files with [autoForm](https://github.com/aldeed/meteor-autoform)

## Support Meteor-Files project:

- 🗃️ Upload and share files using [meteor-files.com](https://meteor-files.com/?ref=github-files-repo-footer). Continue interrupted file uploads without losing any progress. There is nothing that will stop Meteor from delivering your file to the desired destination
- 👨‍💻 Improve your project using [ostr.io](https://ostr.io?ref=github-files-repo-footer) for [Server Monitoring](https://snmp-monitoring.com), [Web Analytics](https://ostr.io/info/web-analytics?ref=github-files-repo-footer), [WebSec](https://domain-protection.info), [Web-CRON](https://web-cron.info) and [SEO Pre-rendering](https://prerendering.com)
- 💵 [Sponsor via GitHub](https://github.com/sponsors/dr-dimitru)
- 💵 [Support via PayPal](https://paypal.me/veliovgroup)
- ⭐️ Star on [GitHub](https://github.com/veliovgroup/Meteor-Files)
- ⭐️ Star on [Atmosphere](https://atmospherejs.com/ostrio/files)

## Contribution:

- __Want to help?__ Please check [issues](https://github.com/veliovgroup/Meteor-Files/issues) for open and tagged as [`help wanted` issues](https://github.com/veliovgroup/Meteor-Files/issues?q=is%3Aissue+is%3Aopen+label%3A"help+wanted");
- __Want to contribute?__ Read and follow [PR rules](https://github.com/veliovgroup/Meteor-Files/blob/master/.github/PULL_REQUEST_TEMPLATE). All PRs are welcome on [`dev` branch](https://github.com/veliovgroup/Meteor-Files/tree/dev). Please, always give expressive description to your changes and additions.

## Supporters:

We would like to thank everyone who supports this project

- [@vanshady](https://github.com/vanshady)
- [@Neophen](https://github.com/Neophen)
- [@rikyperdana](https://github.com/rikyperdana)
- [@derwok](https://github.com/derwok), check out his project - [4minitz](https://www.4minitz.com/)
- [@FinnFrotscher](https://github.com/FinnFrotscher)
- [@Neobii](https://github.com/Neobii)
- [@themeteorchef](https://github.com/themeteorchef)
- [@MeDBejoHok](https://github.com/medbejohok)
- [@martunta](https://github.com/martunta)
