"use client";

import React, { useState } from "react";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";

type UserDropdownProps = {
  name?: string;
  email?: string;
  onSignOut?: () => void;
};

export default function UserDropdown({
  name = "Dr. Ibrahim",
  email = "ibrahim@fmc.abuja.ng",
  onSignOut,
}: UserDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const userInitial = (name[0] || "U").toUpperCase();

  function toggleDropdown(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  const handleSignOut = () => {
    closeDropdown();
    onSignOut?.();
  };

  return (
    <div className="relative">
      <button
        onClick={toggleDropdown}
        className="dropdown-toggle flex items-center text-gray-700 dark:text-gray-400"
      >
        <div className="bg-brand-500 mr-3 flex h-11 w-11 items-center justify-center rounded-full">
          <span className="text-sm font-medium text-white">{userInitial}</span>
        </div>

        <span className="text-theme-sm mr-1 block font-medium">{name}</span>

        <svg
          className={`stroke-gray-500 transition-transform duration-200 dark:stroke-gray-400 ${
            isOpen ? "rotate-180" : ""
          }`}
          width="18"
          height="20"
          viewBox="0 0 18 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4.3125 8.65625L9 13.3437L13.6875 8.65625"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="shadow-theme-lg dark:bg-gray-dark absolute right-0 mt-[17px] flex w-[260px] flex-col rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800"
      >
        <div>
          <span className="text-theme-sm block font-medium text-gray-700 dark:text-gray-400">
            {name}
          </span>
          <span className="text-theme-xs mt-0.5 block text-gray-500 dark:text-gray-400">
            {email}
          </span>
        </div>

        <ul className="flex flex-col gap-1 pt-4 pb-3">
          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              tag="a"
              href="/account"
              className="group text-theme-sm flex items-center gap-3 rounded-lg px-3 py-2 font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              Account settings
            </DropdownItem>
          </li>
          <li className="border-t border-gray-200 dark:border-gray-800">
            <DropdownItem
              onItemClick={handleSignOut}
              className="group text-theme-sm mt-3 flex items-center gap-3 rounded-lg px-3 py-2 font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              Sign out
            </DropdownItem>
          </li>
        </ul>
      </Dropdown>
    </div>
  );
}
