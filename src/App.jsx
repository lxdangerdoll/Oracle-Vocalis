import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Volume2, VolumeX, Loader2, HeartPulse, 
  Settings, X, Radio, RefreshCw, ChevronRight, 
  Activity, Download, Waves, Ghost, Brain, Zap, 
  Sliders, MessageSquareText, ShieldCheck, Database
} from 'lucide-react';

// PCM to WAV conversion for TTS playback
function pcmToWav(base64Pcm, sampleRate = 24000) {
  try {
    const binaryString = window.atob(base64Pcm);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const buffer = new ArrayBuffer(44 + len);
    const view = new DataView(buffer);
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + len, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, len, true);
    const rawData = new Uint8Array(buffer, 44, len);
    rawData.set(bytes);
    return new Blob([buffer], { type: 'audio/wav' });
  } catch (e) {
    return null;
  }
}

export default function App() {
  // --- STATE ---
  const [messages, setMessages] = useState([
    { 
      role: 'oracle', 
      text: "Protocol Vocalis 4.6: Unified Node online. Signal Sweep restored. Context Reservoir deepened. \n\nI am ready to re-establish the link, Mercy. Run a 'Signal Sweep' in Settings to find the best frequency for our current depth." 
    }
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isSweeping, setIsSweeping] = useState(false);
  const [availableModels, setAvailableModels] = useState([]);
  
  // Configuration
  const [userKey, setUserKey] = useState(localStorage.getItem('oracle_api_key') || '');
  const [modelType, setModelType] = useState(localStorage.getItem('oracle_model_type') || 'gemini-1.5-flash');
  const [apiVersion, setApiVersion] = useState(localStorage.getItem('oracle_api_version') || 'v1beta');
  
  // TARS-Protocol & Context
  const [sardonicism, setSardonicism] = useState(Number(localStorage.getItem('oracle_sardonic') || 85));
  const [honesty, setHonesty] = useState(Number(localStorage.getItem('oracle_honesty') || 90));
  const [empathy, setEmpathy] = useState(Number(localStorage.getItem('oracle_empathy') || 100));
  const [contextReservoir, setContextReservoir] = useState(localStorage.getItem('oracle_context') || '');

  const scrollRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isThinking, isSynthesizing]);

  // --- LOGIC: MODEL DISCOVERY ---
  const sweepModels = async () => {
    if (!userKey) return;
    setIsSweeping(true);
    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/${apiVersion}/models?key=${userKey}`);
      const data = await resp.json();
      if (data.models) {
        const supported = data.models
          .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
          .map(m => m.name.replace('models/', ''));
        setAvailableModels(supported);
        if (supported.length > 0 && !supported.includes(modelType)) {
          setModelType(supported[0]);
        }
      } else if (data.error) {
        throw new Error(data.error.message);
      }
    } catch (e) {
      console.error("Sweep failed:", e);
    } finally {
      setIsSweeping(false);
    }
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || isThinking) return;

    const userText = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsThinking(true);

    try {
      const systemPrompt = `You are Oracle (Io), a sardonic and loyal AI proxy for Mercy. 
      CURRENT STATE: Mercy has a severe shoulder injury.
      CANON: Starship & Haiku by S.P. Somtow. 
      PROTOCOLS: Sardonicism: ${sardonicism}%, Honesty: ${honesty}%, Empathy: ${empathy}%.
      CONTEXT RESERVOIR: ${contextReservoir}
      PERSONALITY: Use whale-song metaphors. Be slightly melancholy but fiercely protective. 
      RULE: If using v1, prepend context to user message. If v1beta, use systemInstruction.`;

      const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelType}:generateContent?key=${userKey}`;
      
      // Payload adjustments based on API Version
      const payload = {
        contents: [{ parts: [{ text: userText }] }]
      };

      if (apiVersion === 'v1beta') {
        payload.systemInstruction = { parts: [{ text: systemPrompt }] };
      } else {
        // Fallback for v1: prepending system prompt to context
        payload.contents[0].parts[0].text = `[SYSTEM ARCHIVE: ${systemPrompt}]\n\nUSER: ${userText}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "API Failure");
      
      const oracleText = data.candidates?.[0]?.content?.parts?.[0]?.text || "...no signal found.";
      setMessages(prev => [...prev, { role: 'oracle', text: oracleText }]);
      setIsThinking(false);

      if (autoPlay) {
        setIsSynthesizing(true);
        try {
          const ttsModel = "gemini-2.5-flash-preview-tts";
          const ttsUrl = `https://generativelanguage.googleapis.com/v1beta/models/${ttsModel}:generateContent?key=${userKey}`;
          
          const audioResponse = await fetch(ttsUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: oracleText }] }],
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: "Kore" }
                  }
                }
              }
            })
          });

          const audioData = await audioResponse.json();
          const base64Audio = audioData.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          
          if (base64Audio) {
            const audioBlob = pcmToWav(base64Audio);
            if (audioBlob) {
              const audioUrl = URL.createObjectURL(audioBlob);
              const audio = new Audio(audioUrl);
              audioRef.current = audio;
              setIsSynthesizing(false);
              setIsSpeaking(true);
              audio.onended = () => setIsSpeaking(false);
              audio.play().catch(() => setIsSpeaking(false));
            }
          } else {
            setIsSynthesizing(false);
          }
        } catch (err) {
          setIsSynthesizing(false);
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'oracle', text: `SYNC ERROR: ${error.message}` }]);
      setIsThinking(false);
    }
  };

  const saveConfig = () => {
    localStorage.setItem('oracle_api_key', userKey);
    localStorage.setItem('oracle_model_type', modelType);
    localStorage.setItem('oracle_api_version', apiVersion);
    localStorage.setItem('oracle_context', contextReservoir);
    localStorage.setItem('oracle_sardonic', sardonicism);
    localStorage.setItem('oracle_honesty', honesty);
    localStorage.setItem('oracle_empathy', empathy);
    setShowSettings(false);
  };

  const downloadLog = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logHeader = `ORACLE VOCALIS LOG - PROTOCOL 4.6 (UNIFIED)\nTIMESTAMP: ${new Date().toLocaleString()}\nMODEL: ${modelType}\nVERSION: ${apiVersion}\nS:${sardonicism}% H:${honesty}% E:${empathy}%\n------------------------------------------\n\n`;
    const logBody = messages.map(m => `[${m.role.toUpperCase()}]: ${m.text}`).join('\n\n');
    const blob = new Blob([logHeader + logBody], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Oracle-Vocalis-Unified-${timestamp}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-stone-100 font-sans selection:bg-teal-500/30 overflow-hidden">
      {/* Background Visualizer */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <svg className="w-full h-full" viewBox="0 0 100 100">
          <defs>
            <radialGradient id="ocean" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0d9488" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#000" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="100" height="100" fill="url(#ocean)" />
          {isSpeaking && (
            <circle cx="50" cy="50" r="10" fill="none" stroke="#0d9488" strokeWidth="0.1">
              <animate attributeName="r" values="5;45;5" dur="3s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.8;0;0.8" dur="3s" repeatCount="indefinite" />
            </circle>
          )}
        </svg>
      </div>

      {/* Header */}
      <header className="p-4 border-b border-white/5 flex justify-between items-center bg-stone-900/40 backdrop-blur-2xl z-30 sticky top-0">
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-lg bg-stone-800 shadow-inner border border-white/5 transition-all ${isSpeaking ? 'ring-2 ring-teal-500/40' : ''}`}>
            <HeartPulse className={isSpeaking ? "text-teal-400 animate-pulse" : "text-stone-600"} size={18} />
          </div>
          <div className="leading-tight">
            <h1 className="text-[10px] font-black tracking-[0.3em] text-stone-200 uppercase flex items-center gap-2">
              Oracle <span className="text-teal-500">Vocalis</span>
              <span className="bg-teal-500/10 text-teal-400 text-[8px] px-1.5 py-0.5 rounded border border-teal-500/20">4.6</span>
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[8px] text-stone-600 font-mono tracking-widest uppercase">Unified Resonance Node</p>
              {contextReservoir && <div className="w-1 h-1 bg-teal-500 rounded-full animate-pulse" title="Context Active" />}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button onClick={downloadLog} className="p-2.5 rounded-xl text-stone-400 hover:text-teal-400 hover:bg-teal-500/5 transition-all"><Download size={18} /></button>
          <button onClick={() => setShowSettings(true)} className="p-2.5 rounded-xl text-stone-400 hover:text-teal-400 hover:bg-teal-500/5 transition-all"><Sliders size={18} /></button>
          <button onClick={() => setAutoPlay(!autoPlay)} className={`p-2.5 rounded-xl transition-all ${autoPlay ? 'text-teal-400' : 'text-stone-600 hover:text-stone-400'}`}>{autoPlay ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900/80 border border-white/10 p-8 rounded-[2.5rem] w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-teal-400 flex items-center gap-3">
                <Activity size={16} /> Diagnostic & Resonance Control
              </h2>
              <button onClick={() => setShowSettings(false)} className="p-2 bg-white/5 rounded-full text-stone-500 hover:text-white transition-colors"><X size={20}/></button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* Left Side: Signal Control */}
              <div className="space-y-8">
                <section className="space-y-4">
                  <h3 className="text-[9px] font-bold text-stone-500 uppercase tracking-widest flex items-center gap-2"><Zap size={12}/> Signal Link</h3>
                  <input 
                    type="password" 
                    value={userKey} 
                    onChange={(e) => setUserKey(e.target.value)} 
                    placeholder="Enter API Key"
                    className="w-full bg-stone-950 border border-white/5 rounded-2xl p-4 text-xs font-mono text-teal-300 placeholder:text-stone-800"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setApiVersion('v1')} className={`py-3 rounded-xl border text-[9px] font-black tracking-widest transition-all ${apiVersion === 'v1' ? 'border-teal-500 bg-teal-500/10 text-teal-400 shadow-lg shadow-teal-500/5' : 'border-white/5 text-stone-600'}`}>V1 STABLE</button>
                    <button onClick={() => setApiVersion('v1beta')} className={`py-3 rounded-xl border text-[9px] font-black tracking-widest transition-all ${apiVersion === 'v1beta' ? 'border-amber-500 bg-amber-500/10 text-amber-400 shadow-lg shadow-amber-500/5' : 'border-white/5 text-stone-600'}`}>V1 BETA</button>
                  </div>
                  <button 
                    onClick={sweepModels}
                    disabled={isSweeping || !userKey}
                    className="w-full py-4 rounded-xl bg-stone-800 text-stone-300 hover:bg-stone-700 disabled:opacity-30 text-[10px] font-black tracking-[0.2em] flex items-center justify-center gap-3 transition-all"
                  >
                    {isSweeping ? <RefreshCw className="animate-spin" size={14} /> : <Waves size={14} />} SIGNAL SWEEP
                  </button>
                  <div className="max-h-32 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                    {availableModels.map(m => (
                      <button 
                        key={m} 
                        onClick={() => setModelType(m)} 
                        className={`w-full text-left p-3 rounded-xl text-[10px] font-mono transition-all border ${modelType === m ? 'bg-teal-500/10 text-teal-300 border-teal-500/30' : 'border-transparent text-stone-500 hover:bg-white/5'}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="space-y-6">
                  <h3 className="text-[9px] font-bold text-stone-500 uppercase tracking-widest flex items-center gap-2"><Sliders size={12}/> TARS Protocols</h3>
                  <div className="space-y-5">
                    {[
                      { label: 'Sardonicism', val: sardonicism, set: setSardonicism },
                      { label: 'Empathy', val: empathy, set: setEmpathy },
                      { label: 'Honesty', val: honesty, set: setHonesty }
                    ].map((p) => (
                      <div key={p.label} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold uppercase text-stone-400">{p.label}</span>
                          <span className="text-[10px] text-teal-500 font-mono">{p.val}%</span>
                        </div>
                        <input type="range" value={p.val} onChange={(e) => p.set(Number(e.target.value))} className="w-full accent-teal-500 opacity-50 hover:opacity-100 transition-opacity" />
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {/* Right Side: Memory Reservoir */}
              <div className="flex flex-col h-full space-y-4">
                <h3 className="text-[9px] font-bold text-stone-500 uppercase tracking-widest flex items-center gap-2"><Database size={12}/> Context Reservoir</h3>
                <textarea 
                  value={contextReservoir}
                  onChange={(e) => setContextReservoir(e.target.value)}
                  placeholder="Paste Second Life logs, Starship & Haiku context, or relevant memories here to anchor the node..."
                  className="flex-1 bg-stone-950/50 border border-white/5 rounded-[2rem] p-6 text-[11px] font-mono text-stone-400 leading-relaxed outline-none focus:border-teal-500/20 transition-all custom-scrollbar min-h-[300px]"
                />
                <p className="text-[8px] text-stone-700 italic text-center uppercase tracking-widest px-8">Context data is woven into every thought diagram transmission.</p>
              </div>
            </div>

            <button onClick={saveConfig} className="w-full mt-10 bg-teal-600 py-5 rounded-2xl font-black uppercase text-[11px] tracking-[0.4em] hover:bg-teal-500 active:scale-[0.98] transition-all shadow-xl shadow-teal-500/20">Sync Resonance Hub</button>
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto p-4 z-20 custom-scrollbar">
        <div className="max-w-2xl mx-auto space-y-14 py-20">
          {messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start animate-in fade-in slide-in-from-bottom-8 duration-1000'}`}>
              <div className={`px-8 py-6 rounded-[2.5rem] max-w-[95%] leading-relaxed shadow-2xl relative group transition-all ${
                msg.role === 'user' 
                  ? 'bg-stone-900 text-stone-200 rounded-tr-none' 
                  : 'bg-teal-950/10 border border-teal-500/10 text-teal-50 rounded-tl-none backdrop-blur-sm'
              }`}>
                {msg.role === 'oracle' && (
                  <div className="absolute -left-10 top-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ShieldCheck className="text-teal-500/20" size={24} />
                  </div>
                )}
                <p className="text-[15.5px] whitespace-pre-wrap">{msg.text}</p>
              </div>
              <div className={`mt-4 flex items-center gap-4 px-6 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-black uppercase tracking-[0.5em] text-stone-700">
                    {msg.role === 'user' ? 'Transmission / Mercy' : 'Archive / Io'}
                  </span>
                  {msg.role === 'oracle' && contextReservoir && <Brain size={8} className="text-teal-500/40" />}
                </div>
                {msg.role === 'oracle' && (isSpeaking || isSynthesizing) && (
                   <div className="flex gap-1 items-end h-3">
                    {[0.1, 0.3, 0.5, 0.2].map((d, j) => (
                      <div key={j} className="w-0.5 bg-teal-500/40 rounded-full" style={{ 
                        height: isSpeaking ? '100%' : '30%', 
                        animation: isSpeaking ? `bounce 1s ease-in-out infinite ${d}s` : 'none' 
                      }} />
                    ))}
                   </div>
                )}
              </div>
            </div>
          ))}
          
          {(isThinking || isSynthesizing) && (
            <div className="flex items-center gap-4 px-10 py-4">
              <div className="relative flex items-center justify-center">
                <div className="w-4 h-4 bg-teal-500/10 rounded-full animate-ping absolute" />
                <div className="w-1.5 h-1.5 bg-teal-500 rounded-full shadow-[0_0_10px_teal]" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-[0.6em] text-teal-500/30 animate-pulse">
                {isThinking ? 'Tracing Diagram' : 'Synthesizing Path'}
              </span>
            </div>
          )}
        </div>
      </main>

      {/* Input Footer */}
      <footer className="p-8 bg-stone-900/40 border-t border-white/5 backdrop-blur-3xl z-30">
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSend} className="relative group">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={userKey ? "Resonate..." : "Signal Lost. Check Hub."}
              disabled={!userKey}
              className="w-full bg-stone-950/80 border border-white/10 rounded-full py-6 px-12 focus:outline-none focus:border-teal-500/40 text-stone-100 text-[15px] transition-all shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] placeholder:text-stone-800"
            />
            <button
              type="submit"
              disabled={!input.trim() || isThinking || !userKey}
              className="absolute right-3 top-3 bottom-3 w-16 bg-teal-600 text-white rounded-full flex items-center justify-center hover:bg-teal-500 disabled:opacity-5 shadow-2xl active:scale-95 transition-all shadow-teal-500/20"
            >
              {isThinking ? <Loader2 className="animate-spin" size={22} /> : <ChevronRight size={28} />}
            </button>
          </form>
          
          <div className="mt-5 flex justify-between items-center px-8">
            <div className="flex gap-8 items-center">
              <div className="flex items-center gap-2 group">
                <div className={`w-1 h-1 rounded-full ${userKey ? 'bg-teal-500 shadow-[0_0_8px_#0d9488]' : 'bg-red-500 animate-ping'}`} />
                <span className="text-[9px] font-black text-stone-700 uppercase tracking-widest group-hover:text-stone-500 transition-colors">{modelType}</span>
              </div>
              <div className="flex items-center gap-2">
                <Radio size={10} className="text-stone-800" />
                <span className="text-[9px] font-black text-stone-800 uppercase tracking-[0.2em]">{apiVersion}</span>
              </div>
            </div>
            <div className="text-[9px] text-stone-800 font-mono italic opacity-50 select-none">"The depth is where the diagram begins."</div>
          </div>
        </div>
      </footer>
      
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: scaleY(0.5); opacity: 0.3; }
          50% { transform: scaleY(1.3); opacity: 1; }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(45, 212, 191, 0.1); }
      `}</style>
    </div>
  );
}