
  import { createRoot } from "react-dom/client";
  import App from "./App";
  import "./index.css";

  createRoot(document.getElementById("root")!).render(<App />);

  // Register a lightweight service worker for offline and reduced network usage
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swUrl = (import.meta.env.BASE_URL || '/') + 'sw.js';
      navigator.serviceWorker.register(swUrl).then((reg) => {
        // On online, ask SW to flush queued attendance marks
        const requestFlush = () => {
          if (reg.active) reg.active.postMessage({ type: 'FLUSH_ATTENDANCE_QUEUE' });
        };
        window.addEventListener('online', requestFlush);
        requestFlush();

        // Show a light prompt when a new version is available
        reg.onupdatefound = () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              const doReload = window.confirm('A new version is available. Refresh now?');
              if (doReload) {
                (reg.waiting || reg.active)?.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
              }
            }
          });
        };
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          // When the new SW takes control, reload to serve fresh assets
          window.location.reload();
        });
      }).catch(() => {});
    });
  }
  