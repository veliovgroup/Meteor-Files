/* global describe, beforeEach, it, afterEach, Meteor */

import { expect } from 'chai';
import { FilesCollection } from '../server';

describe('FilesCollection Constructor', function() {
  describe('constructor', function() {
    it('should create an instance of FilesCollection', async function() {
      const filesCollection = new FilesCollection({ collectionName: 'test123'});
      expect(filesCollection instanceof FilesCollection).to.be.true;
    });
  });
});
