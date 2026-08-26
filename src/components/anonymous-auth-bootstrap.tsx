"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { ensureAnonymousSession } from "@/lib/supabase/client";

type BootstrapState = "loading" | "ready" | "error";
type RouteBootstrapState = { pathname: string; status: BootstrapState };

export function AnonymousAuthBootstrap({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isTeacherPath = pathname.startsWith("/teacher");
  const [bootstrapState, setBootstrapState] = useState<RouteBootstrapState>({
    pathname,
    status: "loading",
  });
  const state = bootstrapState.pathname === pathname ? bootstrapState.status : "loading";

  function bootstrap() {
    setBootstrapState({ pathname, status: "loading" });
    return ensureAnonymousSession()
      .then(() => setBootstrapState({ pathname, status: "ready" }))
      .catch(() => setBootstrapState({ pathname, status: "error" }));
  }

  useEffect(() => {
    if (isTeacherPath) return;

    let active = true;

    ensureAnonymousSession()
      .then(() => {
        if (active) setBootstrapState({ pathname, status: "ready" });
      })
      .catch(() => {
        if (active) setBootstrapState({ pathname, status: "error" });
      });

    return () => {
      active = false;
    };
  }, [isTeacherPath, pathname]);

  if (isTeacherPath) return children;

  if (state === "loading") {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <p className="text-sm text-[var(--muted)]" role="status">
          Đang khởi tạo phiên MINCLASS…
        </p>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <div className="max-w-lg rounded-2xl border border-amber-300 bg-amber-50 p-6 text-center text-amber-950 shadow-sm" role="alert">
          <p>Không thể khởi tạo phiên. Hãy kiểm tra cấu hình Supabase và thử lại.</p>
          <button className="mt-5 rounded-xl bg-amber-900 px-5 py-2.5 font-semibold text-white" onClick={() => void bootstrap()} type="button">
            Thử lại
          </button>
        </div>
      </main>
    );
  }

  return children;
}
