/**
 * Network
 * Thin wrapper around socket.io-client that:
 *  - exposes an `on(event, cb)` EventEmitter-style API
 *  - batches outbound input so we never exceed SEND_RATE_HZ
 *  - centralizes all protocol strings in one place
 */
import { C } from './config.js';

export class Network {
  constructor() {
    /** @type {import('socket.io-client').Socket|null} */
    this.socket = null;
    this.selfId = null;
    this._listeners = new Map();
    this._lastInputSentAt = 0;
  }

  connect({ name, characterId, mapId }, onStatus) {
    return new Promise((resolve, reject) => {
      // `io` is the global from /socket.io/socket.io.js
      // eslint-disable-next-line no-undef
      this.socket = io({
        transports: ['websocket'],       // skip long-polling for lower latency
        reconnection: true,
        reconnectionAttempts: 3,
      });

      const timeout = setTimeout(() => reject(new Error('connection timeout')), 8000);

      this.socket.on('connect', () => {
        onStatus?.('Handshaking...');
        this.socket.emit('joinGame', { name, characterId, mapId });
      });

      this.socket.on('connect_error', (err) => {
        onStatus?.(`Connection error: ${err.message}`);
      });

      this.socket.on('init', (data) => {
        clearTimeout(timeout);
        this.selfId = data.selfId;
        this._dispatch('init', data);
        resolve(data);
      });

      // Forward all server events to our internal dispatcher.
      const events = [
        'snapshot', 'playerJoined', 'playerLeft',
        'shotFired', 'hitConfirmed', 'tookDamage',
        'playerKilled', 'playerRespawned', 'respawn',
        'reloadStart', 'reloadComplete',
        'matchEnd', 'chat',
      ];
      for (const e of events) this.socket.on(e, (d) => this._dispatch(e, d));
    });
  }

  /** Rate-limited input send. */
  sendInput(pos, rot) {
    if (!this.socket) return;
    const now = performance.now();
    const interval = 1000 / C.SEND_RATE_HZ;
    if (now - this._lastInputSentAt < interval) return;
    this._lastInputSentAt = now;
    this.socket.emit('input', { pos, rot, t: Date.now() });
  }

  sendShoot(origin, dir) {
    this.socket?.emit('shoot', { origin, dir });
  }

  sendReload() {
    this.socket?.emit('reload');
  }

  /** EventEmitter-style API. */
  on(event, cb) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(cb);
    return () => this._listeners.get(event).delete(cb);
  }

  _dispatch(event, data) {
    const set = this._listeners.get(event);
    if (!set) return;
    for (const cb of set) {
      try { cb(data); } catch (err) { console.error(`[net] handler for ${event} threw`, err); }
    }
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}
