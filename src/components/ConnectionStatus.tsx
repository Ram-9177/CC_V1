/**
 * Connection manager to monitor and display WebSocket status
 * Provides visual feedback about real-time connection health
 */

import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { notificationWS, updatesWS } from '@/lib/websocket';
import { toast } from 'sonner';

export function ConnectionStatus() {
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const lastOverallConnectedRef = useRef<boolean | null>(null);
  const reconnectStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    const overallConnected = () => updatesWS.isConnected() && notificationWS.isConnected();

    const updateConnection = (source: 'init' | 'poll' | 'connect' | 'disconnect') => {
      const connected = overallConnected();

      // Toast only on real state transitions (avoid duplicate toasts from 2 sockets).
      const lastOverallConnected = lastOverallConnectedRef.current;
      if (lastOverallConnected !== null && connected !== lastOverallConnected) {
        if (connected) {
          toast.success('Reconnected to server');
        } else {
          toast.error('Lost connection to server. Reconnecting...');
        }
      }
      lastOverallConnectedRef.current = connected;

      setIsConnected(connected);

      if (connected) {
        reconnectStartedAtRef.current = null;
        setIsReconnecting(false);
        return;
      }

      // If we recently disconnected or the user initiated reconnect, show "Reconnecting".
      if (source === 'disconnect' || source === 'connect') {
        reconnectStartedAtRef.current = Date.now();
        setIsReconnecting(true);
        return;
      }

      const reconnectStartedAt = reconnectStartedAtRef.current;
      if (reconnectStartedAt && Date.now() - reconnectStartedAt > 15000) {
        // Auto-reconnect likely failed; show offline + manual reconnect button.
        setIsReconnecting(false);
      }
    };

    // Initial check
    updateConnection('init');

    // Listen for connection events
    const handleConnect = () => updateConnection('connect');
    const handleDisconnect = () => updateConnection('disconnect');

    updatesWS.onConnect(handleConnect);
    updatesWS.onDisconnect(handleDisconnect);
    notificationWS.onConnect(handleConnect);
    notificationWS.onDisconnect(handleDisconnect);

    // Periodic check
    const interval = setInterval(() => updateConnection('poll'), 5000);

    return () => {
      clearInterval(interval);
      updatesWS.offConnect(handleConnect);
      updatesWS.offDisconnect(handleDisconnect);
      notificationWS.offConnect(handleConnect);
      notificationWS.offDisconnect(handleDisconnect);
    };
  }, []);

  const handleReconnect = () => {
    setIsReconnecting(true);
    reconnectStartedAtRef.current = Date.now();
    updatesWS.connect();
    notificationWS.connect();
    toast.info('Reconnecting...');
  };

  const statusConfig = isConnected 
    ? { color: 'bg-success', label: 'Live', pulse: true }
    : isReconnecting
      ? { color: 'bg-secondary', label: 'Reconnecting', pulse: true }
      : { color: 'bg-destructive', label: 'Offline', pulse: false };

  return (
    <div className="flex items-center gap-2 group transition-all duration-300">
      <div className="relative flex items-center justify-center h-4 w-4">
        {statusConfig.pulse && (
          <span className={`absolute inline-flex h-full w-full rounded-full ${statusConfig.color} opacity-75 animate-ping`}></span>
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${statusConfig.color}`}></span>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hidden md:block">
        {statusConfig.label}
      </span>
      {!isConnected && !isReconnecting && (
        <Button
          size="icon"
          variant="ghost"
          onClick={handleReconnect}
          className="h-6 w-6 text-muted-foreground hover:text-foreground p-0 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

export default ConnectionStatus;
