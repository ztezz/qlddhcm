
import React, { useState, useEffect, useRef } from 'react';
import { User, Message, UserRole } from '../types';
import { messageService, adminService, API_URL } from '../services/mockBackend';
import { Send, User as UserIcon, Search, Loader2, Mail, Inbox, SendHorizontal, Trash2, ArrowLeft, Plus, RefreshCw, Clock, ShieldCheck, CheckCircle2, AlertTriangle, Check, CheckCheck, Undo2, Bold, Italic, List, Smile, CornerUpLeft, Trash, X, Info } from 'lucide-react';

interface MessagingProps {
    user: User;
}

const EMOJIS = [
    // Smileys & Emotion
    '😊', '😂', '🤣', '❤️', '😍', '🥰', '😘', '😋', '😎', '🤓', '🧐', '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😣', '😥', '😮', '🤐', '😯', '😪', '😫', '🥱', '😴', '😌', '😛', '😜', '😝', '🤤', '😒', '😓', '😔', '😕', '🙃', '🤑', '😲', '☹️', '🙁', '😖', '😞', '😟', '😤', '😢', '😭', '😦', '😧', '😨', '😩', '🤯', '😬', '😰', '😱', '🥵', '🥶', '😳', '🤪', '😵', '😡', '😠', '🤬', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '😇', '🥳', '🥺', '🤠', '🤡', '👺', '👻', '💀', '👽', '🤖', '💩',
    // Hands & Gestures
    '👍', '👎', '👌', '✌️', '🤞', '🤙', '🖐️', '✋', '🖖', '🤝', '👏', '🙌', '🙏', '✍️', '🤳', '💪', '🦾', '👂', '👃', '🧠', '👀',
    // Work & Tools
    '📍', '📍', '🗺️', '🏢', '🏗️', '💼', '🤝', '📧', '🚀', '🎉', '💡', '📅', '📝', '📁', '📂', '📊', '📈', '📉', '📎', '📌', '📏', '📐', '✂️', '🔨', '🛠️', '⚙️', '⚖️', '⛓️', '🧰', '🔧', '📦', '🔔', '🔕', '📧', '📩', '📨', '📫', '📦', '✏️', '✒️', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '💾', '💿', '📀',
    // Status & Symbols
    '✅', '❌', '⚠️', '🔥', '✨', '⚡', '🌟', '❄️', '☀️', '⭐', '🎈', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🛑', '🆗', '🆘', '🆙', '🆕', '🆓', '🔟', '💯', '🔔', '📣', '📢'
];

const MailCenter: React.FC<MessagingProps> = ({ user }) => {
    const [view, setView] = useState<'INBOX' | 'SENT' | 'TRASH' | 'COMPOSE' | 'READ'>('INBOX');
    const [mails, setMails] = useState<Message[]>([]);
    const [selectedMail, setSelectedMail] = useState<Message | null>(null);
    const [recipients, setRecipients] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');

    // Compose State
    const [composeData, setComposeData] = useState({ receiverId: '', content: '' });
    const [isEmojiOpen, setIsEmojiOpen] = useState(false);
    const contentRef = useRef<HTMLTextAreaElement>(null);
    const emojiRef = useRef<HTMLDivElement>(null);

    // System Dialog State
    const [dialog, setDialog] = useState<{
        isOpen: boolean;
        type: 'alert' | 'confirm' | 'success' | 'error';
        title: string;
        message: string;
        onConfirm?: () => void;
    }>({ isOpen: false, type: 'alert', title: '', message: '' });

    const showDialog = (type: any, title: string, message: string, onConfirm?: () => void) => {
        setDialog({ isOpen: true, type, title, message, onConfirm });
    };

    // Close emoji picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (emojiRef.current && !emojiRef.current.contains(event.target as Node)) {
                setIsEmojiOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        setSearchQuery('');
        loadMails();
        loadRecipients();
    }, [view]);

    useEffect(() => {
        const interval = setInterval(() => { if (view === 'INBOX') loadMails(); }, 60000);
        return () => clearInterval(interval);
    }, [view]);

    const loadMails = async () => {
        if (view === 'COMPOSE' || view === 'READ') return;
        setLoading(true);
        try {
            let data: Message[] = [];
            if (view === 'INBOX') data = await messageService.getInbox();
            else if (view === 'SENT') data = await messageService.getSent();
            else if (view === 'TRASH') data = await messageService.getTrash();
            setMails(data);
            if (view === 'INBOX') setUnreadCount(data.filter(m => !m.is_read).length);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const loadRecipients = async () => {
        try {
            const users = await adminService.getUsers();
            setRecipients(users.filter(u => u.id !== user.id));
        } catch (e) {}
    };

    const handleReadMail = async (mail: Message) => {
        setSelectedMail(mail);
        setView('READ');
        if (!mail.is_read && mail.receiver_id === user.id && !mail.is_deleted) {
            try {
                await messageService.markAsRead(mail.id);
                setMails(prev => prev.map(m => m.id === mail.id ? { ...m, is_read: true } : m));
                setUnreadCount(prev => Math.max(0, prev - 1));
            } catch (e) {}
        }
    };

    const handleSendMail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!composeData.receiverId || !composeData.content.trim()) return;
        
        setLoading(true);
        try {
            await messageService.sendMessage(composeData.receiverId, composeData.content);
            showDialog('success', 'Thành công', 'Thư của bạn đã được gửi đi.');
            setComposeData({ receiverId: '', content: '' });
            setView('SENT');
        } catch (e: any) {
            showDialog('error', 'Lỗi gửi thư', e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteMail = (id: number) => {
        const isCurrentlyInTrash = view === 'TRASH' || selectedMail?.is_deleted;
        const title = isCurrentlyInTrash ? 'Xác nhận xóa vĩnh viễn' : 'Xác nhận xóa';
        const msg = isCurrentlyInTrash 
            ? 'Thư này sẽ bị xóa vĩnh viễn khỏi hệ thống và không thể khôi phục. Tiếp tục?' 
            : 'Thư sẽ được chuyển vào thùng rác. Bạn có thể khôi phục lại sau.';

        showDialog('confirm', title, msg, async () => {
            try {
                await messageService.deleteMessage(id);
                setMails(prev => prev.filter(m => m.id !== id));
                if (selectedMail?.id === id) setView('INBOX');
                if (view === 'INBOX' || view === 'SENT' || view === 'TRASH') loadMails();
            } catch (e: any) {
                showDialog('error', 'Lỗi', e.message);
            }
        });
    };

    const handleRestoreMail = async (id: number) => {
        try {
            await messageService.restoreMessage(id);
            setMails(prev => prev.filter(m => m.id !== id));
            if (selectedMail?.id === id) setView('INBOX');
            showDialog('success', 'Khôi phục', 'Thư đã được đưa trở lại hộp thư.');
        } catch (e: any) {
            showDialog('error', 'Lỗi', e.message);
        }
    };

    const handleReply = () => {
        if (!selectedMail) return;
        const replyContent = `\n\n--- Trả lời thư của ${selectedMail.sender_name} vào lúc ${new Date(selectedMail.timestamp).toLocaleString()} ---\n> ${selectedMail.content.split('\n').join('\n> ')}`;
        setComposeData({
            receiverId: selectedMail.sender_id,
            content: replyContent
        });
        setView('COMPOSE');
        setTimeout(() => contentRef.current?.focus(), 100);
    };

    const insertText = (before: string, after: string = '') => {
        const el = contentRef.current;
        if (!el) return;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const text = el.value;
        const selected = text.substring(start, end);
        const newText = text.substring(0, start) + before + selected + after + text.substring(end);
        setComposeData({ ...composeData, content: newText });
        setTimeout(() => {
            el.focus();
            el.setSelectionRange(start + before.length, end + before.length);
        }, 10);
    };

    const addEmoji = (emoji: string) => {
        const el = contentRef.current;
        if (!el) return;
        const start = el.selectionStart;
        const text = el.value;
        const newText = text.substring(0, start) + emoji + text.substring(start);
        setComposeData({ ...composeData, content: newText });
        // Keeping emoji picker open for multiple emoji insertion
        setTimeout(() => {
            el.focus();
            el.setSelectionRange(start + emoji.length, start + emoji.length);
        }, 10);
    };

    const relativeTime = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        if (diff < 60000) return 'Vừa xong';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} phút trước`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ trước`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)} ngày trước`;
        return new Date(dateStr).toLocaleDateString('vi-VN');
    };

    const renderMarkdown = (text: string) => {
        return text.split('\n').map((line, i) => {
            const escaped = line
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            const htmlLine = escaped
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/_(.*?)_/g, '<em>$1</em>');
            if (line.startsWith('- ')) return <li key={i} className="ml-5 list-disc text-slate-300" dangerouslySetInnerHTML={{ __html: htmlLine.substring(2) }} />;
            if (line.startsWith('> ')) return <blockquote key={i} className="border-l-2 border-slate-600 pl-3 text-slate-500 italic" dangerouslySetInnerHTML={{ __html: htmlLine.substring(5) }} />;
            if (line === '') return <div key={i} className="h-2" />;
            return <p key={i} dangerouslySetInnerHTML={{ __html: htmlLine }} />;
        });
    };

    const getAvatarUrl = (path?: string) => {
        if (!path) return null;
        if (path.startsWith('http') || path.startsWith('data:')) return path;
        return `${API_URL}${path.startsWith('/') ? path : '/' + path}`;
    };

    const filteredMails = searchQuery.trim()
        ? mails.filter(m => {
            const q = searchQuery.toLowerCase();
            const name = (view === 'INBOX' ? m.sender_name : m.receiver_name) || '';
            return name.toLowerCase().includes(q) || m.content.toLowerCase().includes(q);
          })
        : mails;

    return (
        <div className="flex h-full bg-slate-950 overflow-hidden font-sans">
            {/* Sidebar Navigation */}
            <div className="w-64 shrink-0 border-r border-slate-800 flex flex-col bg-slate-900/50 backdrop-blur-md">
                <div className="p-6">
                    <button 
                        onClick={() => { setView('COMPOSE'); setSelectedMail(null); }}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-2xl font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-blue-900/40 transition-all active:scale-95 mb-8"
                    >
                        <Plus size={18}/> Soạn thư mới
                    </button>

                    <div className="space-y-1">
                        <button 
                            onClick={() => { setView('INBOX'); setSelectedMail(null); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'INBOX' ? 'bg-slate-800 text-blue-400 shadow-inner' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
                        >
                            <Inbox size={18}/>
                            <span className="text-xs font-bold uppercase tracking-wider flex-1">Hộp thư đến</span>
                            {unreadCount > 0 && (
                                <span className="bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full min-w-[20px] text-center">
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                            )}
                        </button>
                        <button 
                            onClick={() => { setView('SENT'); setSelectedMail(null); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'SENT' ? 'bg-slate-800 text-blue-400 shadow-inner' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
                        >
                            <SendHorizontal size={18}/>
                            <span className="text-xs font-bold uppercase tracking-wider">Thư đã gửi</span>
                        </button>
                        <button 
                            onClick={() => { setView('TRASH'); setSelectedMail(null); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'TRASH' ? 'bg-slate-800 text-red-400 shadow-inner' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
                        >
                            <Trash2 size={18}/>
                            <span className="text-xs font-bold uppercase tracking-wider">Thùng rác</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* List & Detail Area */}
            <div className="flex-1 flex flex-col relative bg-slate-950 min-w-0">
                {/* Header */}
                <div className="border-b border-slate-800 bg-slate-900/30">
                    <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg shrink-0 ${view === 'TRASH' ? 'bg-red-600/20' : 'bg-blue-600/20'}`}>
                                {view === 'INBOX' ? <Inbox className="text-blue-500" size={20}/> : 
                                 view === 'SENT' ? <SendHorizontal className="text-blue-500" size={20}/> : 
                                 view === 'TRASH' ? <Trash2 className="text-red-500" size={20}/> :
                                 <Mail className="text-blue-500" size={20}/>}
                            </div>
                            <h2 className="text-sm font-black text-white uppercase tracking-widest truncate">
                                {view === 'INBOX' ? 'Hộp thư đến' : view === 'SENT' ? 'Thư đã gửi' : view === 'TRASH' ? 'Thùng rác' : view === 'READ' ? 'Chi tiết thư' : 'Soạn thư mới'}
                            </h2>
                        </div>
                        {(view === 'INBOX' || view === 'SENT' || view === 'TRASH') && (
                            <button onClick={loadMails} className="text-slate-500 hover:text-white transition-all shrink-0">
                                <RefreshCw size={18} className={loading ? "animate-spin" : ""}/>
                            </button>
                        )}
                    </div>
                    {(view === 'INBOX' || view === 'SENT' || view === 'TRASH') && (
                        <div className="px-4 pb-3">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"/>
                                <input
                                    type="text"
                                    placeholder="Tìm kiếm theo người gửi, nội dung..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full gap-4">
                            <Loader2 className="animate-spin text-blue-500" size={32}/>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Đang tải dữ liệu...</p>
                        </div>
                    ) : view === 'READ' && selectedMail ? (
                        /* VIEW MAIL */
                        <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="flex justify-between items-center mb-4">
                                <button onClick={() => setView(selectedMail.is_deleted ? 'TRASH' : (selectedMail.sender_id === user.id ? 'SENT' : 'INBOX'))} className="flex items-center gap-2 text-slate-500 hover:text-white transition-all text-xs font-bold uppercase">
                                    <ArrowLeft size={16}/> Quay lại
                                </button>
                                <div className="flex gap-2">
                                    {!selectedMail.is_deleted && selectedMail.sender_id !== user.id && (
                                        <button onClick={handleReply} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase flex items-center gap-2 transition-all">
                                            <CornerUpLeft size={14}/> Trả lời
                                        </button>
                                    )}
                                    {selectedMail.is_deleted && (
                                        <button onClick={() => handleRestoreMail(selectedMail.id)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase flex items-center gap-2 transition-all">
                                            <Undo2 size={14}/> Khôi phục
                                        </button>
                                    )}
                                    <button onClick={() => handleDeleteMail(selectedMail.id)} className="bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white px-4 py-2 rounded-xl text-xs font-bold uppercase flex items-center gap-2 transition-all">
                                        <Trash2 size={14}/> {selectedMail.is_deleted ? 'Xóa vĩnh viễn' : 'Xóa thư'}
                                    </button>
                                </div>
                            </div>

                            {(() => {
                                const isSentByMe = selectedMail.sender_id === user.id;
                                const contactName = isSentByMe ? selectedMail.receiver_name : selectedMail.sender_name;
                                const contactEmail = isSentByMe ? selectedMail.receiver_email : selectedMail.sender_email;
                                const contactAvatar = isSentByMe ? selectedMail.receiver_avatar : selectedMail.sender_avatar;

                                return (
                                    <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-xl relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
                                        <div className="flex justify-between items-start border-b border-slate-800 pb-6">
                                            <div className="flex gap-4 min-w-0">
                                                <div className="w-12 h-12 rounded-full border-2 border-slate-700 overflow-hidden bg-slate-800 shrink-0">
                                                    {contactAvatar ? (
                                                        <img src={getAvatarUrl(contactAvatar)!} className="w-full h-full object-cover" alt={contactName} />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-blue-400 font-black text-xl">{contactName?.charAt(0)}</div>
                                                    )}
                                                </div>
                                                <div className="min-w-0 overflow-hidden">
                                                    <p className="text-white font-black text-lg leading-none mb-1 truncate">
                                                        {isSentByMe ? <span className="text-blue-400 text-[10px] mr-2 font-black uppercase tracking-widest">[ĐÃ GỬI]</span> : <span className="text-emerald-400 text-[10px] mr-2 font-black uppercase tracking-widest">[NHẬN]</span>}
                                                        {contactName}
                                                    </p>
                                                    <p className="text-slate-500 text-xs font-mono truncate">{contactEmail || 'No email'}</p>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2 justify-end">
                                                    <Clock size={12}/> {new Date(selectedMail.timestamp).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="text-slate-200 leading-relaxed text-sm py-4 min-h-[200px] space-y-1.5">
                                            {renderMarkdown(selectedMail.content)}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    ) : view === 'COMPOSE' ? (
                        /* COMPOSE MAIL */
                        <div className="p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
                            <form onSubmit={handleSendMail} className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl relative">
                                <div>
                                    <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest block mb-2 ml-1">Người tiếp nhận thư *</label>
                                    <div className="relative">
                                        <select 
                                            required
                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm text-white focus:border-blue-500 outline-none appearance-none cursor-pointer shadow-inner"
                                            value={composeData.receiverId}
                                            onChange={e => setComposeData({...composeData, receiverId: e.target.value})}
                                        >
                                            <option value="">-- Chọn cán bộ tiếp nhận --</option>
                                            {recipients.map(r => <option key={r.id} value={r.id}>{r.name} ({r.role})</option>)}
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                            <UserIcon size={18}/>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest block mb-2 ml-1">Nội dung thư tín *</label>
                                    
                                    {/* TOOLBAR */}
                                    <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 border-b-0 rounded-t-2xl p-3">
                                        <div className="flex items-center gap-1">
                                            <button type="button" onClick={() => insertText('**', '**')} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all" title="In đậm (Bold)"><Bold size={16}/></button>
                                            <button type="button" onClick={() => insertText('_', '_')} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all" title="In nghiêng (Italic)"><Italic size={16}/></button>
                                            <button type="button" onClick={() => insertText('\n- ', '')} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all" title="Danh sách (List)"><List size={16}/></button>
                                        </div>
                                        <div className="w-px h-6 bg-slate-800 mx-1"></div>
                                        <div className="relative" ref={emojiRef}>
                                            <button 
                                                type="button" 
                                                onClick={() => setIsEmojiOpen(!isEmojiOpen)}
                                                className={`p-2 hover:bg-slate-800 rounded-lg transition-all flex items-center justify-center ${isEmojiOpen ? 'text-blue-400 bg-slate-800' : 'text-slate-400'}`}
                                                title="Chèn Emoji"
                                            >
                                                <Smile size={18}/>
                                            </button>
                                            {isEmojiOpen && (
                                                <div className="absolute top-full left-0 mt-3 bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-[0_10px_40px_rgba(0,0,0,0.6)] z-[100] w-64 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-150">
                                                    <div className="flex justify-between items-center mb-2 px-1">
                                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Biểu tượng cảm xúc</span>
                                                        <button type="button" onClick={() => setIsEmojiOpen(false)} className="text-slate-500 hover:text-white"><X size={14}/></button>
                                                    </div>
                                                    <div className="grid grid-cols-6 gap-2 max-h-60 overflow-y-auto custom-scrollbar p-1">
                                                        {EMOJIS.map(emoji => (
                                                            <button 
                                                                key={emoji} 
                                                                type="button" 
                                                                onClick={() => addEmoji(emoji)}
                                                                className="text-xl hover:scale-150 transition-transform p-1 hover:bg-slate-800 rounded-lg flex items-center justify-center"
                                                            >
                                                                {emoji}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <textarea 
                                        ref={contentRef}
                                        required
                                        className="w-full bg-slate-950 border border-slate-800 border-t-0 rounded-b-2xl p-6 text-sm text-white focus:border-blue-500 outline-none h-80 resize-none shadow-inner custom-scrollbar"
                                        placeholder="Kính gửi cán bộ,..."
                                        value={composeData.content}
                                        onChange={e => setComposeData({...composeData, content: e.target.value})}
                                    />
                                    <div className="text-right text-[10px] text-slate-600 mt-1.5 font-mono pr-1">
                                        {composeData.content.length} ký tự
                                    </div>
                                </div>

                                <div className="flex justify-end gap-4 pt-4">
                                    <button type="button" onClick={() => setView('INBOX')} className="px-6 py-3 text-slate-500 hover:text-white font-bold uppercase text-xs transition-colors">Hủy soạn thảo</button>
                                    <button 
                                        type="submit" 
                                        disabled={loading}
                                        className="bg-blue-600 hover:bg-blue-500 text-white px-12 py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] flex items-center gap-2 shadow-2xl shadow-blue-900/30 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {loading ? <Loader2 className="animate-spin" size={18}/> : <Send size={18}/>} GỬI THƯ NGAY
                                    </button>
                                </div>
                            </form>
                        </div>
                    ) : (
                        /* LIST MAILS (INBOX/SENT/TRASH) */
                        <>
                            {view === 'TRASH' && (
                                <div className="px-5 py-3 bg-red-900/10 border-b border-red-900/20 text-red-400 text-xs font-medium flex items-center gap-2">
                                    <Info size={14} className="shrink-0"/>
                                    Lưu ý: Thư trong thùng rác sẽ tự động xóa vĩnh viễn sau 30 ngày.
                                </div>
                            )}
                            <div className="divide-y divide-slate-800/50">
                            {filteredMails.length === 0 ? (
                                    <div className="p-32 text-center flex flex-col items-center gap-6 opacity-20">
                                        <Mail size={80} className="text-slate-600"/>
                                        <div className="space-y-1">
                                            <p className="text-sm font-black uppercase tracking-[0.3em]">{searchQuery ? 'Không tìm thấy kết quả' : 'Hộp thư đang trống'}</p>
                                            <p className="text-[10px] font-bold">{searchQuery ? 'Thử tìm với từ khóa khác' : 'Bắt đầu trao đổi công việc nội bộ ngay'}</p>
                                        </div>
                                    </div>
                            ) : filteredMails.map(m => (
                                    <div 
                                        key={m.id} 
                                        onClick={() => handleReadMail(m)}
                                        className={`group flex items-center gap-4 p-5 hover:bg-slate-800/40 cursor-pointer transition-all border-l-4 ${m.is_read || view === 'SENT' || view === 'TRASH' ? 'border-transparent' : 'border-blue-600 bg-blue-600/5'}`}
                                    >
                                        <div className="w-12 h-12 rounded-full border border-slate-700 overflow-hidden bg-slate-900 shrink-0 shadow-lg">
                                            {(view === 'INBOX' || (view === 'TRASH' && m.receiver_id === user.id) ? m.sender_avatar : m.receiver_avatar) ? (
                                                <img src={getAvatarUrl(view === 'INBOX' || (view === 'TRASH' && m.receiver_id === user.id) ? m.sender_avatar : m.receiver_avatar)!} className="w-full h-full object-cover" alt="avatar" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-xs font-black text-slate-500">{(view === 'INBOX' || (view === 'TRASH' && m.receiver_id === user.id) ? m.sender_name : m.receiver_name)?.charAt(0)}</div>
                                            )}
                                        </div>
                                        
                                        <div className="flex-1 overflow-hidden min-w-0">
                                            <div className="flex justify-between items-center mb-1">
                                                <p className={`text-xs uppercase tracking-tighter truncate ${m.is_read || view === 'SENT' || view === 'TRASH' ? 'text-slate-400 font-bold' : 'text-white font-black'}`}>
                                                    {view === 'INBOX' ? m.sender_name : view === 'SENT' ? m.receiver_name : (m.sender_id === user.id ? <span className="text-blue-400">Đến: {m.receiver_name}</span> : <span className="text-emerald-400">Từ: {m.sender_name}</span>)}
                                                </p>
                                                <p className="text-[9px] font-black text-slate-600 uppercase shrink-0 ml-4 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">{relativeTime(m.timestamp)}</p>
                                            </div>
                                            <p className="text-sm truncate text-slate-200">
                                                {m.content.length > 100 ? m.content.substring(0, 100) + '...' : m.content}
                                            </p>
                                        </div>

                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 flex gap-2">
                                            {view === 'TRASH' && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleRestoreMail(m.id); }}
                                                    className="p-2 bg-emerald-600/20 text-emerald-500 hover:bg-emerald-600 hover:text-white rounded-lg transition-all"
                                                    title="Khôi phục thư"
                                                >
                                                    <Undo2 size={16}/>
                                                </button>
                                            )}
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteMail(m.id); }}
                                                className="p-2 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white rounded-lg transition-all"
                                                title={view === 'TRASH' ? "Xóa vĩnh viễn" : "Chuyển vào thùng rác"}
                                            >
                                                <Trash size={16}/>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* --- SYSTEM DIALOG --- */}
            {dialog.isOpen && (
                <div className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 rounded-[2.5rem] w-full max-w-sm border border-slate-800 shadow-2xl overflow-hidden">
                        <div className="p-8 text-center flex flex-col items-center">
                            {dialog.type === 'success' && <div className="w-14 h-14 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mb-4"><CheckCircle2 size={28}/></div>}
                            {dialog.type === 'error' && <div className="w-14 h-14 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-4"><AlertTriangle size={28}/></div>}
                            {dialog.type === 'confirm' && <div className="w-14 h-14 bg-orange-500/20 text-orange-500 rounded-full flex items-center justify-center mb-4"><Info size={28}/></div>}
                            
                            <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2">{dialog.title}</h3>
                            <p className="text-gray-400 text-xs leading-relaxed mb-6">{dialog.message}</p>
                            
                            <div className="flex gap-2 w-full">
                                {dialog.type === 'confirm' ? (
                                    <>
                                        <button onClick={() => setDialog({ ...dialog, isOpen: false })} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-gray-400 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all">HỦY BỎ</button>
                                        <button onClick={() => { setDialog({ ...dialog, isOpen: false }); dialog.onConfirm?.(); }} className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-900/20 transition-all">XÁC NHẬN</button>
                                    </>
                                ) : (
                                    <button onClick={() => setDialog({ ...dialog, isOpen: false })} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-900/20 transition-all">OK</button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MailCenter;
