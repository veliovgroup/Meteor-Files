import { Template } from 'meteor/templating';
import { Sounds, Images } from '../lib/files.collections.js';
import './main.html';

Template.file.helpers({
  imageFile: function () {
    return Images.findOne();
  },
  audioFile: function () {
    return Sounds.findOne();
  }
});
