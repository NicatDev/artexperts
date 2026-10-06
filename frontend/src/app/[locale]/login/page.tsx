"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { useAuth } from "@/features/auth/AuthContext";
import { Mail, Lock, LogIn, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const tAuth = useTranslations("auth");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { user, login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (user) {
      router.replace("/profile");
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setIsLoading(true);
    setErrorMsg("");
    try {
      await login({ email: email.trim(), password });
      router.push("/profile");
    } catch (err: any) {
      setErrorMsg(err.message || "Giriş məlumatları yanlışdır.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full bg-white border border-stone-200/80 rounded-2xl p-8 space-y-6 shadow-[0_10px_35px_-5px_rgba(0,0,0,0.06)]">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center mx-auto shadow-inner">
            <LogIn className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-serif text-stone-900 font-medium">
            {tAuth("loginTitle")}
          </h1>
          <p className="text-xs text-stone-500">
            Art Experts platforması profilinizə daxil olun
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
                className="w-full bg-stone-50/60 border border-stone-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-stone-900 placeholder-stone-400 focus:bg-white focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-500/20 transition-all"
              />
              <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-stone-900 hover:bg-black text-white font-medium text-xs transition-all shadow-sm disabled:opacity-50"
          >
            {isLoading ? tCommon("loading") : tAuth("loginBtn")}
          </button>
          <Link href="/forgot-password" className="block text-center text-xs text-amber-800 hover:underline">
            {tAuth("forgotPassword")}
          </Link>
        </form>

        <div className="text-center pt-3 border-t border-stone-100">
          <Link href="/register" className="text-xs text-stone-600 hover:text-amber-800 font-medium transition-colors">
            {tAuth("noAccount")}
          </Link>
        </div>
      </div>
    </div>
  );
}
