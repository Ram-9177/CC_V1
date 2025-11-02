import { useEffect, useState } from 'react';

export function OfflineBadge() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    function handleOnline() { setOnline(true); }
    function handleOffline() { setOnline(false); }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`inline-flex h-2 w-2 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className="hidden sm:inline">{online ? 'Online' : 'Offline'}</span>
    </div>
  );
}
