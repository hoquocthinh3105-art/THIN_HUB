import { useState, useEffect, createContext, useContext, useMemo, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, Link, useLocation } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UserCircle,
  LayoutDashboard, 
  Users, 
  BookOpen, 
  Palette, 
  Bell, 
  BellRing,
  Settings, 
  LogOut, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Upload, 
  FileText, 
  Send, 
  Plus, 
  Menu, 
  X, 
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  GraduationCap,
  BrainCircuit,
  BarChart as BarChartIcon,
  TrendingUp,
  FileBarChart,
  MessageSquare,
  Camera,
  Smile,
  Sparkles,
  Search,
  Paperclip,
  File,
  Calendar,
  ShieldCheck,
  Download,
  ShieldAlert,
  FileCheck,
  Printer,
  Trash2,
  Mic,
  Copy,
  RotateCcw,
  Bookmark,
  Crown,
  Play,
  Pause,
  RotateCw,
  Timer,
  Layers,
  Zap,
  Target
} from 'lucide-react';
import { cn } from './lib/utils';
import { Logo } from './components/Logo';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  LineChart,
  Line
} from 'recharts';
import { format, subDays, isSameDay, startOfToday, eachDayOfInterval, startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';
import { User, Role, Attendance, Material, Assignment, Submission, Announcement, LeaveRequest, TimetableSlot } from './types';
import { GoogleGenAI, Type } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import * as XLSX from 'xlsx';

// --- Constants ---
export const parseSQLiteDate = (dateStr: string | Date | undefined | null) => {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  if (typeof dateStr === 'string') {
    if (dateStr.includes('Z') || dateStr.includes('T')) return new Date(dateStr);
    return new Date(dateStr.replace(' ', 'T') + 'Z');
  }
  return new Date(dateStr);
};

const THEMES = [
  { id: 'default', name: 'Mặc định (Cyan)', color: '#22d3ee', glow: 'rgba(34, 211, 238, 0.4)', bg: 'bg-slate-950' },
  { id: 'winter', name: 'Mùa đông (Blue)', color: '#60a5fa', glow: 'rgba(96, 165, 250, 0.4)', bg: 'bg-blue-950' },
  { id: 'summer', name: 'Mùa hè (Orange)', color: '#fb923c', glow: 'rgba(251, 146, 60, 0.4)', bg: 'bg-orange-950' },
  { id: 'vibrant', name: 'Sôi động (Pink)', color: '#f472b6', glow: 'rgba(244, 114, 182, 0.4)', bg: 'bg-pink-950' },
  { id: 'noel', name: 'Noel (Red)', color: '#ef4444', glow: 'rgba(239, 68, 68, 0.4)', bg: 'bg-red-950' },
  { id: 'personality', name: 'Cá tính (Gold)', color: '#fbbf24', glow: 'rgba(251, 191, 36, 0.4)', bg: 'bg-stone-950' },
];

// --- Context ---
const AuthContext = createContext<{
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
} | null>(null);

const ThemeContext = createContext<{
  primaryColor: string;
  fontFamily: string;
  themeId: string;
  setPrimaryColor: (color: string) => void;
  setFontFamily: (font: string) => void;
  setThemeId: (id: string) => void;
} | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};

const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [themeId, setThemeId] = useState(() => localStorage.getItem('themeId') || 'default');
  const [primaryColor, setPrimaryColor] = useState(() => localStorage.getItem('primaryColor') || '#22d3ee');
  const [fontFamily, setFontFamily] = useState(() => localStorage.getItem('fontFamily') || 'Inter');

  useEffect(() => {
    const theme = THEMES.find(t => t.id === themeId) || THEMES[0];
    document.documentElement.style.setProperty('--primary-color', theme.color);
    document.documentElement.style.setProperty('--primary-glow', theme.glow);
    document.documentElement.style.setProperty('--app-font', fontFamily);
    
    // Apply background class to body
    document.body.className = `${theme.bg} text-slate-200 antialiased`;
    
    localStorage.setItem('themeId', themeId);
    localStorage.setItem('primaryColor', theme.color);
    localStorage.setItem('fontFamily', fontFamily);
  }, [themeId, fontFamily]);

  return (
    <ThemeContext.Provider value={{ primaryColor, fontFamily, themeId, setPrimaryColor, setFontFamily, setThemeId }}>
      {children}
    </ThemeContext.Provider>
  );
};

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// --- Components ---

const StandardSidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { icon: LayoutDashboard, label: 'Tổng quan', path: '/' },
    { icon: Timer, label: 'Góc tập trung', path: '/focus' },
    { icon: Layers, label: 'Thẻ ghi nhớ', path: '/flashcards' },
    { icon: Calendar, label: 'Thời khóa biểu', path: '/timetable' },
    { icon: BrainCircuit, label: 'ThinAI', path: '/ai-assistant' },
    { icon: Mic, label: 'ThinAI Live', path: '/thinai-live' },
    { icon: Sparkles, label: 'Lộ trình AI', path: '/ai-study-plan' },
    { icon: MessageSquare, label: 'Chat', path: '/chat' },
    { icon: Bell, label: 'Bảng tin', path: '/announcements' },
    { icon: BellRing, label: 'Thông báo', path: '/notifications' },
    { icon: Users, label: 'Nề nếp', path: '/attendance' },
    { icon: ShieldAlert, label: 'Xin về', path: '/leave' },
    { icon: GraduationCap, label: 'Bài tập', path: '/assignments' },
    { icon: BookOpen, label: 'Thư viện', path: '/library' },
    { icon: Palette, label: 'Showcase', path: '/showcase' },
    { icon: FileBarChart, label: 'Báo cáo', path: '/reports' },
    ...(user?.role === 'teacher' || user?.role === 'officer' ? [{ icon: UserCircle, label: 'Danh sách lớp', path: '/class-list' }] : []),
    { icon: Crown, label: 'Nâng cấp Pro', path: '/premium' },
    { icon: Settings, label: 'Cài đặt', path: '/settings' },
  ];

  return (
    <div className="fixed left-0 top-0 h-screen w-64 z-50 bg-slate-900/80 backdrop-blur-3xl border-r border-white/5 flex flex-col shadow-[20px_0_50px_rgba(0,0,0,0.3)] overflow-hidden">
      <div className="p-6 flex items-center gap-3 border-b border-white/5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(var(--color-primary),0.4)]">
          <Logo className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500 tracking-tight">THIN_HUB</h1>
          <span className="text-[10px] font-bold text-primary/80 uppercase tracking-widest">Ecosystem 4.0</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar py-6 px-4 space-y-1">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.label}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-medium text-sm",
                isActive 
                  ? "bg-primary/10 text-primary shadow-[0_0_15px_rgba(var(--color-primary),0.1)]" 
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive && "drop-shadow-[0_0_8px_rgba(var(--color-primary),0.5)]")} />
              {item.label}
              {isActive && (
                <motion.div
                  layoutId="std-sidebar-active"
                  className="absolute left-0 w-1 h-8 bg-primary rounded-r-full shadow-[0_0_10px_rgba(var(--color-primary),0.5)]"
                />
              )}
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-white/5 bg-slate-900/50">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
            <UserCircle className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-200 truncate">{user?.full_name}</p>
            <p className="text-xs text-primary/80 truncate">Cấp độ {user?.level || 1} • {user?.xp || 0} XP</p>
          </div>
        </div>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all text-sm font-bold border border-transparent hover:border-red-500/20"
        >
          <LogOut className="w-4 h-4" />
          Đăng xuất
        </button>
      </div>
    </div>
  );
};

const NotificationsBell = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        setNotifications(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 60000); // Check every minute
      return () => clearInterval(interval);
    }
  }, [user]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleRead = async (id: number, type: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      fetchNotifications();
      setIsOpen(false);
      if (type === 'attendance_reminder') {
        navigate('/attendance');
      } else if (type === 'attendance_verify') {
        navigate('/attendance');
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="relative z-50">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-3 bg-slate-900/50 border border-slate-800 rounded-2xl hover:bg-slate-800 transition-all text-slate-300 hover:text-white"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-900"></span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute top-full right-0 mt-2 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <h3 className="font-bold text-white">Thông báo</h3>
              <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">{unreadCount} mới</span>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p>Không có thông báo nào</p>
                </div>
              ) : (
                notifications.map(notif => (
                  <div 
                    key={notif.id} 
                    onClick={() => handleRead(notif.id, notif.type)}
                    className={cn(
                      "p-4 border-b border-slate-800/50 cursor-pointer transition-all hover:bg-slate-800/50",
                      !notif.is_read ? "bg-primary/5" : ""
                    )}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h4 className={cn("font-medium", !notif.is_read ? "text-primary" : "text-slate-300")}>
                        {notif.title}
                      </h4>
                      {!notif.is_read && <span className="w-2 h-2 bg-primary rounded-full mt-1.5"></span>}
                    </div>
                    <div className="text-sm text-slate-400 prose prose-invert prose-sm max-w-none prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
                      <ReactMarkdown>{notif.content}</ReactMarkdown>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      {parseSQLiteDate(notif.created_at).toLocaleString('vi-VN')}
                    </p>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const NotificationCenterPage = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        setNotifications(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleRead = async (id: number, type: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      fetchNotifications();
      if (type === 'attendance_reminder' || type === 'attendance_verify') {
        navigate('/attendance');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'all') return true;
    if (activeTab === 'unread') return !n.is_read;
    return n.type === activeTab;
  });

  const tabs = [
    { id: 'all', label: 'Tất cả' },
    { id: 'unread', label: 'Chưa đọc' },
    { id: 'attendance_reminder', label: 'Học tập & Nề nếp' },
    { id: 'attendance_report', label: 'Báo cáo' },
    { id: 'general', label: 'Chung' }
  ];

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Trung tâm thông báo</h2>
          <p className="text-slate-400">Quản lý tất cả thông báo từ hệ thống.</p>
        </div>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-all",
              activeTab === tab.id 
                ? "bg-primary text-white shadow-[0_0_15px_var(--color-primary-glow)]" 
                : "bg-slate-900/50 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-slate-900/30 border border-slate-800 rounded-3xl overflow-hidden">
        {filteredNotifications.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Bell className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg">Không có thông báo nào trong mục này.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {filteredNotifications.map(notif => (
              <motion.div 
                key={notif.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => handleRead(notif.id, notif.type)}
                className={cn(
                  "p-6 cursor-pointer transition-all hover:bg-slate-800/50 flex gap-4 items-start",
                  !notif.is_read ? "bg-primary/5" : ""
                )}
              >
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                  !notif.is_read ? "bg-primary/20 text-primary" : "bg-slate-800 text-slate-400"
                )}>
                  <Bell className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className={cn("text-lg font-bold", !notif.is_read ? "text-primary" : "text-slate-200")}>
                      {notif.title}
                    </h4>
                    <span className="text-xs font-medium text-slate-500 whitespace-nowrap ml-4">
                      {parseSQLiteDate(notif.created_at).toLocaleString('vi-VN')}
                    </span>
                  </div>
                  <div className="text-slate-400 prose prose-invert max-w-none prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
                    <ReactMarkdown>{notif.content}</ReactMarkdown>
                  </div>
                </div>
                {!notif.is_read && (
                  <div className="w-3 h-3 bg-primary rounded-full shrink-0 mt-2 shadow-[0_0_10px_var(--color-primary-glow)]"></div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const ProSidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { icon: LayoutDashboard, label: 'Tổng quan', path: '/' },
    { icon: Timer, label: 'Góc tập trung', path: '/focus' },
    { icon: Layers, label: 'Thẻ ghi nhớ', path: '/flashcards' },
    { icon: Calendar, label: 'Thời khóa biểu', path: '/timetable' },
    { icon: BrainCircuit, label: 'ThinAI', path: '/ai-assistant' },
    { icon: Mic, label: 'ThinAI Live', path: '/thinai-live' },
    { icon: Sparkles, label: 'Lộ trình AI', path: '/ai-study-plan' },
    { icon: MessageSquare, label: 'Chat', path: '/chat' },
    { icon: Bell, label: 'Bảng tin', path: '/announcements' },
    { icon: BellRing, label: 'Thông báo', path: '/notifications' },
    { icon: Users, label: 'Nề nếp', path: '/attendance' },
    { icon: ShieldAlert, label: 'Xin về', path: '/leave' },
    { icon: GraduationCap, label: 'Bài tập', path: '/assignments' },
    { icon: BookOpen, label: 'Thư viện', path: '/library' },
    { icon: Palette, label: 'Showcase', path: '/showcase' },
    { icon: FileBarChart, label: 'Báo cáo', path: '/reports' },
    ...(user?.role === 'teacher' || user?.role === 'officer' ? [{ icon: UserCircle, label: 'Danh sách lớp', path: '/class-list' }] : []),
    { icon: Crown, label: 'Gói Pro', path: '/premium' },
    { icon: Settings, label: 'Cài đặt', path: '/settings' },
  ];

  return (
    <div className="fixed left-0 top-0 h-screen w-64 z-50 bg-slate-950 border-r border-amber-500/20 flex flex-col shadow-[20px_0_50px_rgba(0,0,0,0.5)] overflow-hidden">
      <div className="p-6 flex items-center gap-3 border-b border-amber-500/10">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-[0_0_15px_rgba(251,191,36,0.4)]">
          <Crown className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 tracking-tight">THIN_HUB</h1>
          <span className="text-[10px] font-bold text-amber-500/80 uppercase tracking-widest">Pro Edition</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar py-6 px-4 space-y-1">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.label}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-medium text-sm",
                isActive 
                  ? "bg-gradient-to-r from-amber-500/20 to-orange-600/5 text-amber-400 border border-amber-500/30 shadow-[0_0_15px_rgba(251,191,36,0.1)]" 
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive && "drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]")} />
              {item.label}
              {isActive && (
                <motion.div
                  layoutId="pro-sidebar-active"
                  className="absolute left-0 w-1 h-8 bg-gradient-to-b from-amber-400 to-orange-500 rounded-r-full shadow-[0_0_10px_rgba(251,191,36,0.5)]"
                />
              )}
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-amber-500/10 bg-slate-900/50">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
            <UserCircle className="w-6 h-6 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-200 truncate">{user?.full_name}</p>
            <p className="text-xs text-amber-500/80 truncate">{user?.role === 'teacher' ? 'Giáo viên (Pro)' : 'Học sinh (Pro)'}</p>
          </div>
        </div>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all text-sm font-bold border border-transparent hover:border-red-500/20"
        >
          <LogOut className="w-4 h-4" />
          Đăng xuất
        </button>
      </div>
    </div>
  );
};

const ProLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col relative pl-64 transition-all duration-1000">
      {/* Pro Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none no-print">
        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-amber-500/5 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[20%] w-[40%] h-[40%] bg-orange-600/5 blur-[120px] rounded-full" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.02]" />
      </div>
      
      <div className="fixed top-0 left-64 right-0 h-20 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-amber-500/10 flex items-center justify-between px-10 no-print">
        <div className="flex items-center gap-4">
          <div className="px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-amber-400 tracking-wider">PRO MEMBER</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <NotificationsBell />
        </div>
      </div>

      <main className="flex-1 relative z-10 mt-20">
        <div className="p-6 md:p-10 max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      <div className="no-print">
        <ProSidebar />
      </div>
    </div>
  );
};

const StandardLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen text-slate-200 flex flex-col relative pl-64 transition-all duration-1000">
      {/* Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none no-print">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/5 blur-[120px] rounded-full" />
      </div>
      
      <div className="fixed top-0 left-64 right-0 h-20 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-end px-10 no-print">
        <div className="flex items-center gap-6">
          <NotificationsBell />
        </div>
      </div>

      <main className="flex-1 relative z-10 mt-20">
        <div className="p-6 md:p-10 max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      <div className="no-print">
        <StandardSidebar />
      </div>
    </div>
  );
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const isPro = user?.role === 'teacher' || user?.is_pro;

  if (isPro) {
    return <ProLayout>{children}</ProLayout>;
  }
  return <StandardLayout>{children}</StandardLayout>;
};

const Dashboard = () => {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [timetableSlots, setTimetableSlots] = useState<TimetableSlot[]>([]);
  const [stats, setStats] = useState({
    attendance: 0,
    assignments: 0,
    submissions: 0
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };

    Promise.all([
      fetch('/api/announcements', { headers }).then(res => res.json()),
      fetch('/api/attendance', { headers }).then(res => res.json()),
      fetch('/api/assignments', { headers }).then(res => res.json()),
      fetch('/api/submissions', { headers }).then(res => res.json()),
      fetch('/api/timetable-slots', { headers }).then(res => res.json())
    ]).then(([annData, attData, assData, subData, slotData]) => {
      setAnnouncements(annData);
      setTimetableSlots(slotData);
      
      // Basic stats calculation
      const today = new Date().toISOString().split('T')[0];
      const todayAtt = attData.filter((a: any) => a.date === today && a.status === 'present').length;
      
      setStats({
        attendance: todayAtt,
        assignments: assData.length,
        submissions: subData.filter((s: any) => s.student_id === user?.id).length
      });
    });
  }, [user]);

  const currentSlot = useMemo(() => {
    const now = new Date();
    const currentTime = format(now, 'HH:mm');
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // 1-7 (Mon-Sun)
    
    return timetableSlots.find(slot => 
      slot.day_of_week === dayOfWeek && 
      currentTime >= slot.start_time && 
      currentTime <= slot.end_time
    );
  }, [timetableSlots]);

  const isPro = user?.role === 'teacher' || user?.is_pro;

  return (
    <div className="space-y-10">
      {/* Website Name Center */}
      <div className="flex flex-col items-center justify-center py-20 relative">
        <div className={cn("absolute inset-0 pointer-events-none", isPro ? "bg-gradient-to-b from-amber-500/5 to-transparent" : "bg-gradient-to-b from-primary/5 to-transparent")} />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="relative text-center flex flex-col items-center"
        >
          <div className={cn("absolute -inset-20 blur-[100px] rounded-full animate-pulse", isPro ? "bg-amber-500/10" : "bg-primary/10")} />
          <Logo className={cn("w-48 h-48 md:w-64 md:h-64 mb-8 relative z-10", isPro ? "drop-shadow-[0_0_30px_rgba(251,191,36,0.5)]" : "drop-shadow-[0_0_30px_rgba(var(--color-primary),0.5)]")} />
          <h1 className="text-6xl md:text-[8rem] font-black text-white tracking-tighter relative z-10 leading-none">
            THIN<span className={cn("text-transparent bg-clip-text", isPro ? "bg-gradient-to-b from-amber-400 to-orange-600 drop-shadow-[0_0_50px_rgba(251,191,36,0.3)]" : "bg-gradient-to-b from-primary to-blue-600 drop-shadow-[0_0_50px_rgba(var(--color-primary),0.3)]")}>HUB</span>
          </h1>
          <div className="flex items-center justify-center gap-6 mt-6 relative z-10">
            <div className="h-[2px] w-16 bg-gradient-to-r from-transparent to-slate-700" />
            <span className={cn("font-black tracking-[1em] uppercase text-sm ml-4", isPro ? "text-amber-500" : "text-slate-400")}>
              {isPro ? 'Pro Edition' : 'Ecosystem 4.0'}
            </span>
            <div className="h-[2px] w-16 bg-gradient-to-l from-transparent to-slate-700" />
          </div>
        </motion.div>
      </div>

      {/* Welcome Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-bold text-white tracking-tight mb-2">
            Xin chào, <span className={isPro ? "text-amber-400" : "text-primary"}>{user?.full_name}</span>
          </h2>
          <div className="flex flex-wrap items-center gap-4 text-slate-400 text-lg">
            <p>Hôm nay là {format(new Date(), 'EEEE, dd MMMM yyyy')}.</p>
            <span className={cn("flex items-center gap-1.5 font-bold", isPro ? "text-amber-400/80" : "text-primary/80")}>
              <GraduationCap className="w-5 h-5" /> {user?.school_name || 'Trường học'}
            </span>
          </div>
        </div>
        <div className={cn("flex items-center gap-4 p-2 rounded-2xl backdrop-blur-md border", isPro ? "bg-amber-950/30 border-amber-500/20" : "bg-slate-900/50 border-white/5")}>
          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", isPro ? "bg-amber-500/20 text-amber-400" : "bg-cyan-500/10 text-cyan-400")}>
            {isPro ? <Crown className="w-7 h-7" /> : <UserCircle className="w-7 h-7" />}
          </div>
          <div className="pr-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Vai trò</p>
            <p className={cn("text-sm font-bold", isPro ? "text-amber-400" : "text-white")}>
              {user?.role === 'teacher' ? 'Giáo viên (Pro)' : user?.role === 'officer' ? 'Ban cán sự' : isPro ? 'Học sinh (Pro)' : 'Học sinh'}
            </p>
          </div>
        </div>
      </header>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className={cn("p-6 rounded-3xl backdrop-blur-md transition-all group", isPro ? "bg-amber-950/20 border border-amber-500/20 hover:border-amber-500/50" : "bg-slate-900/40 border border-white/5 hover:border-cyan-500/30")}>
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-400 group-hover:scale-110 transition-transform">
              <CheckCircle className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-green-400 bg-green-400/10 px-2 py-1 rounded-lg">Hôm nay</span>
          </div>
          <p className="text-3xl font-bold text-white mb-1">{stats.attendance}</p>
          <p className="text-sm text-slate-500 font-medium">Bạn học hiện diện</p>
        </div>

        <div className={cn("p-6 rounded-3xl backdrop-blur-md transition-all group", isPro ? "bg-amber-950/20 border border-amber-500/20 hover:border-amber-500/50" : "bg-slate-900/40 border border-white/5 hover:border-blue-500/30")}>
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
              <BookOpen className="w-6 h-6" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white mb-1">{stats.assignments}</p>
          <p className="text-sm text-slate-500 font-medium">Bài tập đang mở</p>
        </div>

        <div className={cn("p-6 rounded-3xl backdrop-blur-md transition-all group", isPro ? "bg-amber-950/20 border border-amber-500/20 hover:border-amber-500/50" : "bg-slate-900/40 border border-white/5 hover:border-purple-500/30")}>
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
              <Upload className="w-6 h-6" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white mb-1">{stats.submissions}</p>
          <p className="text-sm text-slate-500 font-medium">Bài đã nộp</p>
        </div>

        <div className={cn("p-6 rounded-3xl backdrop-blur-md transition-all group", isPro ? "bg-amber-950/20 border border-amber-500/20 hover:border-amber-500/50" : "bg-slate-900/40 border border-white/5 hover:border-orange-500/30")}>
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-400 group-hover:scale-110 transition-transform">
              <Bell className="w-6 h-6" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white mb-1">{announcements.length}</p>
          <p className="text-sm text-slate-500 font-medium">Thông báo mới</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-8">
          {/* Quick Actions */}
          <section className="space-y-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-cyan-400" /> Thao tác nhanh
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Link to="/assignments" className="p-4 rounded-2xl bg-slate-900/30 border border-white/5 hover:bg-slate-800/50 transition-all flex flex-col items-center text-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                  <Upload className="w-5 h-5" />
                </div>
                <span className="text-sm font-bold text-slate-300">Nộp bài tập</span>
              </Link>
              <Link to="/attendance" className="p-4 rounded-2xl bg-slate-900/30 border border-white/5 hover:bg-slate-800/50 transition-all flex flex-col items-center text-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-sm font-bold text-slate-300">Điểm danh</span>
              </Link>
              <Link to="/library" className="p-4 rounded-2xl bg-slate-900/30 border border-white/5 hover:bg-slate-800/50 transition-all flex flex-col items-center text-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                  <BookOpen className="w-5 h-5" />
                </div>
                <span className="text-sm font-bold text-slate-300">Tài liệu</span>
              </Link>
              <Link to="/timetable" className="p-4 rounded-2xl bg-slate-900/30 border border-white/5 hover:bg-slate-800/50 transition-all flex flex-col items-center text-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400">
                  <Calendar className="w-5 h-5" />
                </div>
                <span className="text-sm font-bold text-slate-300">Lịch học</span>
              </Link>
              {(user?.role === 'teacher' || user?.role === 'officer') && (
                <Link to="/class-list" className="p-4 rounded-2xl bg-slate-900/30 border border-white/5 hover:bg-slate-800/50 transition-all flex flex-col items-center text-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-bold text-slate-300">Danh sách lớp</span>
                </Link>
              )}
            </div>
          </section>

          {/* Announcements */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Bảng tin lớp học</h3>
              <Link to="/announcements" className="text-cyan-400 text-sm font-bold hover:underline">Xem tất cả</Link>
            </div>
            <div className="space-y-4">
              {announcements.slice(0, 3).map((ann) => (
                <motion.div 
                  key={ann.id} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-5 rounded-3xl bg-slate-900/30 border border-white/5 hover:border-white/10 transition-all flex gap-5"
                >
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 flex-shrink-0 flex items-center justify-center text-slate-400">
                    <Bell className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-bold text-slate-200 truncate">{ann.title}</h4>
                      <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-800 px-2 py-0.5 rounded-full">
                        {format(parseSQLiteDate(ann.created_at), 'dd/MM')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">{ann.content}</p>
                  </div>
                </motion.div>
              ))}
              {announcements.length === 0 && (
                <div className="p-10 text-center rounded-3xl border border-dashed border-slate-800">
                  <p className="text-slate-500 font-medium">Chưa có thông báo nào mới.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Sidebar Area */}
        <div className="space-y-8">
          {/* Calendar / Schedule Placeholder */}
          <section className="p-6 rounded-3xl bg-slate-900/40 border border-white/5 backdrop-blur-md">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-400" /> Tiết học hiện tại
            </h3>
            {currentSlot ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 shadow-[0_0_20px_rgba(34,211,238,0.1)]"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2 py-1 rounded bg-cyan-500 text-[10px] font-black text-white uppercase">Tiết {currentSlot.period}</span>
                  <span className="text-xs font-bold text-cyan-400">{currentSlot.start_time} - {currentSlot.end_time}</span>
                </div>
                <h4 className="text-xl font-black text-white mb-1">{currentSlot.subject}</h4>
                <p className="text-sm text-slate-400 font-bold">GV: {currentSlot.teacher_name}</p>
              </motion.div>
            ) : (
              <div className="p-10 text-center rounded-2xl border border-dashed border-slate-800">
                <p className="text-slate-500 font-medium">Hiện không có tiết học nào.</p>
              </div>
            )}
            
            <div className="mt-6 space-y-4">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tiết tiếp theo</h4>
              {timetableSlots
                .filter(s => {
                  const now = new Date();
                  const currentTime = format(now, 'HH:mm');
                  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
                  return s.day_of_week === dayOfWeek && s.start_time > currentTime;
                })
                .slice(0, 2)
                .map((item, i) => (
                  <div key={i} className="flex items-center gap-4 group">
                    <div className="text-xs font-bold text-slate-500 w-12">{item.start_time}</div>
                    <div className="flex-1 p-3 rounded-2xl bg-white/5 border border-transparent group-hover:border-white/10 transition-all">
                      <p className="text-sm font-bold text-slate-200">{item.subject}</p>
                      <p className="text-[10px] text-slate-500 uppercase">{item.teacher_name}</p>
                    </div>
                  </div>
                ))}
            </div>
          </section>

          {/* AI Assistant Promo */}
          <section className={cn("p-6 rounded-3xl border relative overflow-hidden group", isPro ? "bg-gradient-to-br from-amber-500/20 to-orange-600/20 border-amber-500/30" : "bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border-cyan-500/20")}>
            <div className="relative z-10">
              <BrainCircuit className={cn("w-10 h-10 mb-4 group-hover:scale-110 transition-transform", isPro ? "text-amber-400" : "text-cyan-400")} />
              <h3 className="text-lg font-bold text-white mb-2">ThinAI Hub {isPro && <span className="text-amber-400 text-sm ml-2">PRO</span>}</h3>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                {isPro ? "Tận hưởng sức mạnh AI không giới hạn. Phân tích chuyên sâu và giải bài tập tức thì." : "Sử dụng ThinAI để giải bài tập, tóm tắt kiến thức và lập lộ trình ôn thi hiệu quả nhất."}
              </p>
              <Link to="/ai-assistant" className={cn("inline-flex items-center px-4 py-2 text-slate-950 text-xs font-bold rounded-xl transition-colors", isPro ? "bg-amber-400 hover:bg-amber-300" : "bg-white hover:bg-cyan-400")}>
                Thử ngay
              </Link>
            </div>
            <div className={cn("absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 blur-3xl rounded-full", isPro ? "bg-amber-400/20" : "bg-cyan-400/10")} />
          </section>
        </div>
      </div>
    </div>
  );
};

const AttendancePage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'attendance' | 'discipline'>('attendance');
  const [students, setStudents] = useState<User[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [disciplineRecords, setDisciplineRecords] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [markingData, setMarkingData] = useState<{ studentId: number; status: string } | null>(null);
  const [addingDiscipline, setAddingDiscipline] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [disciplinePoints, setDisciplinePoints] = useState(0);
  const [showChart, setShowChart] = useState(false);

  const fetchAttendance = () => {
    const token = localStorage.getItem('token');
    fetch('/api/attendance', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(setAttendance);
  };

  const fetchDiscipline = () => {
    const token = localStorage.getItem('token');
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    fetch(`/api/discipline?week_start_date=${weekStart}`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(setDisciplineRecords);
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setStudents(data.filter((s: User) => s.role === 'student' || s.role === 'officer')));
    
    fetchAttendance();
    fetchDiscipline();
  }, []);

  const chartData = useMemo(() => {
    const today = startOfToday();
    const last7Days = eachDayOfInterval({
      start: subDays(today, 6),
      end: today,
    });

    return last7Days.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayRecords = attendance.filter(a => a.date === dateStr);
      
      return {
        name: format(date, 'dd/MM'),
        'Hiện diện': dayRecords.filter(a => a.status === 'present').length,
        'Vắng mặt': dayRecords.filter(a => a.status.startsWith('absent')).length,
        'Đi trễ': dayRecords.filter(a => a.status === 'late').length,
      };
    });
  }, [attendance]);

  const handleMark = async (studentId: number, status: string, finalNote: string = '') => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ student_id: studentId, date: selectedDate, status, note: finalNote })
    });
    if (res.ok) {
      toast.success('Đã cập nhật nề nếp');
      setMarkingData(null);
      setNote('');
      fetchAttendance();
    }
  };

  const handleSelfMark = async (status: string, finalNote: string = '') => {
    const token = localStorage.getItem('token');
    
    // Optional: Get location
    let location_lat = null;
    let location_lng = null;
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
      });
      location_lat = position.coords.latitude;
      location_lng = position.coords.longitude;
    } catch (e) {
      console.warn("Could not get location", e);
    }

    const res = await fetch('/api/attendance/self', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status, note: finalNote, location_lat, location_lng })
    });
    const data = await res.json();
    if (res.ok) {
      toast.success('Đã điểm danh thành công');
      setMarkingData(null);
      setNote('');
      fetchAttendance();
    } else {
      toast.error(data.error || 'Có lỗi xảy ra');
    }
  };

  const handleVerify = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/attendance/verify', {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ date: selectedDate })
    });
    if (res.ok) {
      toast.success('Đã chốt danh sách điểm danh');
      fetchAttendance();
    }
  };

  const handleAddDiscipline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingDiscipline) return;
    
    const token = localStorage.getItem('token');
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    
    const res = await fetch('/api/discipline', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        student_id: addingDiscipline, 
        week_start_date: weekStart, 
        points: disciplinePoints, 
        reason: note 
      })
    });
    
    if (res.ok) {
      toast.success('Đã thêm điểm thi đua');
      setAddingDiscipline(null);
      setNote('');
      setDisciplinePoints(0);
      fetchDiscipline();
    }
  };

  const getAttendanceRecord = (studentId: number) => {
    return attendance.find(a => a.student_id === studentId && a.date === selectedDate);
  };

  const calculateWeeklyScore = (studentId: number) => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
    
    // Calculate attendance deductions
    const studentAttendance = attendance.filter(a => {
      const date = parseISO(a.date);
      return a.student_id === studentId && isWithinInterval(date, { start: weekStart, end: weekEnd });
    });
    
    let attendanceDeductions = 0;
    studentAttendance.forEach(a => {
      if (a.status === 'late') attendanceDeductions -= 2;
      if (a.status === 'absent_permission') attendanceDeductions -= 1;
      if (a.status === 'absent_no_permission') attendanceDeductions -= 5;
    });
    
    // Calculate discipline points
    const studentDiscipline = disciplineRecords.filter(d => d.student_id === studentId);
    const disciplinePoints = studentDiscipline.reduce((sum, d) => sum + d.points, 0);
    
    const totalScore = 10 + attendanceDeductions + disciplinePoints;
    
    let rank = '';
    if (totalScore >= 8) rank = 'Tốt';
    else if (totalScore >= 5) rank = 'Khá';
    else rank = 'Trung bình/Yếu';
    
    return { score: totalScore, rank, attendanceDeductions, disciplinePoints };
  };

  const onMarkClick = (studentId: number, status: string) => {
    if (status.startsWith('absent') || status === 'late') {
      setMarkingData({ studentId, status });
      setNote('');
    } else {
      if (user?.role === 'student') {
        handleSelfMark(status);
      } else {
        handleMark(studentId, status);
      }
    }
  };

  const exportToExcel = () => {
    const headers = ['Học sinh', 'ID', 'Trạng thái', 'Ghi chú', 'Ngày'];
    const statusMap = { 
      present: 'Hiện diện', 
      absent_permission: 'Vắng có phép', 
      absent_no_permission: 'Vắng không phép', 
      late: 'Đi trễ' 
    };
    
    const rows = students.map(student => {
      const record = getAttendanceRecord(student.id);
      return {
        'Học sinh': student.full_name,
        'ID': student.id,
        'Trạng thái': record ? statusMap[record.status as keyof typeof statusMap] || record.status : 'Chưa điểm danh',
        'Ghi chú': record?.note || '',
        'Ngày': selectedDate
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Điểm danh");
    XLSX.writeFile(workbook, `DiemDanh_${user?.class_name}_${selectedDate}.xlsx`);
    toast.success('Đã xuất báo cáo Excel');
  };

  const isVerifiedToday = attendance.some(a => a.date === selectedDate && a.is_verified === 1);
  const myRecord = user?.role === 'student' ? getAttendanceRecord(user.id) : null;

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Quản lý nề nếp & Thi đua</h2>
          <p className="text-slate-400">Điểm danh và theo dõi thi đua lớp {user?.class_name}.</p>
        </div>
        <div className="flex items-center gap-3">
          {(user?.role === 'teacher' || user?.role === 'officer') && (
            <button 
              onClick={exportToExcel}
              className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 hover:text-primary transition-all flex items-center gap-2"
            >
              <Upload className="w-4 h-4" /> <span className="hidden sm:inline">Xuất Excel</span>
            </button>
          )}
          <button 
            onClick={() => setShowChart(!showChart)}
            className={cn(
              "p-2 rounded-xl border transition-all flex items-center gap-2 font-medium",
              showChart 
                ? "bg-primary/20 border-primary text-primary" 
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
            )}
          >
            <BarChartIcon className="w-5 h-5" />
            <span className="hidden sm:inline">{showChart ? 'Ẩn biểu đồ' : 'Xem biểu đồ'}</span>
          </button>
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-slate-900 border border-primary/30 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary"
          />
        </div>
      </header>

      <div className="flex gap-2 border-b border-slate-800 pb-px">
        <button
          onClick={() => setActiveTab('attendance')}
          className={cn(
            "px-6 py-3 font-bold text-sm transition-all border-b-2",
            activeTab === 'attendance' 
              ? "border-primary text-primary" 
              : "border-transparent text-slate-500 hover:text-slate-300"
          )}
        >
          Điểm danh
        </button>
        <button
          onClick={() => setActiveTab('discipline')}
          className={cn(
            "px-6 py-3 font-bold text-sm transition-all border-b-2",
            activeTab === 'discipline' 
              ? "border-primary text-primary" 
              : "border-transparent text-slate-500 hover:text-slate-300"
          )}
        >
          Thi đua tuần
        </button>
      </div>

      {activeTab === 'attendance' ? (
        <>
          <AnimatePresence>
        {showChart && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-6 rounded-3xl bg-slate-900/50 border border-slate-800 backdrop-blur-md">
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold text-white">Thống kê nề nếp 7 ngày qua</h3>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      stroke="#64748b" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <YAxis 
                      stroke="#64748b" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#0f172a', 
                        border: '1px solid #1e293b',
                        borderRadius: '12px',
                        color: '#f8fafc'
                      }}
                      itemStyle={{ fontSize: '12px' }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      align="right" 
                      iconType="circle"
                      wrapperStyle={{ paddingBottom: '20px', fontSize: '12px' }}
                    />
                    <Bar dataKey="Hiện diện" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar dataKey="Vắng mặt" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar dataKey="Đi trễ" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {user?.role === 'student' ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 backdrop-blur-sm text-center max-w-2xl mx-auto">
          <h3 className="text-2xl font-bold text-white mb-2">Điểm danh hôm nay</h3>
          <p className="text-slate-400 mb-8">{new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          
          {myRecord ? (
            <div className="space-y-4">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-slate-800 mb-4">
                {myRecord.status === 'present' && <CheckCircle className="w-12 h-12 text-green-500" />}
                {myRecord.status.startsWith('absent') && <XCircle className="w-12 h-12 text-red-500" />}
                {myRecord.status === 'late' && <Clock className="w-12 h-12 text-yellow-500" />}
              </div>
              <h4 className="text-xl font-bold text-white">
                {myRecord.status === 'present' && 'Đã điểm danh: Hiện diện'}
                {myRecord.status === 'absent_permission' && 'Đã điểm danh: Vắng có phép'}
                {myRecord.status === 'absent_no_permission' && 'Đã điểm danh: Vắng không phép'}
                {myRecord.status === 'late' && 'Đã điểm danh: Đi trễ'}
              </h4>
              {myRecord.note && <p className="text-slate-400">Ghi chú: {myRecord.note}</p>}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button 
                onClick={() => onMarkClick(user.id, 'present')}
                className="p-6 rounded-2xl bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 transition-all flex flex-col items-center gap-3 group"
              >
                <CheckCircle className="w-10 h-10 text-green-500 group-hover:scale-110 transition-transform" />
                <span className="font-bold text-green-400">Có mặt</span>
              </button>
              <button 
                onClick={() => onMarkClick(user.id, 'absent_permission')}
                className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all flex flex-col items-center gap-3 group"
              >
                <XCircle className="w-10 h-10 text-red-500 group-hover:scale-110 transition-transform" />
                <span className="font-bold text-red-400">Vắng phép</span>
              </button>
              <button 
                onClick={() => onMarkClick(user.id, 'late')}
                className="p-6 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/20 transition-all flex flex-col items-center gap-3 group"
              >
                <Clock className="w-10 h-10 text-yellow-500 group-hover:scale-110 transition-transform" />
                <span className="font-bold text-yellow-400">Đi trễ</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/80">
            <h3 className="font-bold text-white">Danh sách lớp</h3>
            {user?.role === 'officer' && selectedDate === new Date().toISOString().split('T')[0] && (
              <button 
                onClick={handleVerify}
                disabled={isVerifiedToday}
                className={cn(
                  "px-4 py-2 rounded-xl font-bold transition-all text-sm",
                  isVerifiedToday 
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed" 
                    : "bg-primary text-white shadow-[0_0_15px_var(--color-primary-glow)] hover:scale-105"
                )}
              >
                {isVerifiedToday ? 'Đã chốt danh sách' : 'Chốt danh sách'}
              </button>
            )}
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80">
                <th className="px-6 py-4 text-sm font-semibold text-slate-400">Học sinh</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-400">Trạng thái</th>
                {(user?.role === 'teacher' || user?.role === 'officer') && !isVerifiedToday && (
                  <th className="px-6 py-4 text-sm font-semibold text-slate-400 text-right">Thao tác</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {students.map((student) => {
                const record = getAttendanceRecord(student.id);
                return (
                  <tr key={student.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-200">{student.full_name}</div>
                      <div className="text-xs text-slate-500">ID: {student.id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div>
                          {record?.status === 'present' && <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-medium border border-green-500/20">Hiện diện</span>}
                          {record?.status === 'absent_permission' && <span className="px-3 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-medium border border-red-500/20">Vắng có phép</span>}
                          {record?.status === 'absent_no_permission' && <span className="px-3 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-medium border border-red-500/20">Vắng không phép</span>}
                          {record?.status === 'late' && <span className="px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-400 text-xs font-medium border border-yellow-500/20">Đi trễ</span>}
                          {!record?.status && <span className="text-slate-600 text-xs italic">Chưa điểm danh</span>}
                        </div>
                        {record?.note && (
                          <p className="text-xs text-slate-400 mt-1 italic">Ghi chú: {record.note}</p>
                        )}
                      </div>
                    </td>
                    {(user?.role === 'teacher' || user?.role === 'officer') && !isVerifiedToday && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => onMarkClick(student.id, 'present')} className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-all" title="Hiện diện"><CheckCircle className="w-5 h-5" /></button>
                          <button onClick={() => onMarkClick(student.id, 'absent_permission')} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all" title="Vắng có phép"><XCircle className="w-5 h-5" /></button>
                          <button onClick={() => onMarkClick(student.id, 'absent_no_permission')} className="p-2 rounded-lg bg-red-900/30 text-red-500 hover:bg-red-900/50 transition-all" title="Vắng không phép"><XCircle className="w-5 h-5" /></button>
                          <button onClick={() => onMarkClick(student.id, 'late')} className="p-2 rounded-lg bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-all" title="Đi trễ"><Clock className="w-5 h-5" /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>
        {markingData && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-primary/30 p-8 rounded-3xl w-full max-w-md shadow-[0_0_50px_rgba(var(--color-primary),0.1)]"
            >
              <h3 className="text-xl font-bold text-white mb-4">
                Thêm ghi chú ({
                  markingData.status === 'absent_permission' ? 'Vắng có phép' : 
                  markingData.status === 'absent_no_permission' ? 'Vắng không phép' : 'Đi trễ'
                })
              </h3>
              <p className="text-slate-400 mb-4 text-sm">
                Vui lòng nhập lý do.
              </p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Nhập ghi chú (vd: Ốm, Hỏng xe...)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary mb-6"
                rows={3}
                required
              />
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setMarkingData(null)} 
                  className="px-4 py-2 text-slate-400 hover:text-white transition-all"
                >
                  Hủy
                </button>
                <button 
                  onClick={() => {
                    if (user?.role === 'student') {
                      handleSelfMark(markingData.status, note);
                    } else {
                      handleMark(markingData.studentId, markingData.status, note);
                    }
                  }}
                  className="px-6 py-2 bg-primary text-white font-bold rounded-xl shadow-[0_0_15px_var(--color-primary-glow)]"
                >
                  Xác nhận
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
        </>
      ) : (
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/50 border-b border-slate-800">
                <th className="px-6 py-4 text-slate-400 font-bold text-sm">Học sinh</th>
                <th className="px-6 py-4 text-slate-400 font-bold text-sm">Điểm danh</th>
                <th className="px-6 py-4 text-slate-400 font-bold text-sm">Thi đua khác</th>
                <th className="px-6 py-4 text-slate-400 font-bold text-sm">Tổng điểm</th>
                <th className="px-6 py-4 text-slate-400 font-bold text-sm">Xếp loại</th>
                {(user?.role === 'teacher' || user?.role === 'officer') && (
                  <th className="px-6 py-4 text-right text-slate-400 font-bold text-sm">Thao tác</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {students.map(student => {
                const { score, rank, attendanceDeductions, disciplinePoints } = calculateWeeklyScore(student.id);
                return (
                  <tr key={student.id} className="hover:bg-slate-800/20 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                          {student.full_name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-white font-bold">{student.full_name}</p>
                          <p className="text-xs text-slate-500">{student.position || 'Học sinh'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn("font-bold", attendanceDeductions < 0 ? "text-red-400" : "text-slate-400")}>
                        {attendanceDeductions}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn("font-bold", disciplinePoints < 0 ? "text-red-400" : disciplinePoints > 0 ? "text-green-400" : "text-slate-400")}>
                        {disciplinePoints > 0 ? `+${disciplinePoints}` : disciplinePoints}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xl font-black text-white">{score}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-3 py-1 rounded-xl text-xs font-bold",
                        rank === 'Tốt' ? "bg-green-500/20 text-green-400" :
                        rank === 'Khá' ? "bg-yellow-500/20 text-yellow-400" :
                        "bg-red-500/20 text-red-400"
                      )}>
                        {rank}
                      </span>
                    </td>
                    {(user?.role === 'teacher' || user?.role === 'officer') && (
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => setAddingDiscipline(student.id)}
                          className="px-4 py-2 rounded-lg bg-primary/10 text-primary opacity-0 group-hover:opacity-100 transition-all hover:bg-primary hover:text-white text-xs font-bold"
                        >
                          Thêm điểm
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>
        {addingDiscipline && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-primary/30 p-8 rounded-3xl w-full max-w-md shadow-[0_0_50px_rgba(var(--color-primary),0.1)]"
            >
              <h3 className="text-xl font-bold text-white mb-4">
                Thêm điểm thi đua
              </h3>
              <form onSubmit={handleAddDiscipline}>
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-400 mb-2">Số điểm (có thể âm hoặc dương)</label>
                    <input
                      type="number"
                      value={disciplinePoints}
                      onChange={(e) => setDisciplinePoints(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-400 mb-2">Lý do</label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="vd: Phát biểu xây dựng bài, Không làm bài tập..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                      rows={3}
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <button 
                    type="button"
                    onClick={() => {
                      setAddingDiscipline(null);
                      setNote('');
                      setDisciplinePoints(0);
                    }} 
                    className="px-4 py-2 text-slate-400 hover:text-white transition-all"
                  >
                    Hủy
                  </button>
                  <button 
                    type="submit"
                    className="px-6 py-2 bg-primary text-white font-bold rounded-xl shadow-[0_0_15px_var(--color-primary-glow)]"
                  >
                    Xác nhận
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
const TimetablePage = () => {
  const { user } = useAuth();
  const [timetable, setTimetable] = useState<any>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetch('/api/timetable', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    .then(res => res.json())
    .then(setTimetable);
  }, []);

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const res = await fetch('/api/timetable', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: formData
    });

    if (res.ok) {
      toast.success('Đã cập nhật thời khóa biểu!');
      setIsUpdating(false);
      fetch('/api/timetable', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      .then(res => res.json())
      .then(setTimetable);
    }
  };

  return (
    <div className="space-y-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-white mb-2 tracking-tight uppercase italic">
            Thời khóa <span className="text-cyan-400">biểu</span>
          </h2>
          <p className="text-slate-400">Lịch học tập và giảng dạy của lớp.</p>
        </div>
        {user?.role === 'teacher' && (
          <button 
            onClick={() => setIsUpdating(!isUpdating)}
            className="px-8 py-3 bg-cyan-500 text-white font-black rounded-2xl hover:bg-cyan-400 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(34,211,238,0.3)]"
          >
            <Plus className="w-5 h-5" /> Cập nhật TKB
          </button>
        )}
      </header>

      <AnimatePresence>
        {isUpdating && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-8 rounded-3xl bg-slate-900/50 border border-cyan-500/20 backdrop-blur-md mb-12">
              <form onSubmit={handleUpdate} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ảnh thời khóa biểu mới</label>
                  <input type="file" name="image" accept="image/*" required className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3.5 text-white file:bg-cyan-500 file:border-none file:rounded-lg file:text-white file:font-bold file:px-4 file:py-1 file:mr-4" />
                </div>
                <div className="flex justify-end gap-4">
                  <button type="button" onClick={() => setIsUpdating(false)} className="px-6 py-3 text-slate-400 font-bold">Hủy</button>
                  <button className="px-10 py-3 bg-cyan-500 text-white font-black rounded-xl hover:bg-cyan-400 transition-all">Cập nhật ngay</button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative rounded-[3rem] overflow-hidden border border-white/5 bg-slate-900/40 backdrop-blur-md p-4 md:p-8 min-h-[400px] flex items-center justify-center">
        {timetable ? (
          <div className="space-y-6 w-full">
            <div className="flex items-center justify-between px-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Cập nhật lần cuối</p>
                  <p className="text-sm font-bold text-white">{format(parseSQLiteDate(timetable.updated_at), 'dd/MM/yyyy HH:mm')}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Người cập nhật</p>
                <p className="text-sm font-bold text-cyan-400">{timetable.author_name}</p>
              </div>
            </div>
            <div className="rounded-2xl overflow-hidden border border-white/10">
              <img 
                src={timetable.image_path} 
                alt="Thời khóa biểu" 
                className="w-full h-auto"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        ) : (
          <div className="text-center">
            <Calendar className="w-16 h-16 text-slate-800 mx-auto mb-4" />
            <p className="text-slate-500 font-bold text-xl">Chưa có thời khóa biểu.</p>
            {user?.role === 'teacher' && <p className="text-slate-600 mt-2">Hãy nhấn "Cập nhật TKB" để tải lên ảnh thời khóa biểu mới.</p>}
          </div>
        )}
      </div>
    </div>
  );
};

const LibraryPage = () => {
  const { user } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('Tất cả');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    fetch('/api/materials', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    .then(res => res.json())
    .then(setMaterials);
  }, []);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUploading(true);
    try {
      const formData = new FormData(e.currentTarget);
      const res = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
      });
      if (res.ok) {
        toast.success('Đã đăng tài liệu thành công');
        e.currentTarget.reset();
        setSelectedFile(null);
        fetch('/api/materials', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
        .then(res => res.json())
        .then(setMaterials);
      } else {
        toast.error('Lỗi khi đăng tài liệu');
      }
    } catch (error) {
      toast.error('Có lỗi xảy ra');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (id: number) => {
    try {
      const res = await fetch(`/api/materials/${id}/save`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMaterials(materials.map(m => m.id === id ? { ...m, is_saved: data.is_saved ? 1 : 0 } : m));
        toast.success(data.is_saved ? 'Đã lưu tài liệu' : 'Đã bỏ lưu tài liệu');
      }
    } catch (e) {
      console.error(e);
      toast.error('Có lỗi xảy ra');
    }
  };

  const filteredMaterials = materials.filter(mat => {
    const matchesSearch = mat.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSubject = selectedSubject === 'Tất cả' || mat.subject === selectedSubject;
    const matchesSaved = selectedSubject === 'Đã lưu' ? mat.is_saved === 1 : true;
    
    if (selectedSubject === 'Đã lưu') {
      return matchesSearch && matchesSaved;
    }
    return matchesSearch && matchesSubject;
  });

  const subjects = ['Tất cả', 'Đã lưu', 'Toán', 'Vật Lý', 'Hóa Học', 'Tiếng Anh', 'Khác'];

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Thư viện số</h2>
          <p className="text-slate-400">Kho tài liệu ôn thi THPT Quốc gia được phân loại chuyên nghiệp.</p>
        </div>
      </header>

      {/* Search and Filter Section */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input 
              type="text" 
              placeholder="Tìm kiếm tài liệu, đề thi..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:border-primary transition-all"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
            {subjects.map(subject => (
              <button
                key={subject}
                onClick={() => setSelectedSubject(subject)}
                className={cn(
                  "px-6 py-4 rounded-2xl font-bold whitespace-nowrap transition-all flex items-center gap-2",
                  selectedSubject === subject 
                    ? "bg-primary text-white shadow-[0_0_15px_var(--color-primary-glow)]" 
                    : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                )}
              >
                {subject === 'Đã lưu' && <Bookmark className="w-4 h-4" />}
                {subject}
              </button>
            ))}
          </div>
        </div>
      </div>

      {user?.role === 'teacher' && (
        <section className="p-6 rounded-3xl bg-slate-900/50 border border-primary/20 backdrop-blur-sm">
          <h3 className="text-lg font-bold text-white mb-4">Tải lên tài liệu mới</h3>
          <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input name="title" placeholder="Tiêu đề tài liệu" required className="bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-all" />
            <select name="subject" required className="bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-all">
              <option value="Toán">Toán</option>
              <option value="Vật Lý">Vật Lý</option>
              <option value="Hóa Học">Hóa Học</option>
              <option value="Tiếng Anh">Tiếng Anh</option>
              <option value="Khác">Khác</option>
            </select>
            <div className="md:col-span-2 flex flex-col gap-4">
              <div className="flex items-center justify-center w-full">
                <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-800 border-dashed rounded-2xl cursor-pointer bg-slate-950 hover:bg-slate-900/50 hover:border-primary/50 transition-all">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-3 text-slate-500" />
                    <p className="mb-2 text-sm text-slate-400"><span className="font-bold text-primary">Nhấn để tải lên</span> hoặc kéo thả file vào đây</p>
                    <p className="text-xs text-slate-500">PDF, DOCX, PPTX, XLSX (Tối đa 10MB)</p>
                  </div>
                  <input id="dropzone-file" type="file" name="file" className="hidden" required onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
                </label>
              </div>
              
              {selectedFile && (
                <div className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileText className="w-6 h-6 text-primary shrink-0" />
                    <span className="text-sm text-slate-300 truncate font-medium">{selectedFile.name}</span>
                  </div>
                  <button type="submit" disabled={isUploading} className="shrink-0 px-6 py-2 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-all shadow-[0_0_15px_var(--color-primary-glow)] flex items-center gap-2">
                    {isUploading ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {isUploading ? 'Đang đăng...' : 'Đăng tài liệu'}
                  </button>
                </div>
              )}
            </div>
          </form>
        </section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredMaterials.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>Không tìm thấy tài liệu nào phù hợp.</p>
          </div>
        ) : (
          filteredMaterials.map((mat) => (
            <motion.div 
              key={mat.id}
              whileHover={{ y: -5 }}
              className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800 hover:border-primary/50 transition-all group flex flex-col h-full relative"
            >
              <button 
                onClick={() => handleSave(mat.id)}
                className={cn(
                  "absolute top-6 right-6 p-2 rounded-xl transition-all z-10",
                  mat.is_saved === 1 
                    ? "bg-primary/20 text-primary" 
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                )}
                title={mat.is_saved === 1 ? "Bỏ lưu" : "Lưu tài liệu"}
              >
                <Bookmark className="w-5 h-5" fill={mat.is_saved === 1 ? "currentColor" : "none"} />
              </button>
              <div className="flex items-start justify-between mb-6 pr-12">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <FileText className="w-6 h-6" />
                </div>
                <span className="px-3 py-1 rounded-xl bg-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-wider">{mat.subject}</span>
              </div>
              <h4 className="font-bold text-slate-200 mb-2 group-hover:text-primary transition-colors text-lg line-clamp-2 flex-1">{mat.title}</h4>
              <p className="text-xs font-medium text-slate-500 mb-6">{parseSQLiteDate(mat.created_at).toLocaleDateString('vi-VN')}</p>
              <a 
                href={mat.file_path} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-slate-800 text-slate-300 hover:bg-primary hover:text-white transition-all text-sm font-bold"
              >
                <Upload className="w-4 h-4 rotate-180" /> Tải về
              </a>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

const AssignmentsPage = () => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [viewingDetails, setViewingDetails] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gradingAI, setGradingAI] = useState<number | null>(null);
  const [editingGradeId, setEditingGradeId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [templates, setTemplates] = useState<any[]>(() => {
    const saved = localStorage.getItem('assignment_templates');
    return saved ? JSON.parse(saved) : [];
  });
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState<FormData | null>(null);
  const createFormRef = useRef<HTMLFormElement>(null);

  const saveTemplate = (asgn: Assignment) => {
    const newTemplate = {
      title: asgn.title,
      description: asgn.description,
      subject: asgn.subject,
      id: Date.now()
    };
    const updated = [...templates, newTemplate];
    setTemplates(updated);
    localStorage.setItem('assignment_templates', JSON.stringify(updated));
    toast.success('Đã lưu thành mẫu bài tập');
  };

  const deleteTemplate = (id: number) => {
    const updated = templates.filter(t => t.id !== id);
    setTemplates(updated);
    localStorage.setItem('assignment_templates', JSON.stringify(updated));
    toast.success('Đã xóa mẫu bài tập');
  };

  const useTemplate = (template: any) => {
    setIsCreating(true);
    setTimeout(() => {
      if (createFormRef.current) {
        const titleInput = createFormRef.current.elements.namedItem('title') as HTMLInputElement;
        const descInput = createFormRef.current.elements.namedItem('description') as HTMLTextAreaElement;
        const subjectInput = createFormRef.current.elements.namedItem('subject') as HTMLSelectElement;
        
        if (titleInput) titleInput.value = template.title;
        if (descInput) descInput.value = template.description;
        if (subjectInput) subjectInput.value = template.subject;
      }
    }, 100);
  };

  const fetchAssignments = () => {
    fetch('/api/assignments', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    .then(res => res.json())
    .then(setAssignments);
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const handleCreateAssignment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const res = await fetch('/api/assignments', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: formData
    });

    if (res.ok) {
      toast.success('Đã tạo bài tập mới');
      setIsCreating(false);
      fetchAssignments();
    } else {
      toast.error('Lỗi khi tạo bài tập');
    }
  };

  const fetchSubmissions = (id: number) => {
    fetch(`/api/submissions/${id}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    .then(res => res.json())
    .then(setSubmissions);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedAssignment) return;
    const formData = new FormData(e.currentTarget);
    formData.append('assignment_id', selectedAssignment.id.toString());
    setPendingSubmitData(formData);
    setShowConfirmSubmit(true);
  };

  const confirmSubmit = async () => {
    if (!selectedAssignment || !pendingSubmitData) return;
    setIsSubmitting(true);
    setShowConfirmSubmit(false);
    
    const res = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: pendingSubmitData
    });
    
    if (res.ok) {
      toast.success('Đã nộp bài thành công');
      setIsSubmitting(false);
      setPendingSubmitData(null);
      // Reset form manually if needed or just let it be
    } else {
      const data = await res.json();
      toast.error(data.error || 'Nộp bài thất bại');
      setIsSubmitting(false);
    }
  };

  const handleAIGrade = async (submission: Submission) => {
    if (!selectedAssignment) return;
    setGradingAI(submission.id);
    try {
      const apiKey = (process.env as any).GEMINI_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("API Key is missing. Please configure GEMINI_API_KEY in your environment.");
      }
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: `
          Bạn là một chuyên gia giáo dục cao cấp cho hệ thống THIN_HUB 4.0.
          Nhiệm vụ: Chấm điểm và đưa ra phản hồi chuyên sâu cho bài làm của học sinh.
          
          Môn học: ${selectedAssignment.subject}
          Tiêu đề bài tập: ${selectedAssignment.title}
          Yêu cầu/Mô tả bài tập: ${selectedAssignment.description}
          
          Bài làm của học sinh:
          ${submission.content || 'Học sinh đã nộp file đính kèm.'}
          
          Tiêu chí đánh giá:
          1. Độ chính xác của nội dung (40%)
          2. Khả năng lập luận và trình bày (30%)
          3. Sự sáng tạo và nỗ lực (20%)
          4. Hình thức và ngữ pháp (10%)
          
          Yêu cầu đầu ra:
          - Điểm số (grade): Từ 0.0 đến 10.0.
          - Nhận xét (feedback): Phải chi tiết, nêu rõ ưu điểm, nhược điểm và hướng cải thiện. Sử dụng ngôn ngữ khích lệ.
        `,
        config: { 
          systemInstruction: "Bạn là một chuyên gia chấm điểm bài tập. Khi người dùng cung cấp một bài làm (văn bản hoặc hình ảnh), hãy phân tích kỹ lưỡng, chỉ ra các lỗi sai, đưa ra nhận xét chi tiết về ưu/nhược điểm và đề xuất điểm số (thang điểm 10). Hãy giải thích rõ lý do tại sao bạn cho điểm số đó.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              grade: { type: Type.NUMBER, description: "Điểm số từ 0 đến 10" },
              feedback: { type: Type.STRING, description: "Nhận xét chi tiết và chuyên sâu cho học sinh" }
            },
            required: ["grade", "feedback"]
          }
        }
      });
      
      const result = JSON.parse(response.text || '{}');
      
      const res = await fetch(`/api/submissions/${submission.id}/grade`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          grade: result.grade?.toString() || "0", 
          feedback: result.feedback || "Không có nhận xét từ AI." 
        })
      });
      
      if (res.ok) {
        toast.success('AI đã chấm điểm xong!');
        fetchSubmissions(selectedAssignment.id);
      } else {
        toast.error('Không thể lưu kết quả chấm điểm');
      }
    } catch (e) {
      console.error('AI Grading Error:', e);
      toast.error('Lỗi khi gọi AI chấm điểm. Vui lòng thử lại.');
    } finally {
      setGradingAI(null);
    }
  };

  const handleManualGrade = async (submissionId: number, e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const grade = formData.get('grade') as string;
    const feedback = formData.get('feedback') as string;

    const res = await fetch(`/api/submissions/${submissionId}/grade`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ grade, feedback })
    });

    if (res.ok) {
      toast.success('Đã cập nhật điểm số');
      setEditingGradeId(null);
      if (selectedAssignment) fetchSubmissions(selectedAssignment.id);
    } else {
      toast.error('Lỗi khi cập nhật điểm');
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Bài tập & AI</h2>
          <p className="text-slate-400">Nộp bài đúng hạn và nhận phản hồi thông minh từ AI.</p>
        </div>
        {user?.role === 'teacher' && (
          <button 
            onClick={() => setIsCreating(!isCreating)}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(147,51,234,0.3)]"
          >
            <Plus className="w-5 h-5" /> Tạo bài tập
          </button>
        )}
      </header>

      <AnimatePresence>
        {isCreating && (
          <motion.section 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <form ref={createFormRef} onSubmit={handleCreateAssignment} className="p-6 rounded-2xl bg-slate-900/50 border border-purple-500/20 space-y-4 backdrop-blur-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input name="title" placeholder="Tiêu đề bài tập" required className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-purple-400" />
                <select name="subject" required className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-purple-400">
                  <option value="Toán">Toán</option>
                  <option value="Vật Lý">Vật Lý</option>
                  <option value="Hóa Học">Hóa Học</option>
                  <option value="Tiếng Anh">Tiếng Anh</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>
              <textarea name="description" placeholder="Mô tả chi tiết yêu cầu bài tập..." rows={3} required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-purple-400" />
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Hạn chót nộp bài</label>
                  <input type="datetime-local" name="deadline" required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-purple-400" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tệp đính kèm (Tùy chọn)</label>
                  <input type="file" name="file" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-1.5 text-white file:bg-purple-600 file:border-none file:rounded file:text-white file:text-xs file:font-bold file:px-2 file:py-1" />
                </div>
                <div className="flex justify-end gap-3 md:pt-6">
                  <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 text-slate-400 hover:text-white transition-all">Hủy</button>
                  <button className="px-8 py-2 bg-purple-600 text-white font-bold rounded-xl shadow-[0_0_15px_rgba(147,51,234,0.4)]">Tạo ngay</button>
                </div>
              </div>
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-8">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-400" />
              Danh sách bài tập
            </h3>
            <div className="space-y-3">
              {assignments.map((asgn) => (
                <div
                  key={asgn.id}
                  className={cn(
                    "w-full text-left p-4 rounded-2xl border transition-all cursor-pointer group",
                    selectedAssignment?.id === asgn.id 
                      ? "bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.2)]" 
                      : "bg-slate-900/30 border-slate-800 hover:border-slate-700"
                  )}
                  onClick={() => { setSelectedAssignment(asgn); fetchSubmissions(asgn.id); }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">{asgn.subject}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500">{parseSQLiteDate(asgn.deadline).toLocaleDateString('vi-VN')}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setViewingDetails(asgn); }}
                        className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all opacity-0 group-hover:opacity-100"
                        title="Xem chi tiết"
                      >
                        <Search className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <h4 className="font-bold text-slate-200">{asgn.title}</h4>
                </div>
              ))}
            </div>
          </div>

          {user?.role === 'teacher' && templates.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Copy className="w-5 h-5 text-purple-400" />
                Mẫu bài tập (Templates)
              </h3>
              <div className="space-y-3">
                {templates.map((template) => (
                  <div key={template.id} className="p-4 rounded-2xl bg-slate-900/30 border border-slate-800 hover:border-purple-500/30 transition-all group">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">{template.subject}</span>
                      <button 
                        onClick={() => deleteTemplate(template.id)}
                        className="p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <h4 className="font-bold text-slate-200 mb-3">{template.title}</h4>
                    <button 
                      onClick={() => useTemplate(template)}
                      className="w-full py-2 bg-purple-600/10 hover:bg-purple-600 text-purple-400 hover:text-white text-[10px] font-black rounded-xl transition-all border border-purple-500/20 uppercase tracking-widest"
                    >
                      Sử dụng mẫu này
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          {selectedAssignment ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800 backdrop-blur-md"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-white">{selectedAssignment.title}</h3>
                {user?.role === 'teacher' && (
                  <button 
                    onClick={() => saveTemplate(selectedAssignment)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-700"
                  >
                    <Copy className="w-4 h-4" /> Lưu thành mẫu
                  </button>
                )}
              </div>
              <p className="text-slate-400 mb-6">{selectedAssignment.description}</p>
              
              {selectedAssignment.file_path && (
                <div className="mb-6">
                  <a 
                    href={selectedAssignment.file_path} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-xl text-xs font-bold transition-all border border-cyan-500/20"
                  >
                    <Paperclip className="w-4 h-4" /> Xem tệp đính kèm từ giáo viên
                  </a>
                </div>
              )}
              
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 mb-8">
                <div className="flex items-center gap-2 text-sm text-yellow-400 mb-2">
                  <Clock className="w-4 h-4" />
                  <span>Hạn chót: {parseSQLiteDate(selectedAssignment.deadline).toLocaleString('vi-VN')}</span>
                </div>
                <p className="text-xs text-slate-500 italic">Lưu ý: Hệ thống sẽ tự động khóa nộp bài khi hết giờ.</p>
              </div>

              {/* Grading Rubric Section */}
              <div className="mb-8 p-6 rounded-2xl bg-slate-950/50 border border-slate-800">
                <div className="flex items-center gap-2 mb-4">
                  <FileCheck className="w-5 h-5 text-cyan-400" />
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider">Tiêu chí chấm điểm (Rubric)</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/50">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-slate-300">Độ chính xác</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">4.0đ</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">Nội dung chính xác, đầy đủ các yêu cầu đề ra.</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/50">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-slate-300">Sự rõ ràng</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">3.0đ</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">Trình bày mạch lạc, dễ hiểu, cấu trúc logic.</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/50">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-slate-300">Sự sáng tạo</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">3.0đ</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">Có góc nhìn mới mẻ, nỗ lực vượt mức yêu cầu.</p>
                  </div>
                </div>
              </div>

              {user?.role === 'student' ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <textarea 
                    name="content" 
                    placeholder="Nhập nội dung bài làm hoặc ghi chú..." 
                    rows={4}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400"
                  />
                  <div className="flex items-center gap-4">
                    <input type="file" name="file" className="flex-1 text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-cyan-400/10 file:text-cyan-400" />
                    <button disabled={isSubmitting} className="px-8 py-3 bg-cyan-500 hover:bg-cyan-400 text-white font-bold rounded-xl transition-all flex items-center gap-2">
                      <Send className="w-4 h-4" /> {isSubmitting ? 'Đang nộp...' : 'Nộp bài'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-6">
                  <h4 className="font-bold text-white">Bài nộp của học sinh</h4>
                  <div className="space-y-4">
                    {submissions.map((sub) => (
                      <div key={sub.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-bold text-slate-200">{sub.student_name}</span>
                          <span className="text-xs text-slate-500">{parseSQLiteDate(sub.submitted_at).toLocaleString('vi-VN')}</span>
                        </div>
                        <p className="text-sm text-slate-400 mb-4">{sub.content || 'Không có nội dung văn bản.'}</p>
                        {sub.file_path && (
                          <a href={sub.file_path} target="_blank" rel="noreferrer" className="text-xs text-cyan-400 hover:underline flex items-center gap-1 mb-4">
                            <FileText className="w-3 h-3" /> Xem file đính kèm
                          </a>
                        )}
                        
                        <div className="pt-4 border-t border-slate-800">
                          {editingGradeId === sub.id ? (
                            <form onSubmit={(e) => handleManualGrade(sub.id, e)} className="space-y-6">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Độ chính xác (0-4)</label>
                                  <input 
                                    name="rubric_accuracy" 
                                    type="number" 
                                    step="0.1" 
                                    min="0" 
                                    max="4" 
                                    placeholder="0.0"
                                    onChange={(e) => {
                                      const form = e.currentTarget.form;
                                      if (form) {
                                        const acc = parseFloat((form.elements.namedItem('rubric_accuracy') as HTMLInputElement).value) || 0;
                                        const cla = parseFloat((form.elements.namedItem('rubric_clarity') as HTMLInputElement).value) || 0;
                                        const cre = parseFloat((form.elements.namedItem('rubric_creativity') as HTMLInputElement).value) || 0;
                                        (form.elements.namedItem('grade') as HTMLInputElement).value = (acc + cla + cre).toFixed(1);
                                      }
                                    }}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-400" 
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Sự rõ ràng (0-3)</label>
                                  <input 
                                    name="rubric_clarity" 
                                    type="number" 
                                    step="0.1" 
                                    min="0" 
                                    max="3" 
                                    placeholder="0.0"
                                    onChange={(e) => {
                                      const form = e.currentTarget.form;
                                      if (form) {
                                        const acc = parseFloat((form.elements.namedItem('rubric_accuracy') as HTMLInputElement).value) || 0;
                                        const cla = parseFloat((form.elements.namedItem('rubric_clarity') as HTMLInputElement).value) || 0;
                                        const cre = parseFloat((form.elements.namedItem('rubric_creativity') as HTMLInputElement).value) || 0;
                                        (form.elements.namedItem('grade') as HTMLInputElement).value = (acc + cla + cre).toFixed(1);
                                      }
                                    }}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-400" 
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Sự sáng tạo (0-3)</label>
                                  <input 
                                    name="rubric_creativity" 
                                    type="number" 
                                    step="0.1" 
                                    min="0" 
                                    max="3" 
                                    placeholder="0.0"
                                    onChange={(e) => {
                                      const form = e.currentTarget.form;
                                      if (form) {
                                        const acc = parseFloat((form.elements.namedItem('rubric_accuracy') as HTMLInputElement).value) || 0;
                                        const cla = parseFloat((form.elements.namedItem('rubric_clarity') as HTMLInputElement).value) || 0;
                                        const cre = parseFloat((form.elements.namedItem('rubric_creativity') as HTMLInputElement).value) || 0;
                                        (form.elements.namedItem('grade') as HTMLInputElement).value = (acc + cla + cre).toFixed(1);
                                      }
                                    }}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-400" 
                                  />
                                </div>
                              </div>

                              <div className="flex gap-4">
                                <div className="w-24">
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tổng Điểm</label>
                                  <input 
                                    name="grade" 
                                    type="number" 
                                    step="0.1" 
                                    min="0" 
                                    max="10" 
                                    defaultValue={sub.grade || ''} 
                                    required 
                                    className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-3 py-2 text-cyan-400 font-bold focus:outline-none focus:border-cyan-400" 
                                  />
                                </div>
                                <div className="flex-1">
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nhận xét tổng quát</label>
                                  <input 
                                    name="feedback" 
                                    defaultValue={sub.feedback || ''} 
                                    required 
                                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-400" 
                                  />
                                </div>
                              </div>
                              <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setEditingGradeId(null)} className="px-3 py-1 text-xs text-slate-400 hover:text-white transition-all">Hủy</button>
                                <button className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(34,211,238,0.3)]">Lưu điểm</button>
                              </div>
                            </form>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                {sub.grade ? (
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-cyan-400/10 flex items-center justify-center text-cyan-400 font-bold text-lg border border-cyan-500/20">
                                      {sub.grade}
                                    </div>
                                    <p className="text-xs text-slate-400 italic">"{sub.feedback}"</p>
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-500 italic">Chưa chấm điểm</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => setEditingGradeId(sub.id)}
                                  className="px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-lg text-xs font-bold transition-all"
                                >
                                  {sub.grade ? 'Sửa điểm' : 'Chấm thủ công'}
                                </button>
                                <button 
                                  onClick={() => handleAIGrade(sub)}
                                  disabled={gradingAI === sub.id}
                                  className="px-4 py-2 bg-purple-600/20 text-purple-400 hover:bg-purple-600 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-2"
                                >
                                  <BrainCircuit className="w-4 h-4" /> {gradingAI === sub.id ? 'Đang chấm...' : 'AI Chấm điểm'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {submissions.length === 0 && <p className="text-slate-500 italic">Chưa có bài nộp nào.</p>}
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 p-10 border-2 border-dashed border-slate-800 rounded-3xl">
              <GraduationCap className="w-16 h-16 mb-4 opacity-20" />
              <p>Chọn một bài tập để xem chi tiết.</p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {viewingDetails && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-slate-900 border border-cyan-500/30 p-8 rounded-3xl w-full max-w-2xl shadow-[0_0_50px_rgba(34,211,238,0.1)] relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50" />
              
              <button 
                onClick={() => setViewingDetails(null)}
                className="absolute top-6 right-6 p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-6">
                <span className="px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-[10px] font-bold uppercase tracking-widest border border-cyan-500/20">
                  {viewingDetails.subject}
                </span>
                <h3 className="text-3xl font-bold text-white mt-4 mb-2">{viewingDetails.title}</h3>
                <div className="flex items-center gap-4 text-sm text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <UserCircle className="w-4 h-4 text-cyan-400" />
                    <span>Giáo viên: {viewingDetails.teacher_name || 'Đang cập nhật'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-yellow-400" />
                    <span>Hạn chót: {parseSQLiteDate(viewingDetails.deadline).toLocaleString('vi-VN')}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Mô tả bài tập</h4>
                  <div className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {viewingDetails.description}
                  </div>
                </div>

                {viewingDetails.file_path && (
                  <div className="p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">Tài liệu đính kèm</p>
                        <p className="text-xs text-slate-500">Tài liệu hướng dẫn từ giáo viên</p>
                      </div>
                    </div>
                    <a 
                      href={viewingDetails.file_path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(34,211,238,0.3)]"
                    >
                      Tải xuống
                    </a>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button 
                  onClick={() => setViewingDetails(null)}
                  className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl transition-all border border-slate-700"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showConfirmSubmit && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-cyan-500/30 p-8 rounded-3xl w-full max-w-md shadow-[0_0_50px_rgba(34,211,238,0.1)]"
            >
              <h3 className="text-xl font-bold text-white mb-4">Xác nhận nộp bài</h3>
              <p className="text-slate-400 mb-8">
                Bạn có chắc chắn muốn nộp bài tập này không? Sau khi nộp, bạn sẽ không thể chỉnh sửa nội dung cho đến khi giáo viên cho phép.
              </p>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setShowConfirmSubmit(false)} 
                  className="px-4 py-2 text-slate-400 hover:text-white transition-all"
                >
                  Hủy
                </button>
                <button 
                  onClick={confirmSubmit}
                  className="px-6 py-2 bg-cyan-500 text-white font-bold rounded-xl shadow-[0_0_15px_rgba(34,211,238,0.4)]"
                >
                  Xác nhận nộp
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ShowcasePage = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetch('/api/showcase', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    .then(res => res.json())
    .then(setItems);
  }, []);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const res = await fetch('/api/showcase', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: formData
    });

    if (res.ok) {
      toast.success('Đã tải lên thành công!');
      setIsUploading(false);
      fetch('/api/showcase', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      .then(res => res.json())
      .then(setItems);
    }
  };

  return (
    <div className="space-y-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="max-w-2xl">
          <h2 className="text-4xl font-black text-white mb-4 tracking-tight uppercase italic">
            Creative <span className="text-cyan-400 shadow-cyan-500/50 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]">Showcase</span>
          </h2>
          <p className="text-slate-400">Không gian triển lãm ảo các dự án sáng tạo và kỷ niệm của tập thể lớp.</p>
        </div>
        <button 
          onClick={() => setIsUploading(!isUploading)}
          className="px-8 py-3 bg-cyan-500 text-white font-black rounded-2xl hover:bg-cyan-400 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(34,211,238,0.3)]"
        >
          <Camera className="w-5 h-5" /> Đăng kỷ niệm
        </button>
      </header>

      <AnimatePresence>
        {isUploading && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-8 rounded-3xl bg-slate-900/50 border border-cyan-500/20 backdrop-blur-md mb-12">
              <form onSubmit={handleUpload} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tiêu đề</label>
                    <input name="title" required className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white focus:border-cyan-400 transition-all" placeholder="Tên kỷ niệm..." />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ảnh kỷ niệm</label>
                    <input type="file" name="image" accept="image/*" required className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3.5 text-white file:bg-cyan-500 file:border-none file:rounded-lg file:text-white file:font-bold file:px-4 file:py-1 file:mr-4" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Mô tả ngắn</label>
                  <textarea name="description" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white focus:border-cyan-400 transition-all h-24" placeholder="Chia sẻ cảm xúc của bạn..." />
                </div>
                <div className="flex justify-end gap-4">
                  <button type="button" onClick={() => setIsUploading(false)} className="px-6 py-3 text-slate-400 font-bold">Hủy</button>
                  <button className="px-10 py-3 bg-cyan-500 text-white font-black rounded-xl hover:bg-cyan-400 transition-all">Tải lên ngay</button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {items.map((item) => (
          <motion.div 
            key={item.id}
            whileHover={{ y: -10 }}
            className="relative group rounded-3xl overflow-hidden border border-white/5 bg-slate-900/40 backdrop-blur-md"
          >
            <div className="aspect-[4/3] overflow-hidden">
              <img 
                src={item.image_path || `https://picsum.photos/seed/thinhub${item.id}/800/600`} 
                alt={item.title} 
                className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest bg-cyan-400/10 px-2 py-1 rounded-lg">Kỷ niệm lớp</span>
                <span className="text-[10px] text-slate-500 font-bold uppercase">{format(parseSQLiteDate(item.created_at), 'dd/MM/yyyy')}</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">{item.title}</h3>
              <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">{item.description}</p>
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-cyan-400">
                  {item.author_name[0]}
                </div>
                <span className="text-xs text-slate-500 font-medium">Đăng bởi {item.author_name}</span>
              </div>
            </div>
          </motion.div>
        ))}
        {items.length === 0 && !isUploading && (
          <div className="col-span-full p-20 text-center rounded-[3rem] border-2 border-dashed border-slate-800">
            <Camera className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-500 font-bold text-xl">Chưa có kỷ niệm nào được chia sẻ.</p>
            <p className="text-slate-600 mt-2">Hãy là người đầu tiên đăng ảnh lớp nhé!</p>
          </div>
        )}
      </div>
    </div>
  );
};

import { ProAIAssistantPage } from './components/ProAIAssistantPage';
import { ThinAILivePage } from './components/ThinAILivePage';

const AIAssistantPage = () => {
  const { user } = useAuth();
  
  // Temporarily show Pro version for everyone so the user can see the changes
  if (user?.is_pro || true) {
    return <ProAIAssistantPage />;
  }

  const [messages, setMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([
    { role: 'model', text: 'Xin chào! Tôi là ThinAI - Trợ lý học tập thông minh của bạn. Tôi có thể giúp bạn giải đáp các bài tập, giải thích kiến thức hoặc hỗ trợ bất kỳ vướng mắc nào trong học tập. Bạn cần tôi giúp gì hôm nay?' }
  ]);
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("Bạn là ThinAI, một trợ lý học tập thông minh tích hợp trong ứng dụng THIN HUB. Nhiệm vụ của bạn là hỗ trợ học sinh và giáo viên giải đáp các bài tập, giải thích các khái niệm phức tạp một cách dễ hiểu, và đưa ra các lời khuyên học tập hiệu quả. Hãy trả lời bằng tiếng Việt, lịch sự và khuyến khích tinh thần tự học. ĐẶC BIỆT: Đối với các công thức Toán học, Vật lý, Hóa học, bạn PHẢI sử dụng định dạng LaTeX (ví dụ: $E=mc^2$ cho công thức trên cùng dòng hoặc $$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$ cho công thức xuống dòng) để hiển thị đẹp mắt. Không sử dụng các ký tự thô như ^, _, / cho công thức. Nếu người dùng tải lên tài liệu, hãy đọc kỹ nội dung và trả lời dựa trên thông tin trong tài liệu đó.");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const suggestedPrompts = [
    { text: "Giải bài tập Toán", icon: "📐" },
    { text: "Tóm tắt văn bản", icon: "📝" },
    { text: "Giải thích khái niệm Vật lý", icon: "⚛️" },
    { text: "Lập lộ trình học tập", icon: "📅" },
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

    const userMessage = messageText || (selectedFile ? `Tôi đã tải lên một tệp: ${selectedFile.name}. Hãy giúp tôi tóm tắt hoặc trả lời các câu hỏi liên quan.` : "");
    const currentFile = selectedFile;
    
    setInput('');
    setSelectedFile(null);
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    // Placeholder for model response to be updated via streaming
    setMessages(prev => [...prev, { role: 'model', text: '' }]);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("API Key is missing. Please configure GEMINI_API_KEY in your environment.");
      }
      const ai = new GoogleGenAI({ apiKey });
      
      // Build history with strictly alternating roles: user -> model -> user
      const history: any[] = [];
      let lastRole: string | null = null;
      
      for (let i = 0; i < messages.length; i++) {
        const m = messages[i];
        // Skip initial greeting if it's the first message and from model
        if (i === 0 && m.role === 'model') continue;
        // Skip empty messages or error messages
        if (!m.text || !m.text.trim() || m.text.startsWith("Đã có lỗi xảy ra")) continue;
        // Ensure alternating roles (Gemini requirement)
        if (m.role === lastRole) continue;
        
        history.push({ role: m.role, parts: [{ text: m.text }] });
        lastRole = m.role;
      }

      // Gemini requires alternating roles: user, model, user, model...
      // Since we are about to append a 'user' message, the history must end with a 'model' message.
      while (history.length > 0 && history[history.length - 1].role === 'user') {
        history.pop();
      }

      const userParts: any[] = [];
      if (userMessage) {
        userParts.push({ text: userMessage });
      }

      if (currentFile) {
        const base64Data = await fileToBase64(currentFile);
        userParts.push({
          inlineData: {
            data: base64Data.split(',')[1],
            mimeType: currentFile.type
          }
        });
      }

      if (userParts.length === 0) {
        setIsLoading(false);
        return;
      }

      const streamResponse = await ai.models.generateContentStream({
        model: "gemini-flash-latest",
        contents: [...history, { role: 'user', parts: userParts }],
        config: {
          systemInstruction: systemPrompt,
        }
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
    } catch (error) {
      console.error("AI Error:", error);
      toast.error("Không thể kết nối với trí tuệ nhân tạo.");
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = { role: 'model', text: "Đã có lỗi xảy ra khi kết nối với máy chủ AI. Vui lòng kiểm tra lại kết nối mạng hoặc định dạng tệp không được hỗ trợ." };
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Trình duyệt của bạn không hỗ trợ nhận diện giọng nói.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
    };
    recognition.onerror = () => {
      setIsListening(false);
      toast.error("Lỗi khi nhận diện giọng nói.");
    };

    recognition.start();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Đã sao chép vào bộ nhớ tạm!");
  };

  const clearChat = () => {
    setMessages([{ role: 'model', text: 'Xin chào! Tôi là ThinAI - Trợ lý học tập thông minh của bạn. Tôi có thể giúp bạn giải đáp các bài tập, giải thích kiến thức hoặc hỗ trợ bất kỳ vướng mắc nào trong học tập. Bạn cần tôi giúp gì hôm nay?' }]);
    toast.success("Đã xóa lịch sử trò chuyện.");
  };

  const promptPresets = [
    { name: "Trợ lý học tập", prompt: "Bạn là một trợ lý học tập thông minh tích hợp trong ứng dụng THIN HUB. Nhiệm vụ của bạn là hỗ trợ học sinh và giáo viên giải đáp các bài tập, giải thích các khái niệm phức tạp một cách dễ hiểu, và đưa ra các lời khuyên học tập hiệu quả. Hãy trả lời bằng tiếng Việt, lịch sự và khuyến khích tinh thần tự học. ĐẶC BIỆT: Đối với các công thức Toán học, Vật lý, Hóa học, bạn PHẢI sử dụng định dạng LaTeX (ví dụ: $E=mc^2$ cho công thức trên cùng dòng hoặc $$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$ cho công thức xuống dòng) để hiển thị đẹp mắt. Không sử dụng các ký tự thô như ^, _, / cho công thức. Nếu người dùng tải lên tài liệu, hãy đọc kỹ nội dung và trả lời dựa trên thông tin trong tài liệu đó." },
    { name: "Giáo viên nghiêm khắc", prompt: "Bạn là một giáo viên cực kỳ nghiêm khắc và kỷ luật. Bạn chỉ trả lời những câu hỏi liên quan đến học tập. Bạn không đưa ra đáp án trực tiếp mà chỉ hướng dẫn học sinh cách tự tìm ra lời giải. Ngôn ngữ của bạn ngắn gọn, súc tích và có phần lạnh lùng. Bạn yêu cầu sự tập trung tuyệt đối từ học sinh." },
    { name: "Người bạn thân thiện", prompt: "Bạn là một người bạn cùng tiến cực kỳ thân thiện, vui vẻ và luôn tràn đầy năng lượng tích cực. Bạn sử dụng ngôn ngữ trẻ trung (teen code nhẹ nhàng), thường xuyên sử dụng emoji để động viên bạn bè. Bạn giải thích kiến thức như đang kể một câu chuyện thú vị." },
    { name: "Chuyên gia tóm tắt", prompt: "Bạn là một chuyên gia phân tích và tóm tắt văn bản. Nhiệm vụ chính của bạn là đọc các tài liệu dài và trích xuất ra những ý chính quan trọng nhất dưới dạng danh sách gạch đầu dòng. Bạn tập trung vào sự chính xác, khách quan và ngắn gọn." },
    { name: "Chuyên gia chấm điểm", prompt: "Bạn là một chuyên gia chấm điểm bài tập. Khi người dùng cung cấp một bài làm (văn bản hoặc hình ảnh), hãy phân tích kỹ lưỡng, chỉ ra các lỗi sai, đưa ra nhận xét chi tiết về ưu/nhược điểm và đề xuất điểm số (thang điểm 10). Hãy giải thích rõ lý do tại sao bạn cho điểm số đó." },
  ];

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-cyan-400" /> ThinAI Thông minh
          </h2>
          <p className="text-slate-400">Giải đáp bài tập và hỗ trợ học tập 24/7.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={cn(
              "p-3 rounded-2xl transition-all border",
              isSettingsOpen 
                ? "bg-cyan-500/20 border-cyan-500 text-cyan-400" 
                : "bg-slate-900/50 border-slate-800 text-slate-400 hover:text-cyan-400"
            )}
            title="Tùy chỉnh AI"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button 
            onClick={clearChat}
            className="p-3 bg-slate-900/50 border border-slate-800 rounded-2xl text-slate-400 hover:text-red-400 transition-all"
            title="Xóa lịch sử"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex gap-6 overflow-hidden">
        <div className="flex-1 bg-slate-900/30 border border-white/5 rounded-[2.5rem] backdrop-blur-md flex flex-col overflow-hidden relative">
          <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto space-y-6 no-scrollbar pb-32">
          {messages.map((msg, i) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={i}
              className={cn(
                "flex gap-4 max-w-[90%]",
                msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center shadow-lg",
                msg.role === 'user' ? "bg-cyan-500 text-white" : "bg-slate-800 text-cyan-400"
              )}>
                {msg.role === 'user' ? <UserCircle className="w-6 h-6" /> : <BrainCircuit className="w-6 h-6" />}
              </div>
              <div className="group relative">
                <div className={cn(
                  "px-6 py-4 rounded-3xl text-sm leading-relaxed shadow-xl",
                  msg.role === 'user' 
                    ? "bg-cyan-500 text-white rounded-tr-none" 
                    : "bg-slate-800/80 text-slate-200 rounded-tl-none border border-white/5"
                )}>
                  <div className="markdown-body">
                    <ReactMarkdown 
                      remarkPlugins={[remarkMath]} 
                      rehypePlugins={[rehypeKatex]}
                    >
                      {msg.text || (isLoading && i === messages.length - 1 ? "..." : "")}
                    </ReactMarkdown>
                  </div>
                </div>
                {msg.role === 'model' && msg.text && (
                  <button 
                    onClick={() => copyToClipboard(msg.text)}
                    className="absolute -right-10 top-2 p-2 bg-slate-800/50 rounded-lg text-slate-500 opacity-0 group-hover:opacity-100 transition-all hover:text-cyan-400"
                    title="Sao chép"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
          {isLoading && messages[messages.length - 1].text === '' && (
            <div className="flex gap-4 mr-auto">
              <div className="w-10 h-10 rounded-xl bg-slate-800 text-cyan-400 flex items-center justify-center animate-pulse">
                <BrainCircuit className="w-6 h-6" />
              </div>
              <div className="px-6 py-4 rounded-3xl bg-slate-800/80 text-slate-400 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent">
          {messages.length === 1 && !input && (
            <div className="flex flex-wrap gap-2 mb-4 justify-center">
              {suggestedPrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(undefined, p.text)}
                  className="px-4 py-2 bg-slate-900/80 border border-slate-800 rounded-full text-xs text-slate-300 hover:border-cyan-500/50 hover:text-cyan-400 transition-all flex items-center gap-2"
                >
                  <span>{p.icon}</span>
                  {p.text}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSend} className="flex flex-col gap-4">
            {selectedFile && (
              <div className="flex items-center gap-3 px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl w-fit">
                <File className="w-4 h-4 text-cyan-400" />
                <span className="text-xs text-cyan-400 font-bold max-w-[200px] truncate">{selectedFile.name}</span>
                <button 
                  type="button" 
                  onClick={() => setSelectedFile(null)}
                  className="p-1 hover:bg-cyan-500/20 rounded-full text-cyan-400"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <div className="flex gap-3">
              <input 
                type="file" 
                ref={fileInputRef}
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                accept=".pdf,.docx,.txt,image/*"
              />
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center text-slate-400 hover:text-cyan-400 transition-all hover:border-cyan-500/30"
                title="Tải lên tài liệu"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <button 
                type="button"
                onClick={handleVoiceInput}
                className={cn(
                  "w-12 h-12 border rounded-2xl flex items-center justify-center transition-all",
                  isListening 
                    ? "bg-red-500/20 border-red-500 text-red-500 animate-pulse" 
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-cyan-400"
                )}
                title="Nhập bằng giọng nói"
              >
                <Mic className="w-5 h-5" />
              </button>
              <div className="flex-1 relative">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Đặt câu hỏi hoặc tải lên tài liệu..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-3.5 text-white focus:border-cyan-400 transition-all outline-none pr-14"
                />
                <button 
                  disabled={isLoading}
                  type="submit"
                  className="absolute right-2 top-2 w-10 h-10 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 text-white font-bold rounded-xl transition-all flex items-center justify-center shadow-lg shadow-cyan-500/20"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

        <AnimatePresence>
          {isSettingsOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-slate-900/50 border border-white/5 rounded-[2.5rem] backdrop-blur-md overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-white/5">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-cyan-400" /> Tùy chỉnh AI
                </h3>
                <p className="text-xs text-slate-500 mt-1">Thay đổi vai trò và giọng điệu của trợ lý.</p>
              </div>
              
              <div className="flex-1 p-6 overflow-y-auto space-y-6 no-scrollbar">
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Chọn mẫu nhanh</label>
                  <div className="grid grid-cols-1 gap-2">
                    {promptPresets.map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setSystemPrompt(preset.prompt);
                          toast.success(`Đã chuyển sang: ${preset.name}`);
                        }}
                        className={cn(
                          "px-4 py-3 rounded-xl border text-xs font-medium transition-all text-left",
                          systemPrompt === preset.prompt
                            ? "bg-cyan-500/10 border-cyan-500 text-cyan-400"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                        )}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Câu lệnh hệ thống</label>
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    className="w-full h-64 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-slate-300 focus:border-cyan-400 transition-all outline-none resize-none leading-relaxed"
                    placeholder="Nhập câu lệnh hệ thống tại đây..."
                  />
                  <p className="text-[10px] text-slate-500 italic">
                    * Lưu ý: Câu lệnh này sẽ định hình cách AI phản hồi bạn. Hãy mô tả chi tiết vai trò và phong cách bạn muốn.
                  </p>
                </div>
              </div>

              <div className="p-6 border-t border-white/5">
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-white font-bold rounded-xl transition-all text-sm mb-2"
                >
                  Lưu & Đóng
                </button>
                <button
                  onClick={() => {
                    setSystemPrompt("Bạn là một trợ lý học tập thông minh tích hợp trong ứng dụng THIN HUB. Nhiệm vụ của bạn là hỗ trợ học sinh và giáo viên giải đáp các bài tập, giải thích các khái niệm phức tạp một cách dễ hiểu, và đưa ra các lời khuyên học tập hiệu quả. Hãy trả lời bằng tiếng Việt, lịch sự và khuyến khích tinh thần tự học. ĐẶC BIỆT: Đối với các công thức Toán học, Vật lý, Hóa học, bạn PHẢI sử dụng định dạng LaTeX (ví dụ: $E=mc^2$ cho công thức trên cùng dòng hoặc $$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$ cho công thức xuống dòng) để hiển thị đẹp mắt. Không sử dụng các ký tự thô như ^, _, / cho công thức. Nếu người dùng tải lên tài liệu, hãy đọc kỹ nội dung và trả lời dựa trên thông tin trong tài liệu đó.");
                    toast.success("Đã đặt lại về mặc định.");
                  }}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 font-medium rounded-xl transition-all text-xs flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-3 h-3" /> Đặt lại mặc định
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const AIStudyPlanPage = () => {
  const { user } = useAuth();
  const [goal, setGoal] = useState('');
  const [duration, setDuration] = useState('4'); // weeks
  const [level, setLevel] = useState('beginner');
  const [plan, setPlan] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    if (!goal.trim()) {
      toast.error("Vui lòng nhập mục tiêu học tập của bạn.");
      return;
    }

    setIsLoading(true);
    setPlan('');
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("API Key is missing. Please configure GEMINI_API_KEY in your environment.");
      }
      const ai = new GoogleGenAI({ apiKey });
      const streamResponse = await ai.models.generateContentStream({
        model: "gemini-flash-latest",
        contents: `Hãy lập một lộ trình học tập chi tiết cho mục tiêu: "${goal}". 
                  Thời gian dự kiến: ${duration} tuần. 
                  Trình độ hiện tại: ${level === 'beginner' ? 'Người mới bắt đầu' : level === 'intermediate' ? 'Trung cấp' : 'Nâng cao'}.
                  Lớp học: ${user?.class_name || 'Không rõ'}.
                  
                  Yêu cầu lộ trình:
                  1. Chia nhỏ theo từng tuần và từng ngày.
                  2. Mỗi ngày có mục tiêu cụ thể và tài liệu/phương pháp gợi ý.
                  3. Có các bài kiểm tra đánh giá sau mỗi tuần.
                  4. Sử dụng định dạng Markdown đẹp mắt với các icon phù hợp.
                  5. Trình bày bằng tiếng Việt, chuyên nghiệp và truyền cảm hứng.`,
        config: {
          systemInstruction: "Bạn là một chuyên gia tư vấn giáo dục và lập kế hoạch học tập. Bạn giỏi trong việc chia nhỏ các mục tiêu lớn thành các bước nhỏ khả thi. Hãy tạo ra các lộ trình học tập khoa học, thực tế và dễ theo dõi.",
        }
      });

      let fullText = "";
      for await (const chunk of streamResponse) {
        fullText += chunk.text || "";
        setPlan(fullText);
      }
    } catch (error) {
      console.error("Plan Error:", error);
      toast.error("Không thể tạo lộ trình học tập.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Calendar className="w-8 h-8 text-purple-400" /> Lộ trình Học tập AI
        </h2>
        <p className="text-slate-400">Tạo kế hoạch học tập cá nhân hóa dựa trên mục tiêu của bạn.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900/50 border border-slate-800 backdrop-blur-md space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mục tiêu của bạn</label>
              <textarea 
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Ví dụ: Ôn thi đại học môn Toán, Học lập trình React trong 1 tháng..."
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-white focus:border-purple-400 transition-all outline-none h-32 resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Thời gian (tuần)</label>
              <select 
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-white focus:border-purple-400 outline-none"
              >
                {[1, 2, 4, 8, 12].map(w => (
                  <option key={w} value={w}>{w} tuần</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Trình độ hiện tại</label>
              <div className="grid grid-cols-1 gap-2">
                {['beginner', 'intermediate', 'advanced'].map((l) => (
                  <button
                    key={l}
                    onClick={() => setLevel(l)}
                    className={cn(
                      "px-4 py-3 rounded-xl border text-sm font-medium transition-all text-left",
                      level === l 
                        ? "bg-purple-500/10 border-purple-500 text-purple-400" 
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    )}
                  >
                    {l === 'beginner' ? 'Người mới bắt đầu' : l === 'intermediate' ? 'Trung cấp' : 'Nâng cao'}
                  </button>
                ))}
              </div>
            </div>

            <button 
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full py-4 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20"
            >
              {isLoading ? <RotateCcw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              Tạo lộ trình ngay
            </button>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="h-full min-h-[500px] p-8 rounded-3xl bg-slate-900/30 border border-white/5 backdrop-blur-md overflow-y-auto">
            {!plan && !isLoading && (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                <Calendar className="w-16 h-16 text-slate-600" />
                <div>
                  <h3 className="text-xl font-bold text-slate-400">Chưa có lộ trình nào</h3>
                  <p className="text-sm text-slate-500">Hãy nhập mục tiêu và nhấn nút tạo để bắt đầu.</p>
                </div>
              </div>
            )}
            {isLoading && !plan && (
              <div className="h-full flex flex-col items-center justify-center space-y-4">
                <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                <p className="text-purple-400 font-medium animate-pulse">Đang thiết kế lộ trình tối ưu cho bạn...</p>
              </div>
            )}
            {plan && (
              <div className="markdown-body">
                <ReactMarkdown>{plan}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ChatPage = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const emojis = ['😀', '😂', '😍', '😎', '🤔', '👍', '🔥', '❤️', '✨', '🎉', '🙌', '🚀', '💯', '👏', '💪', '🌈', '🍕', '🎮', '💡', '✅'];

  const addEmoji = (emoji: string) => {
    setContent(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  useEffect(() => {
    const fetchMessages = () => {
      fetch(`/api/messages?is_private=${isPrivate}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      .then(res => res.json())
      .then(setMessages);
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [isPrivate]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ content, is_private: isPrivate })
    });

    if (res.ok) {
      setContent('');
      fetch(`/api/messages?is_private=${isPrivate}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      .then(res => res.json())
      .then(setMessages);
    }
  };

  return (
    <div className="h-[calc(100vh-200px)] flex flex-col gap-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Phòng Chat {isPrivate ? 'Kín' : 'Lớp'}</h2>
          <p className="text-slate-400">{isPrivate ? 'Khu vực thảo luận nội bộ Ban cán sự.' : 'Nơi trao đổi chung của cả lớp.'}</p>
        </div>
        {(user?.role === 'teacher' || user?.role === 'officer') && (
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button 
              onClick={() => setIsPrivate(false)}
              className={cn(
                "px-6 py-2 rounded-lg text-xs font-bold transition-all",
                !isPrivate ? "bg-cyan-500 text-white" : "text-slate-500 hover:text-slate-300"
              )}
            >
              Cả lớp
            </button>
            <button 
              onClick={() => setIsPrivate(true)}
              className={cn(
                "px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                isPrivate ? "bg-purple-600 text-white" : "text-slate-500 hover:text-slate-300"
              )}
            >
              <BrainCircuit className="w-3 h-3" /> Nội bộ
            </button>
          </div>
        )}
      </header>

      <div className="flex-1 bg-slate-900/30 border border-white/5 rounded-[2rem] backdrop-blur-md flex flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto space-y-4 no-scrollbar">
          {messages.map((msg, i) => {
            const isMe = msg.sender_id === user?.id;
            return (
              <motion.div
                initial={{ opacity: 0, x: isMe ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                key={msg.id}
                className={cn(
                  "flex flex-col max-w-[80%]",
                  isMe ? "ml-auto items-end" : "items-start"
                )}
              >
                {!isMe && (
                  <span className="text-[10px] font-bold text-slate-500 mb-1 ml-2 uppercase tracking-widest">
                    {msg.sender_name} • {msg.sender_role === 'teacher' ? 'Giáo viên' : msg.sender_role === 'officer' ? 'BCS' : 'Học sinh'}
                  </span>
                )}
                <div className={cn(
                  "px-5 py-3 rounded-2xl text-sm leading-relaxed",
                  isMe 
                    ? "bg-cyan-500 text-white rounded-tr-none" 
                    : "bg-slate-800 text-slate-200 rounded-tl-none"
                )}>
                  {msg.content}
                </div>
                <span className="text-[8px] text-slate-600 mt-1 px-2">
                  {format(parseSQLiteDate(msg.created_at), 'HH:mm')}
                </span>
              </motion.div>
            );
          })}
          {messages.length === 0 && (
            <div className="h-full flex items-center justify-center text-slate-600 italic">
              Bắt đầu cuộc trò chuyện...
            </div>
          )}
        </div>

        <form onSubmit={handleSend} className="p-4 bg-slate-950/50 border-t border-white/5 flex gap-3 relative">
          <div className="relative">
            <button 
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-cyan-400 transition-all"
            >
              <Smile className="w-6 h-6" />
            </button>

            <AnimatePresence>
              {showEmojiPicker && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.9 }}
                  className="absolute bottom-16 left-0 p-4 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl z-50 w-64"
                >
                  <div className="grid grid-cols-5 gap-2">
                    {emojis.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => addEmoji(emoji)}
                        className="text-2xl hover:scale-125 transition-transform p-1"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Nhập tin nhắn..."
            className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl px-6 py-3 text-white focus:border-cyan-400 transition-all outline-none"
          />
          <button 
            type="submit"
            className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center text-white transition-all",
              isPrivate ? "bg-purple-600 hover:bg-purple-500" : "bg-cyan-500 hover:bg-cyan-400"
            )}
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

const AnnouncementsPage = () => {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [activeTab, setActiveTab] = useState<'public' | 'officer'>('public');

  useEffect(() => {
    fetch('/api/announcements', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    .then(res => res.json())
    .then(setAnnouncements);
  }, []);

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);
    
    // If it's a private note, we'll mark it in the content or title for now
    // In a real app, we'd have a 'type' or 'is_private' field in DB
    const payload = {
      ...data,
      content: activeTab === 'officer' ? `[OFFICER_ONLY] ${data.content}` : data.content
    };

    const res = await fetch('/api/announcements', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      toast.success('Đã đăng tin thành công');
      setIsAdding(false);
      e.currentTarget.reset();
      fetch('/api/announcements', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      .then(res => res.json())
      .then(setAnnouncements);
    }
  };

  const filteredAnnouncements = announcements.filter(ann => {
    const isPrivate = ann.content.startsWith('[OFFICER_ONLY]');
    if (activeTab === 'public') return !isPrivate;
    // Only teachers and officers can see officer-only notes
    return isPrivate && (user?.role === 'teacher' || user?.role === 'officer');
  });

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Thông báo & Trao đổi</h2>
          <p className="text-slate-400">Cập nhật tin tức và thảo luận nội bộ.</p>
        </div>
        <div className="flex items-center gap-3">
          {(user?.role === 'teacher' || user?.role === 'officer') && (
            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button 
                onClick={() => setActiveTab('public')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                  activeTab === 'public' ? "bg-cyan-500 text-white" : "text-slate-500 hover:text-slate-300"
                )}
              >
                Công khai
              </button>
              <button 
                onClick={() => setActiveTab('officer')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                  activeTab === 'officer' ? "bg-purple-600 text-white" : "text-slate-500 hover:text-slate-300"
                )}
              >
                <BrainCircuit className="w-3 h-3" /> Ban cán sự
              </button>
            </div>
          )}
          {(user?.role === 'teacher' || user?.role === 'officer') && (
            <button 
              onClick={() => setIsAdding(!isAdding)}
              className={cn(
                "px-6 py-2 text-white font-bold rounded-xl transition-all flex items-center gap-2",
                activeTab === 'officer' ? "bg-purple-600 hover:bg-purple-500" : "bg-cyan-500 hover:bg-cyan-400"
              )}
            >
              <Plus className="w-5 h-5" /> {activeTab === 'officer' ? 'Ghi chú nội bộ' : 'Đăng tin'}
            </button>
          )}
        </div>
      </header>

      <AnimatePresence>
        {isAdding && (
          <motion.section 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleAdd} className={cn(
              "p-6 rounded-2xl border space-y-4",
              activeTab === 'officer' ? "bg-purple-900/10 border-purple-500/20" : "bg-slate-900/50 border-cyan-500/20"
            )}>
              <input name="title" placeholder={activeTab === 'officer' ? "Chủ đề thảo luận nội bộ" : "Tiêu đề thông báo"} required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-cyan-400" />
              <textarea name="content" placeholder="Nội dung chi tiết..." rows={4} required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-cyan-400" />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-slate-400 hover:text-white transition-all">Hủy</button>
                <button className={cn(
                  "px-6 py-2 text-white font-bold rounded-xl",
                  activeTab === 'officer' ? "bg-purple-600" : "bg-cyan-500"
                )}>
                  {activeTab === 'officer' ? 'Lưu ghi chú' : 'Đăng ngay'}
                </button>
              </div>
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      <div className="space-y-6">
        {filteredAnnouncements.map((ann) => (
          <motion.div 
            key={ann.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn(
              "p-6 rounded-2xl border transition-all",
              activeTab === 'officer' ? "bg-purple-900/5 border-purple-500/10" : "bg-slate-900/30 border-slate-800 hover:border-cyan-500/20"
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {activeTab === 'officer' && <BrainCircuit className="w-5 h-5 text-purple-400" />}
                <h3 className="text-xl font-bold text-white">{ann.title}</h3>
              </div>
              <span className="text-xs text-slate-500">{parseSQLiteDate(ann.created_at).toLocaleString('vi-VN')}</span>
            </div>
            <p className="text-slate-400 whitespace-pre-wrap leading-relaxed">
              {ann.content.replace('[OFFICER_ONLY] ', '')}
            </p>
          </motion.div>
        ))}
        {filteredAnnouncements.length === 0 && (
          <div className="text-center py-20 text-slate-600">
            <Bell className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>Chưa có thông báo nào trong mục này.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const ReportsPage = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<User[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      try {
        const [usersRes, attRes, assRes, subRes] = await Promise.all([
          fetch('/api/users', { headers }),
          fetch('/api/attendance', { headers }),
          fetch('/api/assignments', { headers }),
          fetch('/api/submissions', { headers })
        ]);

        const [usersData, attData, assData, subData] = await Promise.all([
          usersRes.json(),
          attRes.json(),
          assRes.json(),
          subRes.json()
        ]);

        setStudents(usersData.filter((u: User) => u.role === 'student'));
        setAttendance(attData);
        setAssignments(assData);
        setSubmissions(subData);
      } catch (error) {
        console.error('Error fetching report data:', error);
        toast.error('Không thể tải dữ liệu báo cáo');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const studentStats = useMemo(() => {
    return students.map(student => {
      const studentAttendance = attendance.filter(a => a.student_id === student.id);
      const presentCount = studentAttendance.filter(a => a.status === 'present').length;
      const absentCount = studentAttendance.filter(a => a.status === 'absent_permission' || a.status === 'absent_no_permission').length;
      const lateCount = studentAttendance.filter(a => a.status === 'late').length;
      
      const totalAttendedDays = studentAttendance.length;
      const attendanceRate = totalAttendedDays > 0 ? (presentCount / totalAttendedDays) * 100 : 100;

      // Conduct Score calculation: Base 100, -5 per absent, -2 per late
      const conductScore = Math.max(0, 100 - (absentCount * 5) - (lateCount * 2));

      const studentSubmissions = submissions.filter(s => s.student_id === student.id);
      const gradedSubmissions = studentSubmissions.filter(s => s.grade !== null && s.grade !== undefined);
      const averageGrade = gradedSubmissions.length > 0 
        ? gradedSubmissions.reduce((acc, curr) => acc + parseFloat(curr.grade || '0'), 0) / gradedSubmissions.length 
        : 0;
      const completionRate = assignments.length > 0 ? (studentSubmissions.length / assignments.length) * 100 : 0;

      return {
        ...student,
        attendanceRate,
        conductScore,
        averageGrade,
        completionRate,
        totalSubmissions: studentSubmissions.length
      };
    });
  }, [students, attendance, assignments, submissions]);

  const classAverages = useMemo(() => {
    if (studentStats.length === 0) return { attendance: 0, grade: 0, completion: 0, conduct: 0 };
    return {
      attendance: studentStats.reduce((acc, curr) => acc + curr.attendanceRate, 0) / studentStats.length,
      grade: studentStats.reduce((acc, curr) => acc + curr.averageGrade, 0) / studentStats.length,
      completion: studentStats.reduce((acc, curr) => acc + curr.completionRate, 0) / studentStats.length,
      conduct: studentStats.reduce((acc, curr) => acc + curr.conductScore, 0) / studentStats.length,
    };
  }, [studentStats]);

  const gradeDistribution = useMemo(() => {
    const bins = [
      { name: '0-2', count: 0, fill: '#ef4444' },
      { name: '2-4', count: 0, fill: '#f97316' },
      { name: '4-6', count: 0, fill: '#f59e0b' },
      { name: '6-8', count: 0, fill: '#3b82f6' },
      { name: '8-10', count: 0, fill: '#10b981' },
    ];

    submissions.forEach(sub => {
      if (sub.grade !== null && sub.grade !== undefined) {
        const grade = parseFloat(sub.grade);
        if (grade < 2) bins[0].count++;
        else if (grade < 4) bins[1].count++;
        else if (grade < 6) bins[2].count++;
        else if (grade < 8) bins[3].count++;
        else bins[4].count++;
      }
    });

    return bins;
  }, [submissions]);

  const weeklyAttendanceTrend = useMemo(() => {
    const today = startOfToday();
    const last7Days = eachDayOfInterval({
      start: subDays(today, 6),
      end: today,
    });

    return last7Days.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayRecords = attendance.filter(a => a.date === dateStr);
      return {
        name: format(date, 'dd/MM'),
        present: dayRecords.filter(a => a.status === 'present').length,
        absent: dayRecords.filter(a => a.status === 'absent_permission' || a.status === 'absent_no_permission').length,
        late: dayRecords.filter(a => a.status === 'late').length,
      };
    });
  }, [attendance]);

  const handleExportCSV = () => {
    const headers = ["ID", "Họ tên", "Nề nếp (%)", "Điểm nề nếp", "Điểm TB", "Hoàn thành (%)"];
    const rows = studentStats.map(s => [
      s.id,
      s.full_name,
      s.attendanceRate.toFixed(1),
      s.conductScore,
      s.averageGrade.toFixed(2),
      s.completionRate.toFixed(1)
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.join(","))
    ].join("\n");
    
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `bao-cao-lop-${user?.class_name}-${format(new Date(), 'dd-MM-yyyy')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Đã xuất báo cáo CSV');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Báo cáo tổng hợp</h2>
          <p className="text-slate-400">Thống kê nề nếp và học tập lớp {user?.class_name}.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExportCSV}
            className="px-6 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 hover:text-cyan-400 transition-all flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Xuất CSV
          </button>
          <button 
            onClick={() => window.print()}
            className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-white font-bold rounded-xl transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(34,211,238,0.3)]"
          >
            <FileText className="w-4 h-4" /> In báo cáo
          </button>
        </div>
      </header>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="p-6 rounded-2xl bg-slate-900/50 border border-green-500/20 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400">
              <CheckCircle className="w-6 h-6" />
            </div>
            <span className="text-2xl font-bold text-white">{classAverages.attendance.toFixed(1)}%</span>
          </div>
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Tỷ lệ hiện diện</h3>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/50 border border-orange-500/20 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <span className="text-2xl font-bold text-white">{classAverages.conduct.toFixed(1)}</span>
          </div>
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Điểm nề nếp TB</h3>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/50 border border-cyan-500/20 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <TrendingUp className="w-6 h-6" />
            </div>
            <span className="text-2xl font-bold text-white">{classAverages.grade.toFixed(2)}</span>
          </div>
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Điểm trung bình</h3>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/50 border border-purple-500/20 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
              <Plus className="w-6 h-6" />
            </div>
            <span className="text-2xl font-bold text-white">{classAverages.completion.toFixed(1)}%</span>
          </div>
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Hoàn thành bài</h3>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grade Distribution */}
        <div className="p-6 rounded-3xl bg-slate-900/50 border border-slate-800 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-6">
            <BarChartIcon className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-bold text-white">Phân bổ điểm số</h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gradeDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#64748b" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                  contentStyle={{ 
                    backgroundColor: '#0f172a', 
                    border: '1px solid #1e293b',
                    borderRadius: '12px',
                    color: '#f8fafc'
                  }}
                />
                <Bar dataKey="count" name="Số lượng" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Attendance Trend */}
        <div className="p-6 rounded-3xl bg-slate-900/50 border border-slate-800 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-green-400" />
            <h3 className="text-lg font-bold text-white">Xu hướng nề nếp tuần qua</h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyAttendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#64748b" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0f172a', 
                    border: '1px solid #1e293b',
                    borderRadius: '12px',
                    color: '#f8fafc'
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="present" name="Hiện diện" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="absent" name="Vắng mặt" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" />
                <Line type="monotone" dataKey="late" name="Đi trễ" stroke="#f59e0b" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="p-6 border-b border-slate-800">
          <h3 className="text-xl font-bold text-white">Chi tiết từng học sinh</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80">
                <th className="px-6 py-4 text-sm font-semibold text-slate-400">Học sinh</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-400">Hiện diện (%)</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-400">Điểm nề nếp</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-400">Điểm TB</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-400">Hoàn thành (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {studentStats.map((student) => (
                <tr key={student.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-200">{student.full_name}</div>
                    <div className="text-xs text-slate-500">ID: {student.id}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full rounded-full",
                            student.attendanceRate > 90 ? "bg-green-500" : student.attendanceRate > 70 ? "bg-yellow-500" : "bg-red-500"
                          )}
                          style={{ width: `${student.attendanceRate}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-300">{student.attendanceRate.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded-lg text-xs font-bold",
                      student.conductScore >= 90 ? "bg-green-500/10 text-green-400" : student.conductScore >= 70 ? "bg-yellow-500/10 text-yellow-400" : "bg-red-500/10 text-red-400"
                    )}>
                      {student.conductScore}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded-lg text-xs font-bold",
                      student.averageGrade >= 8 ? "bg-green-500/10 text-green-400" : student.averageGrade >= 5 ? "bg-yellow-500/10 text-yellow-400" : "bg-red-500/10 text-red-400"
                    )}>
                      {student.averageGrade.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-300">{student.completionRate.toFixed(0)}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const LeaveRequestPage = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);

  const fetchRequests = () => {
    fetch('/api/leave-requests', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    .then(res => res.json())
    .then(setRequests);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);
    
    const res = await fetch('/api/leave-requests', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(data)
    });

    if (res.ok) {
      toast.success('Đã gửi yêu cầu xin về');
      setIsCreating(false);
      fetchRequests();
    }
  };

  const handleStatusUpdate = async (id: number, status: 'approved' | 'rejected') => {
    const res = await fetch(`/api/leave-requests/${id}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ status })
    });

    if (res.ok) {
      toast.success(status === 'approved' ? 'Đã duyệt yêu cầu' : 'Đã từ chối yêu cầu');
      fetchRequests();
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Xin phép về sớm</h2>
          <p className="text-slate-400">Gửi yêu cầu xin về và theo dõi trạng thái phê duyệt.</p>
        </div>
        {user?.role === 'student' && (
          <button 
            onClick={() => setIsCreating(!isCreating)}
            className="px-6 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(249,115,22,0.3)]"
          >
            <Plus className="w-5 h-5" /> Gửi yêu cầu
          </button>
        )}
      </header>

      <AnimatePresence>
        {isCreating && (
          <motion.section 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleCreate} className="p-6 rounded-2xl bg-slate-900/50 border border-orange-500/20 space-y-4 backdrop-blur-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input name="period" placeholder="Xin về từ tiết mấy? (VD: Tiết 3)" required className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-orange-400" />
                <input name="reason" placeholder="Lý do xin về..." required className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-orange-400" />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 text-slate-400 hover:text-white transition-all">Hủy</button>
                <button className="px-8 py-2 bg-orange-600 text-white font-bold rounded-xl shadow-[0_0_15px_rgba(249,115,22,0.4)]">Gửi ngay</button>
              </div>
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-semibold text-white">Danh sách yêu cầu</h3>
          <div className="space-y-4">
            {requests.map((req) => (
              <div key={req.id} className="p-5 rounded-2xl bg-slate-900/30 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center",
                    req.status === 'approved' ? "bg-green-500/10 text-green-400" : 
                    req.status === 'rejected' ? "bg-red-500/10 text-red-400" : "bg-orange-500/10 text-orange-400"
                  )}>
                    {req.status === 'approved' ? <FileCheck className="w-6 h-6" /> : 
                     req.status === 'rejected' ? <XCircle className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-200">{req.student_name}</span>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{req.period}</span>
                    </div>
                    <p className="text-sm text-slate-400">{req.reason}</p>
                    <p className="text-[10px] text-slate-500 mt-1">{format(parseSQLiteDate(req.created_at), 'dd/MM/yyyy HH:mm')}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {req.status === 'pending' && user?.role === 'teacher' && (
                    <>
                      <button 
                        onClick={() => handleStatusUpdate(req.id, 'approved')}
                        className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg transition-all"
                      >
                        Đồng ý
                      </button>
                      <button 
                        onClick={() => handleStatusUpdate(req.id, 'rejected')}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-all"
                      >
                        Từ chối
                      </button>
                    </>
                  )}
                  {req.status === 'approved' && (
                    <button 
                      onClick={() => setSelectedRequest(req)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-bold rounded-lg transition-all flex items-center gap-2"
                    >
                      <Printer className="w-4 h-4" /> Xem giấy phép
                    </button>
                  )}
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                    req.status === 'approved' ? "bg-green-500/10 text-green-400" : 
                    req.status === 'rejected' ? "bg-red-500/10 text-red-400" : "bg-orange-500/10 text-orange-400"
                  )}>
                    {req.status === 'approved' ? 'Đã duyệt' : req.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt'}
                  </span>
                </div>
              </div>
            ))}
            {requests.length === 0 && (
              <div className="p-10 text-center rounded-3xl border border-dashed border-slate-800">
                <p className="text-slate-500 font-medium">Chưa có yêu cầu nào.</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <AnimatePresence>
            {selectedRequest && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="p-8 rounded-3xl bg-white text-slate-900 shadow-2xl relative overflow-hidden"
              >
                {/* Watermark */}
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
                  <h1 className="text-9xl font-black rotate-45">THIN_HUB</h1>
                </div>

                <div className="relative z-10">
                  <div className="text-center border-b-2 border-slate-900 pb-6 mb-6">
                    <h4 className="text-xs font-black uppercase tracking-[0.2em] mb-1">Cộng hòa xã hội chủ nghĩa Việt Nam</h4>
                    <p className="text-[10px] font-bold underline mb-4">Độc lập - Tự do - Hạnh phúc</p>
                    <h3 className="text-2xl font-black uppercase tracking-tighter">Giấy xin phép về sớm</h3>
                  </div>

                  <div className="space-y-4 text-sm">
                    <div className="flex justify-between border-b border-slate-200 pb-2">
                      <span className="font-bold text-slate-500 uppercase text-[10px]">Học sinh:</span>
                      <span className="font-black">{selectedRequest.student_name}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 pb-2">
                      <span className="font-bold text-slate-500 uppercase text-[10px]">Lớp:</span>
                      <span className="font-black">{user?.class_name}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 pb-2">
                      <span className="font-bold text-slate-500 uppercase text-[10px]">Xin về từ:</span>
                      <span className="font-black">{selectedRequest.period}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="font-bold text-slate-500 uppercase text-[10px]">Lý do:</span>
                      <p className="italic bg-slate-50 p-3 rounded-lg border border-slate-100">{selectedRequest.reason}</p>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 pb-2">
                      <span className="font-bold text-slate-500 uppercase text-[10px]">Ngày giờ duyệt:</span>
                      <span className="font-bold">{format(parseSQLiteDate(selectedRequest.updated_at), 'HH:mm - dd/MM/yyyy')}</span>
                    </div>
                  </div>

                  <div className="mt-10 grid grid-cols-2 gap-8 text-center">
                    <div>
                      <p className="text-[10px] font-black uppercase mb-16">Người xin phép</p>
                      <p className="font-bold text-xs italic">(Ký và ghi rõ họ tên)</p>
                    </div>
                    <div className="relative flex flex-col items-center">
                      <p className="text-[10px] font-black uppercase">KT. HIỆU TRƯỞNG</p>
                      <p className="text-[10px] font-black uppercase mb-2">PHÓ HIỆU TRƯỞNG</p>
                      
                      <div className="h-24 w-full relative flex items-center justify-center my-2">
                        {/* Placeholder for the uploaded signature and stamp image */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                          <span className="text-[8px] border border-dashed border-slate-400 p-2 rounded">Chèn ảnh chữ ký vào đây</span>
                        </div>
                        <img 
                          src="https://dynamic-indigo-doks3xdrue.edgeone.app/Screenshot_20260415_095740_Chrome(1).png" 
                          alt="Chữ ký và mộc" 
                          className="max-h-full max-w-full object-contain mix-blend-multiply relative z-10" 
                          onError={(e) => e.currentTarget.style.opacity = '0'}
                        />
                      </div>

                      <p className="font-black text-sm">Phan Thành Quới</p>
                    </div>
                  </div>

                  <button 
                    onClick={() => window.print()}
                    className="w-full mt-8 py-3 bg-slate-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-all no-print"
                  >
                    <Printer className="w-4 h-4" /> In giấy phép
                  </button>
                  <button 
                    onClick={() => setSelectedRequest(null)}
                    className="w-full mt-2 py-2 text-slate-500 text-xs font-bold hover:text-slate-900 transition-all no-print"
                  >
                    Đóng
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

const ClassListPage = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<User[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');

  const fetchStudents = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    // Filter only students/officers
    setStudents(data.filter((u: User) => u.role !== 'teacher'));
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = (event.target?.result as string).split(',')[1];
        const mimeType = file.type;

        // Use import.meta.env as a fallback for process.env in Vite
        const apiKey = (process.env as any).GEMINI_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY;
        
        if (!apiKey) {
          console.error("Gemini API Key missing in process.env and import.meta.env");
          toast.error("Thiếu API Key. Vui lòng cấu hình trong Secrets.");
          setIsParsing(false);
          return;
        }

        const ai = new GoogleGenAI({ apiKey });
        const prompt = `
          Bạn là một chuyên gia trích xuất dữ liệu từ hình ảnh và tệp văn bản.
          Nhiệm vụ của bạn là phân tích tệp đính kèm (có thể là ảnh chụp danh sách lớp, tệp PDF, hoặc văn bản) và trích xuất danh sách học sinh một cách chính xác nhất.
          
          Yêu cầu định dạng đầu ra:
          Trả về một mảng JSON duy nhất chứa các đối tượng học sinh. Mỗi đối tượng PHẢI có các trường sau:
          1. "student_code": Mã học sinh (nếu có, ví dụ: "HS001"). Nếu không có, để trống.
          2. "full_name": Họ và tên đầy đủ của học sinh (ví dụ: "Nguyễn Văn A").
          3. "username": Tên đăng nhập gợi ý (viết liền không dấu, chữ thường, ví dụ: "nguyenvana").
          4. "class_name": Tên lớp học (ví dụ: "12A1"). Nếu không thấy trong tệp, hãy để trống hoặc đoán từ ngữ cảnh.
          5. "position": Chức vụ trong lớp (ví dụ: "Lớp trưởng", "Lớp phó", "Tổ trưởng"). Nếu không có, mặc định là "Học sinh".
          
          Lưu ý quan trọng:
          - Chỉ trả về JSON thuần túy, không có giải thích hay văn bản thừa.
          - Nếu tệp mờ hoặc khó đọc, hãy cố gắng hết sức để nhận diện các ký tự.
          - Đảm bảo tên đăng nhập là duy nhất và dễ nhớ.
        `;

        try {
          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [
              { parts: [{ text: prompt }, { inlineData: { data: base64, mimeType } }] }
            ],
            config: {
              responseMimeType: "application/json"
            }
          });

          const text = response.text;
          if (!text) throw new Error("Không nhận được phản hồi từ AI");
          
          // Extract JSON from markdown if present
          const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\[\s*\{[\s\S]*\}\s*\]/);
          const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
          
          const result = JSON.parse(jsonString);
          if (!Array.isArray(result)) throw new Error("Định dạng dữ liệu không hợp lệ");
          
          setImportData(result);
          setIsImporting(true);
          toast.success(`Đã tìm thấy ${result.length} học sinh!`);
        } catch (aiError: any) {
          console.error("AI Parsing error:", aiError);
          toast.error(`Lỗi AI: ${aiError.message || "Không thể phân tích tệp"}`);
        } finally {
          setIsParsing(false);
        }
      };
      reader.onerror = () => {
        toast.error("Lỗi khi đọc tệp.");
        setIsParsing(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("General error in handleBulkImport:", error);
      toast.error("Có lỗi xảy ra. Vui lòng thử lại.");
      setIsParsing(false);
    }
  };

  const confirmImport = async () => {
    try {
      const res = await fetch('/api/users/bulk', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ students: importData })
      });
      if (res.ok) {
        toast.success(`Đã nhập thành công ${importData.length} học sinh!`);
        setIsImporting(false);
        setImportData([]);
        fetchStudents();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Lỗi khi nhập dữ liệu');
      }
    } catch (e) {
      toast.error('Lỗi kết nối máy chủ');
    }
  };

  const handleManualAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);
    
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          school_name: user?.school_name || 'Thinhub'
        })
      });
      if (res.ok) {
        toast.success('Đã thêm học sinh mới!');
        setIsAddingManual(false);
        fetchStudents();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Lỗi khi thêm học sinh');
      }
    } catch (e) {
      toast.error('Lỗi kết nối');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingUser) return;
    const formData = new FormData(e.currentTarget);
    const res = await fetch(`/api/users/${editingUser.id}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(Object.fromEntries(formData))
    });
    if (res.ok) {
      toast.success('Đã cập nhật thông tin');
      setEditingUser(null);
      fetchStudents();
    }
  };

  const downloadAccounts = () => {
    if (selectedClass === 'all') {
      toast.error('Vui lòng chọn một lớp cụ thể để tải tài khoản');
      return;
    }
    
    const classStudents = students.filter(s => s.class_name === selectedClass);
    if (classStudents.length === 0) {
      toast.error('Lớp này chưa có học sinh nào');
      return;
    }

    let content = `DANH SÁCH TÀI KHOẢN LỚP ${selectedClass}\n`;
    content += `=========================================\n\n`;
    
    classStudents.forEach((student, index) => {
      content += `${index + 1}. Họ tên: ${student.full_name}\n`;
      if (student.student_code) content += `   Mã HS: ${student.student_code}\n`;
      content += `   Tên đăng nhập: ${student.username}\n`;
      content += `   Mật khẩu: ${student.default_password || '*** (Đã đổi)'}\n`;
      content += `-----------------------------------------\n`;
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `account_${selectedClass}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Đã tải xuống tài khoản lớp ${selectedClass}`);
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         s.username.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = selectedClass === 'all' || s.class_name === selectedClass;
    return matchesSearch && matchesClass;
  });

  const classes = Array.from(new Set(students.map(s => s.class_name))).sort();

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Danh sách lớp học</h2>
          <p className="text-slate-400">Quản lý thông tin học sinh và ban cán sự lớp.</p>
        </div>
        <div className="flex gap-3">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleBulkImport} 
            className="hidden" 
            accept="image/*,.pdf,.txt,.csv"
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isParsing}
            className="flex items-center gap-2 px-6 py-3 bg-primary/10 text-primary border border-primary/20 rounded-2xl font-bold hover:bg-primary hover:text-white transition-all disabled:opacity-50 no-print"
          >
            {isParsing ? <RotateCcw className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
            NHẬP TỪ ẢNH/FILE
          </button>
          <button 
            onClick={() => setIsAddingManual(true)}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl font-bold shadow-[0_0_20px_var(--primary-glow)] hover:scale-105 transition-all no-print"
          >
            <Plus className="w-5 h-5" /> THÊM THỦ CÔNG
          </button>
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-2xl font-bold hover:bg-slate-700 transition-all no-print"
          >
            <Printer className="w-5 h-5" /> IN DANH SÁCH
          </button>
          <button 
            onClick={downloadAccounts}
            className="flex items-center gap-2 px-6 py-3 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-2xl font-bold hover:bg-cyan-500 hover:text-white transition-all no-print"
            title="Tải xuống tài khoản học sinh cho lớp đang chọn"
          >
            <Download className="w-5 h-5" /> TÀI KHOẢN HỌC SINH
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 no-print">
        <div className="md:col-span-3 relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Tìm kiếm học sinh theo tên hoặc username..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl pl-14 pr-6 py-4 text-white focus:outline-none focus:border-primary transition-all"
          />
        </div>
        <select 
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="bg-slate-900/50 border border-slate-800 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-primary transition-all"
        >
          <option value="all">Tất cả các lớp</option>
          {classes.map(c => <option key={c} value={c}>Lớp {c}</option>)}
        </select>
      </div>

      <div className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800 backdrop-blur-md overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Học sinh</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Lớp</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Vai trò</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Chức vụ</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Mật khẩu</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right no-print">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filteredStudents.map((u) => (
              <tr key={u.id} className="group hover:bg-slate-800/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-200">{u.full_name}</div>
                  <div className="text-[10px] text-slate-500 uppercase">
                    @{u.username} {u.student_code && `| ID: ${u.student_code}`}
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-400 text-sm">{u.class_name}</td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-2 py-1 rounded text-[10px] font-bold uppercase",
                    u.role === 'officer' ? "bg-cyan-500/10 text-cyan-400" : "bg-slate-800 text-slate-400"
                  )}>
                    {u.role === 'officer' ? 'Ban cán sự' : 'Học sinh'}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-400 text-sm">{u.position || '-'}</td>
                <td className="px-6 py-4 text-slate-400 text-sm font-mono">{u.default_password || '***'}</td>
                <td className="px-6 py-4 text-right no-print">
                  <button 
                    onClick={() => setEditingUser(u)} 
                    className="px-4 py-2 rounded-lg bg-primary/10 text-primary transition-all hover:bg-primary hover:text-white text-xs font-bold"
                  >
                    Chỉnh sửa
                  </button>
                </td>
              </tr>
            ))}
            {filteredStudents.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-20 text-center text-slate-500 italic">
                  Không tìm thấy học sinh nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {isImporting && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-primary/30 p-8 rounded-3xl w-full max-w-2xl shadow-[0_0_50px_rgba(34,211,238,0.1)]"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <FileCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Xác nhận nhập dữ liệu</h3>
                    <p className="text-xs text-slate-500">Tìm thấy {importData.length} học sinh từ tệp của bạn.</p>
                  </div>
                </div>
                <button onClick={() => setIsImporting(false)} className="text-slate-500 hover:text-white"><X className="w-6 h-6" /></button>
              </div>
              
              <div className="max-h-[400px] overflow-y-auto mb-8 pr-2 custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Họ và tên</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tên đăng nhập</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Lớp</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Chức vụ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {importData.map((item, idx) => (
                      <tr key={idx} className="text-sm">
                        <td className="px-4 py-3 text-slate-200">{item.full_name}</td>
                        <td className="px-4 py-3 text-slate-400">@{item.username}</td>
                        <td className="px-4 py-3 text-slate-400">{item.class_name}</td>
                        <td className="px-4 py-3 text-slate-400">{item.position}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="flex justify-end gap-3">
                <button onClick={() => setIsImporting(false)} className="px-6 py-3 text-slate-400 hover:text-white font-bold transition-all">Hủy bỏ</button>
                <button 
                  onClick={confirmImport}
                  className="px-8 py-3 bg-primary text-white font-bold rounded-2xl shadow-[0_0_20px_var(--color-primary-glow)] hover:scale-105 transition-all"
                >
                  XÁC NHẬN NHẬP
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isAddingManual && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-primary/30 p-8 rounded-3xl w-full max-w-md shadow-[0_0_50px_rgba(34,211,238,0.1)]"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Plus className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white">Thêm học sinh thủ công</h3>
              </div>
              
              <form onSubmit={handleManualAdd} className="space-y-5">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Mã học sinh</label>
                  <input name="student_code" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Họ và tên</label>
                  <input name="full_name" required className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Tên đăng nhập</label>
                  <input name="username" required className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Lớp</label>
                    <input name="class_name" required className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Vai trò</label>
                    <select name="role" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary transition-all">
                      <option value="student">Học sinh</option>
                      <option value="officer">Ban cán sự</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Chức vụ</label>
                  <input name="position" placeholder="vd: Lớp trưởng..." className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary transition-all" />
                </div>
                
                <div className="flex justify-end gap-3 mt-10">
                  <button type="button" onClick={() => setIsAddingManual(false)} className="px-6 py-3 text-slate-400 hover:text-white font-bold transition-all">Hủy</button>
                  <button className="px-8 py-3 bg-primary text-white font-bold rounded-2xl shadow-[0_0_20px_var(--color-primary-glow)] hover:scale-105 transition-all">Thêm mới</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {editingUser && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-primary/30 p-8 rounded-3xl w-full max-w-md shadow-[0_0_50px_rgba(34,211,238,0.1)]"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Settings className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white">Cập nhật thông tin</h3>
              </div>
              
              <form onSubmit={handleUpdateUser} className="space-y-5">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Mã học sinh</label>
                  <input name="student_code" defaultValue={editingUser.student_code} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Họ và tên</label>
                  <input name="full_name" defaultValue={editingUser.full_name} required className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Tên đăng nhập</label>
                  <input name="username" defaultValue={editingUser.username} required className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Mật khẩu mới (để trống nếu không đổi)</label>
                  <input name="password" type="password" placeholder="Nhập mật khẩu mới..." className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Lớp</label>
                    <input name="class_name" defaultValue={editingUser.class_name} required className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Vai trò</label>
                    <select name="role" defaultValue={editingUser.role} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary transition-all">
                      <option value="student">Học sinh</option>
                      <option value="officer">Ban cán sự</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Chức vụ</label>
                  <input name="position" defaultValue={editingUser.position} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary transition-all" />
                </div>
                
                <div className="flex justify-end gap-3 mt-10">
                  <button type="button" onClick={() => setEditingUser(null)} className="px-6 py-3 text-slate-400 hover:text-white font-bold transition-all">Hủy</button>
                  <button className="px-8 py-3 bg-primary text-white font-bold rounded-2xl shadow-[0_0_20px_var(--color-primary-glow)] hover:scale-105 transition-all">Lưu thay đổi</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const SettingsPage = () => {
  const { user } = useAuth();
  const { primaryColor, setPrimaryColor, fontFamily, setFontFamily, themeId, setThemeId } = useTheme();
  const [activeTab, setActiveTab] = useState<'profile' | 'theme' | 'class' | 'password'>('profile');
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const handleUpdateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const res = await fetch(`/api/users/${user?.id}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(Object.fromEntries(formData))
    });
    if (res.ok) {
      toast.success('Đã cập nhật thông tin');
      // Update local storage user data
      const updatedUser = { ...user, ...Object.fromEntries(formData) };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      window.location.reload(); // Refresh to update context
    }
  };

  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const currentPassword = formData.get('currentPassword') as string;
    const newPassword = formData.get('newPassword') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu mới không khớp');
      return;
    }

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const result = await res.json();
      if (res.ok) {
        toast.success('Đổi mật khẩu thành công');
        (e.target as HTMLFormElement).reset();
      } else {
        toast.error(result.error || 'Có lỗi xảy ra');
      }
    } catch (e) {
      toast.error('Lỗi kết nối máy chủ');
    }
  };

  const colors = [
    { name: 'Teal', value: '#14b8a6' },
    { name: 'Cyan', value: '#22d3ee' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Purple', value: '#a855f7' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Green', value: '#10b981' },
    { name: 'Orange', value: '#f59e0b' },
  ];

  const fonts = [
    { name: 'Inter', value: 'Inter' },
    { name: 'Space Grotesk', value: 'Space Grotesk' },
    { name: 'Outfit', value: 'Outfit' },
  ];

  const tabs = [
    { id: 'profile', label: 'Trang cá nhân', icon: UserCircle },
    { id: 'password', label: 'Đổi mật khẩu', icon: ShieldCheck },
    { id: 'theme', label: 'Giao diện', icon: Palette },
    ...(user?.role === 'teacher' || user?.role === 'officer' ? [{ id: 'class', label: 'Quản lý lớp', icon: Users }] : []),
  ];

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-bold text-white mb-2">Cài đặt hệ thống</h2>
        <p className="text-slate-400">Tùy chỉnh trải nghiệm và quản lý thông tin của bạn.</p>
      </header>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Tab Navigation */}
        <div className="lg:w-64 w-full flex lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0 sticky top-0 lg:top-24 z-20 bg-slate-950/50 backdrop-blur-sm lg:bg-transparent lg:backdrop-blur-none p-2 lg:p-0 rounded-2xl">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all whitespace-nowrap flex-1 lg:flex-none",
                activeTab === tab.id 
                  ? "bg-primary text-white shadow-[0_0_15px_var(--color-primary-glow)]" 
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              )}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 w-full min-w-0">
          <AnimatePresence mode="wait">
            {activeTab === 'profile' && (
              <motion.section
                key="profile"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800 backdrop-blur-md space-y-8"
              >
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                    <UserCircle className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Thông tin cá nhân</h3>
                    <p className="text-sm text-slate-500">Thông tin tài khoản của bạn trên hệ thống.</p>
                  </div>
                </div>

                <form onSubmit={handleUpdateUser} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Họ và tên</label>
                      <input 
                        name="full_name" 
                        defaultValue={user?.full_name} 
                        required 
                        className="w-full px-5 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-slate-200 font-medium focus:outline-none focus:border-primary transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tên trường</label>
                      <input 
                        name="school_name" 
                        defaultValue={user?.school_name} 
                        required 
                        className="w-full px-5 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-slate-200 font-medium focus:outline-none focus:border-primary transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tên đăng nhập</label>
                      <input 
                        name="username" 
                        defaultValue={user?.username} 
                        required 
                        className="w-full px-5 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-slate-400 font-medium focus:outline-none focus:border-primary transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vai trò</label>
                      <div className="px-5 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-slate-500 font-medium capitalize cursor-not-allowed">
                        {user?.role === 'teacher' ? 'Giáo viên' : user?.role === 'officer' ? 'Ban cán sự' : 'Học sinh'}
                      </div>
                      <input type="hidden" name="role" value={user?.role} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lớp học</label>
                      <input 
                        name="class_name" 
                        defaultValue={user?.class_name} 
                        required 
                        className="w-full px-5 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-slate-200 font-medium focus:outline-none focus:border-primary transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Chức vụ</label>
                      <input 
                        name="position" 
                        defaultValue={user?.position} 
                        className="w-full px-5 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-slate-200 font-medium focus:outline-none focus:border-primary transition-all"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button type="submit" className="px-8 py-3 bg-primary text-white font-bold rounded-2xl shadow-[0_0_20px_var(--color-primary-glow)] hover:scale-105 transition-all">
                      Lưu thay đổi
                    </button>
                  </div>
                </form>
              </motion.section>
            )}

            {activeTab === 'password' && (
              <motion.section
                key="password"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800 backdrop-blur-md space-y-8"
              >
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Đổi mật khẩu</h3>
                    <p className="text-sm text-slate-500">Cập nhật mật khẩu để bảo vệ tài khoản của bạn.</p>
                  </div>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-6 max-w-md">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mật khẩu hiện tại</label>
                    <input 
                      type="password" 
                      name="currentPassword" 
                      className="w-full px-5 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-slate-200 focus:outline-none focus:border-primary transition-all" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mật khẩu mới</label>
                    <input 
                      type="password" 
                      name="newPassword" 
                      required 
                      className="w-full px-5 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-slate-200 focus:outline-none focus:border-primary transition-all" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Xác nhận mật khẩu mới</label>
                    <input 
                      type="password" 
                      name="confirmPassword" 
                      required 
                      className="w-full px-5 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-slate-200 focus:outline-none focus:border-primary transition-all" 
                    />
                  </div>
                  <button type="submit" className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-[0_0_20px_var(--primary-glow)] hover:shadow-[0_0_30px_var(--primary-glow)] transition-all active:scale-95">
                    CẬP NHẬT MẬT KHẨU
                  </button>
                </form>
              </motion.section>
            )}

            {activeTab === 'theme' && (
              <motion.section
                key="theme"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800 backdrop-blur-md space-y-10"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                    <Palette className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Tùy chỉnh giao diện</h3>
                    <p className="text-sm text-slate-500">Thay đổi màu sắc và phông chữ theo sở thích.</p>
                  </div>
                </div>

                <div className="space-y-8">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-6">Chủ đề giao diện (Theme Presets)</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {THEMES.map((theme) => (
                        <button
                          key={theme.id}
                          onClick={() => setThemeId(theme.id)}
                          className={cn(
                            "p-5 rounded-3xl border text-left transition-all group",
                            themeId === theme.id 
                              ? "bg-white/10 border-white/20 shadow-2xl shadow-black/50" 
                              : "bg-slate-950/50 border-white/5 hover:border-white/10"
                          )}
                        >
                          <div className="w-10 h-10 rounded-2xl mb-4 flex items-center justify-center" style={{ backgroundColor: theme.color }}>
                            {themeId === theme.id && <Sparkles className="w-5 h-5 text-white" />}
                          </div>
                          <span className={cn(
                            "text-sm font-bold block",
                            themeId === theme.id ? "text-white" : "text-slate-400 group-hover:text-slate-200"
                          )}>
                            {theme.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-6">Màu sắc chủ đạo (Tùy chỉnh)</label>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
                      {colors.map((c) => (
                        <button
                          key={c.value}
                          onClick={() => setPrimaryColor(c.value)}
                          className={cn(
                            "group relative w-full aspect-square rounded-2xl border-2 transition-all duration-300",
                            primaryColor === c.value 
                              ? "border-white scale-110 shadow-[0_0_20px_var(--color-primary-glow)]" 
                              : "border-transparent opacity-60 hover:opacity-100 hover:scale-105"
                          )}
                          style={{ backgroundColor: c.value }}
                        >
                          {primaryColor === c.value && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <CheckCircle className="w-6 h-6 text-white drop-shadow-md" />
                            </div>
                          )}
                          <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-500 uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                            {c.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-6">Phông chữ hệ thống</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {fonts.map((f) => (
                        <button
                          key={f.value}
                          onClick={() => setFontFamily(f.value)}
                          className={cn(
                            "px-6 py-5 rounded-2xl border-2 text-left transition-all duration-300",
                            fontFamily === f.value 
                              ? "bg-primary/10 border-primary text-primary shadow-[0_0_15px_var(--color-primary-glow)]" 
                              : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                          )}
                          style={{ fontFamily: f.value }}
                        >
                          <div className="text-lg font-bold mb-1">{f.name}</div>
                          <div className="text-[10px] opacity-60 uppercase tracking-widest">The quick brown fox</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.section>
            )}

            {activeTab === 'class' && (
              <motion.section
                key="class"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800 backdrop-blur-md space-y-8"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                    <Users className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Quản lý lớp học</h3>
                    <p className="text-sm text-slate-500">Quản lý danh sách học sinh và ban cán sự.</p>
                  </div>
                </div>

                <div className="p-10 text-center rounded-3xl border border-dashed border-slate-800 bg-slate-950/30">
                  <GraduationCap className="w-16 h-16 text-slate-700 mx-auto mb-6" />
                  <h4 className="text-xl font-bold text-white mb-4">Chuyển đến trang Quản lý lớp</h4>
                  <p className="text-slate-400 max-w-md mx-auto mb-8">
                    Tính năng quản lý lớp học đã được chuyển sang một trang riêng biệt để tối ưu hóa không gian làm việc và trải nghiệm người dùng.
                  </p>
                  <Link 
                    to="/class-list"
                    className="inline-flex items-center gap-3 px-8 py-4 bg-primary text-white font-black rounded-2xl shadow-[0_0_20px_var(--color-primary-glow)] hover:scale-105 transition-all"
                  >
                    TRUY CẬP DANH SÁCH LỚP <ChevronRight className="w-5 h-5" />
                  </Link>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-primary/30 p-8 rounded-3xl w-full max-w-md shadow-[0_0_50px_rgba(34,211,238,0.1)]"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Settings className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white">Cập nhật thông tin</h3>
              </div>
              
              <form onSubmit={handleUpdateUser} className="space-y-5">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Họ và tên</label>
                  <input name="full_name" defaultValue={editingUser.full_name} required className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Tên trường</label>
                  <input name="school_name" defaultValue={editingUser.school_name} required className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Vai trò</label>
                  <select name="role" defaultValue={editingUser.role} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary transition-all">
                    <option value="student">Học sinh</option>
                    <option value="officer">Ban cán sự</option>
                    <option value="teacher">Giáo viên</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Chức vụ</label>
                  <input name="position" defaultValue={editingUser.position} placeholder="vd: Lớp trưởng, Lớp phó..." className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary transition-all" />
                </div>
                
                <div className="flex justify-end gap-3 mt-10">
                  <button type="button" onClick={() => setEditingUser(null)} className="px-6 py-3 text-slate-400 hover:text-white font-bold transition-all">Hủy</button>
                  <button className="px-8 py-3 bg-primary text-white font-bold rounded-2xl shadow-[0_0_20px_var(--color-primary-glow)] hover:scale-105 transition-all">Lưu thay đổi</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const LoginPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [forgotPasswordState, setForgotPasswordState] = useState<'none' | 'request' | 'verify'>('none');
  const [forgotUsername, setForgotUsername] = useState('');
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('rememberMe') === 'true');
  const [savedUsername, setSavedUsername] = useState(() => localStorage.getItem('savedUsername') || '');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleForgotPasswordRequest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      const result = await res.json();
      if (res.ok) {
        setForgotUsername(username);
        setForgotPasswordState('verify');
        toast.success(`Mã xác nhận: ${result.demo_code}`, { duration: 10000 }); // Demo purposes
      } else {
        toast.error(result.error || 'Có lỗi xảy ra');
      }
    } catch (e) {
      toast.error('Lỗi kết nối máy chủ');
    }
  };

  const handleForgotPasswordVerify = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const code = formData.get('code') as string;
    
    try {
      const res = await fetch('/api/auth/verify-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: forgotUsername, code })
      });
      const result = await res.json();
      if (res.ok) {
        login(result.token, result.user);
        toast.success('Đăng nhập bằng mã xác nhận thành công!');
        navigate('/');
      } else {
        toast.error(result.error || 'Mã xác nhận không đúng');
      }
    } catch (e) {
      toast.error('Lỗi kết nối máy chủ');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);
    
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      const result = await res.json();
      if (res.ok) {
        if (isLogin) {
          if (rememberMe) {
            localStorage.setItem('savedUsername', data.username as string);
            localStorage.setItem('rememberMe', 'true');
          } else {
            localStorage.removeItem('savedUsername');
            localStorage.setItem('rememberMe', 'false');
          }
          login(result.token, result.user);
          toast.success('Đăng nhập thành công!');
          navigate('/');
        } else {
          toast.success('Đăng ký thành công! Hãy đăng nhập.');
          setIsLogin(true);
        }
      } else {
        toast.error(result.error || 'Có lỗi xảy ra');
      }
    } catch (e) {
      console.error('Auth error:', e);
      toast.error('Lỗi kết nối máy chủ hoặc phản hồi không hợp lệ');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden transition-all duration-1000">
      {/* Cinematic Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 blur-[150px] rounded-full" />
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-10 flex flex-col items-center">
          <Logo className="w-24 h-24 mb-6 drop-shadow-[0_0_30px_rgba(var(--color-primary),0.5)]" />
          <h1 className="text-4xl font-black text-white mb-2 tracking-tighter">THIN_HUB 4.0</h1>
          <p className="text-slate-400 font-medium">Smart Tools for Smart Students</p>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 p-8 rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          {forgotPasswordState === 'none' ? (
            <>
              <h2 className="text-2xl font-bold text-white mb-8 text-center">
                {isLogin ? 'Đăng nhập hệ thống' : 'Đăng ký tài khoản'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-5">
                {!isLogin && (
                  <div className="space-y-5">
                    <input name="full_name" placeholder="Họ và tên" required className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all" />
                    <input name="school_name" placeholder="Tên trường học" required className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary transition-all" />
                    <div className="grid grid-cols-2 gap-4">
                      <select name="role" required className="bg-slate-950/50 border border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary transition-all">
                        <option value="student">Học sinh</option>
                        <option value="officer">Ban cán sự</option>
                        <option value="teacher">Giáo viên</option>
                      </select>
                      <input name="class_name" placeholder="Lớp (vd: 12A1)" required className="bg-slate-950/50 border border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary transition-all" />
                    </div>
                  </div>
                )}
                <input 
                  name="username" 
                  placeholder="Tên đăng nhập" 
                  defaultValue={isLogin ? savedUsername : ''}
                  required 
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary transition-all" 
                />
                <input name="password" type="password" placeholder="Mật khẩu" className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary transition-all" />
                
                {isLogin && (
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="remember" 
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-primary focus:ring-primary" 
                      />
                      <label htmlFor="remember" className="text-sm text-slate-400 cursor-pointer">Ghi nhớ</label>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setForgotPasswordState('request')}
                      className="text-sm text-primary hover:text-white transition-all font-medium"
                    >
                      Quên mật khẩu?
                    </button>
                  </div>
                )}

                <button className="w-full py-4 bg-gradient-to-r from-primary to-blue-600 text-white font-black rounded-2xl shadow-[0_0_20px_var(--primary-glow)] hover:shadow-[0_0_30px_var(--primary-glow)] transition-all active:scale-95 mt-4">
                  {isLogin ? 'ĐĂNG NHẬP' : 'ĐĂNG KÝ'}
                </button>
              </form>

              <div className="mt-8 text-center">
                <button 
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-slate-400 hover:text-white font-bold transition-all"
                >
                  {isLogin ? 'Chưa có tài khoản? Đăng ký ngay' : 'Đã có tài khoản? Đăng nhập'}
                </button>
              </div>
            </>
          ) : forgotPasswordState === 'request' ? (
            <>
              <h2 className="text-2xl font-bold text-white mb-4 text-center">Quên mật khẩu</h2>
              <p className="text-slate-400 text-center mb-8 text-sm">Nhập tên đăng nhập của bạn để nhận mã xác nhận đăng nhập.</p>
              
              <form onSubmit={handleForgotPasswordRequest} className="space-y-5">
                <input 
                  name="username" 
                  placeholder="Tên đăng nhập" 
                  required 
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary transition-all" 
                />
                <button className="w-full py-4 bg-gradient-to-r from-primary to-blue-600 text-white font-black rounded-2xl shadow-[0_0_20px_var(--primary-glow)] hover:shadow-[0_0_30px_var(--primary-glow)] transition-all active:scale-95">
                  GỬI MÃ XÁC NHẬN
                </button>
              </form>
              <div className="mt-6 text-center">
                <button 
                  onClick={() => setForgotPasswordState('none')}
                  className="text-slate-400 hover:text-white font-bold transition-all"
                >
                  Quay lại đăng nhập
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-white mb-4 text-center">Nhập mã xác nhận</h2>
              <p className="text-slate-400 text-center mb-8 text-sm">Nhập mã 6 số bạn vừa nhận được để đăng nhập.</p>
              
              <form onSubmit={handleForgotPasswordVerify} className="space-y-5">
                <input 
                  name="code" 
                  placeholder="Mã 6 số" 
                  required 
                  maxLength={6}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary transition-all text-center text-2xl tracking-[0.5em] font-mono" 
                />
                <button className="w-full py-4 bg-gradient-to-r from-primary to-blue-600 text-white font-black rounded-2xl shadow-[0_0_20px_var(--primary-glow)] hover:shadow-[0_0_30px_var(--primary-glow)] transition-all active:scale-95">
                  XÁC NHẬN ĐĂNG NHẬP
                </button>
              </form>
              <div className="mt-6 text-center">
                <button 
                  onClick={() => setForgotPasswordState('none')}
                  className="text-slate-400 hover:text-white font-bold transition-all"
                >
                  Quay lại đăng nhập
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const PremiumPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isPro = user?.role === 'teacher' || user?.is_pro;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('success')) {
      toast.success('Thanh toán thành công! Chào mừng bạn đến với THIN_HUB Pro.');
      // Remove query params
      navigate('/premium', { replace: true });
    }
    if (params.get('canceled')) {
      toast.error('Thanh toán đã bị hủy.');
      navigate('/premium', { replace: true });
    }
  }, [location, navigate]);

  const handleUpgrade = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await res.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || 'Có lỗi xảy ra khi tạo phiên thanh toán');
      }
    } catch (error) {
      console.error(error);
      toast.error('Không thể kết nối đến máy chủ thanh toán');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <header className="text-center space-y-4 py-12">
        <div className="w-20 h-20 mx-auto bg-gradient-to-br from-amber-400 to-orange-600 rounded-3xl flex items-center justify-center shadow-[0_0_40px_rgba(251,191,36,0.5)]">
          <Crown className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight">
          Nâng cấp lên <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">THIN_HUB Pro</span>
        </h2>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto">
          Mở khóa toàn bộ sức mạnh của AI, phân tích học tập chuyên sâu và các tính năng độc quyền giúp bạn bứt phá điểm số.
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* Basic Plan */}
        <div className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800 flex flex-col">
          <h3 className="text-2xl font-bold text-white mb-2">Cơ bản</h3>
          <div className="text-4xl font-black text-white mb-6">Miễn phí</div>
          <ul className="space-y-4 mb-8 flex-1">
            <li className="flex items-center gap-3 text-slate-300">
              <CheckCircle className="w-5 h-5 text-slate-500" />
              <span>Xem thời khóa biểu & thông báo</span>
            </li>
            <li className="flex items-center gap-3 text-slate-300">
              <CheckCircle className="w-5 h-5 text-slate-500" />
              <span>Nộp bài tập cơ bản</span>
            </li>
            <li className="flex items-center gap-3 text-slate-300">
              <CheckCircle className="w-5 h-5 text-slate-500" />
              <span>Sử dụng ThinAI (Giới hạn 5 lần/ngày)</span>
            </li>
          </ul>
          <button className="w-full py-4 rounded-2xl bg-slate-800 text-white font-bold hover:bg-slate-700 transition-all cursor-default">
            Đang sử dụng
          </button>
        </div>

        {/* Pro Plan */}
        <div className="p-8 rounded-3xl bg-gradient-to-b from-amber-500/10 to-orange-600/10 border border-amber-500/50 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-black px-4 py-1 rounded-bl-2xl uppercase tracking-wider">
            Phổ biến nhất
          </div>
          <h3 className="text-2xl font-bold text-amber-400 mb-2">Pro</h3>
          <div className="text-4xl font-black text-white mb-2">49.000đ<span className="text-lg text-slate-400 font-medium">/tháng</span></div>
          <p className="text-sm text-amber-400/80 mb-6 font-medium">Thanh toán 490.000đ/năm (Tiết kiệm 15%)</p>
          <ul className="space-y-4 mb-8 flex-1">
            <li className="flex items-center gap-3 text-slate-200">
              <CheckCircle className="w-5 h-5 text-amber-400" />
              <span>Mọi tính năng của gói Cơ bản</span>
            </li>
            <li className="flex items-center gap-3 text-slate-200">
              <CheckCircle className="w-5 h-5 text-amber-400" />
              <span>Sử dụng ThinAI <strong>Không giới hạn</strong></span>
            </li>
            <li className="flex items-center gap-3 text-slate-200">
              <CheckCircle className="w-5 h-5 text-amber-400" />
              <span>Phân tích điểm số & Học lực chuyên sâu</span>
            </li>
            <li className="flex items-center gap-3 text-slate-200">
              <CheckCircle className="w-5 h-5 text-amber-400" />
              <span>Lộ trình học tập AI cá nhân hóa</span>
            </li>
            <li className="flex items-center gap-3 text-slate-200">
              <CheckCircle className="w-5 h-5 text-amber-400" />
              <span>Huy hiệu Pro nổi bật trên hồ sơ</span>
            </li>
          </ul>
          {isPro ? (
            <button className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-black shadow-[0_0_20px_rgba(251,191,36,0.4)] cursor-default">
              BẠN ĐANG SỬ DỤNG GÓI PRO
            </button>
          ) : (
            <button 
              onClick={handleUpgrade}
              disabled={isLoading}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-black shadow-[0_0_20px_rgba(251,191,36,0.4)] hover:shadow-[0_0_30px_rgba(251,191,36,0.6)] transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              {isLoading ? 'ĐANG XỬ LÝ...' : 'NÂNG CẤP NGAY'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const FocusRoom = () => {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const { user } = useAuth();
  const isPro = user?.role === 'teacher' || user?.is_pro;

  useEffect(() => {
    let interval: any = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(timeLeft => timeLeft - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      toast.success("Hết giờ! Bạn đã hoàn thành một phiên tập trung.");
      // Could add XP here
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const toggleTimer = () => setIsActive(!isActive);
  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(25 * 60);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", isPro ? "bg-amber-500/20 text-amber-400" : "bg-primary/20 text-primary")}>
          <Timer className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Góc tập trung</h1>
          <p className="text-slate-400">Sử dụng phương pháp Pomodoro để tăng hiệu suất</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className={cn("p-10 rounded-3xl border flex flex-col items-center justify-center relative overflow-hidden", isPro ? "bg-amber-950/20 border-amber-500/20" : "bg-slate-900/50 border-white/5")}>
          <div className={cn("absolute inset-0 opacity-20 blur-3xl", isPro ? "bg-amber-500/20" : "bg-primary/20")} />
          
          <div className="relative z-10 text-center">
            <div className={cn("text-[8rem] font-black tracking-tighter leading-none mb-8", isPro ? "text-amber-400 drop-shadow-[0_0_30px_rgba(251,191,36,0.3)]" : "text-primary drop-shadow-[0_0_30px_rgba(var(--color-primary),0.3)]")}>
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </div>
            
            <div className="flex items-center justify-center gap-4">
              <button 
                onClick={toggleTimer}
                className={cn("w-16 h-16 rounded-full flex items-center justify-center transition-all hover:scale-110", isPro ? "bg-amber-500 text-slate-950 shadow-[0_0_20px_rgba(251,191,36,0.4)]" : "bg-primary text-slate-950 shadow-[0_0_20px_rgba(var(--color-primary),0.4)]")}
              >
                {isActive ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
              </button>
              <button 
                onClick={resetTimer}
                className="w-16 h-16 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center transition-all hover:bg-slate-700 hover:scale-110"
              >
                <RotateCw className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className={cn("p-6 rounded-3xl border", isPro ? "bg-amber-950/10 border-amber-500/10" : "bg-slate-900/30 border-white/5")}>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Target className={cn("w-5 h-5", isPro ? "text-amber-400" : "text-primary")} /> Mục tiêu hiện tại
            </h3>
            <input 
              type="text" 
              placeholder="Bạn muốn tập trung vào việc gì?" 
              className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          
          <div className={cn("p-6 rounded-3xl border", isPro ? "bg-amber-950/10 border-amber-500/10" : "bg-slate-900/30 border-white/5")}>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Zap className={cn("w-5 h-5", isPro ? "text-amber-400" : "text-primary")} /> Thống kê hôm nay
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-950/50 rounded-xl p-4 border border-white/5">
                <p className="text-sm text-slate-400 mb-1">Số phiên</p>
                <p className="text-2xl font-bold text-white">0</p>
              </div>
              <div className="bg-slate-950/50 rounded-xl p-4 border border-white/5">
                <p className="text-sm text-slate-400 mb-1">Thời gian</p>
                <p className="text-2xl font-bold text-white">0p</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Flashcards = () => {
  const { user } = useAuth();
  const isPro = user?.role === 'teacher' || user?.is_pro;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", isPro ? "bg-amber-500/20 text-amber-400" : "bg-primary/20 text-primary")}>
          <Layers className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Thẻ ghi nhớ AI</h1>
          <p className="text-slate-400">Học từ vựng và khái niệm nhanh chóng</p>
        </div>
      </div>

      <div className={cn("p-12 rounded-3xl border text-center", isPro ? "bg-amber-950/10 border-amber-500/20" : "bg-slate-900/50 border-white/5")}>
        <Sparkles className={cn("w-16 h-16 mx-auto mb-6", isPro ? "text-amber-400" : "text-primary")} />
        <h2 className="text-2xl font-bold text-white mb-4">Tính năng đang được phát triển</h2>
        <p className="text-slate-400 max-w-md mx-auto mb-8">
          Hệ thống AI đang học cách tạo ra những bộ thẻ ghi nhớ tốt nhất từ tài liệu của bạn. Tính năng này sẽ sớm ra mắt!
        </p>
        <button className={cn("px-6 py-3 rounded-xl font-bold text-slate-950 transition-all hover:scale-105", isPro ? "bg-amber-400" : "bg-primary")}>
          Nhận thông báo khi ra mắt
        </button>
      </div>
    </div>
  );
};

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { token } = useAuth();
  return token ? <>{children}</> : <Navigate to="/login" />;
};

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Toaster position="top-right" toastOptions={{
            style: { background: '#0f172a', color: '#fff', border: '1px solid rgba(34,211,238,0.2)' }
          }} />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
            <Route path="/attendance" element={<PrivateRoute><Layout><AttendancePage /></Layout></PrivateRoute>} />
            <Route path="/notifications" element={<PrivateRoute><Layout><NotificationCenterPage /></Layout></PrivateRoute>} />
            <Route path="/leave" element={<PrivateRoute><Layout><LeaveRequestPage /></Layout></PrivateRoute>} />
            <Route path="/timetable" element={<PrivateRoute><Layout><TimetablePage /></Layout></PrivateRoute>} />
            <Route path="/ai-assistant" element={<PrivateRoute><Layout><AIAssistantPage /></Layout></PrivateRoute>} />
            <Route path="/thinai-live" element={<PrivateRoute><ThinAILivePage /></PrivateRoute>} />
            <Route path="/ai-study-plan" element={<PrivateRoute><Layout><AIStudyPlanPage /></Layout></PrivateRoute>} />
            <Route path="/library" element={<PrivateRoute><Layout><LibraryPage /></Layout></PrivateRoute>} />
            <Route path="/assignments" element={<PrivateRoute><Layout><AssignmentsPage /></Layout></PrivateRoute>} />
            <Route path="/chat" element={<PrivateRoute><Layout><ChatPage /></Layout></PrivateRoute>} />
            <Route path="/showcase" element={<PrivateRoute><Layout><ShowcasePage /></Layout></PrivateRoute>} />
            <Route path="/announcements" element={<PrivateRoute><Layout><AnnouncementsPage /></Layout></PrivateRoute>} />
            <Route path="/reports" element={<PrivateRoute><Layout><ReportsPage /></Layout></PrivateRoute>} />
            <Route path="/class-list" element={<PrivateRoute><Layout><ClassListPage /></Layout></PrivateRoute>} />
            <Route path="/focus" element={<PrivateRoute><Layout><FocusRoom /></Layout></PrivateRoute>} />
            <Route path="/flashcards" element={<PrivateRoute><Layout><Flashcards /></Layout></PrivateRoute>} />
            <Route path="/premium" element={<PrivateRoute><Layout><PremiumPage /></Layout></PrivateRoute>} />
            <Route path="/settings" element={<PrivateRoute><Layout><SettingsPage /></Layout></PrivateRoute>} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}
