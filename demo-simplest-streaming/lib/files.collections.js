import { FilesCollection } from 'meteor/ostrio:files';

let Images = new FilesCollection({
  debug: true,
  collectionName: 'Images',
  onBeforeUpload() {
    // Disallow uploads from client
    return false;
  }
});

let Videos = new FilesCollection({
  debug: true,
  collectionName: 'Videos',
  onBeforeUpload() {
    // Disallow uploads from client
    return false;
  }
});

// To have sample files in DB we will upload them on server startup:
if (Meteor.isServer) {
  Images.denyClient();
  Videos.denyClient();
  
  Meteor.startup(() => {
    if (!Images.findOne()) {
      Images.load('https://raw.githubusercontent.com/VeliovGroup/Meteor-Files/master/logo.png', {
        fileName: 'logo.png'
      });
    }

    if (!Videos.findOne()) {
      Videos.load('http://www.sample-videos.com/video/mp4/240/big_buck_bunny_240p_10mb.mp4', {
        fileName: 'Big-Buck-Bunny.mp4'
      });
    }
  });

  Meteor.publish('files.images.all', () => Images.find().cursor);
  Meteor.publish('files.videos.all', () => Videos.find().cursor);

} else {

  Meteor.subscribe('files.images.all');
  Meteor.subscribe('files.videos.all');
}

export { Videos, Images }