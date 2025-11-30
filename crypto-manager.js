const WorkerPool = require('./worker-pool');
const path = require('path');

/**
 * Crypto Manager
 * Provides simple API for encryption/decryption using worker thread pool
 * Automatically manages pool lifecycle
 */
class CryptoManager {
  constructor(maxThreads = null) {
    this.pool = new WorkerPool(path.resolve(__dirname, 'crypto-worker.js'), maxThreads);
  }

  /**
   * Decrypt data using AES-256-GCM in a worker thread
   * @param {string} ciphertext - Base64 encoded ciphertext
   * @param {string} key - Base64 encoded 32-byte key
   * @param {string} iv - Base64 encoded 12-byte IV
   * @param {string} authTag - Base64 encoded auth tag
   * @returns {Promise<string>} - Decrypted plaintext
   */
  async decrypt(ciphertext, key, iv, authTag) {
    const result = await this.pool.runTask({
      operation: 'decrypt',
      ciphertext,
      key,
      iv,
      authTag,
    });

    if (!result.success) {
      throw new Error(`Decryption failed: ${result.error}`);
    }

    return result.plaintext;
  }

  /**
   * Encrypt data using AES-256-GCM in a worker thread
   * @param {string} plaintext - Text to encrypt
   * @param {string} key - Base64 encoded 32-byte key
   * @param {string} iv - Base64 encoded 12-byte IV
   * @returns {Promise<object>} - { ciphertext, authTag } (both base64)
   */
  async encrypt(plaintext, key, iv) {
    const result = await this.pool.runTask({
      operation: 'encrypt',
      plaintext,
      key,
      iv,
    });

    if (!result.success) {
      throw new Error(`Encryption failed: ${result.error}`);
    }

    return {
      ciphertext: result.ciphertext,
      authTag: result.authTag,
    };
  }

  /**
   * Create RSA signature in a worker thread
   * @param {string} payload - Data to sign
   * @param {string} privateKeyPem - PEM-encoded private key
   * @param {string} algorithm - Hash algorithm (default: 'sha256')
   * @returns {Promise<string>} - Base64 encoded signature
   */
  async sign(payload, privateKeyPem, algorithm = 'sha256') {
    const result = await this.pool.runTask({
      operation: 'sign',
      payload,
      privateKeyPem,
      algorithm,
    });

    if (!result.success) {
      throw new Error(`Signing failed: ${result.error}`);
    }

    return result.signature;
  }

  /**
   * Verify RSA signature in a worker thread
   * @param {string} payload - Data that was signed
   * @param {string} signature - Base64 encoded signature
   * @param {string} publicKeyPem - PEM-encoded public key
   * @param {string} algorithm - Hash algorithm (default: 'sha256')
   * @returns {Promise<boolean>} - True if signature is valid
   */
  async verify(payload, signature, publicKeyPem, algorithm = 'sha256') {
    const result = await this.pool.runTask({
      operation: 'verify',
      payload,
      signature,
      publicKeyPem,
      algorithm,
    });

    if (!result.success) {
      throw new Error(`Verification failed: ${result.error}`);
    }

    return result.isValid;
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return this.pool.getStats();
  }

  /**
   * Shutdown the pool gracefully
   */
  async shutdown() {
    return this.pool.shutdown();
  }
}

module.exports = CryptoManager;
