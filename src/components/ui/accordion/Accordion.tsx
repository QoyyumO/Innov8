'use client';

import React, { useState } from 'react';

interface AccordionProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  isOpen?: boolean; // Controlled state
  onToggle?: (isOpen: boolean) => void; // Callback for controlled state
  headerContent?: React.ReactNode;
  className?: string;
}

export const Accordion: React.FC<AccordionProps> = ({
  title,
  subtitle,
  children,
  defaultOpen = false,
  isOpen: controlledIsOpen,
  onToggle,
  headerContent,
  className = '',
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(defaultOpen);
  
  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  
  const handleToggle = () => {
    const newIsOpen = !isOpen;
    if (onToggle) {
      onToggle(newIsOpen);
    } else {
      setInternalIsOpen(newIsOpen);
    }
  };

  return (
    <div
      className={`rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] ${className}`}
    >
      {/* Accordion Header - Clickable */}
      <button
        onClick={handleToggle}
        className="w-full px-6 py-5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-base font-medium text-gray-800 dark:text-white/90">
              {title}
            </h3>
            {subtitle && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {subtitle}
              </p>
            )}
          </div>

          {headerContent && (
            <div className="ml-4 flex items-center gap-4">
              {headerContent}
            </div>
          )}

          {/* Expand/Collapse Icon */}
          <svg
            className={`ml-4 h-5 w-5 text-gray-400 transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {/* Accordion Content */}
      {isOpen && (
        <div className="border-t border-gray-100 px-6 py-4 dark:border-gray-800">
          {children}
        </div>
      )}
    </div>
  );
};

export default Accordion;

