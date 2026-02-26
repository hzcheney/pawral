import type { ClientMessage, ServerMessage } from "./types.ts";

type MessageHandler = (msg: ServerMessage) => void;
type ConnectionHandler = (connected: boolean) => void;

export class GatewayRPC {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: Set<MessageHandler> = new Set();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private connected = false;
  private intentionallyClosed = false;

  constructor(url: string) {
    this.url = url;
  }

  connect() {
    this.intentionallyClosed = false;
    this._connect();
  }

  private _connect() {
    if (this.ws) {
      this.ws.close();
    }

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.connected = true;
        this.reconnectDelay = 1000;
        this.connectionHandlers.forEach((h) => h(true));
        // Subscribe to all channels
        this.send({
          type: "subscribe",
          channels: ["workers", "tasks", "budget", "activity", "alerts"],
        });
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string) as ServerMessage;
          this.handlers.forEach((h) => h(msg));
        } catch {
          // ignore parse errors
        }
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.connectionHandlers.forEach((h) => h(false));
        if (!this.intentionallyClosed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.intentionallyClosed) {
        this._connect();
      }
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(
      this.reconnectDelay * 2,
      this.maxReconnectDelay
    );
  }

  disconnect() {
    this.intentionallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  onMessage(handler: MessageHandler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onConnection(handler: ConnectionHandler) {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  isConnected() {
    return this.connected;
  }

  setUrl(url: string) {
    this.url = url;
    if (this.connected) {
      this.disconnect();
      this.connect();
    }
  }
}

// Singleton instance
let instance: GatewayRPC | null = null;

export function getGateway(url?: string): GatewayRPC {
  if (!instance) {
    instance = new GatewayRPC(url ?? "ws://localhost:3002");
  }
  return instance;
}

export function resetGateway(url: string) {
  instance?.disconnect();
  instance = new GatewayRPC(url);
  return instance;
}
