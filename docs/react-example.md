# React.js usage

*This example is for the front-end UI only. The server side [methods](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/readme.md#api) and [publications](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/collection.md) are the same.*

## Brief:

This example uses two components. The first handles uploads and shows a file input and a progress bar (`FileUpload.js`). The second shows the file details (`FileIndividualFile.js`).

- The individual file component allows to delete, rename, and view the files. Twitter Bootstrap is used for styling;
- Uses function components and hooks, with `useTracker` from `meteor/react-meteor-data` to read Meteor data. Needs `react-meteor-data@3` or newer on Meteor 3;
- Uses `insertAsync()` and `Meteor.callAsync()`.

## Assumptions

- You have Meteor methods for `RemoveFile` and `RenameFile`
- You have a publication called `files.all` which publishes the `FilesCollection`, declared something like this:

```js
// /imports/lib/collections/user-files.js
import { FilesCollection } from 'meteor/ostrio:files';

export const UserFiles = new FilesCollection({collectionName: 'userfiles'});
// optionally attach a schema with `aldeed:collection2` and `simpl-schema`:
// import SimpleSchema from 'simpl-schema';
// UserFiles.collection.attachSchema(new SimpleSchema(UserFiles.schema));
```

### FileUpload.js:

```jsx
import React, { useRef, useState } from 'react';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';

import { UserFiles } from '/imports/lib/collections/user-files.js';
import IndividualFile from './FileIndividualFile.js';

export default function FileUpload({ fileLocator }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(null); // Keep track of the upload to display its file name
  const [progress, setProgress] = useState(0);

  const { ready, files } = useTracker(() => {
    const handle = Meteor.subscribe('files.all');
    return {
      ready: handle.ready(),
      files: UserFiles.find({}, { sort: { name: 1 } }).fetch()
    };
  }, []);

  const uploadIt = async (e) => {
    e.preventDefault();

    // We upload only one file, in case
    // there was multiple files selected
    const file = e.currentTarget.files && e.currentTarget.files[0];
    if (!file) {
      return;
    }

    const upload = await UserFiles.insertAsync({
      file,
      meta: {
        locator: fileLocator,
        userId: Meteor.userId() // Optional, used to check on server for file tampering
      },
      chunkSize: 'dynamic',
      allowWebWorkers: true // If you see issues with uploads, change this to false
    }, false);

    setUploading(upload); // Show the progress bar now

    // These are the event functions, don't need most of them, it shows where we are in the process
    upload.on('start', () => {
      console.log('Starting');
    });

    upload.on('end', (error, fileObj) => {
      console.log('On end File Object: ', fileObj);
    });

    upload.on('uploaded', (error, fileObj) => {
      console.log('uploaded: ', fileObj);

      // Remove the filename from the upload box
      inputRef.current.value = '';

      // Reset our state for the next file
      setUploading(null);
      setProgress(0);
    });

    upload.on('error', (error) => {
      console.log(`Error during upload: ${error}`);

      // Reset our state so the user can pick a file again
      inputRef.current.value = '';
      setUploading(null);
      setProgress(0);
    });

    upload.on('progress', (percent) => {
      // Update our progress bar
      setProgress(percent);
    });

    await upload.start(); // Must manually start the upload
  };

  if (!ready) {
    return <div>Loading file list</div>;
  }

  return (
    <div>
      <div className="row">
        <div className="col-md-12">
          <p>Upload New File:</p>
          <input type="file" id="fileinput" disabled={!!uploading} ref={inputRef} onChange={uploadIt} />
        </div>
      </div>

      <div className="row m-t-sm m-b-sm">
        <div className="col-md-6">
          {/* This is our progress bar, bootstrap styled. Remove it if not needed */}
          {uploading && (
            <div>
              {uploading.file.name}

              <div className="progress progress-bar-default">
                <div
                  style={{ width: `${progress}%` }}
                  aria-valuemax="100"
                  aria-valuemin="0"
                  aria-valuenow={progress || 0}
                  role="progressbar"
                  className="progress-bar"
                >
                  <span className="sr-only">{progress}% Complete (success)</span>
                  <span>{progress}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="col-md-6"></div>
      </div>

      {/* Run through each file that the user has stored
          (make sure the subscription only sends files owned by this user) */}
      {files.map((aFile) => (
        <div key={aFile._id}>
          <IndividualFile
            fileName={aFile.name}
            fileUrl={UserFiles.link(aFile)} // The "view/download" link
            fileId={aFile._id}
            fileSize={aFile.size}
          />
        </div>
      ))}
    </div>
  );
}
```

### Second Component: FileIndividualFile.js

```jsx
import React from 'react';
import PropTypes from 'prop-types';
import { Meteor } from 'meteor/meteor';

export default function IndividualFile({ fileName, fileSize, fileUrl, fileId }) {
  const removeFile = async () => {
    if (window.confirm('Are you sure you want to delete the file?')) {
      try {
        await Meteor.callAsync('RemoveFile', fileId);
      } catch (error) {
        console.log(error);
      }
    }
  };

  const renameFile = async () => {
    const validName = /[^a-zA-Z0-9 .:+()\-_%!&]/gi;
    const answer = window.prompt('New file name?', fileName);

    // Replace any non valid characters, also do this on the server
    const newName = answer ? answer.replace(validName, '-').trim() : '';

    if (newName) {
      try {
        await Meteor.callAsync('RenameFile', fileId, newName);
      } catch (error) {
        console.log(error);
      }
    }
  };

  return (
    <div className="m-t-sm">
      <div className="row">
        <div className="col-md-12">
          <strong>{fileName}</strong>
          <div className="m-b-sm"></div>
        </div>
      </div>

      <div className="row">
        <div className="col-md-3">
          <button onClick={renameFile} className="btn btn-outline btn-primary btn-sm">
            Rename
          </button>
        </div>

        <div className="col-md-3">
          <a href={fileUrl} className="btn btn-outline btn-primary btn-sm" target="_blank" rel="noreferrer">View</a>
        </div>

        <div className="col-md-2">
          <button onClick={removeFile} className="btn btn-outline btn-danger btn-sm">
            Delete
          </button>
        </div>

        <div className="col-md-4">
          Size: {fileSize}
        </div>
      </div>
    </div>
  );
}

IndividualFile.propTypes = {
  fileName: PropTypes.string.isRequired,
  fileSize: PropTypes.number.isRequired,
  fileUrl: PropTypes.string,
  fileId: PropTypes.string.isRequired
};
```
