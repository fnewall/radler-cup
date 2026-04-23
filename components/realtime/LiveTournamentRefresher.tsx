"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LiveTournamentRefresher() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let pending = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function debouncedRefresh() {
      if (pending) return;
      pending = true;
      timer = setTimeout(() => {
        pending = false;
        router.refresh();
      }, 1200);
    }

    const channel = supabase
      .channel("tournament-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match" },
        () => debouncedRefresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session" },
        () => debouncedRefresh()
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
