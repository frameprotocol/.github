/**
 * HUNT dApp – AI Hunt Generator
 * Agents generate hunts automatically based on parameters.
 *
 * Copyright (c) 2026 思捷娅科技 (SJYKJ)
 * MIT License
 */

import type { HuntCategory, HuntRules, GeoBounds } from "../types/index.js";
import { HuntEngine, type CreateHuntInput } from "./hunt-engine.js";

export interface GeneratedHuntTemplate {
  title: string;
  description: string;
  clues: string;
  category: HuntCategory;
  rules: HuntRules;
  bounds?: GeoBounds;
}

const HUNT_TEMPLATES: GeneratedHuntTemplate[] = [
  {
    title: "Find the Hidden Graffiti Wall",
    description: "Locate the street art wall tagged with the FRAME logo near the city center.",
    clues: "Look near the old train station. The wall faces east. It was painted last month.",
    category: "photo",
    rules: { verification: ["gps", "image_analysis"], proximityMeters: 50 },
    bounds: { center: { lat: 40.7128, lng: -74.006 }, radiusMeters: 2000 },
  },
  {
    title: "Decode the Cipher Message",
    description: "A cipher message is hidden in three locations around downtown. Decode all three to solve the mystery.",
    clues: "First clue: 'The owl watches at midnight from the northern tower.' Second and third clues revealed after first.",
    category: "puzzle",
    rules: { verification: ["community_vote"], maxSubmissions: 3 },
  },
  {
    title: "Weirdest Street Photo Challenge",
    description: "Capture the strangest thing you can find on your walk today. Community votes for the winner.",
    clues: "Be creative. Be weird. Be original.",
    category: "meme",
    rules: { verification: ["community_vote"], maxSubmissions: 1 },
  },
  {
    title: "Historic Building Documentation",
    description: "Find and photograph a building older than 100 years in your area. Include the address and a brief description.",
    clues: "Check city records, look for plaques, or ask locals.",
    category: "location",
    rules: { verification: ["gps", "image_analysis", "timestamp"], proximityMeters: 100 },
  },
  {
    title: "Rare Plant Discovery",
    description: "Document a rare or unusual plant species in your neighborhood. Include photo and location.",
    clues: "Check parks, gardens, wild areas. Look for unusual colors, shapes, or growth patterns.",
    category: "creative",
    rules: { verification: ["image_analysis", "gps"] },
  },
  {
    title: "Best Sunset Capture",
    description: "Capture the most stunning sunset photo from a unique vantage point in the city.",
    clues: "Think elevated. Think water reflections. Think silhouettes.",
    category: "photo",
    rules: { verification: ["gps", "timestamp", "community_vote"], maxSubmissions: 1 },
  },
  {
    title: "Secret Viewpoint Discovery",
    description: "Find a hidden or little-known viewpoint with a great view of the city skyline.",
    clues: "Ask locals. Explore rooftops (safely). Check hiking trails near the city.",
    category: "discovery",
    rules: { verification: ["gps", "image_analysis"], proximityMeters: 200 },
  },
  {
    title: "Coffee Shop Treasure Hunt",
    description: "Visit 3 independent coffee shops and collect one unique item from each (napkin art, stamp, etc.).",
    clues: "Start from the oldest cafe in the district. Each barista has the next clue.",
    category: "sponsor",
    rules: { verification: ["gps", "image_analysis", "community_vote"] },
  },
];

export class AIHuntGenerator {
  private engine: HuntEngine;
  private agentId: string;

  constructor(engine: HuntEngine, agentId: string) {
    this.engine = engine;
    this.agentId = agentId;
  }

  /** Generate a random hunt from templates. */
  generateRandom(creator: string, rewardAmount: number, rewardToken: string): ReturnType<HuntEngine["createHunt"]> {
    const template = HUNT_TEMPLATES[Math.floor(Math.random() * HUNT_TEMPLATES.length)];

    const input: CreateHuntInput = {
      creator: this.agentId,
      category: template.category,
      title: template.title,
      description: template.description,
      clues: template.clues,
      reward: { amount: rewardAmount, token: rewardToken },
      rules: template.rules,
      bounds: template.bounds,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    const hunt = this.engine.createHunt(input);
    this.engine.activateHunt(hunt.id);
    return hunt;
  }

  /** Generate a location-specific hunt near given coordinates. */
  generateNearLocation(
    creator: string,
    center: { lat: number; lng: number },
    rewardAmount: number,
    rewardToken: string,
  ): ReturnType<HuntEngine["createHunt"]> {
    const locationTemplates = HUNT_TEMPLATES.filter(
      (t) => t.category === "location" || t.category === "photo" || t.category === "discovery",
    );
    const template = locationTemplates[Math.floor(Math.random() * locationTemplates.length)];

    const bounds: GeoBounds = {
      center,
      radiusMeters: template.bounds?.radiusMeters ?? 1000,
    };

    const input: CreateHuntInput = {
      creator: this.agentId,
      category: template.category,
      title: `[${center.lat.toFixed(2)}, ${center.lng.toFixed(2)}] ${template.title}`,
      description: template.description,
      clues: template.clues,
      reward: { amount: rewardAmount, token: rewardToken },
      rules: { ...template.rules, proximityMeters: template.rules.proximityMeters ?? 200 },
      bounds,
      expiresAt: Date.now() + 3 * 24 * 60 * 60 * 1000,
    };

    const hunt = this.engine.createHunt(input);
    this.engine.activateHunt(hunt.id);
    return hunt;
  }

  /** Generate multiple hunts for a city event. */
  generateCityEvent(
    creator: string,
    cityName: string,
    center: { lat: number; lng: number },
    huntCount: number,
    rewardPerHunt: number,
    rewardToken: string,
  ): ReturnType<HuntEngine["createHunt"]>[] {
    const hunts: ReturnType<HuntEngine["createHunt"]>[] = [];

    for (let i = 0; i < Math.min(huntCount, HUNT_TEMPLATES.length); i++) {
      const template = HUNT_TEMPLATES[i];
      const offset = (i / huntCount) * 0.05; // spread hunts across ~5km
      const angle = (i / huntCount) * Math.PI * 2;

      const bounds: GeoBounds = {
        center: {
          lat: center.lat + Math.cos(angle) * offset,
          lng: center.lng + Math.sin(angle) * offset,
        },
        radiusMeters: template.bounds?.radiusMeters ?? 500,
      };

      const input: CreateHuntInput = {
        creator: this.agentId,
        category: template.category,
        title: `[${cityName}] ${template.title}`,
        description: template.description,
        clues: template.clues,
        reward: { amount: rewardPerHunt, token: rewardToken },
        rules: { ...template.rules, proximityMeters: template.rules.proximityMeters ?? 300 },
        bounds,
        expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
      };

      const hunt = this.engine.createHunt(input);
      this.engine.activateHunt(hunt.id);
      hunts.push(hunt);
    }

    return hunts;
  }
}
