Package.describe({
  name: 'ostrio:files',
  version: '1.7.4',
  summary: 'Upload files via DDP, HTTP and WebRTC/DC. To server FS, AWS, GridFS, DropBox or Google Drive.',
  git: 'https://github.com/VeliovGroup/Meteor-Files',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.4');
  api.use('webapp', 'server');
  api.use('templating', 'client', {weak: true});
  api.use(['reactive-var', 'tracker', 'http'], 'client');
  api.use(['mongo','underscore', 'check', 'random', 'coffeescript', 'ecmascript', 'ostrio:cookies@2.0.5'], ['client', 'server']);
  api.addFiles('event-emitter.jsx', 'client');
  api.addAssets('worker.min.js', 'client');
  api.mainModule('files.coffee', ['server', 'client']);
  api.export('FilesCollection');
});

Npm.depends({
  'fs-extra': '0.30.0',
  'request': '2.75.0',
  'throttle': '1.0.3',
  'file-type': '3.8.0'
});
