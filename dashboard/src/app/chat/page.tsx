'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAgents, sendMessage } from '@/hooks/useAgents';
import { Send, Bot, User, Mic, Square, Trash2, Paperclip, AlertTriangle } from 'lucide-react';
import { API_URL, apiFetch } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

function ChatPageContent() {
  const searchParams = useSearchParams();
  const initialAgentId = searchParams.get('agent');
  const { agents } = useAgents();

  const [selectedAgentId, setSelectedAgentId] = useState<string>(initialAgentId || '');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialAgentId) {
      setSelectedAgentId(initialAgentId);
    }
  }, [initialAgentId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load conversation history when agent selected
  useEffect(() => {
    if (!selectedAgentId) return;
    const loadHistory = async () => {
      try {
        const data = await apiFetch<{ messages: any[] }>(`/api/agents/${selectedAgentId}/messages`);
        if (data.messages && data.messages.length > 0) {
          setMessages(
            data.messages.map((m: any) => ({
              role: m.role,
              content: m.content,
              timestamp: new Date(m.timestamp || Date.now()),
            }))
          );
        }
      } catch {
        // No history or endpoint not available yet
      }
    };
    loadHistory();
  }, [selectedAgentId]);

  const handleSend = async () => {
    if (!input.trim() || !selectedAgentId) return;
    const userMessage: Message = { role: 'user', content: input.trim(), timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    try {
      const response = await sendMessage(selectedAgentId, userMessage.content);
      setMessages((prev) => [...prev, { role: 'assistant', content: response.response, timestamp: new Date() }]);
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err.message}`, timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = async () => {
    if (!selectedAgentId) return;
    try {
      await apiFetch(`/api/agents/${selectedAgentId}/messages`, { method: 'DELETE' });
      setMessages([]);
    } catch {
      // ignore
    }
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Mic access denied:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      const token = localStorage.getItem('starfish_token');
      const res = await fetch(`${API_URL}/api/transcribe`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) throw new Error('Transcription failed');
      const { text } = await res.json();
      if (text) setInput((prev) => (prev ? prev + ' ' + text : text));
    } catch (err: any) {
      console.error('Transcription error:', err);
    } finally {
      setIsTranscribing(false);
    }
  };

  // File upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedAgentId) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('starfish_token');
      const res = await fetch(`${API_URL}/api/agents/${selectedAgentId}/files`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: `📎 Uploaded: ${data.filename}`, timestamp: new Date() },
      ]);
    } catch (err: any) {
      console.error('Upload error:', err);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const selectedAgent = agents?.find((a: any) => a.id === selectedAgentId);

  // Estimate token usage from messages (~4 chars per token)
  const estimatedTokens = messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
  const TOKEN_LIMIT = 180000; // ~200K with system prompt overhead
  const tokenPercent = Math.round((estimatedTokens / TOKEN_LIMIT) * 100);
  const showTokenWarning = tokenPercent > 60;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold">Chat</h1>
          <p className="text-muted-foreground text-sm mt-1 hidden sm:block">Test your agents in real-time</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {selectedAgentId && messages.length > 0 && (
            <button
              onClick={clearHistory}
              className="p-2 text-muted-foreground hover:text-destructive transition-colors"
              title="Clear history"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
          <select
            value={selectedAgentId}
            onChange={(e) => {
              setSelectedAgentId(e.target.value);
              setMessages([]);
            }}
            className="px-3 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm w-full sm:w-auto"
          >
            <option value="">Select an agent...</option>
            {agents?.map((agent: any) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Token Warning */}
      {showTokenWarning && selectedAgentId && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs mt-2 ${
          tokenPercent > 85 ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
        }`}>
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>
            Context: ~{Math.round(estimatedTokens / 1000)}K / {Math.round(TOKEN_LIMIT / 1000)}K tokens ({tokenPercent}%).
            {tokenPercent > 85 ? ' Session nearing limit — older messages will be auto-compressed.' : ' Auto-compression will kick in soon.'}
          </span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-auto py-4 space-y-4 min-h-0">
        {!selectedAgentId ? (
          <div className="text-center py-12 text-muted-foreground">
            Select an agent to start chatting
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Start a conversation with {selectedAgent?.name || 'the agent'}</p>
          </div>
        ) : (
          messages.map((message, i) => (
            <div key={i} className={`flex gap-2 sm:gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.role === 'assistant' && (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[85%] sm:max-w-[70%] px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-muted rounded-bl-md'
                }`}
              >
                <p className="whitespace-pre-wrap text-sm sm:text-base break-words">{message.content}</p>
                <p
                  className={`text-xs mt-1 ${
                    message.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  }`}
                >
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
              {message.role === 'user' && (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex gap-2 sm:gap-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
            </div>
            <div className="bg-muted px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl rounded-bl-md">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="pt-3 sm:pt-4 border-t flex-shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2 w-full overflow-hidden">
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!selectedAgentId || isLoading}
            className="flex-none w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center bg-background border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
            title="Upload file"
          >
            <Paperclip className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={isTranscribing ? 'Transcribing...' : selectedAgentId ? 'Type a message...' : 'Select agent first'}
            disabled={!selectedAgentId || isLoading}
            className="flex-1 min-w-0 px-3 sm:px-4 h-10 sm:h-11 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 text-sm sm:text-base"
          />
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={!selectedAgentId || isLoading || isTranscribing}
            className={`flex-none w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${
              isRecording
                ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
                : 'bg-background border hover:bg-muted'
            }`}
            title={isRecording ? 'Stop recording' : 'Voice input'}
          >
            {isRecording ? <Square className="h-4 w-4 sm:h-5 sm:w-5" /> : <Mic className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />}
          </button>
          <button
            onClick={handleSend}
            disabled={!selectedAgentId || !input.trim() || isLoading}
            className="flex-none w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Send className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <ChatPageContent />
    </Suspense>
  );
}
