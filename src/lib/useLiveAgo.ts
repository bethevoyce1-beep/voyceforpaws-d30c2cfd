import { useEffect, useState } from "react";

const FROZEN_STATUSES = new Set(["RESCUED", "RESOLVED", "CLOSED", "HELPED"]);

export type LiveAgo = {
  minutes: number;
  seconds: number;
  totalSeconds: number;
  label: string;
  frozen: boolean;
};

function compute(reportedAt: string, frozen: boolean, frozenAt: number | null): LiveAgo {
  const start = new Date(reportedAt).getTime();
  const now = frozen && frozenAt != null ? frozenAt : Date.now();
  const totalSeconds = Math.max(0, Math.floor((now - start) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  let label: string;
  if (totalSeconds < 60) label = "JUST NOW";
  else if (minutes < 60) label = `${minutes} MIN AGO`;
  else if (minutes < 60 * 24) label = `${Math.floor(minutes / 60)} HR AGO`;
  else label = `${Math.floor(minutes / 60 / 24)} DAYS AGO`;
  return { minutes, seconds, totalSeconds, label, frozen };
}

export function useLiveAgo(reportedAt: string, status?: string): LiveAgo {
  const frozen = !!status && FROZEN_STATUSES.has(status.toUpperCase());
  const [frozenAt] = useState<number | null>(() => (frozen ? Date.now() : null));
  const [value, setValue] = useState<LiveAgo>(() => compute(reportedAt, frozen, frozenAt));

  useEffect(() => {
    setValue(compute(reportedAt, frozen, frozenAt));
    if (frozen) return;
    const t = setInterval(() => setValue(compute(reportedAt, false, null)), 1000);
    return () => clearInterval(t);
  }, [reportedAt, frozen, frozenAt]);

  return value;
}

export function formatTimer(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}
