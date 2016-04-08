import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';

import './main.html';

Template.file.helpers({
  imageFile: function () {
    return Images.collection.findOne({});
  },
  videoFile: function () {
    return Videos.collection.findOne({});
  }
});
