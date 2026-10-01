# Create thumbnails after upload

This tutorial creates thumbnails with [sharp](https://sharp.pixelplumbing.com/) after a file is fully uploaded to the Server. `sharp` ships prebuilt binaries for common platforms, so no ImageMagick or GraphicsMagick install is needed.

Links:

- [sharp](https://sharp.pixelplumbing.com/) docs and [NPM package](https://www.npmjs.com/package/sharp)
- See how this example is [used in our demo app](https://github.com/veliovgroup/meteor-files-website/blob/master/imports/server/image-processing.js)

The old `gm`, `im`, and `imagemagick-native` packages are no longer maintained (`imagemagick-native` is abandoned). Use `sharp`.

## Install Meteor/NPM packages

```shell
meteor add ostrio:files
meteor npm install --save sharp
```

## Create FilesCollection

Initiate *FilesCollection* (`/lib/files.js`):

```js
import { FilesCollection } from 'meteor/ostrio:files';

const uploadsCollection = new FilesCollection({
  collectionName: 'uploads',
  storagePath: 'assets/app/uploads/uploadedFiles'
});

export default uploadsCollection;
```

## Upload form example

Simple upload form (`/client/upload.html`):

```handlebars
<template name="uploadForm">
  {{#if upload}}
    <ul>
      <span>{{upload.progress.get}}%</span>
    </ul>
  {{else}}
    <input data-upload-file type="file"/>
  {{/if}}
</template>
```

Simple upload form (`/client/upload.js`):

```js
import { Template }    from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';

import uploadsCollection from '/lib/files.js';
import './upload.html';

Template.uploadForm.onCreated(function () {
  this.upload = new ReactiveVar(false);
});

Template.uploadForm.helpers({
  upload() {
    return Template.instance().upload.get();
  }
});

Template.uploadForm.events({
  async 'change [data-upload-file]'(e, template) {
    if (e.currentTarget.files && e.currentTarget.files[0]) {
      const uploader = await uploadsCollection.insertAsync({
        file: e.currentTarget.files[0],
        chunkSize: 'dynamic'
      }, false);

      uploader.on('start', function () {
        template.upload.set(this);
      });

      uploader.on('end', (error, fileObj) => {
        template.upload.set(false);
      });

      uploader.on('uploaded', (error, fileObj) => {
        if (!error) {
          window.alert(`File "${fileObj.name}" successfully uploaded`);
        }
      });

      uploader.on('error', (error, fileObj) => {
        window.alert('Error during upload: ' + error);
      });

      await uploader.start();
    }
  }
});
```

## Catch uploaded files

Catch `afterUpload` event (`/server/files.js`):

```js
import uploadsCollection from '/lib/files.js';
import createThumbnails from '/server/image-processing.js';

uploadsCollection.on('afterUpload', async (fileRef) => {
  // Run `createThumbnails` only over PNG, JPG and JPEG files
  if (/png|jpe?g/i.test(fileRef.extension || '')) {
    try {
      await createThumbnails(uploadsCollection, fileRef);
    } catch (error) {
      console.error(error);
    }
  }
});
```

## Process uploaded images

Create thumbnails (`/server/image-processing.js`):

```js
import { check } from 'meteor/check';
import { Meteor } from 'meteor/meteor';
import fs from 'node:fs';
import sharp from 'sharp';

const createThumbnails = async (collection, fileRef) => {
  check(fileRef, Object);

  try {
    await fs.promises.access(fileRef.path);
  } catch (_error) {
    throw new Meteor.Error(404, `File ${fileRef.path} not found in [createThumbnails]`);
  }

  // Read original image dimensions
  const original = await sharp(fileRef.path).metadata();

  // Update meta data of the original image
  await collection.collection.updateAsync(fileRef._id, {
    $set: {
      'meta.width': original.width,
      'meta.height': original.height,
      'versions.original.meta.width': original.width,
      'versions.original.meta.height': original.height
    }
  });

  const path = `${collection.storagePath(fileRef)}/thumbnail-${fileRef._id}.${fileRef.extension}`;

  // Change width and height proportionally,
  // `rotate()` applies the EXIF orientation, metadata is stripped by default
  let image = sharp(fileRef.path)
    .rotate()
    .resize({ width: 250 });

  // Set format options for the original's format only. The last format call wins in sharp
  const extension = fileRef.extension.toLowerCase();
  if (extension === 'png') {
    image = image.png({ compressionLevel: 9 });
  } else if (extension === 'jpg' || extension === 'jpeg') {
    image = image.jpeg({ quality: 70, progressive: true });
  }

  // Without a format call sharp picks the format from the file extension of `path`
  const info = await image.toFile(path);

  const stat = await fs.promises.stat(path);

  const thumbnail = {
    path,
    size: stat.size,
    type: fileRef.type,
    extension: fileRef.extension,
    name: fileRef.name, // <-- Name with extension used when file's version is being downloaded
    meta: {
      width: info.width,
      height: info.height
    }
  };

  await collection.collection.updateAsync(fileRef._id, {
    $set: { 'versions.thumbnail': thumbnail }
  });

  return { ...fileRef, versions: { ...fileRef.versions, thumbnail } };
};

export default createThumbnails;
```

Notes:

- A format call such as `jpeg()` or `png()` sets the output format, and the last one wins. The example calls only the one that matches the original's extension, so the thumbnail keeps the original's format and `type`
- The thumbnail path must be inside `storagePath`, as in the example
