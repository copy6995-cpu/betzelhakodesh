"use client";

import { useEffect } from "react";

/**
 * Before any export download, nudge the user to confirm they've synced — the
 * office exports lean on fresh Yemot data. Catches every link to an
 * `/api/.../export` endpoint (or anything flagged `data-export`) app-wide via a
 * single capturing click listener, so individual export links need no change.
 * Mounted once in the admin layout.
 */
export function ExportSyncGuard() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      const a = target?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href") || "";
      const path = href.split(/[?#]/)[0];
      const isExport = path.endsWith("/export") || a.hasAttribute("data-export");
      if (!isExport) return;
      if (
        !window.confirm(
          "לפני הייצוא — ביצעת סנכרון עדכני?\nאם לא, ייתכן שהנתונים אינם מעודכנים.\n\nלהמשיך בייצוא?"
        )
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
