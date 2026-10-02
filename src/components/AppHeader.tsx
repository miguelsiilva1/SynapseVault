'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { LogOut, Moon, Sun } from 'lucide-react';

type Language = 'pt' | 'en';

interface AppHeaderProps {
  active: 'studio' | 'rooms' | 'admin';
  language: Language;
  onLanguageChange?: (lang: Language) => void;
  email?: string;
  onSignOut?: () => void;
  /** Page-specific actions, shown before the global controls. */
  children?: React.ReactNode;
}

export function BrandMark({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="brand-mark-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c4dff" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#brand-mark-gradient)" />
      <path
        d="M21 9.5h-6.5a3.25 3.25 0 0 0 0 6.5h3a3.25 3.25 0 0 1 0 6.5H11"
        fill="none"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="21" cy="9.5" r="2.4" fill="#fff" />
      <circle cx="11" cy="22.5" r="2.4" fill="#fff" />
    </svg>
  );
}

function toggleTheme() {
  const root = document.documentElement;
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  localStorage.setItem('synapse_theme', next);
}

export default function AppHeader({
  active,
  language,
  onLanguageChange,
  email,
  onSignOut,
  children,
}: AppHeaderProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const pt = language === 'pt';

  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    fetch('/api/me')
      .then((res) => (res.ok ? res.json() : { isAdmin: false }))
      .then((data) => {
        if (!cancelled) setIsAdmin(Boolean(data.isAdmin));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [email]);

  const links = [
    { id: 'studio', href: '/', label: pt ? 'Estúdio' : 'Studio' },
    { id: 'rooms', href: '/rooms', label: pt ? 'Salas' : 'Rooms' },
    ...(isAdmin || active === 'admin' ? [{ id: 'admin', href: '/admin', label: 'Admin' }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface px-4 sm:px-6 flex flex-wrap items-center gap-x-6 gap-y-2 min-h-14">
      <Link href="/" className="flex items-center gap-2.5 shrink-0">
        <BrandMark />
        <span className="text-sm font-semibold tracking-tight text-ink">SynapseVault</span>
      </Link>

      {email && (
        <nav className="flex items-stretch self-stretch gap-1" aria-label={pt ? 'Principal' : 'Main'}>
          {links.map((link) => {
            const current = link.id === active;
            return (
              <Link
                key={link.id}
                href={link.href}
                aria-current={current ? 'page' : undefined}
                className={`relative flex items-center px-3 text-sm transition-colors ${
                  current ? 'text-ink font-medium' : 'text-muted hover:text-ink'
                }`}
              >
                {link.label}
                {current && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand" />}
              </Link>
            );
          })}
        </nav>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-2 py-2">
        {children}

        {onLanguageChange && (
          <div className="flex items-center rounded-lg border border-line p-0.5 text-xs">
            {(['pt', 'en'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => onLanguageChange(lang)}
                aria-pressed={language === lang}
                className={`px-2 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  language === lang ? 'bg-raised text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={toggleTheme}
          title={pt ? 'Mudar tema' : 'Switch theme'}
          aria-label={pt ? 'Mudar tema' : 'Switch theme'}
          className="p-2 rounded-lg border border-line text-muted hover:text-ink hover:bg-raised transition-colors cursor-pointer"
        >
          <Moon className="w-4 h-4 dark:hidden" />
          <Sun className="w-4 h-4 hidden dark:block" />
        </button>

        {email && (
          <div className="flex items-center gap-2 pl-2 text-xs text-muted">
            <span className="max-w-40 truncate" title={email}>
              {email}
            </span>
            {onSignOut && (
              <button
                onClick={onSignOut}
                title={pt ? 'Terminar sessão' : 'Sign out'}
                aria-label={pt ? 'Terminar sessão' : 'Sign out'}
                className="p-2 rounded-lg text-muted hover:text-danger hover:bg-raised transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
