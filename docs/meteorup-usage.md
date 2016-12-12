### Example on using [MeteorUp](https://github.com/kadirahq/meteor-up
Create volumes in `mup.json`, in this example, create and store files under `/images` on the server.
The uploaded images can be accessed the same way as it is in the [demos](https://github.com/VeliovGroup/Meteor-Files-Demos)
```javascript
module.exports = {
  servers: {
    one: {
      host: 'myapp',
      username: 'root',
      // pem:
      // password:
      // or leave blank for authenticate from ssh-agent
    }
  },

  meteor: {
    name: 'myapp',
    path: '../app',
    volumes: {
      '/images':'/images'
    },
    servers: {
      one: {}
    },
    buildOptions: {
      serverOnly: true,
    },
    env: {
      ROOT_URL: 'http://myapp.com',
      MONGO_URL: 'mongodb://localhost/meteor'
    },

    //dockerImage: 'kadirahq/meteord',
    deployCheckWaitTime: 60
  },

  mongo: {
    oplog: true,
    port: 27017,
    servers: {
      one: {},
    },
  },
};
```
Then in the constructor for Meteor-File
```javascript
Images = new FilesCollection({
	debug: true,
	storagePath: '/images',
	permissions: 0774,
	parentDirPermissions: 0774,
	collectionName: 'Images',
	allowClientCode: false, // Disallow remove files from Client
	onBeforeUpload: function(file) {
    // Allow upload files under 10MB, and only in png/jpg/jpeg formats
    if (file.size <= 1024*1024*10 && /png|jpg|jpeg/i.test(file.extension)) {
      return true;
    } else {
       return 'Please upload image, with size equal or less than 10MB';
    }
  }
});
```
*For more info see [Issue #290](https://github.com/VeliovGroup/Meteor-Files/issues/290).*
