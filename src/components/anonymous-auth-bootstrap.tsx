"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { ensureAnonymousSession } from "@/lib/supabase/client";

export function AnonymousAuthBootstrap({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isTeacherPath = pathname.startsWith("/teacher");

  useEffect(() => {
    if (isTeacherPath) return;

    // Public pages render immediately. Student access gates await this same
    // in-flight bootstrap before they invoke an authenticated server action.
    void ensureAnonymousSession().catch(() => undefined);
  }, [isTeacherPath]);

  return children;
}
