/**
 * HUNT dApp – Core Type Definitions
 * 
 * Copyright (c) 2026 思捷娅科技 (SJYKJ)
 * MIT License
 */

// ─── Primitives ────────────────────────────────────────────────

export type Timestamp = number; // epoch-ms
export type GeoPoint = { lat: number; lng: number };
export type HexString = string; // 0x-prefixed

// ─── Identity ──────────────────────────────────────────────────

export interface FrameIdentity {
  /** Ed25519 public key */
  publicKey: HexString;
  /** Display name */
  handle: string;
  /** Verifiable profile URI */
  profileUri?: string;
}

export interface Reputation {
  total: number;
  discoveries: number;
  huntsCompleted: number;
  puzzlesSolved: number;
  memeVotes: number;
  level: number;
}

export interface PlayerProfile {
  identity: FrameIdentity;
  reputation: Reputation;
  achievements: Achievement[];
  artifacts: Artifact[];
  joinedAt: Timestamp;
  earnings: TokenAmount;
}

// ─── Hunts ─────────────────────────────────────────────────────

export type HuntCategory =
  | "location"
  | "photo"
  | "puzzle"
  | "meme"
  | "mystery"
  | "creative"
  | "micro_task"
  | "community"
  | "sponsor";

export type HuntStatus =
  | "draft"
  | "active"
  | "claimed"
  | "completed"
  | "expired"
  | "cancelled";

export type VerificationMethod =
  | "gps"
  | "timestamp"
  | "image_analysis"
  | "sensor_data"
  | "community_vote"
  | "agent_validation"
  | "multi";

export interface HuntReward {
  /** Token amount in smallest unit */
  amount: number;
  /** Token symbol (e.g. "FRAME", "USDT") */
  token: string;
  /** Optional sponsor address */
  sponsor?: HexString;
}

export interface GeoBounds {
  center: GeoPoint;
  radiusMeters: number;
}

export interface HuntRules {
  /** Allowed verification methods */
  verification: VerificationMethod[];
  /** Maximum submissions per player */
  maxSubmissions?: number;
  /** Time window (ms) to complete after starting */
  timeLimitMs?: number;
  /** Required GPS proximity in meters */
  proximityMeters?: number;
  /** Minimum reputation level to participate */
  minReputation?: number;
}

export interface Hunt {
  id: string;
  /** Ed25519 public key of creator */
  creator: HexString;
  category: HuntCategory;
  status: HuntStatus;
  title: string;
  description: string;
  /** Markdown content with clues */
  clues: string;
  reward: HuntReward;
  rules: HuntRules;
  /** Optional geo constraint */
  bounds?: GeoBounds;
  /** Number of participants */
  participants: number;
  /** Winner's public key, null if not yet claimed */
  winner: HexString | null;
  createdAt: Timestamp;
  expiresAt: Timestamp | null;
  /** Receipt hash from FRAME kernel */
  receiptHash: HexString;
}

// ─── Submissions ───────────────────────────────────────────────

export type SubmissionStatus = "pending" | "accepted" | "rejected" | "disputed";

export interface SensorPayload {
  gps?: { lat: number; lng: number; accuracy: number; timestamp: Timestamp };
  imageHashes?: string[];
  audioHash?: string;
  accelerometer?: number[];
  /** Key-value pairs for extensibility */
  custom: Record<string, string>;
}

export interface Submission {
  id: string;
  huntId: string;
  /** Submitter's identity public key */
  submitter: HexString;
  status: SubmissionStatus;
  /** Verification payload with sensor data */
  sensor: SensorPayload;
  /** Text answer for puzzle-type hunts */
  answer?: string;
  /** IPFS / content hash of attached media */
  mediaUri?: string;
  /** Verification agent signature or null */
  verificationSignature: HexString | null;
  communityVotes: { for: number; against: number };
  submittedAt: Timestamp;
  /** FRAME receipt hash */
  receiptHash: HexString;
}

// ─── Meme Economy ──────────────────────────────────────────────

export interface MemeChallenge {
  id: string;
  creator: HexString;
  /** IPFS CID of the base meme template */
  templateUri: string;
  title: string;
  description: string;
  reward: HuntReward;
  /** Voting deadline */
  votingDeadline: Timestamp;
  submissions: string[]; // submission IDs
  winner: HexString | null;
  createdAt: Timestamp;
  receiptHash: HexString;
}

// ─── Bounties ──────────────────────────────────────────────────

export interface Bounty {
  id: string;
  creator: HexString;
  title: string;
  description: string;
  reward: HuntReward;
  /** Escrow contract address on FRAME */
  escrowAddress: HexString;
  status: HuntStatus;
  linkedHuntId?: string;
  createdAt: Timestamp;
  expiresAt: Timestamp | null;
  receiptHash: HexString;
}

// ─── Artifacts & Achievements ──────────────────────────────────

export type ArtifactRarity = "common" | "rare" | "epic" | "legendary";

export interface Artifact {
  id: string;
  name: string;
  description: string;
  rarity: ArtifactRarity;
  /** IPFS CID of media */
  mediaUri?: string;
  /** Origin hunt ID */
  originHuntId?: string;
  owner: HexString;
  transferable: boolean;
  createdAt: Timestamp;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji
  unlockedAt: Timestamp;
  receiptHash: HexString;
}

// ─── Leaderboard ───────────────────────────────────────────────

export type LeaderboardScope = "global" | "community" | "region";

export interface LeaderboardEntry {
  rank: number;
  handle: string;
  score: number;
  huntWins: number;
  discoveries: number;
}

// ─── Discovery ─────────────────────────────────────────────────

export interface Discovery {
  id: string;
  discoverer: HexString;
  title: string;
  description: string;
  category: HuntCategory;
  /** Where it was found */
  location: GeoPoint;
  mediaUris: string[];
  communityVotes: { for: number; against: number };
  permanentMapObject: boolean;
  createdAt: Timestamp;
  receiptHash: HexString;
}

// ─── Community / Worlds ────────────────────────────────────────

export interface Community {
  id: string;
  name: string;
  description: string;
  theme: string;
  members: HexString[];
  creator: HexString;
  huntIds: string[];
  createdAt: Timestamp;
}

// ─── Receipt (FRAME Kernel) ────────────────────────────────────

export interface HuntReceipt {
  /** Previous receipt hash (chain link) */
  prevReceiptHash: HexString;
  /** Current receipt hash */
  hash: HexString;
  /** Actor (identity public key) */
  actor: HexString;
  /** Intent type */
  intent: string;
  /** dApp that processed this intent */
  dappId: string;
  /** Timestamp (ms) */
  timestamp: Timestamp;
  /** State root after execution */
  stateRoot: HexString;
  /** Ed25519 signature */
  signature: HexString;
}

// ─── Map ───────────────────────────────────────────────────────

export interface MapObject {
  id: string;
  type: "hunt" | "discovery" | "artifact" | "event" | "puzzle";
  position: GeoPoint;
  /** Reference ID (hunt ID, discovery ID, etc.) */
  refId: string;
  /** Optional icon or emoji */
  icon?: string;
  visible: boolean;
}

// ─── Token ─────────────────────────────────────────────────────

export interface TokenAmount {
  amount: number;
  token: string;
}

// ─── App State ─────────────────────────────────────────────────

export interface HuntAppState {
  hunts: Map<string, Hunt>;
  submissions: Map<string, Submission>;
  memeChallenges: Map<string, MemeChallenge>;
  bounties: Map<string, Bounty>;
  discoveries: Map<string, Discovery>;
  players: Map<string, PlayerProfile>;
  communities: Map<string, Community>;
  mapObjects: Map<string, MapObject>;
  leaderboards: Map<string, LeaderboardEntry[]>;
  /** Receipt chain */
  receipts: HuntReceipt[];
  /** Global state root */
  stateRoot: HexString;
  version: string;
}
