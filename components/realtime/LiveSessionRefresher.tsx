"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  sessionId: string;
  matchIds: string[];
};

export function LiveSessionRefresher({ sessionId, matchIds }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (matchIds.length === 0) return;

    const supabase = createClient();
    let pending = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function debouncedRefresh() {
      if (pending) return;
      pending = true;
      timer = setTimeout(() => {
        pending = false;
        router.refresh();
      }, 800);
    }

    const matchChannel = supabase
      .channel(`session-${sessionId}-matches`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match",
          filter: `session_id=eq.${sessionId}`,
        },
        () => debouncedRefresh()
      )
      .subscribe();

    const holeChannel = supabase
      .channel(`session-${sessionId}-holes`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "hole_score",
          filter: `match_id=in.(${matchIds.join(",")})`,
        },
        () => debouncedRefresh()
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(matchChannel);
      supabase.removeChannel(holeChannel);
    };
  }, [sessionId, matchIds.join(","), router]);

  return null;
}
