/* global describe, beforeEach, after, before it, afterEach */
import { expect } from 'chai';
import sinon from 'sinon';
import FilesCollectionCore from '../core.js';
import { FileCursor, FilesCursor } from '../cursor.js';
import { FilesCollection } from '../server.js';
import fs from 'node:fs';
import { MongoInternals } from 'meteor/mongo';


describe('FileCursor', function() {
  let collectionName = 'FileCursor';
  let filesCollection;

  before(function() {
    filesCollection = new FilesCollection({ collectionName });
  });

  after(async function() {
    await MongoInternals.defaultRemoteCollectionDriver().mongo.db.collection(collectionName).drop();
  });

  beforeEach(async function() {
    await filesCollection.collection.rawCollection().deleteMany({});
    sinon.restore();
  });

  afterEach(function() {
    sinon.restore();
  });

  describe('#removeAsync()', function() {
    let sandbox;
    beforeEach(function() {
      sandbox = sinon.createSandbox();
    });
    afterEach(function() {
      sandbox.restore();
    });
    it('should call the collection.removeAsync with the file ID and unlink method with the path', async function() {
      const fileRef = { _id: 'test', path: '/tmp' };
      await filesCollection.collection.rawCollection().insertOne(fileRef);

      const removeAsync = sandbox.stub(filesCollection.collection, 'removeAsync').resolves('test');
      const unlink = sandbox.stub(fs.promises, 'unlink').resolves('test');

      const cursor = new FileCursor(fileRef, filesCollection);

      await cursor.removeAsync();
      expect(removeAsync.calledWith(fileRef._id)).to.be.true;
      expect(unlink.calledWith(fileRef.path)).to.be.true;
    });

    it('should throw an error if no file reference is provided', async function() {
      const core = new FilesCollectionCore();
      const cursor = new FileCursor({}, core);
      fs.writeFileSync('/tmp/test.txt', 'test');
      const opts = { _id: 'test' };
      await filesCollection.addFile('/tmp/test.txt', opts);
      let error;
      try {
        await cursor.removeAsync();
      } catch (err) {
        error = err;
      }
      expect(error).to.be.instanceOf(Meteor.Error);
      expect(error.reason).to.equal('No such file');
      fs.unlinkSync('/tmp/test.txt');
    });
  });

  describe('#link()', function() {
    it('should call the collection.link method with the fileRef, version and uriBase', function() {
      const fileRef = { _id: 'test' };
      const version = 'v1';
      const uriBase = 'https://test.com';

      // Mock the collection.remove method to check the arguments
      filesCollection.link = sinon.spy();

      const cursor = new FileCursor(fileRef, filesCollection);
      cursor.link(version, uriBase);
      expect(filesCollection.link.calledWith(fileRef, version, uriBase)).to.be.true;
    });

    it('should return empty string if no file reference is provided', function() {
      const cursor = new FileCursor({}, filesCollection);
      const link = cursor.link();
      expect(link).to.equal('');
    });
  });
});

describe('FilesCursor', function() {
  let collectionName = 'FilesCursor';
  let filesCollection;
  let sandbox;

  before(function() {
    filesCollection = new FilesCollection({ collectionName });
  });

  after(async function() {
    await MongoInternals.defaultRemoteCollectionDriver().mongo.db.collection(collectionName).drop();
  });

  beforeEach(async function() {
    await filesCollection.collection.rawCollection().deleteMany({});
    sandbox = sinon.createSandbox();
    sinon.restore();
  });

  afterEach(function() {
    sinon.restore();
    sandbox.restore();
  });

  describe('#get()', function() {
    it('should return all matching documents as an array', async function() {
      const documents = [{ _id: 'test1' }, { _id: 'test2' }];

      await filesCollection.collection.rawCollection().insertMany(documents);

      const cursor = new FilesCursor({}, {}, filesCollection);
      const fetched = await cursor.get();
      expect(fetched).to.deep.equal(documents);
    });
  });

  describe('#getAsync()', function() {
    it('should return all matching documents as an array', async function() {
      const documents = [{ _id: 'test1' }, { _id: 'test2' }];

      await filesCollection.collection.rawCollection().insertMany(documents);

      const cursor = new FilesCursor({}, {}, filesCollection);
      const fetched = await cursor.getAsync();
      expect(fetched).to.deep.equal(documents);
    });
  });


  describe('#hasNextAsync()', function() {
    it('should return true if there is a next item available on the cursor', async function() {
      // Mock the collection.find method to return a cursor with a countDocuments method
      sandbox.stub(filesCollection.collection, 'countDocuments').resolves(2);

      const cursor = new FilesCursor({}, {}, filesCollection);
      const hasNext = await cursor.hasNextAsync();
      expect(hasNext).to.be.true;
    });

    it('should return false if there is no next item available on the cursor', async function() {
      // Mock the collection.find method to return a cursor with a countDocuments method
      sandbox.stub(filesCollection.collection, 'countDocuments').resolves(0);

      const cursor = new FilesCursor({}, {}, filesCollection);
      const hasNext = await cursor.hasNextAsync();
      expect(hasNext).to.be.false;
    });
  });

  describe('#nextAsync()', function() {
    it('should return the next item on the cursor', async function() {
      const documents = [{ _id: 'test1' }, { _id: 'test2' }];
      await filesCollection.collection.rawCollection().insertMany(documents);

      const cursor = new FilesCursor({}, {}, filesCollection);

      let next = await cursor.nextAsync();
      expect(next).to.deep.equal(documents[0]);

      next = await cursor.nextAsync();
      expect(next).to.deep.equal(documents[1]);
    });
  });

  describe('#hasPrevious()', function() {
    it('should return true if there is a previous item available on the cursor', function() {
      const cursor = new FilesCursor({}, {}, filesCollection);
      cursor._current = 1;
      const hasPrevious = cursor.hasPrevious();
      expect(hasPrevious).to.be.true;
    });

    it('should return false if there is no previous item available on the cursor', function() {
      const cursor = new FilesCursor({}, {}, filesCollection);
      cursor._current = -1;
      const hasPrevious = cursor.hasPrevious();
      expect(hasPrevious).to.be.false;
    });
  });

  describe('#previous()', function() {
    it('should return the previous item on the cursor', function() {
      const cursor = new FilesCursor({}, {}, filesCollection);
      const documents = [{ _id: 'test1' }, { _id: 'test2' }];
      cursor._current = 1;
      sandbox.stub(cursor.cursor, 'fetchAsync').resolves(documents);
      cursor.previous();
      expect(cursor._current).to.equal(0);
    });
  });

  describe('#fetchAsync()', function() {
    it('should return all matching documents as an array', async function() {
      const cursor = new FilesCursor({}, {}, filesCollection);
      const documents = [{ _id: 'test1' }, { _id: 'test2' }];
      sandbox.stub(cursor.cursor, 'fetchAsync').returns(Promise.resolve(documents));
      const result = await cursor.fetchAsync();
      expect(result).to.deep.equal(documents);
    });

    it('should return an empty array if no matching documents are found', async function() {
      const cursor = new FilesCursor({}, {}, filesCollection);
      sandbox.stub(cursor.cursor, 'fetchAsync').returns(Promise.resolve(null));
      const result = await cursor.fetchAsync();
      expect(result).to.deep.equal([]);
    });
  });

  describe('#lastAsync()', function() {
    it('should return the last item on the cursor', async function() {
      const cursor = new FilesCursor({}, {}, filesCollection);
      const documents = [{ _id: 'test1' }, { _id: 'test2' }];
      await filesCollection.collection.rawCollection().insertMany(documents);

      const last = await cursor.lastAsync();
      expect(last).to.deep.equal(documents[1]);
    });
  });

  describe('#countAsync()', function() {
    it('should return the number of documents that match a query', async function() {
      const cursor = new FilesCursor({}, {}, filesCollection);
      sandbox.stub(cursor.cursor, 'countAsync').returns(Promise.resolve(2));
      const count = await cursor.countAsync();
      expect(count).to.equal(2);
    });
  });

  describe('#countDocuments()', function() {
    it('should return the number of documents that match a query', async function() {
      const cursor = new FilesCursor({}, {}, filesCollection);
      sandbox.stub(filesCollection.collection, 'countDocuments').returns(Promise.resolve(2));
      const count = await cursor.countDocuments();
      expect(count).to.equal(2);
    });
  });

  describe('#removeAsync()', function() {
    it('should remove all matching documents', async function() {
      const cursor = new FilesCursor({_id: 'test1'}, {}, filesCollection);
      const documents = [{ _id: 'test1', path: '/tmp/random' }, { _id: 'test2', path: '/tmp/random' }];
      await filesCollection.collection.rawCollection().insertMany(documents);

      await cursor.removeAsync();

      const result = await filesCollection.collection.rawCollection().find().toArray();
      expect(result).to.have.lengthOf(1);
    });
  });

  describe('#forEachAsync()', function() {
    it('should call the callback for each matching document', async function() {
      const cursor = new FilesCursor({}, {}, filesCollection);
      const documents = [{ _id: 'test1' }, { _id: 'test2' }];
      await filesCollection.collection.rawCollection().insertMany(documents);
      let count = 0;
      await cursor.forEachAsync(() => {
        count++;
      });
      expect(count).to.equal(documents.length);
    });
  });

  describe('#each()', function() {
    it('should return an array of FileCursor for each document', async function() {
      const cursor = new FilesCursor({}, {}, filesCollection);
      const documents = [{ _id: 'test1' }, { _id: 'test2' }];
      await filesCollection.collection.rawCollection().insertMany(documents);

      const result = await cursor.each();

      expect(result).to.be.an('array');
      result.forEach((fileCursor, index) => {
        expect(fileCursor).to.be.instanceOf(FileCursor);
        expect(fileCursor._fileRef).to.deep.equal(documents[index]);
      });
    });
  });

  describe('#mapAsync()', function() {
    it('should map callback over all matching documents', async function() {
      const cursor = new FilesCursor({}, {}, filesCollection);
      const documents = [{ _id: 'test1' }, { _id: 'test2' }];
      await filesCollection.collection.rawCollection().insertMany(documents);

      const result = await cursor.mapAsync((doc) => doc._id);
      expect(result).to.deep.equal(documents.map((doc) => doc._id));
    });
  });

  describe('#current()', function() {
    it('should return the current item on the cursor', async function() {
      const cursor = new FilesCursor({}, {}, filesCollection);
      const documents = [{ _id: 'test1' }, { _id: 'test2' }];
      sandbox.stub(cursor, 'fetch').returns(documents);
      const current = cursor.current();
      expect(current).to.deep.equal(documents[0]);
    });
  });

  describe('#currentAsync()', function() {
    it('should return the current item on the cursor', async function() {
      const cursor = new FilesCursor({}, {}, filesCollection);
      const documents = [{ _id: 'test1' }, { _id: 'test2' }];
      sandbox.stub(cursor, 'fetchAsync').resolves(documents);
      const current = await cursor.currentAsync();
      expect(current).to.deep.equal(documents[0]);
    });
  });

  describe('#observe()', function() {
    it('should call observe on the cursor', function() {
      const cursor = new FilesCursor({}, {}, filesCollection);
      const observeStub = sandbox.stub(cursor.cursor, 'observe');
      const callbacks = {};
      cursor.observe(callbacks);
      sinon.assert.calledWith(observeStub, callbacks);
    });
  });

  describe('#observeChanges()', function() {
    it('should call observeChanges on the cursor', function() {
      const cursor = new FilesCursor({}, {}, filesCollection);
      const observeChangesStub = sandbox.stub(cursor.cursor, 'observeChanges');
      const callbacks = {};
      cursor.observeChanges(callbacks);
      sinon.assert.calledWith(observeChangesStub, callbacks);
    });
  });
});
