/**
 * AuthPageLayout Component
 *
 * Reusable layout component for authentication pages (login, forgot-password, reset-password).
 * Provides consistent styling and structure across all auth pages.
 */

import React from "react";

interface AuthPageLayoutProps {
  title: string;
  description?: string;
  subtitle?: string;
  devNote?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthPageLayout({
  title,
  description,
  subtitle,
  devNote,
  children,
  footer,
}: AuthPageLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            {title}
          </h2>
          {description && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {description}
            </p>
          )}
          {subtitle && (
            <p className="mt-1 text-lg font-medium text-gray-900 dark:text-white">
              {subtitle}
            </p>
          )}
          {devNote && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
              {devNote}
            </p>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          {children}
        </div>

        {footer && <div className="text-center">{footer}</div>}
      </div>
    </div>
  );
}

