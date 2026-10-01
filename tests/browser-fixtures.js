import fs from 'node:fs';
import os from 'node:os';
import nodePath from 'node:path';
import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';
import { FilesCollection } from '../server.js';
import { BROWSER_COLLECTION } from './browser-constants.js';

const storagePath = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'mf-browser-'));
const startAttempts = new Map();
const chunkLog = new Map();

/**
 * Server half of the browser suite. File names select the behavior:
 * - `reject.txt`: onBeforeUpload rejects with 403
 * - `always-503.txt`: every Start fails with 503, attempts are counted
 */
export const browserFiles = new FilesCollection({
  collectionName: BROWSER_COLLECTION,
  storagePath,
  allowClientCode: true,
  onBeforeRemove: () => true,
  onBeforeUpload(file) {
    if (this.chunkId > 0) {
      chunkLog.set(file._id, [...(chunkLog.get(file._id) || []), this.chunkId]);
    }

    if (file.name === 'reject.txt') {
      return 'Rejected by test server';
    }

    if (file.name === 'always-503.txt') {
      startAttempts.set(file.name, (startAttempts.get(file.name) || 0) + 1);
      throw new Meteor.Error(503, 'Busy, try again');
    }
    return true;
  },
});

Meteor.methods({
  'mfTest.reset'() {
    startAttempts.clear();
  },
  'mfTest.attempts'(name) {
    check(name, String);
    return startAttempts.get(name) || 0;
  },
  'mfTest.chunks'(fileId) {
    check(fileId, String);
    return chunkLog.get(fileId) || [];
  },
  async 'mfTest.simulateRestart'(fileId) {
    check(fileId, String);
    const stream = browserFiles._currentUploads[fileId];
    if (!stream) {
      return false;
    }
    // Let a chunk that is still being written finish, closing the handle under it would abort the upload
    while (stream.pendingWrites > 0) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    // Same as a restart for this upload: the stream and its file handle are gone, the record stays
    clearTimeout(stream.idleTimer);
    stream.idleTimer = null;
    await stream.fh?.close();
    stream.fh = null;
    delete browserFiles._currentUploads[fileId];
    return true;
  },
  async 'mfTest.pending'(fileId) {
    check(fileId, String);
    return !!(await browserFiles._preCollection.findOneAsync({ _id: fileId }));
  },
  async 'mfTest.stored'(_id) {
    check(_id, String);
    const doc = await browserFiles.collection.findOneAsync({ _id });
    if (!doc) {
      return null;
    }
    return { size: doc.size, type: doc.type, content: await fs.promises.readFile(doc.path, 'utf8') };
  },
});

Meteor.publish('mfTest.files', function () {
  return browserFiles.collection.find({});
});
