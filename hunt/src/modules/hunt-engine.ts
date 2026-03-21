/**
 * HUNT dApp – Hunt Engine
 * Core hunt lifecycle: create, start, submit, verify, reward.
 *
 * Copyright (c) 2026 思捷娅科技 (SJYKJ)
 * MIT License
 */

import type {
  Hunt,
  HuntCategory,
  HuntStatus,
  HuntReward,
  HuntRules,
  Submission,
  SubmissionStatus,
  SensorPayload,
  GeoBounds,
  VerificationMethod,
  MapObject,
  Discovery,
  MemeChallenge,
  Bounty,
} from "../types/index.js";
import { uuid } from "../utils/uuid.js";
import { ReceiptChain } from "./receipt-chain.js";
import { IdentityModule } from "./identity.js";

// ─── Hunt Creation & Lifecycle ─────────────────────────────────

export interface CreateHuntInput {
  creator: string;
  category: HuntCategory;
  title: string;
  description: string;
  clues: string;
  reward: HuntReward;
  rules: HuntRules;
  bounds?: GeoBounds;
  expiresAt?: number;
}

export class HuntEngine {
  private hunts = new Map<string, Hunt>();
  private submissions = new Map<string, Submission>();
  private memeChallenges = new Map<string, MemeChallenge>();
  private bounties = new Map<string, Bounty>();
  private discoveries = new Map<string, Discovery>();
  private mapObjects = new Map<string, MapObject>();
  private receiptChain: ReceiptChain;
  private identityModule: IdentityModule;

  constructor(receiptChain: ReceiptChain, identityModule: IdentityModule) {
    this.receiptChain = receiptChain;
    this.identityModule = identityModule;
  }

  // ─── Hunt CRUD ─────────────────────────────────────────────

  /** Create a new hunt. */
  createHunt(input: CreateHuntInput): Hunt {
    const id = "hunt_" + uuid().slice(0, 8);
    const receipt = this.receiptChain.append(input.creator, "hunt.create", { id, ...input });

    const hunt: Hunt = {
      id,
      creator: input.creator,
      category: input.category,
      status: "draft",
      title: input.title,
      description: input.description,
      clues: input.clues,
      reward: input.reward,
      rules: input.rules,
      bounds: input.bounds,
      participants: 0,
      winner: null,
      createdAt: Date.now(),
      expiresAt: input.expiresAt ?? null,
      receiptHash: receipt.hash,
    };

    this.hunts.set(id, hunt);

    // Add map object if geo-bounded
    if (input.bounds) {
      const mapObj: MapObject = {
        id: "map_" + uuid().slice(0, 8),
        type: "hunt",
        position: input.bounds.center,
        refId: id,
        icon: categoryIcon(input.category),
        visible: false, // visible only when active
      };
      this.mapObjects.set(mapObj.id, mapObj);
    }

    return hunt;
  }

  /** Activate a draft hunt. */
  activateHunt(huntId: string): Hunt {
    const hunt = this.getHunt(huntId);
    if (hunt.status !== "draft") throw new Error(`Cannot activate hunt in status: ${hunt.status}`);

    hunt.status = "active";
    this.receiptChain.append(hunt.creator, "hunt.activate", { huntId });

    // Make map object visible
    for (const mo of this.mapObjects.values()) {
      if (mo.refId === huntId) mo.visible = true;
    }

    return hunt;
  }

  /** Cancel a hunt. */
  cancelHunt(huntId: string): Hunt {
    const hunt = this.getHunt(huntId);
    if (hunt.status !== "draft" && hunt.status !== "active") {
      throw new Error(`Cannot cancel hunt in status: ${hunt.status}`);
    }

    hunt.status = "cancelled";
    this.receiptChain.append(hunt.creator, "hunt.cancel", { huntId });

    // Hide map object
    for (const mo of this.mapObjects.values()) {
      if (mo.refId === huntId) mo.visible = false;
    }

    return hunt;
  }

  /** Get a hunt by ID. */
  getHunt(huntId: string): Hunt {
    const hunt = this.hunts.get(huntId);
    if (!hunt) throw new Error(`Hunt not found: ${huntId}`);
    return hunt;
  }

  /** Get all hunts, optionally filtered. */
  getHunts(filter?: { status?: HuntStatus; category?: HuntCategory }): Hunt[] {
    let result = Array.from(this.hunts.values());
    if (filter?.status) result = result.filter((h) => h.status === filter.status);
    if (filter?.category) result = result.filter((h) => h.category === filter.category);
    return result.sort((a, b) => b.createdAt - a.createdAt);
  }

  // ─── Submissions ───────────────────────────────────────────

  /** Submit an answer to an active hunt. */
  submitAnswer(huntId: string, submitter: string, payload: SensorPayload, answer?: string): Submission {
    const hunt = this.getHunt(huntId);
    if (hunt.status !== "active") throw new Error(`Hunt is not active: ${hunt.status}`);

    // Check reputation gate
    if (hunt.rules.minReputation) {
      const profile = this.identityModule.getProfile(submitter);
      if (!profile || profile.reputation.level < hunt.rules.minReputation) {
        throw new Error(`Insufficient reputation level (need ${hunt.rules.minReputation})`);
      }
    }

    // Check submission limit
    const existingCount = Array.from(this.submissions.values()).filter(
      (s) => s.huntId === huntId && s.submitter === submitter,
    ).length;
    if (hunt.rules.maxSubmissions && existingCount >= hunt.rules.maxSubmissions) {
      throw new Error("Max submissions reached");
    }

    // GPS proximity check
    if (hunt.rules.proximityMeters && payload.gps && hunt.bounds) {
      const dist = haversine(
        payload.gps.lat,
        payload.gps.lng,
        hunt.bounds.center.lat,
        hunt.bounds.center.lng,
      );
      if (dist > hunt.rules.proximityMeters) {
        throw new Error(`GPS too far: ${dist.toFixed(0)}m (max ${hunt.rules.proximityMeters}m)`);
      }
    }

    const id = "sub_" + uuid().slice(0, 8);
    const receipt = this.receiptChain.append(submitter, "hunt.submit", {
      huntId,
      submissionId: id,
      hasAnswer: !!answer,
    });

    const submission: Submission = {
      id,
      huntId,
      submitter,
      status: "pending",
      sensor: payload,
      answer,
      verificationSignature: null,
      communityVotes: { for: 0, against: 0 },
      submittedAt: Date.now(),
      receiptHash: receipt.hash,
    };

    this.submissions.set(id, submission);
    hunt.participants++;

    return submission;
  }

  /** Verify a submission (agent or community). */
  verifySubmission(
    submissionId: string,
    accepted: boolean,
    method: VerificationMethod,
    signature?: string,
  ): Submission {
    const sub = this.submissions.get(submissionId);
    if (!sub) throw new Error(`Submission not found: ${submissionId}`);
    if (sub.status !== "pending") throw new Error(`Submission already ${sub.status}`);

    sub.status = accepted ? "accepted" : "rejected";
    sub.verificationSignature = signature ?? null;

    this.receiptChain.append("verifier", "hunt.verify", {
      submissionId,
      accepted,
      method,
    });

    // If accepted, claim the hunt
    if (accepted) {
      const hunt = this.hunts.get(sub.huntId);
      if (hunt && hunt.status === "active") {
        hunt.status = "completed";
        hunt.winner = sub.submitter;

        // Award reputation & earnings
        this.identityModule.awardReputation(sub.submitter, "huntsCompleted", 50);
        this.identityModule.addEarnings(sub.submitter, hunt.reward.amount, hunt.reward.token);

        // Achievement: first hunt win
        const profile = this.identityModule.getProfile(sub.submitter);
        if (profile && !profile.achievements.some((a) => a.id === "ach_first_hunt")) {
          this.identityModule.addAchievement(sub.submitter, {
            id: "ach_first_hunt",
            name: "First Blood",
            description: "Won your first hunt",
            icon: "🏆",
            unlockedAt: Date.now(),
            receiptHash: "0x",
          });
        }
      }
    }

    return sub;
  }

  /** Community vote on a submission. */
  voteOnSubmission(submissionId: string, voteFor: boolean): Submission {
    const sub = this.submissions.get(submissionId);
    if (!sub) throw new Error(`Submission not found: ${submissionId}`);
    if (sub.status !== "pending") throw new Error("Can only vote on pending submissions");

    if (voteFor) sub.communityVotes.for++;
    else sub.communityVotes.against++;

    // Auto-accept if threshold reached
    const total = sub.communityVotes.for + sub.communityVotes.against;
    if (total >= 5 && sub.communityVotes.for / total >= 0.7) {
      return this.verifySubmission(submissionId, true, "community_vote");
    }
    if (total >= 5 && sub.communityVotes.against / total >= 0.7) {
      return this.verifySubmission(submissionId, false, "community_vote");
    }

    return sub;
  }

  /** Get submissions for a hunt. */
  getSubmissions(huntId: string): Submission[] {
    return Array.from(this.submissions.values()).filter((s) => s.huntId === huntId);
  }

  // ─── Discoveries ───────────────────────────────────────────

  /** Post a discovery. */
  postDiscovery(
    discoverer: string,
    title: string,
    description: string,
    category: HuntCategory,
    location: { lat: number; lng: number },
    mediaUris: string[],
  ): Discovery {
    const id = "disc_" + uuid().slice(0, 8);
    const receipt = this.receiptChain.append(discoverer, "discovery.post", { id, title, category });

    const discovery: Discovery = {
      id,
      discoverer,
      title,
      description,
      category,
      location,
      mediaUris,
      communityVotes: { for: 0, against: 0 },
      permanentMapObject: false,
      createdAt: Date.now(),
      receiptHash: receipt.hash,
    };

    this.discoveries.set(id, discovery);

    // Add to map
    const mapObj: MapObject = {
      id: "map_" + uuid().slice(0, 8),
      type: "discovery",
      position: location,
      refId: id,
      icon: "📍",
      visible: true,
    };
    this.mapObjects.set(mapObj.id, mapObj);

    // Award reputation
    this.identityModule.awardReputation(discoverer, "discoveries", 10);

    return discovery;
  }

  /** Vote on a discovery. */
  voteOnDiscovery(discoveryId: string, voteFor: boolean): Discovery {
    const disc = this.discoveries.get(discoveryId);
    if (!disc) throw new Error(`Discovery not found: ${discoveryId}`);

    if (voteFor) disc.communityVotes.for++;
    else disc.communityVotes.against++;

    // Promote to permanent map object if popular
    if (!disc.permanentMapObject && disc.communityVotes.for >= 10) {
      disc.permanentMapObject = true;
      this.identityModule.awardReputation(disc.discoverer, "discoveries", 25);
    }

    return disc;
  }

  /** Get all discoveries. */
  getDiscoveries(): Discovery[] {
    return Array.from(this.discoveries.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  // ─── Meme Challenges ───────────────────────────────────────

  /** Create a meme challenge. */
  createMemeChallenge(
    creator: string,
    templateUri: string,
    title: string,
    description: string,
    reward: HuntReward,
    votingDeadline: number,
  ): MemeChallenge {
    const id = "meme_" + uuid().slice(0, 8);
    const receipt = this.receiptChain.append(creator, "meme.create", { id, title });

    const challenge: MemeChallenge = {
      id,
      creator,
      templateUri,
      title,
      description,
      reward,
      votingDeadline,
      submissions: [],
      winner: null,
      createdAt: Date.now(),
      receiptHash: receipt.hash,
    };

    this.memeChallenges.set(id, challenge);
    return challenge;
  }

  /** Submit a meme entry (as a media URI). */
  submitMeme(challengeId: string, submitter: string, mediaUri: string): MemeChallenge {
    const challenge = this.memeChallenges.get(challengeId);
    if (!challenge) throw new Error(`Meme challenge not found: ${challengeId}`);
    if (Date.now() > challenge.votingDeadline) throw new Error("Voting deadline passed");

    const subId = "memesub_" + uuid().slice(0, 8);
    const receipt = this.receiptChain.append(submitter, "meme.submit", {
      challengeId,
      submissionId: subId,
    });

    this.submissions.set(subId, {
      id: subId,
      huntId: challengeId,
      submitter,
      status: "pending",
      sensor: { custom: { mediaUri } },
      communityVotes: { for: 0, against: 0 },
      submittedAt: Date.now(),
      receiptHash: receipt.hash,
    });

    challenge.submissions.push(subId);
    return challenge;
  }

  /** Vote on a meme entry. */
  voteMeme(submissionId: string, voteFor: boolean): Submission {
    const sub = this.submissions.get(submissionId);
    if (!sub) throw new Error(`Submission not found: ${submissionId}`);

    if (voteFor) sub.communityVotes.for++;
    else sub.communityVotes.against++;

    return sub;
  }

  /** Resolve a meme challenge (pick winner by highest votes). */
  resolveMemeChallenge(challengeId: string): MemeChallenge | null {
    const challenge = this.memeChallenges.get(challengeId);
    if (!challenge) return null;
    if (challenge.winner) return challenge;

    let bestSub: Submission | null = null;
    let bestVotes = 0;

    for (const subId of challenge.submissions) {
      const sub = this.submissions.get(subId);
      if (!sub) continue;
      if (sub.communityVotes.for > bestVotes) {
        bestVotes = sub.communityVotes.for;
        bestSub = sub;
      }
    }

    if (bestSub) {
      challenge.winner = bestSub.submitter;
      this.identityModule.awardReputation(bestSub.submitter, "memeVotes", 30);
      this.identityModule.addEarnings(bestSub.submitter, challenge.reward.amount, challenge.reward.token);
      this.receiptChain.append("system", "meme.resolve", {
        challengeId,
        winner: bestSub.submitter,
        votes: bestVotes,
      });
    }

    return challenge;
  }

  /** Get all meme challenges. */
  getMemeChallenges(): MemeChallenge[] {
    return Array.from(this.memeChallenges.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  // ─── Bounties ─────────────────────────────────────────────

  /** Create a bounty with escrow. */
  createBounty(
    creator: string,
    title: string,
    description: string,
    reward: HuntReward,
    escrowAddress: string,
    expiresAt?: number,
  ): Bounty {
    const id = "bounty_" + uuid().slice(0, 8);
    const receipt = this.receiptChain.append(creator, "bounty.create", { id, title });

    const bounty: Bounty = {
      id,
      creator,
      title,
      description,
      reward,
      escrowAddress,
      status: "active",
      linkedHuntId: undefined,
      createdAt: Date.now(),
      expiresAt: expiresAt ?? null,
      receiptHash: receipt.hash,
    };

    this.bounties.set(id, bounty);

    // Optionally create linked hunt
    const hunt = this.createHunt({
      creator,
      category: "location",
      title,
      description,
      clues: description,
      reward,
      rules: { verification: ["gps", "community_vote"] },
    });
    bounty.linkedHuntId = hunt.id;
    this.activateHunt(hunt.id);

    return bounty;
  }

  /** Get all bounties. */
  getBounties(): Bounty[] {
    return Array.from(this.bounties.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  // ─── Map ──────────────────────────────────────────────────

  /** Get all visible map objects within a bounding box. */
  getMapObjects(
    bounds?: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  ): MapObject[] {
    let objects = Array.from(this.mapObjects.values()).filter((o) => o.visible);
    if (bounds) {
      objects = objects.filter(
        (o) =>
          o.position.lat >= bounds.minLat &&
          o.position.lat <= bounds.maxLat &&
          o.position.lng >= bounds.minLng &&
          o.position.lng <= bounds.maxLng,
      );
    }
    return objects;
  }
}

// ─── Utility Functions ─────────────────────────────────────────

/** Calculate haversine distance between two geo points in meters. */
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Map hunt category to icon. */
function categoryIcon(category: HuntCategory): string {
  const icons: Record<HuntCategory, string> = {
    location: "📍",
    photo: "📸",
    puzzle: "🧩",
    meme: "😂",
    mystery: "🔮",
    creative: "🎨",
    micro_task: "✅",
    community: "👥",
    sponsor: "🏪",
  };
  return icons[category] ?? "🎯";
}
