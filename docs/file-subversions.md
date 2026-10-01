# Create and Manage File's subversion

```js
import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { FilesCollection } from 'meteor/ostrio:files';

const videosCollection = new FilesCollection({
  /* .. other options .. */
  collectionName: 'Videos',
  async onAfterUpload(fileRef) {
    const sourceFile = ffmpeg(fileRef.path).noProfile();
    const formats = {
      ogg: true,
      mp4: true,
      webm: true
    };

    for (const [format, convert] of Object.entries(formats)) {
      if (convert) {
        // `someHowConvertVideoAndReturnFileData` stands for your conversion code
        const version = await sourceFile.clone().someHowConvertVideoAndReturnFileData(format);
        await this.updateAsync(fileRef._id, {
          $set: {
            [`versions.${format}`]: {
              path: version.path,
              size: version.size,
              type: version.type,
              name: version.nameWithExtension,
              extension: version.extension
            }
          }
        });
      }
    }
  }
});

if (Meteor.isClient) {
  Template.upload.events({
    'change #upload'(e) {
      /* Upload all Files */
      Array.from(e.currentTarget.files).forEach(async (file) => {
        await videosCollection.insertAsync({
          file,
          onUploaded(error) {
            if (error) {
              alert(error.message);
              throw new Meteor.Error(500, error.message);
            }
          },
          onBeforeUpload(fileData) {
            // Note: You should never trust to extension and mime-type here
            // as this data comes from client and can be easily substitute
            // to check file's "magic-numbers" use the `file-type` package
            // real extension and mime-type can be checked on client (untrusted side)
            // and on server at `onAfterUpload` hook (trusted side)
            if (['ogg', 'mp4', 'avi', 'webm'].includes(fileData.extension) && fileData.size < 512 * 1024 * 1024) {
              return true;
            }
            return `Please upload file in next formats: 'ogg', 'mp4', 'avi', 'webm' with size less than 512 Mb. You have tried to upload file with "${fileData.extension}" extension and with "${Math.round((fileData.size / (1024 * 1024)) * 100) / 100}" Mb`;
          }
        });
      });
    }
  });
}
```
