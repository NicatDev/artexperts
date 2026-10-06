"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { api } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthContext";
import { ResendCodeButton } from "@/features/auth/ResendCodeButton";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const common = useTranslations("common");
  const { refreshUser } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [step, setStep] = useState<"request" | "confirm" | "done">("request");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown === 0) return;
    const timer = setTimeout(() => setCountdown(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  async function sendCode() {
    if (busy || (step === "confirm" && countdown > 0)) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.requestPasswordReset(email.trim());
      setStep("confirm");
      setCountdown(60);
      setMessage(t("resetSent"));
      if (result.development_code) {
        setCode(result.development_code);
        setMessage(`${t("resetSent")} (${result.development_code})`);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : t("resetError"));
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === "request") return sendCode();
    if (password !== confirmation) {
      setError(t("passwordMismatch"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.confirmPasswordReset(email.trim(), code, password);
      await refreshUser();
      setPassword("");
      setConfirmation("");
      setCode("");
      setStep("done");
      setMessage(t("resetSuccess"));
    } catch (error) {
      setError(error instanceof Error ? error.message : t("resetError"));
    } finally {
      setBusy(false);
    }
  }

  const inputClass = "w-full border border-stone-200 bg-stone-50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-600";
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full bg-white border border-stone-200 rounded-2xl p-8 space-y-6 shadow-sm">
        <h1 className="text-2xl font-serif text-center">{t("resetTitle")}</h1>
        {error && <p role="alert" className="text-sm p-3 rounded-xl bg-rose-50 text-rose-700">{error}</p>}
        {message && <p role="status" className="text-sm p-3 rounded-xl bg-emerald-50 text-emerald-700">{message}</p>}
        {step !== "done" && <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm space-y-2">
            <span>{t("email")}</span>
            <input className={inputClass} type="email" autoComplete="email" required value={email} readOnly={step === "confirm"} onChange={event => setEmail(event.target.value)} />
          </label>
          {step === "confirm" && <>
            <label className="block text-sm space-y-2">
              <span>{t("codeLabel")}</span>
              <input className={inputClass} required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} />
            </label>
            <label className="block text-sm space-y-2">
              <span>{t("newPassword")}</span>
              <input className={inputClass} required type="password" autoComplete="new-password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} />
            </label>
            <label className="block text-sm space-y-2">
              <span>{t("confirmPassword")}</span>
              <input className={inputClass} required type="password" autoComplete="new-password" minLength={8} value={confirmation} onChange={event => setConfirmation(event.target.value)} />
            </label>
            <ResendCodeButton countdown={countdown} isSending={busy} onResend={sendCode} />
            <button type="button" disabled={busy} className="block text-xs text-stone-600" onClick={() => { setStep("request"); setCode(""); setMessage(""); setError(""); }}>{t("changeEmail")}</button>
          </>}
          <button disabled={busy} className="w-full rounded-xl py-3 bg-stone-900 text-white text-sm disabled:opacity-50">{busy ? common("loading") : step === "request" ? t("requestCodeBtn") : t("resetButton")}</button>
        </form>}
        <Link href="/login" className="block text-center text-sm text-amber-800 hover:underline">{t("loginBtn")}</Link>
      </div>
    </div>
  );
}
