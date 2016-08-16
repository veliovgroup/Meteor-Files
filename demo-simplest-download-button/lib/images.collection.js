this.Images = new Meteor.Files({
  debug: true,
  collectionName: 'Images'
});

// To have sample image in DB we will upload it on server startup:
if (Meteor.isServer) {
  Images.denyClient();
  Images.collection.attachSchema(Images.schema);

  Meteor.startup(function () {
    if (!Images.find().count()) {
      Images.load('https://raw.githubusercontent.com/VeliovGroup/Meteor-Files/master/logo.png', {
        fileName: 'logo.png',
        meta: {}
      });
    }
  });

  Meteor.publish('files.images.all', function () {
    return Images.find().cursor;
  });

} else {

  Meteor.subscribe('files.images.all');
}