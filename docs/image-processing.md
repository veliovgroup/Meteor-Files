### Create thumbnails after upload

At this tutorial we will create thumbnails with GraphicksMagick/ImageMagick (*a.k.a. `gm`/`im`*) after file is fully uploaded to Server. Note: GraphicksMagick or ImageMagick should be installed on dev/prod machine before you implement code below.

Links:
 - [GraphicksMagick](https://sourceforge.net/projects/graphicsmagick/)
 - [ImageMagick](https://www.imagemagick.org/script/download.php)
 - See how this example used in [real-life production code](https://github.com/VeliovGroup/Meteor-Files-Demos/blob/master/demo/imports/server/image-processing.js#L19)
 - [gm](https://www.npmjs.com/package/gm) NPM package
 - [im](https://www.npmjs.com/package/im) NPM package
 - [imagemagick-native](https://www.npmjs.com/package/imagemagick-native) NPM package

### Install image library
__TL;TR;__ - There is various software solutions to accomplish this task. All links to make a decision is above. If you don't have time to deal with a choice - install [GraphicksMagick](https://sourceforge.net/projects/graphicsmagick/) as a library and [gm](https://www.npmjs.com/package/gm) as NPM package.

Before you go - install ImageMagick or GraphicksMagick CLI tools. There are numerous ways to install it. For instance, if you're on OS X you can use Homebrew:
```shell
brew install graphicsmagick
# or for ImageMagick:
# brew install imagemagick
```

Some platforms may bundle ImageMagick into their tools (like Heroku). In this case you may use GraphicsMagick as ImageMagick in this way:
```shell
npm install gm --save

And then where you use it: 
```jsx
const gm = require('gm'); 
const im = gm.subClass({ imageMagick: true });
```

Please note that GM was considered slightly faster than IM so before you chose convenience over performance read the latest news about it, - [see the comparison](https://mazira.com/blog/comparing-speed-imagemagick-graphicsmagick).

### Install Meteor/NPM packages
```shell
meteor add ostrio:files
meteor npm install --save gm fs-extra
```

### Create FilesCollection
Initiate *FilesCollection* (`/lib/files.js`):
```jsx
import { FilesCollection }   from 'meteor/ostrio:files';

const uploadsCollection = new FilesCollection({
  storagePath: 'assets/app/uploads/uploadedFiles'
});

export default uploadsCollection;
```

### Upload form example
Simple upload form (`/client/upload.html`):
```html
<template name="uploadForm">
  {{#if upload}}
    <ul>
      <span id="progress">{{upload.progress}}%</span>
    </ul>
  {{else}}
    <input id="fileInput" type="file" />
  {{/if}}
</template>
```

Simple upload form (`/client/upload.js`):
```jsx
import { Template }    from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';

import uploadsCollection from '/lib/files.js';
import './upload.html';

Template.uploadForm.onCreated(function () {
  this.upload = new ReactiveVar(false);
});

Template.uploadForm.helpers({
  upload() {
    Template.instance().upload.get();
  }
});

Template.uploadForm.events({
  'change #fileInput'(e, template) {
    if (e.currentTarget.files && e.currentTarget.files[0]) {
      const uploader = uploadsCollection.insert({
        file: e.currentTarget.files[0],
        streams: 'dynamic',
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
          window.alert('File "' + fileObj.name + '" successfully uploaded');
        }
      });

      uploader.on('error', (error, fileObj) => {
        window.alert('Error during upload: ' + error);
      });

      uploader.start();
    }
  }
});
```

### Catch uploaded files
Catch `afterUpload` event (`/server/files.js`):
```jsx
import uploadsCollection from '/lib/files.js';
import createThumbnails from '/server/image-processing.js';

uploadsCollection.on('afterUpload', function(fileRef) {
  // Run `createThumbnails` only over PNG, JPG and JPEG files
  if (/png|jpe?g/i.test(fileRef.extension || '')) {
    createThumbnails(this, fileRef, (error, fileRef) => {
      if (error) {
        console.error(error);
      }
    });
  }
});
```

### Process uploaded images
Create thumbnails (`/server/image-processing.js`):
```jsx
import { check }  from 'meteor/check';
import { Meteor } from 'meteor/meteor';

import fs from 'fs-extra';
import gm from 'gm';

const bound = Meteor.bindEnvironment((callback) => {
  return callback();
});

const createThumbnails = (collection, fileRef, cb) => {
  check(fileRef, Object);

  fs.exists(fileRef.path, (exists) => {
    bound(() => {
      if (!exists) {
        throw Meteor.log.error('File ' + fileRef.path + ' not found in [createThumbnails] Method');
      }

      const image = gm(fileRef.path);

      image.size((error, features) => {
        bound(() => {
          if (error) {
            console.error('[_app.createThumbnails] [_.each sizes]', error);
            cb && cb(Meteor.Error('[_app.createThumbnails] [image.size]', error));
            return;
          }

          // Update meta data if original image
          collection.collection.update(fileRef._id, {
            $set: {
              'meta.width': features.width,
              'meta.height': features.height,
              'versions.original.meta.width': features.width,
              'versions.original.meta.height': features.height
            }
          });

          const path = (collection.storagePath(fileRef)) + '/thumbnail-' + fileRef._id + '.' + fileRef.extension;
          const img = gm(fileRef.path)
            .quality(70)
            .define('filter:support=2')
            .define('jpeg:fancy-upsampling=false')
            .define('jpeg:fancy-upsampling=off')
            .define('png:compression-filter=5')
            .define('png:compression-level=9')
            .define('png:compression-strategy=1')
            .define('png:exclude-chunk=all')
            .autoOrient()
            .noProfile()
            .strip()
            .dither(false)
            .interlace('Line')
            .filter('Triangle');

          // Change width and height proportionally
          img.resize(250).interlace('Line').write(path, (resizeError) => {
            bound(() => {
              if (resizeError) {
                console.error('[createThumbnails] [img.resize]', resizeError);
                cb && cb(resizeError);
                return;
              }

              fs.stat(path, (fsStatError, stat) => {
                bound(() => {
                  if (fsStatError) {
                    console.error('[_app.createThumbnails] [img.resize] [fs.stat]', fsStatError);
                    cb && cb(fsStatError);
                    return;
                  }

                  gm(path).size((gmSizeError, imgInfo) => {
                    bound(() => {
                      if (gmSizeError) {
                        console.error('[_app.createThumbnails] [_.each sizes] [img.resize] [fs.stat] [gm(path).size]', gmSizeError);
                        cb && cb(gmSizeError);
                        return;
                      }

                      fileRef.versions.thumbnail = {
                        path: path,
                        size: stat.size,
                        type: fileRef.type,
                        extension: fileRef.extension,
                        meta: {
                          width: imgInfo.width,
                          height: imgInfo.height
                        }
                      };

                      const upd = { $set: {} };
                      upd['$set']['versions.thumbnail'] = fileRef.versions.thumbnail;

                      collection.collection.update(fileRef._id, upd, (colUpdError) => {
                        if (cb) {
                          if (colUpdError) {
                            cb(colUpdError);
                          } else {
                            cb(void 0, fileRef);
                          }
                        }
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
  return true;
};

export default createThumbnails;
```
