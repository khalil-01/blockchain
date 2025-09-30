// decentralized-blockchain-nodejs/index.js
// A minimal decentralized blockchain node in Node.js.
// - Block & Blockchain structures (PoW)
// - Peer-to-peer (via HTTP) with simple gossip & longest-chain consensus
// - REST API for mining, querying, peering, and resolve (synchronize)
//
// Run multiple nodes on different ports, then connect them as peers.
//
// Usage:
//   PORT=4001 node index.js
//   PORT=4002 node index.js
//   # connect peers:
//   curl -X POST localhost:4001/api/peers -H "Content-Type: application/json" -d '{"peers":["http://localhost:4002"]}'
//   curl -X POST localhost:4002/api/peers -H "Content-Type: application/json" -d '{"peers":["http://localhost:4001"]}'
//
// After mining on one node, it will broadcast new blocks to peers.
// You can also call /api/resolve to adopt the longest valid chain from peers.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const axios = require("axios");

// ===== Block structure =====
class Block {
  constructor({ index, timestamp, data, prevHash, nonce, difficulty, hash }) {
    this.index = index;
    this.timestamp = timestamp;
    this.data = data;
    this.prevHash = prevHash;
    this.nonce = nonce;
    this.difficulty = difficulty;
    this.hash = hash;
  }
}

// ===== Blockchain =====
class Blockchain {
  constructor({ dbFile, defaultDifficulty = 3 } = {}) {
    this.dbFile = dbFile;
    this.defaultDifficulty = defaultDifficulty;
    this.chain = [];
    this.load();
    if (this.chain.length === 0) {
      const genesis = this.createGenesisBlock();
      this.chain.push(genesis);
      this.save();
    }
  }

  save() {
    fs.writeFileSync(this.dbFile, JSON.stringify(this.chain, null, 2), "utf8");
  }

  load() {
    try {
      if (fs.existsSync(this.dbFile)) {
        const raw = JSON.parse(fs.readFileSync(this.dbFile, "utf8"));
        this.chain = raw.map(b => new Block(b));
      }
    } catch (e) {
      console.error("Failed to load chain, starting fresh:", e.message);
      this.chain = [];
    }
  }

  createGenesisBlock() {
    const data = { type: "GENESIS", note: "Decentralized genesis" };
    const timestamp = Date.now();
    const prevHash = "0".repeat(64);
    const difficulty = 1;
    const { nonce, hash } = this.proofOfWork({ index: 0, timestamp, data, prevHash, difficulty });
    return new Block({ index: 0, timestamp, data, prevHash, nonce, difficulty, hash });
  }

  calculateHash({ index, timestamp, data, prevHash, nonce, difficulty }) {
    const payload = JSON.stringify({ index, timestamp, data, prevHash, nonce, difficulty });
    return crypto.createHash("sha256").update(payload).digest("hex");
  }

  proofOfWork({ index, timestamp, data, prevHash, difficulty }) {
    let nonce = 0;
    const target = "0".repeat(difficulty);
    while (true) {
      const hash = this.calculateHash({ index, timestamp, data, prevHash, nonce, difficulty });
      if (hash.startsWith(target)) return { nonce, hash };
      nonce++;
    }
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  isValidNewBlock(newBlock, prevBlock) {
    if (prevBlock.index + 1 !== newBlock.index) return false;
    if (prevBlock.hash !== newBlock.prevHash) return false;
    const checkHash = this.calculateHash(newBlock);
    if (checkHash !== newBlock.hash) return false;
    if (!newBlock.hash.startsWith("0".repeat(newBlock.difficulty))) return false;
    return true;
  }

  isChainValid(chain = this.chain) {
    if (chain.length === 0) return false;
    // validate links & PoW
    for (let i = 1; i < chain.length; i++) {
      if (!this.isValidNewBlock(chain[i], chain[i - 1])) return false;
    }
    return true;
  }

  setBlock(data) {
    const prev = this.getLatestBlock();
    const index = prev.index + 1;
    const timestamp = Date.now();
    const difficulty = this.defaultDifficulty;
    const { nonce, hash } = this.proofOfWork({ index, timestamp, data, prevHash: prev.hash, difficulty });
    const block = new Block({ index, timestamp, data, prevHash: prev.hash, nonce, difficulty, hash });
    if (!this.isValidNewBlock(block, prev)) throw new Error("Invalid block");
    this.chain.push(block);
    this.save();
    return block;
  }

  getBlock(key) {
    if (typeof key === "number") {
      return this.chain.find(b => b.index === key) || null;
    }
    if (typeof key === "string") {
      return this.chain.find(b => b.hash === key) || null;
    }
    return null;
  }

  blocksExplorer() {
    return this.chain.map(b => ({
      index: b.index,
      timeISO: new Date(b.timestamp).toISOString(),
      hash: b.hash,
      prevHash: b.prevHash,
      difficulty: b.difficulty,
      nonce: b.nonce,
      dataPreview: typeof b.data === "string" ? b.data.slice(0, 80) : JSON.stringify(b.data).slice(0, 80)
    }));
  }

  mineBlock({ data, difficulty }) {
    const prev = this.getLatestBlock();
    const index = prev.index + 1;
    const timestamp = Date.now();
    const diff = typeof difficulty === "number" && difficulty > 0 ? difficulty : this.defaultDifficulty;
    const { nonce, hash } = this.proofOfWork({ index, timestamp, data, prevHash: prev.hash, difficulty: diff });
    const block = new Block({ index, timestamp, data, prevHash: prev.hash, nonce, difficulty: diff, hash });
    if (!this.isValidNewBlock(block, prev)) throw new Error("Invalid block after mining");
    this.chain.push(block);
    this.save();
    return block;
  }

  replaceChain(newChain) {
    if (newChain.length <= this.chain.length) return false;
    if (!this.isChainValid(newChain)) return false;
    this.chain = newChain.map(b => new Block(b));
    this.save();
    return true;
  }
}

// ===== Node (decentralized) =====
const app = express();
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

const PORT = Number(process.env.PORT || 4001);
const NODE_NAME = process.env.NODE_NAME || `node-${PORT}`;
const DATA_DIR = __dirname;
const DB_FILE = path.join(DATA_DIR, `chain.${PORT}.db.json`);

const chain = new Blockchain({ dbFile: DB_FILE, defaultDifficulty: 3 });

// peers list in memory + persisted file (optional simple persistence)
const peersFile = path.join(DATA_DIR, `peers.${PORT}.json`);
let peers = [];
try {
  if (fs.existsSync(peersFile)) {
    peers = JSON.parse(fs.readFileSync(peersFile, "utf8"));
  }
} catch (e) {
  peers = [];
}
function savePeers() {
  fs.writeFileSync(peersFile, JSON.stringify(peers, null, 2), "utf8");
}

function normalizePeerUrl(url) {
  return url.replace(/\/+$/,''); // remove trailing slash
}

// ---- REST API ----

// Health
app.get("/api/health", (req, res) => {
  res.json({ ok: true, node: NODE_NAME, port: PORT, height: chain.getLatestBlock().index, peers });
});

// Chain endpoints
app.get("/api/blocks", (req, res) => {
  res.json({ valid: chain.isChainValid(), length: chain.chain.length, chain: chain.chain });
});

app.get("/api/explorer", (req, res) => {
  res.json({ explorer: chain.blocksExplorer() });
});

app.get("/api/blocks/:key", (req, res) => {
  const key = isNaN(Number(req.params.key)) ? req.params.key : Number(req.params.key);
  const block = chain.getBlock(key);
  if (!block) return res.status(404).json({ error: "Block not found" });
  res.json(block);
});

// Mine locally and broadcast
app.post("/api/mine", async (req, res) => {
  try {
    const { data = null, difficulty } = req.body || {};
    const block = chain.mineBlock({ data, difficulty });
    // broadcast to peers (fire-and-forget)
    broadcastNewBlock(block).catch(() => {});
    res.status(201).json(block);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Receive block from peer
app.post("/api/receive-block", (req, res) => {
  try {
    const incoming = req.body;
    const prev = chain.getLatestBlock();
    const newBlock = new Block(incoming);
    if (chain.isValidNewBlock(newBlock, prev)) {
      chain.chain.push(newBlock);
      chain.save();
      return res.json({ ok: true, adopted: true, height: chain.getLatestBlock().index });
    } else {
      return res.status(409).json({ ok: false, adopted: false, reason: "Invalid or not next" });
    }
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// Peering
app.get("/api/peers", (req, res) => {
  res.json({ peers });
});

app.post("/api/peers", (req, res) => {
  const bodyPeers = Array.isArray(req.body?.peers) ? req.body.peers : [];
  let added = 0;
  for (const p of bodyPeers) {
    const url = normalizePeerUrl(p);
    if (url && !peers.includes(url) && !url.endsWith(`:${PORT}`)) {
      peers.push(url);
      added++;
    }
  }
  savePeers();
  res.json({ ok: true, added, peers });
});

// Try to resolve conflicts by adopting the longest valid chain from peers
app.post("/api/resolve", async (req, res) => {
  try {
    let bestChain = chain.chain;
    for (const p of peers) {
      try {
        const { data } = await axios.get(`${p}/api/blocks`, { timeout: 5000 });
        if (data && Array.isArray(data.chain)) {
          const candidate = data.chain;
          // Validate candidate quickly here (basic check)
          if (candidate.length > bestChain.length) {
            // deep validate with our rules
            let valid = true;
            for (let i = 1; i < candidate.length; i++) {
              const prev = candidate[i - 1];
              const curr = candidate[i];
              // Recalculate hash and check structure
              const calcHash = crypto.createHash("sha256")
                .update(JSON.stringify({ index: curr.index, timestamp: curr.timestamp, data: curr.data, prevHash: curr.prevHash, nonce: curr.nonce, difficulty: curr.difficulty }))
                .digest("hex");
              if (calcHash !== curr.hash || curr.prevHash !== prev.hash || !curr.hash.startsWith("0".repeat(curr.difficulty))) {
                valid = false; break;
              }
            }
            if (valid) bestChain = candidate;
          }
        }
      } catch (_) {}
    }
    const replaced = chain.replaceChain(bestChain);
    res.json({ ok: true, replaced, length: chain.chain.length });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Broadcast helper
async function broadcastNewBlock(block) {
  const payload = block;
  await Promise.all(peers.map(async (p) => {
    try {
      await axios.post(`${p}/api/receive-block`, payload, { timeout: 5000, headers: { "Content-Type": "application/json" } });
    } catch (_) { /* ignore */ }
  }));
}

// Start server
app.listen(PORT, () => {
  console.log(`${NODE_NAME} listening on http://localhost:${PORT}`);
  console.log(`Data file: ${DB_FILE}`);
});
