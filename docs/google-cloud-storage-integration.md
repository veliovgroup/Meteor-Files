# Using Google Cloud Storage as your storage provider

This example shows how to add and retrieve files using Google Cloud Storage.
It also removes files from the bucket when a record is removed.

## Prerequisite

Install the [`@google-cloud/storage`](https://github.com/googleapis/nodejs-storage) package. No `request` package is needed, the SDK returns promises and streams.

```shell
meteor npm install --save @google-cloud/storage
```

### Setup your Google Cloud Storage

- Sign into the [Google Cloud console](https://console.cloud.google.com)
- Go to your project, open *Cloud Storage*, click *Create bucket*, and name your bucket
  - Remember the name of this bucket, you need it later
- Open *IAM & Admin*, then *Service Accounts*, and create a service account for your project (*if you don't already have one*)
- Grant it the *Storage Object Admin* role on the bucket
- Open the account's *Keys* tab, click *Add key*, then *Create new key*, and choose JSON
  - This downloads a JSON file to your computer
  - Keep this JSON file safe. Anyone who gets it has access to the bucket. Never commit it to git
  - Alternatively, run on Google Cloud with an attached service account and skip the key file (Application Default Credentials)

## Code

Use this in Meteor's `imports/server` directory, __NOT__ on the client.

```js
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { FilesCollection } from 'meteor/ostrio:files';
import { Storage } from '@google-cloud/storage';

const gcs = new Storage({
  projectId: 'YOUR_PROJECT_ID', // <-- Replace this with your project ID
  keyFilename: 'YOUR_KEY_JSON' // <-- Replace this with the path to your key.json
});
const bucket = gcs.bucket('YOUR_BUCKET_NAME'); // <-- Replace this with your bucket name

Meteor.startup(async () => {
  try {
    await bucket.getMetadata();
  } catch (error) {
    console.error('[GCS] Can not access the bucket:', error);
  }
});

/**
 * Resolve a `Range` header into an explicit, inclusive byte range.
 * Returns `null` when the full content must be sent (no header, a malformed header,
 * or a multi-range request), `false` when the range is not satisfiable, and `{ start, end }` otherwise.
 */
const resolveRange = (header, size) => {
  if (!header || header.includes(',')) {
    return null;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2])) {
    // Malformed header: ignored, same as `.serve()` does
    return null;
  }

  let start;
  let end;
  if (!match[1]) {
    // Suffix range: the last N bytes
    const suffix = parseInt(match[2], 10);
    if (suffix === 0) {
      return false;
    }
    start = Math.max(size - suffix, 0);
    end = size - 1;
  } else {
    start = parseInt(match[1], 10);
    end = match[2] ? Math.min(parseInt(match[2], 10), size - 1) : size - 1;
  }

  return (start >= size || end < start) ? false : { start, end };
};

const Files = new FilesCollection({
  debug: false, // Set to true to enable debugging messages
  storagePath: 'assets/app/uploads/uploadedFiles',
  collectionName: 'uploadedFiles',
  allowClientCode: false,

  // In the onAfterUpload callback, we move the file to Google Cloud Storage
  async onAfterUpload(fileRef) {
    for (const version of Object.keys(fileRef.versions)) {
      const vRef = fileRef.versions[version];
      if (!vRef) {
        continue;
      }

      // We use Random.id() instead of real file's _id
      // to secure files from reverse engineering
      // As after viewing this code it will be easy
      // to get access to unlisted and protected files
      const filePath = `files/${Random.id()}-${version}.${fileRef.extension}`;

      try {
        // For more options, see
        // https://cloud.google.com/nodejs/docs/reference/storage/latest/storage/bucket#_google_cloud_storage_Bucket_upload
        await bucket.upload(vRef.path, {
          destination: filePath,
          resumable: true
        });

        await this.collection.updateAsync({ _id: fileRef._id }, {
          $set: { [`versions.${version}.meta.pipePath`]: filePath }
        });

        // Unlink original file from FS
        // after successful upload to Google Cloud Storage
        await this.unlinkAsync(await this.collection.findOneAsync(fileRef._id), version);
      } catch (error) {
        console.error('[onAfterUpload] GCS error, file stays on FS:', fileRef._id, error);
      }
    }
  },

  // Remove files from the bucket right after the record is removed.
  // Return `true` to skip .unlinkAsync(), as files were already removed from FS
  async onAfterRemove(docs) {
    for (const doc of docs) {
      for (const version of Object.keys(doc.versions || {})) {
        const pipePath = doc.versions[version]?.meta?.pipePath;
        if (pipePath) {
          try {
            await bucket.file(pipePath).delete();
          } catch (error) {
            console.error('[onAfterRemove] GCS delete error:', pipePath, error);
          }
        }
      }
    }

    // Files not yet moved to GCS are still on FS, let the default unlink run
    return docs.length > 0 && docs.every((doc) => doc.versions?.original?.meta?.pipePath);
  },

  interceptDownload(http, fileRef, version) {
    const vRef = fileRef.versions?.[version];
    const path = vRef?.meta?.pipePath;

    if (!path) {
      // While the file has not been uploaded to Google Cloud Storage,
      // we serve it from the filesystem
      return false;
    }

    // If file is moved to Google Cloud Storage
    // we pipe the request to Google Cloud Storage
    // So, original link will always stay secure
    const range = resolveRange(http.request.headers.range, vRef.size);
    // With `strict: false` an unsatisfiable range gets the full content with `200`, as in `.serve()`
    if (range === false && this.strict !== false) {
      http.response.writeHead(416, { 'Content-Range': `bytes */${vRef.size}` });
      http.response.end();
      return true;
    }

    let remoteReadStream;
    if (range) {
      // `start` and `end` are both inclusive in the GCS client
      http.request.headers.range = `bytes=${range.start}-${range.end}`;
      remoteReadStream = bucket.file(path).createReadStream({ start: range.start, end: range.end });
    } else {
      delete http.request.headers.range;
      remoteReadStream = bucket.file(path).createReadStream();
    }

    this.serve(http, fileRef, vRef, version, remoteReadStream);
    return true;
  }
});

export default Files;
```
