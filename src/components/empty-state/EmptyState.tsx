import React from 'react';
import { BoltIcon } from '@/icons';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  status?: 'default' | 'error';
}

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  status = 'default',
}) => {
  const color = status === 'error' ? 'error' : 'brand';

  // Default empty state icon using BoltIcon from your icons
  const defaultIcon = <BoltIcon className={`text-${color}-500 h-12 w-12`} />;

  return (
    <div className="flex w-full flex-col items-center justify-center px-4 py-12">
      <div className="flex max-w-md flex-col items-center space-y-4 text-center">
        {/* Icon */}
        <div className="flex items-center justify-center">
          {icon || defaultIcon}
        </div>

        {/* Title */}
        <h2
          className={`text-${color}-500 dark:text-${color}-400 text-2xl font-semibold`}
        >
          {title}
        </h2>

        {/* Description */}
        <p className="text-base leading-relaxed text-gray-500 dark:text-gray-400">
          {description}
        </p>
      </div>
    </div>
  );
};

export default EmptyState;
