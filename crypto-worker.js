const { parentPort } = require('worker_threads');
const crypto = require('crypto');

/**
 * Worker thread for crypto operations
 * Handles: AES encryption, AES decryption, RSA signing, RSA verification
 */

// Task handlers
const handlers = {
  /**
   * AES-256-GCM decryption
   * Input: { ciphertext, key, iv, authTag }
   * Output: { plaintext }
   */
  decrypt: (data) => {
    try {
      const { ciphertext, key, iv, authTag } = data;
      
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        Buffer.from(key, 'base64'),
        Buffer.from(iv, 'base64')
      );
      
      decipher.setAuthTag(Buffer.from(authTag, 'base64'));
      
      let plaintext = decipher.update(Buffer.from(ciphertext, 'base64'), 'binary', 'utf8');
      plaintext += decipher.final('utf8');
      
      return { success: true, plaintext };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * AES-256-GCM encryption
   * Input: { plaintext, key, iv }
   * Output: { ciphertext, authTag }
   */
  encrypt: (data) => {
    try {
      const { plaintext, key, iv } = data;
      
      const cipher = crypto.createCipheriv(
        'aes-256-gcm',
        Buffer.from(key, 'base64'),
        Buffer.from(iv, 'base64')
      );
      
      let ciphertext = cipher.update(plaintext, 'utf8', 'binary');
      ciphertext += cipher.final('binary');
      const authTag = cipher.getAuthTag();
      
      return {
        success: true,
        ciphertext: Buffer.from(ciphertext, 'binary').toString('base64'),
        authTag: authTag.toString('base64'),
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * RSA signature creation
   * Input: { data, privateKeyPem }
   * Output: { signature }
   */
  sign: (data) => {
    try {
      const { payload, privateKeyPem, algorithm = 'sha256' } = data;
      
      const sign = crypto.createSign(algorithm);
      sign.update(payload);
      sign.end();
      
      const signature = sign.sign(privateKeyPem);
      
      return { success: true, signature: signature.toString('base64') };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * RSA signature verification
   * Input: { data, signature, publicKeyPem }
   * Output: { isValid }
   */
  verify: (data) => {
    try {
      const { payload, signature, publicKeyPem, algorithm = 'sha256' } = data;
      
      const verify = crypto.createVerify(algorithm);
      verify.update(payload);
      verify.end();
      
      const isValid = verify.verify(publicKeyPem, Buffer.from(signature, 'base64'));
      
      return { success: true, isValid };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

/**
 * Message handler
 * Expects: { operation, ...operationData }
 * Responds with: { success, ...result } or { success: false, error }
 */
parentPort.on('message', (task) => {
  const { operation, ...operationData } = task;

  if (!handlers[operation]) {
    parentPort.postMessage({
      success: false,
      error: `Unknown operation: ${operation}`,
    });
    return;
  }

  const result = handlers[operation](operationData);
  parentPort.postMessage(result);
});
