import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { useUi } from './store.js';
import { net } from './net/client.js';
import { sfx } from './audio/sfx.js';

// Dev-only inspection hook (stripped from production builds) — lets the puppeteer
// verify scripts in /scripts read/poke the store, net, and audio singletons.
if (import.meta.env.DEV) {
  (window as unknown as { bbh: unknown }).bbh = { useUi, net, sfx };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
