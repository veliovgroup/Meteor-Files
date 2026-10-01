/* global describe, beforeEach, it, before, after */
import { expect, assert } from 'chai';
import fs from 'node:fs';
import os from 'node:os';
import nodePath from 'node:path';
import { Meteor } from 'meteor/meteor';
import { Mongo, MongoInternals } from 'meteor/mongo';
import FilesCollectionCore from '../core.js';
import { FileCursor, FilesCursor } from '../cursor.js';
import { FilesCollection } from '../server.js';
import { formatFileURL } from '../lib.js';

// eslint-disable-next-line no-undef, camelcase
const ROOT = (__meteor_runtime_config__.ROOT_URL || '/').replace(/\/+$/, '');

describe('FilesCollectionCore', function() {
  let filesCollectionCore;

  beforeEach(function() {
    filesCollectionCore = new FilesCollectionCore();
  });

  describe('_getFileName', function() {
    it('should return the correct file name', function() {
      const fileData = { name: 'test.txt' };
      const result = filesCollectionCore._getFileName(fileData);
      expect(result).to.equal('test.txt');
    });
  });

  describe('_getExt', function() {
    it('should return the correct file extension', function() {
      const result = filesCollectionCore._getExt('test.txt');
      expect(result).to.deep.equal({ ext: 'txt', extension: 'txt', extensionWithDot: '.txt' });
    });
  });

  describe('_updateFileTypes', function() {
    it('should correctly classify file types', function() {
      const data = { type: 'video/mp4' };
      filesCollectionCore._updateFileTypes(data);
      expect(data.isVideo).to.be.true;
      expect(data.isAudio).to.be.false;
      expect(data.isImage).to.be.false;
      expect(data.isText).to.be.false;
      expect(data.isJSON).to.be.false;
      expect(data.isPDF).to.be.false;
    });
  });

  describe('_dataToSchema', function() {
    it('should create a schema object from the given data', function() {
      const core = new FilesCollectionCore();
      const data = {
        fileId: 'file1',
        name: 'test',
        extension: 'txt',
        path: '/path/to/test',
        meta: {},
        type: 'text/plain',
        size: 100,
        userId: 'user1',
        _downloadRoute: '/download',
        _collectionName: 'testCollection',
        _storagePath: '/storage/path'
      };

      const expectedSchema = {
        fileId: 'file1',
        name: 'test',
        extension: 'txt',
        ext: 'txt',
        extensionWithDot: '.txt',
        path: '/path/to/test',
        meta: {},
        type: 'text/plain',
        mime: 'text/plain',
        'mime-type': 'text/plain',
        size: 100,
        userId: 'user1',
        versions: {
          original: {
            path: '/path/to/test',
            size: 100,
            type: 'text/plain',
            extension: 'txt',
          },
        },
        _downloadRoute: '/download',
        _collectionName: 'testCollection',
        _id: 'file1',
        _storagePath: '/storage/path',
      };

      const schema = core._dataToSchema(data);
      assert.deepStrictEqual(schema, filesCollectionCore._dataToSchema(expectedSchema));
    });
  });

  describe('#findOneAsync()', function() {
    it('should find and return a FileCursor for matching document Object', async function() {
      const core = new FilesCollectionCore();
      const selector = { name: 'test' };
      const options = {};

      // Mock the collection.findOneAsync method to return a dummy document
      core.collection = {
        findOneAsync: async (sel, opts) => {
          expect(sel).to.deep.equal(selector);
          expect(opts).to.deep.equal(options);
          return { name: 'test' };
        }
      };

      const doc = await core.findOneAsync(selector, options);
      expect(doc).to.be.an.instanceof(FileCursor);
      expect(doc).to.deep.equal(new FileCursor({ name: 'test' }, core));
    });

    it('should return null if no document is found', async function() {
      const core = new FilesCollectionCore();
      const selector = { name: 'nonexistent' };
      const options = {};

      // Mock the collection.findOneAsync method to return null
      core.collection = {
        findOneAsync: async (sel, opts) => {
          expect(sel).to.deep.equal(selector);
          expect(opts).to.deep.equal(options);
          return null;
        }
      };

      const doc = await core.findOneAsync(selector, options);
      expect(doc).to.be.null;
    });
  });

  describe('#find()', function() {
    it('should find and return a FilesCursor for matching documents', function() {
      // Testing with FilesCollectionCore instance only fails, due to lack of a
      // underlying collection, so we use the FilesCollection class

      const collection = new FilesCollection({ collectionName: 'test' });
      const selector = { name: 'test' };
      const options = {};

      const cursor = collection.find(selector, options);
      expect(cursor).to.be.an.instanceof(FilesCursor);
    });
  });

  describe('#updateAsync()', function() {
    it('should call the collection.updateAsync method with the given arguments', async function() {
      const core = new FilesCollectionCore();
      const selector = { name: 'test' };
      const modifier = { $set: { name: 'newTest' } };

      // Mock the collection.updateAsync method to check the arguments
      core.collection = {
        updateAsync: async (sel, mod) => {
          expect(sel).to.deep.equal(selector);
          expect(mod).to.deep.equal(modifier);
        }
      };

      await core.updateAsync(selector, modifier);
    });
  });

  describe('#link()', function() {
    it('should return a downloadable URL for the given file reference and version', function() {
      const core = new FilesCollectionCore();
      const fileRef = { _id: 'test', _downloadRoute: '/cdn/storage', _collectionName: 'files' };
      const version = 'original';

      const url = core.link(fileRef, version);
      expect(url).to.equal(`${ROOT}/cdn/storage/files/test/original/test`);
    });
  });
});

describe('FilesCollectionCore (3.1 fixes)', function() {
  const collectionName = 'CoreFixes31';
  let TMP_DIR;
  let files;

  before(function() {
    TMP_DIR = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'mf-core-'));
    files = new FilesCollection({ collectionName, storagePath: TMP_DIR, downloadRoute: '/cdn/storage' });
  });

  after(async function() {
    await MongoInternals.defaultRemoteCollectionDriver().mongo.db.collection(collectionName).drop().catch(() => {});
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  const doc = () => ({
    _id: 'abc123',
    name: 'photo.jpg',
    extension: 'jpg',
    _downloadRoute: '/cdn/storage',
    _collectionName: collectionName,
    versions: {
      original: { extension: 'jpg' },
      thumb: { extension: 'png' },
    },
  });

  describe('H7: estimatedDocumentCount()', function() {
    it('returns a number and does not throw', async function() {
      const count = await files.estimatedDocumentCount();
      expect(count).to.be.a('number');
    });
  });

  describe('M3: link()', function() {
    it('returns empty string for null and undefined', function() {
      expect(files.link(null)).to.equal('');
      expect(files.link(undefined)).to.equal('');
    });

    it('accepts a FileCursor and returns the same URL as for the plain document', function() {
      const cursor = new FileCursor(doc(), files);
      expect(files.link(cursor)).to.equal(files.link(doc()));
      expect(files.link(cursor, 'thumb')).to.equal(`${ROOT}/cdn/storage/${collectionName}/abc123/thumb/abc123.png`);
    });

    it('keeps URLs of normal files unchanged', function() {
      expect(files.link(doc())).to.equal(`${ROOT}/cdn/storage/${collectionName}/abc123/original/abc123.jpg`);
      expect(files.link(doc(), 'original', 'https://cdn.example.com/')).to.equal(`https://cdn.example.com/cdn/storage/${collectionName}/abc123/original/abc123.jpg`);
      const pub = Object.assign(doc(), { public: true });
      expect(files.link(pub)).to.equal(`${ROOT}/cdn/storage/abc123.jpg`);
      expect(files.link(pub, 'thumb')).to.equal(`${ROOT}/cdn/storage/thumb-abc123.png`);
    });
  });

  describe('S1: formatFileURL', function() {
    it('encodes _id, version, and extension', function() {
      const ref = Object.assign(doc(), { _id: 'a/../b?c#d', versions: { 'v 1/x': { extension: 'j?g/' } } });
      const url = files.link(ref, 'v 1/x');
      expect(url).to.equal(`${ROOT}/cdn/storage/${collectionName}/a%2F..%2Fb%3Fc%23d/v%201%2Fx/a%2F..%2Fb%3Fc%23d.j%3Fg%2F`);
    });

    it('falls back to the collection route and name when the document fields are unsafe', function() {
      const ref = Object.assign(doc(), { _downloadRoute: '//evil.example.com', _collectionName: '../other' });
      expect(files.link(ref)).to.equal(`${ROOT}/cdn/storage/${collectionName}/abc123/original/abc123.jpg`);
    });

    it('falls back to document route only when it is a local path', function() {
      expect(formatFileURL(doc())).to.equal(`${ROOT}/cdn/storage/${collectionName}/abc123/original/abc123.jpg`);
      expect(formatFileURL(Object.assign(doc(), { _downloadRoute: '//evil.example.com' }))).to.equal('');
      expect(formatFileURL(Object.assign(doc(), { _downloadRoute: 'https://evil.example.com' }))).to.equal('');
      expect(formatFileURL(Object.assign(doc(), { _downloadRoute: undefined }))).to.equal('');
      expect(formatFileURL(Object.assign(doc(), { _collectionName: 'a/b' }))).to.equal('');
      expect(formatFileURL(Object.assign(doc(), { _collectionName: 'a/b', public: true }))).to.equal(`${ROOT}/cdn/storage/abc123.jpg`);
    });

    it('keeps the stored route and name when they are safe (3.0.x output)', function() {
      // Client collection without `downloadRoute`, server collection with `downloadRoute: '/files'`
      const clientCollection = new FilesCollectionCore();
      clientCollection.downloadRoute = '/cdn/storage';
      clientCollection.collectionName = 'Images';
      const ref = Object.assign(doc(), { _downloadRoute: '/files', _collectionName: 'Images' });
      expect(clientCollection.link(ref)).to.equal(`${ROOT}/files/Images/abc123/original/abc123.jpg`);
      expect(clientCollection.link(ref, 'thumb')).to.equal(`${ROOT}/files/Images/abc123/thumb/abc123.png`);
      expect(clientCollection.link(Object.assign(ref, { public: true }))).to.equal(`${ROOT}/files/abc123.jpg`);
      expect(files.link(Object.assign(doc(), { _downloadRoute: '/files/sub', _collectionName: 'Other.Name' }))).to.equal(`${ROOT}/files/sub/Other.Name/abc123/original/abc123.jpg`);
    });

    it('rejects stored routes with "..", "//", "@", ":", backslash, whitespace, or control characters', function() {
      for (const route of ['/a/../b', '/a//b', '/a@b', '/a:b', '/a\\b', '/a b', '/a\tb', '/a\u0000b', '/a\u007fb', 'files', '']) {
        expect(files.link(Object.assign(doc(), { _downloadRoute: route }))).to.equal(`${ROOT}/cdn/storage/${collectionName}/abc123/original/abc123.jpg`, JSON.stringify(route));
        expect(formatFileURL(Object.assign(doc(), { _downloadRoute: route }))).to.equal('', JSON.stringify(route));
      }
    });

    it('accepts a FileCursor', function() {
      expect(formatFileURL(new FileCursor(doc(), files))).to.equal(`${ROOT}/cdn/storage/${collectionName}/abc123/original/abc123.jpg`);
    });

    it('returns an empty string when the file has no _id', function() {
      // A rejected upload's `end` callback gets a file object without `_id`
      for (const _id of [undefined, null, '']) {
        const ref = Object.assign(doc(), { _id });
        expect(files.link(ref), JSON.stringify(_id)).to.equal('');
        expect(formatFileURL(ref), JSON.stringify(_id)).to.equal('');
        expect(files.link(Object.assign(ref, { public: true })), JSON.stringify(_id)).to.equal('');
      }
      const noId = doc();
      delete noId._id;
      expect(files.link(noId)).to.equal('');
      expect(files.link({ name: 'note.txt', extension: 'txt' })).to.equal('');
    });

    it('rejects stored routes with "?", "#", or encoded ".", "/", "\\"', function() {
      for (const route of ['/cdn?x=1', '/cdn#x', '/a/b?', '/%2e%2e/x', '/%2E%2E/x', '/a%2fb', '/a%2Fb', '/a%5cb', '/a%5Cb', '/.%2e/x']) {
        expect(files.link(Object.assign(doc(), { _downloadRoute: route }))).to.equal(`${ROOT}/cdn/storage/${collectionName}/abc123/original/abc123.jpg`, JSON.stringify(route));
        expect(formatFileURL(Object.assign(doc(), { _downloadRoute: route }))).to.equal('', JSON.stringify(route));
      }
    });
  });

  describe('M3/L18: Mongo.ObjectID and scalar selectors', function() {
    it('find(), findOneAsync(), and countDocuments() accept Mongo.ObjectID', async function() {
      const oid = new Mongo.ObjectID();
      expect(() => files.find(oid)).to.not.throw();
      expect(await files.findOneAsync(oid)).to.equal(null);
      expect(await files.countDocuments(oid)).to.equal(0);
    });

    it('countDocuments() accepts the same selectors as find()', async function() {
      await files.collection.rawCollection().deleteMany({});
      await files.collection.rawCollection().insertMany([{ _id: 'cd1', name: 'a' }, { _id: 'cd2', name: 'b' }]);
      expect(await files.countDocuments()).to.equal(2);
      expect(await files.countDocuments('cd1')).to.equal(1);
      expect(await files.countDocuments({ name: 'b' })).to.equal(1);
      expect(await files.countDocuments(null)).to.equal(0);
      expect(await files.countDocuments(false)).to.equal(0);
      expect(await files.countDocuments(5)).to.equal(0);
      await files.collection.rawCollection().deleteMany({});
    });
  });

  describe('M1: findOne() on server', function() {
    it('throws a Meteor.Error', function() {
      expect(() => files.findOne({})).to.throw(Meteor.Error);
    });
  });
});
