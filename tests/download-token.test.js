/* global describe, it */
import { expect } from 'chai';
import { createDownloadToken, verifyDownloadToken } from '../download-token.js';

const SECRET = 's'.repeat(32);
const NOW = Date.UTC(2026, 9, 1);
const EXP = Math.floor(NOW / 1000) + 60;
const TARGET = { _id: 'file1', version: 'original', now: NOW };
const make = (overrides = {}) => createDownloadToken(SECRET, { _id: 'file1', version: 'original', userId: 'u1', exp: EXP, ...overrides });

describe('download-token.js', function () {
  it('round-trips userId and exp for the same _id and version', function () {
    const token = make();
    expect(token.split('.')).to.have.length(3);
    expect(token.startsWith(`${EXP}.`)).to.equal(true);
    expect(verifyDownloadToken(SECRET, token, TARGET)).to.deep.equal({ userId: 'u1', exp: EXP });
  });

  it('carries a null userId', function () {
    expect(verifyDownloadToken(SECRET, make({ userId: null }), TARGET)).to.deep.equal({ userId: null, exp: EXP });
  });

  it('keeps userIds with dots and non-ASCII characters', function () {
    expect(verifyDownloadToken(SECRET, make({ userId: 'a.b.ü' }), TARGET).userId).to.equal('a.b.ü');
  });

  it('rejects another _id or version', function () {
    expect(verifyDownloadToken(SECRET, make(), { ...TARGET, _id: 'file2' })).to.equal(null);
    expect(verifyDownloadToken(SECRET, make(), { ...TARGET, version: 'thumbnail' })).to.equal(null);
  });

  it('rejects an expired token', function () {
    expect(verifyDownloadToken(SECRET, make({ exp: Math.floor(NOW / 1000) - 1 }), TARGET)).to.equal(null);
    expect(verifyDownloadToken(SECRET, make({ exp: Math.floor(NOW / 1000) }), TARGET)).to.equal(null);
  });

  it('rejects tampered tokens and another secret', function () {
    const [exp, user, sig] = make().split('.');
    // The first base64url character holds 6 signature bits; the last one has unused padding bits
    const flipped = `${sig[0] === 'A' ? 'B' : 'A'}${sig.slice(1)}`;
    expect(verifyDownloadToken(SECRET, `${exp}.${user}.${flipped}`, TARGET)).to.equal(null);
    expect(verifyDownloadToken(SECRET, `${exp}.${Buffer.from('admin').toString('base64url')}.${sig}`, TARGET)).to.equal(null);
    expect(verifyDownloadToken(SECRET, `${Number(exp) + 3600}.${user}.${sig}`, TARGET)).to.equal(null);
    expect(verifyDownloadToken('t'.repeat(32), make(), TARGET)).to.equal(null);
  });

  it('accepts only the canonical form of exp and signature', function () {
    const [exp, user, sig] = make().split('.');
    const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    // Flip the lowest bit of the last character: an unused bit, the decoded bytes stay the same
    const lastSwapped = `${sig.slice(0, -1)}${ALPHABET[ALPHABET.indexOf(sig.at(-1)) ^ 1]}`;
    expect(Buffer.from(lastSwapped, 'base64url').equals(Buffer.from(sig, 'base64url'))).to.equal(true);
    expect(verifyDownloadToken(SECRET, `${exp}.${user}.${lastSwapped}`, TARGET)).to.equal(null);
    expect(verifyDownloadToken(SECRET, `${exp}.${user}.${sig}=`, TARGET)).to.equal(null);
    expect(verifyDownloadToken(SECRET, `0${exp}.${user}.${sig}`, TARGET)).to.equal(null);
    expect(verifyDownloadToken(SECRET, `${exp}.${user}.${sig}`, TARGET)).to.deep.equal({ userId: 'u1', exp: EXP });
  });

  it('rejects malformed input', function () {
    [undefined, null, 42, ['a'], '', 'a.b', 'a.b.c.d', `${EXP}..`, `x${EXP}.AA.AA`, '9'.repeat(20) + '.AA.AA', 'x'.repeat(600)].forEach((token) => {
      expect(verifyDownloadToken(SECRET, token, TARGET), String(token)).to.equal(null);
    });
  });
});
