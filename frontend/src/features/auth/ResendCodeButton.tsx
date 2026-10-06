"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Mail } from "lucide-react";

interface ResendCodeButtonProps {
  countdown: number;
  isSending: boolean;
  onResend: () => Promise<void>;
}

export function ResendCodeButton({ countdown, isSending, onResend }: ResendCodeButtonProps) {
  const t = useTranslations("auth");
  const common = useTranslations("common");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sendingRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
    };
  }, [isOpen]);

  async function resend() {
    if (countdown > 0 || isSending || sendingRef.current) return;
    sendingRef.current = true;
    try {
      await onResend();
    } finally {
      sendingRef.current = false;
      dialogRef.current?.close();
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <button type="button" disabled={isSending} onClick={() => setIsOpen(true)} className="min-h-11 text-amber-800 font-medium underline-offset-4 hover:underline disabled:opacity-50">
          {t("resendBtn")}
        </button>
        {countdown > 0 && <span className="text-stone-500" role="timer">{t("resendIn")} {countdown}s</span>}
      </div>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClose={() => setIsOpen(false)}
        onClick={event => { if (event.target === event.currentTarget) dialogRef.current?.close(); }}
        className="fixed m-auto w-[calc(100%_-_2rem)] max-w-md max-h-[calc(100dvh_-_2rem)] overflow-y-auto rounded-2xl border border-stone-200 bg-white p-0 text-stone-900 shadow-2xl backdrop:bg-stone-950/45 backdrop:backdrop-blur-sm"
      >
        <div className="p-5 sm:p-7">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-800">
            <Mail className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 id={titleId} className="text-xl font-serif sm:text-2xl">{t("resendModalTitle")}</h2>
          <p id={descriptionId} className="mt-3 text-sm leading-7 text-stone-600">
            {t.rich("resendReminder", { spam: chunks => <strong className="rounded bg-amber-100 px-1 py-0.5 font-semibold text-amber-900">{chunks}</strong> })}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-2 sm:gap-3">
            <button type="button" disabled={isSending || countdown > 0} onClick={resend} className="min-h-12 rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm">
              {isSending ? common("loading") : t("resendBtn")}
              {countdown > 0 && <span className="mt-1 block tabular-nums">{countdown}s</span>}
            </button>
            <button type="button" autoFocus onClick={() => dialogRef.current?.close()} className="min-h-12 rounded-xl bg-stone-900 px-3 py-3 text-xs font-medium text-white hover:bg-black sm:text-sm">
              {t("understood")}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
