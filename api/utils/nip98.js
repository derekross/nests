const { verifyEvent, nip19 } = require('nostr-tools');
const crypto = require('crypto');

/**
 * Validates NIP-98 HTTP authentication
 * @param {string} token - Base64 encoded Nostr event
 * @param {string} method - HTTP method
 * @param {string} url - Request URL
 * @returns {Promise<boolean>} - Whether the auth is valid
 */
async function validateNip98Auth(token, method, url) {
  try {
    // Decode the base64 token
    const eventJson = Buffer.from(token, 'base64').toString('utf-8');
    const event = JSON.parse(eventJson);

    // Validate event structure
    if (event.kind !== 27235) {
      return false;
    }

    // Check if event is not too old (within 1 minute)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - event.created_at) > 60) {
      return false;
    }

    // Validate required tags
    const methodTag = event.tags.find(tag => tag[0] === 'method');
    const urlTag = event.tags.find(tag => tag[0] === 'u');

    if (!methodTag || !urlTag) {
      return false;
    }

    // Check method and URL match
    if (methodTag[1] !== method.toUpperCase()) {
      return false;
    }

    // For URL validation, we'll be flexible with the domain
    // since the frontend might be on a different domain than the API
    const requestPath = new URL(url, 'http://localhost').pathname;
    const authPath = new URL(urlTag[1]).pathname;
    
    if (requestPath !== authPath) {
      return false;
    }

    // Verify the event signature
    const isValid = verifyEvent(event);
    return isValid;

  } catch (error) {
    console.error('NIP-98 validation error:', error);
    return false;
  }
}

/**
 * Extracts pubkey from NIP-98 auth token
 * @param {string} token - Base64 encoded Nostr event
 * @returns {string} - Hex pubkey
 */
function extractPubkeyFromAuth(token) {
  try {
    const eventJson = Buffer.from(token, 'base64').toString('utf-8');
    const event = JSON.parse(eventJson);
    return event.pubkey;
  } catch (error) {
    throw new Error('Invalid auth token');
  }
}

/**
 * Creates a challenge for NIP-98 authentication
 * @returns {string} - Random challenge string
 */
function createAuthChallenge() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validates a pubkey format
 * @param {string} pubkey - Hex pubkey to validate
 * @returns {boolean} - Whether the pubkey is valid
 */
function isValidPubkey(pubkey) {
  return /^[0-9a-f]{64}$/i.test(pubkey);
}

/**
 * Converts hex pubkey to npub
 * @param {string} pubkey - Hex pubkey
 * @returns {string} - npub encoded pubkey
 */
function pubkeyToNpub(pubkey) {
  try {
    return nip19.npubEncode(pubkey);
  } catch (error) {
    throw new Error('Invalid pubkey');
  }
}

/**
 * Converts npub to hex pubkey
 * @param {string} npub - npub encoded pubkey
 * @returns {string} - Hex pubkey
 */
function npubToPubkey(npub) {
  try {
    const { type, data } = nip19.decode(npub);
    if (type !== 'npub') {
      throw new Error('Not an npub');
    }
    return data;
  } catch (error) {
    throw new Error('Invalid npub');
  }
}

module.exports = {
  validateNip98Auth,
  extractPubkeyFromAuth,
  createAuthChallenge,
  isValidPubkey,
  pubkeyToNpub,
  npubToPubkey,
};