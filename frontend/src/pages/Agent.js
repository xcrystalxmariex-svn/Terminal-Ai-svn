import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Trash2, Play, Bot, User, Loader2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { API_ENDPOINTS } from '../config';
import { Button } from '../components/ui/button';
import { useToast } from '../hooks/use-toast';

export default function AgentPage() {
  const { theme } = useTheme();
  const { toast } = useToast();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const messagesEndRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const fetchHistory = async () => {
    try {
      const res = await fetch(API_ENDPOINTS.chatHistory);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (e) {
      console.error('Failed to fetch history:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(API_ENDPOINTS.chat, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to get response');
      }
      const data = await res.json();
      setMessages((prev) => [...prev, data]);
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: `Error: ${e.message}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const executeCommand = async (command) => {
    try {
      await fetch(API_ENDPOINTS.terminalExecute, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });
      toast({ title: 'Executed', description: 'Command sent to terminal' });
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const clearHistory = async () => {
    try {
      await fetch(API_ENDPOINTS.chatHistory, { method: 'DELETE' });
      setMessages([]);
      toast({ title: 'Cleared', description: 'Chat history cleared' });
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const parseContent = (content) => {
    const parts = [];
    const regex = /```(?:bash|shell|sh)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: content.slice(lastIndex, match.index) });
      }
      parts.push({ type: 'code', content: match[1].trim() });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < content.length) {
      parts.push({ type: 'text', content: content.slice(lastIndex) });
    }
    return parts;
  };

  const renderCodeBlock = (code, index) => (
    <div
      key={index}
      style={{
        borderRadius: '8px',
        border: `1px solid ${theme.border}`,
        marginTop: '8px',
        marginBottom: '8px',
        overflow: 'hidden',
        background: theme.secondary,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '4px 10px',
          background: theme.border,
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 600, color: theme.textDim }}>bash</span>
        <button
          data-testid={`run-command-${index}`}
          onClick={() => executeCommand(code)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 8px',
            borderRadius: '4px',
            border: 'none',
            background: theme.primary,
            color: theme.background,
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 700,
          }}
        >
          <Play size={12} /> Run
        </button>
      </div>
      <pre
        style={{
          padding: '10px',
          margin: 0,
          fontSize: '13px',
          lineHeight: '18px',
          overflow: 'auto',
          color: theme.foreground,
        }}
      >
        {code}
      </pre>
    </div>
  );

  const renderMessage = (msg) => {
    const isUser = msg.role === 'user';
    const parts = isUser ? [{ type: 'text', content: msg.content }] : parseContent(msg.content);

    return (
      <div
        key={msg.id}
        data-testid={`message-${msg.id}`}
        style={{
          padding: '12px',
          marginBottom: '10px',
          borderRadius: '12px',
          border: `1px solid ${theme.border}`,
          background: isUser ? theme.secondary : theme.background,
          marginLeft: isUser ? '24px' : '0',
          marginRight: isUser ? '0' : '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          {isUser ? <User size={14} /> : <Bot size={14} style={{ color: theme.primary }} />}
          <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {isUser ? 'You' : 'Agent'}
          </span>
        </div>
        {parts.map((part, i) =>
          part.type === 'code' ? (
            renderCodeBlock(part.content, i)
          ) : (
            <p key={i} style={{ fontSize: '14px', lineHeight: '20px', whiteSpace: 'pre-wrap', margin: 0 }}>
              {part.content.trim()}
            </p>
          )
        )}
        {msg.executed_commands && msg.executed_commands.length > 0 && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '4px',
              background: theme.primary + '33',
              marginTop: '6px',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            <Play size={12} style={{ color: theme.primary }} />
            <span>Auto-executed {msg.executed_commands.length} command(s)</span>
          </div>
        )}
        {msg.grounding_results && msg.grounding_results.length > 0 && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: theme.textDim }}>
            <strong>Grounding Results:</strong>
            {msg.grounding_results.map((r, i) => (
              <div key={i} style={{ marginTop: '4px', padding: '4px 8px', background: theme.secondary, borderRadius: '4px' }}>
                <code>{r.command}</code> → Exit: {r.exit_code}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      data-testid="agent-page"
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
        }}
      >
        <span style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '0.5px' }}>AI Agent</span>
        <button
          data-testid="clear-history-btn"
          onClick={clearHistory}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 12px',
            borderRadius: '6px',
            border: `1px solid ${theme.border}`,
            background: 'transparent',
            color: theme.textDim,
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          <Trash2 size={14} /> Clear
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        {loadingHistory ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: theme.primary }} />
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: theme.textDim }}>
            <Bot size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
            <p>Ask your AI agent to help with coding,<br />debugging, or terminal operations</p>
          </div>
        ) : (
          messages.map(renderMessage)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator */}
      {loading && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            color: theme.textDim,
          }}
        >
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: '13px' }}>Agent is thinking...</span>
        </div>
      )}

      {/* Input */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '8px',
          padding: '10px',
          borderTop: `1px solid ${theme.border}`,
        }}
      >
        <textarea
          data-testid="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Type a message..."
          rows={1}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '10px',
            border: `1px solid ${theme.border}`,
            background: theme.secondary,
            color: theme.foreground,
            fontSize: '14px',
            resize: 'none',
            maxHeight: '100px',
            fontFamily: 'inherit',
          }}
        />
        <button
          data-testid="send-message-btn"
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: 'none',
            background: theme.primary,
            color: theme.background,
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !input.trim() ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Send size={18} />
        </button>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
