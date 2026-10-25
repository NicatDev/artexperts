"use client";

import { useEffect } from "react";

/** Casual-copy deterrents only; server permissions protect the original files. */
export function ContentProtection() {
  useEffect(() => {
    const contextMenu = (event: MouseEvent) => event.preventDefault();
    const protectedTarget = (target: EventTarget | null) => target instanceof Element && !!target.closest("[data-protected-content]");
    const copy = (event: ClipboardEvent) => {
      const selection = window.getSelection();
      const anchor = selection?.anchorNode?.parentElement;
      if (protectedTarget(event.target) || protectedTarget(anchor || null)) event.preventDefault();
    };
    const drag = (event: DragEvent) => { if (protectedTarget(event.target)) event.preventDefault(); };
    document.addEventListener("contextmenu", contextMenu, true);
    document.addEventListener("copy", copy, true);
    document.addEventListener("cut", copy, true);
    document.addEventListener("dragstart", drag, true);
    return () => {
      document.removeEventListener("contextmenu", contextMenu, true);
      document.removeEventListener("copy", copy, true);
      document.removeEventListener("cut", copy, true);
      document.removeEventListener("dragstart", drag, true);
    };
  }, []);
  return null;
}
