"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { useAuth } from "@/features/auth/AuthContext";
import { api } from "@/lib/api";
import { focusFirstError, friendlyError, readFieldErrors, type FieldErrors } from "@/lib/form-errors";
import { ResendCodeButton } from "@/features/auth/ResendCodeButton";
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";

const fields = ["full_name", "username", "email", "password"] as const;
type Field = (typeof fields)[number];
type Details = Record<Field, string>;

export default function RegisterPage() {
  const t = useTranslations("auth");
  const v = useTranslations("validation");
  const common = useTranslations("common");
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const formRef = useRef<HTMLFormElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const generalErrorRef = useRef<HTMLParagraphElement>(null);
  const focusPending = useRef(false);
  const [values, setValues] = useState<Details>({ full_name: "", username: "", email: "", password: "" });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<FieldErrors>({});
  const [validated, setValidated] = useState("");
  const [checking, setChecking] = useState(false);
  const [step, setStep] = useState<"details" | "verify">("details");
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [generalError, setGeneralError] = useState("");
  const fingerprint = JSON.stringify(values);
  const touchedFingerprint = JSON.stringify(touched);
  const revision = useRef(0);

  useEffect(() => { if (user) router.replace("/profile"); }, [user, router]);
  useEffect(() => {
    if (!countdown) return;
    const timer = setTimeout(() => setCountdown(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);
  useEffect(() => { if (step === "verify") codeRef.current?.focus(); }, [step]);
  useEffect(() => {
    if (!busy && focusPending.current) {
      focusPending.current = false;
      if (Object.keys(errors).length) focusFirstError(formRef.current, errors);
      else if (generalError) { generalErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); generalErrorRef.current?.focus({ preventScroll: true }); }
    }
  }, [errors, generalError, busy, step]);

  function localErrors(details: Details, all = false): FieldErrors {
    const result: FieldErrors = {};
    for (const field of fields) {
      const value = field === "password" ? details[field] : details[field].trim();
      if (!value) { if (all || touched[field]) result[field] = v("required"); continue; }
      if (field === "full_name" && (value.length < 2 || value.length > 200)) result[field] = v("nameInvalid");
      if (field === "username" && !/^[a-z0-9_-]{3,100}$/.test(value)) result[field] = v("usernameInvalid");
      if (field === "email" && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 254)) result[field] = v("emailInvalid");
      if (field === "password" && value.length < 8) result[field] = v("passwordShort");
      if (field === "password" && value.length > 128) result[field] = v("passwordLong");
    }
    return result;
  }

  useEffect(() => {
    if (step !== "details" || !fields.some(field => values[field] || touched[field])) return;
    let active = true;
    const current = ++revision.current;
    setChecking(true);
    const timer = setTimeout(async () => {
      if (!active || current !== revision.current) return;
      const local = localErrors(values);
      setErrors(local);
      const payload = Object.fromEntries(fields.filter(field => values[field] && !local[field]).map(field => [field, values[field]]));
      // Password checks always include the name, email and username for similarity checks.
      if (payload.password) Object.assign(payload, { full_name: values.full_name, username: values.username, email: values.email });
      try {
        if (Object.keys(payload).length) {
          const result = await api.validateRegistration(payload);
          if (!active || current !== revision.current) return;
          const serverErrors = readFieldErrors(result.errors, v);
          setErrors({ ...local, ...Object.fromEntries(Object.entries(serverErrors).filter(([field]) => touched[field] || values[field as Field])) });
          setValidated(fingerprint);
          setGeneralError("");
        }
      } catch {
        if (active && current === revision.current) { setValidated(""); setGeneralError(v("checkUnavailable")); }
      } finally { if (active && current === revision.current) setChecking(false); }
    }, 500);
    return () => { active = false; clearTimeout(timer); };
    // Details are the validation snapshot; changing any detail invalidates pending results.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint, touchedFingerprint, step, v]);

  function change(field: Field, value: string) {
    revision.current++;
    setValues(previous => ({ ...previous, [field]: value }));
    setTouched(previous => ({ ...previous, [field]: true }));
    setErrors(previous => { const next = { ...previous }; delete next[field]; if (field !== "password") delete next.password; return next; });
    setGeneralError("");
  }

  async function sendCode() {
    const result = await api.requestVerificationCode(values.email.trim().toLowerCase());
    setCountdown(60);
    setNotice(result?.development_code ? t("developmentCode", { code: result.development_code }) : t("codeSent"));
    if (result?.development_code) setCode(result.development_code);
    setStep("verify");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    revision.current++;
    setGeneralError("");
    setChecking(false);
    setBusy(true);
    try {
      if (step === "details") {
        setTouched(Object.fromEntries(fields.map(field => [field, true])));
        let next = localErrors(values, true);
        if (!Object.keys(next).length) {
          const result = await api.validateRegistration(values);
          next = readFieldErrors(result.errors, v);
          setValidated(fingerprint);
        }
        setErrors(next);
        if (Object.keys(next).length) { focusPending.current = true; return; }
        await sendCode();
      } else {
        if (!/^\d{6}$/.test(code)) {
          const next = { code: v("codeFormat") };
          setErrors(next); focusPending.current = true; return;
        }
        await api.verifyAndRegister({ ...values, full_name: values.full_name.trim(), username: values.username.trim().toLowerCase(), email: values.email.trim().toLowerCase(), code });
        await refreshUser();
        router.push("/profile");
      }
    } catch (error) {
      const next = readFieldErrors(error, v);
      if (Object.keys(next).length) {
        setErrors(next);
        if (fields.some(field => next[field])) setStep("details");
        focusPending.current = true;
      } else { setErrors({}); setGeneralError(error instanceof Error ? friendlyError(error.message, v) : v("requestFailed")); focusPending.current = true; }
    } finally { setBusy(false); }
  }

  async function resend() {
    if (busy || countdown) return;
    setBusy(true); setGeneralError(""); setErrors({});
    try { await sendCode(); }
    catch (error) {
      const next = readFieldErrors(error, v);
      if (Object.keys(next).length) { setStep("details"); setErrors(next); focusPending.current = true; }
      else { setGeneralError(error instanceof Error ? friendlyError(error.message, v) : v("requestFailed")); focusPending.current = true; }
    } finally { setBusy(false); }
  }

  const labels: Record<Field, string> = { full_name: t("fullName"), username: t("username"), email: t("email"), password: t("password") };
  return <div className="flex min-h-[70vh] items-center justify-center px-4 py-10 sm:py-16">
    <div className="w-full max-w-md space-y-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8">
      <div className="space-y-3 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 rounded-full bg-amber-50 p-2 text-amber-800" />
        <h1 className="font-serif text-2xl">{t("registerTitle")}</h1>
        <p className="text-sm leading-6 text-stone-500">{step === "details" ? t("detailsPrompt") : t("enterCodePrompt")}</p>
        <p className="text-xs text-stone-500">{t("registrationStep", { step: step === "details" ? 1 : 2 })}</p>
      </div>
      {generalError && <p ref={generalErrorRef} tabIndex={-1} role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{generalError}</p>}
      {notice && step === "verify" && <p role="status" className="break-words rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      <form ref={formRef} noValidate onSubmit={submit} className="space-y-4">
        {fields.map(field => <div key={field} className="space-y-1.5">
          <label htmlFor={`register-${field}`} className="block text-sm font-medium text-stone-700">{labels[field]}</label>
          <div className="relative">
            <input id={`register-${field}`} name={field} type={field === "email" ? "email" : field === "password" ? "password" : "text"}
              autoComplete={field === "full_name" ? "name" : field === "password" ? "new-password" : field} spellCheck={false}
              value={values[field]} readOnly={step === "verify"} disabled={busy} required
              aria-invalid={!!errors[field]} aria-describedby={errors[field] ? `register-${field}-error` : field === "password" ? "password-hint" : undefined}
              onChange={event => change(field, field === "username" ? event.target.value.toLowerCase() : event.target.value)}
              onBlur={() => setTouched(previous => ({ ...previous, [field]: true }))}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-3 pr-10 text-base focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-100 read-only:bg-stone-100 disabled:opacity-60 sm:text-sm" />
            {values[field] && !errors[field] && (checking ? <Loader2 aria-label={t("checking")} className="absolute right-3 top-3.5 h-4 w-4 animate-spin text-stone-400" />
              : validated === fingerprint ? <CheckCircle2 aria-label={t("fieldValid")} className="absolute right-3 top-3.5 h-4 w-4 text-emerald-600" /> : null)}
          </div>
          {errors[field] && <p id={`register-${field}-error`} aria-live="polite" className="flex items-start gap-1.5 text-xs leading-5 text-rose-700"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{errors[field]}</p>}
          {field === "password" && !errors.password && step === "details" && <p id="password-hint" className="text-xs leading-5 text-stone-500">{t("passwordHint")}</p>}
        </div>)}
        {step === "verify" && <div className="space-y-3 border-t border-stone-100 pt-4">
          <label htmlFor="register-code" className="block text-sm font-medium">{t("codeLabel")}</label>
          <input ref={codeRef} id="register-code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
            value={code} disabled={busy} onChange={event => { setCode(event.target.value.replace(/\D/g, "")); setErrors(previous => ({ ...previous, code: "" })); }}
            aria-invalid={!!errors.code} aria-describedby={errors.code ? "register-code-error" : undefined}
            className="w-full rounded-xl border border-stone-200 px-4 py-3 text-center font-mono text-xl tracking-[0.4em] focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-100" />
          {errors.code && <p id="register-code-error" role="alert" className="text-sm text-rose-700">{errors.code}</p>}
          <ResendCodeButton countdown={countdown} isSending={busy} onResend={resend} />
          <button type="button" disabled={busy} onClick={() => { setStep("details"); setCode(""); setErrors({}); setNotice(""); }} className="min-h-11 text-sm text-stone-600 underline underline-offset-4">{t("editDetails")}</button>
        </div>}
        <button type="submit" disabled={busy} className="min-h-12 w-full rounded-xl bg-stone-900 px-4 py-3 text-sm font-medium text-white hover:bg-black disabled:opacity-50">{busy ? common("loading") : step === "details" ? t("completeRegisterBtn") : t("verifyRegisterBtn")}</button>
      </form>
      <div className="border-t border-stone-100 pt-4 text-center"><Link href="/login" className="inline-flex min-h-11 items-center text-sm text-stone-600 hover:text-amber-800">{t("haveAccount")}</Link></div>
    </div>
  </div>;
}
