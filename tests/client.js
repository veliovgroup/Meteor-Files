/* global describe, it, beforeEach */
import { expect } from 'chai';
import sinon from 'sinon';
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

    it('resumes after a server restart without sending acknowledged chunks again', async function () {
      const content = 'f'.repeat(8 * 1024);
      const upload = files.insert({ file: new File([content], 'restart.txt', { type: 'text/plain' }), chunkSize: 1024, transport }, false);
      const fileId = upload.config.fileId;
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
      await sleep(300);
      const before = await Meteor.callAsync('mfTest.chunks', fileId);
      // Some chunks, not all: otherwise the check below passes without a resume
      expect(before.length).to.be.greaterThan(0);
      expect(before.length).to.be.lessThan(8);
      expect(await Meteor.callAsync('mfTest.simulateRestart', fileId)).to.equal(true);

      upload.continue();
      const { error, fileObj } = await done;
      expect(error).to.not.exist;
      expect((await Meteor.callAsync('mfTest.stored', fileObj._id)).content).to.equal(content);
      const after = (await Meteor.callAsync('mfTest.chunks', fileId)).slice(before.length);
      // A chunk cancelled by pause() may be sent again, older ones never are
      expect(after.every((id) => id >= Math.max(...before))).to.equal(true);
      expect([...new Set([...before, ...after])].sort((a, b) => a - b)).to.deep.equal([1, 2, 3, 4, 5, 6, 7, 8]);
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

    it('runs pipes in the order they were added', async function () {
      const order = [];
      const upload = files.insert({ file: makeFile('pipes.txt', 1024, 'e'), chunkSize: 1024, transport }, false);
      upload
        .pipe((data) => { order.push('first'); return data; })
        .pipe((data) => { order.push('second'); return data; });
      const done = settle(upload);
      await upload.start();
      const { error } = await done;
      expect(error).to.not.exist;
      expect(order).to.deep.equal(['first', 'second']);
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

describe('remove from the client', function () {
  this.timeout(30000);

  const uploadOne = async (name) => {
    const upload = files.insert({ file: makeFile(name, 16, 'r'), chunkSize: 1024, transport: 'ddp' }, false);
    const done = settle(upload);
    await upload.start();
    const { error, fileObj } = await done;
    expect(error).to.not.exist;
    return fileObj._id;
  };

  it('rejects an object selector before calling the server', async function () {
    let caught;
    try {
      await files.removeAsync({ _id: 'x' });
    } catch (e) {
      caught = e;
    }
    expect(caught?.errorType).to.equal('Match.Error');
  });

  it('removes by _id', async function () {
    const _id = await uploadOne('remove-me.txt');
    expect(await files.removeAsync(_id)).to.equal(1);
    expect(await Meteor.callAsync('mfTest.stored', _id)).to.equal(null);
  });

  it('FilesCursor#removeAsync() removes each matching file by _id', async function () {
    const a = await uploadOne('cursor-a.txt');
    const b = await uploadOne('cursor-b.txt');
    const handle = Meteor.subscribe('mfTest.files');
    await waitUntil(() => handle.ready() && files.collection.find({ _id: { $in: [a, b] } }).count() === 2);
    expect(await files.find({ _id: { $in: [a, b] } }).removeAsync()).to.equal(2);
    expect(await Meteor.callAsync('mfTest.stored', a)).to.equal(null);
    expect(await Meteor.callAsync('mfTest.stored', b)).to.equal(null);
    handle.stop();
  });
});

describe('client options', function () {
  it('allowClientCode defaults to false and removeAsync rejects with 401', async function () {
    const local = new FilesCollection({ collection: files.collection });
    expect(local.allowClientCode).to.equal(false);
    let caught;
    try {
      await local.removeAsync('anyId');
    } catch (e) {
      caught = e;
    }
    expect(caught.error).to.equal(401);
  });

  it('ignores namingFunction on the client and warns', function () {
    const warn = sinon.stub(console, 'warn');
    try {
      const local = new FilesCollection({ collection: files.collection, namingFunction: () => 'x' });
      expect(local.namingFunction).to.equal(undefined);
      expect(warn.calledOnce).to.equal(true);
      expect(String(warn.firstCall.args[0])).to.include('namingFunction');
    } finally {
      warn.restore();
    }
  });
});
