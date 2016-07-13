import { Template } from 'meteor/templating';
import { Videos, Images } from '../lib/files.collections.js';
import './main.html';

Template.file.helpers({
  imageFile: function () {
    return Images.findOne();
  },
  videoFile: function () {
    return Videos.findOne();
  }
});
