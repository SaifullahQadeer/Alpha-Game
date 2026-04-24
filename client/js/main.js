/**
 * Neon Arena — client entry.
 * Wires the lobby UI to the game controller.
 */
import { UI } from './UI.js';
import { Game } from './Game.js';

const ui = new UI();
ui.init();

ui.onJoin(({ name, characterId, mapId }) => {
  ui.show('loading');
  const game = new Game({ ui });
  game.connect({ name, characterId, mapId });
});

// A full page reload is the simplest way to cleanly tear down sockets,
// WebGL, and pointer locks between matches.
ui.onPlayAgain(() => {
  window.location.reload();
});
