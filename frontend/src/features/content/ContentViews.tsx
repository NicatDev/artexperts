"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/features/auth/AuthContext";
import { api } from "@/lib/api";

export function ContentViews({ kind, id, initialCount = 0 }: {
  kind: "artworks" | "books" | "articles"; id: string; initialCount?: number;
}) {
  const t = useTranslations("common");
  const { user, isLoading } = useAuth();
  const [recorded, setRecorded] = useState<{ id: string; count: number } | null>(null);

  useEffect(() => {
    if (isLoading) return;
    let active = true;
    let sent = false;
    const record = () => {
      if (sent || document.visibilityState !== "visible") return;
      sent = true;
      api.recordContentView(kind, id).then(result => {
        if (active) setRecorded({ id, count: result.views_count });
      }).catch(() => { /* A failed analytics request must not block reading content. */ });
    };
    record();
    document.addEventListener("visibilitychange", record);
    return () => { active = false; document.removeEventListener("visibilitychange", record); };
  }, [kind, id, user?.id, isLoading]);

  return <span>{recorded?.id === id ? recorded.count : initialCount} {t("views")}</span>;
}
