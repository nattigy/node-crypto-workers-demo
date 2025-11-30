// Express-based server with separate route handlers
const express = require('express');

const app = express();
const PORT = 3001

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

// Register routes directly under app.get
app.get('/non-blocker', nonBlockerHandler);
app.get('/blocker', blockerHandler);
app.get('/health', healthHandler);
app.get('/', rootHandler);

// 404 for other routes
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

const server = app.listen(PORT, function () {
    console.log(`Server listening on port ${PORT}`);
});

process.on('SIGINT', () => {
    console.log('Shutting down...');
    server.close(() => process.exit(0));
});
