import * as Fernet from "@crmackey/fernet";

import { config } from "./excrypt.config";

/**
 * Fernet encryption/decryption functions for encrypting/decrypting JSON payloads
 * 
 * This page exports two functions: `encryptPayload` and `decryptPayload`.
 * 
 * Usage:
 * 
 * const encryptedData = encryptPayload(payload);
 * const decryptedData = decryptPayload(encryptedData);
 * 
 * @param {any} payload - The data to encrypt/decrypt.
 * @returns {string} - The encrypted/decrypted data.
 */


export function encryptPayload(payload) {
    // If encryption is disabled, return payload as-is
    if (!config.encryption.enabled) {
      return JSON.stringify(payload);
    }
  
    try {
      // For @crmackey/fernet
      const secret = new Fernet.Secret(config.encryption.secret);
      const token = new Fernet.Token({
        secret: secret,
        time: Date.now().toString(),
        iv: undefined, // Let it generate one internally
      });
      
      const json = JSON.stringify(payload);
      
      // Generate Fernet token (already Base64)
      const encrypted = token.encode(json);
      
      // Always convert to base64 after encryption
      const base64Encrypted = btoa(encrypted);
      
      // Optional: If backend expects additional double base64 encoding
      if (config.encryption.doubleEncode) {
        return btoa(base64Encrypted);
      }
      
      return base64Encrypted;
    } catch (error) {
      console.error("Encryption error:", error);
      throw new Error("Failed to encrypt payload: " + error.message);
    }
  }
  
  export function decryptPayload(encryptedData) {
    // If encryption is disabled, parse as JSON directly
    if (!config.encryption.enabled) {
      return JSON.parse(encryptedData);
    }
  
    try {
      // For @crmackey/fernet
      const secret = new Fernet.Secret(config.encryption.secret);
      
      // Handle double encoding if enabled (decode twice)
      let dataToProcess = encryptedData;
      if (config.encryption.doubleEncode) {
        dataToProcess = atob(dataToProcess);
      }
      
      // Always decode from base64 before decryption
      const fernetToken = atob(dataToProcess);
      
      const token = new Fernet.Token({
        secret: secret,
        token: fernetToken,
      });
      
      const decrypted = token.decode();
      return JSON.parse(decrypted);
    } catch (error) {
      console.error("Decryption error:", error);
      throw new Error("Failed to decrypt payload: " + error.message);
    }
  }