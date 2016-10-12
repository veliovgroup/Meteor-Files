import { FilesCollection } from 'meteor/ostrio:files';

let Images = new FilesCollection({
  debug: true,
  collectionName: 'Images',
  onBeforeUpload() {
    // Disallow uploads from client
    return false;
  }
});

let Sounds = new FilesCollection({
  debug: true,
  collectionName: 'Sounds',
  onBeforeUpload() {
    // Disallow uploads from client
    return false;
  }
});

// To have sample files in DB we will upload them on server startup:
if (Meteor.isServer) {
  Images.denyClient();
  Sounds.denyClient();
  
  Meteor.startup(() => {
    if (!Images.findOne()) {
      Images.load('https://raw.githubusercontent.com/VeliovGroup/Meteor-Files/master/logo.png', {
        fileName: 'logo.png'
      });
    }

    if (!Sounds.findOne()) {
      Sounds.load('http://www.openmusicarchive.org/audio/Deep_Blue_Sea_Blues.mp3', {
        fileName: 'Deep_Blue_Sea_Blues.mp3'
      });
    }
  });

  Meteor.publish('files.images.all', () => Images.find().cursor);
  Meteor.publish('files.sounds.all', () => Sounds.find().cursor);

} else {

  Meteor.subscribe('files.images.all');
  Meteor.subscribe('files.sounds.all');
}

export { Sounds, Images }