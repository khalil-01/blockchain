# Central Blockchain (Node.js)

Single-server (centralized) blockchain in Node.js that demonstrates:
- **Block** structure
- **Blockchain** class with: `setBlock`, `getBlock`, `blocksExplorer`, `mineBlock`
- Minimal **REST API** to interact with the chain
- JSON file **persistence** (`chain.db.json`)

---

## تشغيل سريع (Arabic)
### المتطلبات
- Node.js 18+

### خطوات التشغيل
```bash
npm install
npm start
# يشتغل على http://localhost:3000
```

### اختبارات سريعة
```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/blocks
curl -X POST http://localhost:3000/api/blocks -H "Content-Type: application/json" -d '{"data":{"msg":"hello"}}'
curl -X POST http://localhost:3000/api/mine -H "Content-Type: application/json" -d '{"data":"harder","difficulty":4}'
curl http://localhost:3000/api/explorer
```

---

## Quick Start (English)
```bash
npm install
npm start
# Server: http://localhost:3000
```

### REST Endpoints
- `GET /api/health` → basic status
- `GET /api/blocks` → full chain
- `GET /api/explorer` → compact view
- `GET /api/blocks/:key` → by height (index) or hash
- `POST /api/blocks` → append block using default difficulty `{ "data": any }`
- `POST /api/mine` → mine block with custom difficulty `{ "data": any, "difficulty": 4 }`
- `POST /api/reset` → reset chain to a fresh genesis
- `POST /api/config/difficulty` → update default difficulty (1..6)

### Notes
- Chain persists to `chain.db.json` in the project folder.
- This is a **central** (single node) demo; not peer-to-peer.
- For coursework, cite this repo and explain PoW & validation checks.

---

## Docker
Build and run:
```bash
docker build -t central-blockchain-nodejs .
docker run -p 3000:3000 central-blockchain-nodejs
```

---

## License
MIT
