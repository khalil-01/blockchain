const crypto = require("crypto");

function sha256(str) {
  return crypto.createHash("sha256").update(str).digest("hex");
}

class Block {
  constructor({ index, timestamp, data, prevHash }) {
    this.index = index;
    this.timestamp = timestamp ?? new Date().toISOString();
    this.data = data;              
    this.prevHash = prevHash || "0"; 
    this.nonce = 0;                
    this.hash = this.computeHash();
  }

  computeHash() {
    const raw = `${this.index}|${this.timestamp}|${JSON.stringify(this.data)}|${this.prevHash}|${this.nonce}`;
    return sha256(raw);
  }
}

class Blockchain {
  constructor({ difficulty = 3 } = {}) {
    this.chain = [];     
    this.difficulty = difficulty; 
    this.createGenesis();
  }

  createGenesis() {
    const genesis = new Block({
      index: 0,
      timestamp: new Date().toISOString(),
      data: { note: "Genesis Block" },
      prevHash: "0",
    });
    this.mineBlock(genesis); 
    this.chain.push(genesis);
  }


  setBlock(data) {
    const prev = this.chain[this.chain.length - 1];
    const block = new Block({
      index: prev.index + 1,
      timestamp: new Date().toISOString(),
      data,
      prevHash: prev.hash,
    });
    this.mineBlock(block);
    this.chain.push(block);
    return block;
  }


  getBlock(query) {
    if (typeof query === "number") {
      return this.chain.find(b => b.index === query) || null;
    }
    if (typeof query === "string") {
      return this.chain.find(b => b.hash === query) || null;
    }
    return null;
  }


  blocksExplorer() {
    console.log("=== Blocks Explorer ===");
    for (const b of this.chain) {
      console.log({
        index: b.index,
        timestamp: b.timestamp,
        data: b.data,
        prevHash: b.prevHash,
        nonce: b.nonce,
        hash: b.hash,
      });
    }
    console.log("=====================");
  }


  mineBlock(block) {
    const targetPrefix = "0".repeat(this.difficulty);
    while (!block.hash.startsWith(targetPrefix)) {
      block.nonce++;
      block.hash = block.computeHash();
    }
    return block;
  }


  validateChain() {
    for (let i = 1; i < this.chain.length; i++) {
      const curr = this.chain[i];
      const prev = this.chain[i - 1];
      if (curr.prevHash !== prev.hash) return false;
      const checkHash = curr.computeHash();
      if (curr.hash !== checkHash) return false;
      if (!curr.hash.startsWith("0".repeat(this.difficulty))) return false;
    }
    return true;
  }
}

if (require.main === module) {
  const bc = new Blockchain({ difficulty: 4 });

  bc.setBlock({ from: "Alice", to: "Bob", amount: 10 });
  bc.setBlock({ from: "Bob", to: "Charlie", amount: 5 });
  bc.setBlock({ msg: "Hello blockchain!" });

  bc.blocksExplorer();

  console.log("\nGet by index (2):");
  console.log(bc.getBlock(2));

  console.log("\nChain valid?", bc.validateChain());
}
