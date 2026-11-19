import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { firestoreReady } from './firebase';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './index.css';

// Fix React DOM reconciliation issue with browser translations and external extensions (removeChild/insertBefore)
if (typeof window !== 'undefined' && typeof Node === 'function' && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child && child.parentNode !== this) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('Prevented React removeChild on mismatched parent:', child, this);
      }
      return child;
    }
    return originalRemoveChild.apply(this, [child]) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('Prevented React insertBefore on mismatched parent:', newNode, referenceNode, this);
      }
      return newNode;
    }
    return originalInsertBefore.apply(this, [newNode, referenceNode]) as T;
  };
}

// Clean text fragments if present in URL
if (typeof window !== 'undefined' && window.location.hash && window.location.hash.includes(':~:text=')) {
  try {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  } catch (e) {
    console.warn('Could not clean text fragment hash:', e);
  }
}

// PWA Service Worker management:
// In development, unregister any active service worker and clear caches to avoid stale iframe states
if ('serviceWorker' in navigator) {
  const isDev = Boolean((import.meta as any).env?.DEV);
  if (isDev) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.unregister().catch(() => {});
      }
    });
    if ('caches' in window) {
      caches.keys().then((names) => {
        for (const name of names) {
          caches.delete(name).catch(() => {});
        }
      });
    }
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('[Service Worker] Registered:', reg.scope))
        .catch((err) => console.warn('[Service Worker] Registration warning:', err));
    });
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  // Finish deleting the previous session's local cache (if a sign-out could
  // not complete it) before any screen reads from Firestore.
  firestoreReady.finally(() => {
    createRoot(rootElement).render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    );
  });
}

