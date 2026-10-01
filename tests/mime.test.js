/* global describe, it, after */
import { expect } from 'chai';
import fs from 'node:fs';
import os from 'node:os';
import nodePath from 'node:path';
import { SNIFF_BYTES, baseMimeType, detectMimeType, isUtf8Text, resolveMimeType, sniffFile } from '../mime.js';

const bytes = (...parts) => Buffer.concat(parts.map((part) => (typeof part === 'string' ? Buffer.from(part, 'latin1') : Buffer.from(part))));
const ftyp = (brand) => bytes([0, 0, 0, 0x18], 'ftyp', brand, [0, 0, 0, 0], 'isommp42');
const TMP_ROOT = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'mf-mime-'));

describe('mime.js', function () {
  after(function () {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  });

  describe('detectMimeType', function () {
    [
      ['png', bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]), 'image/png'],
      ['jpeg', bytes([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg'],
      ['gif87a', bytes('GIF87a'), 'image/gif'],
      ['gif89a', bytes('GIF89a'), 'image/gif'],
      ['webp', bytes('RIFF', [0x24, 0, 0, 0], 'WEBPVP8 '), 'image/webp'],
      ['bmp', bytes('BM', [0x36, 0, 0, 0], [0, 0, 0, 0], [0x36, 0, 0, 0]), 'image/bmp'],
      ['ico', bytes([0, 0, 1, 0, 1, 0]), 'image/x-icon'],
      ['tiff little-endian', bytes('II*', [0]), 'image/tiff'],
      ['tiff big-endian', bytes('MM', [0], '*'), 'image/tiff'],
      ['avif', ftyp('avif'), 'image/avif'],
      ['heic', ftyp('heic'), 'image/heic'],
      ['heif', ftyp('mif1'), 'image/heif'],
      ['pdf', bytes('%PDF-1.7\n'), 'application/pdf'],
      ['zip', bytes([0x50, 0x4b, 0x03, 0x04]), 'application/zip'],
      ['gzip', bytes([0x1f, 0x8b, 0x08]), 'application/gzip'],
      ['7z', bytes([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]), 'application/x-7z-compressed'],
      ['rar 4', bytes('Rar!', [0x1a, 0x07, 0x00]), 'application/vnd.rar'],
      ['rar 5', bytes('Rar!', [0x1a, 0x07, 0x01, 0x00]), 'application/vnd.rar'],
      ['cfb', bytes([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), 'application/x-cfb'],
      ['mp4', ftyp('isom'), 'video/mp4'],
      ['m4a', ftyp('M4A '), 'audio/mp4'],
      ['mov', ftyp('qt  '), 'video/quicktime'],
      ['webm', bytes([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x82, 0x84], 'webm'), 'video/webm'],
      ['mkv', bytes([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x82, 0x88], 'matroska'), 'video/x-matroska'],
      ['mp3 with ID3', bytes('ID3', [0x04, 0, 0, 0, 0, 0, 0]), 'audio/mpeg'],
      ['mp3 frame', bytes([0xff, 0xfb, 0x90, 0x64]), 'audio/mpeg'],
      ['wav', bytes('RIFF', [0x24, 0, 0, 0], 'WAVEfmt '), 'audio/wav'],
      ['ogg vorbis', bytes('OggS', new Array(24).fill(0), [0x01], 'vorbis'), 'audio/ogg'],
      ['ogg theora', bytes('OggS', new Array(24).fill(0), [0x80], 'theora'), 'video/ogg'],
      ['flac', bytes('fLaC', [0, 0, 0, 0x22]), 'audio/flac'],
      ['avi', bytes('RIFF', [0x24, 0, 0, 0], 'AVI LIST'), 'video/x-msvideo'],
      ['wasm', bytes([0x00, 0x61, 0x73, 0x6d, 0x01, 0, 0, 0]), 'application/wasm'],
      ['woff', bytes('wOFF', [0, 1, 0, 0]), 'font/woff'],
      ['woff2', bytes('wOF2', [0, 1, 0, 0]), 'font/woff2'],
    ].forEach(([name, input, expected]) => {
      it(`detects ${name}`, function () {
        expect(detectMimeType(input)).to.equal(expected);
        expect(detectMimeType(new Uint8Array(input))).to.equal(expected);
      });
    });

    it('returns null for text, AAC frames, unknown ftyp brands, and short input', function () {
      expect(detectMimeType(bytes('BMW is a car brand'))).to.equal(null);
      expect(detectMimeType(bytes([0xff, 0xf1, 0x50, 0x80]))).to.equal(null);
      expect(detectMimeType(ftyp('zzzz'))).to.equal(null);
      expect(detectMimeType(bytes([0x89]))).to.equal(null);
      expect(detectMimeType(Buffer.alloc(0))).to.equal(null);
      expect(detectMimeType('not bytes')).to.equal(null);
    });
  });

  describe('baseMimeType', function () {
    it('lowercases, drops parameters, and rejects invalid tokens', function () {
      expect(baseMimeType('Text/Markdown; charset=utf-8')).to.equal('text/markdown');
      expect(baseMimeType('text/plain\r\nX-Evil: 1')).to.equal('');
      expect(baseMimeType('nonsense')).to.equal('');
      expect(baseMimeType(undefined)).to.equal('');
    });
  });

  describe('isUtf8Text', function () {
    it('accepts UTF-8 without NUL and rejects the rest', function () {
      expect(isUtf8Text(Buffer.from('héllo ✓'), true)).to.equal(true);
      expect(isUtf8Text(bytes([0x41, 0x00, 0x42]), true)).to.equal(false);
      expect(isUtf8Text(bytes([0xc3, 0x28]), true)).to.equal(false);
      expect(isUtf8Text(Buffer.alloc(0), true)).to.equal(false);
    });

    it('accepts a multibyte character cut at the end of a partial read', function () {
      const cut = bytes('a'.repeat(10), [0xe2, 0x82]);
      expect(isUtf8Text(cut, false)).to.equal(true);
      expect(isUtf8Text(cut, true)).to.equal(false);
    });
  });

  describe('resolveMimeType', function () {
    const png = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const zip = bytes([0x50, 0x4b, 0x03, 0x04]);
    const cfb = bytes([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

    it('prefers the detected type over the client type', function () {
      expect(resolveMimeType(png, 'text/html')).to.equal('image/png');
      expect(resolveMimeType(zip, 'image/png')).to.equal('application/zip');
    });

    it('keeps a client type that refines a container', function () {
      expect(resolveMimeType(zip, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).to.equal('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(resolveMimeType(zip, 'application/vnd.oasis.opendocument.text')).to.equal('application/vnd.oasis.opendocument.text');
      expect(resolveMimeType(zip, 'application/epub+zip')).to.equal('application/epub+zip');
      expect(resolveMimeType(cfb, 'application/msword')).to.equal('application/msword');
      expect(resolveMimeType(cfb, 'application/vnd.ms-excel')).to.equal('application/vnd.ms-excel');
      expect(resolveMimeType(cfb, 'image/png')).to.equal('application/x-cfb');
      expect(resolveMimeType(ftyp('isom'), 'audio/mp4')).to.equal('audio/mp4');
    });

    it('stores text as text/plain unless the client said text/* or application/json', function () {
      expect(resolveMimeType(Buffer.from('<svg onload="alert(1)"/>'), 'image/svg+xml')).to.equal('text/plain');
      expect(resolveMimeType(Buffer.from('<html></html>'), 'image/png')).to.equal('text/plain');
      expect(resolveMimeType(Buffer.from('{"a":1}'), 'application/json')).to.equal('application/json');
      expect(resolveMimeType(Buffer.from('a,b\n'), 'text/csv')).to.equal('text/csv');
      expect(resolveMimeType(Buffer.from('# hi'), 'TEXT/Markdown; charset=utf-8')).to.equal('text/markdown');
      expect(resolveMimeType(Buffer.from('plain'), undefined)).to.equal('text/plain');
      expect(resolveMimeType(Buffer.from('plain'), 'text/plain\r\nX: y')).to.equal('text/plain');
    });

    it('stores other binary data and empty files as application/octet-stream', function () {
      expect(resolveMimeType(bytes([0x00, 0x01, 0x02, 0x03]), 'image/png')).to.equal('application/octet-stream');
      expect(resolveMimeType(Buffer.alloc(0), 'text/plain')).to.equal('application/octet-stream');
    });
  });

  describe('sniffFile', function () {
    it(`reads only the first ${SNIFF_BYTES} bytes`, async function () {
      const textPath = nodePath.join(TMP_ROOT, 'long.txt');
      // Binary after the sniffed window does not change the result
      fs.writeFileSync(textPath, Buffer.concat([Buffer.alloc(SNIFF_BYTES, 0x61), Buffer.from([0x00, 0xff])]));
      expect(await sniffFile(textPath, 'text/plain')).to.equal('text/plain');

      const pngPath = nodePath.join(TMP_ROOT, 'image.bin');
      fs.writeFileSync(pngPath, Buffer.concat([bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(10000)]));
      expect(await sniffFile(pngPath, 'application/octet-stream')).to.equal('image/png');
    });
  });
});
