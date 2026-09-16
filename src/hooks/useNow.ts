import { useEffect, useState } from "react";

/**
 * Current time that re-renders every `intervalMs`, for countdowns such as
 * break-glass expiry. Convex queries do not re-run when time passes.
 */
export function useNow(intervalMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return now;
}
