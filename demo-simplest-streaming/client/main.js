import { Template } from 'meteor/templating';

import './main.html';

Template.file.helpers({
  imageFile: function () {
    return Images.findOne();
  },
  videoFile: function () {
    return Videos.findOne();
  }
});
