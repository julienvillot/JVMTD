"use client";

import { useEffect, useState } from "react";

export interface ClientTelemetry {
  deviceId: string;
  userAgent: string;
  screens: string;
  windowSize: string;
  timezone: string;
}

const STORAGE_KEY = "tb_device_id";

/**
 * Formats standard JavaScript Date timezone offset (-Date.getTimezoneOffset()) into HMRC's UTC±hh:mm format.
 * In JS, getTimezoneOffset() is minutes behind UTC (e.g. BST UTC+1 is -60).
 */
export function formatUtcOffset(offsetMinutesFromJs: number): string {
  // Invert because JS getTimezoneOffset() is negative for positive UTC offsets
  const totalMinutes = -offsetMinutesFromJs;
  const sign = totalMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(totalMinutes);
  const hours = Math.floor(abs / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (abs % 60).toString().padStart(2, "0");
  return `UTC${sign}${hours}:${minutes}`;
}

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "00000000-0000-4000-8000-000000000000";
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(existing)) {
      return existing;
    }
    const fresh = window.crypto.randomUUID ? window.crypto.randomUUID() : "10000000-1000-4000-8000-100000000000";
    window.localStorage.setItem(STORAGE_KEY, fresh);
    return fresh;
  } catch {
    return "00000000-0000-4000-8000-000000000000";
  }
}

export function collectClientTelemetry(): ClientTelemetry {
  if (typeof window === "undefined") {
    return {
      deviceId: "00000000-0000-4000-8000-000000000000",
      userAgent: "TaxBridge-Server/1.0",
      screens: "width=1920&height=1080&scaling-factor=1&colour-depth=24",
      windowSize: "width=1280&height=800",
      timezone: "UTC+00:00",
    };
  }

  const deviceId = getOrCreateDeviceId();
  const screenWidth = window.screen?.width || 1920;
  const screenHeight = window.screen?.height || 1080;
  const scalingFactor = window.devicePixelRatio || 1;
  const colourDepth = window.screen?.colorDepth || 24;

  const innerW = window.innerWidth || 1280;
  const innerH = window.innerHeight || 800;

  const timezone = formatUtcOffset(new Date().getTimezoneOffset());

  return {
    deviceId,
    userAgent: navigator.userAgent || "Mozilla/5.0",
    screens: `width=${screenWidth}&height=${screenHeight}&scaling-factor=${scalingFactor}&colour-depth=${colourDepth}`,
    windowSize: `width=${innerW}&height=${innerH}`,
    timezone,
  };
}

export function useHmrcTelemetry(): ClientTelemetry {
  const [telemetry, setTelemetry] = useState<ClientTelemetry>(() => collectClientTelemetry());

  useEffect(() => {
    const onResize = () => setTelemetry(collectClientTelemetry());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return telemetry;
}
