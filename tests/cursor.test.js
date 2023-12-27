/* global describe, beforeEach, after, before it, afterEach, Meteor */
import { expect } from 'chai';
import sinon from 'sinon';
import FilesCollectionCore from '../core.js';
import { FileCursor, FilesCursor } from '../cursor.js';
import { FilesCollection } from '../server.js';
import fs from 'fs';
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

  describe('#remove()', function() {
    let sandbox;
    beforeEach(function() {
      sandbox = sinon.createSandbox();
    });
    afterEach(function() {
      sandbox.restore();
    });
    it('should call the collection.remove method with the file ID', function() {
      const fileRef = { _id: 'test' };

      // Mock the collection.remove method to check the arguments
      const remove = sandbox.stub(filesCollection, 'remove').returns('test');

      const cursor = new FileCursor(fileRef, filesCollection);
      cursor.remove(() => {
        expect(remove.calledWith(fileRef._id)).to.be.true;
      });
    });

    it('should call the callback with an error if no file reference is provided', function() {
      const cursor = new FileCursor(null, filesCollection);
      cursor.remove((err) => {
        expect(err).to.be.instanceOf(Meteor.Error);
        expect(err.reason).to.equal('No such file');
      });
    });
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
      const unlink = sandbox.stub(fs, 'unlink').resolves('test');

      const cursor = new FileCursor(fileRef, filesCollection);

      await cursor.removeAsync();
      expect(removeAsync.calledWith(fileRef._id)).to.be.true;
      expect(unlink.calledWith(fileRef.path)).to.be.true;
    });

    it('should call the callback with an error if no file reference is provided', async function() {
      const core = new FilesCollectionCore();
      const cursor = new FileCursor(null, core);
      fs.writeFileSync('/tmp/test.txt', 'test');
      const opts = { _id: 'test' };
      await filesCollection.addFileAsync('/tmp/test.txt', opts);
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
      cursor.link(() => {
        expect(filesCollection.link.calledWith(fileRef, version, uriBase)).to.be.true;
      });
    });

    it('should call the callback with an error if no file reference is provided', function() {
      const cursor = new FileCursor(null, filesCollection);
      cursor.link((err) => {
        expect(err).to.be.instanceOf(Meteor.Error);
        expect(err.reason).to.equal('No such file');
      });
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
      const fetched = cursor.get();
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

  describe('#hasNext()', function() {
    it('should return true if there is a next item available on the cursor', function() {
      // Mock the collection.find method to return a cursor with a count method
      sandbox.stub(filesCollection.collection, 'find').returns({
        count: () => 2,
      });


      const cursor = new FilesCursor({}, {}, filesCollection);
      const hasNext = cursor.hasNext();
      expect(hasNext).to.be.true;
    });

    it('should return false if there is no next item available on the cursor', function() {
      // Mock the collection.find method to return a cursor with a count method
      sandbox.stub(filesCollection.collection, 'find').returns({
        count: () => 0,
      });

      const cursor = new FilesCursor({}, {}, filesCollection);
      const hasNext = cursor.hasNext();
      expect(hasNext).to.be.false;
    });
  });

  describe('#hasNextAsync()', function() {
    it('should return true if there is a next item available on the cursor', async function() {
      // Mock the collection.find method to return a cursor with a countAsync method
      sandbox.stub(filesCollection.collection, 'find').returns({
        countAsync: async () => 2,
      });

      const cursor = new FilesCursor({}, {}, filesCollection);
      const hasNext = await cursor.hasNextAsync();
      expect(hasNext).to.be.true;
    });

    it('should return false if there is no next item available on the cursor', async function() {
      // Mock the collection.find method to return a cursor with a countAsync method
      sandbox.stub(filesCollection.collection, 'find').returns({
        countAsync: async () => 0,
      });


      const cursor = new FilesCursor({}, {}, filesCollection);
      const hasNext = await cursor.hasNextAsync();
      expect(hasNext).to.be.false;
    });
  });

  describe('#next()', function() {
    it('should return the next item on the cursor', async function() {
      const documents = [{ _id: 'test1' }, { _id: 'test2' }];
      await filesCollection.collection.rawCollection().insertMany(documents);

      const cursor = new FilesCursor({}, {}, filesCollection);

      let next = cursor.next();
      expect(next, 'Cursor is right before position 0 on initialization').to.deep.equal(documents[0]);


      next = cursor.next();
      expect(next).to.deep.equal(documents[1]);
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
      sandbox.stub(cursor.cursor, 'fetch').returns(documents);
      cursor.previous();
      expect(cursor._current).to.equal(0);
    });
  });

  describe('#previousAsync()', function() {
    it('should return the previous item on the cursor', function() {
      const cursor = new FilesCursor({}, {}, filesCollection);
      const documents = [{ _id: 'test1' }, { _id: 'test2' }];
      cursor._current = 1;
      sandbox.stub(cursor.cursor, 'fetchAsync').resolves(documents);
      cursor.previous();
      expect(cursor._current).to.equal(0);
    });
  });

  describe('#fetch()', function() {
    it('should return all matching documents as an array', function() {
      const cursor = new FilesCursor({}, {}, filesCollection);
      const documents = [{ _id: 'test1' }, { _id: 'test2' }];
      sandbox.stub(cursor.cursor, 'fetch').returns(documents);
      const result = cursor.fetch();
      expect(result).to.deep.equal(documents);
    });

    it('should return an empty array if no matching documents are found', function() {
      const cursor = new FilesCursor({}, {}, filesCollection);
      sandbox.stub(cursor.cursor, 'fetch').returns(null);
      const result = cursor.fetch();
      expect(result).to.deep.equal([]);
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

  describe('#last()', function() {
    it('should return the last item on the cursor', async function() {
      const cursor = new FilesCursor({}, {}, filesCollection);
      const documents = [{ _id: 'test1' }, { _id: 'test2' }];
      await filesCollection.collection.rawCollection().insertMany(documents);

      const last = cursor.last();
      expect(last).to.deep.equal(documents[1]);
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

  describe('#count()', function() {
    it('should return the number of documents that match a query', function() {
      const cursor = new FilesCursor({}, {}, filesCollection);
      sandbox.stub(cursor.cursor, 'count').returns(2);
      const count = cursor.count();
      expect(count).to.equal(2);
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

  describe('#remove()', function() {
    it('should remove all matching documents', async function() {
      const documents = [{ _id: 'test1', path: '/tmp/randomfile123.txt' }, { _id: 'test2', path: '/tmp/randomfile456' }];
      fs.writeFileSync('/tmp/randomfile123.txt', 'file contents');
      fs.writeFileSync('/tmp/randomfile123.txt', 'file contents');
      await filesCollection.collection.rawCollection().insertMany(documents);

      const cursor = new FilesCursor({_id: 'test1'}, {}, filesCollection);

      await new Promise((resolve, reject) => {
        cursor.remove((err, res) => {
          if (err) {
            reject(err);
          }
          resolve(res);
        });
      });

      const result = await filesCollection.collection.rawCollection().find().toArray();
      expect(result).to.have.lengthOf(1);
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

  describe('#forEach()', function() {
    it('should call the callback for each matching document', async function() {
      const cursor = new FilesCursor({}, {}, filesCollection);
      const documents = [{ _id: 'test1' }, { _id: 'test2' }];
      await filesCollection.collection.rawCollection().insertMany(documents);

      let count = 0;
      cursor.forEach(() => {
        count++;
      });
      expect(count).to.equal(documents.length);
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

      const result = cursor.each();

      expect(result).to.be.an('array');
      result.forEach((fileCursor, index) => {
        expect(fileCursor).to.be.instanceOf(FileCursor);
        expect(fileCursor._fileRef).to.deep.equal(documents[index]);
      });
    });
  });

  describe('#map()', function() {
    it('should map callback over all matching documents', async function() {
      const cursor = new FilesCursor({}, {}, filesCollection);
      const documents = [{ _id: 'test1' }, { _id: 'test2' }];
      await filesCollection.collection.rawCollection().insertMany(documents);

      const result = cursor.map((doc) => doc._id);
      expect(result).to.deep.equal(documents.map((doc) => doc._id));
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
    it('should return the current item on the cursor', function() {
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
      sandbox.stub(cursor, 'fetchAsync').returns(Promise.resolve(documents));
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
