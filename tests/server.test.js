/* global describe, beforeEach, it, before, after, afterEach */

import { expect } from 'chai';
import fs from 'node:fs';
import os from 'node:os';
import nodePath from 'node:path';
import zlib from 'node:zlib';
import sinon from 'sinon';
import http from 'node:http';
import { Readable } from 'node:stream';
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { FilesCollection, WriteStream, helpers } from '../server.js';

const TMP_ROOT = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'mf-server-'));
const tmpDir = (name) => {
  const dir = nodePath.join(TMP_ROOT, `${name}-${Random.id(6)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

/**
 * Assert that a promise rejects, and return the error
 */
const expectRejects = async (promise) => {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  expect.fail('Expected promise to reject');
  return null;
};

const listen = (server) => new Promise((resolve) => {
  server.listen(0, '127.0.0.1', () => resolve(server.address().port));
});

const get = (url, headers = {}) => new Promise((resolve, reject) => {
  http.get(url, { headers }, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
  }).on('error', reject);
});

const call = (fc, kind, userId, ...args) => {
  return Meteor.server.method_handlers[fc._methodNames[kind]].apply({ userId, connection: null, unblock() {} }, args);
};

after(function () {
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

describe('FilesCollection Constructor', function() {
  describe('constructor', function() {
    it('should create an instance of FilesCollection', async function() {
      const filesCollection = new FilesCollection({ collectionName: 'test123', storagePath: tmpDir('ctor') });
      expect(filesCollection instanceof FilesCollection).to.be.true;
    });

    it('C23: normalizes string storagePath and strips trailing slash', function() {
      const dir = tmpDir('ctor-trailing');
      const fc = new FilesCollection({ collectionName: `testserver-trailing-${Random.id(4)}`, storagePath: `${dir}//` });
      expect(fc.storagePath()).to.equal(dir);
    });

    it('C2: keeps object responseHeaders', function() {
      const responseHeaders = { 'X-Custom': '1' };
      const fc = new FilesCollection({ collectionName: `testserver-rh-${Random.id(4)}`, storagePath: tmpDir('rh'), responseHeaders });
      expect(fc.responseHeaders).to.equal(responseHeaders);
    });
  });
});


describe('FilesCollection', function() {
  this.timeout(10000);

  describe('#_prepareUpload', () => {
    let filesCollection;
    let opts;
    let userId;
    let transport;
    let namingFunctionStub;
    let onBeforeUploadStub;
    let onInitiateUploadStub;

    before(() =>{
      filesCollection = new FilesCollection({ collectionName: 'testserver-prepareUpload', storagePath: tmpDir('prepare'), namingFunction: () => {}, onBeforeUpload: () => true, onInitiateUpload: () => {}});
    });

    beforeEach(() => {
      opts = {
        file: {
          name: 'testFile',
          meta: {},
        },
        fileId: '123',
        ___s: true,
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
      expect(result.path).to.equal(nodePath.join(filesCollection.storagePath({}), 'newName'));
      expect(namingFunctionStub.calledOnce).to.be.true;
      expect(onBeforeUploadStub.calledOnce).to.be.true;
      // onInitiateUpload runs in _startUpload, after the upload record is saved
      expect(onInitiateUploadStub.called).to.be.false;
    });

    it('does not call namingFunction or onInitiateUpload for chunks', async () => {
      const { result } = await filesCollection._prepareUpload({ ...opts, ___s: false, path: '/stored/path.txt', userId: 'user1', chunkId: 1 }, userId, transport);
      expect(result.path).to.equal('/stored/path.txt');
      expect(namingFunctionStub.called).to.be.false;
      expect(onBeforeUploadStub.calledOnce).to.be.true;
      expect(onInitiateUploadStub.called).to.be.false;
    });

    it('C14: does not mutate opts.file', async () => {
      const file = { name: 'a.txt', meta: { nested: { a: 1 } } };
      const { result } = await filesCollection._prepareUpload({ ...opts, file }, userId, transport);
      result.meta.nested.a = 2;
      expect(file).to.deep.equal({ name: 'a.txt', meta: { nested: { a: 1 } } });
    });
  });

  describe('#_finishUpload', () => {
    let filesCollection;
    let result;
    let opts;
    let insertAsyncStub;
    let updateAsyncStub;
    let onAfterUploadSpy;
    let dir;

    before(() => {
      dir = tmpDir('finish');
      filesCollection = new FilesCollection({ collectionName: 'testserver-finishUpload', storagePath: dir });
    });

    beforeEach(() => {
      result = { _id: 'finish1', path: nodePath.join(dir, 'testFile'), size: 999, versions: { original: { size: 999 } } };
      opts = { fileId: 'finish1', file: { name: 'testFile', meta: {} } };
      fs.writeFileSync(result.path, 'abc', { mode: 0o644 });

      insertAsyncStub = sinon.stub(filesCollection.collection, 'insertAsync').resolves('finish1');
      updateAsyncStub = sinon.stub(filesCollection._preCollection, 'updateAsync').resolves(1);
      onAfterUploadSpy = sinon.spy();
      filesCollection.onAfterUpload = onAfterUploadSpy;
    });

    afterEach(() => {
      filesCollection.onAfterUpload = false;
      fs.rmSync(result.path, { force: true });
      sinon.restore();
    });

    it('should finish upload successfully', async () => {
      const res = await filesCollection._finishUpload(result, opts);

      expect(insertAsyncStub.calledOnce).to.be.true;
      expect(updateAsyncStub.calledOnce).to.be.true;
      expect(res).to.equal(result);
    });

    it('S4: stores the size on disk, not the declared size', async () => {
      await filesCollection._finishUpload(result, opts);
      expect(result.size).to.equal(3);
      expect(result.versions.original.size).to.equal(3);
      expect(insertAsyncStub.firstCall.args[0].size).to.equal(3);
    });

    it('C16: rejects and removes the file if insert fails', async () => {
      insertAsyncStub.rejects(new Meteor.Error(500, 'Insert failed'));

      const error = await expectRejects(filesCollection._finishUpload(result, opts));

      expect(error.reason).to.equal('Insert failed');
      expect(updateAsyncStub.called).to.be.false;
      expect(onAfterUploadSpy.called).to.be.false;
      expect(fs.existsSync(result.path)).to.be.false;
    });

    it('C16: still runs onAfterUpload if _preCollection update fails', async () => {
      updateAsyncStub.rejects(new Meteor.Error(500, 'Update failed'));

      await filesCollection._finishUpload(result, opts);

      expect(insertAsyncStub.calledOnce).to.be.true;
      expect(updateAsyncStub.calledOnce).to.be.true;
      expect(onAfterUploadSpy.calledOnce).to.be.true;
    });

    it('should call onAfterUpload hook if it is a function', async () => {
      await filesCollection._finishUpload(result, opts);

      expect(onAfterUploadSpy.calledOnce).to.be.true;
      expect(onAfterUploadSpy.calledWith(result)).to.be.true;
    });

    it('C16: does not reject when onAfterUpload throws', async () => {
      filesCollection.onAfterUpload = () => {
        throw new Error('hook failed');
      };
      await filesCollection._finishUpload(result, opts);
      expect(insertAsyncStub.calledOnce).to.be.true;
    });
  });

  describe('#writeAsync()', function() {
    let filesCollection;
    let collectionMock;
    let dir;

    before(function() {
      dir = tmpDir('write-async');
      filesCollection = new FilesCollection({ collectionName: 'testserver-writeAsync', storagePath: dir });
    });

    beforeEach(function() {
      collectionMock = sinon.mock(filesCollection.collection);
    });

    afterEach(async function() {
      sinon.restore();
      await filesCollection.collection.removeAsync({});
    });

    it('should write buffer to FS and add to FilesCollection Collection', async function() {
      const buffer = Buffer.from('test data');
      const opts = { name: 'test.txt', type: 'text/plain', meta: {}, userId: 'user1', fileId: 'file1' };

      collectionMock.expects('insertAsync').resolves('file1');
      collectionMock.expects('findOneAsync').resolves({ _id: 'file1' });

      const result = await filesCollection.writeAsync(buffer, opts, true);

      collectionMock.verify();
      expect(result).to.be.an('object');
      expect(result).to.have.property('_id', 'file1');
    });

    it('should make all directories if not present, then write buffer to FS and then add to FilesCollection Collection', async function() {
      const buffer = Buffer.from('test data');
      const nested = nodePath.join(dir, 'nested', 'deeper');
      const opts = { name: 'test.txt', type: 'text/plain', meta: {}, userId: 'user1', fileId: 'file2' };
      sinon.stub(filesCollection, 'storagePath').returns(nested);

      collectionMock.expects('insertAsync').resolves('file2');
      collectionMock.expects('findOneAsync').resolves({ _id: 'file2' });

      const result = await filesCollection.writeAsync(buffer, opts, true);

      collectionMock.verify();
      expect(result).to.have.property('_id', 'file2');
      expect(fs.readFileSync(nodePath.join(nested, 'file2.txt'), 'utf8')).to.equal('test data');
    });

    it('should throw error if file could not be written to FS', async function() {
      const buffer = Buffer.from('test data');
      const opts = { name: 'test.txt', type: 'text/plain', meta: {}, userId: 'user1', fileId: 'file3' };

      sinon.stub(fs.promises, 'open').rejects(new Error('EACCES'));

      const error = await expectRejects(filesCollection.writeAsync(buffer, opts, true));
      expect(error).to.be.instanceOf(Meteor.Error);
    });

    it('should throw an error if file could not be added to FilesCollection Collection', async function () {
      const buffer = Buffer.from('test data');
      const opts = { name: 'test.txt', type: 'text/plain', meta: {}, userId: 'user1', fileId: 'file4' };

      collectionMock.expects('insertAsync').rejects(new Error('Test Error'));

      const error = await expectRejects(filesCollection.writeAsync(buffer, opts, true));
      expect(error).to.be.instanceOf(Error);
    });

    it('actually writes the file to the FS and to the db (no mocking)', async function() {
      collectionMock.restore();
      const testData = 'test data';
      const buffer = Buffer.from(testData);

      const opts = { name: 'test.txt', type: 'text/plain', meta: {}, userId: 'user1', fileId: 'file5' };

      const result = await filesCollection.writeAsync(buffer, opts, true);

      const file = await filesCollection.collection.findOneAsync({ _id: 'file5' });
      expect(file).to.be.an('object');
      expect(file).to.have.property('_id', 'file5');
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
      expect(result).to.have.property('_id', 'file5');

      // Cleanup
      await fs.promises.unlink(file.versions.original.path);
    });

    it('C5: truncates a longer leftover file at the same path', async function() {
      collectionMock.restore();
      const path = nodePath.join(dir, 'file6.txt');
      fs.writeFileSync(path, 'a much longer leftover content');
      await filesCollection.writeAsync(Buffer.from('short'), { name: 'x.txt', fileId: 'file6' });
      expect(fs.readFileSync(path, 'utf8')).to.equal('short');
    });

    it('C4/C5: rejects with 409 when fileId already exists and keeps its file', async function() {
      collectionMock.restore();
      await filesCollection.writeAsync(Buffer.from('original'), { name: 'x.txt', fileId: 'file7' });
      const error = await expectRejects(filesCollection.writeAsync(Buffer.from('evil'), { name: 'x.txt', fileId: 'file7' }));
      expect(error.error).to.equal(409);
      expect(fs.readFileSync(nodePath.join(dir, 'file7.txt'), 'utf8')).to.equal('original');
    });

    it('S11: sanitizes namingFunction output, keeps nested directories', async function() {
      collectionMock.restore();
      const fc = new FilesCollection({ collectionName: `testserver-naming-${Random.id(4)}`, storagePath: tmpDir('naming'), namingFunction: () => 'sub/../../x y' });
      const fileObj = await fc.writeAsync(Buffer.from('n'), { name: 'n.txt' });
      expect(fileObj.path).to.equal(nodePath.join(fc.storagePath({}), 'sub', 'x-y.txt'));
    });
  });

  describe('#loadAsync()', function() {
    let filesCollection;
    const testdata = 'test data';
    let port;
    let server;
    let dir;

    before(async function() {
      dir = tmpDir('load-async');
      filesCollection = new FilesCollection({ collectionName: 'testserver-loadAsync', storagePath: dir });

      server = http.createServer((req, res) => {
        if (req.url === '/hang') {
          return;
        }

        if (req.url === '/404') {
          res.statusCode = 404;
          res.end('nope');
          return;
        }

        if (req.url === '/gzip') {
          const body = zlib.gzipSync(Buffer.alloc(5000, 97));
          res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Encoding': 'gzip', 'Content-Length': body.length });
          res.end(body);
          return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end(testdata);
      });

      port = await listen(server);
    });

    after(function() {
      server.closeAllConnections?.();
      server.close();
    });

    afterEach(async function() {
      sinon.restore();
      await filesCollection.collection.removeAsync({});
    });

    it('should download file over HTTP, write stream to FS, and add to FilesCollection Collection', async function() {
      const url = `http://127.0.0.1:${port}`;
      const opts = { name: 'test.txt', type: 'text/plain', meta: {}, userId: 'user1', fileId: 'file1', timeout: 360000 };

      const result = await filesCollection.loadAsync(url, opts, true);

      expect(result).to.be.an('object');

      const file = await filesCollection.collection.findOneAsync({ _id: result._id });
      expect(file).to.be.an('object');
      expect(file.size).to.equal(testdata.length);
      expect(fs.readFileSync(file.path, 'utf8')).to.equal(testdata);
    });

    it('C3: rejects with 408 on timeout instead of throwing inside a timer', async function() {
      const error = await expectRejects(filesCollection.loadAsync(`http://127.0.0.1:${port}/hang`, { name: 'hang.txt', fileId: 'hang1', timeout: 100 }));
      expect(error.error).to.equal(408);
      expect(fs.existsSync(nodePath.join(dir, 'hang1.txt'))).to.be.false;
    });

    it('C4: rejects on HTTP error and leaves no file behind', async function() {
      const error = await expectRejects(filesCollection.loadAsync(`http://127.0.0.1:${port}/404`, { name: 'missing.txt', fileId: 'missing1' }));
      expect(error).to.be.instanceOf(Error);
      expect(fs.existsSync(nodePath.join(dir, 'missing1.txt'))).to.be.false;
    });

    it('C4: stores size on disk for compressed responses', async function() {
      const fileObj = await filesCollection.loadAsync(`http://127.0.0.1:${port}/gzip`, { name: 'gz.txt', fileId: 'gzip1' });
      expect(fileObj.size).to.equal(5000);
      expect(fileObj.versions.original.size).to.equal(5000);
    });

    it('C4: rejects with 409 when fileId exists and keeps the existing file', async function() {
      const first = await filesCollection.loadAsync(`http://127.0.0.1:${port}`, { name: 'dup.txt', fileId: 'dup1' });
      const error = await expectRejects(filesCollection.loadAsync(`http://127.0.0.1:${port}/404`, { name: 'dup.txt', fileId: 'dup1' }));
      expect(error.error).to.equal(409);
      expect(fs.readFileSync(first.path, 'utf8')).to.equal(testdata);
    });

    it('C4: does not log request headers', async function() {
      const debugSpy = sinon.spy(filesCollection, '_debug');
      await filesCollection.loadAsync(`http://127.0.0.1:${port}`, { name: 'h.txt', headers: { Authorization: 'Bearer secret-token' } });
      const logged = debugSpy.getCalls().map((c) => c.args.map((a) => (typeof a === 'string' ? a : '')).join(' ')).join('\n');
      expect(logged).to.not.include('secret-token');
    });
  });

  describe('#addFile', () => {
    let filesCollection;
    let path;
    let opts;
    let proceedAfterUpload;

    before(() => {
      filesCollection = new FilesCollection({ collectionName: 'testserver', storagePath: tmpDir('addfile-storage'), onAfterUpload: () => {}});
      path = nodePath.join(tmpDir('addfile'), 'meteor-test-file.txt');
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
      expect(result).to.have.property('_storagePath', nodePath.dirname(path));

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

    it('C23: sets _storagePath to the directory when fileName differs from the file name on disk', async () => {
      const result = await filesCollection.addFile(path, { type: 'text/plain', fileName: 'other-name.txt' });
      expect(result._storagePath).to.equal(nodePath.dirname(path));
      expect(result.name).to.equal('other-name.txt');
    });

    it('C23: sets empty extensionWithDot for files without extension', async () => {
      const noExt = nodePath.join(nodePath.dirname(path), 'no-extension');
      fs.writeFileSync(noExt, 'x');
      const result = await filesCollection.addFile(noExt, {});
      expect(result.extension).to.equal('');
      expect(result.extensionWithDot).to.equal('');
    });

    it('should call onAfterUpload hook if flag is true', async () => {
      // Stub the `onAfterUpload` method
      sinon.stub(filesCollection, 'onAfterUpload');

      await filesCollection.addFile(path, opts, true);

      expect(filesCollection.onAfterUpload.calledOnce).to.be.true;
    });

    it('should not call onAfterUpload hook if flag is false', async () => {
      // Stub the `onAfterUpload` method
      sinon.stub(filesCollection, 'onAfterUpload');

      await filesCollection.addFile(path, opts, false);

      expect(filesCollection.onAfterUpload.called).to.be.false;
    });

    it('should throw an error if file does not exist', async () => {
      const nonExistingPath = nodePath.join(TMP_ROOT, 'meteor-test-file-non-existing.txt');
      const error = await expectRejects(filesCollection.addFile(nonExistingPath, opts, proceedAfterUpload));
      expect(error).to.be.instanceOf(Meteor.Error);
      expect(error.error).to.equal(400);
    });

    it('should throw an error, if path is not a file', async () => {
      const error = await expectRejects(filesCollection.addFile(TMP_ROOT, opts, proceedAfterUpload));
      expect(error).to.be.instanceOf(Meteor.Error);
      expect(error.error).to.equal(400);
    });

    it('should throw an error, if file is added to a public collection', async () => {
      const publicFilesCollection = new FilesCollection({ collectionName: 'testserver-pub', public: true, storagePath: tmpDir('pub'), downloadRoute: '/public-testserver' });
      const error = await expectRejects(publicFilesCollection.addFile(path, opts, proceedAfterUpload));
      expect(error).to.be.instanceOf(Meteor.Error);
      expect(error.error).to.equal(403);
    });
  });

  describe('#unlinkAsync', () => {
    it('C23: does not throw when a version file is already gone', async () => {
      const fc = new FilesCollection({ collectionName: `testserver-unlink-${Random.id(4)}`, storagePath: tmpDir('unlink') });
      const fileRef = { _id: 'u1', versions: { thumb: { path: nodePath.join(TMP_ROOT, 'gone.txt') } } };
      expect(await fc.unlinkAsync(fileRef, 'thumb')).to.equal(fc);
    });

    it('treats a file that is already gone as removed and logs one line without a stack', async () => {
      const fc = new FilesCollection({ collectionName: `testserver-unlink-${Random.id(4)}`, storagePath: tmpDir('unlink') });
      const debug = sinon.stub(fc, '_debug');
      try {
        const gone = nodePath.join(TMP_ROOT, 'gone-again.txt');
        expect(await fc.unlinkAsync({ _id: 'u2', path: gone })).to.equal(fc);
        const calls = debug.getCalls().filter((c) => c.args.some((a) => a instanceof Error) || `${c.args[0]}`.includes('already removed'));
        expect(calls).to.have.length(1);
        expect(calls[0].args).to.have.length(1);
        expect(calls[0].args[0]).to.include('already removed');
      } finally {
        debug.restore();
      }
    });

    it('removeAsync() removes the record when its file is already gone', async () => {
      const fc = new FilesCollection({ collectionName: `testserver-unlink-${Random.id(4)}`, storagePath: tmpDir('unlink') });
      const debug = sinon.stub(fc, '_debug');
      try {
        const _id = await fc.collection.insertAsync({ name: 'gone.txt', path: nodePath.join(TMP_ROOT, 'gone-3.txt'), versions: { original: { path: nodePath.join(TMP_ROOT, 'gone-3.txt') } } });
        expect(await fc.removeAsync({ _id })).to.equal(1);
        expect(await fc.collection.findOneAsync(_id)).to.equal(undefined);
        expect(debug.getCalls().some((c) => c.args.some((a) => a instanceof Error))).to.equal(false);
      } finally {
        debug.restore();
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
      filesCollection = new FilesCollection({ collectionName: 'testserver-downloadAsync', storagePath: tmpDir('download') });
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
      // Restore the stubbed methods and directly assigned hooks after each test
      sinon.restore();
      filesCollection.downloadCallback = false;
      filesCollection.interceptDownload = false;
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

    it('should call downloadCallback if it is a function', async () => {
      const downloadCallback = sinon.stub().resolves(true);
      filesCollection.downloadCallback = downloadCallback;
      await filesCollection.download(httpObj, version, fileRef);

      expect(statStub.calledOnce).to.be.true;
      expect(_404Stub.called).to.be.false;
      expect(serveStub.calledOnce).to.be.true;
      expect(downloadCallback.calledOnce).to.be.true;
      expect(downloadCallback.firstCall.args[1]).to.equal(fileRef);
    });

    it('should return 404 if downloadCallback resolves false', async () => {
      const downloadCallback = sinon.stub().resolves(false);
      filesCollection.downloadCallback = downloadCallback;
      await filesCollection.download(httpObj, version, fileRef);

      expect(statStub.called).to.be.false;
      expect(_404Stub.calledOnce).to.be.true;
      expect(serveStub.called).to.be.false;
    });

    it('should call interceptDownload if it is a function, that resolves true', async () => {
      const interceptDownload = sinon.stub().resolves(true);
      filesCollection.interceptDownload = interceptDownload;
      await filesCollection.download(httpObj, version, fileRef);

      expect(statStub.called).to.be.false;
      expect(_404Stub.called).to.be.false;
      expect(serveStub.called).to.be.false;
      expect(interceptDownload.calledOnce).to.be.true;
    });

    it('should proceed if interceptDownload is a function, that returns false', async () => {
      const interceptDownload = sinon.stub().resolves(false);
      filesCollection.interceptDownload = interceptDownload;
      await filesCollection.download(httpObj, version, fileRef);

      expect(statStub.calledOnce).to.be.true;
      expect(_404Stub.called).to.be.false;
      expect(serveStub.calledOnce).to.be.true;
      expect(interceptDownload.calledOnce).to.be.true;
    });
  });

  describe('#serve', function() {
    let server;
    let filesCollection;
    let port;
    let serveArgs;

    before(function() {
      filesCollection = new FilesCollection({ collectionName: 'testserver-serve', storagePath: tmpDir('serve') });
    });

    beforeEach(async function() {
      const content = 'testfile';
      serveArgs = {};
      server = http.createServer((req, res) => {
        const readableStream = Readable.from(content);
        const fileRef = { name: 'testfile.txt' };
        const vRef = { name: 'testfile.txt', size: Buffer.byteLength(content), path: nodePath.join(TMP_ROOT, 'testfile.txt') };

        try {
          filesCollection.serve({request: req, response: res}, fileRef, vRef, 'original', readableStream);
        } catch (error) {
          serveArgs.error = error;
          res.end();
        }
      });
      port = await listen(server);
    });

    afterEach(function() {
      sinon.restore();
      server.close();
    });

    it('should serve a fileRef object', async function() {
      const res = await get(`http://127.0.0.1:${port}`);
      expect(res.body).to.equal('testfile');
    });

    it('C23: does not throw when responseHeaders function returns undefined', async function() {
      sinon.stub(filesCollection, 'responseHeaders').value(() => undefined);
      const res = await get(`http://127.0.0.1:${port}`);
      expect(serveArgs.error).to.equal(undefined);
      expect(res.body).to.equal('testfile');
    });

    it('C2: sends object responseHeaders', async function() {
      sinon.stub(filesCollection, 'responseHeaders').value({ 'X-Custom-Header': 'yes' });
      const res = await get(`http://127.0.0.1:${port}`);
      expect(res.headers['x-custom-header']).to.equal('yes');
    });
  });

  describe('public route', function() {
    it('C23: serves original files whose _id contains "-"', async function() {
      const dir = tmpDir('public-dash');
      const downloadRoute = `/mfpub${Random.id(6).toLowerCase()}`;
      const fc = new FilesCollection({ collectionName: `testserver-pubdash-${Random.id(4)}`, public: true, storagePath: dir, downloadRoute });
      const path = nodePath.join(dir, 'ab-cd.txt');
      fs.writeFileSync(path, 'dash');
      await fc.collection.insertAsync({ _id: 'ab-cd', name: 'ab-cd.txt', size: 4, type: 'text/plain', path, versions: { original: { path, size: 4, type: 'text/plain' } } });
      const res = await get(Meteor.absoluteUrl(`${downloadRoute.slice(1)}/ab-cd.txt`));
      expect(res.status).to.equal(200);
      expect(res.body).to.equal('dash');
    });
  });

  describe('#_checkAccess', function() {
    const token = `tok-${Random.id()}`;
    let fc;

    const makeHttp = (headers = {}, params = {}) => {
      const response = { codes: [], headersSent: false, finished: false, writeHead(code) { this.codes.push(code); }, end() {} };
      return { request: { headers }, response, params };
    };

    before(function() {
      Meteor.server.sessions.set(token, { userId: 'session-user' });
    });

    after(function() {
      Meteor.server.sessions.delete(token);
    });

    it('protected: true denies requests without a session', async function() {
      fc = new FilesCollection({ collectionName: `testserver-access-${Random.id(4)}`, storagePath: tmpDir('access'), protected: true });
      const httpObj = makeHttp();
      expect(await fc._checkAccess(httpObj)).to.equal(false);
      expect(httpObj.response.codes).to.deep.equal([401]);
    });

    it('protected: true allows requests with a valid x-mtok', async function() {
      fc = new FilesCollection({ collectionName: `testserver-access-${Random.id(4)}`, storagePath: tmpDir('access'), protected: true });
      expect(await fc._checkAccess(makeHttp({ 'x-mtok': token }))).to.equal(true);
    });

    it('protected: true allows requests with a valid x_mtok cookie', async function() {
      fc = new FilesCollection({ collectionName: `testserver-access-${Random.id(4)}`, storagePath: tmpDir('access'), protected: true });
      const httpObj = makeHttp();
      httpObj.request.Cookies = { has: (name) => name === 'x_mtok', get: () => token };
      expect(await fc._checkAccess(httpObj)).to.equal(true);
    });

    it('protected: true denies malformed or unknown x-mtok', async function() {
      fc = new FilesCollection({ collectionName: `testserver-access-${Random.id(4)}`, storagePath: tmpDir('access'), protected: true });
      expect(await fc._checkAccess(makeHttp({ 'x-mtok': 'unknown-token' }))).to.equal(false);
      expect(await fc._checkAccess(makeHttp({ 'x-mtok': ['a', 'b'] }))).to.equal(false);
      expect(await fc._checkAccess(makeHttp({ 'x-mtok': '__proto__' }))).to.equal(false);
    });

    it('protected function: true/false/number/async results', async function() {
      let answer;
      fc = new FilesCollection({ collectionName: `testserver-access-${Random.id(4)}`, storagePath: tmpDir('access'), protected: () => answer });

      answer = true;
      expect(await fc._checkAccess(makeHttp())).to.equal(true);

      answer = false;
      let httpObj = makeHttp();
      expect(await fc._checkAccess(httpObj)).to.equal(false);
      expect(httpObj.response.codes).to.deep.equal([401]);

      answer = 404;
      httpObj = makeHttp();
      expect(await fc._checkAccess(httpObj)).to.equal(false);
      expect(httpObj.response.codes).to.deep.equal([404]);

      answer = 1000;
      httpObj = makeHttp();
      expect(await fc._checkAccess(httpObj)).to.equal(false);
      expect(httpObj.response.codes).to.deep.equal([401]);

      answer = Promise.resolve(true);
      expect(await fc._checkAccess(makeHttp())).to.equal(true);
    });

    it('protected function gets null fileObj for unknown _id, the doc for known _id, and userId', async function() {
      const calls = [];
      fc = new FilesCollection({
        collectionName: `testserver-access-${Random.id(4)}`,
        storagePath: tmpDir('access'),
        protected(fileObj) {
          calls.push({ fileObj, userId: this.userId });
          return true;
        }
      });
      await fc.collection.insertAsync({ _id: 'known1', name: 'k.txt' });

      await fc._checkAccess(makeHttp({ 'x-mtok': token }, { _id: 'unknown1' }));
      await fc._checkAccess(makeHttp({}, { _id: 'known1' }));

      expect(calls[0].fileObj).to.equal(null);
      expect(calls[0].userId).to.equal('session-user');
      expect(calls[1].fileObj._id).to.equal('known1');
      expect(calls[1].userId).to.equal(null);
    });
  });

  describe('upload flow', function() {
    let fc;

    before(function() {
      fc = new FilesCollection({ collectionName: `testserver-flow-${Random.id(4)}`, storagePath: tmpDir('flow') });
    });

    afterEach(function() {
      sinon.restore();
    });

    const start = async (overrides = {}) => {
      const opts = { file: { name: 'flow.txt', type: 'text/plain', size: 8, meta: {} }, fileId: Random.id(), chunkSize: 4, fileLength: 2, ...overrides };
      await call(fc, '_Start', 'u1', opts);
      return opts;
    };

    it('C9: responds 503 when a chunk is not written', async function() {
      const opts = await start();
      sinon.stub(fc._currentUploads[opts.fileId], 'write').resolves(false);
      let error;
      try {
        await call(fc, '_Write', 'u1', { fileId: opts.fileId, chunkId: 1, binData: Buffer.from('abcd').toString('base64') });
      } catch (e) {
        error = e;
      }
      expect(error?.error).to.equal(503);
    });

    it('C11: calls namingFunction only at start and keeps the path', async function() {
      let n = 0;
      const naming = sinon.spy(() => `name-${++n}`);
      const fcNaming = new FilesCollection({ collectionName: `testserver-flow-${Random.id(4)}`, storagePath: tmpDir('flow-naming'), namingFunction: naming });
      const opts = { file: { name: 'flow.txt', type: 'text/plain', size: 8, meta: {} }, fileId: Random.id(), chunkSize: 4, fileLength: 2 };
      await call(fcNaming, '_Start', 'u1', opts);
      await call(fcNaming, '_Write', 'u1', { fileId: opts.fileId, chunkId: 1, binData: Buffer.from('abcd').toString('base64') });
      await call(fcNaming, '_Write', 'u1', { fileId: opts.fileId, chunkId: 2, binData: Buffer.from('efgh').toString('base64') });
      const res = await call(fcNaming, '_Write', 'u1', { fileId: opts.fileId, eof: true });
      expect(naming.callCount).to.equal(1);
      const doc = await fcNaming.collection.findOneAsync(res._id);
      expect(nodePath.basename(doc.path)).to.equal('name-1.txt');
      expect(fs.readFileSync(doc.path, 'utf8')).to.equal('abcdefgh');
    });

    it('C14: does not mutate the client opts.file object', async function() {
      const file = { name: 'flow.txt', type: 'text/plain', size: 8, meta: {} };
      await start({ file });
      expect(file).to.deep.equal({ name: 'flow.txt', type: 'text/plain', size: 8, meta: {} });
    });
  });

  describe('WriteStream', function() {
    let dir;
    before(function() {
      dir = tmpDir('write-stream');
    });

    const create = async (name, maxLength = 2, options = {}) => {
      const stream = new WriteStream(nodePath.join(dir, name), maxLength, { chunkSize: 4 }, 0o644, 0o755, { fileId: name, exclusive: true, ...options });
      await stream.init();
      return stream;
    };

    it('C6: end() returns false after abort', async function() {
      const stream = await create('c6.txt');
      await stream.abort();
      expect(await stream.end()).to.equal(false);
    });

    it('C7: abort() after successful end keeps the file', async function() {
      const stream = await create('c7.txt', 1);
      expect(await stream.write(1, Buffer.from('abcd'))).to.equal(true);
      expect(await stream.end()).to.equal(true);
      await stream.abort();
      expect(fs.readFileSync(stream.path, 'utf8')).to.equal('abcd');
      expect(await stream.write(1, Buffer.from('zzzz'))).to.equal(false);
    });

    it('C8: a sparse last chunk does not complete the file', async function() {
      const stream = await create('c8a.txt', 2);
      stream.maxEndRetries = 2;
      expect(await stream.write(2, Buffer.from('efgh'))).to.equal(true);
      expect(await stream.end()).to.equal(false);
    });

    it('C8: a retried chunk is counted once', async function() {
      const stream = await create('c8b.txt', 2);
      stream.maxEndRetries = 2;
      await stream.write(1, Buffer.from('abcd'));
      await stream.write(1, Buffer.from('abcd'));
      expect(stream.writtenChunks).to.equal(1);
      expect(await stream.end()).to.equal(false);
    });

    it('C17: stop() and abort() do not throw without a file handle', async function() {
      const stream = new WriteStream(nodePath.join(dir, 'c17.txt'), 1, { chunkSize: 4 }, 0o644, 0o755);
      expect(await stream.abort()).to.equal(true);
    });

    it('S2: exclusive init fails with 409 and keeps an existing file', async function() {
      const path = nodePath.join(dir, 'exists.txt');
      fs.writeFileSync(path, 'keep');
      const stream = new WriteStream(path, 1, { chunkSize: 4 }, 0o644, 0o755, { exclusive: true });
      const error = await expectRejects(stream.init());
      expect(error.error).to.equal(409);
      expect(fs.readFileSync(path, 'utf8')).to.equal('keep');
    });
  });

  describe('helpers.cloneDeep', function() {
    it('C14: deep-copies objects, arrays, and dates', function() {
      const date = new Date();
      const source = { a: { b: [1, { c: 2 }] }, d: date };
      const copy = helpers.cloneDeep(source);
      copy.a.b[1].c = 3;
      expect(source.a.b[1].c).to.equal(2);
      expect(copy.d).to.not.equal(date);
      expect(copy.d.getTime()).to.equal(date.getTime());
    });
  });
});
