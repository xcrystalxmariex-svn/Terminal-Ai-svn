import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Terminal, Bot, FolderOpen, Settings } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const navItems = [
  { path: '/terminal', icon: Terminal, label: 'Terminal' },
  { path: '/agent', icon: Bot, label: 'Agent' },
  { path: '/files', icon: FolderOpen, label: 'Files' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout() {
  const { theme } = useTheme();

  return (
    <div
      data-testid="app-layout"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: theme.background,
        color: theme.foreground,
      }}
    >
      {/* Main Content */}
      <main style={{ flex: 1, overflow: 'hidden' }}>
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav
        style={{
          display: 'flex',
          borderTop: `1px solid ${theme.border}`,
          background: theme.secondary,
          padding: '8px 0',
        }}
      >
        {navItems.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            data-testid={`nav-${label.toLowerCase()}`}
            style={({ isActive }) => ({
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              padding: '8px',
              textDecoration: 'none',
              color: isActive ? theme.primary : theme.textDim,
              transition: 'color 0.2s',
            })}
          >
            <Icon size={20} />
            <span style={{ fontSize: '11px', fontWeight: 600 }}>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
