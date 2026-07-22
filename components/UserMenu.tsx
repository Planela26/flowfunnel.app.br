"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";
import { LogOut, Crown, User, Loader2 } from "lucide-react";

export default function UserMenu() {
  const { data: session } = useSession();
  const [loggingOut, setLoggingOut] = useState(false);

  if (!session?.user) return null;

  const initials =
    session.user.name?.[0]?.toUpperCase() ||
    session.user.email?.[0]?.toUpperCase() ||
    "U";
  const displayName = session.user.name || session.user.email || "Usuário";
  const email = session.user.email || "";

  return (
    <div className="w-full space-y-2">
      {/* User info row */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 flex-shrink-0 bg-gradient-to-br from-blue-600 to-blue-400 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-800 dark:text-white truncate leading-tight">
            {displayName}
          </p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate leading-tight">
            {email}
          </p>
        </div>
        <Link
          href="/account"
          title="Minha conta"
          className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
        >
          <User className="w-3.5 h-3.5" />
        </Link>
        <button
          onClick={() => {
            if (loggingOut) return;
            setLoggingOut(true);
            signOut({ callbackUrl: "/login" });
          }}
          disabled={loggingOut}
          title={loggingOut ? "Saindo..." : "Sair da conta"}
          className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-60 disabled:cursor-wait"
        >
          {loggingOut ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
          ) : (
            <LogOut className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Upgrade row — only show if not already on top plan */}
      <Link
        href="/pricing"
        className="flex items-center gap-1.5 w-full px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-700/50 transition group"
        title="Ver planos"
      >
        <Crown className="w-3 h-3 text-amber-500 flex-shrink-0" />
        <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
          Assinar / Upgrade
        </span>
      </Link>
    </div>
  );
}
