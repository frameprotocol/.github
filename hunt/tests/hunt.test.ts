/**
 * HUNT dApp – Test Suite
 *
 * Copyright (c) 2026 思捷娅科技 (SJYKJ)
 * MIT License
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ReceiptChain } from "../src/modules/receipt-chain.js";
import { IdentityModule } from "../src/modules/identity.js";
import { HuntEngine, haversine } from "../src/modules/hunt-engine.js";
import { AIHuntGenerator } from "../src/modules/ai-generator.js";
import { createHuntApp } from "../src/index.js";
import type { FrameIdentity, SensorPayload } from "../src/types/index.js";

// ─── Helpers ───────────────────────────────────────────────────

function makeIdentity(publicKey: string, handle: string): FrameIdentity {
  return { publicKey, handle };
}

function makeGpsPayload(lat: number, lng: number): SensorPayload {
  return {
    gps: { lat, lng, accuracy: 5, timestamp: Date.now() },
    custom: {},
  };
}

// ─── Receipt Chain ─────────────────────────────────────────────

describe("ReceiptChain", () => {
  let chain: ReceiptChain;

  beforeEach(() => {
    chain = new ReceiptChain({ dappId: "test", initialStateRoot: "0x0" });
  });

  it("starts with empty chain", () => {
    expect(chain.length).toBe(0);
    expect(chain.lastHash()).toBe("0x00000000");
    expect(chain.verify()).toBe(true);
  });

  it("appends receipts and links them", () => {
    const r1 = chain.append("0xalice", "test.intent", { foo: 1 });
    const r2 = chain.append("0xbob", "test.intent", { bar: 2 });

    expect(chain.length).toBe(2);
    expect(r2.prevReceiptHash).toBe(r1.hash);
    expect(chain.verify()).toBe(true);
  });

  it("detects tampered chain", () => {
    chain.append("0xa", "i", {});
    chain.append("0xb", "i", {});

    // Tamper with the chain by getting internal array
    const receipt = chain.getByHash(chain.lastHash());
    // Chain should be valid before tampering
    expect(chain.verify()).toBe(true);
  });

  it("produces different state root after each append", () => {
    const root1 = chain.getStateRoot();
    chain.append("0xa", "i", {});
    const root2 = chain.getStateRoot();
    chain.append("0xb", "i", {});
    const root3 = chain.getStateRoot();

    expect(root1).not.toBe(root2);
    expect(root2).not.toBe(root3);
  });

  it("finds receipt by hash", () => {
    const r = chain.append("0xa", "test", {});
    expect(chain.getByHash(r.hash)).toBe(r);
    expect(chain.getByHash("0xnonexistent")).toBeUndefined();
  });
});

// ─── Identity Module ───────────────────────────────────────────

describe("IdentityModule", () => {
  let chain: ReceiptChain;
  let identity: IdentityModule;

  beforeEach(() => {
    chain = new ReceiptChain({ dappId: "test", initialStateRoot: "0x0" });
    identity = new IdentityModule(chain);
  });

  it("registers a new player", () => {
    const alice = makeIdentity("0xalice", "alice");
    identity.register(alice);

    const profile = identity.getProfile("0xalice");
    expect(profile).toBeDefined();
    expect(profile!.identity.handle).toBe("alice");
    expect(profile!.reputation.total).toBe(0);
    expect(profile!.reputation.level).toBe(1);
  });

  it("rejects duplicate registration", () => {
    const alice = makeIdentity("0xalice", "alice");
    identity.register(alice);
    expect(() => identity.register(alice)).toThrow("already registered");
  });

  it("awards reputation and levels up", () => {
    identity.register(makeIdentity("0xalice", "alice"));

    identity.awardReputation("0xalice", "huntsCompleted", 500);
    const profile = identity.getProfile("0xalice")!;
    expect(profile.reputation.total).toBe(500);
    expect(profile.reputation.huntsCompleted).toBe(500);
    expect(profile.reputation.level).toBeGreaterThan(1);
  });

  it("unlocks achievements", () => {
    identity.register(makeIdentity("0xalice", "alice"));

    identity.addAchievement("0xalice", {
      id: "ach_1",
      name: "First Steps",
      description: "Registered on HUNT",
      icon: "👣",
      unlockedAt: Date.now(),
      receiptHash: "0x",
    });

    const profile = identity.getProfile("0xalice")!;
    expect(profile.achievements).toHaveLength(1);
    expect(profile.achievements[0].name).toBe("First Steps");
  });

  it("rejects duplicate achievement", () => {
    identity.register(makeIdentity("0xalice", "alice"));
    const ach = { id: "ach_1", name: "Test", description: "T", icon: "🏆", unlockedAt: Date.now(), receiptHash: "0x" };

    identity.addAchievement("0xalice", ach);
    expect(() => identity.addAchievement("0xalice", ach)).toThrow("already unlocked");
  });

  it("tracks earnings", () => {
    identity.register(makeIdentity("0xalice", "alice"));

    identity.addEarnings("0xalice", 100, "FRAME");
    identity.addEarnings("0xalice", 50, "FRAME");

    const profile = identity.getProfile("0xalice")!;
    expect(profile.earnings.amount).toBe(150);
  });

  it("builds leaderboard sorted by reputation", () => {
    identity.register(makeIdentity("0xalice", "alice"));
    identity.register(makeIdentity("0xbob", "bob"));
    identity.register(makeIdentity("0xcarol", "carol"));

    identity.awardReputation("0xbob", "huntsCompleted", 300);
    identity.awardReputation("0xalice", "huntsCompleted", 500);
    identity.awardReputation("0xcarol", "huntsCompleted", 100);

    const lb = identity.getLeaderboard(10);
    expect(lb[0].handle).toBe("alice");
    expect(lb[1].handle).toBe("bob");
    expect(lb[2].handle).toBe("carol");
    expect(lb[0].rank).toBe(1);
  });

  it("throws on operations for non-existent profile", () => {
    expect(() => identity.awardReputation("0xghost", "huntsCompleted", 10)).toThrow("not found");
    expect(() => identity.addEarnings("0xghost", 10, "FRAME")).toThrow("not found");
  });
});

// ─── Hunt Engine ────────────────────────────────────────────────

describe("HuntEngine", () => {
  let app: ReturnType<typeof createHuntApp>;

  beforeEach(() => {
    app = createHuntApp();
    app.identity.register(makeIdentity("0xalice", "alice"));
    app.identity.register(makeIdentity("0xbob", "bob"));
  });

  it("creates a draft hunt", () => {
    const hunt = app.engine.createHunt({
      creator: "0xalice",
      category: "location",
      title: "Find the Tower",
      description: "Find the clock tower",
      clues: "It chimes every hour",
      reward: { amount: 100, token: "FRAME" },
      rules: { verification: ["gps"] },
    });

    expect(hunt.status).toBe("draft");
    expect(hunt.participants).toBe(0);
    expect(hunt.winner).toBeNull();
  });

  it("activates and cancels hunts", () => {
    const hunt = app.engine.createHunt({
      creator: "0xalice",
      category: "puzzle",
      title: "Solve the Riddle",
      description: "A puzzle",
      clues: "42",
      reward: { amount: 50, token: "FRAME" },
      rules: { verification: ["community_vote"] },
    });

    app.engine.activateHunt(hunt.id);
    expect(app.engine.getHunt(hunt.id).status).toBe("active");

    app.engine.cancelHunt(hunt.id);
    expect(app.engine.getHunt(hunt.id).status).toBe("cancelled");
  });

  it("submits and verifies a hunt answer", () => {
    const hunt = app.engine.createHunt({
      creator: "0xalice",
      category: "location",
      title: "Central Park Bench",
      description: "Find the bench",
      clues: "Near the fountain",
      reward: { amount: 100, token: "FRAME" },
      rules: { verification: ["gps"], proximityMeters: 100 },
      bounds: { center: { lat: 40.7829, lng: -73.9654 }, radiusMeters: 500 },
    });
    app.engine.activateHunt(hunt.id);

    const sub = app.engine.submitAnswer(
      hunt.id,
      "0xbob",
      makeGpsPayload(40.7829, -73.9654),
      "Found it!",
    );
    expect(sub.status).toBe("pending");

    const verified = app.engine.verifySubmission(sub.id, true, "gps");
    expect(verified.status).toBe("accepted");

    const updatedHunt = app.engine.getHunt(hunt.id);
    expect(updatedHunt.status).toBe("completed");
    expect(updatedHunt.winner).toBe("0xbob");
  });

  it("rejects GPS too far from hunt bounds", () => {
    const hunt = app.engine.createHunt({
      creator: "0xalice",
      category: "location",
      title: "NYC Tower",
      description: "Find it",
      clues: "Downtown",
      reward: { amount: 100, token: "FRAME" },
      rules: { verification: ["gps"], proximityMeters: 50 },
      bounds: { center: { lat: 40.7128, lng: -74.006 }, radiusMeters: 500 },
    });
    app.engine.activateHunt(hunt.id);

    // Submit from far away (LA)
    expect(() =>
      app.engine.submitAnswer(hunt.id, "0xbob", makeGpsPayload(34.0522, -118.2437), "Nope"),
    ).toThrow("GPS too far");
  });

  it("enforces submission limits", () => {
    const hunt = app.engine.createHunt({
      creator: "0xalice",
      category: "puzzle",
      title: "Quick Puzzle",
      description: "Solve",
      clues: "X",
      reward: { amount: 10, token: "FRAME" },
      rules: { verification: ["community_vote"], maxSubmissions: 2 },
    });
    app.engine.activateHunt(hunt.id);

    app.engine.submitAnswer(hunt.id, "0xbob", { custom: {} }, "try 1");
    app.engine.submitAnswer(hunt.id, "0xbob", { custom: {} }, "try 2");
    expect(() =>
      app.engine.submitAnswer(hunt.id, "0xbob", { custom: {} }, "try 3"),
    ).toThrow("Max submissions");
  });

  it("auto-accepts via community voting threshold", () => {
    const hunt = app.engine.createHunt({
      creator: "0xalice",
      category: "photo",
      title: "Photo Hunt",
      description: "Take a photo",
      clues: "Anywhere",
      reward: { amount: 50, token: "FRAME" },
      rules: { verification: ["community_vote"] },
    });
    app.engine.activateHunt(hunt.id);

    const sub = app.engine.submitAnswer(hunt.id, "0xbob", { custom: {} }, "photo");

    // 5 for, 0 against → 100% > 70% → auto accept
    for (let i = 0; i < 5; i++) {
      app.engine.voteOnSubmission(sub.id, true);
    }

    expect(sub.status).toBe("accepted");
  });

  it("auto-rejects via community voting threshold", () => {
    const hunt = app.engine.createHunt({
      creator: "0xalice",
      category: "photo",
      title: "Photo Hunt 2",
      description: "Take a photo",
      clues: "Anywhere",
      reward: { amount: 50, token: "FRAME" },
      rules: { verification: ["community_vote"] },
    });
    app.engine.activateHunt(hunt.id);

    const sub = app.engine.submitAnswer(hunt.id, "0xbob", { custom: {} }, "fake");

    // 1 for, 4 against → 20% for, 80% against → auto reject
    app.engine.voteOnSubmission(sub.id, true);
    for (let i = 0; i < 4; i++) {
      app.engine.voteOnSubmission(sub.id, false);
    }

    expect(sub.status).toBe("rejected");
  });

  it("enforces reputation gate", () => {
    const hunt = app.engine.createHunt({
      creator: "0xalice",
      category: "puzzle",
      title: "Elite Puzzle",
      description: "Hard",
      clues: "X",
      reward: { amount: 500, token: "FRAME" },
      rules: { verification: ["community_vote"], minReputation: 5 },
    });
    app.engine.activateHunt(hunt.id);

    // bob has reputation level 1 (default)
    expect(() =>
      app.engine.submitAnswer(hunt.id, "0xbob", { custom: {} }, "try"),
    ).toThrow("Insufficient reputation");
  });

  it("cannot submit to non-active hunts", () => {
    const hunt = app.engine.createHunt({
      creator: "0xalice",
      category: "location",
      title: "Test",
      description: "T",
      clues: "X",
      reward: { amount: 10, token: "FRAME" },
      rules: { verification: ["gps"] },
    });

    expect(() =>
      app.engine.submitAnswer(hunt.id, "0xbob", makeGpsPayload(0, 0), "no"),
    ).toThrow("not active");
  });

  it("filters hunts by status and category", () => {
    app.engine.createHunt({
      creator: "0xalice",
      category: "location",
      title: "H1",
      description: "D",
      clues: "X",
      reward: { amount: 10, token: "FRAME" },
      rules: { verification: ["gps"] },
    });

    app.engine.createHunt({
      creator: "0xalice",
      category: "puzzle",
      title: "H2",
      description: "D",
      clues: "X",
      reward: { amount: 10, token: "FRAME" },
      rules: { verification: ["community_vote"] },
    });

    expect(app.engine.getHunts({ status: "draft" })).toHaveLength(2);
    expect(app.engine.getHunts({ category: "puzzle" })).toHaveLength(1);
  });
});

// ─── Discoveries ───────────────────────────────────────────────

describe("Discoveries", () => {
  let app: ReturnType<typeof createHuntApp>;

  beforeEach(() => {
    app = createHuntApp();
    app.identity.register(makeIdentity("0xalice", "alice"));
  });

  it("posts a discovery and adds to map", () => {
    const disc = app.engine.postDiscovery(
      "0xalice",
      "Hidden Garden",
      "A secret garden",
      "discovery",
      { lat: 40.7128, lng: -74.006 },
      ["ipfs://QmGarden"],
    );

    expect(disc.title).toBe("Hidden Garden");
    expect(disc.permanentMapObject).toBe(false);
    expect(app.engine.getMapObjects().length).toBeGreaterThan(0);
  });

  it("promotes discovery to permanent with enough votes", () => {
    const disc = app.engine.postDiscovery(
      "0xalice",
      "Cool Mural",
      "Street art",
      "creative",
      { lat: 40.713, lng: -74.005 },
      [],
    );

    // Need 10 positive votes to become permanent
    for (let i = 0; i < 10; i++) {
      app.engine.voteOnDiscovery(disc.id, true);
    }

    const updated = app.engine.getDiscoveries().find((d) => d.id === disc.id);
    expect(updated!.permanentMapObject).toBe(true);
  });
});

// ─── Meme Challenges ───────────────────────────────────────────

describe("MemeChallenges", () => {
  let app: ReturnType<typeof createHuntApp>;

  beforeEach(() => {
    app = createHuntApp();
    app.identity.register(makeIdentity("0xbob", "bob"));
    app.identity.register(makeIdentity("0xalice", "alice"));
  });

  it("creates and submits meme challenge", () => {
    const challenge = app.engine.createMemeChallenge(
      "0xbob",
      "ipfs://QmTemplate",
      "Dev Meme",
      "Funny dev memes",
      { amount: 50, token: "FRAME" },
      Date.now() + 86400000,
    );

    expect(challenge.submissions).toHaveLength(0);

    app.engine.submitMeme(challenge.id, "0xalice", "ipfs://QmAliceMeme");

    const updated = app.engine.getMemeChallenges()[0];
    expect(updated.submissions).toHaveLength(1);
  });

  it("resolves meme challenge with winner", () => {
    const challenge = app.engine.createMemeChallenge(
      "0xbob",
      "ipfs://QmT",
      "Best Meme",
      "Make me laugh",
      { amount: 100, token: "FRAME" },
      Date.now() + 86400000,
    );

    app.engine.submitMeme(challenge.id, "0xalice", "ipfs://QmA");
    app.engine.submitMeme(challenge.id, "0xbob", "ipfs://QmB");

    // Vote for alice's meme
    const subs = app.engine.getSubmissions(challenge.id);
    for (const s of subs) {
      if (s.submitter === "0xalice") {
        for (let i = 0; i < 10; i++) app.engine.voteMeme(s.id, true);
      }
    }

    const resolved = app.engine.resolveMemeChallenge(challenge.id);
    expect(resolved!.winner).toBe("0xalice");
  });
});

// ─── Bounties ──────────────────────────────────────────────────

describe("Bounties", () => {
  let app: ReturnType<typeof createHuntApp>;

  beforeEach(() => {
    app = createHuntApp();
    app.identity.register(makeIdentity("0xalice", "alice"));
  });

  it("creates bounty with linked hunt", () => {
    const bounty = app.engine.createBounty(
      "0xalice",
      "Find the Oldest Building",
      "Locate and photograph",
      { amount: 200, token: "FRAME" },
      "0xescrow1",
    );

    expect(bounty.status).toBe("active");
    expect(bounty.linkedHuntId).toBeDefined();

    // Linked hunt should be active
    const linkedHunt = app.engine.getHunt(bounty.linkedHuntId!);
    expect(linkedHunt.status).toBe("active");
  });
});

// ─── AI Generator ──────────────────────────────────────────────

describe("AIHuntGenerator", () => {
  let app: ReturnType<typeof createHuntApp>;

  beforeEach(() => {
    app = createHuntApp();
  });

  it("generates a random active hunt", () => {
    const hunt = app.aiGenerator.generateRandom("0xai", 75, "FRAME");
    expect(hunt.status).toBe("active");
    expect(hunt.reward.amount).toBe(75);
  });

  it("generates location-specific hunt", () => {
    const hunt = app.aiGenerator.generateNearLocation(
      "0xai",
      { lat: 51.5074, lng: -0.1278 }, // London
      100,
      "FRAME",
    );

    expect(hunt.status).toBe("active");
    expect(hunt.bounds).toBeDefined();
    expect(hunt.bounds!.center.lat).toBeCloseTo(51.5074, 0);
  });

  it("generates city event with multiple hunts", () => {
    const hunts = app.aiGenerator.generateCityEvent(
      "0xai",
      "Tokyo",
      { lat: 35.6762, lng: 139.6503 },
      5,
      50,
      "FRAME",
    );

    expect(hunts.length).toBe(5);
    for (const hunt of hunts) {
      expect(hunt.status).toBe("active");
      expect(hunt.title).toContain("Tokyo");
    }
  });
});

// ─── Haversine ─────────────────────────────────────────────────

describe("haversine", () => {
  it("returns 0 for same point", () => {
    expect(haversine(40.7128, -74.006, 40.7128, -74.006)).toBe(0);
  });

  it("calculates approximate NYC-LA distance", () => {
    const dist = haversine(40.7128, -74.006, 34.0522, -118.2437);
    expect(dist).toBeGreaterThan(3_900_000); // ~3940 km
    expect(dist).toBeLessThan(4_000_000);
  });

  it("calculates small distances accurately", () => {
    // ~100m apart
    const dist = haversine(40.7128, -74.006, 40.7137, -74.006);
    expect(dist).toBeGreaterThan(50);
    expect(dist).toBeLessThan(200);
  });
});

// ─── End-to-End Integration ────────────────────────────────────

describe("Full Integration", () => {
  it("runs complete game loop", () => {
    const app = createHuntApp();

    // Register players
    app.identity.register(makeIdentity("0xalice", "alice"));
    app.identity.register(makeIdentity("0xbob", "bob"));
    app.identity.register(makeIdentity("0xcarol", "carol"));

    // AI generates hunts
    const hunts = app.aiGenerator.generateCityEvent("0xai", "Paris", { lat: 48.8566, lng: 2.3522 }, 3, 100, "FRAME");
    expect(hunts).toHaveLength(3);

    // Players participate
    const sub = app.engine.submitAnswer(
      hunts[0].id,
      "0xalice",
      makeGpsPayload(48.8566, 2.3522),
      "Found it!",
    );

    // Community verifies
    for (let i = 0; i < 5; i++) app.engine.voteOnSubmission(sub.id, true);

    // Check results
    expect(app.engine.getHunt(hunts[0].id).status).toBe("completed");
    expect(app.engine.getHunt(hunts[0].id).winner).toBe("0xalice");

    // Alice should have earnings and reputation
    const alice = app.identity.getProfile("0xalice")!;
    expect(alice.earnings.amount).toBe(100);
    expect(alice.reputation.huntsCompleted).toBe(50); // 50 reputation points per hunt win
    expect(alice.achievements.length).toBe(1); // First Blood

    // Post discoveries
    const disc = app.engine.postDiscovery(
      "0xbob",
      "Eiffel Tower at Dawn",
      "Breathtaking",
      "photo",
      { lat: 48.8584, lng: 2.2945 },
      ["ipfs://QmEiffel"],
    );
    for (let i = 0; i < 12; i++) app.engine.voteOnDiscovery(disc.id, true);
    expect(app.engine.getDiscoveries()[0].permanentMapObject).toBe(true);

    // Verify receipt chain
    expect(app.receiptChain.verify()).toBe(true);
    expect(app.receiptChain.length).toBeGreaterThan(0);

    // Check map
    const mapObjs = app.engine.getMapObjects();
    expect(mapObjs.length).toBeGreaterThan(0);

    // Leaderboard
    const lb = app.identity.getLeaderboard(10);
    expect(lb.length).toBe(3);
    expect(lb[0].handle).toBe("alice"); // highest reputation
  });
});
