var require = meteorInstall({"lib":{"__compatability":{"__globals.coffee":function(){

//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
// lib/__compatability/__globals.coffee.js                                              //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////
                                                                                        //
__coffeescriptShare = typeof __coffeescriptShare === 'object' ? __coffeescriptShare : {}; var share = __coffeescriptShare;
this.Collections = {};                                                                  // 1
                                                                                        //
this._app = {                                                                           // 1
  subs: new SubsManager(),                                                              // 3
  storeTTL: 259200000                                                                   // 3
};                                                                                      //
                                                                                        //
if (Meteor.isClient) {                                                                  // 6
  Template.registerHelper('filesize', function(size) {                                  // 7
    return filesize(size);                                                              //
  });                                                                                   //
}                                                                                       //
                                                                                        //
if (Meteor.isServer) {                                                                  // 9
  Meteor.setInterval(function() {                                                       // 10
    return Collections.files.remove({                                                   //
      'meta.expireAt': {                                                                // 11
        $lte: new Date((+(new Date)) + 60000 * 2)                                       // 11
      }                                                                                 //
    });                                                                                 //
  }, 60000);                                                                            //
}                                                                                       //
                                                                                        //
//////////////////////////////////////////////////////////////////////////////////////////

}},"files.collection.coffee":function(){

//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
// lib/files.collection.coffee.js                                                       //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////
                                                                                        //
__coffeescriptShare = typeof __coffeescriptShare === 'object' ? __coffeescriptShare : {}; var share = __coffeescriptShare;
Collections.files = new Meteor.Files({                                                  // 1
  debug: false,                                                                         // 2
  throttle: 256 * 256 * 64,                                                             // 2
  chunkSize: 256 * 256 * 4,                                                             // 2
  storagePath: 'assets/app/uploads/uploadedFiles',                                      // 2
  collectionName: 'uploadedFiles',                                                      // 2
  allowClientCode: false,                                                               // 2
  onBeforeUpload: function() {                                                          // 2
    if (this.size <= 100000 * 10 * 128) {                                               // 8
      return true;                                                                      //
    } else {                                                                            //
      return "Max. file size is 128MB you've tried to upload " + (filesize(this.size));
    }                                                                                   //
  },                                                                                    //
  downloadCallback: function(fileObj) {                                                 // 2
    var ref;                                                                            // 10
    if (((ref = this.params) != null ? ref.query.download : void 0) === 'true') {       // 10
      return Collections.files.collection.update(fileObj._id, {                         //
        $inc: {                                                                         // 11
          'meta.downloads': 1                                                           // 11
        }                                                                               //
      });                                                                               //
    }                                                                                   //
  }                                                                                     //
});                                                                                     //
                                                                                        //
if (Meteor.isServer) {                                                                  // 13
  Collections.files.collection.deny({                                                   // 14
    insert: function() {                                                                // 15
      return true;                                                                      //
    },                                                                                  //
    update: function() {                                                                // 15
      return true;                                                                      //
    },                                                                                  //
    remove: function() {                                                                // 15
      return true;                                                                      //
    }                                                                                   //
  });                                                                                   //
  Collections.files.collection._ensureIndex({                                           // 14
    'meta.expireAt': 1                                                                  // 19
  }, {                                                                                  //
    expireAfterSeconds: 0,                                                              // 19
    background: true                                                                    // 19
  });                                                                                   //
  Meteor.startup(function() {                                                           // 14
    return Collections.files.remove({});                                                //
  });                                                                                   //
  Meteor.publish('latest', function(take) {                                             // 14
    if (take == null) {                                                                 //
      take = 50;                                                                        //
    }                                                                                   //
    check(take, Number);                                                                // 24
    return Collections.files.collection.find({}, {                                      //
      limit: take,                                                                      // 27
      sort: {                                                                           // 27
        'meta.created_at': -1                                                           // 28
      },                                                                                //
      fields: {                                                                         // 27
        _id: 1,                                                                         // 30
        name: 1,                                                                        // 30
        type: 1,                                                                        // 30
        meta: 1,                                                                        // 30
        isVideo: 1,                                                                     // 30
        isAudio: 1,                                                                     // 30
        isImage: 1                                                                      // 30
      }                                                                                 //
    });                                                                                 //
  });                                                                                   //
  Meteor.publish('file', function(_id) {                                                // 14
    check(_id, String);                                                                 // 39
    return Collections.files.collection.find(_id);                                      //
  });                                                                                   //
  Meteor.methods({                                                                      // 14
    'filesLenght': function() {                                                         // 43
      return Collections.files.collection.find({}).count();                             //
    }                                                                                   //
  });                                                                                   //
}                                                                                       //
                                                                                        //
//////////////////////////////////////////////////////////////////////////////////////////

},"router.coffee":function(){

//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
// lib/router.coffee.js                                                                 //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////
                                                                                        //
__coffeescriptShare = typeof __coffeescriptShare === 'object' ? __coffeescriptShare : {}; var share = __coffeescriptShare;
Router.onAfterAction(function() {                                                       // 1
  if (this.ready()) {                                                                   // 2
    return Meteor.isReadyForSpiderable = true;                                          //
  }                                                                                     //
});                                                                                     // 1
                                                                                        //
Router.configure({                                                                      // 1
  layoutTemplate: '_layout',                                                            // 5
  loadingTemplate: '_loading',                                                          // 5
  notFoundTemplate: '_404',                                                             // 5
  title: 'Temporary free file storage'                                                  // 5
});                                                                                     //
                                                                                        //
Router.plugin('dataNotFound', {                                                         // 1
  notFoundTemplate: Router.options.notFoundTemplate                                     // 10
});                                                                                     //
                                                                                        //
//////////////////////////////////////////////////////////////////////////////////////////

},"routes.coffee":function(){

//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
// lib/routes.coffee.js                                                                 //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////
                                                                                        //
__coffeescriptShare = typeof __coffeescriptShare === 'object' ? __coffeescriptShare : {}; var share = __coffeescriptShare;
Router.map(function() {                                                                 // 1
  this.route('index', {                                                                 // 2
    template: 'index',                                                                  // 3
    path: '/',                                                                          // 3
    waitOn: function() {                                                                // 3
      return _app.subs.subscribe('latest', 50);                                         //
    }                                                                                   //
  });                                                                                   //
  return this.route('file', {                                                           //
    template: 'file',                                                                   // 8
    path: '/:_id',                                                                      // 8
    waitOn: function() {                                                                // 8
      return _app.subs.subscribe('file', this.params._id);                              //
    },                                                                                  //
    data: function() {                                                                  // 8
      return Collections.files.collection.findOne(this.params._id);                     //
    },                                                                                  //
    title: function() {                                                                 // 8
      var file;                                                                         // 13
      file = this.data();                                                               // 13
      if (this.params._id && file) {                                                    // 14
        return "View File: " + file.name;                                               // 14
      }                                                                                 //
    }                                                                                   //
  });                                                                                   //
});                                                                                     // 1
                                                                                        //
//////////////////////////////////////////////////////////////////////////////////////////

}}},{"extensions":[".js",".json",".coffee"]});
require("./lib/__compatability/__globals.coffee");
require("./lib/files.collection.coffee");
require("./lib/router.coffee");
require("./lib/routes.coffee");
//# sourceMappingURL=app.js.map
