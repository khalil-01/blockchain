# Decentralized Blockchain (Node.js)

A minimal **decentralized** blockchain node in Node.js that demonstrates:

- Block structure & PoW
- Peer connections (over HTTP) and block gossip
- Longest-chain consensus (`/api/resolve`)
- REST API to mine, add peers, fetch blocks

Run multiple nodes on different ports, connect them, mine on one node, and synchronize the others.

---

## Quick Start
Requirements: Node.js 18+

```bash
npm install
# start first node on 4001
PORT=4001 node index.js
# start second node on 4002 (new terminal)
PORT=4002 node index.js
```

### Connect peers
```bash
curl -X POST http://localhost:4001/api/peers -H "Content-Type: application/json" -d '{"peers":["http://localhost:4002"]}'
curl -X POST http://localhost:4002/api/peers -H "Content-Type: application/json" -d '{"peers":["http://localhost:4001"]}'
```

### Mine on one node
```bash
curl -X POST http://localhost:4001/api/mine -H "Content-Type: application/json" -d '{"data":{"from":"Khalil","msg":"Hi"}}'
```

### Receive on the other node
Normally new blocks are broadcast automatically. If a node missed gossip, call resolve:
```bash
curl -X POST http://localhost:4002/api/resolve
```

### Explore / Fetch
```bash
curl http://localhost:4001/api/explorer
curl http://localhost:4002/api/blocks
```

---

## REST Endpoints
- `GET /api/health` → node status, height, peers
- `GET /api/blocks` → full chain
- `GET /api/explorer` → compact chain view
- `GET /api/blocks/:key` → block by index or hash
- `POST /api/mine` → mine locally `{ "data": any, "difficulty": 4 }`
- `POST /api/receive-block` → (peers) receive pushed block
- `GET /api/peers` → list known peers
- `POST /api/peers` → add peers `{ "peers": ["http://host:port"] }`
- `POST /api/resolve` → adopt longest valid chain from peers

**Data files:** Each node persists to `chain.<PORT>.db.json` and peers to `peers.<PORT>.json` in the project directory.

---

## Notes
- This is a teaching/demo implementation (single-threaded PoW, simple HTTP gossip).
- Security, signatures, transactions, mempool, difficulty retargeting, etc., are intentionally simplified.

## License
MIT
