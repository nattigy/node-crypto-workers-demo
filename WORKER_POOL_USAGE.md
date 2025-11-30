// USAGE GUIDE: Worker Thread Pool for Encryption/Decryption

/**
 * OPTION 1: Global Instance (Recommended)
 * Create one CryptoManager at app startup, reuse for all requests
 */

// app.js
const CryptoManager = require('./crypto-manager');
const cryptoManager = new CryptoManager(); // Auto-sized to CPU cores - 1

// In any request handler
app.post('/api/decrypt-data', async (req, res) => {
  const { encryptedPayload, key, iv, authTag } = req.body;
  
  try {
    // This offloads to worker thread (non-blocking)
    const plaintext = await cryptoManager.decrypt(encryptedPayload, key, iv, authTag);
    
    // Parse huge JSON without blocking event loop
    const data = JSON.parse(plaintext);
    
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/**
 * OPTION 2: Separate Crypto Module
 * If you have a dedicated crypto functions file
 */

// crypto.js (your existing crypto utilities)
const CryptoManager = require('./crypto-manager');

class CryptoUtils {
  constructor() {
    this.manager = new CryptoManager();
  }

  async decryptResponse(encryptedData, key, iv, authTag) {
    // Your decryption logic now uses workers
    return this.manager.decrypt(encryptedData, key, iv, authTag);
  }

  async encryptPayload(plaintext, key, iv) {
    return this.manager.encrypt(plaintext, key, iv);
  }

  async signData(payload, privateKey) {
    return this.manager.sign(payload, privateKey);
  }

  getPoolStats() {
    return this.manager.getStats();
  }
}

module.exports = new CryptoUtils();

// Usage in handlers
const crypto = require('./crypto');

app.post('/api/fetch', async (req, res) => {
  const encryptedResponse = await fetchFromThirdParty();
  
  // Decrypt in worker (non-blocking main thread)
  const plaintext = await crypto.decryptResponse(
    encryptedResponse.data,
    process.env.DECRYPT_KEY,
    encryptedResponse.iv,
    encryptedResponse.tag
  );

  const responseData = JSON.parse(plaintext);
  res.json(responseData);
});


/**
 * OPTION 3: Monitor Pool Performance
 */

// Health check endpoint
app.get('/pool/stats', (req, res) => {
  res.json({
    poolHealth: cryptoManager.getStats(),
    timestamp: new Date().toISOString()
  });
});

// Example response:
// {
//   "poolHealth": {
//     "totalWorkers": 9,        // 10 cores - 1
//     "activeWorkers": 3,       // Currently decrypting
//     "idleWorkers": 6,         // Waiting for tasks
//     "queuedTasks": 12         // Backlog when all busy
//   },
//   "timestamp": "2025-11-30T..."
// }


/**
 * ARCHITECTURE: How Work Flows
 */

// Scenario: 15 concurrent decryption requests, 10-core machine
// Pool size = 10 - 1 = 9 workers

Timeline:
  t=0ms  Request 1-9  → Workers 1-9 start decryption
  t=0ms  Request 10-15 → Queue (all workers busy)

  t=400ms Request 1 completes → Worker 1 free → Request 10 starts
  t=400ms Request 2 completes → Worker 2 free → Request 11 starts

Result:
- Main thread (event loop) stays responsive
- Requests process in parallel on 9 cores
- No blocking of other APIs or cron jobs
- CPU fully utilized, but not oversubscribed


/**
 * KEY FEATURES OF CUSTOM POOL
 */

1. CPU-AWARE SIZING
   - Automatically uses os.cpus().length - 1
   - Reserves 1 core for event loop
   - Prevents oversubscription

2. BOUNDED POOL
   - Fixed number of workers (can't create unlimited)
   - Protects against memory exhaustion
   - Predictable resource usage

3. TASK QUEUING
   - FIFO queue when all workers busy
   - Backpressure: queue length visible via getStats()
   - Can implement request rejection if queue too large

4. TIMEOUT PROTECTION
   - 5 second timeout per task
   - Prevents hung workers from blocking forever
   - Automatic cleanup and restart

5. OBSERVABLE
   - getStats() shows real-time utilization
   - Can monitor queue depth, active workers
   - Build dashboards/alerts on these metrics

6. GRACEFUL SHUTDOWN
   - cryptoManager.shutdown() on app close
   - Terminates all workers cleanly
   - No orphaned processes


/**
 * INTEGRATION WITH YOUR 3 APIs
 */

// API 1: Fetch encrypted data, decrypt in worker
app.post('/api/fetch-decrypt-1', async (req, res) => {
  const third_party_response = await externalApiCall();
  const plaintext = await cryptoManager.decrypt(
    third_party_response.encrypted_data,
    third_party_response.key,
    third_party_response.iv,
    third_party_response.auth_tag
  );
  const parsedData = JSON.parse(plaintext);
  res.json(parsedData);
});

// API 2: Same pattern
app.post('/api/fetch-decrypt-2', async (req, res) => {
  // ... similar
});

// API 3: Same pattern
app.post('/api/fetch-decrypt-3', async (req, res) => {
  // ... similar
});


/**
 * PERFORMANCE TESTING
 */

// Simulate load: send 100 concurrent requests
// Each decrypts 5MB of data

const loadTest = async () => {
  const promises = [];
  for (let i = 0; i < 100; i++) {
    promises.push(
      cryptoManager.decrypt(
        largeEncryptedPayload,
        key, iv, authTag
      )
    );
  }

  const t0 = Date.now();
  const results = await Promise.all(promises);
  const elapsed = Date.now() - t0;

  console.log(`Processed 100 decryptions in ${elapsed}ms`);
  console.log(`Average: ${elapsed / 100}ms per decryption`);
  console.log(`Throughput: ${100 / (elapsed / 1000)} decryptions/sec`);
};


/**
 * NEXT STEPS
 */

1. Replace your existing crypto functions with CryptoManager
2. Test with real megabyte-sized payloads
3. Monitor pool stats during load
4. Adjust pool size if needed (customize in constructor)
5. Implement queue depth alerts
6. Profile real latencies on your machine
