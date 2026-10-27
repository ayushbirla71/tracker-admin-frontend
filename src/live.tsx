import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { API_BASE, getToken, type Alert } from './api';

export interface LiveLocation {
  type: 'location';
  workerId: number;
  recordedAt: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  battery: number | null;
}

export type LiveMessage = LiveLocation | { type: 'alert'; alert: Alert } | { type: 'alert-resolved'; workerId: number; alertType: string } | { type: 'alerts-cleared' };

type Listener = (msg: LiveMessage) => void;

interface LiveValue {
  connected: boolean;
  subscribe: (fn: Listener) => () => void;
}

const LiveContext = createContext<LiveValue | null>(null);

/** One WebSocket for the whole app; pages subscribe to the messages they care about. Reconnects with backoff. */
export function LiveProvider({ children }: { children: ReactNode }) {
  const listeners = useRef(new Set<Listener>());
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry = 1000;
    let timer: number | undefined;
    let stopped = false;

    const connect = () => {
      const token = getToken();
      if (!token || stopped) return;
      socket = new WebSocket(`${API_BASE.replace(/\/+$/, '').replace(/^http/, 'ws')}/ws/admin?token=${encodeURIComponent(token)}`);
      socket.onopen = () => {
        retry = 1000;
        setConnected(true);
      };
      socket.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as LiveMessage;
          if (msg.type === 'location' || msg.type === 'alert' || msg.type === 'alert-resolved' || msg.type === 'alerts-cleared') listeners.current.forEach((fn) => fn(msg));
        } catch {
          /* ignore malformed frames */
        }
      };
      socket.onclose = () => {
        setConnected(false);
        if (stopped) return;
        timer = window.setTimeout(connect, retry);
        retry = Math.min(retry * 2, 15000);
      };
    };
    connect();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      socket?.close();
    };
  }, []);

  const subscribe = useCallback((fn: Listener) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  return <LiveContext.Provider value={{ connected, subscribe }}>{children}</LiveContext.Provider>;
}

export function useLiveStatus() {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error('useLiveStatus outside LiveProvider');
  return ctx.connected;
}

/** Calls `fn` for every live message while the component is mounted. */
export function useLive(fn: Listener) {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error('useLive outside LiveProvider');
  const latest = useRef(fn);
  latest.current = fn;
  const { subscribe } = ctx;
  useEffect(() => subscribe((m) => latest.current(m)), [subscribe]);
}
