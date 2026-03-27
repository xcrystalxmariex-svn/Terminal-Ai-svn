import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Trash2, Play, Bot, User, Loader2, Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { API_ENDPOINTS, BACKEND_URL } from '../config';
import { useToast } from '../hooks/use-toast';

export default function AgentPage() {
  const { theme } = useTheme();
  const { toast } = useToast();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const messagesEndRef = useRef(null);
  
  // Voice chat state
  const [isListening, setIsListening] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceId, setVoiceId] = useState('en-US-AriaNeural');
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [transcript, setTranscript] = useState('');
  
  // Refs for speech recognition
  const recognitionRef = useRef(null);
  const audioRef = useRef(null);
  const silenceTimeoutRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    fetchHistory();
    loadVoiceConfig();
    initSpeechRecognition();
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const loadVoiceConfig = async () => {
    try {
      const res = await fetch(API_ENDPOINTS.config);
      if (res.ok) {
        const data = await res.json();
        setVoiceEnabled(data.voice_enabled || false);
        setVoiceId(data.voice_id || 'en-US-AriaNeural');
        setAutoSpeak(data.voice_auto_speak !== false);
      }
    } catch (e) {
      console.error('Failed to load voice config:', e);
    }
  };

  const initSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.log('Speech recognition not supported');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        setTranscript(prev => prev + finalTranscript);
        // Reset silence timeout
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
        }
        // Auto-send after 2 seconds of silence in live mode
        if (isLiveMode) {
          silenceTimeoutRef.current = setTimeout(() => {
            const fullTranscript = transcript + finalTranscript;
            if (fullTranscript.trim()) {
              sendVoiceMessage(fullTranscript.trim());
              setTranscript('');
            }
          }, 2000);
        }
      }

      if (interimTranscript) {
        setInput(transcript + interimTranscript);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'no-speech') {
        toast({ title: 'Voice Error', description: event.error, variant: 'destructive' });
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      if (isLiveMode && isListening) {
        // Restart recognition in live mode
        try {
          recognition.start();
        } catch (e) {
          console.log('Recognition restart failed:', e);
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
  };

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

  const speakText = async (text) => {
    if (!autoSpeak || isSpeaking) return;
    
    // Strip code blocks and clean text for speech
    const cleanText = text
      .replace(/```[\s\S]*?```/g, 'Code block omitted.')
      .replace(/`[^`]+`/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\n+/g, '. ')
      .slice(0, 1000); // Limit length
    
    if (!cleanText.trim()) return;

    setIsSpeaking(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/tts/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText, voice: voiceId }),
      });
      
      if (res.ok) {
        const data = await res.json();
        const audio = new Audio(`data:audio/mpeg;base64,${data.audio}`);
        audioRef.current = audio;
        
        audio.onended = () => {
          setIsSpeaking(false);
          // Resume listening in live mode after speaking
          if (isLiveMode && recognitionRef.current) {
            try {
              recognitionRef.current.start();
              setIsListening(true);
            } catch (e) {
              console.log('Could not restart recognition:', e);
            }
          }
        };
        
        audio.onerror = () => {
          setIsSpeaking(false);
        };
        
        // Pause listening while speaking
        if (recognitionRef.current && isListening) {
          recognitionRef.current.stop();
        }
        
        await audio.play();
      }
    } catch (e) {
      console.error('TTS error:', e);
      setIsSpeaking(false);
    }
  };

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsSpeaking(false);
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast({ title: 'Not Supported', description: 'Speech recognition is not available in this browser', variant: 'destructive' });
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      // Send accumulated transcript
      if (transcript.trim()) {
        setInput(transcript);
        setTranscript('');
      }
    } else {
      setTranscript('');
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error('Failed to start recognition:', e);
      }
    }
  };

  const toggleLiveMode = () => {
    if (isLiveMode) {
      // Exit live mode
      setIsLiveMode(false);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      stopSpeaking();
      setTranscript('');
    } else {
      // Enter live mode
      setIsLiveMode(true);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsListening(true);
          toast({ title: 'Live Chat Active', description: 'Speak naturally - I\'m listening!' });
        } catch (e) {
          console.error('Failed to start live mode:', e);
        }
      }
    }
  };

  const sendVoiceMessage = async (text) => {
    if (!text.trim() || loading) return;
    await sendMessageInternal(text);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    await sendMessageInternal(text);
  };

  const sendMessageInternal = async (text) => {
    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setTranscript('');
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
      
      // Speak response in live mode or if voice is enabled
      if ((isLiveMode || voiceEnabled) && autoSpeak) {
        speakText(data.content);
      }
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
          {!isUser && (
            <button
              onClick={() => speakText(msg.content)}
              style={{
                marginLeft: 'auto',
                padding: '4px',
                border: 'none',
                background: 'transparent',
                color: theme.textDim,
                cursor: 'pointer',
              }}
              title="Speak this message"
            >
              <Volume2 size={14} />
            </button>
          )}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '0.5px' }}>AI Agent</span>
          {isLiveMode && (
            <span style={{
              padding: '2px 8px',
              borderRadius: '10px',
              background: theme.error,
              color: '#fff',
              fontSize: '10px',
              fontWeight: 700,
              animation: 'pulse 2s infinite',
            }}>
              LIVE
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {isSpeaking && (
            <button
              data-testid="stop-speaking-btn"
              onClick={stopSpeaking}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: theme.warning,
                color: theme.background,
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              <VolumeX size={14} /> Stop
            </button>
          )}
          <button
            data-testid="live-mode-btn"
            onClick={toggleLiveMode}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 12px',
              borderRadius: '6px',
              border: `1px solid ${isLiveMode ? theme.error : theme.border}`,
              background: isLiveMode ? theme.error + '22' : 'transparent',
              color: isLiveMode ? theme.error : theme.textDim,
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            {isLiveMode ? <PhoneOff size={14} /> : <Phone size={14} />}
            {isLiveMode ? 'End Call' : 'Live Chat'}
          </button>
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
      </div>

      {/* Live Mode Banner */}
      {isLiveMode && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '12px',
            background: `linear-gradient(90deg, ${theme.error}22, ${theme.primary}22)`,
            borderBottom: `1px solid ${theme.border}`,
          }}
        >
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: isListening ? theme.error : theme.textDim,
              animation: isListening ? 'pulse 1s infinite' : 'none',
            }}
          />
          <span style={{ fontSize: '14px', fontWeight: 600 }}>
            {isSpeaking ? '🔊 Speaking...' : isListening ? '🎤 Listening...' : '⏸️ Paused'}
          </span>
          {transcript && (
            <span style={{ fontSize: '13px', color: theme.textDim, fontStyle: 'italic' }}>
              "{transcript}"
            </span>
          )}
        </div>
      )}

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
            <p style={{ marginTop: '16px', fontSize: '13px' }}>
              💡 Tip: Click <strong>Live Chat</strong> for hands-free voice conversation!
            </p>
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
        <button
          data-testid="voice-input-btn"
          onClick={toggleListening}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: `2px solid ${isListening ? theme.error : theme.border}`,
            background: isListening ? theme.error + '22' : 'transparent',
            color: isListening ? theme.error : theme.textDim,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          title={isListening ? 'Stop listening' : 'Start voice input'}
        >
          {isListening ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
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
          placeholder={isListening ? 'Listening...' : 'Type a message...'}
          rows={1}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '10px',
            border: `1px solid ${isListening ? theme.primary : theme.border}`,
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
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
