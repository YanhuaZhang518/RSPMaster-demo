import { useEffect, useState } from 'react';

export function useCountdown(endsAt: number, active: boolean): number {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!active || !endsAt) {
      setRemaining(0);
      return;
    }

    const tick = () => {
      const ms = Math.max(0, endsAt - Date.now());
      setRemaining(ms);
    };

    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [endsAt, active]);

  return remaining;
}

export function formatCountdown(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  return `${seconds}`;
}
