
/**
 * Configuration for API client
 * 
 * This page exports a configuration object for the API client.
 * 
 * Usage:
 * 
 * const config = {
 *   encryption: {
 *     enabled: false, // Disabled: backend has enable_encrypted_payload=False
 *     secret: "mcMAmuM2wLgNey7hgaCXDsaH__h13R2esSQ7fKvX3ak=", // Move to env vars in production
 *     doubleEncode: false // Set to true if backend expects double base64 encoding
 *   },
 *   api: {
 *     baseUrl: "http://localhost:5200"
 *   }
 * };
 * 
 * @param {Object} config - The configuration object.
 * @param {Object} config.encryption - The encryption configuration.
 * @param {boolean} config.encryption.enabled - Whether encryption is enabled.
 * @param {string} config.encryption.secret - The encryption secret.
 * @param {boolean} config.encryption.doubleEncode - Whether double encoding is enabled.
 * @param {Object} config.api - The API configuration.
 * @param {string} config.api.baseUrl - The API base URL.
 */

export const config = {
  encryption: {
    enabled: false, // Disabled: backend has enable_encrypted_payload=False
    secret: "mcMAmuM2wLgNey7hgaCXDsaH__h13R2esSQ7fKvX3ak=", // Move to env vars in production
    doubleEncode: false // Set to true if backend expects double base64 encoding
  },
  api: {
    baseUrl: ""
  }
};