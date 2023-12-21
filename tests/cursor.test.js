/* global describe, beforeEach, it, afterEach, Meteor */
import { expect } from 'chai';
import sinon from 'sinon';
import FilesCollectionCore from '../core.js';
import { FileCursor } from '../cursor.js';
import { FilesCollection } from '../server.js';
import fs from 'fs';

describe('FileCursor', function() {
  let filesCollection = new FilesCollection();

  beforeEach(async function() {
    await filesCollection.collection.rawCollection().deleteMany({});
    sinon.restore();
  });

  afterEach(function() {
    sinon.restore();
  });

  describe('#remove()', function() {
    it('should call the collection.remove method with the file ID', function() {
      const fileRef = { _id: 'test' };

      // Mock the collection.remove method to check the arguments
      filesCollection.remove = sinon.spy();

      const cursor = new FileCursor(fileRef, filesCollection);
      cursor.remove(() => {
        expect(filesCollection.remove.calledWith(fileRef._id)).to.be.true;
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
      const fileRef = { _id: 'test', path: 'temp' };
      await filesCollection.addFileAsync('test', fileRef);
      let error;
      try {
        await cursor.removeAsync();
      } catch (err) {
        error = err;
      }
      expect(error).to.be.instanceOf(Meteor.Error);
      expect(error.reason).to.equal('No such file');
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

  describe('#linkAsync()', function() {
    let sandbox;

    beforeEach(function() {
      sandbox = sinon.createSandbox();
    });

    afterEach(function() {
      sandbox.restore();
    });

    it('should call the collection.linkAsync with the fileRef, version and uriBase', async function() {
      const fileRef = { _id: 'test' };
      const version = 'v1';
      const uriBase = 'https://test.com';

      filesCollection.link = sinon.spy();

      const cursor = new FileCursor(fileRef, filesCollection);

      await cursor.linkAsync(version, uriBase);
      expect(filesCollection.link.calledWith(fileRef, version, uriBase)).to.be.true;
    });

    it('should call the callback with an empty string if no file reference is provided', async function() {
      const core = new FilesCollectionCore();
      const cursor = new FileCursor(null, core);

      let result = await cursor.linkAsync();
      expect(result).to.be.a.string('');
    });
  });
});
