import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseConfig } from "./config";

let anonymousSessionPromise: Promise<void> | null = null;

export function createClient() {
  const { url, publishableKey } = getSupabaseConfig();

  return createBrowserClient(url, publishableKey);
}

export function ensureAnonymousSession() {
  if (!anonymousSessionPromise) {
    anonymousSessionPromise = bootstrapAnonymousSession().catch((error: unknown) => {
      anonymousSessionPromise = null;
      throw error;
    });
  }

  return anonymousSessionPromise;
}

async function bootstrapAnonymousSession() {
  const supabase = createClient();
  const { data, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) throw sessionError;
  if (data.session) return;

  const { error: signInError } = await supabase.auth.signInAnonymously();

  if (signInError) throw signInError;
}
