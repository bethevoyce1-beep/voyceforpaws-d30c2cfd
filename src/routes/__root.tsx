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
// Auto-update (July 5, 2026): visitors kept getting stale cached versions of
// the app and had to be walked through clearing their browser cache. This
// hook compares the hashed asset files the RUNNING page loaded against the
// ones the server currently serves. If they differ, a new build is live:
//   • right after load → reload immediately (nothing in progress yet)
//   • returning to a tab that sat hidden 30+ minutes → reload (stale session)
// It never reloads while someone is actively using the app, so an
// in-progress rescue report is never lost.
// ---------------------------------------------------------------------------
function collectAssetPaths(urls: string[]): string | null {
  const paths = urls
    .map((u) => {
      try { return new URL(u, window.location.href).pathname; } catch { return ""; }
    })
    .filter((p) => p.includes("/assets/") || p.includes("/_build/"));
  return paths.length ? [...new Set(paths)].sort().join("|") : null;
}

function runningVersion(): string | null {
  const urls: string[] = [];
  document.querySelectorAll("script[src]").forEach((el) => urls.push(el.getAttribute("src") ?? ""));
  document.querySelectorAll('link[rel="stylesheet"][href]').forEach((el) => urls.push(el.getAttribute("href") ?? ""));
  return collectAssetPaths(urls);
}

async function serverVersion(): Promise<string | null> {
  const res = await fetch(window.location.pathname + "?_vc=" + Date.now(), {
    cache: "no-store",
    headers: { accept: "text/html" },
  });
  if (!res.ok) return null;
  const html = await res.text();
  const urls: string[] = [];
  const re = /(?:src|href)="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) urls.push(m[1]);
  return collectAssetPaths(urls);
}

function useAutoRefreshOnNewVersion() {
  useEffect(() => {
    let reloading = false;
    let hiddenAt = 0;

    const isNewBuild = async (): Promise<boolean> => {
      const current = runningVersion();
      if (!current) return false;
      try {
        const latest = await serverVersion();
        return latest !== null && latest !== current;
      } catch {
        return false; // offline or flaky network — never disturb the user
      }
    };

    const reloadIf = async () => {
      if (reloading) return;
      if (await isNewBuild()) {
        reloading = true;
        window.location.reload();
      }
    };

    // Fresh arrival: if the browser served a stale cached page, swap it for
    // the current build right away — the visitor hasn't started anything yet.
    const t = setTimeout(() => void reloadIf(), 1500);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else if (hiddenAt && Date.now() - hiddenAt > 30 * 60 * 1000) {
        void reloadIf();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(t);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Voyce for Paws App — Animal Rescue Network" },
      { name: "description", content: "Connecting animals in need with the people who can help — instantly. Voyce AI alerts the closest  network first  and then ripple outwards. 501(c)(3)." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Voyce for Paws App — Animal Rescue Network" },
      { property: "og:description", content: "Connecting animals in need with the people who can help — instantly. Voyce AI alerts the closest  network first  and then ripple outwards. 501(c)(3)." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Voyce for Paws App — Animal Rescue Network" },
      { name: "twitter:description", content: "Connecting animals in need with the people who can help — instantly. Voyce AI alerts the closest  network first  and then ripple outwards. 501(c)(3)." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/a22290e8-4720-442b-aa62-697e9e9cf7cb" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/a22290e8-4720-442b-aa62-697e9e9cf7cb" },
    ],
    links: [
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
    </QueryClientProvider>
  );
}
