const Joi = require('joi');

/**
 * Validation schema for creating a new nest
 */
const createNestSchema = Joi.object({
  relays: Joi.array()
    .items(Joi.string().uri({ scheme: ['ws', 'wss'] }))
    .min(1)
    .max(10)
    .required()
    .messages({
      'array.min': 'At least one relay is required',
      'array.max': 'Maximum 10 relays allowed',
      'string.uri': 'Relays must be valid WebSocket URLs',
    }),
  
  hls_stream: Joi.boolean()
    .default(false)
    .messages({
      'boolean.base': 'hls_stream must be a boolean',
    }),
});

/**
 * Validation schema for updating permissions
 */
const permissionsSchema = Joi.object({
  participant: Joi.string()
    .pattern(/^[0-9a-f]{64}$/i)
    .required()
    .messages({
      'string.pattern.base': 'Participant must be a valid hex pubkey',
      'any.required': 'Participant pubkey is required',
    }),
  
  can_publish: Joi.boolean()
    .messages({
      'boolean.base': 'can_publish must be a boolean',
    }),
  
  mute_microphone: Joi.boolean()
    .messages({
      'boolean.base': 'mute_microphone must be a boolean',
    }),
  
  is_admin: Joi.boolean()
    .messages({
      'boolean.base': 'is_admin must be a boolean',
    }),
}).min(1).messages({
  'object.min': 'At least one permission field must be provided',
});

/**
 * Validation schema for room ID parameter
 */
const roomIdSchema = Joi.string()
  .uuid({ version: 'uuidv4' })
  .required()
  .messages({
    'string.guid': 'Room ID must be a valid UUID',
    'any.required': 'Room ID is required',
  });

/**
 * Validates create nest request body
 * @param {object} data - Request body to validate
 * @returns {object} - Joi validation result
 */
function validateCreateNestRequest(data) {
  return createNestSchema.validate(data, { abortEarly: false });
}

/**
 * Validates permissions update request body
 * @param {object} data - Request body to validate
 * @returns {object} - Joi validation result
 */
function validatePermissionsRequest(data) {
  return permissionsSchema.validate(data, { abortEarly: false });
}

/**
 * Validates room ID parameter
 * @param {string} roomId - Room ID to validate
 * @returns {object} - Joi validation result
 */
function validateRoomId(roomId) {
  return roomIdSchema.validate(roomId);
}

/**
 * Validates WebSocket URL
 * @param {string} url - URL to validate
 * @returns {boolean} - Whether the URL is valid
 */
function isValidWebSocketUrl(url) {
  try {
    const parsed = new URL(url);
    return ['ws:', 'wss:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Validates hex string
 * @param {string} hex - Hex string to validate
 * @param {number} length - Expected length in characters
 * @returns {boolean} - Whether the hex string is valid
 */
function isValidHex(hex, length = 64) {
  const pattern = new RegExp(`^[0-9a-f]{${length}}$`, 'i');
  return pattern.test(hex);
}

/**
 * Sanitizes string input
 * @param {string} input - Input to sanitize
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} - Sanitized string
 */
function sanitizeString(input, maxLength = 1000) {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, ''); // Remove potential HTML tags
}

/**
 * Validates array of relay URLs
 * @param {array} relays - Array of relay URLs
 * @returns {object} - Validation result
 */
function validateRelays(relays) {
  if (!Array.isArray(relays)) {
    return { error: 'Relays must be an array' };
  }
  
  if (relays.length === 0) {
    return { error: 'At least one relay is required' };
  }
  
  if (relays.length > 10) {
    return { error: 'Maximum 10 relays allowed' };
  }
  
  for (const relay of relays) {
    if (!isValidWebSocketUrl(relay)) {
      return { error: `Invalid relay URL: ${relay}` };
    }
  }
  
  return { valid: true };
}

/**
 * Rate limiting validation
 * @param {string} identifier - User identifier (IP or pubkey)
 * @param {string} action - Action being performed
 * @param {object} limits - Rate limit configuration
 * @returns {boolean} - Whether the action is allowed
 */
function checkRateLimit(identifier, action, limits = {}) {
  // This would typically use Redis or in-memory store
  // For now, we'll implement basic validation
  
  const defaultLimits = {
    createNest: { count: 5, window: 3600 }, // 5 nests per hour
    joinNest: { count: 50, window: 3600 },  // 50 joins per hour
    updatePermissions: { count: 100, window: 3600 }, // 100 updates per hour
  };
  
  const limit = limits[action] || defaultLimits[action];
  if (!limit) {
    return true; // No limit defined
  }
  
  // TODO: Implement actual rate limiting with Redis
  return true;
}

module.exports = {
  validateCreateNestRequest,
  validatePermissionsRequest,
  validateRoomId,
  isValidWebSocketUrl,
  isValidHex,
  sanitizeString,
  validateRelays,
  checkRateLimit,
};