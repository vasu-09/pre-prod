/*
 * Minimal STOMP client tailored for the MoC mobile application.
 * Supports CONNECT, SUBSCRIBE, SEND and graceful reconnects without
 * relying on external npm dependencies (offline environments).
 */

import { Platform } from 'react-native';

import { buildWsUrl } from './apiClient';
import { getAccessToken } from './authStorage';

const wsDebugEnabled =
  process.env.EXPO_PUBLIC_WS_DEBUG === 'true' || (typeof __DEV__ !== 'undefined' && __DEV__);

const debugLog = (...args: unknown[]) => {
  if (wsDebugEnabled) {
    console.log('[WS]', ...args);
  }
};

type RNWebSocketConstructor = new (
  url: string,
  protocols?: string | string[],
  options?: { headers?: Record<string, string> },
) => WebSocket;

type FrameHandler = (frame: StompFrame) => void;

export type StompFrame = {
  command: string;
  headers: Record<string, string>;
  body: string;
};

type SubscriptionEntry = {
  destination: string;
  callback: FrameHandler;
  id: string;
};

const HEARTBEAT = '10000,10000';
const DEFAULT_STOMP_HOST = process.env.EXPO_PUBLIC_STOMP_HOST?.trim() || '/';
const HEARTBEAT_FALLBACK_MS = 10000;
const HEARTBEAT_WATCHDOG_CHECK_MS = 5000;

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8');

function toArrayBufferExact(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
}

function encodeBinary(value: string): ArrayBuffer {
  return toArrayBufferExact(encoder.encode(value));
}

function appendAccessToken(baseUrl: string, jwt: string) {
  const hasQuery = baseUrl.includes('?');
  return hasQuery
    ? `${baseUrl}&access_token=${encodeURIComponent(jwt)}`
    : `${baseUrl}?access_token=${encodeURIComponent(jwt)}`;
}

class SimpleStompClient {
  private url: string;
  private token?: string | null;
  private ws: WebSocket | null = null;
  private connected = false;
  private connectPromise: Promise<void> | null = null;
  private resolveConnect?: () => void;
  private rejectConnect?: (err: unknown) => void;
  private subscriptions = new Map<string, FrameHandler>();
  private subscriptionSeq = 0;
  private heartbeatSendTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatWatchTimer: ReturnType<typeof setInterval> | null = null;
  private lastInboundAt = Date.now();
  public onDisconnect?: () => void;
  public onConnectCallback?: () => void;

  constructor(url: string, token?: string | null) {
    this.url = url;
    this.token = token;
  }

  private resolveStompHost(wsUrl: string) {
    if (DEFAULT_STOMP_HOST) {
      return DEFAULT_STOMP_HOST;
    }
    try {
      return new URL(wsUrl).host;
    } catch {
      return 'api-preprod.mocconnect.in';
    }
  }

  isConnected() {
    return this.connected;
  }

  async connect() {
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = new Promise<void>((resolve, reject) => {
      this.resolveConnect = resolve;
      this.rejectConnect = reject;

      try {
        const wsUrl = this.token ? appendAccessToken(this.url, this.token) : this.url;

        const protocols = ['v12.stomp'];
        const socket: WebSocket =
          Platform.OS === 'web'
            ? new WebSocket(wsUrl, protocols)
            : new (WebSocket as unknown as RNWebSocketConstructor)(
                wsUrl,
                protocols,
                { headers: { Origin: 'https://api-preprod.mocconnect.in' } },
              );
        this.ws = socket;
        try {
          this.ws.binaryType = 'arraybuffer';
        } catch {
          // ignore
        }

        socket.onopen = () => {
          const connectHeaders: Record<string, string> = {
            'accept-version': '1.2',
            'heart-beat': HEARTBEAT,
            host: this.resolveStompHost(wsUrl),
          };

          const tokenPreview = this.token ? `${this.token.slice(0, 10)}...` : null;
          debugLog('STOMP CONNECT outbound', {
            url: wsUrl,
            headers: connectHeaders,
            tokenPreview,
            protocols,
          });

          this.sendFrame('CONNECT', connectHeaders);
        };

        socket.onmessage = async event => {
          try {
            const text = await this.extractText(event.data);
            this.handleRawData(text);
          } catch (err) {
            debugLog('Failed to process inbound WebSocket message', err);
          }
        };

        socket.onclose = event => {
          const wasPending = Boolean(this.connectPromise) && !this.connected;
          this.connected = false;
          this.connectPromise = null;
          this.stopHeartbeat();
          if (wasPending && this.rejectConnect) {
            const reason = event?.reason || `WebSocket closed (code ${event?.code ?? 'unknown'})`;
            this.rejectConnect(new Error(reason));
          }
          this.resolveConnect = undefined;
          this.rejectConnect = undefined;
          debugLog('WebSocket closed', {
            code: event?.code,
            reason: event?.reason,
            wasClean: event?.wasClean,
          });
          if (this.onDisconnect) {
            this.onDisconnect();
          }
        };

        socket.onerror = err => {
          debugLog('WebSocket error', err);
          if (this.rejectConnect) {
            this.rejectConnect(err);
          }
        };
      } catch (err) {
        if (this.rejectConnect) {
          this.rejectConnect(err);
        }
      }
    });

    return this.connectPromise;
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      try {
        this.sendBinary('DISCONNECT\n\n\x00');
      } catch {
        // ignore
      }
      setTimeout(() => {
        try {
          this.ws?.close(1000, 'bye');
        } catch {
          // ignore
        }
      }, 150);
    }
    this.connected = false;
    this.connectPromise = null;
  }

  private async extractText(data: string | ArrayBuffer | Blob): Promise<string> {
    if (typeof data === 'string') {
      return data;
    }

    if (typeof Blob !== 'undefined' && data instanceof Blob) {
      const buffer = await data.arrayBuffer();
      return this.decodeBinary(buffer);
    }

    return this.decodeBinary(data as ArrayBuffer);
  }

  private handleRawData(text: string) {
    this.lastInboundAt = Date.now();

    if (!text || text === '\n' || text === '\r\n') {
      return; // heartbeat or empty
    }

    debugLog('RAW INBOUND FRAME', JSON.stringify(text));

    const frames = text.split('\0');
    frames.forEach(raw => {
      if (!raw || !raw.trim()) {
        return;
      }
      const frame = this.parseFrame(raw);
      if (!frame) {
        return;
      }

      debugLog('INBOUND FRAME', {
        command: frame.command,
        headers: frame.headers,
        bodyPreview: frame.body ? frame.body.slice(0, 200) : '',
      });

      if (frame.command === 'CONNECTED') {
        debugLog('STOMP CONNECTED', frame.headers);
        this.connected = true;
        const [outgoingMs, incomingMs] = this.resolveHeartbeatIntervals(frame.headers['heart-beat']);
        this.startHeartbeat(outgoingMs, incomingMs);
        if (this.resolveConnect) {
          this.resolveConnect();
          this.resolveConnect = undefined;
          this.rejectConnect = undefined;
        }
        
        if (this.onConnectCallback) {
          this.onConnectCallback();
        }
        return;
      }

      if (frame.command === 'MESSAGE') {
        const subId = frame.headers['subscription'];
        if (subId && this.subscriptions.has(subId)) {
          try {
            this.subscriptions.get(subId)?.(frame);
          } catch (err) {
            console.warn('STOMP subscription handler error', err);
          }
        }
        return;
      }

      if (frame.command === 'ERROR') {
        console.warn('STOMP error frame', frame.body || frame.headers['message']);
        debugLog('STOMP ERROR FRAME', frame);
        return;
      }
    });
  }

  private decodeBinary(data: ArrayBuffer) {
    try {
      return decoder.decode(new Uint8Array(data));
    } catch (err) {
      debugLog('Failed to decode binary frame', err);
      return '';
    }
  }


  private parseFrame(raw: string): StompFrame | null {
    const trimmed = raw.replace(/\u0000/g, '');
    const commandEnd = trimmed.indexOf('\n');
    const command = (commandEnd >= 0 ? trimmed.slice(0, commandEnd) : trimmed).trim();
    if (!command) {
      return null;
    }

    const remainder = commandEnd >= 0 ? trimmed.slice(commandEnd + 1) : '';
    const headerEnd = remainder.indexOf('\n\n');
    let headerPart = '';
    let bodyPart = '';
    if (headerEnd >= 0) {
      headerPart = remainder.slice(0, headerEnd);
      bodyPart = remainder.slice(headerEnd + 2);
    } else {
      headerPart = remainder;
    }

    const headers: Record<string, string> = {};
    if (headerPart) {
      headerPart.split('\n').forEach(line => {
        const idx = line.indexOf(':');
        if (idx > -1) {
          const key = line.slice(0, idx).trim();
          const value = line.slice(idx + 1).trim();
          headers[key] = value;
        }
      });
    }

    return { command, headers, body: bodyPart.replace(/\u0000/g, '') };
  }

  private sendBinary(value: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open – unable to send STOMP frame');
    }

    this.ws.send(encodeBinary(value));
  }

  private sendFrame(command: string, headers: Record<string, string>, body = '') {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open – unable to send STOMP frame');
    }
    let frame = `${command}\n`;
    Object.entries(headers).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      frame += `${key}:${value}\n`;
    });
    frame += '\n';
    if (body) {
      frame += body;
    }
    debugLog('RAW OUTBOUND FRAME', JSON.stringify(frame + '\0'));
    this.sendBinary(`${frame}\0`);
    debugLog('SEND FRAME', { command, headers, body });
  }

  private resolveHeartbeatIntervals(serverHeartBeatHeader?: string): [number, number] {
    const [clientOut, clientIn] = HEARTBEAT.split(',').map(value => Number(value) || 0);
    const [serverOut, serverIn] = (serverHeartBeatHeader || '0,0')
      .split(',')
      .map(value => Number(value) || 0);
    const outgoingMs = Math.max(clientOut, serverIn, HEARTBEAT_FALLBACK_MS);
    const incomingMs = Math.max(clientIn, serverOut, HEARTBEAT_FALLBACK_MS);
    return [outgoingMs, incomingMs];
  }

  private startHeartbeat(outMs: number, inMs: number) {
    if (!this.ws) {
      return;
    }
    this.stopHeartbeat();

    const sendEvery = Math.max(1000, outMs - 1000);
    this.heartbeatSendTimer = setInterval(() => {
      try {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(encodeBinary('\n'));
        }
      } catch (err) {
        debugLog('Failed to send heartbeat', err);
      }
    }, sendEvery);

    const maxSilence = Math.max(30000, inMs * 3);
    this.heartbeatWatchTimer = setInterval(() => {
      const silenceDuration = Date.now() - this.lastInboundAt;
      if (this.connected && silenceDuration > maxSilence) {
        debugLog('Heartbeat watchdog closing stale socket', {
          silenceDuration,
          maxSilence,
        });
        try {
          this.ws?.close();
        } catch {
          // ignore
        }
      }
    }, HEARTBEAT_WATCHDOG_CHECK_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatSendTimer) {
      clearInterval(this.heartbeatSendTimer);
      this.heartbeatSendTimer = null;
    }
    if (this.heartbeatWatchTimer) {
      clearInterval(this.heartbeatWatchTimer);
      this.heartbeatWatchTimer = null;
    }
  }

  send(destination: string, body: string, headers: Record<string, string> = {}) {
    this.sendFrame('SEND', { destination, ...headers }, body);
  }

  subscribe(destination: string, callback: FrameHandler, id?: string) {
    const subId = id ?? `sub-${++this.subscriptionSeq}`;
    this.subscriptions.set(subId, callback);
    this.sendFrame('SUBSCRIBE', { destination, id: subId, ack: 'auto' });
    return subId;
  }

  unsubscribe(id: string) {
    if (!this.subscriptions.has(id)) {
      return;
    }
    this.subscriptions.delete(id);
    this.sendFrame('UNSUBSCRIBE', { id });
  }
}

class StompManager {
  private client: SimpleStompClient | null = null;
  private initPromise: Promise<SimpleStompClient> | null = null;
  private reconnectDelay = 5000;
  private subscriptions = new Map<string, SubscriptionEntry>();
  private desired = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private idCounter = 0;
  private lastToken: string | null = null;
  private onConnectListeners = new Set<() => void>();

  private async initClient(explicitToken?: string | null): Promise<SimpleStompClient> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      const token = explicitToken ?? (await getAccessToken());
      const url = buildWsUrl();
      const client = new SimpleStompClient(url, token ?? undefined);
      this.lastToken = token ?? null;
      client.onDisconnect = () => {
        this.client = null;
        this.initPromise = null;
        this.lastToken = null;
        if (this.desired) {
          this.scheduleReconnect();
        }
      };
      client.onConnectCallback = () => {
        this.resubscribe(client);
        this.onConnectListeners.forEach(cb => {
          try {
            cb();
          } catch (err) {
            console.warn('STOMP onConnect listener failed', err);
          }
        });
      };
      await client.connect();
      this.client = client;
      return client;
    })();

    try {
      const readyClient = await this.initPromise;
      return readyClient;
    } finally {
      this.initPromise = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      return;
    }
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (!this.desired) {
        return;
      }
      try {
        await this.initClient();
      } catch (err) {
        console.warn('STOMP reconnect failed', err);
        this.scheduleReconnect();
      }
    }, this.reconnectDelay);
  }

  private resubscribe(client: SimpleStompClient) {
    this.subscriptions.forEach(entry => {
      client.subscribe(entry.destination, entry.callback, entry.id);
    });
  }

  async ensureConnected(): Promise<SimpleStompClient> {
    const latestToken = await getAccessToken();

    // ✅ Do not connect before login
    if (!latestToken) {
      this.desired = false; // prevent reconnect loop while logged out
      throw new Error('No access token yet; skip STOMP connect until login');
    }

    this.desired = true;

    if (this.client && this.client.isConnected() && this.lastToken === latestToken) {
      return this.client;
    }

    if (this.client) {
      this.client.disconnect();
      this.client = null;
      this.initPromise = null;
      this.lastToken = null;
    }

    return this.initClient(latestToken);
  }


  async disconnect(): Promise<void> {
    this.desired = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
    this.initPromise = null;
  }

  async publish(destination: string, payload: unknown, headers: Record<string, unknown> = {}) {
    const client = await this.ensureConnected();
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
    debugLog('publish', { destination, payload, body });
    const stringHeaders = Object.entries(headers).reduce<Record<string, string>>((acc, [key, value]) => {
      if (value === undefined || value === null) {
        return acc;
      }
      acc[key] = String(value);
      return acc;
    }, {});
    
    client.send(destination, body, {
      'content-type': 'application/json',
      ...stringHeaders,
    });
  }

  subscribe(destination: string, callback: FrameHandler) {
    const id = `sub-${++this.idCounter}`;
    const entry: SubscriptionEntry = { destination, callback, id };
    this.subscriptions.set(id, entry);

    if (this.client && this.client.isConnected()) {
      try {
        this.client.subscribe(destination, callback, id);
      } catch (err) {
        console.warn('Failed to establish STOMP subscription', err);
      }
    } else {
      this.ensureConnected().catch(err => {
        console.warn('Failed to establish STOMP subscription', err);
      });
    }

    return () => {
      const current = this.subscriptions.get(id);
      if (!current) {
        return;
      }
      this.subscriptions.delete(id);
      if (this.client && this.client.isConnected()) {
        try {
          this.client.unsubscribe(id);
        } catch {
          // ignore
        }
      }
    };
  }

  onConnect(callback: () => void) {
    this.onConnectListeners.add(callback);
    return () => this.onConnectListeners.delete(callback);
  }
}

const stompManager = new StompManager();

export default stompManager;