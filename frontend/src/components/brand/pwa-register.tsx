"use client";

import { useEffect } from "react";

import { InstallAppBanner } from "@/components/brand/install-app-banner";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Next's development chunks are regenerated whenever a route recompiles.
    // An old worker can keep controlling a tab across a dev-server restart and
    // leave that tab asking for a chunk which no longer exists. Development
    // does not need offline support, so deliberately release any old worker.
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) void registration.unregister();
      });
      return;
    }

    const url = "/sw.js";
    void navigator.serviceWorker.register(url).catch(() => undefined);
  }, []);
  return <InstallAppBanner />;
}
