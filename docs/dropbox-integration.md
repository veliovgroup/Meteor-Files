# Use DropBox as storage

The example below shows how to store and serve uploaded files via DropBox. It also covers removing files from both your application and DropBox.

## Prerequisite

Install the [`dropbox` SDK](https://www.npmjs.com/package/dropbox). Meteor 3 runs on a Node.js version that ships a global `fetch`, so no `request` or `node-fetch` package is needed.

```shell
meteor npm install --save dropbox
```

### Get access to DropBox API

- Go to [DropBox Developers](https://www.dropbox.com/developers) (*Sign(in|up) if required*)
- Click on [Create app](https://www.dropbox.com/developers/apps/create)
- Choose "*Scoped access*", then "*App folder*"
- Type in your application name
- Open the app's *Permissions* tab and enable `files.content.write`, `files.content.read`, and `sharing.write`. Click "*Submit*"
- Open the *Settings* tab and copy the "*App key*" and "*App secret*"
- Dropbox access tokens are short-lived (about 4 hours). Generate a long-lived __refresh token__ once with the [OAuth code flow](https://developers.dropbox.com/oauth-guide) (`token_access_type=offline`). The SDK uses the refresh token to get new access tokens automatically

Store the credentials in `settings.json` and start Meteor with `meteor --settings settings.json`:

```json
{
  "dropbox": {
    "clientId": "APP_KEY",
    "clientSecret": "APP_SECRET",
    "refreshToken": "REFRESH_TOKEN"
  }
}
```

## Code

Use this in Meteor's `imports/server` directory, __NOT__ on the client.

```js
import { Meteor } from 'meteor/meteor';
import { FilesCollection } from 'meteor/ostrio:files';
import { Readable } from 'node:stream';
import fs from 'node:fs';
import { Dropbox } from 'dropbox';

const dropboxConf = Meteor.settings.dropbox || {};
if (!dropboxConf.clientId || !dropboxConf.clientSecret || !dropboxConf.refreshToken) {
  throw new Meteor.Error(401, 'Missing Dropbox settings');
}

const client = new Dropbox({
  clientId: dropboxConf.clientId,
  clientSecret: dropboxConf.clientSecret,
  refreshToken: dropboxConf.refreshToken,
});

// Forward only what the download needs, not the visitor's other headers
const FORWARD_REQUEST_HEADERS = ['range'];
const FORWARD_RESPONSE_HEADERS = ['accept-ranges', 'content-range', 'content-disposition', 'content-length', 'content-type', 'etag'];

const pick = (source, keys) => {
  const result = {};
  for (const key of keys) {
    if (source[key]) {
      result[key] = source[key];
    }
  }
  return result;
};

const Files = new FilesCollection({
  debug: false, // Change to `true` for debugging
  storagePath: 'assets/app/uploads/uploadedFiles',
  collectionName: 'uploadedFiles',
  allowClientCode: false,

  // In onAfterUpload callback we move the file to DropBox
  async onAfterUpload(fileRef) {
    for (const version of Object.keys(fileRef.versions)) {
      const vRef = fileRef.versions[version];
      if (!vRef) {
        continue;
      }

      try {
        const contents = await fs.promises.readFile(vRef.path);

        // DropBox already uses random URLs
        // No need to use random file names
        const upload = await client.filesUpload({
          path: `/${fileRef._id}-${version}.${fileRef.extension}`,
          contents,
          autorename: false,
        });
        const path = upload.result.path_display;

        // The file was successfully uploaded, generating a downloadable link
        const link = await client.sharingCreateSharedLinkWithSettings({ path });
        const url = link.result.url.replace('dl=0', 'raw=1');

        await this.collection.updateAsync({ _id: fileRef._id }, {
          $set: {
            [`versions.${version}.meta.pipeFrom`]: url,
            [`versions.${version}.meta.pipePath`]: path,
          }
        });

        // Unlink original file from FS after successful upload to DropBox
        await this.unlinkAsync(await this.collection.findOneAsync(fileRef._id), version);
      } catch (error) {
        console.error('[onAfterUpload] DropBox error, file stays on FS:', fileRef._id, error);
      }
    }
  },

  // Remove files from DropBox right after the record is removed.
  // Return `true` to skip .unlinkAsync(), as files were already removed from FS
  async onAfterRemove(docs) {
    for (const doc of docs) {
      for (const version of Object.keys(doc.versions || {})) {
        const pipePath = doc.versions[version]?.meta?.pipePath;
        if (pipePath) {
          try {
            await client.filesDeleteV2({ path: pipePath });
          } catch (error) {
            console.error('[onAfterRemove] DropBox delete error:', pipePath, error);
          }
        }
      }
    }

    // Files not yet moved to DropBox are still on FS, let the default unlink run
    return docs.length > 0 && docs.every((doc) => doc.versions?.original?.meta?.pipePath);
  },

  // Files are stored in DropBox, intercept the download to serve the file from DropBox
  async interceptDownload(http, fileRef, version) {
    const url = fileRef.versions?.[version]?.meta?.pipeFrom;
    if (!url) {
      // While file is not yet uploaded to DropBox
      // we serve the file from FS
      return false;
    }

    // If file is moved to DropBox
    // we pipe the request to DropBox
    // So, original link will always stay secure
    try {
      const response = await fetch(url, { headers: pick(http.request.headers, FORWARD_REQUEST_HEADERS) });
      if (!response.body) {
        return false;
      }

      const headers = pick(Object.fromEntries(response.headers), FORWARD_RESPONSE_HEADERS);
      headers['cache-control'] = 'public, max-age=2592000';
      http.response.writeHead(response.status, headers);
      Readable.fromWeb(response.body).on('error', () => http.response.end()).pipe(http.response);
    } catch (error) {
      console.error('[interceptDownload] DropBox fetch error:', error);
      if (!http.response.headersSent) {
        http.response.writeHead(502);
      }
      http.response.end();
    }

    return true;
  }
});

export default Files;
```

Notes:

- `onBeforeRemove` is not needed with `allowClientCode: false`. Without it, set `allowClientCode: false` or add an `onBeforeRemove` check, see the [security guide](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/security.md)
- Shared links with `raw=1` are public URLs. The app serves them through `interceptDownload`, so keep the original link behind `protected` when files are private
- Import the file only on the server. Do not `require` `dropbox` in client code
