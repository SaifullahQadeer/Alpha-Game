/**
 * Client-side constants. Keep in sync with server/game/constants.js.
 *
 * MAPS/CHARACTERS here are used only to render the lobby selection UI
 * BEFORE we receive the authoritative `init` payload from the server.
 * Once `init` arrives, we use the server's map data (walls, theme)
 * for the live scene.
 */

export const C = Object.freeze({
  // Networking
  SEND_RATE_HZ: 20,
  INTERP_DELAY_MS: 100,

  // Player
  MAX_HEALTH: 100,
  PLAYER_HEIGHT: 1.8,
  PLAYER_RADIUS: 0.5,
  EYE_HEIGHT: 1.7,

  // Movement
  MOVE_SPEED: 8.0,
  MOVE_SPEED_AIR: 6.0,
  JUMP_VEL: 8.0,
  GRAVITY: 25.0,
  MOUSE_SENSITIVITY: 0.0022,

  // Weapon
  WEAPON: {
    name: 'PULSE-R',
    damage: 25,
    fireRateMs: 120,
    magSize: 30,
    reloadTimeMs: 1800,
    range: 100,
    recoilPitch: 0.018,
    recoilRecover: 8.0,
  },

  // Scene
  FOV: 75,
  NEAR: 0.05,
  FAR: 500,
  MAP_SIZE: 60,
  WALL_HEIGHT: 4,

  // Match
  RESPAWN_TIME_MS: 3000,
});

// Lobby-only metadata. The game scene uses whatever the server sends.
export const MAPS = [
  {
    id: 'neon-arena',
    name: 'Neon Arena',
    subtitle: 'CYBERPUNK · FREE FOR ALL',
    description: 'Rain-slick grid under magenta skies.',
    accent: '#00e6ff', accent2: '#ff2bd1',
    bg: 'linear-gradient(135deg, #0a0520 0%, #3a0a44 50%, #003a4a 100%)',
  },
  {
    id: 'royal-palace',
    name: 'Royal Palace',
    subtitle: 'MARBLE HALLS · GOLDEN THRONE',
    description: 'Columns of marble and gilded arches.',
    accent: '#d4af37', accent2: '#ffc36b',
    bg: 'linear-gradient(135deg, #2a1b0a 0%, #6b4620 45%, #d4af37 100%)',
  },
  {
    id: 'desert-temple',
    name: 'Desert Temple',
    subtitle: 'SANDSTONE RUINS · BLAZING SUN',
    description: 'Crumbling ziggurats under a merciless sun.',
    accent: '#ff9a55', accent2: '#ffd99a',
    bg: 'linear-gradient(135deg, #7a3a10 0%, #d97b3b 50%, #ffd99a 100%)',
  },
  {
    id: 'frozen-fortress',
    name: 'Frozen Fortress',
    subtitle: 'ICE WALLS · ARCTIC WINDS',
    description: 'A glacial bastion of ice and snow.',
    accent: '#86ddff', accent2: '#e0f5ff',
    bg: 'linear-gradient(135deg, #0a1c3a 0%, #3a6a90 50%, #cfe4f2 100%)',
  },
];

export const CHARACTERS = [
  {
    id: 'assault',
    name: 'Assault',
    tagline: 'Balanced · Versatile',
    description: 'Front-line operator in cobalt plating.',
    color: '#2a55c8', accent: '#ff8033',
  },
  {
    id: 'stealth',
    name: 'Stealth',
    tagline: 'Silent · Agile',
    description: 'Matte-black shadow with violet glow.',
    color: '#18181e', accent: '#b05cff',
  },
  {
    id: 'heavy',
    name: 'Heavy',
    tagline: 'Armored · Relentless',
    description: 'Olive war-plate. Slow, but immovable.',
    color: '#3b5c2b', accent: '#b58f3f',
  },
  {
    id: 'recon',
    name: 'Recon',
    tagline: 'Scout · Sharpshooter',
    description: 'Desert tans and forest greens.',
    color: '#c3a76b', accent: '#7cff9a',
  },
];

export const DEFAULT_MAP = 'neon-arena';
export const DEFAULT_CHARACTER = 'assault';
