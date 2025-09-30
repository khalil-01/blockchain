// central-blockchain-nodejs/index.js
// A simple centralized blockchain server in Node.js (single file)
// Implements: Block structure, Blockchain class, and functions setBlock, getBlock, blocksExplorer, mineBlock
// Exposes a minimal REST API so the chain runs as a central system on one server.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const morgan = require("morgan");
const cors = require("cors");

// ===== Block structure =====
class Block {
  constructor({ index, timestamp, data, prevHash, nonce, difficulty, hash }) {
    this.index = index; // height
    this.timestamp = timestamp; // ms epoch
    this.data = data; // arbitrary payload (object or string)
    this.prevHash = prevHash; // hex string
    this.nonce = nonce; // number used to vary hash
    this.difficulty = difficulty; // PoW difficulty (number of leading zeros)
    this.hash = hash; // hex string
  }
}

// ===== Blockchain (central) =====
class Blockchain {
  constructor({ dbFile = path.join(__dirname, "chain.db.json"), defaultDifficulty = 3 } = {}) {
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

  // ----- Persistence -----
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

  // ----- Helpers -----
  createGenesisBlock() {
    const data = { type: "GENESIS", note: "Centralized blockchain genesis block" };
    const timestamp = Date.now();
    const prevHash = "0".repeat(64);
    const difficulty = 1; // easy for genesis
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
    for (let i = 1; i < chain.length; i++) {
      if (!this.isValidNewBlock(chain[i], chain[i - 1])) return false;
    }
    return true;
  }

  // ===== Required API =====
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

  // getBlock: by index (height) or by hash (auto-detect)
  getBlock(key) {
    if (typeof key === "number") {
      return this.chain.find(b => b.index === key) || null;
    }
    if (typeof key === "string") {
      return this.chain.find(b => b.hash === key) || null;
    }
    return null;
  }

  // blocksExplorer: lightweight view for UIs
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

  // mineBlock: explicit mining endpoint allowing custom difficulty override per request
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
}

// ===== Server (centralized) =====
const app = express();
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

const chain = new Blockchain();

// Health
app.get("/api/health", (req, res) => res.json({ ok: true, height: chain.getLatestBlock().index }));

// Get full chain
app.get("/api/blocks", (req, res) => {
  res.json({ valid: chain.isChainValid(), length: chain.chain.length, chain: chain.chain });
});

// Explorer view
app.get("/api/explorer", (req, res) => {
  res.json({ explorer: chain.blocksExplorer() });
});

// Get one block by index or hash
app.get("/api/blocks/:key", (req, res) => {
  const key = isNaN(Number(req.params.key)) ? req.params.key : Number(req.params.key);
  const block = chain.getBlock(key);
  if (!block) return res.status(404).json({ error: "Block not found" });
  res.json(block);
});

// setBlock: append block with PoW using default difficulty and user data
app.post("/api/blocks", (req, res) => {
  try {
    const data = req.body?.data ?? null;
    const block = chain.setBlock(data);
    res.status(201).json(block);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// mineBlock: optional custom difficulty per request
app.post("/api/mine", (req, res) => {
  try {
    const { data = null, difficulty } = req.body || {};
    const block = chain.mineBlock({ data, difficulty });
    res.status(201).json(block);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Reset chain (dangerous): start a fresh chain with new genesis
app.post("/api/reset", (req, res) => {
  try {
    chain.chain = [chain.createGenesisBlock()];
    chain.save();
    res.json({ ok: true, message: "Chain reset to new genesis" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update default difficulty for future setBlock() calls
app.post("/api/config/difficulty", (req, res) => {
  const { difficulty } = req.body || {};
  if (typeof difficulty !== "number" || difficulty < 1 || difficulty > 6) {
    return res.status(400).json({ error: "difficulty must be a number between 1 and 6" });
  }
  chain.defaultDifficulty = difficulty;
  res.json({ ok: true, defaultDifficulty: chain.defaultDifficulty });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Central Blockchain server listening on http://localhost:${PORT}`);
});
