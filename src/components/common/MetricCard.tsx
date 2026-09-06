import React from 'react';

type MetricCardProps = {
  title: string;
  value: number | string;
  icon?: React.ReactNode;
  className?: string;
  description?: string;
};

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon,
  className = '',
  description,
}) => {
  return (
    <div
      className={`rounded-2xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03] ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {title}
          </p>
          <p className="mt-2 text-3xl font-semibold text-gray-800 dark:text-white/90">
            {value}
          </p>
          {description && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {description}
            </p>
          )}
        </div>
        {icon && (
          <div className="ml-4 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-900/20">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricCard;

