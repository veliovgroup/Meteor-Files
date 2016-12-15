# Example on using [MeteorUp](https://github.com/kadirahq/meteor-up)

### Brief
[MeteorUp (MUP)](https://github.com/kadirahq/meteor-up) uses Docker, and by default, there is no volume mounted on the server. Therefore, even if `storagePath` is declared in constructor, files that are being uploaded are still being stored in cache, and on every deploy, all the uploaded files __get erased__.

Read more at [Issue #270](https://github.com/VeliovGroup/Meteor-Files/issues/72) and [Issue #290](https://github.com/VeliovGroup/Meteor-Files/issues/290).

To solve this issue, a volume has to be declared in `project-root/mup.json`. In this example, images will be stored at `/images` directory.

### `mup.json` example:
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

### Images constructor example
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

Now, files will be uploaded to `/images` on server, and can be accessed like in [demos](https://github.com/VeliovGroup/Meteor-Files-Demos).