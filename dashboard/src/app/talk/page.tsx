'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Mic, Square } from 'lucide-react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

function getVisitorId(): string {
  if (typeof window === 'undefined') return 'anon';
  let id = localStorage.getItem('starfish_visitor');
  if (!id) {
    id = 'v_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('starfish_visitor', id);
  }
  return id;
}

export default function TalkPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [agentName, setAgentName] = useState('Boss B');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch(`${API_URL}/api/public/agent`);
        const data = await res.json();
        if (data.available && data.name) setAgentName(data.name);
      } catch {}
      setMessages([{
        role: 'assistant',
        content: "Hey — I'm Boss B. I'm an AI employee, and right now you're talking to me like your customers would talk to yours. What kind of business do you run? I'll show you exactly what one of these can do for you.",
        timestamp: new Date()
      }]);
    };
    init();
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage: Message = { role: 'user', content: input.trim(), timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/public/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: userMessage.content, visitorId: getVisitorId() })
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Something went wrong'); }
      const data = await res.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: data.response, timestamp: new Date() }]);
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Oops — ${err.message}. Try again?`, timestamp: new Date() }]);
    } finally { setIsLoading(false); }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) { console.error('Mic access denied:', err); }
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
      const res = await fetch(`${API_URL}/api/transcribe`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Transcription failed');
      const { text } = await res.json();
      if (text) setInput((prev) => (prev ? prev + ' ' + text : text));
    } catch (err: any) { console.error('Transcription error:', err); }
    finally { setIsTranscribing(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      <header className="border-b border-slate-700/50 px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
              <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-white">{agentName}</h1>
              <p className="text-xs text-slate-400">Your AI Employee Demo</p>
            </div>
          </div>
          <Link href="/login" className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex-shrink-0">Sign In</Link>
        </div>
      </header>

      <div className="flex-1 overflow-auto px-3 sm:px-6 py-4 sm:py-6">
        <div className="max-w-3xl mx-auto space-y-3 sm:space-y-4">
          {messages.map((message, i) => (
            <div key={i} className={`flex gap-2 sm:gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.role === 'assistant' && (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-400" />
                </div>
              )}
              <div className={`max-w-[85%] sm:max-w-[75%] px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl ${message.role === 'user' ? 'bg-blue-600 text-white rounded-br-md' : 'bg-slate-700/50 text-slate-200 rounded-bl-md'}`}>
                <p className="whitespace-pre-wrap text-sm sm:text-base break-words">{message.content}</p>
              </div>
              {message.role === 'user' && (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                  <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-300" />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-2 sm:gap-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-600/20 flex items-center justify-center"><Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-400" /></div>
              <div className="bg-slate-700/50 px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl rounded-bl-md">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:100ms]" />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:200ms]" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t border-slate-700/50 px-3 sm:px-6 py-3 sm:py-4">
        <div className="max-w-3xl mx-auto flex gap-1.5 sm:gap-2">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={isTranscribing ? 'Transcribing...' : 'Tell me about your business...'}
            disabled={isLoading}
            className="flex-1 min-w-0 px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-800 border border-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-500 disabled:opacity-50 text-sm sm:text-base"
          />
          <button onClick={isRecording ? stopRecording : startRecording} disabled={isLoading || isTranscribing}
            className={`px-2.5 sm:px-4 py-2.5 sm:py-3 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0 ${isRecording ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            title={isRecording ? 'Stop recording' : 'Voice input'}>
            {isRecording ? <Square className="h-4 w-4 sm:h-5 sm:w-5" /> : <Mic className="h-4 w-4 sm:h-5 sm:w-5" />}
          </button>
          <button onClick={handleSend} disabled={!input.trim() || isLoading}
            className="px-3 sm:px-4 py-2.5 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 flex-shrink-0">
            <Send className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>
        <p className="max-w-3xl mx-auto text-xs text-slate-500 mt-2 text-center">Powered by Starfish AI — Custom AI employees for your business</p>
      </div>
    </div>
  );
}
