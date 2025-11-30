// Express-based server with separate route handlers
const express = require('express');
const CryptoManager = require('./crypto-manager');
const crypto = require('crypto');

const app = express();
const PORT = 3001;

// Initialize crypto manager with worker thread pool (auto-sized to CPU cores)
const cryptoManager = new CryptoManager();

// Handler functions
function nonBlockerHandler(req, res) {
    res.json({ route: 'route1', message: 'This is route one' });
}

async function blockerHandler(req, res) {
    await new Promise(resolve => {
        for (let i = 0; i < 20_000_000_000; i++);
        resolve()
    }); // Yield to event loop
    res.json({ route: 'route2', message: 'This is route two' });
}

function healthHandler(req, res) {
    res.json({ status: 'ok' });
}

function rootHandler(req, res) {
    res.type('text').send('Hello from Node server\n');
}

/**
 * Example: Decrypt endpoint using worker threads
 * Expects POST body: { ciphertext, key, iv, authTag }
 * All values should be base64 encoded
 */
async function decryptHandler(req, res) {
    try {
        const { ciphertext, key, iv, authTag } = req.body;

        if (!ciphertext || !key || !iv || !authTag) {
            return res.status(400).json({ error: 'Missing ciphertext, key, iv, or authTag' });
        }

        // Decrypt using worker thread (non-blocking on main thread)
        const plaintext = await cryptoManager.decrypt(ciphertext, key, iv, authTag);

        res.json({
            success: true,
            plaintext,
            poolStats: cryptoManager.getStats(),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

/**
 * Example: Encrypt endpoint using worker threads
 * Expects POST body: { plaintext, key, iv }
 * key and iv should be base64 encoded
 */
async function encryptHandler(req, res) {
    try {
        const { plaintext, key, iv } = req.body;

        if (!plaintext || !key || !iv) {
            return res.status(400).json({ error: 'Missing plaintext, key, or iv' });
        }

        // Encrypt using worker thread (non-blocking on main thread)
        const { ciphertext, authTag } = await cryptoManager.encrypt(plaintext, key, iv);

        res.json({
            success: true,
            ciphertext,
            authTag,
            poolStats: cryptoManager.getStats(),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

/**
 * Example: Sign endpoint using worker threads
 * Expects POST body: { payload, privateKeyPem }
 */
async function signHandler(req, res) {
    try {
        const { payload, privateKeyPem } = req.body;

        if (!payload || !privateKeyPem) {
            return res.status(400).json({ error: 'Missing payload or privateKeyPem' });
        }

        // Sign using worker thread (non-blocking on main thread)
        const signature = await cryptoManager.sign(payload, privateKeyPem);

        res.json({
            success: true,
            signature,
            poolStats: cryptoManager.getStats(),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

/**
 * Endpoint to get worker pool statistics
 */
function poolStatsHandler(req, res) {
    res.json(cryptoManager.getStats());
}

// Register routes directly under app.get
app.get('/non-blocker', nonBlockerHandler);
app.get('/blocker', blockerHandler);
app.get('/health', healthHandler);
app.get('/', rootHandler);
app.get('/pool-stats', poolStatsHandler);

// Crypto routes (POST)
app.use(express.json({ limit: '50mb' })); // Allow large JSON payloads for encrypted data
app.post('/decrypt', decryptHandler);
app.post('/encrypt', encryptHandler);
app.post('/sign', signHandler);

// 404 for other routes
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

const server = app.listen(PORT, function () {
    console.log(`Server listening on port ${PORT}`);
});

process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await cryptoManager.shutdown();
    server.close(() => process.exit(0));
});
