import { type ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
  title?: string;
}

export function Layout({ children, title }: LayoutProps) {
  return (
    <div className="app-shell">
      <div className="game-container">
        {title && <h1 className="page-title">{title}</h1>}
        {children}
      </div>
    </div>
  );
}
