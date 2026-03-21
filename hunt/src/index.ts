/**
 * HUNT dApp – Main Entry Point
 * The HUNT dApp running on FRAME Protocol.
 *
 * Copyright (c) 2026 思捷娅科技 (SJYKJ)
 * MIT License
 */

export { ReceiptChain } from "./modules/receipt-chain.js";
export { IdentityModule } from "./modules/identity.js";
export { HuntEngine, haversine } from "./modules/hunt-engine.js";
export { AIHuntGenerator } from "./modules/ai-generator.js";
export type * from "./types/index.js";

import { ReceiptChain } from "./modules/receipt-chain.js";
import { IdentityModule } from "./modules/identity.js";
import { HuntEngine } from "./modules/hunt-engine.js";
import { AIHuntGenerator } from "./modules/ai-generator.js";
import type { FrameIdentity } from "./types/index.js";

/**
 * Create a fully initialized HUNT dApp instance.
 */
export function createHuntApp() {
  const receiptChain = new ReceiptChain({
    dappId: "frame://hunt",
    initialStateRoot: "0x0000000000000000",
  });

  const identity = new IdentityModule(receiptChain);
  const engine = new HuntEngine(receiptChain, identity);
  const aiGenerator = new AIHuntGenerator(engine, "agent://hunt-generator");

  return { receiptChain, identity, engine, aiGenerator };
}

// ─── Demo / CLI ────────────────────────────────────────────────

async function main() {
  const app = createHuntApp();

  // Register players
  const alice: FrameIdentity = { publicKey: "0xalice1111", handle: "alice_explorer" };
  const bob: FrameIdentity = { publicKey: "0xbob2222", handle: "bob_memeking" };
  const carol: FrameIdentity = { publicKey: "0xcarol3333", handle: "carol_detective" };

  app.identity.register(alice);
  app.identity.register(bob);
  app.identity.register(carol);

  // AI generates hunts
  const hunt1 = app.aiGenerator.generateRandom("0xai", 100, "FRAME");
  console.log(`🎯 AI generated hunt: ${hunt1.title}`);

  // Activate hunt
  app.engine.activateHunt(hunt1.id);

  // Alice submits to the hunt
  const submission = app.engine.submitAnswer(
    hunt1.id,
    alice.publicKey,
    {
      gps: { lat: 40.7128, lng: -74.006, accuracy: 10, timestamp: Date.now() },
      imageHashes: ["ipfs://QmExample"],
      custom: {},
    },
    "I found the graffiti wall!",
  );
  console.log(`📝 ${alice.handle} submitted: ${submission.id}`);

  // Community votes
  app.engine.voteOnSubmission(submission.id, true);
  app.engine.voteOnSubmission(submission.id, true);
  app.engine.voteOnSubmission(submission.id, true);
  app.engine.voteOnSubmission(submission.id, true);
  app.engine.voteOnSubmission(submission.id, true);

  // Check hunt status
  const updatedHunt = app.engine.getHunt(hunt1.id);
  console.log(`🏆 Hunt ${hunt1.id} status: ${updatedHunt.status}, winner: ${updatedHunt.winner}`);

  // Bob creates a meme challenge
  const meme = app.engine.createMemeChallenge(
    bob.publicKey,
    "ipfs://QmMemeTemplate",
    "Best Developer Meme",
    "Create the funniest developer meme",
    { amount: 50, token: "FRAME" },
    Date.now() + 48 * 60 * 60 * 1000,
  );
  console.log(`😂 ${bob.handle} created meme challenge: ${meme.title}`);

  // Carol posts a discovery
  const disc = app.engine.postDiscovery(
    carol.publicKey,
    "Hidden Rooftop Garden",
    "An amazing secret garden on top of an old warehouse building",
    "discovery",
    { lat: 40.713, lng: -74.005 },
    ["ipfs://QmGarden1", "ipfs://QmGarden2"],
  );
  console.log(`📍 ${carol.handle} posted discovery: ${disc.title}`);

  // Community votes on discovery
  for (let i = 0; i < 12; i++) {
    app.engine.voteOnDiscovery(disc.id, true);
  }
  const updatedDisc = app.engine.getDiscoveries().find((d) => d.id === disc.id);
  console.log(`🗺️ Discovery permanent: ${updatedDisc?.permanentMapObject}`);

  // Create a bounty
  const bounty = app.engine.createBounty(
    alice.publicKey,
    "Find the Oldest Tree in Central Park",
    "Locate and photograph the oldest tree in Central Park",
    { amount: 200, token: "FRAME" },
    "0xescrow123",
  );
  console.log(`💰 Bounty created: ${bounty.title} (linked hunt: ${bounty.linkedHuntId})`);

  // Leaderboard
  const lb = app.identity.getLeaderboard(3);
  console.log("\n📊 Leaderboard:");
  for (const entry of lb) {
    console.log(`  #${entry.rank} ${entry.handle} – ${entry.score} pts (${entry.huntWins} hunts, ${entry.discoveries} discoveries)`);
  }

  // Map objects
  const mapObjs = app.engine.getMapObjects();
  console.log(`\n🗺️ Map objects: ${mapObjs.length} visible`);

  // Receipt chain integrity
  console.log(`\n🔗 Receipt chain: ${app.receiptChain.length} receipts, valid: ${app.receiptChain.verify()}`);
  console.log(`   State root: ${app.receiptChain.getStateRoot()}`);
}

// Run demo if executed directly
main().catch(console.error);
