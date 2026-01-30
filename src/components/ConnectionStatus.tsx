/**
 * Connection manager to monitor and display WebSocket status
 * Provides visual feedback about real-time connection health
 */

import { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { notificationWS, updatesWS } from '@/lib/websocket';
import { toast } from 'sonner';

export function ConnectionStatus() {
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    const checkConnection = () => {
      const connected = updatesWS.isConnected() && notificationWS.isConnected();
      setIsConnected(connected);
      setIsReconnecting(false);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      setIsReconnecting(true);
      toast.error('Lost connection to server. Reconnecting...');
    };

    const handleReconnect = () => {
      setIsConnected(true);
      setIsReconnecting(false);
      toast.success('Reconnected to server');
    };

    // Initial check
    checkConnection();

    // Listen for connection events
    updatesWS.onConnect(handleReconnect);
    updatesWS.onDisconnect(handleDisconnect);
    notificationWS.onConnect(handleReconnect);
    notificationWS.onDisconnect(handleDisconnect);

    // Periodic check
    const interval = setInterval(checkConnection, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const handleReconnect = () => {
    setIsReconnecting(true);
    updatesWS.connect();
    notificationWS.connect();
    toast.info('Reconnecting...');
  };

  if (isConnected) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
        <Wifi className="h-4 w-4" />
        <span className="hidden sm:inline">Connected</span>
      </div>
    );
  }

  if (isReconnecting) {
    return (
      <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span className="hidden sm:inline">Reconnecting...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
        <WifiOff className="h-4 w-4" />
        <span className="hidden sm:inline">Disconnected</span>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={handleReconnect}
        className="h-8 px-2"
      >
        <RefreshCw className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default ConnectionStatus;
