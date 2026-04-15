import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, PhoneOff, Volume2, Sparkles, BrainCircuit, 
  ChevronLeft, Settings, Info, History, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GoogleGenAI } from "@google/genai";
import { toast } from 'react-hot-toast';
import { cn } from '../lib/utils';

export const ThinAILivePage = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [transcript, setTranscript] = useState('');
  const [response, setLiveResponse] = useState('');
  const [isMicBlocked, setIsMicBlocked] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
  const [history, setHistory] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const recognitionRef = useRef<any>(null);
  const isLiveActiveRef = useRef(false);

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      const viVoices = voices.filter(v => v.lang.includes('vi'));
      setAvailableVoices(viVoices);
      if (viVoices.length > 0 && !selectedVoiceURI) {
        setSelectedVoiceURI(viVoices[0].voiceURI);
      }
    };
    loadVoices();
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Check mic permission
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' as PermissionName }).then((result) => {
        if (result.state === 'denied') setIsMicBlocked(true);
        result.onchange = () => setIsMicBlocked(result.state === 'denied');
      });
    }

    return () => {
      stopLive();
    };
  }, []);

  const startLive = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setIsMicBlocked(false);
      }
      isLiveActiveRef.current = true;
      startListening();
    } catch (err: any) {
      console.error("Mic permission error:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setIsMicBlocked(true);
        toast.error("Trình duyệt đã chặn Micro. Vui lòng cấp quyền lại.");
      } else {
        toast.error("Lỗi khởi động Micro: " + err.message);
      }
    }
  };

  const stopLive = () => {
    isLiveActiveRef.current = false;
    setStatus('idle');
    if (recognitionRef.current) recognitionRef.current.stop();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  };

  const startListening = () => {
    if (!isLiveActiveRef.current) return;
    
    setStatus('listening');
    setTranscript('');
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Trình duyệt không hỗ trợ nhận diện giọng nói.");
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'vi-VN';
    recognition.continuous = false;
    
    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      setHistory(prev => [...prev, { role: 'user', text }]);
      setStatus('thinking');
      processMessage(text);
    };
    
    recognition.onerror = (e: any) => {
      if (e.error === 'no-speech' && isLiveActiveRef.current) {
        startListening();
      } else if (e.error !== 'aborted') {
        setStatus('idle');
      }
    };
    
    recognition.start();
  };

  const processMessage = async (text: string) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey: apiKey! });
      
      const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview',
        contents: text,
        config: {
          systemInstruction: "Bạn là ThinAI Live, một trợ lý giọng nói thông minh. Hãy trả lời cực kỳ ngắn gọn, súc tích, tự nhiên như đang trò chuyện trực tiếp. Không dùng markdown, không liệt kê dài dòng. Chỉ trả lời bằng văn bản thuần túy để đọc lên."
        }
      });
      
      const reply = response.text || "";
      
      if (!isLiveActiveRef.current) return;
      
      setLiveResponse(reply);
      setHistory(prev => [...prev, { role: 'model', text: reply }]);
      setStatus('speaking');
      speak(reply);
    } catch (error) {
      console.error(error);
      if (isLiveActiveRef.current) {
        setStatus('idle');
        toast.error("Lỗi kết nối AI.");
      }
    }
  };

  const speak = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'vi-VN';
    utterance.rate = 1.1;
    
    const voice = availableVoices.find(v => v.voiceURI === selectedVoiceURI) || availableVoices[0];
    if (voice) utterance.voice = voice;
    
    utterance.onend = () => {
      if (isLiveActiveRef.current) startListening();
    };
    
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col overflow-hidden font-sans">
      {/* Header */}
      <header className="p-6 flex items-center justify-between z-10">
        <button 
          onClick={() => navigate(-1)}
          className="p-3 rounded-full bg-slate-900/50 border border-white/5 hover:bg-slate-800 transition-all"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.3)]">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-black tracking-tighter">ThinAI <span className="text-cyan-400">LIVE</span></h1>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className="p-3 rounded-full bg-slate-900/50 border border-white/5 hover:bg-slate-800 transition-all"
          >
            <History className="w-6 h-6" />
          </button>
          <button className="p-3 rounded-full bg-slate-900/50 border border-white/5 hover:bg-slate-800 transition-all">
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 relative">
        {/* Background Glows */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div 
            animate={{ 
              scale: status === 'listening' ? [1, 1.2, 1] : 1,
              opacity: status === 'listening' ? [0.3, 0.5, 0.3] : 0.1
            }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/20 rounded-full blur-[120px]" 
          />
          <motion.div 
            animate={{ 
              scale: status === 'speaking' ? [1, 1.3, 1] : 1,
              opacity: status === 'speaking' ? [0.3, 0.6, 0.3] : 0.1
            }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/20 rounded-full blur-[100px]" 
          />
        </div>

        {/* Central Orb */}
        <div className="relative z-10 flex flex-col items-center gap-12">
          <div className="relative w-64 h-64 flex items-center justify-center">
            {/* Animated Rings */}
            <AnimatePresence>
              {status !== 'idle' && (
                <>
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute inset-0 border-2 border-cyan-500/30 rounded-full"
                  />
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 2, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ repeat: Infinity, duration: 3, delay: 0.5 }}
                    className="absolute inset-0 border border-blue-500/20 rounded-full"
                  />
                </>
              )}
            </AnimatePresence>

            {/* The Orb */}
            <motion.div 
              onClick={() => {
                if (status === 'listening' && recognitionRef.current) {
                  recognitionRef.current.stop();
                }
              }}
              animate={{ 
                scale: status === 'listening' ? [1, 1.1, 1] : status === 'speaking' ? [1, 1.05, 1] : 1,
                boxShadow: status === 'listening' ? "0 0 80px rgba(6,182,212,0.5)" : 
                           status === 'thinking' ? "0 0 80px rgba(168,85,247,0.5)" :
                           status === 'speaking' ? "0 0 80px rgba(34,211,238,0.5)" : "0 0 40px rgba(0,0,0,0.5)"
              }}
              transition={{ repeat: Infinity, duration: 1 }}
              className={cn(
                "w-48 h-48 rounded-full flex items-center justify-center transition-all duration-700 relative overflow-hidden",
                status === 'listening' ? "bg-gradient-to-br from-blue-600 to-cyan-500 cursor-pointer" :
                status === 'thinking' ? "bg-gradient-to-br from-purple-600 to-pink-500" :
                status === 'speaking' ? "bg-gradient-to-br from-cyan-400 to-emerald-500" : "bg-slate-800"
              )}
            >
              {status === 'idle' ? (
                <button 
                  onClick={startLive}
                  className="w-full h-full flex flex-col items-center justify-center gap-3 hover:bg-white/5 transition-all"
                >
                  <Mic className="w-16 h-16 text-white" />
                  <span className="text-xs font-bold uppercase tracking-widest text-white/70">Bắt đầu</span>
                </button>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  {status === 'listening' && (
                    <>
                      <Mic className="w-12 h-12 text-white animate-pulse" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/70 mt-1">Chạm để gửi</span>
                    </>
                  )}
                  {status === 'thinking' && <BrainCircuit className="w-16 h-16 text-white animate-spin-slow" />}
                  {status === 'speaking' && <Volume2 className="w-16 h-16 text-white animate-bounce" />}
                </div>
              )}
              
              {/* Internal Glow */}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent pointer-events-none" />
            </motion.div>
          </div>

          {/* Text Display */}
          <div className="text-center max-w-2xl px-6 h-32 flex flex-col items-center justify-center gap-4">
            <AnimatePresence mode="wait">
              {status === 'listening' && (
                <motion.div 
                  key="listening"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-2"
                >
                  <p className="text-cyan-400 font-bold uppercase tracking-[0.2em] text-sm">Đang lắng nghe</p>
                  <p className="text-2xl text-slate-300 font-medium italic">
                    {transcript || "Hãy nói điều gì đó..."}
                  </p>
                </motion.div>
              )}
              
              {status === 'thinking' && (
                <motion.div 
                  key="thinking"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.1 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" />
                  <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce [animation-delay:0.2s]" />
                  <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce [animation-delay:0.4s]" />
                  <span className="text-purple-400 font-bold uppercase tracking-widest ml-2">Đang xử lý</span>
                </motion.div>
              )}

              {status === 'speaking' && (
                <motion.div 
                  key="speaking"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <p className="text-emerald-400 font-bold uppercase tracking-[0.2em] text-sm">ThinAI đang trả lời</p>
                  <p className="text-3xl text-white font-bold leading-tight">
                    {response}
                  </p>
                </motion.div>
              )}

              {status === 'idle' && (
                <motion.div 
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center"
                >
                  {isMicBlocked ? (
                    <div className="flex flex-col items-center gap-6 bg-red-500/10 border border-red-500/30 p-8 rounded-[2rem] max-w-sm">
                      <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center text-red-400">
                        <PhoneOff className="w-8 h-8" />
                      </div>
                      <div className="space-y-4">
                        <p className="text-red-400 font-bold text-xl">Microphone bị chặn!</p>
                        <div className="text-sm text-slate-300 leading-relaxed text-left space-y-2 bg-slate-900/50 p-4 rounded-xl">
                          <p><b>Cách sửa lỗi:</b></p>
                          <p>1. Nhìn lên <b>góc trên cùng bên phải</b> của khung xem trước này.</p>
                          <p>2. Bấm vào biểu tượng <b>Mũi tên chéo (↗️)</b> để mở ứng dụng ra một trang web mới toàn màn hình.</p>
                          <p>3. Tại trang web mới, bấm vào biểu tượng <b>Cái khóa 🔒</b> trên thanh địa chỉ và chọn <b>Cho phép (Allow)</b> Micro.</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-lg">Bấm vào biểu tượng để bắt đầu trò chuyện trực tiếp</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Footer Controls */}
      <footer className="p-12 flex justify-center z-10">
        <AnimatePresence>
          {status !== 'idle' && (
            <motion.button
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              onClick={stopLive}
              className="group flex flex-col items-center gap-3"
            >
              <div className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center shadow-[0_0_30px_rgba(220,38,38,0.4)] group-hover:bg-red-500 group-hover:scale-110 transition-all">
                <PhoneOff className="w-8 h-8 text-white" />
              </div>
              <span className="text-xs font-bold text-red-500 uppercase tracking-widest">Kết thúc</span>
            </motion.button>
          )}
        </AnimatePresence>
      </footer>

      {/* History Sidebar */}
      <AnimatePresence>
        {showHistory && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-slate-900 shadow-2xl z-[100] border-l border-white/5 flex flex-col"
          >
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <History className="w-5 h-5 text-cyan-400" />
                Lịch sử trò chuyện
              </h2>
              <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-white/5 rounded-lg">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
              {history.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
                  <Info className="w-12 h-12 opacity-20" />
                  <p>Chưa có lịch sử trò chuyện nào.</p>
                </div>
              ) : (
                history.map((item, i) => (
                  <div key={i} className={cn(
                    "flex flex-col gap-2",
                    item.role === 'user' ? "items-end" : "items-start"
                  )}>
                    <div className={cn(
                      "max-w-[80%] p-4 rounded-2xl text-sm",
                      item.role === 'user' 
                        ? "bg-blue-600/20 border border-blue-500/30 text-blue-100" 
                        : "bg-slate-800 border border-slate-700 text-slate-200"
                    )}>
                      {item.text}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}</style>
    </div>
  );
};
