# Simple Node Server

This repository contains a minimal Node HTTP server.

Usage

Install deps (none required for the built-in server):

```bash
cd /Users/nathnael/Projects/Experiments/Node
# optional: npm install
npm start
```

The server listens on port `3000` by default. To change the port:

```bash
PORT=4000 npm start
```

Endpoints:

- `GET /` — returns plain text greeting
- `GET /health` — returns JSON {"status":"ok"}
# node-crypto-workers-demo
