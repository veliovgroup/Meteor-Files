import crypto from 'node:crypto';

/**
 * @const {number} MIN_SECRET_LENGTH - Shortest accepted `downloadTokenSecret`
 */
export const MIN_SECRET_LENGTH = 32;

/**
 * @const {number} MAX_TOKEN_LENGTH - Longer tokens are rejected before any work
 */
const MAX_TOKEN_LENGTH = 512;

/**
 * @private
 * @summary HMAC-SHA256 over `${collectionName}\n${_id}\n${version}\n${userId}\n${exp}`
 * @returns {Buffer}
 */
const sign = (secret, collectionName, _id, version, userId, exp) => crypto
  .createHmac('sha256', secret)
  .update(`${collectionName}\n${_id}\n${version}\n${userId}\n${exp}`)
  .digest();

/**
 * @function createDownloadToken
 * @param {string} secret - `downloadTokenSecret`
 * @param {Object} opts
 * @param {string} opts.collectionName - Collection the token opens
 * @param {string} opts._id - File `_id`
 * @param {string} [opts.version='original'] - File version
 * @param {string|null} [opts.userId=null] - User the request acts as
 * @param {number} opts.exp - Expiry, Unix time in seconds
 * @summary Returns `<exp>.<base64url userId>.<base64url HMAC>`
 * @returns {string}
 */
export const createDownloadToken = (secret, { collectionName, _id, version = 'original', userId = null, exp }) => {
  const uid = userId ?? '';
  return `${exp}.${Buffer.from(uid, 'utf8').toString('base64url')}.${sign(secret, collectionName, _id, version, uid, exp).toString('base64url')}`;
};

/**
 * @function verifyDownloadToken
 * @param {string} secret - `downloadTokenSecret`
 * @param {*} token - Value of the `token` query parameter
 * @param {Object} target
 * @param {string} target.collectionName - Collection that serves the request
 * @param {string} target._id - Requested file `_id`
 * @param {string} target.version - Requested version
 * @param {number} [target.now=Date.now()] - Current time in milliseconds
 * @summary Checks format, expiry, and HMAC with `timingSafeEqual`
 * @returns {{userId: string|null, exp: number}|null} `null` for any invalid token
 */
export const verifyDownloadToken = (secret, token, { collectionName, _id, version, now = Date.now() }) => {
  if (typeof token !== 'string' || token.length > MAX_TOKEN_LENGTH) {
    return null;
  }

  const parts = token.split('.');
  // Canonical form only: no leading zeros, an unpadded 43-character signature
  if (parts.length !== 3 || !/^[1-9]\d{0,11}$/.test(parts[0]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[2])) {
    return null;
  }

  const exp = Number(parts[0]);
  if (exp * 1000 <= now) {
    return null;
  }

  const userId = Buffer.from(parts[1], 'base64url').toString('utf8');
  if (Buffer.from(userId, 'utf8').toString('base64url') !== parts[1]) {
    return null;
  }

  const expected = sign(secret, collectionName, _id, version, userId, exp);
  const given = Buffer.from(parts[2], 'base64url');
  // The last character has 2 unused bits, reject signatures that set them
  if (given.toString('base64url') !== parts[2]) {
    return null;
  }
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return null;
  }
  return { userId: userId || null, exp };
};
