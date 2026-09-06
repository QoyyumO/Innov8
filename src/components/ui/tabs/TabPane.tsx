import React from 'react';

interface TabPaneProps {
  tab: string;
  children: React.ReactNode;
}

export default function TabPane({ children }: TabPaneProps) {
  return <>{children}</>;
}
