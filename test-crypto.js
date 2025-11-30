const crypto = require('crypto');
const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

// Generate test keys
const key = crypto.randomBytes(32).toString('base64');
const iv = crypto.randomBytes(12).toString('base64');
const plaintext = 'Hello, this is a test message with large JSON data! ' + 'x'.repeat(1000);

(async () => {
  try {
    console.log('Testing encryption...');
    const encryptRes = await axios.post(`${BASE_URL}/encrypt`, {
      plaintext,
      key,
      iv
    });
    console.log('✓ Encryption successful');
    console.log('  Ciphertext length:', encryptRes.data.ciphertext.length);
    console.log('  Pool stats:', encryptRes.data.poolStats);

    const { ciphertext, authTag } = encryptRes.data;

    console.log('\nTesting decryption...');
    const decryptRes = await axios.post(`${BASE_URL}/decrypt`, {
      ciphertext,
      key,
      iv,
      authTag
    });
    console.log('✓ Decryption successful');
    console.log('  Decrypted matches original:', decryptRes.data.plaintext === plaintext);
    console.log('  Pool stats:', decryptRes.data.poolStats);

    console.log('\n✅ All crypto operations working with worker threads!');
  } catch (err) {
    console.error('❌ Error:', err.response?.data || err.message);
  }
})();
