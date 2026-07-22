import { useState } from "react";
import {
  followAnimal,
  savePushSubscription,
  type AcsAnimal,
} from "@/lib/acs.functions";

// Browser push helpers. Public VAPID key is safe to ship in the client.
const VAPID_PUBLIC_KEY =
  "BLQua0ySPPoxNk5FBNN6MagJ8b81agSTC87Z5UjupkemPVbx-fOn4rFZR9_cft4otV-5K_A56IxuRa9sJN6Ma-w";
function urlB64ToUint8Array(b64: string): Uint8Array {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
async function enableDevicePush(email: string): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("This browser/device doesn't support notifications. Try Chrome, or on iPhone add Voyce to your Home Screen first.");
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Notifications weren't allowed for this site.");
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY),
  });
  const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  await savePushSubscription({
    data: { email, endpoint: j.endpoint ?? "", p256dh: j.keys?.p256dh ?? "", auth: j.keys?.auth ?? "", ua: navigator.userAgent },
  });
}

export function FollowModal({ animal, onClose }: { animal: AcsAnimal; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [cadence, setCadence] = useState<"instant" | "daily">("instant");
  const [pushOn, setPushOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setErr(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setErr("Please enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      const channels = ["email"];
      if (pushOn) {
        try { await enableDevicePush(email.trim()); channels.push("push"); }
        catch (pe) { setErr(pe instanceof Error ? pe.message : "Couldn't turn on device notifications; following by email."); }
      }
      const r = await followAnimal({
        data: { animalId: animal.id, email: email.trim(), name: name.trim() || undefined, cadence, channels },
      });
      if (!r.ok) { setErr(r.error || "Couldn't follow — please try again."); return; }
      // Remember who this device follows as, so the header bell can show their alerts.
      try { if (typeof window !== "undefined") window.localStorage.setItem("voyce_email", email.trim()); } catch { /* ignore */ }
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't follow — please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-full bg-black/5 px-2.5 py-1 text-sm text-foreground/70 hover:bg-black/10"
        >
          ✕
        </button>
        {done ? (
          <div className="py-6 text-center">
            <div className="text-3xl">🔔</div>
            <h3 className="mt-2 font-serif text-[20px] font-bold">You're following {animal.name}</h3>
            <p className="mt-1 text-[13px] text-foreground/70">
              We'll email you {cadence === "daily" ? "once a day" : "as soon as"} {animal.name}'s status changes.
            </p>
            <button onClick={onClose} className="mt-4 rounded-full bg-[#FFDF3B] px-5 py-2.5 text-sm font-bold text-[#3A2A07]">Done</button>
          </div>
        ) : (
          <>
            <h3 className="font-serif text-[18px] font-bold">🔔 Follow {animal.name}</h3>
            <p className="mt-1 text-[12.5px] text-foreground/70">
              Get an email whenever {animal.name}'s status changes — moves to critical, gets a hold, is adopted, or leaves the list.
            </p>
            <label className="mt-3 block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">Your email *</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="you@email.com"
                className="mt-1 w-full rounded-xl border border-[#D9D2C2] bg-white px-3 py-2 text-[14px] outline-none focus:border-[#C9871A]"
              />
            </label>
            <label className="mt-2 block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">Your name (optional)</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="First name"
                className="mt-1 w-full rounded-xl border border-[#D9D2C2] bg-white px-3 py-2 text-[14px] outline-none focus:border-[#C9871A]"
              />
            </label>
            <div className="mt-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">How often?</span>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {([
                  { k: "instant", t: "As it happens", s: "Checked every 15 min" },
                  { k: "daily", t: "Once a day", s: "A daily digest" },
                ] as const).map((o) => (
                  <button
                    key={o.k}
                    onClick={() => setCadence(o.k)}
                    className={`rounded-xl border px-3 py-2 text-left transition ${
                      cadence === o.k ? "border-[#C9871A] bg-[#FFF7D6]" : "border-[#D9D2C2] bg-white"
                    }`}
                  >
                    <div className="text-[13px] font-bold text-[#1A1611]">{o.t}</div>
                    <div className="text-[10.5px] text-foreground/60">{o.s}</div>
                  </button>
                ))}
              </div>
            </div>
            <label className="mt-3 flex items-start gap-2 rounded-xl border border-[#D9D2C2] bg-white px-3 py-2.5 cursor-pointer">
              <input type="checkbox" checked={pushOn} onChange={(e) => setPushOn(e.target.checked)} className="mt-0.5" />
              <span className="text-[12.5px] leading-snug text-[#1A1611]">
                <b>Also notify me on this device</b> (browser push) — a pop-up even when the app is closed.
              </span>
            </label>
            {err && (
              <div className="mt-3 rounded-xl bg-[#FCE4E4] px-3 py-2 text-[12.5px] font-medium text-[#7E1F1F]">{err}</div>
            )}
            <button
              onClick={submit}
              disabled={busy}
              className="mt-4 w-full rounded-2xl bg-black px-5 py-3 text-[13px] font-bold uppercase tracking-wide text-white shadow-lg transition active:scale-[0.99] disabled:opacity-70"
            >
              {busy ? "Following…" : `🔔 Follow ${animal.name}`}
            </button>
            <p className="mt-2 text-center text-[10.5px] text-foreground/50">One tap to stop following in any email.</p>
          </>
        )}
      </div>
    </div>
  );
}
