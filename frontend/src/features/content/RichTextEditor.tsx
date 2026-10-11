"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "next-intl";
import { createArticleEditor } from "@/lib/article-editor";
import { api } from "@/lib/api";

export function RichTextEditor({ value, onChange, id, labelledBy, invalid, describedBy, disabled, onUploading }: {
  value: string; onChange: (value: string) => void; id: string; labelledBy: string;
  invalid: boolean; describedBy?: string; disabled: boolean; onUploading: (busy: boolean) => void;
}) {
  const locale = useLocale();
  const host = useRef<HTMLDivElement>(null);
  const instance = useRef<ReturnType<typeof createArticleEditor> | null>(null);
  const callbacks = useRef({ onChange, onUploading });
  callbacks.current = { onChange, onUploading };
  const initial = useRef(value);
  useEffect(() => {
    if (!host.current) return;
    const editor = createArticleEditor(host.current, {
      value: initial.current, locale, id, labelledBy,
      onChange: html => callbacks.current.onChange(html),
      onUploading: busy => callbacks.current.onUploading(busy),
      uploadImage: api.uploadArticleImage,
    });
    instance.current = editor;
    return () => { instance.current = null; editor.destroy(); };
  }, [id, labelledBy, locale]);
  useEffect(() => { instance.current?.setEditable(!disabled); }, [disabled]);
  useEffect(() => { instance.current?.setInvalid(invalid, describedBy); }, [invalid, describedBy]);
  return <div ref={host} className="min-w-0" />;
}
