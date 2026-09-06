import Link from 'next/link';
import React from 'react';

interface BreadcrumbItem {
  name: string;
  href?: string;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  pageTitle?: string;
}

const PageBreadcrumb: React.FC<BreadcrumbProps> = ({ items, pageTitle }) => {
  // Backward compatibility: if items is not provided, use old UI
  if (!items) {
    return (
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2
          className="text-xl font-semibold text-gray-800 dark:text-white/90"
          x-text="pageName"
        >
          {pageTitle}
        </h2>
        <nav>
          <ol className="flex items-center gap-1.5">
            <li>
              <Link
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400"
                href="/"
              >
                Home
                <svg
                  className="stroke-current"
                  width="17"
                  height="16"
                  viewBox="0 0 17 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M6.0765 12.667L10.2432 8.50033L6.0765 4.33366"
                    stroke=""
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            </li>
            <li className="text-sm text-gray-800 dark:text-white/90">
              {pageTitle}
            </li>
          </ol>
        </nav>
      </div>
    );
  }

  // New UI for breadcrumb array
  // Prepend Home if not already present
  let breadcrumbItems = items;
  if (!items[0] || items[0].name !== 'Home') {
    breadcrumbItems = [{ name: 'Home', href: '/' }, ...items];
  }
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h2
        className="text-xl font-semibold text-gray-800 capitalize dark:text-white/90"
        x-text="pageName"
      >
        {breadcrumbItems[breadcrumbItems.length - 1].name}
      </h2>
      <nav>
        <ol className="flex items-center gap-1.5">
          {breadcrumbItems.map((item, idx) => (
            <li key={`${item.name}-${idx}`} className="flex items-center">
              {item.href && idx !== breadcrumbItems.length - 1 ? (
                <Link
                  className="inline-flex items-center gap-1.5 text-sm text-gray-500 capitalize dark:text-gray-400"
                  href={item.href}
                >
                  {item.name}
                  <svg
                    className="mx-1 stroke-current"
                    width="17"
                    height="16"
                    viewBox="0 0 17 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M6.0765 12.667L10.2432 8.50033L6.0765 4.33366"
                      stroke=""
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
              ) : (
                <span className="ml-1 text-sm text-gray-800 capitalize dark:text-white/90">
                  {item.name}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
};

export default PageBreadcrumb;
