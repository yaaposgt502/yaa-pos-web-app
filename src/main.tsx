import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './index.css';

// Clean text fragments if present in URL
if (typeof window !== 'undefined' && window.location.hash && window.location.hash.includes(':~:text=')) {
  try {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  } catch (e) {
    console.warn('Could not clean text fragment hash:', e);
  }
}

// Register Service Worker for PWA Offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('[Service Worker] Registered successfully:', reg.scope))
      .catch((err) => console.error('[Service Worker] Registration failed:', err));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

