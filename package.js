Package.describe({
  name: 'ostrio:files',
  version: '4.0.0',
  summary: 'Upload files to a server or 3rd party storage: AWS:S3, GridFS, DropBox, and other',
  git: 'https://github.com/veliovgroup/Meteor-Files',
  documentation: 'README.md'
});

Package.onUse((api) => {
  api.versionsFrom(['3.2', '3.5']);
  api.use('webapp', 'server');
  api.use(['reactive-var', 'tracker', 'ddp-client'], 'client');
  api.use(['mongo', 'check', 'random', 'ecmascript', 'fetch', 'ostrio:cookies@3.0.0'], ['client', 'server']);
  api.addAssets('worker.min.js', 'client');
  api.mainModule('server.js', 'server');
  api.mainModule('client.js', 'client');
  api.export('FilesCollection');

  // TypeScript setup
  api.use(['zodern:types@1.0.13', 'typescript'], ['client', 'server'], { weak: true });
  // For zodern:types to pick up our published types.
  api.addAssets('index.d.ts', ['client', 'server']);

  Npm.depends({
    eventemitter3: '5.0.4',
  });
});

Package.onTest((api) => {
  api.use('meteortesting:mocha@3.4.0');
  api.use(['ecmascript', 'ostrio:files'], ['client', 'server']);
  api.mainModule('tests/server.js', 'server');
  api.mainModule('tests/client.js', 'client');

  Npm.depends({
    eventemitter3: '5.0.4',
    chai: '6.3.0',
    sinon: '22.1.0',
  });
});
