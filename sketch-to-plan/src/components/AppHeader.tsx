import React from 'react';
import { Sun, Moon } from 'lucide-react';

export interface AppHeaderProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ theme, onToggleTheme }) => {
  return (
    <header className="h-[3.375rem] shrink-0 flex justify-between items-center px-4 border-b border-black/10 dark:border-white/10 bg-white/90 dark:bg-black/90 backdrop-blur-sm transition-colors duration-300">
      <div className="flex items-center gap-3">
        <span className="text-[1.575rem] font-display font-bold tracking-[0.0125em] uppercase leading-tight pt-1">CAI</span>
        <span className="text-[1.575rem] font-display font-bold tracking-[0.0125em] uppercase leading-tight pt-1">CANVAS</span>
      </div>
      <div className="flex items-center gap-6 font-mono text-xs leading-normal tracking-wide uppercase">
        <button onClick={onToggleTheme} className="hover:opacity-60 transition-opacity">
          {theme === 'light' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
    </header>
  );
};

export default AppHeader;
