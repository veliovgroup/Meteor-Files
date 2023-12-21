/* global describe, beforeEach, it */
import { expect } from 'chai';
import FilesCollectionCore from '../core.js';

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
});
