/**
 * HUNT dApp – Receipt Chain
 * Cryptographically linked execution receipts for verifiable state.
 *
 * Copyright (c) 2026 思捷娅科技 (SJYKJ)
 * MIT License
 */

import type { HuntReceipt, HexString } from "../types/index.js";
import { uuid } from "../utils/uuid.js";

/** Create a deterministic hash for a receipt (stub – real impl uses SHA-256 in FRAME kernel). */
function hashReceipt(data: string): HexString {
  // Simple hash for reference implementation
  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    h ^= data.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return "0x" + (h >>> 0).toString(16).padStart(8, "0");
}

export interface ReceiptChainOptions {
  dappId: string;
  initialStateRoot: HexString;
}

export class ReceiptChain {
  private chain: HuntReceipt[] = [];
  private stateRoot: HexString;
  private readonly dappId: string;

  constructor(opts: ReceiptChainOptions) {
    this.dappId = opts.dappId;
    this.stateRoot = opts.initialStateRoot;
  }

  /** Append a new receipt to the chain. */
  append(actor: HexString, intent: string, payload: Record<string, unknown>): HuntReceipt {
    const prevHash = this.lastHash();
    const data = JSON.stringify({ prevHash, actor, intent, payload, ts: Date.now() });
    const hash = hashReceipt(data);
    const receipt: HuntReceipt = {
      prevReceiptHash: prevHash,
      hash,
      actor,
      intent,
      dappId: this.dappId,
      timestamp: Date.now(),
      stateRoot: this.stateRoot,
      // Signature would be Ed25519 in production FRAME kernel
      signature: "0x" + uuid().replace(/-/g, "").slice(0, 16),
    };
    this.chain.push(receipt);
    // Update state root deterministically
    this.stateRoot = hashReceipt(JSON.stringify(this.chain.map((r) => r.hash)));
    return receipt;
  }

  /** Get the latest receipt hash. */
  lastHash(): HexString {
    return this.chain.length > 0 ? this.chain[this.chain.length - 1].hash : "0x00000000";
  }

  /** Get the deterministic state root. */
  getStateRoot(): HexString {
    return this.stateRoot;
  }

  /** Verify the full chain integrity. */
  verify(): boolean {
    for (let i = 0; i < this.chain.length; i++) {
      if (i > 0 && this.chain[i].prevReceiptHash !== this.chain[i - 1].hash) {
        return false;
      }
    }
    return true;
  }

  /** Get all receipts. */
  getAll(): ReadonlyArray<HuntReceipt> {
    return Object.freeze([...this.chain]);
  }

  /** Get receipt by hash. */
  getByHash(hash: HexString): HuntReceipt | undefined {
    return this.chain.find((r) => r.hash === hash);
  }

  /** Get chain length. */
  get length(): number {
    return this.chain.length;
  }
}
