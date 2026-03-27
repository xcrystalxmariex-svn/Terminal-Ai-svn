import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { useTheme } from '../contexts/ThemeContext';
import { WS_URL } from '../config';

export default function TerminalPage() {
  const { theme } = useTheme();
  const terminalRef = useRef(null);
  const termRef = useRef(null);
  const wsRef = useRef(null);
  const fitAddonRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const maxReconnectAttempts = 10;
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const getReconnectDelay = useCallback(() => {
    const baseDelay = 1000;
    const maxDelay = 30000;
    const delay = Math.min(baseDelay * Math.pow(2, reconnectAttemptsRef.current), maxDelay);
    return delay + Math.random() * 1000;
  }, []);

  const connect = useCallback(() => {
    if (!termRef.current) return;
    if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
      return;
    }

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        reconnectAttemptsRef.current = 0;
        setConnected(true);
        setReconnecting(false);
        if (termRef.current) {
          termRef.current.write('\r\n\x1b[32m[Connected]\x1b[0m\r\n');
        }
      };

      ws.onmessage = (e) => {
        if (termRef.current) {
          termRef.current.write(e.data);
        }
      };

      ws.onclose = (e) => {
        console.log('WebSocket closed:', e.code);
        setConnected(false);
        
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = getReconnectDelay();
          setReconnecting(true);
          if (termRef.current) {
            termRef.current.write(`\r\n\x1b[33m[Reconnecting in ${Math.round(delay / 1000)}s...]\x1b[0m\r\n`);
          }
          reconnectAttemptsRef.current++;
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        } else {
          setReconnecting(false);
          if (termRef.current) {
            termRef.current.write('\r\n\x1b[31m[Connection failed. Refresh to retry.]\x1b[0m\r\n');
          }
        }
      };

      ws.onerror = (e) => {
        console.error('WebSocket error:', e);
      };
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
    }
  }, [getReconnectDelay]);

  useEffect(() => {
    // Wait for DOM element to be available
    if (!terminalRef.current) return;
    
    // Prevent double initialization
    if (termRef.current) return;

    // Small delay to ensure container has dimensions
    const initTimeout = setTimeout(() => {
      if (!terminalRef.current) return;
      
      const container = terminalRef.current;
      const rect = container.getBoundingClientRect();
      
      // Make sure container has dimensions
      if (rect.width === 0 || rect.height === 0) {
        console.log('Container has no dimensions, retrying...');
        return;
      }

      try {
        const term = new Terminal({
          cursorBlink: true,
          cursorStyle: 'block',
          fontSize: 14,
          fontFamily: "'Fira Code', 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace",
          theme: theme.terminal,
          scrollback: 5000,
          allowProposedApi: true,
          cols: 80,
          rows: 24,
        });

        const fitAddon = new FitAddon();
        const webLinksAddon = new WebLinksAddon();

        term.loadAddon(fitAddon);
        term.loadAddon(webLinksAddon);
        term.open(container);
        
        // Fit after a small delay to ensure dimensions are calculated
        setTimeout(() => {
          try {
            fitAddon.fit();
          } catch (e) {
            console.warn('Fit error:', e);
          }
        }, 100);

        termRef.current = term;
        fitAddonRef.current = fitAddon;
        setInitialized(true);

        term.onData((data) => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'input', data }));
          }
        });

        // Connect WebSocket after terminal is ready
        connect();
      } catch (err) {
        console.error('Failed to initialize terminal:', err);
      }
    }, 200);

    return () => {
      clearTimeout(initTimeout);
    };
  }, [theme.terminal, connect]);

  // Handle resize
  useEffect(() => {
    if (!initialized) return;

    const handleResize = () => {
      if (fitAddonRef.current && termRef.current) {
        try {
          fitAddonRef.current.fit();
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ 
              type: 'resize', 
              rows: termRef.current.rows, 
              cols: termRef.current.cols 
            }));
          }
        } catch (e) {
          console.warn('Resize error:', e);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    
    // Initial fit
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [initialized]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (termRef.current) {
        termRef.current.dispose();
        termRef.current = null;
      }
    };
  }, []);

  // Update terminal theme when it changes
  useEffect(() => {
    if (termRef.current && theme.terminal) {
      termRef.current.options.theme = theme.terminal;
    }
  }, [theme.terminal]);

  return (
    <div
      data-testid="terminal-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: theme.background,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: `1px solid ${theme.border}`,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '0.5px' }}>Terminal</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: connected ? theme.success : reconnecting ? theme.warning : theme.error,
            }}
          />
          <span style={{ fontSize: '12px', color: theme.textDim }}>
            {connected ? 'Connected' : reconnecting ? 'Reconnecting...' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Terminal */}
      <div
        ref={terminalRef}
        data-testid="terminal-container"
        style={{ 
          flex: 1, 
          overflow: 'hidden',
          minHeight: '200px',
        }}
      />
    </div>
  );
}
