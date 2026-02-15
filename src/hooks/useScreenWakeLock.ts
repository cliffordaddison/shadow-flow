/**
 * Keeps the screen on during training sessions (Listen & Repeat, Speaking, Writing).
 * Uses the Screen Wake Lock API; no-op when unsupported (e.g. insecure context, older browsers).
 */

import { useEffect, useRef } from 'react';

export function useScreenWakeLock(): void {
  const sentinelRef = useRef<{ release(): Promise<void> } | null>(null);

  useEffect(() => {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    const wakeLock = nav && 'wakeLock' in nav ? (nav as Navigator & { wakeLock: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock : undefined;
    if (wakeLock === undefined) return;

    let mounted = true;

    const requestLock = async () => {
      if (!mounted) return;
      try {
        const sentinel = await wakeLock.request('screen');
        if (mounted) {
          sentinelRef.current = sentinel;
        } else {
          await sentinel.release();
        }
      } catch {
        // Ignore; API may reject (e.g. low battery, already held)
      }
    };

    void requestLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && mounted) {
        void requestLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      sentinelRef.current?.release().catch(() => {});
      sentinelRef.current = null;
    };
  }, []);
}
