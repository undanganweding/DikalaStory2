import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import App from './App';
import './index.css';
import { WindowManagerProvider } from './context/WindowManagerContext';
import { ErrorBoundary } from './components/ErrorBoundary';

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <WindowManagerProvider>
          <App />
          <Analytics />
        </WindowManagerProvider>
      </ErrorBoundary>
    </StrictMode>
  );
}

