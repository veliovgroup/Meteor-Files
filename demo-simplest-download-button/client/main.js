import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';

import './main.html';

Template.file.helpers({
  fileRef: function () {
    return Images.collection.findOne({});
  }
});