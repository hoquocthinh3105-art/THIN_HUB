import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Send, Paperclip, Mic, Trash2, Settings, 
  Bot, User, Image as ImageIcon, FileText, Code, 
  Globe, Zap, BrainCircuit, ChevronRight, Copy, Check, Crown,
  Volume2, PhoneCall, PhoneOff, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { GoogleGenAI, Type } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { toast } from 'react-hot-toast';
import { cn } from '../lib/utils';

export const ProAIAssistantPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<{ role: 'user' | 'model'; text: string; isError?: boolean; images?: string[] }[]>([
    { role: 'model', text: 'Xin chào **PRO User**! Tôi là ThinAI Pro - Trợ lý AI đa năng. Tôi có thể giúp bạn giải đáp **mọi câu hỏi** trong mọi lĩnh vực dựa trên các nguồn thông tin chính thống từ Internet. Bạn cần tôi giúp gì hôm nay?' }
  ]);
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  // Pro Features State
  const [useWebSearch, setUseWebSearch] = useState(true);
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-pro-preview');
  const [activePreset, setActivePreset] = useState('Chuyên gia Đa năng');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Voice Chat State
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');

  // Live Modal State
  const [isLiveModalOpen, setIsLiveModalOpen] = useState(false);
  const [liveStatus, setLiveStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [liveResponse, setLiveResponse] = useState('');
  const liveRecognitionRef = useRef<any>(null);
  const isLiveModeRef = useRef(false);

  const [isMicBlocked, setIsMicBlocked] = useState(false);

  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' as PermissionName }).then((result) => {
        if (result.state === 'denied') {
          setIsMicBlocked(true);
        }
        result.onchange = () => {
          setIsMicBlocked(result.state === 'denied');
        };
      }).catch(err => console.warn("Permissions API not supported for mic:", err));
    }
  }, []);

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
  }, []);

  const stopSpeaking = () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  };

  const speakText = (text: string, onEndCallback?: () => void) => {
    if (!window.speechSynthesis) {
      if (onEndCallback) onEndCallback();
      return;
    }
    window.speechSynthesis.cancel();
    // Clean markdown for better speech
    const cleanText = text.replace(/[*#_]/g, '').replace(/```[\s\S]*?```/g, 'Đoạn mã code.').replace(/\$/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'vi-VN';
    utterance.rate = 1.05; // Slightly faster for natural feel
    
    if (selectedVoiceURI) {
      const voice = availableVoices.find(v => v.voiceURI === selectedVoiceURI);
      if (voice) utterance.voice = voice;
    } else if (availableVoices.length > 0) {
      utterance.voice = availableVoices[0];
    }
    
    if (onEndCallback) {
      utterance.onend = onEndCallback;
    }
    
    window.speechSynthesis.speak(utterance);
  };

  // --- LIVE MODE LOGIC ---
  const startLiveMode = async () => {
    // Reset states
    setLiveTranscript('');
    setLiveResponse('');
    
    setIsLiveModalOpen(true);
    isLiveModeRef.current = true;
    setLiveStatus('idle');
    
    try {
      // Check if browser supports speech recognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        throw new Error("BROWSER_NOT_SUPPORTED");
      }

      // Explicitly request mic permission
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setIsMicBlocked(false);
      }
      startLiveListening();
    } catch (err: any) {
      console.error("Live mode startup error:", err);
      if (err.message === "BROWSER_NOT_SUPPORTED") {
        toast.error("Trình duyệt của bạn không hỗ trợ nhận diện giọng nói. Vui lòng sử dụng Google Chrome.");
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setIsMicBlocked(true);
        toast.error("Bạn đã chặn Micro. Vui lòng cấp quyền để tiếp tục.");
      } else {
        toast.error("Không thể khởi động Live Chat. Vui lòng thử lại.");
      }
      stopLiveMode();
    }
  };

  const stopLiveMode = () => {
    setIsLiveModalOpen(false);
    isLiveModeRef.current = false;
    setLiveStatus('idle');
    if (liveRecognitionRef.current) {
      try { liveRecognitionRef.current.stop(); } catch (e) {}
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const startLiveListening = () => {
    if (!isLiveModeRef.current) return;
    
    if (liveRecognitionRef.current) {
      try { liveRecognitionRef.current.stop(); } catch (e) {}
    }
    
    setLiveStatus('listening');
    setLiveTranscript('');
    setLiveResponse('');
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Trình duyệt không hỗ trợ nhận diện giọng nói. Vui lòng dùng Chrome.");
      stopLiveMode();
      return;
    }
    
    const recognition = new SpeechRecognition();
    liveRecognitionRef.current = recognition;
    recognition.lang = 'vi-VN';
    recognition.continuous = false;
    
    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      setLiveTranscript(text);
      setLiveStatus('thinking');
      await processLiveMessage(text);
    };
    
    recognition.onerror = (e: any) => {
      if (e.error === 'no-speech' && isLiveModeRef.current) {
        startLiveListening();
      } else {
        setLiveStatus('idle');
        if (e.error !== 'aborted') {
          toast.error("Lỗi Live Chat: " + (e.error || 'Unknown'));
        }
      }
    };
    
    recognition.start();
  };

  const processLiveMessage = async (text: string) => {
    if (!isLiveModeRef.current) return;
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("API Key is missing.");
      const ai = new GoogleGenAI({ apiKey });
      
      setMessages(prev => [...prev, { role: 'user', text }]);
      
      const systemPrompt = presets.find(p => p.name === activePreset)?.prompt || presets[0].prompt;
      const livePrompt = systemPrompt + " TRẢ LỜI NGẮN GỌN, TỰ NHIÊN NHƯ ĐANG NÓI CHUYỆN TRỰC TIẾP. KHÔNG DÙNG MARKDOWN HAY FORMAT PHỨC TẠP.";
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: text,
        config: { systemInstruction: livePrompt }
      });
      
      const reply = response.text || "";
      if (!isLiveModeRef.current) return;
      
      setLiveResponse(reply);
      setMessages(prev => [...prev, { role: 'model', text: reply }]);
      
      setLiveStatus('speaking');
      speakText(reply, () => {
        if (isLiveModeRef.current) {
          startLiveListening();
        }
      });
    } catch (error) {
      console.error(error);
      if (isLiveModeRef.current) {
        setLiveStatus('idle');
        toast.error("Lỗi kết nối AI.");
      }
    }
  };
  // --- END LIVE MODE LOGIC ---

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const presets = [
    { name: "Chuyên gia Đa năng", icon: BrainCircuit, prompt: "Bạn là ThinAI Pro, một trợ lý AI đa năng và thông minh. Bạn có khả năng trả lời MỌI câu hỏi trong mọi lĩnh vực (đời sống, khoa học, công nghệ, lịch sử, văn hóa, v.v. không chỉ giới hạn trong học tập). Hãy luôn tìm kiếm và dựa vào các nguồn thông tin chính thống, đáng tin cậy trên internet để đưa ra câu trả lời chính xác, khách quan và cập nhật nhất. Trình bày rõ ràng, chi tiết. Vẫn sử dụng LaTeX cho các công thức toán/lý/hóa nếu có." },
    { name: "Giáo sư Toán học", icon: Code, prompt: "Bạn là một Giáo sư Toán học xuất chúng. Hãy giải thích các bài toán từng bước một cách logic, chặt chẽ. BẮT BUỘC dùng LaTeX cho mọi công thức." },
    { name: "Lập trình viên Senior", icon: Code, prompt: "Bạn là một Senior Developer. Hãy viết code tối ưu, sạch sẽ, có comment giải thích rõ ràng và tuân thủ best practices." },
    { name: "Nhà nghiên cứu", icon: FileText, prompt: "Bạn là một nhà nghiên cứu học thuật. Hãy phân tích vấn đề đa chiều, trích dẫn nguồn uy tín và trình bày một cách khách quan, khoa học." },
  ];

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const messageText = customText || input.trim();
    if ((!messageText && !selectedFile) || isLoading) return;

    const userMessage = messageText || (selectedFile ? `Tôi đã tải lên một tệp: ${selectedFile.name}. Hãy phân tích.` : "");
    const currentFile = selectedFile;
    
    setInput('');
    setSelectedFile(null);
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    setMessages(prev => [...prev, { role: 'model', text: '' }]);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("API Key is missing.");
      
      const ai = new GoogleGenAI({ apiKey });
      
      const history: any[] = [];
      let lastRole: string | null = null;
      
      for (let i = 0; i < messages.length; i++) {
        const m = messages[i];
        if (i === 0 && m.role === 'model') continue;
        if (!m.text || !m.text.trim() || m.isError) continue;
        if (m.role === lastRole) continue;
        history.push({ role: m.role, parts: [{ text: m.text }] });
        lastRole = m.role;
      }

      while (history.length > 0 && history[history.length - 1].role === 'user') {
        history.pop();
      }

      const userParts: any[] = [];
      if (userMessage) userParts.push({ text: userMessage });

      if (currentFile) {
        const base64Data = await fileToBase64(currentFile);
        userParts.push({
          inlineData: {
            data: base64Data.split(',')[1],
            mimeType: currentFile.type
          }
        });
      }

      const systemPrompt = presets.find(p => p.name === activePreset)?.prompt || presets[0].prompt;

      const isImageRequest = /tạo ảnh|vẽ ảnh|generate image|draw a picture|vẽ một/i.test(userMessage);

      if (isImageRequest) {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: [...history, { role: 'user', parts: userParts }],
          config: {
            imageConfig: { aspectRatio: "1:1" }
          }
        });
        
        let textResponse = "";
        let imageResponses: string[] = [];
        
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            imageResponses.push(`data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`);
          } else if (part.text) {
            textResponse += part.text;
          }
        }
        
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = { role: 'model', text: textResponse || "Đây là hình ảnh bạn yêu cầu:", images: imageResponses };
          return newMessages;
        });
      } else {
        const config: any = {
          systemInstruction: systemPrompt,
        };
        if (useWebSearch) {
          config.tools = [{ googleSearch: {} }];
        }

        const streamResponse = await ai.models.generateContentStream({
          model: selectedModel,
          contents: [...history, { role: 'user', parts: userParts }],
          config
        });

        let fullText = "";
        for await (const chunk of streamResponse) {
          const chunkText = chunk.text || "";
          fullText += chunkText;
          setMessages(prev => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = { role: 'model', text: fullText };
            return newMessages;
          });
        }
        
        if (isVoiceMode) {
          speakText(fullText);
        }
      }
    } catch (error: any) {
      console.error("AI Error:", error);
      toast.error("Lỗi kết nối AI Pro.");
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = { role: 'model', text: `Đã có lỗi xảy ra: ${error.message || error}. Vui lòng thử lại.`, isError: true };
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceInput = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setIsMicBlocked(false);
      }
    } catch (err: any) {
      console.error("Mic permission error:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setIsMicBlocked(true);
      }
      toast.error("Trình duyệt đã chặn Micro. Vui lòng bấm vào biểu tượng 🔒 trên thanh địa chỉ để cấp quyền lại.");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Trình duyệt không hỗ trợ nhận diện giọng nói. Vui lòng dùng Chrome.");
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.onstart = () => {
      setIsListening(true);
      stopSpeaking(); // Stop AI from talking when user starts talking
    };
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      if (isVoiceMode) {
        handleSend(undefined, transcript);
      }
    };
    recognition.onerror = (e: any) => { 
      setIsListening(false); 
      if (e.error !== 'aborted') {
        toast.error("Lỗi nhận diện giọng nói: " + (e.error || 'Unknown')); 
      }
    };
    
    try {
      recognition.start();
    } catch (e) {
      console.error("Speech recognition start error:", e);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
    toast.success("Đã sao chép!");
  };

  return (
    <div className="h-[calc(100vh-120px)] flex gap-6">
      {/* Sidebar - Pro Settings */}
      <div className="w-80 flex flex-col gap-6">
        <div className="bg-gradient-to-br from-amber-500/20 to-purple-600/20 border border-amber-500/30 rounded-3xl p-6 backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/20 blur-[50px] rounded-full"></div>
          <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-purple-400 mb-2 flex items-center gap-2">
            <Crown className="w-6 h-6 text-amber-400" /> ThinAI Pro
          </h2>
          <p className="text-sm text-slate-300 font-medium">Trải nghiệm AI tối thượng dành riêng cho tài khoản Pro.</p>
        </div>

        <div className="flex-1 bg-slate-900/50 border border-white/5 rounded-3xl p-6 flex flex-col gap-6 overflow-y-auto no-scrollbar">
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Mô hình AI</h3>
            <div className="grid grid-cols-1 gap-2">
              <button 
                onClick={() => setSelectedModel('gemini-3.1-pro-preview')}
                className={cn("p-3 rounded-xl border text-left transition-all", selectedModel === 'gemini-3.1-pro-preview' ? "bg-purple-500/20 border-purple-500 text-purple-300" : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700")}
              >
                <div className="font-bold text-sm mb-1 flex items-center gap-2"><BrainCircuit className="w-4 h-4"/> Gemini 3.1 Pro</div>
                <div className="text-[10px] opacity-70">Suy luận phức tạp, code, toán học cao cấp.</div>
              </button>
              <button 
                onClick={() => setSelectedModel('gemini-3-flash-preview')}
                className={cn("p-3 rounded-xl border text-left transition-all", selectedModel === 'gemini-3-flash-preview' ? "bg-cyan-500/20 border-cyan-500 text-cyan-300" : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700")}
              >
                <div className="font-bold text-sm mb-1 flex items-center gap-2"><Zap className="w-4 h-4"/> Gemini 3.0 Flash</div>
                <div className="text-[10px] opacity-70">Tốc độ phản hồi cực nhanh, tác vụ cơ bản.</div>
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Tính năng nâng cao</h3>
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition-all">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", useWebSearch ? "bg-blue-500/20 text-blue-400" : "bg-slate-800 text-slate-500")}>
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-200">Tìm kiếm Web</div>
                  <div className="text-[10px] text-slate-500">Kết nối Internet thời gian thực</div>
                </div>
              </div>
              <div className={cn("w-10 h-5 rounded-full relative transition-colors", useWebSearch ? "bg-blue-500" : "bg-slate-700")}>
                <div className={cn("absolute top-1 w-3 h-3 rounded-full bg-white transition-all", useWebSearch ? "right-1" : "left-1")}></div>
              </div>
              <input type="checkbox" className="hidden" checked={useWebSearch} onChange={(e) => setUseWebSearch(e.target.checked)} />
            </label>
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Trò chuyện Giọng nói</h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition-all">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", isVoiceMode ? "bg-green-500/20 text-green-400" : "bg-slate-800 text-slate-500")}>
                    <PhoneCall className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-200">Đàm thoại trực tiếp</div>
                    <div className="text-[10px] text-slate-500">Tự động gửi & đọc câu trả lời</div>
                  </div>
                </div>
                <div className={cn("w-10 h-5 rounded-full relative transition-colors", isVoiceMode ? "bg-green-500" : "bg-slate-700")}>
                  <div className={cn("absolute top-1 w-3 h-3 rounded-full bg-white transition-all", isVoiceMode ? "right-1" : "left-1")}></div>
                </div>
                <input type="checkbox" className="hidden" checked={isVoiceMode} onChange={(e) => { setIsVoiceMode(e.target.checked); if(!e.target.checked) stopSpeaking(); }} />
              </label>
              
              {availableVoices.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-xs font-bold text-slate-400 mb-2">Chọn giọng đọc:</div>
                  <select 
                    value={selectedVoiceURI} 
                    onChange={(e) => setSelectedVoiceURI(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg p-2 focus:outline-none focus:border-purple-500"
                  >
                    {availableVoices.map(v => (
                      <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>
                    ))}
                  </select>
                  <div className="text-[10px] text-slate-500 mt-2 italic">* Giọng đọc phụ thuộc vào hệ điều hành/trình duyệt của bạn.</div>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Nhân cách AI</h3>
            <div className="space-y-2">
              {presets.map(preset => (
                <button
                  key={preset.name}
                  onClick={() => setActivePreset(preset.name)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                    activePreset === preset.name 
                      ? "bg-amber-500/10 border-amber-500/50 text-amber-400" 
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900"
                  )}
                >
                  <preset.icon className="w-4 h-4" />
                  <span className="text-sm font-bold">{preset.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 bg-slate-900/40 border border-white/5 rounded-[2.5rem] backdrop-blur-2xl flex flex-col overflow-hidden relative shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-purple-500 to-cyan-500 opacity-50"></div>
        
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(147,51,234,0.4)]">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">{activePreset}</h3>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Sẵn sàng hỗ trợ
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/thinai-live')}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.4)] border border-white/10"
            >
              <PhoneCall className="w-4 h-4 animate-pulse" /> Trò chuyện Live
            </motion.button>
            <button onClick={() => setMessages([{ role: 'model', text: 'Xin chào **PRO User**! Tôi là ThinAI Pro - Trợ lý AI đa năng. Tôi có thể giúp bạn giải đáp **mọi câu hỏi** trong mọi lĩnh vực dựa trên các nguồn thông tin chính thống từ Internet. Bạn cần tôi giúp gì hôm nay?' }])} className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto space-y-6 no-scrollbar">
          <AnimatePresence>
            {isMicBlocked && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-4"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-red-500/20 rounded-lg text-red-400">
                    <PhoneOff className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-red-400 mb-1">Microphone bị chặn</h4>
                    <div className="text-xs text-red-300/80 leading-relaxed space-y-1">
                      <p>Trình duyệt đã chặn Micro do ứng dụng đang chạy trong khung thu nhỏ.</p>
                      <p><b>Cách sửa:</b> Nhìn lên <b>góc trên cùng bên phải</b> của màn hình xem trước, bấm vào biểu tượng <b>Mũi tên chéo (↗️)</b> để mở ứng dụng ra tab mới. Sau đó cấp quyền Micro ở tab mới đó.</p>
                    </div>
                  </div>
                  <button onClick={() => setIsMicBlocked(false)} className="text-red-400 hover:text-red-300">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {messages.map((msg, i) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={i}
              className={cn("flex gap-4 max-w-[85%]", msg.role === 'user' ? "ml-auto flex-row-reverse" : "")}
            >
              <div className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-lg",
                msg.role === 'user' 
                  ? "bg-gradient-to-br from-cyan-500 to-blue-600" 
                  : "bg-gradient-to-br from-purple-600 to-pink-600"
              )}>
                {msg.role === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
              </div>
              <div className={cn(
                "p-5 rounded-3xl relative group",
                msg.role === 'user' 
                  ? "bg-blue-600/20 border border-blue-500/30 text-white rounded-tr-sm" 
                  : "bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-tl-sm",
                msg.isError && "bg-red-500/10 border-red-500/30 text-red-400"
              )}>
                {msg.role === 'model' && !msg.isError && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-50 hover:opacity-100 transition-all">
                    <button 
                      onClick={() => speakText(msg.text)}
                      className="p-1.5 rounded-lg bg-slate-700/50 text-slate-400 hover:text-green-400 transition-all"
                      title="Đọc văn bản"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => copyToClipboard(msg.text, i)}
                      className="p-1.5 rounded-lg bg-slate-700/50 text-slate-400 hover:text-white transition-all"
                      title="Sao chép"
                    >
                      {copiedIndex === i ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                )}
                <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-slate-950 prose-pre:border prose-pre:border-slate-800 prose-pre:rounded-xl">
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {msg.text || (isLoading && i === messages.length - 1 ? '...' : '')}
                  </ReactMarkdown>
                  {msg.images && msg.images.length > 0 && (
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {msg.images.map((imgSrc, imgIdx) => (
                        <img key={imgIdx} src={imgSrc} alt="Generated" className="w-full rounded-xl shadow-lg border border-white/10" referrerPolicy="no-referrer" />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
          {isLoading && messages[messages.length - 1].role === 'user' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4 max-w-[85%]">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shrink-0 shadow-lg">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="p-5 rounded-3xl bg-slate-800/50 border border-slate-700/50 rounded-tl-sm flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce"></div>
                <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </motion.div>
          )}
        </div>

        <div className="p-6 pt-0">
          <form onSubmit={handleSend} className="relative flex items-end gap-3 bg-slate-950/50 border border-white/10 p-2 rounded-[2rem] focus-within:border-purple-500/50 focus-within:bg-slate-900/80 transition-all shadow-lg">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-4 rounded-full text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 transition-all shrink-0">
              <Paperclip className="w-5 h-5" />
            </button>
            <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} accept="image/*,.pdf,.doc,.docx,.txt" />
            
            <div className="flex-1 flex flex-col justify-center min-h-[60px] py-2">
              {selectedFile && (
                <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 rounded-xl w-fit">
                  <FileText className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold text-purple-300 truncate max-w-[200px]">{selectedFile.name}</span>
                  <button type="button" onClick={() => setSelectedFile(null)} className="text-purple-400 hover:text-red-400 ml-2"><Trash2 className="w-3 h-3" /></button>
                </div>
              )}
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Hỏi ThinAI Pro bất cứ điều gì..."
                className="w-full bg-transparent text-white placeholder-slate-500 focus:outline-none resize-none max-h-32 min-h-[24px] px-2 text-sm leading-relaxed"
                rows={1}
                style={{ height: 'auto' }}
              />
            </div>

            <button type="button" onClick={handleVoiceInput} className={cn("p-4 rounded-full transition-all shrink-0", isListening ? "bg-red-500/20 text-red-400 animate-pulse" : "text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10")}>
              <Mic className="w-5 h-5" />
            </button>
            <button type="submit" disabled={(!input.trim() && !selectedFile) || isLoading} className="p-4 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(147,51,234,0.4)] transition-all shrink-0">
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>

      {/* Live Voice Modal */}
      <AnimatePresence>
        {isLiveModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-6"
          >
            <div className="absolute top-8 right-8">
              <button onClick={stopLiveMode} className="p-4 bg-slate-800/50 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-full transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center w-full max-w-3xl gap-12">
              {/* Status Orb */}
              <div className="relative flex items-center justify-center w-48 h-48">
                {liveStatus === 'listening' && (
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="absolute inset-0 bg-blue-500/20 rounded-full blur-2xl" />
                )}
                {liveStatus === 'thinking' && (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} className="absolute inset-0 border-4 border-t-purple-500 border-r-transparent border-b-cyan-500 border-l-transparent rounded-full" />
                )}
                {liveStatus === 'speaking' && (
                  <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 0.8 }} className="absolute inset-0 bg-cyan-500/30 rounded-full blur-xl" />
                )}
                
                <div className={cn(
                  "w-32 h-32 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(0,0,0,0.5)] z-10 transition-all duration-500 cursor-pointer",
                  liveStatus === 'listening' ? "bg-blue-600" :
                  liveStatus === 'thinking' ? "bg-purple-600" :
                  liveStatus === 'speaking' ? "bg-cyan-500" : "bg-slate-700 hover:bg-slate-600"
                )} onClick={() => { if (liveStatus === 'idle') startLiveListening(); }}>
                  <Mic className="w-12 h-12 text-white" />
                </div>
              </div>
              
              {/* Text Area */}
              <div className="text-center space-y-6 w-full">
                <h3 className="text-2xl font-bold text-white">
                  {liveStatus === 'listening' ? "Đang nghe..." :
                   liveStatus === 'thinking' ? "Đang suy nghĩ..." :
                   liveStatus === 'speaking' ? "Đang trả lời..." : "Chạm vào Micro để nói"}
                </h3>
                
                <div className="h-32 relative flex flex-col items-center justify-center">
                  <AnimatePresence mode="wait">
                    {liveTranscript && liveStatus !== 'speaking' && (
                      <motion.p key="transcript" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-xl text-slate-300 italic">
                        "{liveTranscript}"
                      </motion.p>
                    )}
                    {liveResponse && liveStatus === 'speaking' && (
                      <motion.p key="response" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-2xl text-white font-medium">
                        {liveResponse}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              
              {/* End Call Button */}
              <button onClick={stopLiveMode} className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white rounded-full font-bold shadow-[0_0_20px_rgba(220,38,38,0.4)] flex items-center gap-3 transition-all hover:scale-105">
                <PhoneOff className="w-5 h-5" /> Kết thúc cuộc gọi
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
