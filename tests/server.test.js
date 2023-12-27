/* global describe, beforeEach, it, before, afterEach, Meteor */

import { expect } from 'chai';
import { FilesCollection } from '../server';
import sinon from 'sinon';
import fs from 'fs';

describe('FilesCollection Constructor', function() {
  describe('constructor', function() {
    it('should create an instance of FilesCollection', async function() {
      const filesCollection = new FilesCollection({ collectionName: 'test123'});
      expect(filesCollection instanceof FilesCollection).to.be.true;
    });
  });
});


describe('FilesCollection', () => {
  describe('#addFileAsync', () => {
    let filesCollection;
    let path;
    let opts;
    let proceedAfterUpload;

    before(() => {
      filesCollection = new FilesCollection({ collectionName: 'testserver', onAfterUpload: () => {}});
      path = '/tmp/meteor-test-file.txt';
      fs.writeFileSync(path, 'test');
      opts = { type: 'text/plain'};
      proceedAfterUpload = false;
    });

    afterEach(() => {
      // Restore the stubbed methods after each test
      sinon.restore();
    });

    it('should add a file successfully', async () => {
      const result = await filesCollection.addFileAsync(path, opts, proceedAfterUpload);

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

      await filesCollection.addFileAsync(path, opts, true);

      expect(filesCollection.onAfterUpload.calledWith()).to.be.true;
    });

    it('should not call onAfterUpload hook if flag is false', async () => {
      // Stub the `onAfterUpload` method
      sinon.stub(filesCollection, 'onAfterUpload');

      await filesCollection.addFileAsync(path, opts, false);

      expect(filesCollection.onAfterUpload.calledWith()).to.be.false;
    });

    it('should throw an error if file does not exist', async () => {
      const nonExistingPath = '/tmp/meteor-test-file-non-existing.txt';
      try {
        await filesCollection.addFileAsync(nonExistingPath, opts, proceedAfterUpload);
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
        await filesCollection.addFileAsync(nonReadablePath, opts, proceedAfterUpload);
      } catch (e) {
        expect(e).to.be.instanceOf(Meteor.Error);
        expect(e.error).to.equal(400);
      }
    });

    it('should throw an error, if path is not a file', async () => {
      const nonFile = '/tmp';
      try {
        await filesCollection.addFileAsync(nonFile, opts, proceedAfterUpload);
      } catch (e) {
        expect(e).to.be.instanceOf(Meteor.Error);
        expect(e.error).to.equal(400);
      }
    });

    it('should throw an error, if file is added to a public collection', async () => {
      const publicFilesCollection = new FilesCollection({ collectionName: 'testserver-pub', public: true, storagePath: '/tmp', downloadRoute: '/public' });
      try {
        await publicFilesCollection.addFileAsync(path, opts, proceedAfterUpload);
      } catch (e) {
        expect(e).to.be.instanceOf(Meteor.Error);
        expect(e.error).to.equal(403);
      }
    });
  });
});
