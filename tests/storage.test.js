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
import { MongoInternals } from 'meteor/mongo';
import { FilesCollection, FSStorage, GridFSStorage } from '../server.js';

const { GridFSBucket, ObjectId } = MongoInternals.NpmModules.mongodb.module;
const TMP_ROOT = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'mf-storage-'));

const get = (path, headers = {}) => new Promise((resolve, reject) => {
  http.get(new URL(path, Meteor.absoluteUrl()), { headers }, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
  }).on('error', reject);
});

const call = (fc, kind, userId, ...args) => {
  return Meteor.server.method_handlers[fc._methodNames[kind]].apply({ userId, connection: null, unblock() {} }, args);
};

const create = (config = {}) => {
  const collectionName = `st${Random.id(8)}`;
  return new FilesCollection({ collectionName, storagePath: nodePath.join(TMP_ROOT, collectionName), ...config });
};

const uploadDDP = async (fc, content) => {
  const fileId = Random.id();
  await call(fc, '_Start', 'u1', { file: { name: 'up.txt', type: 'text/plain', size: content.length, meta: {} }, fileId, chunkSize: 1024, fileLength: 1 });
  await call(fc, '_Write', 'u1', { fileId, chunkId: 1, binData: Buffer.from(content).toString('base64') });
  return call(fc, '_Write', 'u1', { fileId, eof: true });
};

const listen = (handler) => new Promise((resolve) => {
  const server = http.createServer(handler);
  server.listen(0, '127.0.0.1', () => resolve(server));
});

const memoryAdapter = () => {
  const files = new Map();
  const calls = [];
  const sources = [];
  return {
    calls,
    files,
    sources,
    async put(fileRef, versionName, localPath, opts) {
      calls.push(['put', fileRef._id, versionName]);
      sources.push(opts?.source);
      files.set(`${fileRef._id}/${versionName}`, await fs.promises.readFile(localPath));
      return { name: 'memory', key: `${fileRef._id}/${versionName}` };
    },
    async createReadStream(fileRef, versionName, { start, end } = {}) {
      calls.push(['read', fileRef._id, versionName, start, end]);
      const data = files.get(fileRef.versions[versionName].meta.storage.key);
      return Readable.from([Number.isInteger(start) ? data.subarray(start, end + 1) : data]);
    },
    async remove(fileRef, versionName) {
      calls.push(['remove', fileRef._id, versionName]);
      files.delete(`${fileRef._id}/${versionName}`);
    },
  };
};

describe('Storage adapters', function () {
  this.timeout(15000);

  after(function () {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  });

  afterEach(function () {
    sinon.restore();
  });

  describe('FSStorage', function () {
    it('is the default adapter and invalid adapters are rejected', function () {
      expect(create().storage).to.be.instanceOf(FSStorage);
      expect(() => create({ storage: { put() {} } })).to.throw();
      expect(() => create({ storage: 'fs' })).to.throw();
    });

    it('streams a range with an inclusive end', async function () {
      const path = nodePath.join(TMP_ROOT, 'fs-range.txt');
      fs.writeFileSync(path, '0123456789');
      const stream = await new FSStorage().createReadStream({ versions: { original: { path } } }, 'original', { start: 2, end: 5 });
      let data = '';
      for await (const chunk of stream) {
        data += chunk;
      }
      expect(data).to.equal('2345');
    });

    it('rethrows ENOENT from remove() so unlinkAsync can log it', async function () {
      let caught;
      try {
        await new FSStorage().remove({ versions: { original: { path: nodePath.join(TMP_ROOT, 'missing.txt') } } }, 'original');
      } catch (e) {
        caught = e;
      }
      expect(caught?.code).to.equal('ENOENT');
    });
  });

  describe('custom adapter', function () {
    it('runs put() at upload EOF, before onAfterUpload, and stores its result', async function () {
      const adapter = memoryAdapter();
      const seen = [];
      const fc = create({ storage: adapter, onAfterUpload(fileRef) { seen.push(fileRef.versions.original.meta?.storage?.name); } });
      const res = await uploadDDP(fc, 'data');
      expect(seen).to.deep.equal(['memory']);
      expect(adapter.files.get(`${res._id}/original`).toString()).to.equal('data');
      const doc = await fc.collection.findOneAsync(res._id);
      expect(doc.versions.original.meta.storage).to.deep.equal({ name: 'memory', key: `${res._id}/original` });
    });

    it('runs put() in writeAsync() before onAfterUpload', async function () {
      const adapter = memoryAdapter();
      const order = [];
      const fc = create({ storage: adapter, onAfterUpload() { order.push('onAfterUpload'); } });
      const put = adapter.put;
      adapter.put = async (...args) => {
        order.push('put');
        return put(...args);
      };
      const doc = await fc.writeAsync(Buffer.from('hello'), { name: 'h.txt', type: 'text/plain' }, true);
      expect(order).to.deep.equal(['put', 'onAfterUpload']);
      expect(doc.versions.original.meta.storage.key).to.equal(`${doc._id}/original`);
    });

    it('serves through createReadStream(), with Range', async function () {
      const adapter = memoryAdapter();
      const fc = create({ storage: adapter });
      const doc = await fc.writeAsync(Buffer.from('0123456789'), { name: 'r.txt', type: 'text/plain' });
      const full = await get(fc.link(doc, 'original', '/'));
      expect(full.status).to.equal(200);
      expect(full.body).to.equal('0123456789');
      const part = await get(fc.link(doc, 'original', '/'), { range: 'bytes=2-5' });
      expect(part.status).to.equal(206);
      expect(part.body).to.equal('2345');
      expect(part.headers['content-length']).to.equal('4');
      expect(adapter.calls.filter((c) => c[0] === 'read').pop()).to.deep.equal(['read', doc._id, 'original', 2, 5]);
    });

    it('runs interceptDownload before the adapter', async function () {
      const adapter = memoryAdapter();
      const fc = create({
        storage: adapter,
        interceptDownload(httpObj) {
          httpObj.response.writeHead(200);
          httpObj.response.end('intercepted');
          return true;
        },
      });
      const doc = await fc.writeAsync(Buffer.from('x'), { name: 'i.txt', type: 'text/plain' });
      expect((await get(fc.link(doc, 'original', '/'))).body).to.equal('intercepted');
      expect(adapter.calls.some((c) => c[0] === 'read')).to.equal(false);
    });

    it('answers 500 when createReadStream() rejects', async function () {
      const adapter = memoryAdapter();
      const fc = create({ storage: adapter });
      const doc = await fc.writeAsync(Buffer.from('x'), { name: 'e.txt', type: 'text/plain' });
      adapter.createReadStream = async () => {
        throw new Error('backend down');
      };
      const res = await get(fc.link(doc, 'original', '/'));
      expect(res.status).to.equal(500);
      expect(res.body).to.equal('Internal Server Error');
    });

    it('removeAsync() calls remove() for each version', async function () {
      const adapter = memoryAdapter();
      const fc = create({ storage: adapter });
      const doc = await fc.writeAsync(Buffer.from('x'), { name: 'd.txt', type: 'text/plain' });
      await fc.collection.updateAsync(doc._id, { $set: { 'versions.thumb': { path: '/nowhere', size: 1, type: 'text/plain', extension: 'txt' } } });
      expect(await fc.removeAsync({ _id: doc._id })).to.equal(1);
      expect(adapter.calls.filter((c) => c[0] === 'remove')).to.deep.equal([['remove', doc._id, 'original'], ['remove', doc._id, 'thumb']]);
    });

    it('keeps the stored copy when onAfterUpload throws in writeAsync()', async function () {
      const adapter = memoryAdapter();
      const fc = create({ storage: adapter, onAfterUpload() { throw new Error('hook failed'); } });
      let caught;
      try {
        await fc.writeAsync(Buffer.from('x'), { name: 'k.txt', type: 'text/plain', fileId: 'hookFails1' }, true);
      } catch (e) {
        caught = e;
      }
      expect(caught).to.be.instanceOf(Error);
      expect(await fc.collection.findOneAsync('hookFails1')).to.be.an('object');
      expect(adapter.calls.map((c) => c[0])).to.deep.equal(['put']);
      expect(adapter.files.has('hookFails1/original')).to.equal(true);
    });

    it('tells put() where the local file comes from', async function () {
      const adapter = memoryAdapter();
      const fc = create({ storage: adapter });
      await uploadDDP(fc, 'up');
      await fc.writeAsync(Buffer.from('w'), { name: 'w.txt', type: 'text/plain' });
      const server = await listen((req, res) => res.end('loaded'));
      try {
        await fc.loadAsync(`http://127.0.0.1:${server.address().port}/l.txt`, { fileName: 'l.txt' });
      } finally {
        server.close();
      }
      const path = nodePath.join(TMP_ROOT, `add-${Random.id(6)}.txt`);
      fs.writeFileSync(path, 'added');
      const added = await fc.addFile(path, { type: 'text/plain' });
      expect(adapter.sources).to.deep.equal(['upload', 'write', 'load', 'addFile']);
      expect(adapter.files.get(`${added._id}/original`).toString()).to.equal('added');
    });

    it('removes the stored copy when the insert fails after put()', async function () {
      const adapter = memoryAdapter();
      const fc = create({ storage: adapter });
      sinon.stub(fc.collection, 'insertAsync').rejects(new Error('db down'));
      let caught;
      try {
        await fc.writeAsync(Buffer.from('x'), { name: 'f.txt', type: 'text/plain', fileId: 'insertFails1' });
      } catch (e) {
        caught = e;
      }
      expect(caught).to.be.instanceOf(Error);
      expect(adapter.calls.map((c) => c[0])).to.deep.equal(['put', 'remove']);
      expect(adapter.files.size).to.equal(0);
    });
  });

  describe('GridFSStorage', function () {
    let fc;
    let bucketName;
    const bucket = () => new GridFSBucket(MongoInternals.defaultRemoteCollectionDriver().mongo.db, { bucketName });

    before(function () {
      bucketName = `mfgfs${Random.id(6)}`;
      fc = create({ storage: new GridFSStorage({ bucketName }) });
    });

    it('moves the file into the bucket and removes the local copy', async function () {
      const doc = await fc.writeAsync(Buffer.from('gridfs data'), { name: 'g.txt', type: 'text/plain' });
      const { storage } = doc.versions.original.meta;
      expect(storage.name).to.equal('gridfs');
      expect(storage.bucketName).to.equal(bucketName);
      expect(storage.id).to.match(/^[a-f0-9]{24}$/);
      expect(fs.existsSync(doc.path)).to.equal(false);
      const stored = await bucket().find({ _id: new ObjectId(storage.id) }).toArray();
      expect(stored).to.have.length(1);
      expect(stored[0].length).to.equal(11);
    });

    it('serves the whole file and the last byte', async function () {
      const doc = await fc.writeAsync(Buffer.from('0123456789'), { name: 'g2.txt', type: 'text/plain' });
      expect((await get(fc.link(doc, 'original', '/'))).body).to.equal('0123456789');
      const last = await get(fc.link(doc, 'original', '/'), { range: 'bytes=9-9' });
      expect(last.status).to.equal(206);
      expect(last.body).to.equal('9');
    });

    it('answers 404 when the bucket file is gone', async function () {
      const doc = await fc.writeAsync(Buffer.from('gone'), { name: 'g3.txt', type: 'text/plain' });
      await bucket().delete(new ObjectId(doc.versions.original.meta.storage.id));
      expect((await get(fc.link(doc, 'original', '/'))).status).to.equal(404);
    });

    it('removeAsync() deletes the bucket file', async function () {
      const doc = await fc.writeAsync(Buffer.from('bye'), { name: 'g4.txt', type: 'text/plain' });
      const id = new ObjectId(doc.versions.original.meta.storage.id);
      expect(await fc.removeAsync({ _id: doc._id })).to.equal(1);
      expect(await bucket().find({ _id: id }).toArray()).to.have.length(0);
    });

    it('keeps the caller\'s file passed to addFile()', async function () {
      const path = nodePath.join(TMP_ROOT, `gfs-add-${Random.id(6)}.txt`);
      fs.writeFileSync(path, 'mine');
      const doc = await fc.addFile(path, { type: 'text/plain' });
      expect(doc.versions.original.meta.storage.name).to.equal('gridfs');
      expect(fs.readFileSync(path, 'utf8')).to.equal('mine');
      expect((await get(fc.link(doc, 'original', '/'))).body).to.equal('mine');
    });

    it('removes the local copy of loadAsync() files', async function () {
      const server = await listen((req, res) => res.end('remote'));
      let doc;
      try {
        doc = await fc.loadAsync(`http://127.0.0.1:${server.address().port}/r.txt`, { fileName: 'r.txt' });
      } finally {
        server.close();
      }
      expect(fs.existsSync(doc.path)).to.equal(false);
      expect((await get(fc.link(doc, 'original', '/'))).body).to.equal('remote');
    });

    it('stores DDP uploads in the bucket', async function () {
      const res = await uploadDDP(fc, 'data');
      expect(res.versions.original.meta.storage.name).to.equal('gridfs');
      const doc = await fc.collection.findOneAsync(res._id);
      expect(doc.path).to.be.a('string');
      expect(fs.existsSync(doc.path)).to.equal(false);
      expect((await get(fc.link(res, 'original', '/'))).body).to.equal('data');
    });
  });
});
