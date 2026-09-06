import Link from 'next/link';
import React from 'react';

interface CardProps {
  title: string;
  description: string;
  url?: string;
}

const Card: React.FC<CardProps> = ({ title, description, url }) => {
  const cardContent = (
    <div className="hover:shadow-theme-xs rounded-2xl border border-gray-200 bg-white p-5 transition-shadow md:p-6 dark:border-gray-800 dark:bg-white/[0.03]">
      <h4 className="text-xl font-semibold text-gray-600 dark:text-white/90">
        {title}
      </h4>
      <p className="text-theme-sm mt-2 text-gray-500 dark:text-gray-400">
        {description}
      </p>
    </div>
  );
  return url ? (
    <Link href={url} className="block">
      {cardContent}
    </Link>
  ) : (
    cardContent
  );
};

export default Card;
