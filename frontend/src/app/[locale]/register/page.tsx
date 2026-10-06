"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { useAuth } from "@/features/auth/AuthContext";
import { api } from "@/lib/api";
import { ResendCodeButton } from "@/features/auth/ResendCodeButton";
import { Mail, Lock, User, AtSign, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";

export default function RegisterPage() {
  const tAuth = useTranslations("auth");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [step, setStep] = useState<"request" | "verify">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");

  const [countdown, setCountdown] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (user) {
      router.replace("/profile");
    }
  }, [user, router]);

  useEffect(() => {
    let timer: any;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleRequestCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isLoading || countdown > 0) return;
    if (!email.trim() || !email.includes("@")) return;

    setIsLoading(true);
    setErrorMsg("");
    try {
      const result = await api.requestVerificationCode(email.trim());
      setStep("verify");
      setCountdown(60);
      if (result?.development_code) setCode(result.development_code);
      setSuccessMsg(result?.development_code
        ? `E-poçt xidməti qoşulmayıb. İnkişaf rejimi təsdiq kodu: ${result.development_code}`
        : "Təsdiq kodu e-poçt ünvanınıza göndərildi.");
    } catch (err: any) {
      setErrorMsg(err.message || "Kod göndərilərkən xəta baş verdi.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (code.trim().length !== 6) {
      setErrorMsg("Təsdiq kodu 6 rəqəmli olmalıdır.");
      return;
    }
    if (password.length < 8) {
      setErrorMsg("Şifrə ən azı 8 simvol olmalıdır.");
      return;
    }

    setIsLoading(true);
    try {
      const csrf = await api.getCsrfToken();
      await api.verifyAndRegister({
        email: email.trim(),
        code: code.trim(),
        password,
        full_name: fullName.trim(),
        username: username.trim().toLowerCase(),
      }, csrf.csrfToken);
      await refreshUser();
      router.push("/profile");
    } catch (err: any) {
      setErrorMsg(err.message || "Qeydiyyat uğursuz oldu.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full bg-white border border-stone-200/80 rounded-2xl p-8 space-y-6 shadow-[0_10px_35px_-5px_rgba(0,0,0,0.06)]">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center mx-auto shadow-inner">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-serif text-stone-900 font-medium">
            {tAuth("registerTitle")}
          </h1>
          <p className="text-xs text-stone-500">
            {step === "request"
              ? "Platformaya qoşulmaq üçün e-poçt ünvanınızı daxil edin"
              : tAuth("enterCodePrompt")}
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {step === "request" ? (
          /* Step 1: Request Code */
          <form onSubmit={handleRequestCode} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1.5">
                {tAuth("email")}
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="ressam@example.com"
                  className="w-full bg-stone-50/60 border border-stone-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-stone-900 placeholder-stone-400 focus:bg-white focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-500/20 transition-all"
                />
                <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !email.includes("@")}
              className="w-full py-3 rounded-xl bg-stone-900 hover:bg-black text-white font-medium text-xs transition-all shadow-sm disabled:opacity-50"
            >
              {isLoading ? tCommon("loading") : tAuth("requestCodeBtn")}
            </button>
          </form>
        ) : (
          /* Step 2: Enter Code, Details & Password */
          <form onSubmit={handleVerifyAndRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1.5">
                {tAuth("codeLabel")} (6 rəqəm)
              </label>
              <input
                type="text"
                value={code}
                maxLength={6}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                className="w-full bg-stone-50/60 border border-stone-200 rounded-xl px-4 py-2.5 text-center text-lg font-mono tracking-widest text-amber-900 placeholder-stone-400 focus:bg-white focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-500/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1.5">
                {tAuth("fullName")}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="Aygün Əliyeva"
                  className="w-full bg-stone-50/60 border border-stone-200 rounded-xl pl-10 pr-4 py-2 text-xs text-stone-900 placeholder-stone-400 focus:bg-white focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-500/20 transition-all"
                />
                <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1.5">
                {tAuth("username")}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  required
                  placeholder="aygun-aliyeva"
                  className="w-full bg-stone-50/60 border border-stone-200 rounded-xl pl-10 pr-4 py-2 text-xs text-stone-900 placeholder-stone-400 focus:bg-white focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-500/20 transition-all font-mono"
                />
                <AtSign className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1.5">
                {tAuth("password")}
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-stone-50/60 border border-stone-200 rounded-xl pl-10 pr-4 py-2 text-xs text-stone-900 placeholder-stone-400 focus:bg-white focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-500/20 transition-all"
                />
                <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <ResendCodeButton countdown={countdown} isSending={isLoading} onResend={() => handleRequestCode()} />

            <button
              type="submit"
              disabled={isLoading || code.length !== 6 || password.length < 8}
              className="w-full py-3 rounded-xl bg-stone-900 hover:bg-black text-white font-medium text-xs transition-all shadow-sm disabled:opacity-50"
            >
              {isLoading ? tCommon("loading") : tAuth("completeRegisterBtn")}
            </button>
          </form>
        )}

        <div className="text-center pt-3 border-t border-stone-100">
          <Link href="/login" className="text-xs text-stone-600 hover:text-amber-800 font-medium transition-colors">
            {tAuth("haveAccount")}
          </Link>
        </div>
      </div>
    </div>
  );
}
