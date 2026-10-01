/* global describe, it, beforeEach */
import { expect } from 'chai';
import { Meteor } from 'meteor/meteor';
import { FilesCollection } from '../client.js';
import { BROWSER_COLLECTION } from './browser-constants.js';

export const files = new FilesCollection({ collectionName: BROWSER_COLLECTION, allowClientCode: true });

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const waitUntil = async (condition, timeout = 10000) => {
  const started = Date.now();
  while (!(await condition())) {
    if (Date.now() - started > timeout) {
      throw new Error('waitUntil timed out');
    }
    await sleep(50);
  }
};

export const makeFile = (name, size, fill = 'a') => new File([fill.repeat(size)], name, { type: 'text/plain' });

/**
 * Resolves on the `end` event: `{ error, fileObj }`. `end` fires on success and on failure, not on `abort()`
 */
export const settle = (upload) => new Promise((resolve) => {
  upload.once('end', (error, fileObj) => resolve({ error, fileObj }));
});

['ddp', 'http'].forEach((transport) => {
  describe(`FileUpload over ${transport.toUpperCase()}`, function () {
    this.timeout(30000);

    beforeEach(async function () {
      await Meteor.callAsync('mfTest.reset');
    });

    it('uploads: start, progress, completed, content stored', async function () {
      const upload = files.insert({ file: makeFile('ok.txt', 4096, 'b'), chunkSize: 1024, transport }, false);
      const events = [];
      upload.on('start', () => events.push('start'));
      upload.on('progress', (progress) => events.push(progress));
      const done = settle(upload);
      await upload.start();
      const { error, fileObj } = await done;

      expect(error).to.not.exist;
      expect(events[0]).to.equal('start');
      expect(events.filter((e) => typeof e === 'number').length).to.be.greaterThan(0);
      expect(upload.state.get()).to.equal('completed');
      expect(upload.progress.get()).to.equal(100);
      expect(fileObj._id).to.equal(upload.config.fileId);
      expect(fileObj).to.not.have.property('path');
      const stored = await Meteor.callAsync('mfTest.stored', fileObj._id);
      expect(stored.size).to.equal(4096);
      expect(stored.content).to.equal('b'.repeat(4096));
    });

    it('pauses and continues', async function () {
      const upload = files.insert({ file: makeFile('pause.txt', 8 * 1024, 'c'), chunkSize: 1024, transport }, false);
      const done = settle(upload);
      let paused = false;
      upload.on('progress', () => {
        if (!paused) {
          paused = true;
          upload.pause();
        }
      });
      await upload.start();
      await waitUntil(() => upload.state.get() === 'paused');
      await sleep(500);
      expect(upload.state.get()).to.equal('paused');
      expect(upload.progress.get()).to.be.below(100);

      upload.continue();
      const { error, fileObj } = await done;
      expect(error).to.not.exist;
      expect(upload.state.get()).to.equal('completed');
      expect((await Meteor.callAsync('mfTest.stored', fileObj._id)).content).to.equal('c'.repeat(8 * 1024));
    });

    it('aborts and removes the pending upload on the server', async function () {
      const upload = files.insert({ file: makeFile('abort.txt', 16 * 1024, 'd'), chunkSize: 1024, transport }, false);
      const fileId = upload.config.fileId;
      const aborted = new Promise((resolve) => upload.once('abort', resolve));
      upload.on('progress', () => {
        upload.abort();
      });
      await upload.start();
      await aborted;
      expect(upload.state.get()).to.equal('aborted');
      await waitUntil(async () => !(await Meteor.callAsync('mfTest.pending', fileId)));
    });

    it('ends with the server error when onBeforeUpload rejects', async function () {
      const upload = files.insert({ file: makeFile('reject.txt', 16), chunkSize: 1024, transport }, false);
      const done = settle(upload);
      await upload.start();
      const { error } = await done;
      expect(error.error).to.equal(403);
      expect(error.reason).to.equal('Rejected by test server');
      expect(upload.state.get()).to.equal('aborted');
    });

    it('gives up after 5 attempts when the server answers 503', async function () {
      const upload = files.insert({ file: makeFile('always-503.txt', 16), chunkSize: 1024, transport }, false);
      const done = settle(upload);
      await upload.start();
      const { error } = await done;
      expect(error.error).to.equal(503);
      expect(upload.state.get()).to.equal('aborted');
      expect(await Meteor.callAsync('mfTest.attempts', 'always-503.txt')).to.equal(5);
    });
  });
});
