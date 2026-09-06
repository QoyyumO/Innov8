import React, { ReactNode } from 'react';

interface ButtonProps {
  children: ReactNode; // Button text or content
  size?: 'sm' | 'md' | 'full'; // Button size, 'full' expands to fill container
  variant?: 'primary' | 'outline' | 'text-only' | 'danger' | 'warning'; // Button variant
  startIcon?: ReactNode; // Icon before the text
  endIcon?: ReactNode; // Icon after the text
  onClick?: (e?: React.MouseEvent<HTMLButtonElement>) => void; // Click handler
  disabled?: boolean; // Disabled state
  className?: string; // Custom className
  type?: 'button' | 'submit' | 'reset';
}

const Button: React.FC<ButtonProps> = ({
  children,
  size = 'md',
  variant = 'primary',
  startIcon,
  endIcon,
  onClick,
  className = '',
  disabled = false,
  ...rest
}) => {
  // Size Classes
  const sizeClasses = {
    sm: 'px-4 py-3 text-sm',
    md: 'px-5 py-3.5 text-sm',
    full: 'w-full px-5 py-3.5 text-sm', // full width, padding same as md
  };

  // Variant Classes
  const variantClasses = {
    primary:
      'bg-brand-500 text-white shadow-theme-xs hover:bg-brand-600 hover:shadow-md hover:scale-[1.02] focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:bg-brand-300 disabled:hover:scale-100 disabled:hover:shadow-theme-xs',
    outline:
      'bg-white text-gray-500 border-2 border-gray-300 hover:border-brand-500 hover:text-brand-500 hover:bg-brand-50 hover:shadow-sm hover:scale-[1.02] focus:border-brand-600 focus:text-brand-600 focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 border-solid ring-0 shadow-none transition-all duration-150 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 dark:hover:border-brand-500 dark:hover:text-brand-500 dark:hover:bg-brand-900/20 disabled:hover:scale-100 disabled:hover:shadow-none',
    'text-only':
      'bg-transparent text-gray-400 hover:bg-brand-50 hover:text-brand-500 hover:scale-[1.02] focus:bg-brand-100 focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:text-brand-300 disabled:hover:scale-100 ring-0 border-0 shadow-none transition-all duration-150', // text-only style
    danger:
      'bg-red-500 text-white shadow-theme-xs hover:bg-red-600 hover:shadow-md hover:scale-[1.02] focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:bg-red-300 disabled:hover:scale-100 disabled:hover:shadow-theme-xs',
    warning:
      'bg-yellow-500 text-white shadow-theme-xs hover:bg-yellow-600 hover:shadow-md hover:scale-[1.02] focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:bg-yellow-300 disabled:hover:scale-100 disabled:hover:shadow-theme-xs',
  };

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 ease-in-out ${className} ${
        sizeClasses[size]
      } ${variantClasses[variant]} ${
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
      } rounded-[65px]`}
      onClick={onClick}
      disabled={disabled}
      {...rest}
    >
      {startIcon && <span className="flex items-center">{startIcon}</span>}
      {children}
      {endIcon && <span className="flex items-center">{endIcon}</span>}
    </button>
  );
};

export default Button;
