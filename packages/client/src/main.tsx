import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { useUi } from './store.js';
import { net } from './net/client.js';

// Dev-only inspection hook (stripped from production builds) — lets the puppeteer
// verify scripts in /scripts read/poke the store and net singleton.
if (import.meta.env.DEV) {
  (window as unknown as { bbh: unknown }).bbh = { useUi, net };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
