import fs from 'node:fs';

/**
 * @const {number} SNIFF_BYTES - Bytes read from the start of a file to detect its type
 */
export const SNIFF_BYTES = 4100;

/**
 * @const {RegExp} MIME_RE - A lowercase `type/subtype` made of RFC 6838 token characters
 */
const MIME_RE = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/;

/**
 * @const {Object<string, string>} FTYP_BRANDS - ISO base media `ftyp` major brands
 */
const FTYP_BRANDS = {
  avif: 'image/avif',
  avis: 'image/avif',
  heic: 'image/heic',
  heix: 'image/heic',
  heim: 'image/heic',
  heis: 'image/heic',
  hevc: 'image/heic',
  hevx: 'image/heic',
  mif1: 'image/heif',
  msf1: 'image/heif',
  'M4A ': 'audio/mp4',
  'M4B ': 'audio/mp4',
  'F4A ': 'audio/mp4',
  'qt  ': 'video/quicktime',
  isom: 'video/mp4',
  iso2: 'video/mp4',
  iso4: 'video/mp4',
  iso5: 'video/mp4',
  iso6: 'video/mp4',
  mp41: 'video/mp4',
  mp42: 'video/mp4',
  avc1: 'video/mp4',
  dash: 'video/mp4',
  mmp4: 'video/mp4',
  'M4V ': 'video/mp4',
  M4VH: 'video/mp4',
  M4VP: 'video/mp4',
  'f4v ': 'video/mp4',
  'F4V ': 'video/mp4',
};

/**
 * @const {Object<string, RegExp>} REFINEMENTS - Client types that name a specific format inside a detected container
 */
const REFINEMENTS = {
  'application/zip': /^application\/(?:vnd\.openxmlformats-officedocument\.[a-z0-9.+-]+|vnd\.oasis\.opendocument\.[a-z0-9.+-]+|epub\+zip|java-archive|vnd\.android\.package-archive)$/,
  'application/x-cfb': /^application\/(?:msword|vnd\.ms-[a-z0-9.+-]+|vnd\.visio)$/,
  'video/mp4': /^(?:audio\/mp4|audio\/x-m4a|video\/x-m4v)$/,
};

/**
 * @const {Set<string>} TEXT_TYPES - Client types kept for UTF-8 text. Active types such as `text/html`, `text/xml`, `text/css`, and `text/javascript` are not listed
 */
const TEXT_TYPES = new Set(['text/plain', 'text/csv', 'text/markdown', 'text/tab-separated-values', 'text/calendar', 'text/vtt', 'application/json']);

/**
 * @private
 * @summary Accepts a Buffer or any typed array view, returns a Buffer over the same memory, or `null`
 */
const toBuffer = (input) => {
  if (Buffer.isBuffer(input)) {
    return input;
  }
  if (ArrayBuffer.isView(input)) {
    return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  }
  return null;
};

const hasBytes = (buf, offset, list) => {
  if (buf.length < offset + list.length) {
    return false;
  }
  for (let i = 0; i < list.length; i++) {
    if (buf[offset + i] !== list[i]) {
      return false;
    }
  }
  return true;
};

const hasText = (buf, offset, text) => hasBytes(buf, offset, Array.from(text, (char) => char.charCodeAt(0)));

/**
 * @private
 * @summary MPEG audio frame header: sync bits set, version and layer not reserved (layer `00` is AAC ADTS), valid bitrate and sample rate
 */
const isMpegAudioFrame = (buf) => buf.length >= 4
  && buf[0] === 0xff
  && (buf[1] & 0xe0) === 0xe0
  && ((buf[1] >> 3) & 0x03) !== 0x01
  && ((buf[1] >> 1) & 0x03) !== 0x00
  && (buf[2] >> 4) !== 0x0f
  && ((buf[2] >> 2) & 0x03) !== 0x03;

/**
 * @function detectMimeType
 * @param {Buffer|Uint8Array} input - First bytes of a file
 * @summary Match the built-in signature table
 * @returns {string|null} Detected type, or `null` when no signature matches
 */
export const detectMimeType = (input) => {
  const buf = toBuffer(input);
  if (!buf || buf.length < 2) {
    return null;
  }

  if (hasBytes(buf, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }
  if (hasBytes(buf, 0, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
  }
  if (hasText(buf, 0, 'GIF87a') || hasText(buf, 0, 'GIF89a')) {
    return 'image/gif';
  }
  if (hasText(buf, 0, 'RIFF')) {
    if (hasText(buf, 8, 'WEBP')) {
      return 'image/webp';
    }
    if (hasText(buf, 8, 'WAVE')) {
      return 'audio/wav';
    }
    if (hasText(buf, 8, 'AVI ')) {
      return 'video/x-msvideo';
    }
  }
  if (hasText(buf, 0, 'BM') && hasBytes(buf, 6, [0, 0, 0, 0])) {
    return 'image/bmp';
  }
  if (hasBytes(buf, 0, [0x00, 0x00, 0x01, 0x00]) && buf.length >= 6 && (buf[4] | (buf[5] << 8)) > 0) {
    return 'image/x-icon';
  }
  if (hasBytes(buf, 0, [0x49, 0x49, 0x2a, 0x00]) || hasBytes(buf, 0, [0x4d, 0x4d, 0x00, 0x2a])) {
    return 'image/tiff';
  }
  if (buf.length >= 12 && hasText(buf, 4, 'ftyp')) {
    return FTYP_BRANDS[buf.toString('latin1', 8, 12)] || null;
  }
  if (hasText(buf, 0, '%PDF-')) {
    return 'application/pdf';
  }
  if (hasBytes(buf, 0, [0x50, 0x4b]) && (hasBytes(buf, 2, [0x03, 0x04]) || hasBytes(buf, 2, [0x05, 0x06]) || hasBytes(buf, 2, [0x07, 0x08]))) {
    return 'application/zip';
  }
  if (hasBytes(buf, 0, [0x1f, 0x8b, 0x08])) {
    return 'application/gzip';
  }
  if (hasBytes(buf, 0, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) {
    return 'application/x-7z-compressed';
  }
  if (hasText(buf, 0, 'Rar!') && hasBytes(buf, 4, [0x1a, 0x07]) && (buf[6] === 0x00 || (buf[6] === 0x01 && buf[7] === 0x00))) {
    return 'application/vnd.rar';
  }
  if (hasBytes(buf, 0, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    return 'application/x-cfb';
  }
  if (hasBytes(buf, 0, [0x1a, 0x45, 0xdf, 0xa3])) {
    // The EBML DocType sits in the first bytes of the header
    return buf.toString('latin1', 0, Math.min(buf.length, 64)).includes('webm') ? 'video/webm' : 'video/x-matroska';
  }
  if (hasText(buf, 0, 'ID3') || isMpegAudioFrame(buf)) {
    return 'audio/mpeg';
  }
  if (hasText(buf, 0, 'OggS')) {
    return buf.toString('latin1').includes('\x80theora') ? 'video/ogg' : 'audio/ogg';
  }
  if (hasText(buf, 0, 'fLaC')) {
    return 'audio/flac';
  }
  if (hasBytes(buf, 0, [0x00, 0x61, 0x73, 0x6d])) {
    return 'application/wasm';
  }
  if (hasText(buf, 0, 'wOFF')) {
    return 'font/woff';
  }
  if (hasText(buf, 0, 'wOF2')) {
    return 'font/woff2';
  }
  return null;
};

/**
 * @function baseMimeType
 * @param {*} type - Mime type, possibly with parameters
 * @summary Lowercase `type/subtype` without parameters, or an empty string when it is not a valid token
 * @returns {string}
 */
export const baseMimeType = (type) => {
  if (typeof type !== 'string') {
    return '';
  }
  const base = type.split(';')[0].trim().toLowerCase();
  return MIME_RE.test(base) ? base : '';
};

/**
 * @function isUtf8Text
 * @param {Buffer|Uint8Array} input - First bytes of a file
 * @param {boolean} isComplete - `false` when `input` is a prefix of a longer file, so a multibyte character cut at the end is allowed
 * @summary Valid UTF-8 without NUL bytes. Empty input is not text
 * @returns {boolean}
 */
export const isUtf8Text = (input, isComplete) => {
  const buf = toBuffer(input);
  if (!buf || !buf.length || buf.includes(0)) {
    return false;
  }

  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buf, { stream: !isComplete });
    return true;
  } catch (_decodeError) {
    return false;
  }
};

/**
 * @function resolveMimeType
 * @param {Buffer|Uint8Array} input - First bytes of a file, up to `SNIFF_BYTES`
 * @param {string} [clientType] - Type the uploader sent, not trusted
 * @param {boolean} [isComplete=true] - `false` when `input` is a prefix of a longer file
 * @summary Type to store: a detected signature (refined by the client type for known containers), `text/plain` or an allowlisted client type (`text/plain`, `text/csv`, `text/markdown`, `text/tab-separated-values`, `text/calendar`, `text/vtt`, `application/json`) for UTF-8 text, otherwise `application/octet-stream`
 * @returns {string}
 */
export const resolveMimeType = (input, clientType, isComplete = true) => {
  const client = baseMimeType(clientType);
  const detected = detectMimeType(input);
  if (detected) {
    return (REFINEMENTS[detected] && !client.endsWith('+xml') && REFINEMENTS[detected].test(client)) ? client : detected;
  }

  if (isUtf8Text(input, isComplete)) {
    return TEXT_TYPES.has(client) ? client : 'text/plain';
  }
  return 'application/octet-stream';
};

/**
 * @function sniffFile
 * @param {string} path - File on disk
 * @param {string} [clientType] - Type the uploader sent, not trusted
 * @summary Read the first `SNIFF_BYTES` bytes of `path` and resolve its type
 * @returns {Promise<string>}
 */
export const sniffFile = async (path, clientType) => {
  const fh = await fs.promises.open(path, 'r');
  try {
    const buf = Buffer.alloc(SNIFF_BYTES);
    const { bytesRead } = await fh.read(buf, 0, SNIFF_BYTES, 0);
    const { size } = await fh.stat();
    return resolveMimeType(buf.subarray(0, bytesRead), clientType, size <= bytesRead);
  } finally {
    await fh.close();
  }
};
