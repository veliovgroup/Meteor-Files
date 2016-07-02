this.Images = new Meteor.Files({
  debug: true,
  collectionName: 'Images',
  onBeforeUpload: function () {
    // Disallow uploads from client
    return false;
  }
});

this.Videos = new Meteor.Files({
  debug: true,
  collectionName: 'Videos',
  onBeforeUpload: function () {
    // Disallow uploads from client
    return false;
  }
});

// To have sample files in DB we will upload them on server startup:
if (Meteor.isServer) {
  Images.denyClient();
  Videos.denyClient();
  
  Meteor.startup(function () {
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

  Meteor.publish('files.images.all', function () {
    return Images.find().cursor;
  });

  Meteor.publish('files.videos.all', function () {
    return Videos.find().cursor;
  });

} else {

  Meteor.subscribe('files.images.all');
  Meteor.subscribe('files.videos.all');
}