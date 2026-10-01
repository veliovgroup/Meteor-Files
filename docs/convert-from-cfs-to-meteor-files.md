# CFS -> Meteor-Files migration guide

*Convert from the now deprecated CollectionFS (CFS) package to this Meteor-Files Package.*

## Brief:

- This is a quick way to migrate files from one collection to the other
- In this example a "schema update" file is used, each time Meteor starts, it checks a known collection for the database version. This way it will update things, without doing it twice
- Script in this example is used for Amazon S3 with `@aws-sdk/client-s3` (see the [S3 guide](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/aws-s3-integration.md)), you can replace new Meteor-Files storage at your option with (local, Dropbox, etc.)
- Old package: `CollectionFS/Meteor-CollectionFS` (the repository is archived and no longer available as an active project)

## Run this once on startup (__and only once!__)

After this completes, you can remove any of the `cfs:*` packages

__Note__: this creates copies of the files on your local server, make sure there is enough storage space for them!!
I use docker containers, so the files get wiped out on the next container deployment which is why we don't bother deleting them.

```js
import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// s3 specific configuration, `@aws-sdk/client-s3` npm package must be installed
const s3Conf = Meteor.settings.s3;
const s3Client = new S3Client({
  region: s3Conf.region,
  credentials: {
    accessKeyId: s3Conf.key,
    secretAccessKey: s3Conf.secret
  }
});

// `Docs` is the CFS collection, change it to the name used in your code (Images, etc.)
// `UserFiles` is the new FilesCollection instance. Import both from your own modules
// Run through every single document/file that is stored in CFS and move one by one to Meteor-Files.
const docs = await Docs.find().fetchAsync();

// Local folder for the copies, it must be writable by the server
fs.mkdirSync('./assets/app/uploads/', { recursive: true });

for (const fileObj of docs) {
  // This directory must be writable on server, so a test run first
  // We are going to copy the files locally, then move them to S3
  const newFileName = fileObj.name();
  const fileName = `./assets/app/uploads/${newFileName}`;

  // This is "example" variable, change it to the userId that you might be using.
  const userId = fileObj.userId;

  try {
    // Copy the file from CFS to the local FS
    await pipeline(fileObj.createReadStream('images'), fs.createWriteStream(fileName));
    console.log('Ended: ', fileName);

    // UserFiles is the new Meteor-Files/FilesCollection collection instance
    const fileRef = await UserFiles.addFile(fileName, {
      fileName: newFileName,
      type: fileObj.type(),
      meta: {
        userId // not really needed, I use it for tampering detection
      },
      userId,
      size: fileObj.size()
    });
    console.log('File Inserted: ', fileRef._id);

    const version = 'original';

    // Move to S3 - replace with your storage location
    const filePath = `files/${Random.id()}-${version}.${fileRef.extension}`;

    await s3Client.send(new PutObjectCommand({
      Bucket: s3Conf.bucket,
      Key: filePath,
      Body: fs.createReadStream(fileName),
      ContentLength: fileRef.size,
      ServerSideEncryption: 'AES256'
    }));

    // Update the location
    await UserFiles.updateAsync({ _id: fileRef._id }, {
      $set: {
        [`versions.${version}.meta.pipePath`]: filePath
      }
    });

    // Unlink original file from FS
    // after successful upload to AWS:S3
    await UserFiles.unlinkAsync(await UserFiles.collection.findOneAsync(fileRef._id), version);
  } catch (error) {
    console.error('Error: ', fileName, error);
  }
}
```
