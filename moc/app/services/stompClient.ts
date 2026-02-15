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
const HEARTBEAT_INTERVAL_MS = 10000;
const DEFAULT_STOMP_HOST = process.env.EXPO_PUBLIC_STOMP_HOST?.trim() || '/';

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
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  public onDisconnect?: () => void;
  public onConnectCallback?: () => void;

  constructor(url: string, token?: string | null) {
    this.url = url;
    this.token = token;
  }

  private resolveStompHost() {
    if (DEFAULT_STOMP_HOST) {
      return DEFAULT_STOMP_HOST;
    }
    return '/';
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
      const headers: Record<string, string> = {};
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      try {
        // RN WebSocket constructor accepts headers as third argument (not web).
        const wsUrl = this.token
          ? `${this.url}?access_token=${encodeURIComponent(this.token)}`
          : this.url;

        const protocols = ['v12.stomp'];
        const socket: WebSocket =
          Platform.OS === 'web'
            ? new WebSocket(wsUrl, protocols)
            : new (WebSocket as unknown as RNWebSocketConstructor)(
                wsUrl,
                protocols,
                { headers },
              );
        this.ws = socket;

        socket.onopen = () => {
          const connectHeaders: Record<string, string> = {
            'accept-version': '1.2',
            'heart-beat': HEARTBEAT,
            host: this.resolveStompHost(),
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
          debugLog('WebSocket closed');
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
    if (this.ws) {
      try {
        this.sendFrame('DISCONNECT', {});
        this.ws.close();
      } catch {
        // ignore
      }
    }
    this.connected = false;
    this.connectPromise = null;
    this.stopHeartbeat();
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
        this.startHeartbeat();
        if (this.resolveConnect) {
          this.resolveConnect();
          this.resolveConnect = undefined;
          this.rejectConnect = undefined
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
      return new TextDecoder('utf-8').decode(new Uint8Array(data));
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

  private sendFrame(command: string, headers: Record<string, unknown>, body = '') {
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

    // Send STOMP frames as text. Some gateways/STOMP endpoints reject binary
    // websocket messages and close the socket with a protocol error.
    this.ws.send(`${frame}\0`);
    debugLog('SEND FRAME', { command, headers, body });
  }

  private startHeartbeat() {
    if (this.heartbeatTimer || !this.ws) {
      return;
    }
    this.heartbeatTimer = setInterval(() => {
      try {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send('\n');
        }
      } catch (err) {
        debugLog('Failed to send heartbeat', err);
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  send(destination: string, body: string, headers: Record<string, unknown> = {}) {
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
    client.send(destination, body, {
      'content-type': 'application/json',
      ...headers,
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