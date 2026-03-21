# HUNT – Technical Specification

> A Real-World Meme / Treasure / Discovery Game on FRAME Protocol

## Overview

HUNT is a social dApp that transforms the real world into an interactive game. Players earn rewards by discovering, creating, solving, and sharing content. All interactions produce verifiable receipts through the FRAME kernel.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  FRAME Kernel                     │
│  ┌───────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  Intent   │→ │   dApp   │→ │   Receipt    │  │
│  │  Router   │  │  Engine  │  │   Chain      │  │
│  └───────────┘  └──────────┘  └──────────────┘  │
│       │              │              │            │
│  ┌────┴────┐   ┌─────┴─────┐  ┌────┴────┐      │
│  │Identity │   │  HUNT     │  │ State   │      │
│  │  Vault  │   │  Modules  │  │  Root   │      │
│  └─────────┘   └───────────┘  └─────────┘      │
└─────────────────────────────────────────────────┘
```

## Modules

### 1. Identity Module (`identity.ts`)
- Player registration with FRAME cryptographic identity
- Reputation scoring across 4 dimensions
- Achievement and artifact tracking
- Earnings ledger per player
- Leaderboard generation

### 2. Hunt Engine (`hunt-engine.ts`)
- Hunt lifecycle: create → activate → submit → verify → complete
- 9 hunt categories (location, photo, puzzle, meme, mystery, creative, micro_task, community, sponsor)
- Multi-method verification (GPS, image analysis, community voting, agent validation)
- GPS proximity checks via haversine formula
- Reputation gates and submission limits
- Community voting with auto-accept/reject thresholds (70%)
- Discovery system with permanent map promotion
- Meme challenge economy with voting-based resolution
- Bounty creation with linked hunts and escrow
- Map object management with geo-bounds filtering

### 3. AI Hunt Generator (`ai-generator.ts`)
- Template-based hunt generation
- Location-specific hunt spawning near coordinates
- City event generation (multi-hunt events spread across an area)
- 8 pre-built hunt templates

### 4. Receipt Chain (`receipt-chain.ts`)
- Deterministic hash-linked chain of execution receipts
- State root computation after each receipt
- Full chain integrity verification

## Verification Methods

| Method | Description | Use Cases |
|--------|-------------|-----------|
| GPS | Location proximity check | Location hunts, scavenger hunts |
| Timestamp | Time-locked verification | Time-sensitive challenges |
| Image Analysis | AI-based media validation | Photo hunts, discovery verification |
| Sensor Data | Accelerometer, compass | Motion-based challenges |
| Community Vote | Democratic approval (70% threshold) | Creative, meme challenges |
| Agent Validation | AI agent verification | AI-generated hunts |
| Multi | Combines multiple methods | High-value bounties |

## Reputation System

| Level | Points Required | Unlocks |
|-------|----------------|---------|
| 1 | 0 | Basic hunts |
| 2 | 100 | Photo hunts |
| 3 | 400 | Puzzle hunts, meme voting |
| 5 | 1,600 | Mystery hunts, bounty creation |
| 10 | 8,100 | Legendary hunts, sponsor access |

### Reputation Sources
- **Discoveries**: +10 per post, +25 if promoted to permanent
- **Hunts Completed**: +50 per win
- **Puzzles Solved**: +30 per solve
- **Meme Votes**: +30 per challenge won

## Data Flow

```
Player Action → Intent → FRAME Router → HUNT Engine
    → State Mutation → Receipt Generation → Chain Append
    → State Root Update → Response
```

## Security

- All actions produce signed receipts
- GPS spoofing mitigated by haversine distance checks
- Submission limits prevent spam
- Reputation gates restrict high-value hunts
- Community voting requires minimum 5 votes for auto-resolution
- Escrow system for bounty payouts

## Integration with FRAME

HUNT runs as a FRAME dApp:
- **Intent routing**: All player actions are FRAME intents
- **Capability system**: Hunt creation, submission, verification are scoped capabilities
- **Receipt chain**: Every action produces a verifiable receipt
- **State root**: Deterministic state root for the entire HUNT state
- **Identity**: Uses FRAME's Ed25519 identity system
- **Federation**: Receipt chains can be synchronized across nodes

## API Surface

```typescript
// Create app
const app = createHuntApp();

// Identity
app.identity.register(identity);
app.identity.awardReputation(publicKey, category, points);
app.identity.getLeaderboard(limit);
app.identity.addAchievement(publicKey, achievement);

// Hunts
app.engine.createHunt(input);
app.engine.activateHunt(huntId);
app.engine.submitAnswer(huntId, submitter, payload, answer);
app.engine.verifySubmission(submissionId, accepted, method);
app.engine.voteOnSubmission(submissionId, voteFor);

// Discoveries
app.engine.postDiscovery(discoverer, title, description, category, location, mediaUris);
app.engine.voteOnDiscovery(discoveryId, voteFor);

// Memes
app.engine.createMemeChallenge(creator, templateUri, title, description, reward, deadline);
app.engine.submitMeme(challengeId, submitter, mediaUri);
app.engine.resolveMemeChallenge(challengeId);

// Bounties
app.engine.createBounty(creator, title, description, reward, escrowAddress);

// AI Generation
app.aiGenerator.generateRandom(creator, amount, token);
app.aiGenerator.generateNearLocation(creator, center, amount, token);
app.aiGenerator.generateCityEvent(creator, city, center, count, amount, token);

// Map
app.engine.getMapObjects(bounds);
```
