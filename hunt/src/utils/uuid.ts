/**
 * HUNT dApp – Utilities
 *
 * Copyright (c) 2026 思捷娅科技 (SJYKJ)
 * MIT License
 */

/** Generate a random UUID v4 without relying on crypto.randomUUID (which may not be available in all test runners). */
export function uuid(): string {
  // FNV-1a based pseudo-random for deterministic-but-unique IDs
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  const seed = Date.now() ^ (Math.random() * 0xffffffff);
  const h1 = hex(seed);
  const h2 = hex((seed * 2654435761) >>> 0);
  const h3 = hex((seed * 2246822519) >>> 0);
  const h4 = hex((seed * 3266489917) >>> 0);
  return `${h1}-${h2.slice(0, 4)}-4${h2.slice(4)}-${h3.slice(0, 4)}-${h4.slice(0, 4)}-${h4}`;
}
