"use client";

import { useEffect, useState } from "react";

/** Bottom inset when the software keyboard shrinks the visual viewport (mobile browsers). */
export function useVisualViewportInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;

    function update() {
      if (!vv) return;
      const keyboardGap = window.innerHeight - vv.height - vv.offsetTop;
      setInset(Math.max(0, Math.round(keyboardGap)));
    }

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}
