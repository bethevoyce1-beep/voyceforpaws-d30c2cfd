import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AddToHomeBanner } from "@/components/voyce/AddToHomeBanner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Auto-update (July 5, 2026; loop-fixed same day; broadened July 16, 2026):
// visitors kept getting stale cached versions and had to clear caches by hand.
// This hook compares the MAIN ENTRY asset path the running page loaded against
// the one the server currently serves. Vite content-hashes the entry on every
// build, so a mismatch means a new deploy:
//   • right after load → reload once (nothing in progress yet)
//   • whenever the app is brought back to the foreground (tab switch, or
//     reopening the installed home-screen app) → reload once if it's stale
// LOOP GUARDS: only the FIRST matching asset path is compared (lazy-loaded
// chunks accumulate in the DOM and must not count); after a reload the running
// entry equals the server entry so it won't reload again; and a sessionStorage
// stamp hard-caps auto-reloads to one per 2 minutes no matter what.
// ---------------------------------------------------------------------------
const RELOAD_STAMP_KEY = "voyce_auto_reload_at";

function entryAssetPath(urls: string[]): string | null {
  for (const u of urls) {
    if (!u) continue;
    try {
      const p = new URL(u, window.location.href).pathname;
      if (p.includes("/assets/") || p.includes("/_build/")) return p;
    } catch {
      // malformed URL — skip
    }
  }
  return null;
}

function runningEntry(): string | null {
  const urls: string[] = [];
  document.querySelectorAll("script[src]").forEach((el) => {
    urls.push(el.getAttribute("src") ?? "");
  });
  return entryAssetPath(urls);
}

async function serverEntry(): Promise<string | null> {
  const res = await fetch(window.location.pathname + "?_vc=" + Date.now(), {
    cache: "no-store",
    headers: { accept: "text/html" },
  });
  if (!res.ok) return null;
  const html = await res.text();
  const urls: string[] = [];
  const re = /<script[^>]+src="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) urls.push(m[1]);
  return entryAssetPath(urls);
}

function recentlyAutoReloaded(): boolean {
  try {
    const t = Number(sessionStorage.getItem(RELOAD_STAMP_KEY) || 0);
    return Date.now() - t < 2 * 60 * 1000;
  } catch {
    return true; // storage unavailable — err on the side of never looping
  }
}

function useAutoRefreshOnNewVersion() {
  useEffect(() => {
    let reloading = false;

    const isNewBuild = async (): Promise<boolean> => {
      const current = runningEntry();
      if (!current) return false;
      try {
        const latest = await serverEntry();
        return latest !== null && latest !== current;
      } catch {
        return false; // offline or flaky network — never disturb the user
      }
    };

    const reloadIf = async () => {
      if (reloading || recentlyAutoReloaded()) return;
      if (await isNewBuild()) {
        reloading = true;
        try {
          sessionStorage.setItem(RELOAD_STAMP_KEY, String(Date.now()));
        } catch {
          // if we can't stamp it, don't reload — avoids any chance of a loop
          return;
        }
        window.location.reload();
      }
    };

    // Fresh arrival: if the browser served a stale cached page, swap it for
    // the current build right away — the visitor hasn't started anything yet.
    const t = setTimeout(() => void reloadIf(), 1500);

    // On ANY return to the foreground — switching back to the tab, or reopening
    // the installed home-screen app — check for a newer deploy and swap to it.
    // reloadIf only reloads when the build actually changed, and the 2-minute
    // stamp prevents loops, so this never interrupts active use.
    const onVisible = () => {
      if (document.visibilityState === "visible") void reloadIf();
    };
    const onFocus = () => void reloadIf();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(t);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#0B0B0C" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Voyce" },
      { name: "application-name", content: "Voyce for Paws" },
      { title: "Voyce for Paws App — Animal Rescue Network" },
      { name: "description", content: "Connecting animals in need with the people who can help — instantly. Voyce AI alerts the closest  pack first  and then ripple outwards. 501(c)(3)." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Voyce for Paws App — Animal Rescue Network" },
      { property: "og:description", content: "Connecting animals in need with the people who can help — instantly. Voyce AI alerts the closest  pack first  and then ripple outwards. 501(c)(3)." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Voyce for Paws App — Animal Rescue Network" },
      { name: "twitter:description", content: "Connecting animals in need with the people who can help — instantly. Voyce AI alerts the closest  pack first  and then ripple outwards. 501(c)(3)." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/a22290e8-4720-442b-aa62-697e9e9cf7cb" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/a22290e8-4720-442b-aa62-697e9e9cf7cb" },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/svg+xml", href: "/icon.svg" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useAutoRefreshOnNewVersion();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <AddToHomeBanner />
    </QueryClientProvider>
  );
}
