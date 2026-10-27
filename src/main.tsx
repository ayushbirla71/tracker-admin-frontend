import '@fontsource-variable/inter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import 'leaflet/dist/leaflet.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './auth.tsx';
import { FeedbackProvider } from './feedback.tsx';
import './index.css';
import { ThemeProvider } from './theme.tsx';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 10_000 } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <FeedbackProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </FeedbackProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
