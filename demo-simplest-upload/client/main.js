import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';

import './main.html';

Template.uploadedFiles.helpers({
  uploadedFiles: function () {
    return Images.collection.find({});
  }
});

Template.uploadForm.onCreated(function () {
  this.currentFile = new ReactiveVar(false);
});

Template.uploadForm.helpers({
  currentFile: function () {
    return Template.instance().currentFile.get();
  }
});

Template.uploadForm.events({
  'change #fileInput': function (e, template) {
    if (e.currentTarget.files && e.currentTarget.files[0]) {
      // We upload only one file, in case 
      // there was multiple files selected
      var file = e.currentTarget.files[0];
      if (file) {
        var uploadInstance = Images.insert({
          file: file,
          onUploaded: function (error, fileObj) {
            if (error) {
              alert('Error during upload: ' + error.reason);
            } else {
              alert('File "' + fileObj.name + '" successfully uploaded');
            }
            template.currentFile.set(false);
          },
          streams: 'dynamic',
          chunkSize: 'dynamic'
        });

        if (uploadInstance.state.get() !== 'aborted') {
          template.currentFile.set(uploadInstance);
        }
      }
    }
  }
});