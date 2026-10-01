/* global describe, it, before, after, afterEach */
import { expect } from 'chai';
import sinon from 'sinon';
import fs from 'node:fs';
import os from 'node:os';
import nodePath from 'node:path';
import http from 'node:http';
import { Readable } from 'node:stream';
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { FilesCollection } from '../server.js';
import { fixJSONParse } from '../lib.js';

const TMP_ROOT = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'mf-security-'));
let counter = 0;

/**
 * Create a FilesCollection with a unique name and a temp storage dir
 */
const createCollection = (config = {}) => {
  const collectionName = `sec${++counter}${Random.id(6)}`;
  const storagePath = nodePath.join(TMP_ROOT, collectionName);
  return new FilesCollection({
    collectionName,
    storagePath,
    // Identify HTTP users by header in tests
    getUser(httpObj) {
      const userId = httpObj?.request?.headers?.['x-test-user'] || null;
      return { userId, async userAsync() { return null; } };
    },
    // Keeps the S5 warning out of the test output, S5 tests pass `onBeforeRemove: undefined`
    onBeforeRemove: () => true,
    ...config,
  });
};

/**
 * Invoke a FilesCollection DDP method as a given user
 */
const call = (fc, kind, userId, ...args) => {
  return Meteor.server.method_handlers[fc._methodNames[kind]].apply({
    userId,
    connection: null,
    unblock() {},
  }, args);
};

const startOpts = (overrides = {}) => {
  const size = overrides.size ?? 8;
  const chunkSize = overrides.chunkSize ?? 1024;
  return {
    file: { name: 'file.txt', type: 'text/plain', size, meta: {}, ...(overrides.file || {}) },
    fileId: overrides.fileId || Random.id(),
    chunkSize,
    fileLength: overrides.fileLength ?? Math.max(1, Math.ceil(size / chunkSize)),
    ...(overrides.FSName ? { FSName: overrides.FSName } : {}),
  };
};

const b64 = (str) => Buffer.from(str).toString('base64');

const expectMeteorError = async (promise, code) => {
  let caught;
  try {
    await promise;
  } catch (e) {
    caught = e;
  }
  expect(caught, `expected Meteor.Error(${code})`).to.be.instanceOf(Meteor.Error);
  expect(caught.error).to.equal(code);
  return caught;
};

const httpRequest = (path, { method = 'GET', headers = {}, body } = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, Meteor.absoluteUrl());
    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
      res.on('error', reject);
    });
    req.on('error', (error) => {
      if (error.code === 'ECONNRESET' || error.code === 'EPIPE') {
        resolve({ status: 'reset', headers: {}, body: '' });
        return;
      }
      reject(error);
    });
    if (body) {
      req.write(body);
    }
    req.end();
  });
};

/**
 * Serve a vRef through `serve()` on a throwaway HTTP server and return the response
 */
const serveRequest = (fc, { vRef, fileRef, headers = {}, query = {}, readable, method = 'GET' }) => {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      fc.serve({ request: req, response: res, params: { query } }, fileRef || { _id: 'abc', name: vRef.name }, vRef, 'original', readable ? readable() : null);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      http.get({ host: '127.0.0.1', port, headers, method }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          server.close();
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        });
      }).on('error', (e) => {
        server.close();
        reject(e);
      });
    });
  });
};

describe('Security', function () {
  this.timeout(15000);

  after(function () {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  });

  afterEach(function () {
    sinon.restore();
  });

  describe('S1: _Abort ownership', function () {
    let fc;
    before(function () {
      fc = createCollection();
    });

    it('rejects abort of another user\'s upload with 404 and keeps it intact', async function () {
      const opts = startOpts();
      await call(fc, '_Start', 'userA', opts);
      await expectMeteorError(call(fc, '_Abort', 'userB', opts.fileId), 404);
      expect(await fc._preCollection.findOneAsync(opts.fileId)).to.be.an('object');
      expect(fc._currentUploads[opts.fileId].aborted).to.equal(false);
    });

    it('rejects abort by anonymous caller of an authenticated upload', async function () {
      const opts = startOpts();
      await call(fc, '_Start', 'userA', opts);
      await expectMeteorError(call(fc, '_Abort', null, opts.fileId), 404);
      expect(await fc._preCollection.findOneAsync(opts.fileId)).to.be.an('object');
    });

    it('rejects abort of an unknown id with 404', async function () {
      await expectMeteorError(call(fc, '_Abort', 'userA', 'unknownId123'), 404);
    });

    it('never removes a finished file record from the main collection', async function () {
      const _id = Random.id();
      await fc.collection.insertAsync({ _id, name: 'done.txt', userId: 'userA' });
      await expectMeteorError(call(fc, '_Abort', 'userA', _id), 404);
      expect(await fc.collection.findOneAsync(_id)).to.be.an('object');
    });

    it('lets the owner abort: removes pre-record and unlinks partial file', async function () {
      const opts = startOpts();
      await call(fc, '_Start', 'userA', opts);
      const path = fc._currentUploads[opts.fileId].path;
      expect(fs.existsSync(path)).to.equal(true);
      const res = await call(fc, '_Abort', 'userA', opts.fileId);
      expect(res).to.deep.equal({ status: 499 });
      expect(await fc._preCollection.findOneAsync(opts.fileId)).to.equal(undefined);
      expect(fs.existsSync(path)).to.equal(false);
    });

    it('lets an anonymous owner abort an anonymous upload', async function () {
      const opts = startOpts();
      await call(fc, '_Start', null, opts);
      const res = await call(fc, '_Abort', null, opts.fileId);
      expect(res).to.deep.equal({ status: 499 });
    });
  });

  describe('S3: chunk/EOF ownership', function () {
    let fc;
    before(function () {
      fc = createCollection();
    });

    it('rejects chunk writes from another user with 403', async function () {
      const opts = startOpts({ size: 4 });
      await call(fc, '_Start', 'userA', opts);
      await expectMeteorError(call(fc, '_Write', 'userB', { fileId: opts.fileId, chunkId: 1, binData: b64('evil') }), 403);
    });

    it('rejects EOF from another user with 403', async function () {
      const opts = startOpts({ size: 4 });
      await call(fc, '_Start', 'userA', opts);
      await call(fc, '_Write', 'userA', { fileId: opts.fileId, chunkId: 1, binData: b64('good') });
      await expectMeteorError(call(fc, '_Write', 'userB', { fileId: opts.fileId, eof: true }), 403);
      expect(await fc.collection.findOneAsync(opts.fileId)).to.equal(undefined);
    });

    it('stores the starter\'s userId on the final document', async function () {
      const opts = startOpts({ size: 4 });
      await call(fc, '_Start', 'userA', opts);
      await call(fc, '_Write', 'userA', { fileId: opts.fileId, chunkId: 1, binData: b64('good') });
      const res = await call(fc, '_Write', 'userA', { fileId: opts.fileId, eof: true });
      expect(res.userId).to.equal('userA');
      const doc = await fc.collection.findOneAsync(opts.fileId);
      expect(doc.userId).to.equal('userA');
    });
  });

  describe('storagePath runs once per upload', function () {
    it('keeps the Start storage path on chunks and EOF', async function () {
      const base = nodePath.join(TMP_ROOT, `sp${Random.id(6)}`);
      let calls = 0;
      const fcSp = createCollection({ storagePath: () => nodePath.join(base, String(++calls)) });
      const callsBefore = calls;
      const opts = startOpts({ size: 4 });
      await call(fcSp, '_Start', 'userA', opts);
      expect(calls).to.equal(callsBefore + 1);
      await call(fcSp, '_Write', 'userA', { fileId: opts.fileId, chunkId: 1, binData: b64('good') });
      await call(fcSp, '_Write', 'userA', { fileId: opts.fileId, eof: true });
      expect(calls).to.equal(callsBefore + 1);
      const doc = await fcSp.collection.findOneAsync(opts.fileId);
      expect(doc._storagePath).to.equal(nodePath.join(base, String(callsBefore + 1)));
      expect(nodePath.dirname(doc.path)).to.equal(doc._storagePath);
    });
  });

  describe('S2/S11: path collisions and containment', function () {
    let fc;
    before(function () {
      fc = createCollection();
    });

    it('_isPathInside() handles prefix pitfalls', function () {
      expect(fc._isPathInside('/a/b', '/a/b/c.txt')).to.equal(true);
      expect(fc._isPathInside('/a/b/', '/a/b/c/d.txt')).to.equal(true);
      expect(fc._isPathInside('/a/b', '/a/bc/d.txt')).to.equal(false);
      expect(fc._isPathInside('/a/b', '/a/b/../c.txt')).to.equal(false);
      expect(fc._isPathInside('/a/b', '/a/b')).to.equal(false);
      expect(fc._isPathInside('/a/b', '/etc/passwd')).to.equal(false);
    });

    it('rejects Start with 409 when the target file already exists', async function () {
      const victim = nodePath.join(fc.storagePath({}), 'victim.txt');
      fs.writeFileSync(victim, 'victim-data');
      const opts = startOpts({ FSName: 'victim', size: 4 });
      await expectMeteorError(call(fc, '_Start', 'attacker', opts), 409);
      expect(fs.readFileSync(victim, 'utf8')).to.equal('victim-data');
    });

    it('rejects Start with 409 when FSName collides with an in-progress upload', async function () {
      const victimOpts = startOpts({ FSName: 'shared', size: 4 });
      await call(fc, '_Start', 'userA', victimOpts);
      const attackOpts = startOpts({ FSName: 'shared', size: 4 });
      await expectMeteorError(call(fc, '_Start', 'attacker', attackOpts), 409);
      expect(fc._currentUploads[victimOpts.fileId].aborted).to.equal(false);
      expect(fs.existsSync(fc._currentUploads[victimOpts.fileId].path)).to.equal(true);
    });

    it('rejects Start with 409 when fileId is already in progress', async function () {
      const opts = startOpts({ size: 4 });
      await call(fc, '_Start', 'userA', opts);
      const error = await expectMeteorError(call(fc, '_Start', 'attacker', startOpts({ fileId: opts.fileId, size: 4 })), 409);
      // upload.js matches this reason to recognize a replayed Start
      expect(error.reason).to.equal('Upload already exists');
    });

    it('sanitizes namingFunction output and keeps the file inside storagePath', async function () {
      const fcNaming = createCollection({ namingFunction: () => '../../../escape' });
      const opts = startOpts({ size: 4 });
      await call(fcNaming, '_Start', 'userA', opts);
      const path = fcNaming._currentUploads[opts.fileId].path;
      expect(fcNaming._isPathInside(fcNaming.storagePath({}), path)).to.equal(true);
      expect(nodePath.basename(path)).to.not.include('..');
    });

    it('rejects Start with 400 when the final path leads outside of storage', async function () {
      const fcBad = createCollection({ sanitize: () => '../../escape' });
      const opts = startOpts({ size: 4 });
      await expectMeteorError(call(fcBad, '_Start', 'userA', opts), 400);
    });
  });

  describe('S2: resume path and file identity', function () {
    let fc;
    before(function () {
      fc = createCollection();
    });

    // Simulate a server restart: the in-memory stream is gone, only the record stays
    const simulateRestart = async (id) => {
      const stream = fc._currentUploads[id];
      clearTimeout(stream.idleTimer);
      stream.idleTimer = null;
      await stream.fh?.close();
      stream.fh = null;
      delete fc._currentUploads[id];
    };

    const chunk = (fill) => Buffer.alloc(1024, fill).toString('base64');

    it('resumes after restart and completes the upload', async function () {
      const opts = startOpts({ size: 2048, chunkSize: 1024 });
      await call(fc, '_Start', 'userA', opts);
      await call(fc, '_Write', 'userA', { fileId: opts.fileId, chunkId: 1, binData: chunk(97) });
      await simulateRestart(opts.fileId);
      await call(fc, '_Write', 'userA', { fileId: opts.fileId, chunkId: 2, binData: chunk(98) });
      const res = await call(fc, '_Write', 'userA', { fileId: opts.fileId, eof: true });
      expect(res.size).to.equal(2048);
    });

    it('creates one WriteStream for concurrent resume requests', async function () {
      const opts = startOpts({ size: 2048, chunkSize: 1024 });
      await call(fc, '_Start', 'userA', opts);
      await simulateRestart(opts.fileId);
      const createStream = sinon.spy(fc, '_createStream');
      await Promise.all([
        call(fc, '_Write', 'userA', { fileId: opts.fileId, chunkId: 1, binData: chunk(97) }),
        call(fc, '_Write', 'userA', { fileId: opts.fileId, chunkId: 2, binData: chunk(98) }),
      ]);
      expect(createStream.callCount).to.equal(1);
      expect(fc._currentUploads[opts.fileId].chunkIds.size).to.equal(2);
    });

    it('rejects resume with 410 when the file is gone, without creating it', async function () {
      const opts = startOpts({ size: 2048, chunkSize: 1024 });
      await call(fc, '_Start', 'userA', opts);
      const path = fc._currentUploads[opts.fileId].path;
      await simulateRestart(opts.fileId);
      fs.unlinkSync(path);
      await expectMeteorError(call(fc, '_Write', 'userA', { fileId: opts.fileId, chunkId: 1, binData: chunk(97) }), 410);
      expect(fs.existsSync(path)).to.equal(false);
      expect(await fc._preCollection.findOneAsync(opts.fileId)).to.equal(undefined);
    });

    it('rejects resume with 409 when the file was replaced, and keeps the new file', async function () {
      const opts = startOpts({ size: 2048, chunkSize: 1024 });
      await call(fc, '_Start', 'userA', opts);
      const path = fc._currentUploads[opts.fileId].path;
      await simulateRestart(opts.fileId);
      fs.unlinkSync(path);
      fs.writeFileSync(path, 'victim-data');
      await expectMeteorError(call(fc, '_Write', 'userA', { fileId: opts.fileId, chunkId: 1, binData: chunk(97) }), 409);
      expect(fs.readFileSync(path, 'utf8')).to.equal('victim-data');
      expect(await fc._preCollection.findOneAsync(opts.fileId)).to.equal(undefined);
      await expectMeteorError(call(fc, '_Abort', 'userA', opts.fileId), 404);
      expect(fs.readFileSync(path, 'utf8')).to.equal('victim-data');
    });

    it('rejects idle reopen with 409 when the file was replaced, and keeps the new file', async function () {
      const fcIdle = createCollection({ uploadIdleTimeout: 30 });
      const opts = startOpts({ size: 2048, chunkSize: 1024 });
      await call(fcIdle, '_Start', 'userA', opts);
      const path = fcIdle._currentUploads[opts.fileId].path;
      await new Promise((r) => setTimeout(r, 100));
      expect(fcIdle._currentUploads[opts.fileId].fh).to.equal(null);
      fs.unlinkSync(path);
      fs.writeFileSync(path, 'victim-data');
      await expectMeteorError(call(fcIdle, '_Write', 'userA', { fileId: opts.fileId, chunkId: 1, binData: chunk(97) }), 409);
      expect(fs.readFileSync(path, 'utf8')).to.equal('victim-data');
      expect(await fcIdle._preCollection.findOneAsync(opts.fileId)).to.equal(undefined);
    });

    it('owner abort does not unlink a file that replaced the upload file', async function () {
      const opts = startOpts({ size: 2048, chunkSize: 1024 });
      await call(fc, '_Start', 'userA', opts);
      const path = fc._currentUploads[opts.fileId].path;
      fs.unlinkSync(path);
      fs.writeFileSync(path, 'victim-data');
      await call(fc, '_Abort', 'userA', opts.fileId);
      expect(fs.readFileSync(path, 'utf8')).to.equal('victim-data');
    });

    it('owner abort after restart removes the partial file and the record', async function () {
      const opts = startOpts({ size: 2048, chunkSize: 1024 });
      await call(fc, '_Start', 'userA', opts);
      await call(fc, '_Write', 'userA', { fileId: opts.fileId, chunkId: 1, binData: chunk(97) });
      const path = fc._currentUploads[opts.fileId].path;
      await simulateRestart(opts.fileId);
      expect(fs.existsSync(path)).to.equal(true);
      expect(await call(fc, '_Abort', 'userA', opts.fileId)).to.deep.equal({ status: 499 });
      expect(fs.existsSync(path)).to.equal(false);
      expect(await fc._preCollection.findOneAsync(opts.fileId)).to.equal(undefined);
    });

    it('owner abort after restart keeps a file that replaced the upload file', async function () {
      const opts = startOpts({ size: 2048, chunkSize: 1024 });
      await call(fc, '_Start', 'userA', opts);
      const path = fc._currentUploads[opts.fileId].path;
      await simulateRestart(opts.fileId);
      fs.unlinkSync(path);
      fs.writeFileSync(path, 'victim-data');
      expect(await call(fc, '_Abort', 'userA', opts.fileId)).to.deep.equal({ status: 499 });
      expect(fs.readFileSync(path, 'utf8')).to.equal('victim-data');
      expect(await fc._preCollection.findOneAsync(opts.fileId)).to.equal(undefined);
    });

    it('owner abort after restart keeps the file of a record without identity (created before 3.1)', async function () {
      const opts = startOpts({ size: 1024, chunkSize: 1024 });
      await call(fc, '_Start', 'userA', opts);
      const path = fc._currentUploads[opts.fileId].path;
      await simulateRestart(opts.fileId);
      await fc._preCollection.updateAsync({ _id: opts.fileId }, { $unset: { fileIdentity: '' } });
      expect(await call(fc, '_Abort', 'userA', opts.fileId)).to.deep.equal({ status: 499 });
      expect(fs.existsSync(path)).to.equal(true);
      expect(await fc._preCollection.findOneAsync(opts.fileId)).to.equal(undefined);
    });

    it('owner abort after restart keeps the file of a finished upload', async function () {
      const opts = startOpts({ size: 1024, chunkSize: 1024 });
      await call(fc, '_Start', 'userA', opts);
      const path = fc._currentUploads[opts.fileId].path;
      await simulateRestart(opts.fileId);
      // Finished on another server, its record is not removed yet
      await fc.collection.insertAsync({ _id: opts.fileId, name: 'file.txt', userId: 'userA', path });
      await call(fc, '_Abort', 'userA', opts.fileId);
      expect(fs.existsSync(path)).to.equal(true);
    });

    it('rejects Start with 409 when a pending upload claims the path', async function () {
      const first = startOpts({ FSName: 'claimed', size: 4 });
      await call(fc, '_Start', 'userA', first);
      // The file of the pending upload is temporarily missing
      fs.unlinkSync(fc._currentUploads[first.fileId].path);
      await expectMeteorError(call(fc, '_Start', 'userB', startOpts({ FSName: 'claimed', size: 4 })), 409);
    });

    it('drops the upload record when EOF finds missing chunks', async function () {
      const opts = startOpts({ size: 2048, chunkSize: 1024 });
      await call(fc, '_Start', 'userA', opts);
      const stream = fc._currentUploads[opts.fileId];
      stream.maxEndRetries = 2;
      await call(fc, '_Write', 'userA', { fileId: opts.fileId, chunkId: 1, binData: chunk(97) });
      await expectMeteorError(call(fc, '_Write', 'userA', { fileId: opts.fileId, eof: true }), 503);
      expect(await fc._preCollection.findOneAsync(opts.fileId)).to.equal(undefined);
      expect(fs.existsSync(stream.path)).to.equal(false);
    });

    it('rejects resume of records without file identity (created before 3.1) with 410', async function () {
      const fileId = Random.id();
      const path = nodePath.join(fc.storagePath({}), `${fileId}.txt`);
      fs.writeFileSync(path, 'old');
      await fc._preCollection.insertAsync({ _id: fileId, fileId, file: { name: 'old.txt', size: 4 }, chunkSize: 1024, fileLength: 1, userId: 'userA', path, createdAt: new Date() });
      await expectMeteorError(call(fc, '_Write', 'userA', { fileId, chunkId: 1, binData: b64('abcd') }), 410);
      expect(fs.readFileSync(path, 'utf8')).to.equal('old');
    });
  });

  describe('S4: declared size bounds the last chunk', function () {
    it('rejects a last chunk that would grow the file past the declared size', async function () {
      const fc = createCollection();
      const opts = startOpts({ size: 1030, chunkSize: 1024 });
      await call(fc, '_Start', 'userA', opts);
      await expectMeteorError(call(fc, '_Write', 'userA', { fileId: opts.fileId, chunkId: 2, binData: Buffer.alloc(7, 1).toString('base64') }), 400);
      expect((await call(fc, '_Write', 'userA', { fileId: opts.fileId, chunkId: 2, binData: Buffer.alloc(6, 1).toString('base64') })).status).to.equal(204);
    });
  });

  describe('onInitiateUpload order', function () {
    it('runs after the upload record is saved, and not for rejected starts', async function () {
      const seen = [];
      const fc = createCollection({
        async onInitiateUpload(file) {
          seen.push(await fc._preCollection.findOneAsync(file._id));
        },
      });
      const opts = startOpts({ size: 4, FSName: 'initiate' });
      await call(fc, '_Start', 'userA', opts);
      expect(seen.length).to.equal(1);
      expect(seen[0]._id).to.equal(opts.fileId);
      await expectMeteorError(call(fc, '_Start', 'userA', startOpts({ size: 4, FSName: 'initiate' })), 409);
      expect(seen.length).to.equal(1);
    });

    it('drops the record and the file when onInitiateUpload throws', async function () {
      const fc = createCollection({ onInitiateUpload() { throw new Meteor.Error(403, 'nope'); } });
      const opts = startOpts({ size: 4, FSName: 'initiate-throw' });
      await expectMeteorError(call(fc, '_Start', 'userA', opts), 403);
      expect(await fc._preCollection.findOneAsync(opts.fileId)).to.equal(undefined);
      expect(fs.existsSync(nodePath.join(fc.storagePath({}), 'initiate-throw.txt'))).to.equal(false);
    });
  });

  describe('download errors', function () {
    it('responds 500 when a hook throws during download', async function () {
      const fc = createCollection({ protected() { throw new Error('hook failed'); } });
      const res = await httpRequest(`${fc.downloadRoute}/${fc.collectionName}/abc/original/abc.txt`);
      expect(res.status).to.equal(500);
      expect(res.body).to.equal('Internal Server Error');
    });

    it('ignores Range when the version size is not a number', async function () {
      const fc = createCollection();
      const path = nodePath.join(fc.storagePath({}), 'nosize.txt');
      fs.writeFileSync(path, 'abc');
      const res = await serveRequest(fc, { vRef: { name: 'nosize.txt', path }, headers: { range: 'bytes=0-1' } });
      expect(res.status).to.equal(200);
      expect(res.body).to.equal('abc');
    });
  });

  describe('A2: idempotent EOF', function () {
    let fc;
    before(function () {
      fc = createCollection();
    });

    const finishDDP = async (userId) => {
      const opts = startOpts({ size: 4 });
      await call(fc, '_Start', userId, opts);
      await call(fc, '_Write', userId, { fileId: opts.fileId, chunkId: 1, binData: b64('data') });
      const first = await call(fc, '_Write', userId, { fileId: opts.fileId, eof: true });
      // Let the observer drop the finished upload, like a later retry would see
      delete fc._currentUploads[opts.fileId];
      await fc._preCollection.removeAsync({ _id: opts.fileId });
      return { opts, first };
    };

    it('DDP: repeated EOF by the owner returns the same result', async function () {
      const { opts, first } = await finishDDP('userA');
      const again = await call(fc, '_Write', 'userA', { fileId: opts.fileId, eof: true });
      expect(again.status).to.equal(200);
      expect(again._id).to.equal(opts.fileId);
      expect(again).to.not.have.property('path');
      expect(again).to.not.have.property('_storagePath');
      expect(again.versions.original).to.not.have.property('path');
      expect(Object.keys(again).sort()).to.deep.equal(Object.keys(first).sort());
    });

    it('DDP: repeated EOF right after finish (stream still in memory) returns the result', async function () {
      const opts = startOpts({ size: 4 });
      await call(fc, '_Start', 'userA', opts);
      await call(fc, '_Write', 'userA', { fileId: opts.fileId, chunkId: 1, binData: b64('data') });
      await call(fc, '_Write', 'userA', { fileId: opts.fileId, eof: true });
      const again = await call(fc, '_Write', 'userA', { fileId: opts.fileId, eof: true });
      expect(again.status).to.equal(200);
      expect(again._id).to.equal(opts.fileId);
    });

    it('DDP: two EOFs sent together finish once and get the same result', async function () {
      const opts = startOpts({ size: 4 });
      await call(fc, '_Start', 'userA', opts);
      await call(fc, '_Write', 'userA', { fileId: opts.fileId, chunkId: 1, binData: b64('data') });
      const finish = sinon.spy(fc, '_finishUpload');
      const [first, second] = await Promise.all([
        call(fc, '_Write', 'userA', { fileId: opts.fileId, eof: true }),
        call(fc, '_Write', 'userA', { fileId: opts.fileId, eof: true }),
      ]);
      expect(finish.callCount).to.equal(1);
      expect(first._id).to.equal(opts.fileId);
      expect(second).to.deep.equal(first);
      expect(await fc.collection.countDocuments({ _id: opts.fileId })).to.equal(1);
      expect(fc._finishingUploads.has(opts.fileId)).to.equal(false);
    });

    it('DDP: an EOF that arrives while the first EOF finishes waits for it instead of 408', async function () {
      const opts = startOpts({ size: 4 });
      await call(fc, '_Start', 'userA', opts);
      await call(fc, '_Write', 'userA', { fileId: opts.fileId, chunkId: 1, binData: b64('data') });
      let release;
      const gate = new Promise((r) => { release = r; });
      const originalFinish = fc._finishUpload.bind(fc);
      let entered;
      const enteredPromise = new Promise((r) => { entered = r; });
      sinon.stub(fc, '_finishUpload').callsFake(async (...args) => {
        entered();
        await gate;
        return originalFinish(...args);
      });
      const firstPromise = call(fc, '_Write', 'userA', { fileId: opts.fileId, eof: true });
      await enteredPromise;
      // The stream is ended and the document is not inserted yet
      expect(fc._currentUploads[opts.fileId].ended).to.equal(true);
      const secondPromise = call(fc, '_Write', 'userA', { fileId: opts.fileId, eof: true });
      await expectMeteorError(call(fc, '_Write', 'userB', { fileId: opts.fileId, eof: true }), 408);
      release();
      const [first, second] = await Promise.all([firstPromise, secondPromise]);
      expect(second).to.deep.equal(first);
      expect(second._id).to.equal(opts.fileId);
    });

    it('DDP: an anonymous owner\'s EOF that races the first EOF gets the same result', async function () {
      const opts = startOpts({ size: 4 });
      await call(fc, '_Start', null, opts);
      await call(fc, '_Write', null, { fileId: opts.fileId, chunkId: 1, binData: b64('data') });
      const [first, second] = await Promise.all([
        call(fc, '_Write', null, { fileId: opts.fileId, eof: true }),
        call(fc, '_Write', null, { fileId: opts.fileId, eof: true }),
      ]);
      expect(first._id).to.equal(opts.fileId);
      expect(second).to.deep.equal(first);
      // After the finish, anonymous replay still gets 408
      await expectMeteorError(call(fc, '_Write', null, { fileId: opts.fileId, eof: true }), 408);
    });

    it('DDP: an EOF that races a failing EOF gets the same error', async function () {
      const opts = startOpts({ size: 4 });
      await call(fc, '_Start', 'userA', opts);
      await call(fc, '_Write', 'userA', { fileId: opts.fileId, chunkId: 1, binData: b64('data') });
      sinon.stub(fc, '_finishUpload').callsFake(async () => {
        await new Promise((r) => setTimeout(r, 50));
        throw new Meteor.Error(500, 'insert failed');
      });
      const results = await Promise.allSettled([
        call(fc, '_Write', 'userA', { fileId: opts.fileId, eof: true }),
        call(fc, '_Write', 'userA', { fileId: opts.fileId, eof: true }),
      ]);
      expect(results.map((r) => r.status)).to.deep.equal(['rejected', 'rejected']);
      expect(results[1].reason).to.equal(results[0].reason);
      expect(fc._finishingUploads.has(opts.fileId)).to.equal(false);
    });

    it('HTTP: an EOF that arrives while the first EOF finishes gets 200', async function () {
      const opts = startOpts({ size: 4 });
      await call(fc, '_Start', 'userA', opts);
      await call(fc, '_Write', 'userA', { fileId: opts.fileId, chunkId: 1, binData: b64('data') });
      let release;
      const gate = new Promise((r) => { release = r; });
      const originalFinish = fc._finishUpload.bind(fc);
      let entered;
      const enteredPromise = new Promise((r) => { entered = r; });
      sinon.stub(fc, '_finishUpload').callsFake(async (...args) => {
        entered();
        await gate;
        return originalFinish(...args);
      });
      const firstPromise = call(fc, '_Write', 'userA', { fileId: opts.fileId, eof: true });
      await enteredPromise;
      const secondPromise = httpRequest(`${fc.downloadRoute}/${fc.collectionName}/__upload`, {
        method: 'POST',
        headers: { 'x-fileid': opts.fileId, 'x-eof': '1', 'x-test-user': 'userA', 'content-type': 'text/plain' },
      });
      await new Promise((r) => setTimeout(r, 50));
      release();
      const [first, second] = await Promise.all([firstPromise, secondPromise]);
      expect(second.status).to.equal(200);
      expect(JSON.parse(second.body)._id).to.equal(first._id);
    });

    it('DDP: repeated EOF by another user or for unknown id keeps 408', async function () {
      const { opts } = await finishDDP('userA');
      await expectMeteorError(call(fc, '_Write', 'userB', { fileId: opts.fileId, eof: true }), 408);
      await expectMeteorError(call(fc, '_Write', null, { fileId: opts.fileId, eof: true }), 408);
      await expectMeteorError(call(fc, '_Write', 'userA', { fileId: 'unknownFileId1', eof: true }), 408);
    });

    it('DDP: repeated EOF by an anonymous owner keeps 408', async function () {
      const { opts } = await finishDDP(null);
      await expectMeteorError(call(fc, '_Write', null, { fileId: opts.fileId, eof: true }), 408);
      await expectMeteorError(call(fc, '_Write', void 0, { fileId: opts.fileId, eof: true }), 408);
    });

    it('HTTP: repeated EOF by an anonymous owner keeps 408', async function () {
      const { opts } = await finishDDP(null);
      const res = await httpRequest(`${fc.downloadRoute}/${fc.collectionName}/__upload`, {
        method: 'POST',
        headers: { 'x-fileid': opts.fileId, 'x-eof': '1', 'content-type': 'text/plain' },
      });
      expect(res.status).to.equal(408);
    });

    it('DDP: a chunk for a finished upload keeps 408', async function () {
      const { opts } = await finishDDP('userA');
      await expectMeteorError(call(fc, '_Write', 'userA', { fileId: opts.fileId, chunkId: 1, binData: b64('data') }), 408);
    });

    it('HTTP: repeated EOF by the owner returns 200 with the result, others get 408', async function () {
      const { opts } = await finishDDP('userA');
      const route = `${fc.downloadRoute}/${fc.collectionName}/__upload`;
      const eof = (user) => httpRequest(route, {
        method: 'POST',
        headers: { 'x-fileid': opts.fileId, 'x-eof': '1', 'content-type': 'text/plain', ...(user ? { 'x-test-user': user } : {}) },
      });
      const owner = await eof('userA');
      expect(owner.status).to.equal(200);
      expect(owner.body).to.not.include(TMP_ROOT);
      expect(JSON.parse(owner.body)._id).to.equal(opts.fileId);
      expect((await eof('userB')).status).to.equal(408);
      expect((await eof(null)).status).to.equal(408);
    });
  });

  describe('A2: Start registration and path index', function () {
    it('registers the stream before the upload record is saved', async function () {
      const fc = createCollection();
      const opts = startOpts({ size: 4 });
      let registeredAtInsert;
      const originalInsert = fc._preCollection.insertAsync.bind(fc._preCollection);
      sinon.stub(fc._preCollection, 'insertAsync').callsFake((doc) => {
        registeredAtInsert = !!fc._currentUploads[doc._id];
        return originalInsert(doc);
      });
      await call(fc, '_Start', 'userA', opts);
      expect(registeredAtInsert).to.equal(true);
    });

    it('unregisters and removes the file when the record insert fails', async function () {
      const fc = createCollection();
      const opts = startOpts({ size: 4, FSName: 'insert-fails' });
      sinon.stub(fc._preCollection, 'insertAsync').rejects(new Error('db down'));
      await expectMeteorError(call(fc, '_Start', 'userA', opts), 500);
      expect(fc._currentUploads[opts.fileId]).to.equal(undefined);
      expect(fs.existsSync(nodePath.join(fc.storagePath({}), 'insert-fails.txt'))).to.equal(false);
    });

    it('creates an index on _preCollection.path', async function () {
      const fc = createCollection();
      let indexes = [];
      for (let i = 0; i < 40; i++) {
        indexes = await fc._preCollection.rawCollection().indexes().catch(() => []);
        if (indexes.some((index) => index.key?.path === 1)) {
          break;
        }
        await new Promise((r) => setTimeout(r, 50));
      }
      expect(indexes.some((index) => index.key?.path === 1)).to.equal(true);
    });
  });

  describe('A2 fix 1: EOF pre-check and Start races', function () {
    let fc;
    before(function () {
      fc = createCollection();
    });

    // Send headers only and wait for the response, the body is never written.
    // Talks to the app port directly: the `meteor test-packages` dev proxy waits for the whole body
    const headersOnly = (path, headers) => new Promise((resolve, reject) => {
      const url = new URL(path, process.env.PORT ? `http://127.0.0.1:${process.env.PORT}/` : Meteor.absoluteUrl());
      const req = http.request(url, { method: 'POST', headers: { 'content-type': 'text/plain', 'content-length': `${8 * 1024 * 1024}`, ...headers } }, (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
        res.on('error', () => resolve({ status: res.statusCode, body: data }));
      });
      req.on('error', reject);
      req.setTimeout(3000, () => {
        req.destroy();
        reject(new Error('server waited for the body'));
      });
      req.flushHeaders();
    });

    it('HTTP EOF for an unknown id gets 408 before the body is sent', async function () {
      const route = `${fc.downloadRoute}/${fc.collectionName}/__upload`;
      const res = await headersOnly(route, { 'x-fileid': 'unknownEofId1', 'x-eof': '1', 'x-test-user': 'userA' });
      expect(res.status).to.equal(408);
    });

    it('HTTP EOF for another user\'s finished upload gets 408 before the body is sent', async function () {
      const opts = startOpts({ size: 4 });
      await call(fc, '_Start', 'userA', opts);
      await call(fc, '_Write', 'userA', { fileId: opts.fileId, chunkId: 1, binData: b64('data') });
      await call(fc, '_Write', 'userA', { fileId: opts.fileId, eof: true });
      const route = `${fc.downloadRoute}/${fc.collectionName}/__upload`;
      const res = await headersOnly(route, { 'x-fileid': opts.fileId, 'x-eof': '1', 'x-test-user': 'userB' });
      expect(res.status).to.equal(408);
    });

    it('HTTP EOF for another user\'s pending upload gets 403 before the body is sent', async function () {
      const opts = startOpts({ size: 4 });
      await call(fc, '_Start', 'userA', opts);
      const route = `${fc.downloadRoute}/${fc.collectionName}/__upload`;
      const res = await headersOnly(route, { 'x-fileid': opts.fileId, 'x-eof': '1', 'x-test-user': 'userB' });
      expect(res.status).to.equal(403);
    });

    it('HTTP EOF rejects bodies over 64 KiB with 413', async function () {
      const opts = startOpts({ size: 4 });
      await call(fc, '_Start', 'userA', opts);
      await call(fc, '_Write', 'userA', { fileId: opts.fileId, chunkId: 1, binData: b64('data') });
      const res = await httpRequest(`${fc.downloadRoute}/${fc.collectionName}/__upload`, {
        method: 'POST',
        headers: { 'x-fileid': opts.fileId, 'x-eof': '1', 'x-test-user': 'userA', 'content-type': 'text/plain' },
        body: 'x'.repeat(64 * 1024 + 100),
      });
      expect(res.status).to.equal(413);
      expect(await fc.collection.findOneAsync(opts.fileId)).to.equal(undefined);
    });

    it('concurrent Start with the same fileId gets 409 and removes its own file', async function () {
      const opts = startOpts({ size: 4, FSName: 'concurrent-start' });
      // Another Start of the same id registered its stream but has not saved its record yet
      fc._currentUploads[opts.fileId] = { ended: false, aborted: false, file: { userId: 'other' } };
      try {
        await expectMeteorError(call(fc, '_Start', 'userA', opts), 409);
        expect(fs.existsSync(nodePath.join(fc.storagePath({}), 'concurrent-start.txt'))).to.equal(false);
        expect(await fc._preCollection.findOneAsync(opts.fileId)).to.equal(undefined);
      } finally {
        delete fc._currentUploads[opts.fileId];
      }
    });

    it('_continueUpload keeps a stream registered during reconstruction', async function () {
      const opts = startOpts({ size: 2048, chunkSize: 1024 });
      await call(fc, '_Start', 'userA', opts);
      const original = fc._currentUploads[opts.fileId];
      const path = original.path;
      clearTimeout(original.idleTimer);
      await original.fh.close();
      original.fh = null;
      delete fc._currentUploads[opts.fileId];

      const winner = { ended: false, aborted: false, file: { userId: 'userA', marker: 'winner' } };
      let rebuilt;
      const createStream = fc._createStream;
      sinon.stub(fc, '_createStream').callsFake(async (...args) => {
        rebuilt = await createStream(...args);
        fc._currentUploads[opts.fileId] = winner;
        return rebuilt;
      });

      try {
        const session = await fc._continueUpload(opts.fileId, 'userA');
        expect(session.marker).to.equal('winner');
        expect(fc._currentUploads[opts.fileId]).to.equal(winner);
        expect(rebuilt.ended).to.equal(true);
        expect(rebuilt.fh).to.equal(null);
        expect(fs.existsSync(path)).to.equal(true);
        expect(await fc._preCollection.findOneAsync(opts.fileId)).to.be.an('object');
      } finally {
        delete fc._currentUploads[opts.fileId];
      }
    });
  });

  describe('S4: upload bounds', function () {
    let fc;
    before(function () {
      fc = createCollection();
    });

    it('rejects Start with invalid chunkSize (0, negative, fractional, NaN, > 16 MiB)', async function () {
      for (const chunkSize of [0, -1, 1.5, NaN, 16 * 1024 * 1024 + 1]) {
        const opts = startOpts({ size: 4 });
        opts.chunkSize = chunkSize;
        opts.fileLength = 1;
        await expectMeteorError(call(fc, '_Start', 'userA', opts), 400);
      }
    });

    it('rejects Start when fileLength does not match size/chunkSize', async function () {
      const opts = startOpts({ size: 4096, chunkSize: 1024, fileLength: 2 });
      await expectMeteorError(call(fc, '_Start', 'userA', opts), 400);
    });

    it('rejects Start with zero, negative, or fractional size', async function () {
      await expectMeteorError(call(fc, '_Start', 'userA', startOpts({ size: 0, fileLength: 1 })), 400);
      await expectMeteorError(call(fc, '_Start', 'userA', startOpts({ size: -5, fileLength: 1 })), 400);
      await expectMeteorError(call(fc, '_Start', 'userA', startOpts({ size: 1.5, fileLength: 1 })), 400);
    });

    it('rejects chunks with out-of-range or non-integer chunkId', async function () {
      const opts = startOpts({ size: 2048, chunkSize: 1024 });
      await call(fc, '_Start', 'userA', opts);
      for (const chunkId of [0, -1, 3, 1.5, NaN]) {
        await expectMeteorError(call(fc, '_Write', 'userA', { fileId: opts.fileId, chunkId, binData: b64('abcd') }), 400);
      }
    });

    it('rejects chunks larger than the stored chunkSize', async function () {
      const opts = startOpts({ size: 2048, chunkSize: 1024 });
      await call(fc, '_Start', 'userA', opts);
      const big = Buffer.alloc(1025, 1).toString('base64');
      await expectMeteorError(call(fc, '_Write', 'userA', { fileId: opts.fileId, chunkId: 1, binData: big }), 400);
    });

    it('rejects non-EOF writes without binData', async function () {
      const opts = startOpts({ size: 4 });
      await call(fc, '_Start', 'userA', opts);
      await expectMeteorError(call(fc, '_Write', 'userA', { fileId: opts.fileId, chunkId: 1 }), 400);
    });

    it('uses the chunkSize stored at Start for offsets and stores real size', async function () {
      const opts = startOpts({ size: 2000, chunkSize: 1024 });
      await call(fc, '_Start', 'userA', opts);
      await call(fc, '_Write', 'userA', { fileId: opts.fileId, chunkId: 1, binData: Buffer.alloc(1024, 97).toString('base64') });
      await call(fc, '_Write', 'userA', { fileId: opts.fileId, chunkId: 2, binData: Buffer.alloc(10, 98).toString('base64') });
      const res = await call(fc, '_Write', 'userA', { fileId: opts.fileId, eof: true });
      const doc = await fc.collection.findOneAsync(opts.fileId);
      expect(doc.size).to.equal(1034);
      expect(res.size).to.equal(1034);
      const content = fs.readFileSync(doc.path, 'latin1');
      expect(content.length).to.equal(1034);
    });
  });

  describe('S5: allowClientCode', function () {
    it('defaults to false and the remove method answers 405', async function () {
      const fc = createCollection({ allowClientCode: undefined });
      expect(fc.allowClientCode).to.equal(false);
      await expectMeteorError(call(fc, '_Remove', 'userA', 'someId'), 405);
    });

    it('warns once when allowClientCode is true and onBeforeRemove is missing', function () {
      const warn = sinon.stub(console, 'warn');
      createCollection({ allowClientCode: true, onBeforeRemove: undefined });
      expect(warn.calledOnce).to.equal(true);
      expect(String(warn.firstCall.args[0])).to.include('onBeforeRemove');
      expect(String(warn.firstCall.args[0])).to.not.include('v4');
    });

    it('does not warn when onBeforeRemove is set or allowClientCode is not true', function () {
      const warn = sinon.stub(console, 'warn');
      createCollection({ allowClientCode: true, onBeforeRemove: () => true });
      createCollection({ onBeforeRemove: undefined });
      expect(warn.called).to.equal(false);
    });
  });

  describe('S6: uploadIdleTimeout', function () {
    it('defaults to 15 minutes and validates type', function () {
      const fc = createCollection();
      expect(fc.uploadIdleTimeout).to.equal(900000);
      expect(() => createCollection({ uploadIdleTimeout: '10' })).to.throw();
    });

    it('closes idle file handles and reopens them on the next chunk', async function () {
      const fc = createCollection({ uploadIdleTimeout: 50 });
      const opts = startOpts({ size: 2048, chunkSize: 1024 });
      await call(fc, '_Start', 'userA', opts);
      await call(fc, '_Write', 'userA', { fileId: opts.fileId, chunkId: 1, binData: Buffer.alloc(1024, 97).toString('base64') });
      await new Promise((r) => setTimeout(r, 150));
      expect(fc._currentUploads[opts.fileId].fh).to.equal(null);
      await call(fc, '_Write', 'userA', { fileId: opts.fileId, chunkId: 2, binData: Buffer.alloc(1024, 98).toString('base64') });
      const res = await call(fc, '_Write', 'userA', { fileId: opts.fileId, eof: true });
      expect(res.size).to.equal(2048);
    });
  });

  describe('S7: HTTP body limits', function () {
    let fc;
    before(function () {
      fc = createCollection();
    });

    it('rejects oversized chunk bodies with 413', async function () {
      const opts = startOpts({ size: 2048, chunkSize: 1024 });
      await call(fc, '_Start', 'userA', opts);
      // Limit for 1024-byte chunks is ceil(1024*4/3)+4096 = 5462 bytes. A small overflow fits
      // in socket buffers, so the client always reads the response
      const res = await httpRequest(`${fc.downloadRoute}/${fc.collectionName}/__upload`, {
        method: 'POST',
        headers: { 'x-fileid': opts.fileId, 'x-chunkid': '1', 'x-test-user': 'userA', 'content-type': 'text/plain' },
        body: 'A'.repeat(6000),
      });
      expect(res.status).to.equal(413);
      expect(JSON.parse(res.body).error).to.equal(413);
      expect(fc._currentUploads[opts.fileId].chunkIds.size).to.equal(0);
      expect(fs.statSync(fc._currentUploads[opts.fileId].path).size).to.equal(0);
    });

    it('rejects oversized Start bodies with 413', async function () {
      const opts = startOpts({ size: 4 });
      opts.file.meta = { blob: 'x'.repeat(1024 * 1024 + 10) };
      const res = await httpRequest(`${fc.downloadRoute}/${fc.collectionName}/__upload`, {
        method: 'POST',
        headers: { 'x-start': '1', 'x-test-user': 'userA', 'content-type': 'application/json' },
        body: JSON.stringify(opts),
      });
      // A 1 MiB body may still be in flight when the server closes the connection after the 413
      if (res.status === 'reset') {
        const alive = await httpRequest(`${fc.downloadRoute}/${fc.collectionName}/unknown/original/unknown.txt`);
        expect(alive.status).to.equal(404);
      } else {
        expect(res.status).to.equal(413);
      }
      expect(await fc._preCollection.findOneAsync(opts.fileId)).to.equal(undefined);
      expect(await fc._preCollection.findOneAsync({ fileId: opts.fileId })).to.equal(undefined);
    });
  });

  describe('S8: reserved client fields', function () {
    it('ignores reserved keys sent in opts.file and keeps user keys', async function () {
      const fc = createCollection();
      const opts = startOpts({
        size: 4,
        file: {
          _downloadRoute: '@evil.example',
          _collectionName: 'other',
          _storagePath: '/etc',
          path: '/etc/passwd',
          versions: { original: { path: '/etc/passwd' } },
          userId: 'victim',
          public: true,
          extension: 'html',
          isImage: true,
          mime: 'text/html',
          'mime-type': 'text/html',
          custom: 'keep-me',
        },
      });
      await call(fc, '_Start', 'userA', opts);
      await call(fc, '_Write', 'userA', { fileId: opts.fileId, chunkId: 1, binData: b64('data') });
      await call(fc, '_Write', 'userA', { fileId: opts.fileId, eof: true });
      const doc = await fc.collection.findOneAsync(opts.fileId);
      expect(doc._downloadRoute).to.equal(fc.downloadRoute);
      expect(doc._collectionName).to.equal(fc.collectionName);
      expect(doc.userId).to.equal('userA');
      expect(doc.public).to.equal(false);
      expect(doc.extension).to.equal('txt');
      expect(doc.isImage).to.equal(false);
      expect(doc.mime).to.equal('text/plain');
      expect(doc.custom).to.equal('keep-me');
      expect(fc._isPathInside(fc.storagePath({}), doc.path)).to.equal(true);
      expect(doc.versions.original.path).to.equal(doc.path);
    });
  });

  describe('S9/C1: Range handling', function () {
    let fc;
    let path;
    const content = '0123456789';
    before(function () {
      fc = createCollection();
      path = nodePath.join(fc.storagePath({}), 'range.txt');
      fs.writeFileSync(path, content);
    });

    const vRef = () => ({ name: 'range.txt', size: content.length, path, type: 'text/plain' });

    it('serves suffix ranges (bytes=-3)', async function () {
      const res = await serveRequest(fc, { vRef: vRef(), headers: { range: 'bytes=-3' } });
      expect(res.status).to.equal(206);
      expect(res.body).to.equal('789');
      expect(res.headers['content-range']).to.equal('bytes 7-9/10');
    });

    it('serves the last byte (bytes=9-9)', async function () {
      const res = await serveRequest(fc, { vRef: vRef(), headers: { range: 'bytes=9-9' } });
      expect(res.status).to.equal(206);
      expect(res.body).to.equal('9');
    });

    it('clamps end beyond size', async function () {
      const res = await serveRequest(fc, { vRef: vRef(), headers: { range: 'bytes=2-100' } });
      expect(res.status).to.equal(206);
      expect(res.body).to.equal('23456789');
    });

    it('returns 416 when start > end', async function () {
      const res = await serveRequest(fc, { vRef: vRef(), headers: { range: 'bytes=5-2' } });
      expect(res.status).to.equal(416);
    });

    it('returns 416 when start >= size', async function () {
      const res = await serveRequest(fc, { vRef: vRef(), headers: { range: 'bytes=10-' } });
      expect(res.status).to.equal(416);
      expect(res.headers['content-range']).to.equal('bytes */10');
    });

    it('ignores multi-range requests and serves 200', async function () {
      const res = await serveRequest(fc, { vRef: vRef(), headers: { range: 'bytes=0-1,4-5' } });
      expect(res.status).to.equal(200);
      expect(res.body).to.equal(content);
    });

    it('ignores malformed Range headers and serves 200', async function () {
      const res = await serveRequest(fc, { vRef: vRef(), headers: { range: 'items=0-1' } });
      expect(res.status).to.equal(200);
      expect(res.body).to.equal(content);
    });

    it('sends Content-Length on 206 and does not use chunked encoding', async function () {
      const res = await serveRequest(fc, { vRef: vRef(), headers: { range: 'bytes=2-5' } });
      expect(res.status).to.equal(206);
      expect(res.body).to.equal('2345');
      expect(res.headers['content-length']).to.equal('4');
      expect(res.headers).to.not.have.property('transfer-encoding');
    });

    it('drops a custom Transfer-Encoding when it sends Content-Length', async function () {
      const custom = createCollection({ responseHeaders: { 'Transfer-Encoding': 'chunked' } });
      const res = await serveRequest(custom, { vRef: vRef(), headers: { range: 'bytes=0-0' } });
      expect(res.status).to.equal(206);
      expect(res.headers['content-length']).to.equal('1');
      expect(res.headers).to.not.have.property('transfer-encoding');
    });

    it('sends Content-Length equal to the size on 200', async function () {
      const res = await serveRequest(fc, { vRef: vRef() });
      expect(res.status).to.equal(200);
      expect(res.headers['content-length']).to.equal(`${content.length}`);
      expect(res.headers).to.not.have.property('transfer-encoding');
      expect(res.headers).to.not.have.property('content-range');
    });

    it('sends no Content-Length on 206 for a caller\'s stream, so a stream of another length can not break the connection', async function () {
      const res = await serveRequest(fc, { vRef: vRef(), headers: { range: 'bytes=2-5' }, readable: () => Readable.from([Buffer.from('2345')]) });
      expect(res.status).to.equal(206);
      expect(res.body).to.equal('2345');
      expect(res.headers['content-range']).to.equal('bytes 2-5/10');
      expect(res.headers).to.not.have.property('content-length');
      expect(res.headers['transfer-encoding']).to.equal('chunked');
    });

    it('sends Content-Length equal to the stored size on 200 for a caller\'s stream (3.0 behavior)', async function () {
      const res = await serveRequest(fc, { vRef: vRef(), readable: () => Readable.from([Buffer.from(content)]) });
      expect(res.status).to.equal(200);
      expect(res.body).to.equal(content);
      expect(res.headers['content-length']).to.equal(`${content.length}`);
      expect(res.headers).to.not.have.property('transfer-encoding');
    });

    it('keeps a Content-Length set in responseHeaders on 206 for a caller\'s stream', async function () {
      const custom = createCollection({ responseHeaders: { 'Content-Length': '4' } });
      const res = await serveRequest(custom, { vRef: vRef(), headers: { range: 'bytes=2-5' }, readable: () => Readable.from([Buffer.from('2345')]) });
      expect(res.status).to.equal(206);
      expect(res.headers['content-length']).to.equal('4');
      expect(res.body).to.equal('2345');
    });

    it('answers HEAD with the same status and Content-Length and no body', async function () {
      const full = await serveRequest(fc, { vRef: vRef(), method: 'HEAD' });
      expect(full.status).to.equal(200);
      expect(full.headers['content-length']).to.equal(`${content.length}`);
      expect(full.body).to.equal('');
      const part = await serveRequest(fc, { vRef: vRef(), method: 'HEAD', headers: { range: 'bytes=2-5' } });
      expect(part.status).to.equal(206);
      expect(part.headers['content-length']).to.equal('4');
      expect(part.headers['content-range']).to.equal('bytes 2-5/10');
      expect(part.body).to.equal('');
    });

    it('serves ?play=true without Range as 200 with the full body', async function () {
      const res = await serveRequest(fc, { vRef: vRef(), query: { play: 'true' } });
      expect(res.status).to.equal(200);
      expect(res.body).to.equal(content);
      expect(res.headers['content-length']).to.equal(`${content.length}`);
      expect(res.headers).to.not.have.property('content-range');
    });

    it('serves ?play=true with Range as 206', async function () {
      const res = await serveRequest(fc, { vRef: vRef(), query: { play: 'true' }, headers: { range: 'bytes=0-' } });
      expect(res.status).to.equal(206);
      expect(res.body).to.equal(content);
      expect(res.headers['content-range']).to.equal('bytes 0-9/10');
      expect(res.headers['content-length']).to.equal(`${content.length}`);
    });

    it('C1: responds 400 on size mismatch when integrityCheck is on', async function () {
      const fileRef = { _id: 'abc', name: 'range.txt', versions: { original: { ...vRef(), size: 999 } } };
      const res = await new Promise((resolve) => {
        const server = http.createServer(async (req, resp) => {
          await fc.download({ request: req, response: resp, params: { query: {} } }, 'original', fileRef);
        });
        server.listen(0, '127.0.0.1', () => {
          http.get({ host: '127.0.0.1', port: server.address().port }, (r) => {
            r.resume();
            r.on('end', () => {
              server.close();
              resolve(r);
            });
          });
        });
      });
      expect(res.statusCode).to.equal(400);
    });
  });

  describe('S10: read stream cleanup', function () {
    it('destroys the read stream when the client goes away', async function () {
      const fc = createCollection();
      let stream;
      const server = http.createServer((req, res) => {
        stream = new Readable({ read() { this.push(Buffer.alloc(16 * 1024, 1)); } });
        fc.serve({ request: req, response: res, params: { query: {} } }, { _id: 'x', name: 'x.bin' }, { name: 'x.bin', size: 1024 * 1024 * 1024, path: '/nonexistent' }, 'original', stream);
      });
      await new Promise((r) => server.listen(0, '127.0.0.1', r));
      await new Promise((resolve) => {
        const req = http.get({ host: '127.0.0.1', port: server.address().port }, (res) => {
          res.once('data', () => {
            req.destroy();
            resolve();
          });
        });
        req.on('error', () => {});
      });
      await new Promise((r) => setTimeout(r, 200));
      server.close();
      expect(stream.destroyed).to.equal(true);
    });
  });

  describe('S12: route matching', function () {
    it('does not treat querystring matches as upload route', async function () {
      const fc = createCollection();
      const res = await httpRequest(`/not-files?x=${fc.downloadRoute}/${fc.collectionName}/__upload`, {
        method: 'POST',
        headers: { 'x-start': '1', 'content-type': 'application/json' },
        body: '{}',
      });
      expect(res.headers['content-type'] || '').to.not.include('application/json');
    });

    it('does not capture routes of a collection sharing the name prefix', async function () {
      const fc = createCollection({ protected: true });
      const res = await httpRequest(`${fc.downloadRoute}/${fc.collectionName}x/original/abc.txt`);
      expect(res.body).to.not.equal('Access denied!');
    });
  });

  describe('S13: no server paths in responses', function () {
    it('strips paths from DDP Start(returnMeta) and EOF responses', async function () {
      const fc = createCollection();
      const opts = startOpts({ size: 4 });
      const startRes = await call(fc, '_Start', 'userA', opts, true);
      expect(startRes.file).to.not.have.property('path');
      expect(startRes.file).to.not.have.property('_storagePath');
      expect(startRes.file.versions.original).to.not.have.property('path');
      await call(fc, '_Write', 'userA', { fileId: opts.fileId, chunkId: 1, binData: b64('data') });
      const res = await call(fc, '_Write', 'userA', { fileId: opts.fileId, eof: true });
      expect(res).to.not.have.property('path');
      expect(res).to.not.have.property('_storagePath');
      expect(res.versions.original).to.not.have.property('path');
      expect(res._id).to.equal(opts.fileId);
    });

    it('strips paths from HTTP Start(returnMeta) and EOF responses', async function () {
      const fc = createCollection();
      const opts = startOpts({ size: 4 });
      const route = `${fc.downloadRoute}/${fc.collectionName}/__upload`;
      const startRes = await httpRequest(route, {
        method: 'POST',
        headers: { 'x-start': '1', 'x-test-user': 'userA', 'content-type': 'application/json' },
        body: JSON.stringify({ ...opts, returnMeta: true }),
      });
      expect(startRes.status).to.equal(200);
      expect(startRes.body).to.not.include(TMP_ROOT);
      const chunkRes = await httpRequest(route, {
        method: 'POST',
        headers: { 'x-fileid': opts.fileId, 'x-chunkid': '1', 'x-test-user': 'userA', 'content-type': 'text/plain' },
        body: b64('data'),
      });
      expect(chunkRes.status).to.equal(204);
      const eofRes = await httpRequest(route, {
        method: 'POST',
        headers: { 'x-fileid': opts.fileId, 'x-eof': '1', 'x-test-user': 'userA', 'content-type': 'text/plain' },
      });
      expect(eofRes.status).to.equal(200);
      expect(eofRes.body).to.not.include(TMP_ROOT);
      expect(JSON.parse(eofRes.body)._id).to.equal(opts.fileId);
    });

    it('sends a generic error body without internal details', async function () {
      const fc = createCollection({ onInitiateUpload() { throw new Error(`boom at ${TMP_ROOT}/secret`); } });
      const res = await httpRequest(`${fc.downloadRoute}/${fc.collectionName}/__upload`, {
        method: 'POST',
        headers: { 'x-start': '1', 'x-test-user': 'userA', 'content-type': 'application/json' },
        body: JSON.stringify(startOpts({ size: 4 })),
      });
      expect(res.status).to.equal(500);
      expect(res.body).to.not.include(TMP_ROOT);
    });
  });

  describe('S14: Content-Disposition', function () {
    it('sends an RFC 6266 header with ASCII fallback and RFC 8187 filename*', async function () {
      const fc = createCollection();
      const path = nodePath.join(fc.storagePath({}), 'cd.txt');
      fs.writeFileSync(path, 'x');
      const res = await serveRequest(fc, { vRef: { name: 'naïve (1)\'s *"f".txt', size: 1, path } });
      expect(res.headers['content-disposition']).to.equal('inline; filename="na_ve (1)\'s *_f_.txt"; filename*=UTF-8\'\'na%C3%AFve%20%281%29%27s%20%2A%22f%22.txt');
    });

    it('replaces "%" in the ASCII fallback and keeps it encoded in filename*', async function () {
      const fc = createCollection();
      const path = nodePath.join(fc.storagePath({}), 'cd3.txt');
      fs.writeFileSync(path, 'x');
      const res = await serveRequest(fc, { vRef: { name: '100%25 done.txt', size: 1, path } });
      expect(res.headers['content-disposition']).to.equal('inline; filename="100_25 done.txt"; filename*=UTF-8\'\'100%2525%20done.txt');
    });

    it('omits filename parameters when the name is missing', async function () {
      const fc = createCollection();
      const path = nodePath.join(fc.storagePath({}), 'cd2.txt');
      fs.writeFileSync(path, 'x');
      const res = await serveRequest(fc, { vRef: { size: 1, path }, fileRef: { _id: 'abc' }, query: { download: 'true' } });
      expect(res.headers['content-disposition']).to.equal('attachment');
    });
  });

  describe('Default Content-Type charset', function () {
    const serveType = async (fc, type) => {
      const path = nodePath.join(fc.storagePath({}), 'ct.txt');
      fs.writeFileSync(path, 'x');
      const res = await serveRequest(fc, { vRef: { name: 'ct.txt', size: 1, path, type } });
      return res.headers['content-type'];
    };

    it('adds charset=utf-8 to text types without a charset', async function () {
      const fc = createCollection();
      expect(await serveType(fc, 'text/plain')).to.equal('text/plain; charset=utf-8');
      expect(await serveType(fc, 'text/html')).to.equal('text/html; charset=utf-8');
      expect(await serveType(fc, 'application/json')).to.equal('application/json; charset=utf-8');
      expect(await serveType(fc, 'application/javascript')).to.equal('application/javascript; charset=utf-8');
      expect(await serveType(fc, 'image/svg+xml')).to.equal('image/svg+xml; charset=utf-8');
    });

    it('keeps an existing charset and leaves binary types alone', async function () {
      const fc = createCollection();
      expect(await serveType(fc, 'text/plain; charset=iso-8859-1')).to.equal('text/plain; charset=iso-8859-1');
      expect(await serveType(fc, 'image/png')).to.equal('image/png');
      expect(await serveType(fc, undefined)).to.equal('application/octet-stream');
    });
  });

  describe('nosniff option', function () {
    it('adds X-Content-Type-Options when enabled', async function () {
      const fc = createCollection({ nosniff: true });
      const path = nodePath.join(fc.storagePath({}), 'ns.txt');
      fs.writeFileSync(path, 'x');
      const res = await serveRequest(fc, { vRef: { name: 'ns.txt', size: 1, path } });
      expect(res.headers['x-content-type-options']).to.equal('nosniff');
    });

    it('is off by default and validated', async function () {
      const fc = createCollection();
      expect(fc.nosniff).to.equal(false);
      expect(() => createCollection({ nosniff: 'yes' })).to.throw();
    });
  });

  describe('_Remove accepts only a String _id', function () {
    it('rejects an object selector with a Match error', async function () {
      const fc = createCollection({ allowClientCode: true });
      let caught;
      try {
        await call(fc, '_Remove', 'userA', { _id: { $ne: null } });
      } catch (e) {
        caught = e;
      }
      expect(caught?.errorType).to.equal('Match.Error');
    });

    it('removes one file by String _id', async function () {
      const fc = createCollection({ allowClientCode: true });
      const fileObj = await fc.writeAsync(Buffer.from('bye'), { name: 'bye.txt', type: 'text/plain' });
      expect(await call(fc, '_Remove', 'userA', fileObj._id)).to.equal(1);
      expect(await fc.collection.findOneAsync(fileObj._id)).to.equal(undefined);
      expect(fs.existsSync(fileObj.path)).to.equal(false);
    });
  });

  describe('Misc hardening', function () {
    it('_getUserId: Map sessions resolve userId', function () {
      const fc = createCollection();
      const original = Meteor.server.sessions;
      try {
        Meteor.server.sessions = new Map([['tok', { userId: 'u1' }]]);
        expect(fc._getUserId('tok')).to.equal('u1');
        expect(fc._getUserId('missing')).to.equal(null);
      } finally {
        Meteor.server.sessions = original;
      }
    });

    it('_getUserId: throws on plain object sessions (Map only since v4)', function () {
      const fc = createCollection();
      const original = Meteor.server.sessions;
      try {
        Meteor.server.sessions = { tok: { userId: 'u2' } };
        expect(() => fc._getUserId('tok')).to.throw('incompatible');
      } finally {
        Meteor.server.sessions = original;
      }
    });

    it('_getUserId: throws on incompatible sessions type', function () {
      const fc = createCollection();
      const original = Meteor.server.sessions;
      try {
        Meteor.server.sessions = 'not-a-map';
        expect(() => fc._getUserId('tok')).to.throw('incompatible');
      } finally {
        Meteor.server.sessions = original;
      }
    });

    it('_checkAccess: fails closed without http context', async function () {
      const fc = createCollection({ protected: () => true });
      expect(await fc._checkAccess()).to.equal(false);
    });

    it('protected returning out-of-range number responds 401', async function () {
      const fc = createCollection({ protected: () => 200 });
      const codes = [];
      const response = { headersSent: false, finished: false, writeHead(c) { codes.push(c); }, end() {} };
      const allowed = await fc._checkAccess({ request: { headers: {} }, response, params: {} });
      expect(allowed).to.equal(false);
      expect(codes).to.deep.equal([401]);
    });

    it('protected returning 403 responds 403', async function () {
      const fc = createCollection({ protected: () => 403 });
      const codes = [];
      const response = { headersSent: false, finished: false, writeHead(c) { codes.push(c); }, end() {} };
      expect(await fc._checkAccess({ request: { headers: {} }, response, params: {} })).to.equal(false);
      expect(codes).to.deep.equal([403]);
    });

    it('HTTP Start validates payload shape like DDP Start', async function () {
      const fc = createCollection();
      const res = await httpRequest(`${fc.downloadRoute}/${fc.collectionName}/__upload`, {
        method: 'POST',
        headers: { 'x-start': '1', 'x-test-user': 'userA', 'content-type': 'application/json' },
        body: JSON.stringify({ file: { name: 'a.txt', size: 4 }, fileId: 12345, chunkSize: 1024, fileLength: 1 }),
      });
      expect(res.status).to.equal(400);
    });

    it('HTTP handleError clamps non-HTTP error codes to 500', async function () {
      const fc = createCollection({ onInitiateUpload() { throw new Meteor.Error('custom-string-code', 'nope'); } });
      const res = await httpRequest(`${fc.downloadRoute}/${fc.collectionName}/__upload`, {
        method: 'POST',
        headers: { 'x-start': '1', 'x-test-user': 'userA', 'content-type': 'application/json' },
        body: JSON.stringify(startOpts({ size: 4 })),
      });
      expect(res.status).to.equal(500);
    });

    it('fixJSONParse skips prototype keys', function () {
      const parsed = fixJSONParse(JSON.parse('{"__proto__": {"d": "=--JSON-DATE--=1"}, "ok": "=--JSON-DATE--=2"}'));
      expect(parsed.ok).to.be.instanceOf(Date);
      expect(Object.getOwnPropertyDescriptor(parsed, '__proto__').value.d).to.equal('=--JSON-DATE--=1');
      expect(({}).d).to.equal(undefined);
    });
  });
});
