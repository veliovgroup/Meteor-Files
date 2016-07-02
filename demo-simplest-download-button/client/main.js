import { Template } from 'meteor/templating';

import './main.html';

Template.file.helpers({
  file: function () {
    return Images.findOne();
  }
});