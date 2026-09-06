import React, { useState, useRef, useEffect } from 'react';
import Input from '@/components/form/input/InputField';

interface Suggestion {
  id: string;
  label: string;
}

interface SearchDropdownProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: Suggestion[];
  onSelectSuggestion: (suggestion: Suggestion) => void;
  onCreateOption?: (value: string) => void;
  minSearchLength?: number;
  className?: string;
}

const SearchDropdown: React.FC<SearchDropdownProps> = ({
  placeholder = 'Search...',
  value,
  onChange,
  suggestions,
  onSelectSuggestion,
  onCreateOption,
  minSearchLength = 3,
  className = '',
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showDropdown =
    value.length >= minSearchLength &&
    (suggestions.length > 0 || !!onCreateOption);

  return (
    <div
      className={`relative mt-0 flex w-full flex-col items-center ${className}`}
      ref={containerRef}
    >
      <Input
        type="text"
        placeholder={placeholder}
        defaultValue={value}
        onChange={e => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
      />
      {showSuggestions && showDropdown && (
        <div className="absolute top-[3rem] z-10 w-full rounded-lg border border-gray-200 bg-white shadow">
          {suggestions.map(s => (
            <p
              key={s.id}
              className="hover:bg-brand-50 cursor-pointer px-4 py-2.5 text-sm text-gray-500 dark:text-gray-300"
              onClick={() => {
                onSelectSuggestion(s);
                setShowSuggestions(false);
              }}
            >
              {s.label}
            </p>
          ))}
          {onCreateOption && suggestions.length === 0 && (
            <p
              className="text-brand-600 hover:bg-brand-50 cursor-pointer px-4 py-2 text-gray-500 dark:text-gray-300"
              onClick={() => {
                onCreateOption(value);
                setShowSuggestions(false);
              }}
            >
              Create {value}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchDropdown;
