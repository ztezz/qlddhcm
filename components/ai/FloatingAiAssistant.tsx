import React, { useMemo, useRef, useState } from 'react';
import { Bot, Send, X, Loader2, Sparkles, Minimize2 } from 'lucide-react';
import { aiApi } from '../../services/aiApi';
import { User } from '../../types';

interface FloatingAiAssistantProps {
    user: User | null;
    page: string;
}

type ChatMessage = { role: 'user' | 'assistant'; content: string; provider?: string; parcels?: any[] };

const QUICK_PROMPTS = [
    'Hướng dẫn tra cứu thửa đất',
    'Cách xem lịch sử biến động?',
    'Cách xuất báo cáo biến động?',
    'Cách chỉnh sửa thửa trong Editor?'
];

const FloatingAiAssistant: React.FC<FloatingAiAssistantProps> = ({ user, page }) => {
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'assistant', content: 'Xin chào, tôi là trợ lý AI của hệ thống. Bạn có thể hỏi về tra cứu thửa đất, lịch sử biến động, chỉnh sửa bản đồ, bảng giá đất hoặc báo cáo.' }
    ]);
    const inputRef = useRef<HTMLInputElement>(null);

    const context = useMemo(() => ({
        page,
        userRole: user?.role,
        userName: user?.name,
        timestamp: new Date().toISOString()
    }), [page, user]);

    const sendMessage = async (text = input) => {
        const content = text.trim();
        if (!content || loading) return;
        setInput('');
        const nextMessages: ChatMessage[] = [...messages, { role: 'user', content }];
        setMessages(nextMessages);
        setLoading(true);
        try {
            const result = await aiApi.chat({
                message: content,
                history: nextMessages.slice(-8).map(m => ({ role: m.role, content: m.content })),
                context
            });
            setMessages(prev => [...prev, { role: 'assistant', content: result.reply, provider: result.provider, parcels: result.parcels || [] }]);
        } catch (e: any) {
            setMessages(prev => [...prev, { role: 'assistant', content: `Không gọi được trợ lý AI: ${e.message}` }]);
        } finally {
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    };

    if (!user) return null;

    return (
        <>
            {!open && (
                <button
                    onClick={() => setOpen(true)}
                    className="fixed bottom-5 right-5 z-[900] flex items-center gap-2 rounded-full bg-purple-600 hover:bg-purple-500 text-white px-4 py-3 shadow-2xl border border-purple-400/40 transition-all hover:scale-105"
                    title="Trợ lý AI"
                >
                    <Sparkles size={18} />
                    <span className="text-xs font-black uppercase tracking-wider">AI</span>
                </button>
            )}

            {open && (
                <div className="fixed bottom-5 right-5 z-[900] w-[360px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-2rem)] rounded-2xl overflow-hidden bg-slate-950 border border-purple-500/30 shadow-2xl flex flex-col text-white">
                    <div className="shrink-0 px-4 py-3 bg-purple-950/60 border-b border-purple-500/20 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center">
                                <Bot size={17} />
                            </div>
                            <div>
                                <div className="text-sm font-black">Trợ lý AI</div>
                                <div className="text-[10px] text-purple-300">Ngữ cảnh: {page}</div>
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

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-slate-950">
                        {messages.map((m, idx) => (
                            <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[86%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${m.role === 'user'
                                    ? 'bg-blue-600 text-white rounded-br-sm'
                                    : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-bl-sm'
                                }`}>
                                    {m.content}
                                    {m.provider && <div className="mt-1 text-[9px] text-purple-300 uppercase">{m.provider}</div>}
                                    {m.role === 'assistant' && m.parcels && m.parcels.length > 0 && (
                                        <div className="mt-2 space-y-1.5">
                                            {m.parcels.slice(0, 3).map((p, i) => (
                                                <button
                                                    key={`${p.table_name}-${p.gid}-${i}`}
                                                    onClick={() => window.dispatchEvent(new CustomEvent('ai:zoom-parcel', { detail: p }))}
                                                    className="w-full text-left rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 px-2 py-1.5 text-[10px] text-purple-100 transition-colors"
                                                >
                                                    Zoom tới thửa {p.sothua || '?'} / tờ {p.sodoto || '?'}
                                                    <span className="block text-[9px] text-purple-300">{p.display_name || p.table_name} · GID {p.gid}</span>
                                                </button>
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

                    <div className="shrink-0 p-3 border-t border-slate-800 bg-slate-900/80 space-y-2">
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
