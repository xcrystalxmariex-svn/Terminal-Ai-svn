import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { Toaster } from './components/ui/toaster';
import Layout from './components/Layout';
import TerminalPage from './pages/Terminal';
import AgentPage from './pages/Agent';
import FilesPage from './pages/Files';
import SettingsPage from './pages/Settings';
import './App.css';

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/terminal" replace />} />
            <Route path="terminal" element={<TerminalPage />} />
            <Route path="agent" element={<AgentPage />} />
            <Route path="files" element={<FilesPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
        <Toaster />
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
