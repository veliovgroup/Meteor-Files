/* global describe, beforeEach, it */
import { expect, assert } from 'chai';
import FilesCollectionCore from '../core.js';
import { FileCursor, FilesCursor } from '../cursor.js';
import { FilesCollection } from '../server.js';

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
      const fileRef = { _id: 'test' };
      const version = 'original';

      const url = core.link(fileRef, version);
      expect(url).to.be.a('string');
    });
  });
});
