import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemeChoice = 'light' | 'dark' | 'system';

interface ThemeValue {
  choice: ThemeChoice;
  /** What is actually showing right now */
  resolved: 'light' | 'dark';
  setChoice: (c: ThemeChoice) => void;
}

const KEY = 'tracker.theme';
const ThemeContext = createContext<ThemeValue | null>(null);

const readChoice = (): ThemeChoice => {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* storage unavailable */
  }
  return 'system';
};

const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(readChoice);
  const [dark, setDark] = useState(systemDark);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => setDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const resolved = choice === 'system' ? (dark ? 'dark' : 'light') : choice;
  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);

  const setChoice = useCallback((c: ThemeChoice) => {
    setChoiceState(c);
    try {
      localStorage.setItem(KEY, c);
    } catch {
      /* ignore */
    }
  }, []);

  return <ThemeContext.Provider value={{ choice, resolved, setChoice }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme outside ThemeProvider');
  return ctx;
}
