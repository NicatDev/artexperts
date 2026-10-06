"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { CheckCircle2, XCircle, Search, UserPlus, X } from "lucide-react";

interface GrantAccessModalProps {
  bookId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function GrantAccessModal({ bookId, isOpen, onClose, onSuccess }: GrantAccessModalProps) {
  const tBooks = useTranslations("books");
  const tCommon = useTranslations("common");

  const [email, setEmail] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [userFound, setUserFound] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  if (!isOpen) return null;

  const handleEmailCheck = async () => {
    if (!email.trim() || !email.includes("@")) return;

    setIsChecking(true);
    setErrorMsg("");
    setUserFound(null);
    setSuccessMsg("");

    try {
      const res = await api.lookupUser(email.trim());
      if (res.exists) {
        setUserFound(res);
      } else {
        setErrorMsg(tBooks("emailNotFound"));
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Axtarış zamanı xəta baş verdi.");
    } finally {
      setIsChecking(false);
    }
  };

  const handleGrant = async () => {
    if (!email.trim() || !userFound) return;

    setIsSubmitting(true);
    setErrorMsg("");
    try {
      await api.grantBookAccess(bookId, email.trim());
      setSuccessMsg(tBooks("grantSuccess"));
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || "İcazə verilmədi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
      <div className="bg-white border border-stone-200 rounded-3xl max-w-md w-full p-7 space-y-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-stone-400 hover:text-stone-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-2">
          <div className="w-11 h-11 rounded-full bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
            <UserPlus className="w-5 h-5" />
          </div>
          <h3 className="text-xl font-serif text-stone-900 font-medium">
            {tBooks("grantAccessTitle")}
          </h3>
          <p className="text-xs text-stone-500">
            {tBooks("enterEmailPrompt")}
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setUserFound(null);
                setErrorMsg("");
              }}
              placeholder="istifadeci@example.com"
              className="flex-1 bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-600 focus:bg-white transition-colors"
            />
            <button
              type="button"
              onClick={handleEmailCheck}
              disabled={isChecking || !email.includes("@")}
              className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-medium disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5 text-amber-700" />
              <span>Yoxla</span>
            </button>
          </div>

          {/* Verification status indicator */}
          {userFound && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div className="text-xs">
                <span className="block text-emerald-900 font-semibold">
                  {tBooks("emailVerified")}
                </span>
                <span className="block text-stone-600 text-[11px]">
                  {userFound.full_name} (@{userFound.username || "user"})
                </span>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 flex items-center gap-2 text-xs text-rose-800">
              <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-400 text-xs text-emerald-900 text-center font-medium">
              {successMsg}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full text-xs text-stone-600 hover:text-stone-900 transition-colors"
          >
            {tCommon("cancel")}
          </button>
          <button
            type="button"
            onClick={handleGrant}
            disabled={!userFound || isSubmitting}
            className="px-6 py-2.5 rounded-full bg-stone-900 hover:bg-black text-white font-medium text-xs transition-all shadow-xs disabled:opacity-40"
          >
            {isSubmitting ? tCommon("loading") : tCommon("submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
