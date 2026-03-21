/**
 * HUNT dApp – Identity Module
 * Manages cryptographic identities, reputations, and profiles.
 *
 * Copyright (c) 2026 思捷娅科技 (SJYKJ)
 * MIT License
 */

import type {
  FrameIdentity,
  PlayerProfile,
  Reputation,
  Achievement,
  Artifact,
  HuntReceipt,
} from "../types/index.js";
import { ReceiptChain } from "./receipt-chain.js";

export class IdentityModule {
  private profiles = new Map<string, PlayerProfile>();
  private receiptChain: ReceiptChain;

  constructor(receiptChain: ReceiptChain) {
    this.receiptChain = receiptChain;
  }

  /** Register a new player identity. */
  register(identity: FrameIdentity): HuntReceipt {
    if (this.profiles.has(identity.publicKey)) {
      throw new Error(`Identity already registered: ${identity.publicKey}`);
    }

    const profile: PlayerProfile = {
      identity,
      reputation: this.emptyReputation(),
      achievements: [],
      artifacts: [],
      joinedAt: Date.now(),
      earnings: { amount: 0, token: "FRAME" },
    };

    this.profiles.set(identity.publicKey, profile);

    return this.receiptChain.append(identity.publicKey, "identity.register", {
      handle: identity.handle,
    });
  }

  /** Get a player profile. */
  getProfile(publicKey: string): PlayerProfile | undefined {
    return this.profiles.get(publicKey);
  }

  /** Award reputation points. */
  awardReputation(publicKey: string, category: keyof Omit<Reputation, "total" | "level">, points: number): HuntReceipt {
    const profile = this.profiles.get(publicKey);
    if (!profile) throw new Error(`Profile not found: ${publicKey}`);

    profile.reputation[category] += points;
    profile.reputation.total += points;
    profile.reputation.level = this.calculateLevel(profile.reputation.total);

    return this.receiptChain.append("system", "reputation.award", {
      target: publicKey,
      category,
      points,
      total: profile.reputation.total,
      level: profile.reputation.level,
    });
  }

  /** Add an achievement to a player. */
  addAchievement(publicKey: string, achievement: Achievement): HuntReceipt {
    const profile = this.profiles.get(publicKey);
    if (!profile) throw new Error(`Profile not found: ${publicKey}`);

    const exists = profile.achievements.some((a) => a.id === achievement.id);
    if (exists) throw new Error(`Achievement already unlocked: ${achievement.id}`);

    profile.achievements.push(achievement);

    return this.receiptChain.append(publicKey, "achievement.unlock", {
      achievementId: achievement.id,
      name: achievement.name,
    });
  }

  /** Add a collected artifact. */
  addArtifact(publicKey: string, artifact: Artifact): HuntReceipt {
    const profile = this.profiles.get(publicKey);
    if (!profile) throw new Error(`Profile not found: ${publicKey}`);

    profile.artifacts.push(artifact);

    return this.receiptChain.append(publicKey, "artifact.collect", {
      artifactId: artifact.id,
      name: artifact.name,
      rarity: artifact.rarity,
    });
  }

  /** Add earnings to a player. */
  addEarnings(publicKey: string, amount: number, token: string): HuntReceipt {
    const profile = this.profiles.get(publicKey);
    if (!profile) throw new Error(`Profile not found: ${publicKey}`);

    if (profile.earnings.token !== token && profile.earnings.amount > 0) {
      // Multi-token: extend in production
      profile.earnings = { amount, token };
    } else {
      profile.earnings.amount += amount;
      profile.earnings.token = token;
    }

    return this.receiptChain.append(publicKey, "earnings.add", {
      amount,
      token,
      total: profile.earnings.amount,
    });
  }

  /** Get all registered players. */
  getAllPlayers(): PlayerProfile[] {
    return Array.from(this.profiles.values());
  }

  /** Build a leaderboard sorted by reputation. */
  getLeaderboard(limit = 10): Array<{ rank: number; handle: string; score: number; huntWins: number; discoveries: number }> {
    return Array.from(this.profiles.values())
      .sort((a, b) => b.reputation.total - a.reputation.total)
      .slice(0, limit)
      .map((p, i) => ({
        rank: i + 1,
        handle: p.identity.handle,
        score: p.reputation.total,
        huntWins: p.reputation.huntsCompleted,
        discoveries: p.reputation.discoveries,
      }));
  }

  private emptyReputation(): Reputation {
    return {
      total: 0,
      discoveries: 0,
      huntsCompleted: 0,
      puzzlesSolved: 0,
      memeVotes: 0,
      level: 1,
    };
  }

  private calculateLevel(totalPoints: number): number {
    return Math.max(1, Math.floor(Math.sqrt(totalPoints / 100)) + 1);
  }
}
