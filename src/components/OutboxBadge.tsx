import { useEffect, useState } from 'react';

export function OutboxBadge() {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const data: any = e.data || {};
      if (data && data.type === 'ATTENDANCE_QUEUE_COUNT') {
        setCount(Number(data.count || 0));
      }
    }
    navigator.serviceWorker?.addEventListener('message', onMessage);
    // Ask SW for current count
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'GET_ATTENDANCE_QUEUE_COUNT' });
    }
    const i = setInterval(() => {
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'GET_ATTENDANCE_QUEUE_COUNT' });
      }
    }, 5000);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', onMessage);
      clearInterval(i);
    };
  }, []);

  if (count <= 0) return null;

  return (
    <button
      className="text-xs px-2 py-1 rounded bg-amber-500/15 text-amber-700 border border-amber-500/30"
      title="Some attendance marks are queued and will sync when online. Tap to retry now."
      onClick={() => navigator.serviceWorker?.controller?.postMessage({ type: 'FLUSH_ATTENDANCE_QUEUE' })}
    >
      Outbox: {count}
    </button>
  );
}
