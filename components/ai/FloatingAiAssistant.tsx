import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Send, X, Loader2, Sparkles, Minimize2, ChevronDown, EyeOff, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { aiApi } from '../../services/aiApi';
import { User } from '../../types';

interface FloatingAiAssistantProps {
    user: User | null;
    page: string;
    systemSettings?: Record<string, string>;
}

type ChatMessage = { role: 'user' | 'assistant'; content: string; parcels?: any[]; landPrices?: any[] };

const QUICK_PROMPTS = [
    'Hướng dẫn tra cứu thửa đất',
    'Cách xem lịch sử biến động?',
    'Cách xuất báo cáo biến động?',
    'Cách chỉnh sửa thửa trong Editor?'
];

const isZoomRequest = (text: string) => /\b(định\s*vị|dinh\s*vi|zoom|phóng\s*tới|phong\s*toi|tới\s*thửa|toi\s*thua|xem\s*trên\s*bản\s*đồ|xem\s*tren\s*ban\s*do)\b/i.test(text);

const FloatingAiAssistant: React.FC<FloatingAiAssistantProps> = ({ user, page, systemSettings = {} }) => {
    const assistantName = (systemSettings.ai_assistant_name || 'Axis').trim() || 'Axis';
    const chatStyle = systemSettings.ai_chat_style || 'friendly';
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [showScrollDown, setShowScrollDown] = useState(false);
    const [showQuickPrompts, setShowQuickPrompts] = useState(true);
    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'assistant', content: `Xin chào, tôi là ${assistantName}. Tôi có thể hỗ trợ bạn tra cứu thửa đất, xem lịch sử biến động, chỉnh sửa bản đồ, phân tích dữ liệu và tạo báo cáo.` }
    ]);
    const inputRef = useRef<HTMLInputElement>(null);
    const messagesRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    const context = useMemo(() => ({
        page,
        userRole: user?.role,
        userName: user?.name,
        assistantName,
        chatStyle,
        timestamp: new Date().toISOString()
    }), [page, user, assistantName, chatStyle]);

    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
        const el = messagesRef.current;
        if (!el) return;
        el.scrollTo({ top: el.scrollHeight, behavior });
    };

    const updateScrollDownState = () => {
        const el = messagesRef.current;
        if (!el) return;
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        setShowScrollDown(distanceFromBottom > 120);
    };

    useEffect(() => {
        const el = messagesRef.current;
        if (!el) return;
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (distanceFromBottom < 180) {
            scrollToBottom('smooth');
        } else {
            setShowScrollDown(true);
        }
    }, [messages, loading]);

    useEffect(() => {
        if (open) {
            setTimeout(() => scrollToBottom('auto'), 50);
        }
    }, [open]);

    useEffect(() => {
        setMessages(prev => prev.length === 1 && prev[0]?.role === 'assistant'
            ? [{ ...prev[0], content: `Xin chào, tôi là ${assistantName}. Tôi có thể hỗ trợ bạn tra cứu thửa đất, xem lịch sử biến động, chỉnh sửa bản đồ, phân tích dữ liệu và tạo báo cáo.` }]
            : prev
        );
    }, [assistantName]);

    const sendMessage = async (text = input) => {
        const content = text.trim();
        if (!content || loading) return;
        setInput('');
        const nextMessages: ChatMessage[] = [...messages, { role: 'user', content }];
        setMessages(nextMessages);

        if (isZoomRequest(content)) {
            const latestParcel = [...messages]
                .reverse()
                .flatMap(m => m.parcels || [])
                .find(p => p?.geometry);

            if (latestParcel) {
                zoomParcel(latestParcel);
                setMessages([...nextMessages, {
                    role: 'assistant',
                    content: `Axis đã định vị thửa ${latestParcel.sothua || '?'} / tờ ${latestParcel.sodoto || '?'} trên bản đồ.`,
                    parcels: [latestParcel]
                }]);
                setTimeout(() => inputRef.current?.focus(), 50);
                return;
            }
        }

        setLoading(true);
        try {
            const result = await aiApi.chat({
                message: content,
                history: nextMessages.slice(-8).map(m => ({ role: m.role, content: m.content })),
                context
            });
            setMessages(prev => [...prev, { role: 'assistant', content: result.reply, parcels: result.parcels || [], landPrices: result.landPrices || [] }]);
        } catch (e: any) {
            setMessages(prev => [...prev, { role: 'assistant', content: `Không gọi được trợ lý AI: ${e.message}` }]);
        } finally {
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    };

    const openParcelInEditor = (parcel: any) => {
        sessionStorage.setItem('ai_editor_parcel', JSON.stringify(parcel));
        navigate('/chinhsuabanve');
        setOpen(false);
    };

    const zoomParcel = (parcel: any) => {
        if (page !== 'map') {
            navigate('/');
            setTimeout(() => window.dispatchEvent(new CustomEvent('ai:zoom-parcel', { detail: parcel })), 150);
            return;
        }
        window.dispatchEvent(new CustomEvent('ai:zoom-parcel', { detail: parcel }));
    };

    const openLandPriceDetail = (row: any) => {
        sessionStorage.setItem('ai_land_price_result', JSON.stringify(row));
        window.dispatchEvent(new CustomEvent('ai:open-land-price', { detail: row }));
        navigate('/giadata');
        setOpen(false);
    };

    if (!user) return null;

    return (
        <>
            {!open && (
                <button
                    onClick={() => setOpen(true)}
                    className="fixed bottom-6 right-32 max-md:right-4 max-md:bottom-28 z-[900] flex items-center gap-2 rounded-full bg-purple-600 hover:bg-purple-500 text-white px-4 py-3 shadow-2xl border border-purple-400/40 transition-all hover:scale-105"
                    title="Axis"
                >
                    <Sparkles size={18} />
                            <span className="text-xs font-black uppercase tracking-wider">{assistantName}</span>
                </button>
            )}

            {open && (
                <div className="fixed bottom-6 right-32 max-md:right-4 max-md:bottom-28 z-[900] w-[360px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-7rem)] rounded-2xl overflow-hidden bg-slate-950 border border-purple-500/30 shadow-2xl flex flex-col text-white">
                    <div className="shrink-0 px-4 py-3 bg-purple-950/60 border-b border-purple-500/20 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center">
                                <Bot size={17} />
                            </div>
                            <div>
                                <div className="text-sm font-black">{assistantName}</div>
                                <div className="text-[10px] text-purple-300">Trợ lý AI đất đai</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300" title="Thu nhỏ">
                                <Minimize2 size={14} />
                            </button>
                            <button onClick={() => { setMessages(messages.slice(0, 1)); setInput(''); }} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300" title="Xóa hội thoại">
                                <X size={14} />
                            </button>
                        </div>
                    </div>

                    <div className="relative flex-1 min-h-0 bg-slate-950">
                        <div ref={messagesRef} onScroll={updateScrollDownState} className="h-full overflow-y-auto p-4 space-y-3 custom-scrollbar">
                            {messages.map((m, idx) => (
                                <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[86%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${m.role === 'user'
                                    ? 'bg-blue-600 text-white rounded-br-sm'
                                    : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-bl-sm'
                                }`}>
                                    {m.content}
                                    {m.role === 'assistant' && m.parcels && m.parcels.length > 0 && (
                                        <div className="mt-2 space-y-1.5">
                                            {m.parcels.slice(0, 3).map((p, i) => (
                                                <div key={`${p.table_name}-${p.gid}-${i}`} className="space-y-1.5">
                                                    <button
                                                        onClick={() => zoomParcel(p)}
                                                        className="w-full text-left rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 px-2 py-1.5 text-[10px] text-purple-100 transition-colors"
                                                    >
                                                        Zoom tới thửa {p.sothua || '?'} / tờ {p.sodoto || '?'}
                                                        <span className="block text-[9px] text-purple-300">{p.display_name || p.table_name} · GID {p.gid}</span>
                                                    </button>
                                                    <button
                                                        onClick={() => openParcelInEditor(p)}
                                                        className="w-full text-left rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-1.5 text-[10px] text-emerald-100 transition-colors"
                                                    >
                                                        Mở trong Editor
                                                        <span className="block text-[9px] text-emerald-300">Nạp thửa vào bản vẽ để chỉnh sửa/cập nhật</span>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {m.role === 'assistant' && m.landPrices && m.landPrices.length > 0 && (
                                        <div className="mt-2 space-y-1.5">
                                            {m.landPrices.slice(0, 3).map((r, i) => (
                                                <div key={`${r.id}-${i}`} className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-50">
                                                    <div className="font-bold">{r.tenduong} · {r.phuongxa}</div>
                                                    <div className="text-[9px] text-amber-200">Đoạn {r.tu || '?'} → {r.den || '?'}</div>
                                                    <div className="text-[9px] text-amber-100 mt-0.5">Đất ở: {(Number(r.dato || 0) * 1000).toLocaleString('vi-VN')} đ/m²</div>
                                                    <button
                                                        onClick={() => openLandPriceDetail(r)}
                                                        className="mt-1.5 w-full rounded-md border border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/20 px-2 py-1 text-[9px] font-bold text-amber-100 transition-colors"
                                                    >
                                                        Xem chi tiết giá đất
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                </div>
                            ))}
                            {loading && (
                                <div className="flex justify-start">
                                    <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-sm px-3 py-2 text-xs text-slate-300 flex items-center gap-2">
                                        <Loader2 size={13} className="animate-spin" /> Đang suy nghĩ...
                                    </div>
                                </div>
                            )}
                        </div>

                        {showScrollDown && (
                            <button
                                onClick={() => scrollToBottom('smooth')}
                                className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full border border-purple-400/40 bg-purple-600/95 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white shadow-xl shadow-purple-950/40 backdrop-blur transition-all hover:bg-purple-500 active:scale-95"
                                title="Xuống cuối hội thoại"
                            >
                                <ChevronDown size={13} /> Cuối chat
                            </button>
                        )}
                    </div>

                    <div className="shrink-0 p-3 border-t border-slate-800 bg-slate-900/80 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Đề xuất</span>
                            <button
                                type="button"
                                onClick={() => setShowQuickPrompts(v => !v)}
                                className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/70 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 transition-colors hover:border-purple-500/40 hover:text-purple-200"
                                title={showQuickPrompts ? 'Ẩn đề xuất' : 'Hiện đề xuất'}
                            >
                                {showQuickPrompts ? <EyeOff size={11} /> : <Eye size={11} />}
                                {showQuickPrompts ? 'Ẩn' : 'Hiện'}
                            </button>
                        </div>
                        {showQuickPrompts && (
                            <div className="flex flex-wrap gap-1.5">
                                {QUICK_PROMPTS.map(p => (
                                    <button
                                        key={p}
                                        onClick={() => sendMessage(p)}
                                        disabled={loading}
                                        className="text-[10px] px-2 py-1 rounded-full bg-slate-800 hover:bg-purple-900/50 text-slate-300 border border-slate-700 hover:border-purple-500/40 transition-colors disabled:opacity-40"
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <input
                                ref={inputRef}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
                                placeholder="Hỏi trợ lý AI..."
                                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500 placeholder-slate-500"
                            />
                            <button
                                onClick={() => sendMessage()}
                                disabled={loading || !input.trim()}
                                className="h-9 w-9 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 flex items-center justify-center transition-colors"
                            >
                                {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default FloatingAiAssistant;
