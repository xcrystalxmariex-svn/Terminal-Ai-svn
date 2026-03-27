import React, { createContext, useContext, useState, useEffect } from 'react';

const themes = {
  cyberpunk_void: {
    name: 'cyberpunk_void',
    displayName: 'Cyberpunk Void',
    background: '#050505',
    foreground: '#e0e0e0',
    primary: '#00FF9C',
    secondary: '#1a1a1a',
    border: '#2a2a2a',
    textDim: '#808080',
    success: '#00FF9C',
    error: '#FF0055',
    warning: '#FFD60A',
    terminal: {
      background: '#050505',
      foreground: '#00FF9C',
      cursor: '#00FF9C',
      cursorAccent: '#050505',
      selectionBackground: 'rgba(0,255,156,0.3)',
      black: '#050505',
      red: '#FF0055',
      green: '#00FF9C',
      yellow: '#FFD60A',
      blue: '#64D2FF',
      magenta: '#FF79C6',
      cyan: '#00FFFF',
      white: '#E0E0E0',
      brightBlack: '#808080',
      brightRed: '#FF4488',
      brightGreen: '#33FFAA',
      brightYellow: '#FFE033',
      brightBlue: '#88DDFF',
      brightMagenta: '#FF99DD',
      brightCyan: '#33FFFF',
      brightWhite: '#FFFFFF',
    },
  },
  monokai_pro: {
    name: 'monokai_pro',
    displayName: 'Monokai Pro',
    background: '#2D2A2E',
    foreground: '#FCFCFA',
    primary: '#FFD866',
    secondary: '#403E41',
    border: '#5B595C',
    textDim: '#727072',
    success: '#A9DC76',
    error: '#FF6188',
    warning: '#FFD866',
    terminal: {
      background: '#2D2A2E',
      foreground: '#FCFCFA',
      cursor: '#FFD866',
      cursorAccent: '#2D2A2E',
      selectionBackground: 'rgba(255,216,102,0.3)',
      black: '#2D2A2E',
      red: '#FF6188',
      green: '#A9DC76',
      yellow: '#FFD866',
      blue: '#78DCE8',
      magenta: '#AB9DF2',
      cyan: '#78DCE8',
      white: '#FCFCFA',
      brightBlack: '#727072',
      brightRed: '#FF6188',
      brightGreen: '#A9DC76',
      brightYellow: '#FFD866',
      brightBlue: '#78DCE8',
      brightMagenta: '#AB9DF2',
      brightCyan: '#78DCE8',
      brightWhite: '#FFFFFF',
    },
  },
  dracula: {
    name: 'dracula',
    displayName: 'Dracula',
    background: '#282A36',
    foreground: '#F8F8F2',
    primary: '#BD93F9',
    secondary: '#44475A',
    border: '#6272A4',
    textDim: '#6272A4',
    success: '#50FA7B',
    error: '#FF5555',
    warning: '#F1FA8C',
    terminal: {
      background: '#282A36',
      foreground: '#F8F8F2',
      cursor: '#BD93F9',
      cursorAccent: '#282A36',
      selectionBackground: 'rgba(189,147,249,0.3)',
      black: '#21222C',
      red: '#FF5555',
      green: '#50FA7B',
      yellow: '#F1FA8C',
      blue: '#BD93F9',
      magenta: '#FF79C6',
      cyan: '#8BE9FD',
      white: '#F8F8F2',
      brightBlack: '#6272A4',
      brightRed: '#FF6E6E',
      brightGreen: '#69FF94',
      brightYellow: '#FFFFA5',
      brightBlue: '#D6ACFF',
      brightMagenta: '#FF92DF',
      brightCyan: '#A4FFFF',
      brightWhite: '#FFFFFF',
    },
  },
};

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [themeName, setThemeName] = useState(() => {
    return localStorage.getItem('termuxai-theme') || 'cyberpunk_void';
  });

  const theme = themes[themeName] || themes.cyberpunk_void;

  useEffect(() => {
    localStorage.setItem('termuxai-theme', themeName);
    // Apply CSS variables
    const root = document.documentElement;
    root.style.setProperty('--background', theme.background);
    root.style.setProperty('--foreground', theme.foreground);
    root.style.setProperty('--primary', theme.primary);
    root.style.setProperty('--secondary', theme.secondary);
    root.style.setProperty('--border', theme.border);
    root.style.setProperty('--text-dim', theme.textDim);
    document.body.style.background = theme.background;
  }, [themeName, theme]);

  return (
    <ThemeContext.Provider value={{ theme, themeName, setThemeName, themes }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export { themes };
