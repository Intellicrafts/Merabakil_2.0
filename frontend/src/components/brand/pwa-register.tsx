"use client";

import { useEffect } from "react";

import { InstallAppBanner } from "@/components/brand/install-app-banner";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const url = "/sw.js";
    void navigator.serviceWorker.register(url).catch(() => undefined);
  }, []);
  return <InstallAppBanner />;
}
