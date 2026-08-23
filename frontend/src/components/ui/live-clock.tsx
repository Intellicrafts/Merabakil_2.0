"use client";

import { useEffect, useState } from "react";

/** Isolated 1 Hz clock — re-renders only this subtree, not parent lists/pages. */
export function LiveClock({
  children,
}: {
  children: (now: number) => React.ReactNode;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return <>{children(now)}</>;
}
