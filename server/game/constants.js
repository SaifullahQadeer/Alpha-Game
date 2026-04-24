/**
 * Shared game constants. If you change these, update client/js/config.js
 * to keep prediction/rendering in sync. Both sides read from their own
 * file to avoid build tooling for the MVP.
 */
'use strict';

// -----------------------------------------------------------------------
// MAPS — each map has walls (AABB obstacles, authoritative for collision)
// and a `theme` bundle consumed by the client for visual rendering.
// Decorations are non-colliding scene ornaments (columns, braziers, etc.).
// -----------------------------------------------------------------------

const MAPS = {
  'neon-arena': {
    id: 'neon-arena',
    name: 'Neon Arena',
    subtitle: 'CYBERPUNK · FREE FOR ALL',
    description: 'Rain-slick grid under magenta skies. The classic.',
    size: 60,
    wallHeight: 4,
    theme: {
      style: 'neon',
      skyTop: 0x0a0520, skyBottom: 0x05070d,
      fogColor: 0x05070d, fogNear: 30, fogFar: 120,
      ambient: 0x334466, ambientIntensity: 0.6,
      sunColor: 0xa8d8ff, sunIntensity: 0.9, sunPos: [30, 40, 20],
      accent: 0x00e6ff, accent2: 0xff2bd1,
      groundColor: 0x0a1020, groundRoughness: 0.9, groundMetalness: 0.1,
      gridColor: 0x00e6ff, gridColor2: 0x0a3040, gridOpacity: 0.25,
      wallColor: 0x1a2338, wallEmissive: 0x00394a, wallEmissiveIntensity: 0.4,
      obstacleColor: 0x1a1530, obstacleEmissive: 0x3a0a44, obstacleEmissiveIntensity: 0.35,
      outlineColor: 0xff2bd1, stripColor: 0x00e6ff,
    },
    walls: [
      { pos: [-12, 1.5, -12], size: [4, 3, 4] },
      { pos: [ 12, 1.5,  12], size: [4, 3, 4] },
      { pos: [-12, 1.5,  12], size: [6, 3, 2] },
      { pos: [ 12, 1.5, -12], size: [2, 3, 6] },
      { pos: [  0, 1.5,   0], size: [3, 3, 3] },
      { pos: [-20, 1.5,   0], size: [2, 3, 8] },
      { pos: [ 20, 1.5,   0], size: [2, 3, 8] },
      { pos: [  0, 1.5, -20], size: [8, 3, 2] },
      { pos: [  0, 1.5,  20], size: [8, 3, 2] },
    ],
    decorations: [
      { kind: 'pointLight', pos: [-20, 6, -20], color: 0x00e6ff, intensity: 1.2, dist: 80 },
      { kind: 'pointLight', pos: [ 20, 6,  20], color: 0xff2bd1, intensity: 1.2, dist: 80 },
      { kind: 'hologramPillar', pos: [-24, 0, -24], color: 0x00e6ff },
      { kind: 'hologramPillar', pos: [ 24, 0,  24], color: 0xff2bd1 },
      { kind: 'hologramPillar', pos: [-24, 0,  24], color: 0xff2bd1 },
      { kind: 'hologramPillar', pos: [ 24, 0, -24], color: 0x00e6ff },
    ],
  },

  'royal-palace': {
    id: 'royal-palace',
    name: 'Royal Palace',
    subtitle: 'MARBLE HALLS · GOLDEN THRONE',
    description: 'Columns of white marble and gilded arches. A king\'s duel.',
    size: 60,
    wallHeight: 6,
    theme: {
      style: 'palace',
      skyTop: 0x1a1b3a, skyBottom: 0x4a3a2a,
      fogColor: 0x2a2030, fogNear: 40, fogFar: 150,
      ambient: 0xfff2cc, ambientIntensity: 0.55,
      sunColor: 0xffe3a3, sunIntensity: 1.1, sunPos: [40, 60, 20],
      accent: 0xffc36b, accent2: 0xd4af37,
      groundColor: 0xe8e3d5, groundRoughness: 0.35, groundMetalness: 0.15,
      gridColor: 0xd4af37, gridColor2: 0xb09060, gridOpacity: 0.18,
      wallColor: 0xf2ead4, wallEmissive: 0x2a1a0a, wallEmissiveIntensity: 0.05,
      obstacleColor: 0xe6d79b, obstacleEmissive: 0x3a2810, obstacleEmissiveIntensity: 0.1,
      outlineColor: 0xd4af37, stripColor: 0xffd86b,
    },
    walls: [
      // Throne podium at north
      { pos: [ 0, 1, -24], size: [14, 2, 6] },
      // Central fountain block
      { pos: [ 0, 1.5,  0], size: [5, 3, 5] },
      // Flanking guard walls
      { pos: [-18, 2, -6], size: [2, 4, 10] },
      { pos: [ 18, 2, -6], size: [2, 4, 10] },
      { pos: [-18, 2,  8], size: [2, 4, 6] },
      { pos: [ 18, 2,  8], size: [2, 4, 6] },
      // South courtyard benches
      { pos: [-10, 0.6, 18], size: [6, 1.2, 2] },
      { pos: [ 10, 0.6, 18], size: [6, 1.2, 2] },
      // Column bases (tall decorative columns are also colliders)
      { pos: [-10, 3, -10], size: [1.6, 6, 1.6] },
      { pos: [ 10, 3, -10], size: [1.6, 6, 1.6] },
      { pos: [-10, 3,  10], size: [1.6, 6, 1.6] },
      { pos: [ 10, 3,  10], size: [1.6, 6, 1.6] },
    ],
    decorations: [
      { kind: 'column', pos: [-10, 0, -10], height: 8, color: 0xf2ead4, capColor: 0xd4af37 },
      { kind: 'column', pos: [ 10, 0, -10], height: 8, color: 0xf2ead4, capColor: 0xd4af37 },
      { kind: 'column', pos: [-10, 0,  10], height: 8, color: 0xf2ead4, capColor: 0xd4af37 },
      { kind: 'column', pos: [ 10, 0,  10], height: 8, color: 0xf2ead4, capColor: 0xd4af37 },
      { kind: 'throne',   pos: [0, 2, -24], color: 0xd4af37 },
      { kind: 'fountain', pos: [0, 0, 0],   color: 0x99c7ff },
      { kind: 'torch',    pos: [-18, 3, -16], color: 0xffb347 },
      { kind: 'torch',    pos: [ 18, 3, -16], color: 0xffb347 },
      { kind: 'torch',    pos: [-18, 3,  16], color: 0xffb347 },
      { kind: 'torch',    pos: [ 18, 3,  16], color: 0xffb347 },
      { kind: 'redCarpet', pos: [0, 0.02, -10], size: [5, 30] },
      { kind: 'pointLight', pos: [0, 8, -20], color: 0xffc36b, intensity: 1.5, dist: 50 },
      { kind: 'pointLight', pos: [0, 10, 0],  color: 0xffe3a3, intensity: 1.2, dist: 60 },
    ],
  },

  'desert-temple': {
    id: 'desert-temple',
    name: 'Desert Temple',
    subtitle: 'SANDSTONE RUINS · BLAZING SUN',
    description: 'Crumbling ziggurats under a merciless sun.',
    size: 60,
    wallHeight: 5,
    theme: {
      style: 'desert',
      skyTop: 0xffa657, skyBottom: 0xffd99a,
      fogColor: 0xe8c288, fogNear: 50, fogFar: 160,
      ambient: 0xffd9a0, ambientIntensity: 0.75,
      sunColor: 0xfff1b0, sunIntensity: 1.6, sunPos: [60, 80, 40],
      accent: 0xd97b3b, accent2: 0x8b4513,
      groundColor: 0xd4a86a, groundRoughness: 0.98, groundMetalness: 0.0,
      gridColor: 0xb87a45, gridColor2: 0x7a5030, gridOpacity: 0.12,
      wallColor: 0xc89560, wallEmissive: 0x2a1505, wallEmissiveIntensity: 0.08,
      obstacleColor: 0xb07742, obstacleEmissive: 0x2a1505, obstacleEmissiveIntensity: 0.05,
      outlineColor: 0x8b4513, stripColor: 0xffc07a,
    },
    walls: [
      // Stepped pyramid at center
      { pos: [0, 1, 0], size: [12, 2, 12] },
      { pos: [0, 2.5, 0], size: [8, 1, 8] },
      { pos: [0, 3.5, 0], size: [4, 1, 4] },
      // Ruined outer blocks
      { pos: [-22, 1.5, -10], size: [4, 3, 4] },
      { pos: [ 22, 1.5,  10], size: [4, 3, 4] },
      { pos: [-22, 1.5,  10], size: [4, 3, 4] },
      { pos: [ 22, 1.5, -10], size: [4, 3, 4] },
      // Broken wall segments
      { pos: [-12, 1, -22], size: [8, 2, 1.5] },
      { pos: [ 12, 1,  22], size: [8, 2, 1.5] },
      { pos: [  0, 2,  24], size: [6, 4, 1.5] },
    ],
    decorations: [
      { kind: 'obelisk', pos: [-22, 0, -22], color: 0xc89560, capColor: 0xffd86b },
      { kind: 'obelisk', pos: [ 22, 0,  22], color: 0xc89560, capColor: 0xffd86b },
      { kind: 'obelisk', pos: [ 22, 0, -22], color: 0xc89560, capColor: 0xffd86b },
      { kind: 'obelisk', pos: [-22, 0,  22], color: 0xc89560, capColor: 0xffd86b },
      { kind: 'palm', pos: [-26, 0,  0] },
      { kind: 'palm', pos: [ 26, 0,  0] },
      { kind: 'palm', pos: [  0, 0, -26] },
      { kind: 'crackedStone', pos: [-6, 0, -18], size: [3, 0.6, 3] },
      { kind: 'crackedStone', pos: [ 6, 0,  18], size: [3, 0.6, 3] },
      { kind: 'torch', pos: [-12, 3.5, 0], color: 0xff7830 },
      { kind: 'torch', pos: [ 12, 3.5, 0], color: 0xff7830 },
      { kind: 'pointLight', pos: [0, 12, 0], color: 0xfff1b0, intensity: 1.0, dist: 80 },
    ],
  },

  'frozen-fortress': {
    id: 'frozen-fortress',
    name: 'Frozen Fortress',
    subtitle: 'ICE WALLS · ARCTIC WINDS',
    description: 'A glacial bastion, walls of ice and breath of snow.',
    size: 60,
    wallHeight: 5,
    theme: {
      style: 'ice',
      skyTop: 0x1a3050, skyBottom: 0x8aa8c8,
      fogColor: 0xb0c8e0, fogNear: 25, fogFar: 110,
      ambient: 0xcde4ff, ambientIntensity: 0.7,
      sunColor: 0xe8f4ff, sunIntensity: 1.0, sunPos: [20, 50, 30],
      accent: 0x86ddff, accent2: 0x4fa8e0,
      groundColor: 0xcfe4f2, groundRoughness: 0.4, groundMetalness: 0.2,
      gridColor: 0x6cc6ff, gridColor2: 0x3a6a90, gridOpacity: 0.2,
      wallColor: 0xa6d4ec, wallEmissive: 0x1a3f60, wallEmissiveIntensity: 0.2,
      obstacleColor: 0x86c3df, obstacleEmissive: 0x1a4a70, obstacleEmissiveIntensity: 0.3,
      outlineColor: 0xb8eaff, stripColor: 0xe0f5ff,
    },
    walls: [
      // Outer fortifications
      { pos: [-20, 2, -20], size: [4, 4, 4] },
      { pos: [ 20, 2,  20], size: [4, 4, 4] },
      { pos: [-20, 2,  20], size: [4, 4, 4] },
      { pos: [ 20, 2, -20], size: [4, 4, 4] },
      // Central watchtower base
      { pos: [0, 3, 0], size: [5, 6, 5] },
      // Crenellated inner walls
      { pos: [-10, 1.5, -4], size: [2, 3, 10] },
      { pos: [ 10, 1.5,  4], size: [2, 3, 10] },
      { pos: [-4, 1, -14], size: [10, 2, 2] },
      { pos: [ 4, 1,  14], size: [10, 2, 2] },
    ],
    decorations: [
      { kind: 'iceSpike', pos: [-26, 0, -10], height: 6 },
      { kind: 'iceSpike', pos: [ 26, 0,  10], height: 6 },
      { kind: 'iceSpike', pos: [-12, 0,  22], height: 4 },
      { kind: 'iceSpike', pos: [ 12, 0, -22], height: 4 },
      { kind: 'iceSpike', pos: [ 18, 0,   0], height: 5 },
      { kind: 'iceSpike', pos: [-18, 0,   0], height: 5 },
      { kind: 'watchtowerCap', pos: [0, 6, 0], color: 0x86ddff },
      { kind: 'pineTree', pos: [-24, 0, -24] },
      { kind: 'pineTree', pos: [ 24, 0,  24] },
      { kind: 'pineTree', pos: [-24, 0,  24] },
      { kind: 'pineTree', pos: [ 24, 0, -24] },
      { kind: 'snow', pos: [0, 0, 0] },
      { kind: 'pointLight', pos: [0, 10, 0], color: 0x86ddff, intensity: 1.3, dist: 70 },
      { kind: 'pointLight', pos: [-18, 4, -18], color: 0xaae0ff, intensity: 0.7, dist: 30 },
      { kind: 'pointLight', pos: [ 18, 4,  18], color: 0xaae0ff, intensity: 0.7, dist: 30 },
    ],
  },
};

// -----------------------------------------------------------------------
// CHARACTERS — cosmetic classes. All have identical gameplay stats for
// the MVP (no power creep). The client renders a distinct humanoid per id.
// -----------------------------------------------------------------------

const CHARACTERS = {
  assault: {
    id: 'assault',
    name: 'Assault',
    tagline: 'Balanced · Versatile',
    description: 'Front-line operator in cobalt plating.',
    palette: {
      primary:   0x2a55c8,   // cobalt armor
      secondary: 0xff8033,   // orange trim
      visor:     0x00e6ff,   // cyan visor
      skin:      0xe0b79a,
      trim:      0xf0e6d8,   // white highlights
      metal:     0x4a5668,
    },
    build: 'regular',
  },
  stealth: {
    id: 'stealth',
    name: 'Stealth',
    tagline: 'Silent · Agile',
    description: 'Matte-black shadow with violet glow.',
    palette: {
      primary:   0x18181e,
      secondary: 0x7b3fe4,
      visor:     0xb05cff,
      skin:      0xcfa484,
      trim:      0x3a3a46,
      metal:     0x1a1a22,
    },
    build: 'slim',
  },
  heavy: {
    id: 'heavy',
    name: 'Heavy',
    tagline: 'Armored · Relentless',
    description: 'Olive war-plate. Slow, but immovable.',
    palette: {
      primary:   0x3b5c2b,
      secondary: 0xb58f3f,
      visor:     0xffcc5c,
      skin:      0xc89870,
      trim:      0x2a3a1e,
      metal:     0x3d4638,
    },
    build: 'heavy',
  },
  recon: {
    id: 'recon',
    name: 'Recon',
    tagline: 'Scout · Sharpshooter',
    description: 'Desert tans and forest greens.',
    palette: {
      primary:   0xc3a76b,
      secondary: 0x4a6a3a,
      visor:     0x7cff9a,
      skin:      0xe3b890,
      trim:      0x8b7048,
      metal:     0x6b5a38,
    },
    build: 'slim',
  },
};

const DEFAULT_MAP = 'neon-arena';
const DEFAULT_CHARACTER = 'assault';

module.exports = Object.freeze({
  // Networking
  TICK_RATE: 30,
  MAX_PLAYERS_PER_ROOM: 16,

  // Map (defaults — actual per-room map chosen from MAPS)
  MAP_SIZE: 60,
  WALL_HEIGHT: 4,

  // Player
  MAX_HEALTH: 100,
  PLAYER_RADIUS: 0.5,
  PLAYER_HEIGHT: 1.8,
  EYE_HEIGHT: 1.7,
  RESPAWN_TIME_MS: 3000,

  // Weapon
  WEAPON: {
    name: 'PULSE-R',
    damage: 25,
    fireRateMs: 120,
    magSize: 30,
    reloadTimeMs: 1800,
    range: 100,
  },

  // Match
  MATCH_DURATION_MS: 5 * 60 * 1000,
  SCORE_TO_WIN: 25,

  // Content
  MAPS,
  CHARACTERS,
  DEFAULT_MAP,
  DEFAULT_CHARACTER,
});
