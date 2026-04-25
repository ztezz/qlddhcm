import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BlogPost, User, UserRole } from '../types';
import { blogService } from '../services/mockBackend';
import {
    ArrowLeft, ArrowUp, Bookmark, BookmarkCheck, BookOpen, CalendarDays,
    Check, ChevronRight, Clock, Copy, Eye, Heart, List, Loader2, Share2, Tag, User as UserIcon
} from 'lucide-react';

interface BlogGISPostProps {
    user?: User | null;
}

/* ── Helpers ─────────────────────────────────────────────────────── */
const stripHtml = (v: string) =>
    String(v || '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const getReadingTime = (html: string) =>
    Math.max(1, Math.ceil(stripHtml(html).split(/\s+/).filter(Boolean).length / 220));

const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' });

const isNew = (d: string) => Date.now() - new Date(d).getTime() < 7 * 24 * 60 * 60 * 1000;

const isFuturePublish = (value?: string | null) => {
    if (!value) return false;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) && timestamp > Date.now();
};

/* ── Bookmark helpers ──────────────────────────────────────────── */
const getBmKey = (userId?: string) => `blog_bookmarks_${userId || 'guest'}`;
const loadBookmarks = (userId?: string): number[] => {
    try { return JSON.parse(localStorage.getItem(getBmKey(userId)) || '[]'); }
    catch { return []; }
};
const saveBookmarks = (userId: string | undefined, ids: number[]) =>
    localStorage.setItem(getBmKey(userId), JSON.stringify(ids));

/* ── View count helpers ────────────────────────────────────────── */
const VIEWS_KEY = 'blog_view_counts';
const incrementView = (postId: number): number => {
    try {
        const counts = JSON.parse(localStorage.getItem(VIEWS_KEY) || '{}');
        const next = (counts[postId] ?? 0) + 1;
        localStorage.setItem(VIEWS_KEY, JSON.stringify({ ...counts, [postId]: next }));
        return next;
    } catch { return 0; }
};

/* ── Like helpers ──────────────────────────────────────────────── */
const LIKES_KEY = 'blog_likes';
const getLikedByKey = (userId?: string) => `blog_liked_by_${userId || 'guest'}`;
const loadLikeCount = (postId: number): number => {
    try { const m = JSON.parse(localStorage.getItem(LIKES_KEY) || '{}'); return m[postId] ?? 0; }
    catch { return 0; }
};
const loadLikedBy = (userId?: string): number[] => {
    try { return JSON.parse(localStorage.getItem(getLikedByKey(userId)) || '[]'); }
    catch { return []; }
};
const toggleLike = (postId: number, userId?: string): { count: number; liked: boolean } => {
    try {
        const counts: Record<number, number> = JSON.parse(localStorage.getItem(LIKES_KEY) || '{}');
        const liked: number[] = JSON.parse(localStorage.getItem(getLikedByKey(userId)) || '[]');
        const wasLiked = liked.includes(postId);
        const next = wasLiked ? liked.filter(id => id !== postId) : [...liked, postId];
        counts[postId] = Math.max(0, (counts[postId] ?? 0) + (wasLiked ? -1 : 1));
        localStorage.setItem(LIKES_KEY, JSON.stringify(counts));
        localStorage.setItem(getLikedByKey(userId), JSON.stringify(next));
        return { count: counts[postId], liked: !wasLiked };
    } catch { return { count: 0, liked: false }; }
};

/* ── Reading history helpers ───────────────────────────────────── */
const getHistoryKey = (userId?: string) => `blog_read_history_${userId || 'guest'}`;
const loadHistory = (userId?: string): number[] => {
    try { return JSON.parse(localStorage.getItem(getHistoryKey(userId)) || '[]'); }
    catch { return []; }
};
const markAsRead = (postId: number, userId?: string) => {
    try {
        const hist = loadHistory(userId);
        if (!hist.includes(postId)) {
            localStorage.setItem(getHistoryKey(userId), JSON.stringify([...hist, postId]));
        }
    } catch { /* ignore */ }
};

/* ── Font size helpers ─────────────────────────────────────────── */
const FONT_KEY = 'blog_font_size';
type FontSize = 'sm' | 'md' | 'lg';
const loadFontSize = (): FontSize => {
    const v = localStorage.getItem(FONT_KEY);
    return (v === 'sm' || v === 'lg') ? v : 'md';
};

/* ── Comment helpers ───────────────────────────────────────────── */
interface Comment {
    id: string;
    postId: number;
    authorName: string;
    authorId: string;
    text: string;
    createdAt: string;
    likes: number;
    likedBy: string[];
}
const COMMENTS_KEY = 'blog_comments';
const loadComments = (postId: number): Comment[] => {
    try {
        const all: Comment[] = JSON.parse(localStorage.getItem(COMMENTS_KEY) || '[]');
        return all.filter(c => c.postId === postId).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    } catch { return []; }
};
const saveComment = (comment: Comment) => {
    try {
        const all: Comment[] = JSON.parse(localStorage.getItem(COMMENTS_KEY) || '[]');
        localStorage.setItem(COMMENTS_KEY, JSON.stringify([...all, comment]));
    } catch { /* ignore */ }
};
const deleteComment = (commentId: string) => {
    try {
        const all: Comment[] = JSON.parse(localStorage.getItem(COMMENTS_KEY) || '[]');
        localStorage.setItem(COMMENTS_KEY, JSON.stringify(all.filter(c => c.id !== commentId)));
    } catch { /* ignore */ }
};
const toggleCommentLike = (commentId: string, userId: string): Comment[] => {
    try {
        const all: Comment[] = JSON.parse(localStorage.getItem(COMMENTS_KEY) || '[]');
        const updated = all.map(c => {
            if (c.id !== commentId) return c;
            const liked = c.likedBy.includes(userId);
            return { ...c, likes: Math.max(0, c.likes + (liked ? -1 : 1)), likedBy: liked ? c.likedBy.filter(id => id !== userId) : [...c.likedBy, userId] };
        });
        localStorage.setItem(COMMENTS_KEY, JSON.stringify(updated));
        return updated;
    } catch { return []; }
};
const AVATAR_COLORS = ['#06b6d4','#10b981','#8b5cf6','#f59e0b','#ef4444','#ec4899','#3b82f6','#14b8a6'];
const avatarColor = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

/* ── CommentSection sub-component ─────────────────────────────── */
interface CommentSectionProps { postId: number; user?: User | null; }
const CommentSection: React.FC<CommentSectionProps> = ({ postId, user }) => {
    const [comments, setComments] = React.useState<Comment[]>(() => loadComments(postId));
    const [name, setName] = React.useState(user?.name || '');
    const [text, setText] = React.useState('');
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState('');
    const userId = user?.id || 'guest';

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimName = name.trim();
        const trimText = text.trim();
        if (!trimName) { setError('Vui lòng nhập tên.'); return; }
        if (!trimText) { setError('Vui lòng nhập nội dung bình luận.'); return; }
        if (trimText.length > 1000) { setError('Bình luận tối đa 1000 ký tự.'); return; }
        setSubmitting(true);
        const newComment: Comment = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            postId,
            authorName: trimName,
            authorId: userId,
            text: trimText,
            createdAt: new Date().toISOString(),
            likes: 0,
            likedBy: [],
        };
        saveComment(newComment);
        setComments(loadComments(postId));
        setText('');
        setError('');
        setSubmitting(false);
    };

    const handleLike = (commentId: string) => {
        toggleCommentLike(commentId, userId);
        setComments(loadComments(postId));
    };

    const handleDelete = (commentId: string) => {
        deleteComment(commentId);
        setComments(loadComments(postId));
    };

    const fmtTime = (d: string) => {
        const diff = Date.now() - +new Date(d);
        if (diff < 60000) return 'vừa xong';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} phút trước`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ trước`;
        return new Date(d).toLocaleDateString('vi-VN');
    };

    return (
        <div className="bp-fade-4 mt-8">
            <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    💬 {comments.length > 0 ? `${comments.length} bình luận` : 'Bình luận'}
                </span>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
            </div>

            {/* Comment form */}
            <form onSubmit={handleSubmit} className="mb-6 rounded-2xl border border-slate-800/70 bg-gradient-to-br from-slate-900/90 to-slate-900/50 p-5">
                <div className="flex gap-3 items-start">
                    <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-slate-950 font-black text-sm shadow-md"
                        style={{ background: name.trim() ? avatarColor(name.trim()) : '#475569' }}>
                        {name.trim() ? name.trim()[0].toUpperCase() : '?'}
                    </div>
                    <div className="flex-1 space-y-3">
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            maxLength={60}
                            placeholder="Tên của bạn *"
                            className="w-full rounded-xl bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500/60 transition-colors"
                        />
                        <textarea
                            value={text}
                            onChange={e => setText(e.target.value)}
                            maxLength={1000}
                            rows={3}
                            placeholder="Chia sẻ suy nghĩ của bạn về bài viết này..."
                            className="w-full rounded-xl bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500/60 transition-colors resize-none"
                        />
                        {error && <p className="text-xs text-red-400">{error}</p>}
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-[10px] text-slate-600">{text.length}/1000</span>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 disabled:opacity-50 text-slate-950 font-black uppercase tracking-widest text-[11px] transition-all shadow-md shadow-cyan-900/30 hover:scale-105 active:scale-95"
                            >
                                Gửi bình luận
                            </button>
                        </div>
                    </div>
                </div>
            </form>

            {/* Comment list */}
            {comments.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">Chưa có bình luận nào. Hãy là người đầu tiên!</div>
            ) : (
                <div className="space-y-4">
                    {comments.map(c => {
                        const isOwner = c.authorId === userId;
                        const isLiked = c.likedBy.includes(userId);
                        return (
                            <div key={c.id} className="flex gap-3 group/c">
                                <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-slate-950 font-black text-sm shadow-md"
                                    style={{ background: avatarColor(c.authorName) }}>
                                    {c.authorName[0].toUpperCase()}
                                </div>
                                <div className="flex-1 rounded-2xl border border-slate-800/70 bg-slate-900/60 px-4 py-3">
                                    <div className="flex items-center justify-between gap-2 mb-1.5">
                                        <span className="text-sm font-black text-white">{c.authorName}</span>
                                        <span className="text-[10px] text-slate-500">{fmtTime(c.createdAt)}</span>
                                    </div>
                                    <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap break-words">{c.text}</p>
                                    <div className="mt-2.5 flex items-center gap-3">
                                        <button
                                            onClick={() => handleLike(c.id)}
                                            className={`inline-flex items-center gap-1 text-[11px] font-black transition-colors ${isLiked ? 'text-rose-300' : 'text-slate-500 hover:text-rose-300'}`}
                                        >
                                            <Heart size={11} fill={isLiked ? 'currentColor' : 'none'} />
                                            {c.likes > 0 ? c.likes : 'Thích'}
                                        </button>
                                        {isOwner && (
                                            <button
                                                onClick={() => handleDelete(c.id)}
                                                className="text-[11px] font-black text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover/c:opacity-100"
                                            >
                                                Xóa
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

/* ── TOC helpers ───────────────────────────────────────────────── */
interface TocItem { id: string; text: string; level: 1 | 2; }

/** Injects id="bp-h-N" into every h1/h2 in the HTML string and returns
 *  both the patched HTML and the TOC items list. */
const buildToc = (html: string): { patchedHtml: string; toc: TocItem[] } => {
    const toc: TocItem[] = [];
    let idx = 0;
    const patchedHtml = html.replace(/<(h[12])(\s[^>]*)?>([^<]*(?:<(?!\/h[12])[^<]*)*)<\/h[12]>/gi, (match, tag, attrs, inner) => {
        const level = tag === 'h1' ? 1 : 2;
        const id = `bp-h-${idx++}`;
        const text = inner.replace(/<[^>]+>/g, '').trim();
        toc.push({ id, text, level });
        return `<${tag}${attrs || ''} id="${id}">${inner}</${tag}>`;
    });
    return { patchedHtml, toc };
};

/* ── Component ──────────────────────────────────────────────────── */
const BlogGISPost: React.FC<BlogGISPostProps> = ({ user }) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const canManageScheduledPost = user?.role === UserRole.ADMIN || user?.role === UserRole.EDITOR;

    const [post, setPost] = useState<BlogPost | null>(null);
    const [allPosts, setAllPosts] = useState<BlogPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [bookmarks, setBookmarks] = useState<number[]>(() => loadBookmarks(user?.id));

    /* Reading progress & scroll-to-top */
    const scrollRef = useRef<HTMLDivElement>(null);
    const [readPct, setReadPct] = useState(0);
    const [showTop, setShowTop] = useState(false);

    /* TOC */
    const [tocOpen, setTocOpen] = useState(false);
    const [activeHeading, setActiveHeading] = useState('');

    /* Share */
    const [copied, setCopied] = useState(false);

    /* View count */
    const [viewCount, setViewCount] = useState(0);

    /* Likes */
    const [likes, setLikes] = useState(0);
    const [liked, setLiked] = useState(false);
    const [likeAnim, setLikeAnim] = useState(false);

    /* Font size */
    const [fontSize, setFontSize] = useState<FontSize>(() => loadFontSize());

    /* Prose ref for copy-code injection */
    const proseRef = useRef<HTMLDivElement>(null);

    /* Load data */
    useEffect(() => {
        if (!id) return;
        setLoading(true);
        setError('');
        setReadPct(0);
        setShowTop(false);
        setActiveHeading('');
        setViewCount(0);
        Promise.all([blogService.getPostById(Number(id)), blogService.getPosts()])
            .then(([p, all]) => {
                setPost(p);
                setAllPosts(Array.isArray(all) ? all : []);
                setViewCount(incrementView(p.id));
                setLikes(loadLikeCount(p.id));
                setLiked(loadLikedBy(user?.id).includes(p.id));
            })
            .catch((e) => setError(e?.message || 'Không tìm thấy bài viết.'))
            .finally(() => setLoading(false));
    }, [id]);

    useEffect(() => { setBookmarks(loadBookmarks(user?.id)); }, [user?.id]);

    /* Mark post as read when 80 % scrolled */
    useEffect(() => {
        if (post && readPct >= 80) markAsRead(post.id, user?.id);
    }, [post, readPct, user?.id]);

    const isBookmarked = post ? bookmarks.includes(post.id) : false;

    const toggleBookmark = useCallback(() => {
        if (!post) return;
        const next = isBookmarked ? bookmarks.filter((b) => b !== post.id) : [...bookmarks, post.id];
        setBookmarks(next);
        saveBookmarks(user?.id, next);
    }, [post, bookmarks, isBookmarked, user?.id]);

    const handleLike = useCallback(() => {
        if (!post) return;
        const result = toggleLike(post.id, user?.id);
        setLikes(result.count);
        setLiked(result.liked);
        setLikeAnim(true);
        setTimeout(() => setLikeAnim(false), 400);
    }, [post, user?.id]);

    /* Derived: TOC + patched HTML + reading stats */
    const { patchedHtml, toc } = useMemo(() =>
        post ? buildToc(post.content_html) : { patchedHtml: '', toc: [] },
        [post]
    );

    const totalMins = post ? getReadingTime(post.content_html) : 0;
    const remainingMins = Math.max(0, Math.ceil(totalMins * (1 - readPct / 100)));
    const isScheduled = isFuturePublish(post?.publish_at);

    /* Scroll listener → progress + back-to-top + active heading */
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const onScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = el;
            const pct = scrollHeight <= clientHeight ? 0 : (scrollTop / (scrollHeight - clientHeight)) * 100;
            setReadPct(pct);
            setShowTop(scrollTop > 320);

            /* active heading: find which is closest above viewport top */
            if (toc.length) {
                const headings = toc.map(t => document.getElementById(t.id)).filter(Boolean) as HTMLElement[];
                let active = '';
                for (const h of headings) {
                    const rect = h.getBoundingClientRect();
                    if (rect.top <= 120) active = h.id;
                }
                setActiveHeading(active || (headings[0]?.id ?? ''));
            }
        };
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => el.removeEventListener('scroll', onScroll);
    }, [toc]);

    const scrollToTop = () => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

    const scrollToHeading = (headingId: string) => {
        const el = document.getElementById(headingId);
        if (!el || !scrollRef.current) return;
        const containerTop = scrollRef.current.getBoundingClientRect().top;
        const elTop = el.getBoundingClientRect().top;
        scrollRef.current.scrollBy({ top: elTop - containerTop - 80, behavior: 'smooth' });
        setTocOpen(false);
    };

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2200);
        } catch { /* ignore */ }
    };

    /* Inject copy-code buttons into <pre> blocks after prose renders */
    useEffect(() => {
        if (!proseRef.current || !patchedHtml) return;
        const preBlocks = proseRef.current.querySelectorAll('pre');
        preBlocks.forEach((pre) => {
            if (pre.querySelector('.bp-copy-btn')) return;
            (pre as HTMLElement).style.position = 'relative';
            const btn = document.createElement('button');
            btn.className = 'bp-copy-btn';
            btn.title = 'Sao chép';
            btn.style.cssText = 'position:absolute;top:8px;right:8px;background:rgba(6,182,212,0.15);border:1px solid rgba(6,182,212,0.3);color:#67e8f9;border-radius:8px;padding:3px 8px;font-size:10px;font-weight:900;letter-spacing:0.1em;cursor:pointer;transition:background 0.15s;';
            btn.textContent = 'Copy';
            btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(6,182,212,0.3)'; });
            btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(6,182,212,0.15)'; });
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const code = (pre.querySelector('code') as HTMLElement)?.textContent ?? pre.textContent ?? '';
                try {
                    await navigator.clipboard.writeText(code);
                    btn.textContent = '✓ Đã copy';
                    btn.style.color = '#34d399';
                    btn.style.borderColor = 'rgba(52,211,153,0.4)';
                    setTimeout(() => { btn.textContent = 'Copy'; btn.style.color = '#67e8f9'; btn.style.borderColor = 'rgba(6,182,212,0.3)'; }, 2000);
                } catch { /* ignore */ }
            });
            pre.appendChild(btn);
        });
    }, [patchedHtml]);

    /* Syntax highlighting via highlight.js CDN */
    useEffect(() => {
        if (!proseRef.current || !patchedHtml) return;
        const applyHljs = () => {
            const hljs = (window as any).hljs;
            if (!hljs) return;
            proseRef.current?.querySelectorAll('pre code:not(.hljs)').forEach((el) => {
                hljs.highlightElement(el as HTMLElement);
            });
        };
        if ((window as any).hljs) { applyHljs(); return; }
        if (!document.getElementById('hljs-css')) {
            const link = document.createElement('link');
            link.id = 'hljs-css';
            link.rel = 'stylesheet';
            link.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark-dimmed.min.css';
            document.head.appendChild(link);
        }
        if (!document.getElementById('hljs-js')) {
            const script = document.createElement('script');
            script.id = 'hljs-js';
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js';
            script.onload = applyHljs;
            document.head.appendChild(script);
        }
    }, [patchedHtml]);

    /* Related posts */
    const relatedPosts = useMemo(() => {
        if (!post) return [];
        const tags = new Set((post.tags || []).map(t => t.toLowerCase()));
        return allPosts
            .filter(p => p.id !== post.id && (p.tags || []).some(t => tags.has(t.toLowerCase())))
            .sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))
            .slice(0, 3);
    }, [post, allPosts]);

    /* ── Render ─────────────────────────────────────────────────── */
    return (
        <div ref={scrollRef} className="absolute inset-0 overflow-y-auto bg-slate-950 text-white">
            <style>{`
                @keyframes bpFadeSlide {
                    from { opacity: 0; transform: translateY(14px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes bpShimmer {
                    0%,100% { background-position: 0% 50%; }
                    50%     { background-position: 100% 50%; }
                }
                @keyframes bpOrbFloat  { 0%,100%{transform:translateY(0) scale(1);}    50%{transform:translateY(-18px) scale(1.06);} }
                @keyframes bpOrbFloat2 { 0%,100%{transform:translateY(0) scale(1.04);} 50%{transform:translateY(16px)  scale(0.96);} }
                @keyframes bmBounce    { 0%{transform:scale(1);} 40%{transform:scale(1.35);} 70%{transform:scale(0.9);} 100%{transform:scale(1);} }
                @keyframes bpProgressGlow { 0%,100%{opacity:0.7;} 50%{opacity:1;} }
                @keyframes bpToastIn   { from{opacity:0;transform:translateY(8px);} to{opacity:1;transform:translateY(0);} }
                @keyframes bpFabPop    { from{transform:scale(0) rotate(-90deg);opacity:0;} to{transform:scale(1) rotate(0deg);opacity:1;} }
                .bp-fade-1 { animation: bpFadeSlide 0.5s ease both; }
                .bp-fade-2 { animation: bpFadeSlide 0.5s ease 0.1s both; }
                .bp-fade-3 { animation: bpFadeSlide 0.5s ease 0.2s both; }
                .bp-fade-4 { animation: bpFadeSlide 0.5s ease 0.3s both; }
                .bp-orb-1  { animation: bpOrbFloat  8s ease-in-out infinite; }
                .bp-orb-2  { animation: bpOrbFloat2 10s ease-in-out infinite; }
                .bp-title-shimmer {
                    background: linear-gradient(110deg,#ffffff 0%,#a5f3fc 30%,#6ee7b7 55%,#a5f3fc 75%,#ffffff 100%);
                    background-size:250% 250%; animation:bpShimmer 6s ease infinite;
                    -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
                }
                .bm-bounce { animation: bmBounce 0.35s ease; }
                .bp-progress-bar { animation: bpProgressGlow 2s ease-in-out infinite; }
                .bp-toast { animation: bpToastIn 0.25s ease both; }
                .bp-fab   { animation: bpFabPop  0.3s cubic-bezier(0.34,1.56,0.64,1) both; }
                @keyframes bpHeartPop { 0%{transform:scale(1);} 40%{transform:scale(1.5);} 70%{transform:scale(0.85);} 100%{transform:scale(1);} }
                .bp-heart-pop { animation: bpHeartPop 0.4s ease both; }
                /* Font size variants */
                .bp-prose-sm .blog-prose { font-size:0.82em; }
                .bp-prose-lg .blog-prose { font-size:1.12em; }
                /* Prose */
                .blog-prose h1,.blog-prose h2 { color:#e2e8f0; font-weight:900; line-height:1.25; margin:1.5em 0 0.6em; scroll-margin-top:90px; }
                .blog-prose h1 { font-size:1.6em; }
                .blog-prose h2 { font-size:1.3em; border-bottom:1px solid rgba(6,182,212,0.2); padding-bottom:0.3em; }
                .blog-prose p  { color:#cbd5e1; line-height:1.8; margin:0 0 1em; }
                .blog-prose ul,.blog-prose ol { color:#cbd5e1; padding-left:1.5em; margin:0 0 1em; }
                .blog-prose li { line-height:1.8; margin-bottom:0.3em; }
                .blog-prose a  { color:#22d3ee; text-decoration:underline; word-break:break-all; }
                .blog-prose a:hover { color:#67e8f9; }
                .blog-prose strong,.blog-prose b { color:#f1f5f9; font-weight:700; }
                .blog-prose em,.blog-prose i    { color:#94a3b8; font-style:italic; }
                .blog-prose img { max-width:100%; border-radius:0.75rem; border:1px solid rgba(71,85,105,0.6); margin:1em 0; }
                .blog-prose blockquote { border-left:3px solid #06b6d4; padding:0.5em 1em; background:rgba(6,182,212,0.06); margin:1em 0; border-radius:0 0.5rem 0.5rem 0; }
                .blog-prose blockquote p { color:#94a3b8; margin:0; }
                .blog-prose pre,.blog-prose code { background:rgba(15,23,42,0.8); border:1px solid rgba(71,85,105,0.4); border-radius:0.4em; font-family:'JetBrains Mono','Fira Code',monospace; font-size:0.85em; }
                .blog-prose pre { padding:1em; overflow-x:auto; margin:1em 0; }
                .blog-prose code { padding:0.1em 0.4em; }
                .blog-prose pre code { border:none; padding:0; background:transparent; }
                .blog-prose hr { border:none; border-top:1px solid rgba(71,85,105,0.4); margin:2em 0; }
                .blog-prose table { width:100%; border-collapse:collapse; margin:1em 0; font-size:0.9em; }
                .blog-prose th { background:rgba(6,182,212,0.1); color:#a5f3fc; padding:0.5em 0.75em; border:1px solid rgba(6,182,212,0.2); text-align:left; font-weight:700; }
                .blog-prose td { padding:0.5em 0.75em; border:1px solid rgba(71,85,105,0.3); color:#cbd5e1; }
                .blog-prose tr:hover td { background:rgba(6,182,212,0.04); }
            `}</style>

            {/* ── Reading progress bar (sticky top) ───────────────── */}
            <div className="sticky top-0 z-50 h-1 bg-slate-800/80">
                <div
                    className="bp-progress-bar h-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-cyan-500 transition-all duration-75 shadow-[0_0_8px_rgba(6,182,212,0.8)]"
                    style={{ width: `${readPct}%` }}
                />
            </div>

            {/* ── Ambient orbs ────────────────────────────────────── */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="bp-orb-1 absolute -top-40 -left-40 w-[480px] h-[480px] rounded-full bg-cyan-600/8 blur-[90px]" />
                <div className="bp-orb-2 absolute top-1/2 -right-32 w-[380px] h-[380px] rounded-full bg-emerald-600/8 blur-[80px]" />
            </div>

            {/* ── Copied toast ─────────────────────────────────────── */}
            {copied && (
                <div className="bp-toast fixed bottom-20 left-1/2 -translate-x-1/2 z-50 inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-emerald-600/40 bg-slate-900/95 backdrop-blur-sm text-emerald-300 text-sm font-bold shadow-xl">
                    <Check size={15} className="text-emerald-400" /> Đã copy link bài viết!
                </div>
            )}

            {/* ── Back-to-top FAB ──────────────────────────────────── */}
            {showTop && (
                <button
                    onClick={scrollToTop}
                    className="bp-fab fixed bottom-6 right-6 z-50 w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 shadow-lg shadow-cyan-900/50 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                    title="Lên đầu trang"
                >
                    <ArrowUp size={18} className="text-slate-950" />
                </button>
            )}

            {/* ── Layout: article + floating TOC ───────────────────── */}
            <div className="relative max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12">
                <div className="flex gap-8 items-start">

                    {/* ── Main column ─────────────────────────────── */}
                    <div className="flex-1 min-w-0">

                        {/* Back */}
                        <button
                            onClick={() => navigate('/bloggis')}
                            className="bp-fade-1 mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-300 transition-colors group"
                        >
                            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                            Quay lại danh sách bài viết
                        </button>

                        {/* Loading */}
                        {loading && (
                            <div className="flex items-center justify-center gap-3 py-24 text-slate-400">
                                <Loader2 size={20} className="animate-spin text-cyan-400" />
                                <span>Đang tải bài viết...</span>
                            </div>
                        )}

                        {/* Error */}
                        {!loading && error && (
                            <div className="rounded-2xl border border-red-800/40 bg-red-950/20 p-6 text-center">
                                <p className="text-red-300 font-medium">{error}</p>
                                <button onClick={() => navigate('/bloggis')} className="mt-4 px-4 py-2 rounded-xl bg-red-900/40 hover:bg-red-800/40 text-red-200 text-sm font-bold transition-colors">
                                    Về trang Blog
                                </button>
                            </div>
                        )}

                        {/* Article */}
                        {!loading && post && (
                            <>
                                {/* Cover */}
                                {post.cover_image && (
                                    <div className="bp-fade-1 mb-7 rounded-3xl border border-slate-700/50 overflow-hidden shadow-2xl shadow-slate-950/60">
                                        <img src={post.cover_image} alt={post.title} className="w-full max-h-[420px] object-cover" />
                                    </div>
                                )}

                                {/* Header card */}
                                <div className="bp-fade-2 relative overflow-hidden rounded-3xl border border-cyan-800/30 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/30 p-6 md:p-8 mb-6 shadow-xl">
                                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

                                    {/* Tags + new badge */}
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {isNew(post.created_at) && (
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 animate-pulse">
                                                ✦ Mới
                                            </span>
                                        )}
                                        {canManageScheduledPost && isScheduled && (
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                                Hẹn đăng {fmtDate(post.publish_at)}
                                            </span>
                                        )}
                                        {(post.tags || []).map((tag) => (
                                            <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-cyan-900/30 text-cyan-300 border border-cyan-700/40">
                                                <Tag size={9} />{tag}
                                            </span>
                                        ))}
                                    </div>

                                    {canManageScheduledPost && isScheduled && (
                                        <div className="mb-4 rounded-2xl border border-amber-500/25 bg-amber-950/20 px-4 py-3 text-sm text-amber-200">
                                            Bài viết này đang ở trạng thái chờ tự động đăng và sẽ xuất hiện công khai vào {new Date(post.publish_at).toLocaleString('vi-VN')}.
                                        </div>
                                    )}

                                    {/* Title */}
                                    <h1 className="bp-title-shimmer text-2xl sm:text-3xl md:text-4xl font-black leading-tight">
                                        {post.title}
                                    </h1>

                                    {post.summary && (
                                        <p className="mt-3 text-sm md:text-base text-slate-400 leading-relaxed">{post.summary}</p>
                                    )}

                                    {/* Meta + actions row */}
                                    <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                                            <span className="flex items-center gap-1.5"><UserIcon size={13} className="text-slate-500" />{post.author_name}</span>
                                            <span className="flex items-center gap-1.5"><CalendarDays size={13} className="text-slate-500" />{fmtDate(isScheduled ? post.publish_at : post.updated_at)}</span>
                                            <span className="flex items-center gap-1.5"><Clock size={13} className="text-slate-500" />{totalMins} phút đọc</span>
                                            {readPct > 2 && readPct < 99 && (
                                                <span className="flex items-center gap-1.5 text-emerald-400/80">
                                                    <Clock size={12} />
                                                    {remainingMins <= 0 ? 'Sắp xong!' : `Còn ~${remainingMins} phút`}
                                                </span>
                                            )}
                                            {readPct >= 99 && (
                                                <span className="flex items-center gap-1.5 text-emerald-300 font-black">✓ Đã đọc xong</span>
                                            )}
                                            {viewCount > 0 && <span className="flex items-center gap-1.5"><Eye size={13} className="text-slate-500" />{viewCount} lượt xem</span>}
                                            <span className="flex items-center gap-1.5 tabular-nums">
                                                <span className="w-20 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                                                    <span className="block h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-100 rounded-full" style={{ width: `${readPct}%` }} />
                                                </span>
                                                <span className="text-slate-500">{Math.round(readPct)}%</span>
                                            </span>
                                        </div>

                                        {/* Action buttons */}
                                        <div className="flex items-center gap-2">
                                            {/* Font size control */}
                                            <div className="flex items-center border border-slate-700 rounded-xl overflow-hidden">
                                                {(['sm', 'md', 'lg'] as FontSize[]).map((size, idx) => (
                                                    <button
                                                        key={size}
                                                        onClick={() => { setFontSize(size); localStorage.setItem(FONT_KEY, size); }}
                                                        title={{ sm: 'Chữ nhỏ', md: 'Chữ vừa', lg: 'Chữ to' }[size]}
                                                        className={`px-2.5 py-1.5 text-[10px] font-black transition-colors ${idx > 0 ? 'border-l border-slate-700' : ''} ${fontSize === size ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                                        style={{ fontSize: size === 'sm' ? '9px' : size === 'lg' ? '13px' : '11px' }}
                                                    >
                                                        A
                                                    </button>
                                                ))}
                                            </div>
                                            {/* Mobile TOC toggle */}
                                            {toc.length > 0 && (
                                                <button
                                                    onClick={() => setTocOpen(o => !o)}
                                                    className="lg:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 text-slate-400 hover:border-cyan-700/50 hover:text-cyan-300 text-[11px] font-black uppercase tracking-widest transition-all"
                                                >
                                                    <List size={14} /> Mục lục
                                                </button>
                                            )}
                                            {/* Like */}
                                            <button
                                                onClick={handleLike}
                                                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-black uppercase tracking-widest transition-all ${
                                                    liked
                                                        ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 hover:bg-rose-500/25'
                                                        : 'border-slate-700 text-slate-400 hover:border-rose-500/40 hover:text-rose-300'
                                                }`}
                                            >
                                                <Heart size={14} className={likeAnim ? 'bp-heart-pop' : ''} fill={liked ? 'currentColor' : 'none'} />
                                                {likes > 0 ? likes : 'Thích'}
                                            </button>
                                            {/* Share */}
                                            <button
                                                onClick={copyLink}
                                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 text-slate-400 hover:border-cyan-700/50 hover:text-cyan-300 text-[11px] font-black uppercase tracking-widest transition-all"
                                            >
                                                {copied ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
                                                Chia sẻ
                                            </button>
                                            {/* Bookmark */}
                                            <button
                                                onClick={toggleBookmark}
                                                title={isBookmarked ? 'Bỏ lưu bài' : 'Lưu bài viết'}
                                                className={`${isBookmarked ? 'bm-bounce' : ''} inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-black uppercase tracking-widest transition-all ${
                                                    isBookmarked
                                                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                                                        : 'border-slate-700 text-slate-400 hover:border-amber-500/40 hover:text-amber-300 hover:bg-amber-900/10'
                                                }`}
                                            >
                                                {isBookmarked ? <><BookmarkCheck size={14} /> Đã lưu</> : <><Bookmark size={14} /> Lưu</>}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Mobile TOC panel */}
                                    {tocOpen && toc.length > 0 && (
                                        <div className="lg:hidden mt-5 rounded-2xl border border-slate-700/60 bg-slate-950/60 p-4">
                                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 flex items-center gap-2"><List size={11} /> Mục lục</div>
                                            <ul className="space-y-1">
                                                {toc.map(item => (
                                                    <li key={item.id}>
                                                        <button
                                                            onClick={() => scrollToHeading(item.id)}
                                                            className={`w-full text-left text-xs py-1.5 px-2 rounded-lg transition-colors flex items-center gap-2 ${
                                                                activeHeading === item.id
                                                                    ? 'text-cyan-300 bg-cyan-950/40'
                                                                    : 'text-slate-400 hover:text-cyan-300'
                                                            } ${item.level === 2 ? 'pl-5' : ''}`}
                                                        >
                                                            {activeHeading === item.id && <ChevronRight size={10} className="text-cyan-400 flex-shrink-0" />}
                                                            {item.text}
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>

                                {/* Article body */}
                                <div className={`bp-fade-3 rounded-3xl border border-slate-800/60 bg-gradient-to-b from-slate-900/90 to-slate-900/60 p-6 md:p-10 mb-8 shadow-xl bp-prose-${fontSize}`}>
                                    <div ref={proseRef} className="blog-prose" dangerouslySetInnerHTML={{ __html: patchedHtml }} />
                                </div>

                                {/* Related posts */}
                                {relatedPosts.length > 0 && (
                                    <div className="bp-fade-4">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
                                            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                                <BookOpen size={11} /> Bài viết liên quan
                                            </span>
                                            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            {relatedPosts.map((rel) => (
                                                <button
                                                    key={rel.id}
                                                    onClick={() => navigate(`/bloggis/${rel.id}`)}
                                                    className="group relative text-left rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/90 to-slate-900/50 p-4 hover:border-cyan-700/50 transition-all shadow-lg hover:shadow-cyan-950/30"
                                                >
                                                    {isNew(rel.created_at) && (
                                                        <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500/15 text-emerald-300 border border-emerald-600/30">Mới</span>
                                                    )}
                                                    {rel.cover_image && (
                                                        <div className="mb-3 rounded-xl overflow-hidden border border-slate-700/50">
                                                            <img src={rel.cover_image} alt={rel.title} className="w-full h-28 object-cover group-hover:scale-105 transition-transform duration-300" />
                                                        </div>
                                                    )}
                                                    <div className="flex flex-wrap gap-1 mb-2">
                                                        {(rel.tags || []).slice(0, 2).map(t => (
                                                            <span key={t} className="text-[9px] font-black uppercase tracking-widest text-cyan-400/70 bg-cyan-950/40 border border-cyan-900/40 px-2 py-0.5 rounded-full">#{t}</span>
                                                        ))}
                                                    </div>
                                                    <p className="text-sm font-black text-white leading-snug group-hover:text-cyan-100 transition-colors line-clamp-2">{rel.title}</p>
                                                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                                                        <span className="flex items-center gap-1"><Clock size={10} />{getReadingTime(rel.content_html)} phút đọc</span>
                                                        {bookmarks.includes(rel.id) && <BookmarkCheck size={11} className="text-amber-400" />}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Comments */}
                                <CommentSection postId={post.id} user={user} />

                                {/* Footer */}
                                <div className="mt-8 flex items-center justify-between pt-5 border-t border-slate-800/50">
                                    <button onClick={() => navigate('/bloggis')} className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-300 transition-colors group">
                                        <ArrowLeft size={15} className="group-hover:-translate-x-1 transition-transform" />
                                        Tất cả bài viết
                                    </button>
                                    <div className="flex items-center gap-3">
                                        <button onClick={copyLink} className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-cyan-300 transition-colors">
                                            <Copy size={12} /> Copy link
                                        </button>
                                        <span className="text-[10px] uppercase tracking-widest text-slate-600">QLDDHCM · GIS Blog</span>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* ── Floating TOC sidebar (desktop) ───────────── */}
                    {toc.length > 0 && !loading && post && (
                        <aside className="hidden lg:block w-60 flex-shrink-0 sticky top-6">
                            <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 backdrop-blur-sm p-4 shadow-xl">
                                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 flex items-center gap-2">
                                    <List size={11} /> Mục lục
                                </div>
                                {/* Progress mini */}
                                <div className="mb-3 h-1 rounded-full bg-slate-800 overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-100 rounded-full" style={{ width: `${readPct}%` }} />
                                </div>
                                <ul className="space-y-0.5">
                                    {toc.map(item => (
                                        <li key={item.id}>
                                            <button
                                                onClick={() => scrollToHeading(item.id)}
                                                className={`w-full text-left text-[11px] leading-snug py-1.5 px-2.5 rounded-lg transition-all flex items-start gap-2 ${
                                                    activeHeading === item.id
                                                        ? 'text-cyan-300 bg-cyan-950/50 font-bold'
                                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                                                } ${item.level === 2 ? 'pl-5' : ''}`}
                                            >
                                                {activeHeading === item.id && (
                                                    <span className="mt-0.5 w-1 h-1 rounded-full bg-cyan-400 flex-shrink-0 mt-1.5" />
                                                )}
                                                <span className="line-clamp-2">{item.text}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                                <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
                                    <span>{Math.round(readPct)}% đã đọc</span>
                                    <span>{getReadingTime(post?.content_html ?? '')} phút</span>
                                </div>
                            </div>
                        </aside>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BlogGISPost;
