// Cloudflare Turnstile — site key is public by design.
export const TURNSTILE_SITE_KEY = "0x4AAAAAADscO1BBFP1pq1TT";

type TurnstileApi = {
  render: (
    container: HTMLElement | string,
    opts: {
      sitekey: string;
      size?: "invisible" | "normal" | "compact" | "flexible";
      callback?: (token: string) => void;
      "error-callback"?: (err?: unknown) => void;
      "expired-callback"?: () => void;
      execution?: "render" | "execute";
      appearance?: "always" | "execute" | "interaction-only";
    },
  ) => string;
  execute: (widgetId: string) => void;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

export function loadTurnstile(): Promise<TurnstileApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Turnstile requires browser"));
  }
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-turnstile-loader="1"]',
    );
    const onReady = () => {
      const poll = setInterval(() => {
        if (window.turnstile) {
          clearInterval(poll);
          resolve(window.turnstile);
        }
      }, 50);
      setTimeout(() => {
        clearInterval(poll);
        if (!window.turnstile) reject(new Error("Turnstile failed to load"));
      }, 8000);
    };
    if (existing) {
      onReady();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.defer = true;
    s.dataset.turnstileLoader = "1";
    s.onload = onReady;
    s.onerror = () => reject(new Error("Failed to load Turnstile script"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Run an invisible Turnstile challenge and resolve with a token.
 * Silent for ~98% of users; only suspicious traffic sees an interactive challenge.
 */
export async function getTurnstileToken(): Promise<string> {
  const api = await loadTurnstile();
  return new Promise<string>((resolve, reject) => {
    const host = document.createElement("div");
    host.style.position = "fixed";
    host.style.left = "-9999px";
    host.style.top = "-9999px";
    host.setAttribute("aria-hidden", "true");
    document.body.appendChild(host);

    let settled = false;
    const cleanup = (id: string | null) => {
      if (id) {
        try { api.remove(id); } catch { /* noop */ }
      }
      if (host.parentNode) host.parentNode.removeChild(host);
    };

    const widgetId = api.render(host, {
      sitekey: TURNSTILE_SITE_KEY,
      size: "invisible",
      appearance: "interaction-only",
      callback: (token) => {
        if (settled) return;
        settled = true;
        resolve(token);
        cleanup(widgetId);
      },
      "error-callback": (err) => {
        if (settled) return;
        settled = true;
        cleanup(widgetId);
        reject(new Error(`Turnstile error: ${String(err ?? "unknown")}`));
      },
      "expired-callback": () => {
        if (settled) return;
        settled = true;
        cleanup(widgetId);
        reject(new Error("Turnstile token expired"));
      },
    });

    // For invisible widgets, execution starts automatically, but call execute()
    // defensively in case the widget was rendered in a deferred state.
    try { api.execute(widgetId); } catch { /* noop */ }

    setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup(widgetId);
      reject(new Error("Turnstile timed out"));
    }, 15000);
  });
}
