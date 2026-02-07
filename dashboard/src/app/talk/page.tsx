'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Mic, Square, ArrowRight, Mail } from 'lucide-react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface QuickReply {
  label: string;
  description?: string;
  value: string;
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

// Flow stages
type Stage = 'welcome' | 'business_type' | 'pain_point' | 'chat' | 'email_capture';

const BUSINESS_TYPES: QuickReply[] = [
  { label: 'Restaurant / Food', description: 'Restaurants, cafes, food trucks, catering', value: 'I run a restaurant / food business' },
  { label: 'E-commerce / Retail', description: 'Online stores, retail shops, product brands', value: 'I run an e-commerce / retail business' },
  { label: 'Coaching / Services', description: 'Consultants, coaches, freelancers, agencies', value: 'I run a coaching / services business' },
  { label: 'Home Services', description: 'Plumbing, HVAC, cleaning, landscaping', value: 'I run a home services business' },
  { label: 'Health & Wellness', description: 'Gyms, clinics, therapy, wellness brands', value: 'I run a health & wellness business' },
  { label: 'Something Else', description: 'Tell me what you do', value: '' },
];

const PAIN_POINTS: QuickReply[] = [
  { label: 'Following up with leads', description: 'People reach out and I lose them', value: "My biggest challenge is following up with leads — people reach out and I lose them because I can't respond fast enough" },
  { label: 'Social media & content', description: 'I never have time to post', value: "My biggest challenge is social media and content — I know I should be posting but I never have time" },
  { label: 'Answering customer questions', description: 'Same questions over and over', value: "My biggest challenge is answering customer questions — I get the same ones over and over and it eats my day" },
  { label: 'Admin & scheduling', description: 'Drowning in busywork', value: "My biggest challenge is admin and scheduling — I'm drowning in busywork instead of doing what I'm good at" },
  { label: 'All of the above', description: "I need help with everything", value: "Honestly, all of the above. I need help with lead follow-up, social media, customer questions, and admin. I'm wearing every hat." },
];

export default function TalkPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [stage, setStage] = useState<Stage>('welcome');
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim()) return;
    const userMessage: Message = { role: 'user', content: content.trim(), timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/public/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), visitorId: getVisitorId() })
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Something went wrong'); }
      const data = await res.json();
      const assistantMsg: Message = { role: 'assistant', content: data.response, timestamp: new Date() };
      setMessages((prev) => [...prev, assistantMsg]);

      // Check if Boss is asking for email or mentioning audit — hint to show email capture
      const lower = data.response.toLowerCase();
      if ((lower.includes('email') && lower.includes('send')) || lower.includes('drop your email') || lower.includes('what\'s your email')) {
        setTimeout(() => setStage('email_capture'), 500);
      }
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Oops — ${err.message}. Try again?`, timestamp: new Date() }]);
    } finally { setIsLoading(false); }
  };

  const handleSend = () => sendMessage(input);

  const handleQuickReply = (reply: QuickReply) => {
    if (reply.value) {
      sendMessage(reply.value);
      if (stage === 'business_type') setStage('pain_point');
      else if (stage === 'pain_point') setStage('chat');
    } else {
      // "Something Else" — just go to free chat
      setStage('chat');
    }
  };

  const handleStartChat = () => {
    setStage('business_type');
    setMessages([{
      role: 'assistant',
      content: "Hey — I'm Boss B. I'm an AI employee. Right now you're talking to me the same way your customers would talk to yours.\n\nWhat kind of business do you run?",
      timestamp: new Date()
    }]);
  };

  const handleEmailSubmit = async () => {
    if (!email.trim()) return;
    // Send email to Boss so he can log it and trigger proposal
    await sendMessage(`My email is ${email.trim()}`);
    setEmailSent(true);
    setStage('chat');
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

  // ─── Welcome Hero ───
  if (stage === 'welcome') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center px-4">
        <div className="max-w-lg w-full text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-blue-600 flex items-center justify-center">
            <Bot className="h-10 w-10 text-white" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white">Meet Boss B</h1>
            <p className="text-lg text-slate-300 mt-3 leading-relaxed">
              I'm an AI employee. Right now, you're about to talk to me the way
              <span className="text-blue-400 font-medium"> your customers </span>
              would talk to yours.
            </p>
          </div>
          <button
            onClick={handleStartChat}
            className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-500 transition-all hover:scale-105"
          >
            See What I Can Do <ArrowRight className="h-5 w-5" />
          </button>
          <p className="text-sm text-slate-500">No signup. No credit card. Just a conversation.</p>
        </div>
        <div className="absolute bottom-4 right-4">
          <Link href="/login" className="text-sm text-slate-500 hover:text-slate-400">Sign In</Link>
        </div>
      </div>
    );
  }

  // ─── Chat UI ───
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-700/50 px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
              <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-white">Boss B</h1>
              <p className="text-xs text-slate-400">Your AI Employee Demo</p>
            </div>
          </div>
          <Link href="/login" className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex-shrink-0">Sign In</Link>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-auto px-3 sm:px-6 py-4 sm:py-6">
        <div className="max-w-3xl mx-auto space-y-3 sm:space-y-4">
          {messages.map((message, i) => (
            <div key={i} className={`flex gap-2 sm:gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.role === 'assistant' && (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-400" />
                </div>
              )}
              <div className={`max-w-[85%] sm:max-w-[75%] px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl ${message.role === 'user' ? 'bg-blue-600 text-white rounded-br-md' : 'bg-slate-700/50 text-slate-200 rounded-bl-md'}`}>
                <p className="whitespace-pre-wrap text-sm sm:text-base break-words">{message.content}</p>
              </div>
              {message.role === 'user' && (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 mt-1">
                  <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-300" />
                </div>
              )}
            </div>
          ))}

          {/* Loading */}
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

          {/* Quick Reply Cards — Business Type */}
          {stage === 'business_type' && !isLoading && (
            <div className="pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 max-w-2xl">
                {BUSINESS_TYPES.map((bt) => (
                  <button
                    key={bt.label}
                    onClick={() => handleQuickReply(bt)}
                    className="text-left p-3 sm:p-4 bg-slate-800/80 border border-slate-700 rounded-xl hover:border-blue-500 hover:bg-slate-700/80 transition-all group"
                  >
                    <span className="font-medium text-white text-sm sm:text-base group-hover:text-blue-400 transition-colors">{bt.label}</span>
                    {bt.description && <p className="text-xs text-slate-400 mt-0.5">{bt.description}</p>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Reply Cards — Pain Points */}
          {stage === 'pain_point' && !isLoading && (
            <div className="pt-2">
              <p className="text-sm text-slate-400 mb-2">What's the biggest challenge you could use help with — the thing that takes your time that you don't like doing?</p>
              <div className="grid grid-cols-1 gap-2 sm:gap-3 max-w-2xl">
                {PAIN_POINTS.map((pp) => (
                  <button
                    key={pp.label}
                    onClick={() => handleQuickReply(pp)}
                    className="text-left p-3 sm:p-4 bg-slate-800/80 border border-slate-700 rounded-xl hover:border-blue-500 hover:bg-slate-700/80 transition-all group"
                  >
                    <span className="font-medium text-white text-sm sm:text-base group-hover:text-blue-400 transition-colors">{pp.label}</span>
                    {pp.description && <p className="text-xs text-slate-400 mt-0.5">{pp.description}</p>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Email Capture Card */}
          {stage === 'email_capture' && !emailSent && (
            <div className="pt-2 max-w-md">
              <div className="p-4 sm:p-5 bg-slate-800/80 border border-blue-500/30 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-blue-400">
                  <Mail className="h-5 w-5" />
                  <span className="font-medium text-sm">Get Your Custom Proposal</span>
                </div>
                <p className="text-xs text-slate-400">I'll send you a quick breakdown of exactly what your AI employee would handle, plus pricing.</p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleEmailSubmit()}
                    placeholder="your@email.com"
                    className="flex-1 px-3 py-2.5 bg-slate-900 border border-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-500 text-sm"
                  />
                  <button
                    onClick={handleEmailSubmit}
                    disabled={!email.trim()}
                    className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 text-sm font-medium"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Checkout CTA Card — shown after email sent */}
          {emailSent && (
            <div className="pt-2 max-w-md">
              <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-xl space-y-3">
                <p className="text-sm text-slate-200 font-medium">Proposal incoming — check your inbox shortly.</p>
                <p className="text-xs text-slate-400">Ready to get started right now?</p>
                <Link
                  href="/checkout/audit"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 text-sm font-medium transition-colors"
                >
                  Start with $500 Audit <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-slate-700/50 px-3 sm:px-6 py-3 sm:py-4">
        <div className="max-w-3xl mx-auto flex gap-1.5 sm:gap-2">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={isTranscribing ? 'Transcribing...' : stage === 'email_capture' ? 'Or type your email here...' : 'Type a message...'}
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
        <p className="max-w-3xl mx-auto text-xs text-slate-500 mt-2 text-center">
          Powered by <span className="text-blue-400">Starfish AI</span> — Custom AI employees for your business
        </p>
      </div>
    </div>
  );
}
