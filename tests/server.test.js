/* global describe, beforeEach, it, before, afterEach */

import { expect } from 'chai';
import fs from 'node:fs';
import sinon from 'sinon';
import { FilesCollection } from '../server';
import http from 'node:http';
import { Readable } from 'node:stream';

describe('FilesCollection Constructor', function() {
  describe('constructor', function() {
    it('should create an instance of FilesCollection', async function() {
      const filesCollection = new FilesCollection({ collectionName: 'test123'});
      expect(filesCollection instanceof FilesCollection).to.be.true;
    });
  });
});


describe('FilesCollection', () => {
  describe('#_prepareUpload', () => {
    let filesCollection;
    let opts;
    let userId;
    let transport;
    let namingFunctionStub;
    let onBeforeUploadStub;
    let onInitiateUploadStub;

    before(() =>{
      filesCollection = new FilesCollection({ collectionName: 'testserver-prepareUpload', namingFunction: () => {}, onBeforeUpload: () => true, onInitiateUpload: () => {}});
    });

    beforeEach(() => {
      opts = {
        file: {
          name: 'testFile',
          meta: {},
        },
        fileId: '123',
      };
      userId = 'user1';
      transport = 'http';

      // Stubbing the namingFunction method
      namingFunctionStub = sinon.stub(filesCollection, 'namingFunction');
      namingFunctionStub.returns('newName');

      // Stubbing the onBeforeUpload method
      onBeforeUploadStub = sinon.stub(filesCollection, 'onBeforeUpload');
      onBeforeUploadStub.returns(true);

      // Stubbing the onInitiateUpload method
      onInitiateUploadStub = sinon.stub(filesCollection, 'onInitiateUpload');
    });

    afterEach(() => {
      // Restore the stubbed methods after each test
      sinon.restore();
    });

    it('should prepare upload successfully', async () => {
      const { result, opts: newOpts } = await filesCollection._prepareUpload(opts, userId, transport);

      expect(result).to.be.an('object');
      expect(newOpts).to.be.an('object');
      expect(namingFunctionStub.calledOnce).to.be.true;
      expect(onBeforeUploadStub.calledOnce).to.be.true;
      expect(onInitiateUploadStub.called).to.be.false;
    });
  });

  describe('#_finishUpload', () => {
    let filesCollection;
    let result;
    let opts;
    let chmodStub;
    let insertAsyncStub;
    let updateAsyncStub;
    let onAfterUploadSpy;

    before(() => {
      filesCollection = new FilesCollection({ collectionName: 'testserver-finishUpload'});
    });

    beforeEach(() => {
      result = { path: '~/data/path/to/file' };
      opts = { file: { name: 'testFile', meta: {} } };
      fs.mkdirSync(result.path, { recursive: true, flush: true, mode: 0o777 });
      fs.writeFileSync(result.path + '/' + opts.file.name, '', { mode: 0o777 });

      // Stubbing the fs.chmod method
      chmodStub = sinon.stub(fs.promises, 'chmod');
      chmodStub.callsFake((_path, _permissions, callback) => callback());

      // Stubbing the collection.insert method
      insertAsyncStub = sinon.stub(filesCollection.collection, 'insertAsync');

      // Stubbing the _preCollection.update method
      updateAsyncStub = sinon.stub(filesCollection._preCollection, 'updateAsync');

      // Creating a spy for the onAfterUpload hook
      onAfterUploadSpy = sinon.spy();
      filesCollection.onAfterUpload = onAfterUploadSpy;
    });

    afterEach(() => {
      result = { path: '~/data/path/to/file' };
      opts = { file: { name: 'testFile', meta: {} } };
      // Restore the stubbed methods after each test
      fs.unlinkSync(result.path + '/' + opts.file.name);
      sinon.restore();
    });

    it('should finish upload successfully', async () => {
      await filesCollection._finishUpload(result, opts);

      expect(chmodStub.calledOnce).to.be.true;
      expect(insertAsyncStub.calledOnce).to.be.true;
      expect(updateAsyncStub.calledOnce).to.be.true;
    });

    it('should call callback with a single error argument if insert fails', async () => {
      const error = new Meteor.Error(500, 'Insert failed');
      insertAsyncStub.throws(error);

      await filesCollection._finishUpload(result, opts);

      expect(chmodStub.calledOnce).to.be.true;
      expect(insertAsyncStub.calledOnce).to.be.true;
      expect(updateAsyncStub.called).to.be.false;
    });

    it('should call callback with a single error argument if update fails', async () => {
      const error = new Meteor.Error(500, 'Update failed');
      updateAsyncStub.throws(error);

      await filesCollection._finishUpload(result, opts);

      expect(chmodStub.calledOnce).to.be.true;
      expect(insertAsyncStub.calledOnce).to.be.true;
      expect(updateAsyncStub.calledOnce).to.be.true;
    });

    it('should call onAfterUpload hook if it is a function', async () => {
      await filesCollection._finishUpload(result, opts);

      expect(onAfterUploadSpy.calledOnce).to.be.true;
      expect(onAfterUploadSpy.calledWith(result)).to.be.true;
    });
  });

  describe('#writeAsync()', function() {
    let filesCollection; let collectionMock;
    let fsPromiseStatStub; let fsPromisesMkdirStub; let fsPromiseWriteFileStub;

    before(function() {
      filesCollection = new FilesCollection({ collectionName: 'testserver-writeAsync', storagePath: '~/data/write-async'});
    });

    beforeEach(function() {
      fsPromiseStatStub = sinon.stub(fs.promises, 'stat');
      fsPromisesMkdirStub = sinon.stub(fs.promises, 'mkdir');
      fsPromiseWriteFileStub = sinon.stub(fs.promises, 'writeFile');
      collectionMock = sinon.mock(filesCollection.collection);
    });

    afterEach(async function() {
      fsPromiseStatStub.restore();
      fsPromisesMkdirStub.restore();
      fsPromiseWriteFileStub.restore();
      collectionMock.restore();
      await filesCollection.collection.removeAsync({});
    });

    it('should write buffer to FS and add to FilesCollection Collection', async function() {
      const buffer = Buffer.from('test data');
      const opts = { name: 'test.txt', type: 'text/plain', meta: {}, userId: 'user1', fileId: 'file1' };

      fsPromiseStatStub.resolves({ isFile: () => true });
      fsPromiseWriteFileStub.resolves();

      collectionMock.expects('insertAsync').resolves('file1');
      collectionMock.expects('findOneAsync').resolves({ _id: 'file1' });

      const result = await filesCollection.writeAsync(buffer, opts, true);

      collectionMock.verify();
      expect(result).to.be.an('object');
      expect(result).to.have.property('_id', 'file1');
    });

    it('should make all directories if not present, then write buffer to FS and then add to FilesCollection Collection', async function() {
      const buffer = Buffer.from('test data');
      const opts = { name: 'test.txt', type: 'text/plain', meta: {}, userId: 'user1', fileId: 'file1' };

      fsPromiseStatStub.resolves({ isFile: () => true });
      fsPromiseWriteFileStub.resolves();

      collectionMock.expects('insertAsync').resolves('file1');
      collectionMock.expects('findOneAsync').resolves({ _id: 'file1' });

      const result = await filesCollection.writeAsync(buffer, opts, true);

      collectionMock.verify();
      expect(result).to.be.an('object');
      expect(result).to.have.property('_id', 'file1');
    });

    it('should throw error if file could not be written to FS', function(done) {
      const buffer = Buffer.from('test data');
      const opts = { name: 'test.txt', type: 'text/plain', meta: {}, userId: 'user1', fileId: 'file1' };

      fsPromiseStatStub.resolves({ isFile: () => false });
      fsPromiseWriteFileStub.rejects();

      filesCollection.writeAsync(buffer, opts, true).catch((e) => {
        expect(e).to.be.instanceOf(Error);
        done();
      });
    });

    it('should throw an error if file could not be added to FilesCollection Collection', function (done) {
      const buffer = Buffer.from('test data');
      const opts = { name: 'test.txt', type: 'text/plain', meta: {}, userId: 'user1', fileId: 'file1' };

      fsPromiseStatStub.resolves({ isFile: () => true });
      collectionMock.expects('insertAsync').rejects(new Error('Test Error'));

      filesCollection.writeAsync(buffer, opts, true).catch((e) => {
        expect(e).to.be.instanceOf(Error);
        done();
      });
    });

    it('actually writes the file to the FS and to the db (no mocking)', async function() {
      const testData = 'test data';
      const buffer = Buffer.from(testData);

      const opts = { name: 'test.txt', type: 'text/plain', meta: {}, userId: 'user1', fileId: 'file1' };

      sinon.stub(filesCollection, 'storagePath').returns('~/data');
      fsPromiseStatStub.restore();
      fsPromiseWriteFileStub.restore();
      fsPromisesMkdirStub.restore();

      const result = await filesCollection.writeAsync(buffer, opts, true);

      const file = await filesCollection.collection.findOneAsync({ _id: 'file1' });
      expect(file).to.be.an('object');
      expect(file).to.have.property('_id', 'file1');
      expect(file).to.have.property('name', 'test.txt');
      expect(file).to.have.property('size', 9);
      expect(file).to.have.property('type', 'text/plain');
      expect(file).to.have.property('extension', 'txt');
      expect(file).to.have.property('path');
      expect(file).to.have.property('versions');
      expect(file.versions).to.have.property('original');
      expect(file.versions.original).to.have.property('path');
      expect(file.versions.original).to.have.property('size', 9);
      expect(file.versions.original).to.have.property('type', 'text/plain');
      expect(file.versions.original).to.have.property('extension', 'txt');

      const fileOnDisk = fs.readFileSync(file.versions.original.path, 'utf8');
      expect(fileOnDisk).to.deep.equal(testData);

      expect(result).to.be.an('object');
      expect(result).to.have.property('_id', 'file1');

      // Cleanup∏
      await fs.promises.unlink(file.versions.original.path);
    });
  });

  describe('#loadAsync()', function() {
    let filesCollection;
    const testdata = 'test data';
    let port;

    before(function() {
      filesCollection = new FilesCollection({ collectionName: 'testserver-loadAsync', storagePath: '~/data/load-async'});

      const server = http.createServer((_req, res) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end(testdata);
      });

      server.listen(undefined, '127.0.0.1', () => {
        port = server.address().port;
      });
    });

    beforeEach(function() {
    });

    afterEach(async function() {
      await filesCollection.collection.removeAsync({});
    });

    it('should download file over HTTP, write stream to FS, and add to FilesCollection Collection', async function() {
      const url = 'http://127.0.0.1:' + port;
      const opts = { name: 'test.txt', type: 'text/plain', meta: {}, userId: 'user1', fileId: 'file1', timeout: 360000 };

      const result = await filesCollection.loadAsync(url, opts, true);

      expect(result).to.be.an('object');

      const file = await filesCollection.collection.findOneAsync({ _id: result._id });
      expect(file).to.be.an('object');
    });
  });

  describe('#addFile', () => {
    let filesCollection;
    let path;
    let opts;
    let proceedAfterUpload;

    before(() => {
      filesCollection = new FilesCollection({ collectionName: 'testserver', onAfterUpload: () => {}});
      path = '~/data/meteor-test-file.txt';
      fs.writeFileSync(path, 'test');
      opts = { type: 'text/plain'};
      proceedAfterUpload = false;
    });

    afterEach(() => {
      // Restore the stubbed methods after each test
      sinon.restore();
    });

    it('should add a file successfully', async () => {
      const result = await filesCollection.addFile(path, opts, proceedAfterUpload);

      // Check if the result is correct
      expect(result).to.be.an('object');
      expect(result).to.have.property('_id');
      expect(result).to.have.property('name', 'meteor-test-file.txt');
      expect(result).to.have.property('size', 4);
      expect(result).to.have.property('type', 'text/plain');
      expect(result).to.have.property('extension', 'txt');
      expect(result).to.have.property('extensionWithDot', '.txt');
      expect(result).to.have.property('path', path);

      // Check if the file exists in the database
      const file = await filesCollection.collection.findOneAsync({ _id: result._id });
      expect(file).to.be.an('object');
      expect(file).to.have.property('_id');
      expect(file).to.have.property('name', 'meteor-test-file.txt');
      expect(file).to.have.property('size', 4);
      expect(file).to.have.property('type', 'text/plain');
      expect(file).to.have.property('extension', 'txt');
      expect(file).to.have.property('extensionWithDot', '.txt');
      expect(file).to.have.property('path', path);
    });

    it('should call onAfterUpload hook if flag is true', async () => {
      // Stub the `onAfterUpload` method
      sinon.stub(filesCollection, 'onAfterUpload');

      await filesCollection.addFile(path, opts, true);

      expect(filesCollection.onAfterUpload.calledWith()).to.be.true;
    });

    it('should not call onAfterUpload hook if flag is false', async () => {
      // Stub the `onAfterUpload` method
      sinon.stub(filesCollection, 'onAfterUpload');

      await filesCollection.addFile(path, opts, false);

      expect(filesCollection.onAfterUpload.calledWith()).to.be.false;
    });

    it('should throw an error if file does not exist', async () => {
      const nonExistingPath = '/tmp/meteor-test-file-non-existing.txt';
      try {
        await filesCollection.addFile(nonExistingPath, opts, proceedAfterUpload);
      } catch (e) {
        expect(e).to.be.instanceOf(Meteor.Error);
        expect(e.error).to.equal(400);
      }
    }
    );

    it('should throw an error if file is not readable', async () => {
      const nonReadablePath = '/tmp/meteor-test-file-non-readable.txt';
      fs.writeFileSync(nonReadablePath, 'test');
      fs.chmodSync(nonReadablePath, 0o200);
      try {
        await filesCollection.addFile(nonReadablePath, opts, proceedAfterUpload);
      } catch (e) {
        expect(e).to.be.instanceOf(Meteor.Error);
        expect(e.error).to.equal(400);
      }
    });

    it('should throw an error, if path is not a file', async () => {
      const nonFile = '/tmp';
      try {
        await filesCollection.addFile(nonFile, opts, proceedAfterUpload);
      } catch (e) {
        expect(e).to.be.instanceOf(Meteor.Error);
        expect(e.error).to.equal(400);
      }
    });

    it('should throw an error, if file is added to a public collection', async () => {
      const publicFilesCollection = new FilesCollection({ collectionName: 'testserver-pub', public: true, storagePath: '/tmp', downloadRoute: '/public' });
      try {
        await publicFilesCollection.addFile(path, opts, proceedAfterUpload);
      } catch (e) {
        expect(e).to.be.instanceOf(Meteor.Error);
        expect(e.error).to.equal(403);
      }
    });
  });

  describe('#download', () => {
    let filesCollection;
    let httpObj;
    let version;
    let fileRef;
    let statStub;
    let _404Stub;
    let serveStub;

    before(() => {
      filesCollection = new FilesCollection({collectionName: 'testserver-downloadAsync', downloadCallbackAsync: async () => {return true;}});
    });

    beforeEach(() => {
      httpObj = { request: { originalUrl: '/path/to/file', headers: { 'x-mtok': 'token'} }, response: { writeHead: () => {}, end: () => {}} };

      version = 'original';
      fileRef = {
        versions: {
          original: {
            path: '/path/to/file',
            size: 100,
          },
        },
      };

      // Stubbing the fs.promises.stat method
      statStub = sinon.stub(fs.promises, 'stat');
      statStub.resolves({ isFile: () => true, size: 100 });

      // Stubbing the _404 method
      _404Stub = sinon.stub(filesCollection, '_404');

      // Stubbing the serve method
      serveStub = sinon.stub(filesCollection, 'serve');
    });

    afterEach(() => {
      // Restore the stubbed methods after each test
      sinon.restore();
    });

    it('should download a file successfully', async () => {
      await filesCollection.download(httpObj, version, fileRef);

      expect(statStub.calledOnce).to.be.true;
      expect(_404Stub.called).to.be.false;
      expect(serveStub.calledOnce).to.be.true;
    });

    it('should return 404 if file does not exist', async () => {
      statStub.resolves({ isFile: () => false });
      await filesCollection.download(httpObj, version, fileRef);

      expect(statStub.calledOnce).to.be.true;
      expect(_404Stub.calledOnce).to.be.true;
      expect(serveStub.called).to.be.false;
    });

    it('should call downloadCallbackAsync if it is a function', async () => {
      const downloadCallback = sinon.stub().returns(new Promise((resolve) => resolve(true)));
      filesCollection.downloadCallback = downloadCallback;
      await filesCollection.download(httpObj, version, fileRef);

      expect(statStub.calledOnce).to.be.true;
      expect(_404Stub.called).to.be.false;
      expect(serveStub.calledOnce).to.be.true;
      expect(downloadCallback.calledOnce).to.be.true;
    });

    it('should not call downloadCallback if it is not a function', async () => {
      filesCollection.downloadCallbackAsync = null;
      await filesCollection.download(httpObj, version, fileRef);

      expect(statStub.calledOnce).to.be.true;
      expect(_404Stub.called).to.be.false;
      expect(serveStub.calledOnce).to.be.true;
    });

    it('should return 404 if downloadCallbackAsync returns false', async () => {
      const downloadCallback = sinon.stub().returns(new Promise((resolve) => resolve(false)));
      filesCollection.downloadCallback = downloadCallback;
      await filesCollection.download(httpObj, version, fileRef);

      expect(statStub.calledOnce).to.be.false;
      expect(_404Stub.calledOnce).to.be.true;
      expect(serveStub.called).to.be.false;

      filesCollection.downloadCallback = null;
    });

    it('should call interceptDownload if it is a function, that resolves true', async () => {
      const interceptDownload = sinon.stub().resolves(true);
      filesCollection.interceptDownload = interceptDownload;
      await filesCollection.download(httpObj, version, fileRef);

      expect(statStub.calledOnce).to.be.false;
      expect(_404Stub.called).to.be.false;
      expect(serveStub.calledOnce).to.be.false;
      expect(interceptDownload.calledOnce).to.be.true;

      filesCollection.interceptDownload = null;
    });

    it('should proceed if interceptDownload is a function, that returns false', async () => {
      const interceptDownload = sinon.stub().resolves(false);
      filesCollection.interceptDownload = interceptDownload;
      await filesCollection.download(httpObj, version, fileRef);

      expect(statStub.calledOnce).to.be.true;
      expect(_404Stub.called).to.be.false;
      expect(serveStub.calledOnce).to.be.true;
      expect(interceptDownload.calledOnce).to.be.true;

      filesCollection.interceptDownload = null;
    });
  });

  describe('#serve', function() {
    let server;
    let filesCollection;
    let port;

    before(function() {
      filesCollection = new FilesCollection({ collectionName: 'testserver-serve' });
    });

    beforeEach(async function() {
      const path = '/tmp/testfile.txt';
      const content = 'testfile';
      server = http.createServer((req, res) => {
        const readableStream = Readable.from(content);
        const fileRef = { name: 'testfile.txt' };
        const vRef = { name: 'testfile.txt', size: Buffer.byteLength(content), path };

        filesCollection.serve({request: req, response: res}, fileRef, vRef, 'original', readableStream);
      });
      server.listen(0);

      port = server.address().port;
    });

    afterEach(function() {
      server.close();
    });

    it('should serve a fileRef object', function(done) {
      http.get('http://localhost:' + port, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          expect(data).to.equal('testfile');
          done();
        });
      });
    });
  });
});
