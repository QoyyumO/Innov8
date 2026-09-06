import React, { useState } from 'react';

interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  options: Option[];
  placeholder?: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  className?: string;
  defaultValue?: string;
  error?: boolean;
  success?: boolean;
  hint?: string;
  disabled?: boolean;
}

const Select: React.FC<SelectProps> = ({
  options,
  placeholder = 'Select an option',
  onChange,
  className = '',
  defaultValue = '',
  error = false,
  success = false,
  hint = '',
  disabled = false,
}) => {
  // Manage the selected value
  const [selectedValue, setSelectedValue] = useState<string>(defaultValue);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedValue(e.target.value);
    onChange(e);
  };

  let selectClasses = `h-11 w-full appearance-none rounded-lg border px-4 py-2.5 pr-11 text-sm shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 ${
    selectedValue
      ? 'text-gray-800 dark:text-white/90'
      : 'text-gray-400 dark:text-gray-400'
  } ${className}`;

  if (error) {
    selectClasses +=
      ' text-error-800 border-error-500 focus:ring-3 focus:ring-error-500/10  dark:text-error-400 dark:border-error-500';
  } else if (success) {
    selectClasses +=
      ' text-success-500 border-success-400 focus:ring-success-500/10 focus:border-success-300  dark:text-success-400 dark:border-success-500';
  } else {
    selectClasses +=
      ' bg-transparent text-gray-400 border-gray-300 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800';
  }
  return (
    <>
      <select
        className={selectClasses}
        onChange={handleChange}
        defaultValue={defaultValue}
        disabled={disabled}
      >
        {/* Placeholder option */}
        {!defaultValue && (
          <option
            value=""
            disabled
            className="text-gray-700 dark:bg-gray-900 dark:text-gray-400"
          >
            {placeholder}
          </option>
        )}
        {/* Map over options */}
        {options.map(option => (
          <option
            key={option.value}
            value={option.value}
            className="text-gray-700 dark:bg-gray-900 dark:text-gray-400"
          >
            {option.label}
          </option>
        ))}
      </select>

      {hint && (
        <p
          className={`mt-1.5 text-xs ${
            error
              ? 'text-error-500'
              : success
                ? 'text-success-500'
                : 'text-gray-500'
          }`}
        >
          {hint}
        </p>
      )}
    </>
  );
};

export default Select;
