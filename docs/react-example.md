*This example is for the front-end UI only. The server side [methods](https://github.com/VeliovGroup/Meteor-Files/wiki#api) and [publications](https://github.com/VeliovGroup/Meteor-Files/wiki/collection) are the same.*

## Brief:
In this example two components is used. First - to handle the uploads, adds a file input box and progress bar. Second - to show the file details (`FileIndividualFile.js`).

 - The individual file component allows to delete, rename, and view the files. Twitter Bootstrap is used for styling;
 - Tested with `Meteor@1.6.1` and `React16`;
 - Uses the latest `withTracker` access the meteor data.
 - Uses React Component (rather than deprecated createClass)

## Assumptions
 - You have Meteor methods for `RemoveFile` and `RemoveFile`
 - You have a publication called `files.all` 
 which is a FilesCollection, declared something like this:

```js
import { FilesCollection } from 'meteor/ostrio:files'

export const ReportImages = new FilesCollection({collectionName: 'reportimages'});
// optionally attach a schema
ReportImages.attachSchema(FilesCollection.schema);
```

## FileUpload.js:

```jsx
import { withTracker } from 'meteor/react-meteor-data'
import { Meteor } from 'meteor/meteor'
import React, { Component } from 'react'
import PropTypes from 'prop-types'

import IndividualFile from './FileIndividualFile.js'

const debug = require('debug')('demo:file')

class FileUploadComponent extends Component {
  constructor(props) {
    super(props)

    this.state = {
      uploading: [],
      progress: 0,
      inProgress: false
    }

    this.uploadIt = this.uploadIt.bind(this)
  }

  uploadIt(e) {
    e.preventDefault()

    let self = this

    if (e.currentTarget.files && e.currentTarget.files[0]) {
      // We upload only one file, in case
      // there was multiple files selected
      var file = e.currentTarget.files[0]

      if (file) {
        let uploadInstance = UserFiles.insert({
          file: file,
          meta: {
            locator: self.props.fileLocator,
            userId: Meteor.userId() // Optional, used to check on server for file tampering
          },
          streams: 'dynamic',
          chunkSize: 'dynamic',
          allowWebWorkers: true // If you see issues with uploads, change this to false
        }, false)

        self.setState({
          uploading: uploadInstance, // Keep track of this instance to use below
          inProgress: true // Show the progress bar now
        })

        // These are the event functions, don't need most of them, it shows where we are in the process
        uploadInstance.on('start', function () {
          console.log('Starting')
        })

        uploadInstance.on('end', function (error, fileObj) {
          console.log('On end File Object: ', fileObj)
        })

        uploadInstance.on('uploaded', function (error, fileObj) {
          console.log('uploaded: ', fileObj)

          // Remove the filename from the upload box
          self.refs['fileinput'].value = ''

          // Reset our state for the next file
          self.setState({
            uploading: [],
            progress: 0,
            inProgress: false
          })
        })

        uploadInstance.on('error', function (error, fileObj) {
          console.log('Error during upload: ' + error)
        })

        uploadInstance.on('progress', function (progress, fileObj) {
          console.log('Upload Percentage: ' + progress)
          // Update our progress bar
          self.setState({
            progress: progress
          })
        })

        uploadInstance.start() // Must manually start the upload
      }
    }
  }

  // This is our progress bar, bootstrap styled
  // Remove this function if not needed
  showUploads() {
    console.log('**********************************', this.state.uploading)

    if (!_.isEmpty(this.state.uploading)) {
      return <div>
        {this.state.uploading.file.name}

        <div className="progress progress-bar-default">
          <div style={{width: this.state.progress + '%'}} aria-valuemax="100"
             aria-valuemin="0"
             aria-valuenow={this.state.progress || 0} role="progressbar"
             className="progress-bar">
            <span className="sr-only">{this.state.progress}% Complete (success)</span>
            <span>{this.state.progress}%</span>
          </div>
        </div>
      </div>
    }
  }

  render() {
    debug("Rendering FileUpload",this.props.docsReadyYet)
    if (this.props.files && this.props.docsReadyYet) {

      let fileCursors = this.props.files

      // Run through each file that the user has stored
      // (make sure the subscription only sends files owned by this user)
      let display = fileCursors.map((aFile, key) => {
        // console.log('A file: ', aFile.link(), aFile.get('name'))
        let link = UserFiles.findOne({_id: aFile._id}).link()  //The "view/download" link

        // Send out components that show details of each fil e
        return <div key={'file' + key}>
          <IndividualFile
            fileName={aFile.name}
            fileUrl={link}
            fileId={aFile._id}
            fileSize={aFile.size}
          />
        </div>
      })

      return <div>
        <div className="row">
          <div className="col-md-12">
            <p>Upload New File:</p>
            <input type="file" id="fileinput" disabled={this.state.inProgress} ref="fileinput"
                 onChange={this.uploadIt}/>
          </div>
        </div>

        <div className="row m-t-sm m-b-sm">
          <div className="col-md-6">

            {this.showUploads()}

          </div>
          <div className="col-md-6">
          </div>
        </div>

        {display}

      </div>
    }
    else return <div>Loading file list</div>
  }
}

//
// This is the HOC - included in this file just for convenience, but usually kept
// in a separate file to provide separation of concerns.
//
export default withTracker( ( props ) => {
  const filesHandle = Meteor.subscribe('files.all')
  const docsReadyYet = filesHandle.ready()
  const files = UserFiles.find({}, {sort: {name: 1}}).fetch()

  return {
    docsReadyYet,
    files,
  }
})(FileUploadComponent)
```

## Second Component: FileIndividualFile.js

```jsx
import React, { Component } from 'react'
import PropTypes from 'prop-types'

class IndividualFile extends Component {
  constructor(props) {
    super(props)

    this.state = {
    }
    
    this.removeFile = this.removeFile.bind(this)
    this.renameFile = this.renameFile.bind(this)

  }

  propTypes: {
    fileName: PropTypes.string.isRequired,
    fileSize: PropTypes.number.isRequired,
    fileUrl: PropTypes.string,
    fileId: PropTypes.string.isRequired
  }

  removeFile(){
    let conf = confirm('Are you sure you want to delete the file?') || false
    if (conf == true) {
      Meteor.call('RemoveFile', this.props.fileId, function (err, res) {
        if (err)
          console.log(err)
      })
    }
  }

  renameFile(){

    let validName = /[^a-zA-Z0-9 \.:\+()\-_%!&]/gi
    let prompt    = window.prompt('New file name?', this.props.fileName)

    // Replace any non valid characters, also do this on the server
    if (prompt) {
      prompt = prompt.replace(validName, '-')
      prompt.trim()
    }

    if (!_.isEmpty(prompt)) {
      Meteor.call('RenameFile', this.props.fileId, prompt, function (err, res) {
        if (err)
          console.log(err)
      })
    }
  }

  render() {
    return <div className="m-t-sm">
      <div className="row">
        <div className="col-md-12">
          <strong>{this.props.fileName}</strong>
          <div className="m-b-sm">
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-md-3">
          <button onClick={this.renameFile} className="btn btn-outline btn-primary btn-sm">
            Rename
          </button>
        </div>


        <div className="col-md-3">
          <a href={this.props.fileUrl} className="btn btn-outline btn-primary btn-sm"
             target="_blank">View</a>
        </div>

        <div className="col-md-2">
          <button onClick={this.removeFile} className="btn btn-outline btn-danger btn-sm">
            Delete
          </button>
        </div>

        <div className="col-md-4">
          Size: {this.props.fileSize}
        </div>
      </div>
    </div>
  }
}
export default IndividualFile
```