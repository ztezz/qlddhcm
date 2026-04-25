import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, UserRole, BlogPost } from '../types';
import { blogService } from '../services/mockBackend';
import { Bookmark, BookmarkCheck, BookOpen, CalendarDays, ChevronRight, Clock, Edit3, Eye, Heart, LayoutGrid, LayoutList, Plus, Search, SortDesc, Trash2, X, Type, Bold, Italic, Underline, List, Link2, Heading1, Heading2, Image as ImageIcon, Loader2, Sparkles, PenSquare, Tag } from 'lucide-react';

/* ── Bookmark helpers ──────────────────────────────────────────── */
const getBmKey  = (userId?: string) => `blog_bookmarks_${userId || 'guest'}`;
const loadBookmarks = (userId?: string): number[] => {
    try { return JSON.parse(localStorage.getItem(getBmKey(userId)) || '[]'); }
    catch { return []; }
};
const saveBookmarks = (userId: string | undefined, ids: number[]) =>
    localStorage.setItem(getBmKey(userId), JSON.stringify(ids));

/* ── View count helpers ────────────────────────────────────────── */
const VIEWS_KEY = 'blog_view_counts';
const loadViewCounts = (): Record<number, number> => {
    try { return JSON.parse(localStorage.getItem(VIEWS_KEY) || '{}'); }
    catch { return {}; }
};

/* ── Like helpers ──────────────────────────────────────────────── */
const LIKES_KEY = 'blog_likes';
const getLikedByKey = (userId?: string) => `blog_liked_by_${userId || 'guest'}`;
const loadAllLikes = (): Record<number, number> => {
    try { return JSON.parse(localStorage.getItem(LIKES_KEY) || '{}'); }
    catch { return {}; }
};
const loadLikedByUser = (userId?: string): number[] => {
    try { return JSON.parse(localStorage.getItem(getLikedByKey(userId)) || '[]'); }
    catch { return []; }
};
const toggleLikePost = (postId: number, userId?: string): { counts: Record<number, number>; likedBy: number[] } => {
    try {
        const counts: Record<number, number> = JSON.parse(localStorage.getItem(LIKES_KEY) || '{}');
        const likedBy: number[] = JSON.parse(localStorage.getItem(getLikedByKey(userId)) || '[]');
        const was = likedBy.includes(postId);
        const nextLiked = was ? likedBy.filter(id => id !== postId) : [...likedBy, postId];
        counts[postId] = Math.max(0, (counts[postId] ?? 0) + (was ? -1 : 1));
        localStorage.setItem(LIKES_KEY, JSON.stringify(counts));
        localStorage.setItem(getLikedByKey(userId), JSON.stringify(nextLiked));
        return { counts, likedBy: nextLiked };
    } catch { return { counts: {}, likedBy: [] }; }
};

/* ── Reading history helpers ───────────────────────────────────── */
const getHistoryKey = (userId?: string) => `blog_read_history_${userId || 'guest'}`;
const loadReadHistory = (userId?: string): number[] => {
    try { return JSON.parse(localStorage.getItem(getHistoryKey(userId)) || '[]'); }
    catch { return []; }
};

interface BlogGISProps {
    user?: User | null;
}

const canWrite = (user?: User | null) => !!user && (user.role === UserRole.ADMIN || user.role === UserRole.EDITOR);

/* ── Search text highlight helper ─────────────────────────────── */
const highlightText = (text: string, query: string): React.ReactNode => {
    if (!query.trim()) return text;
    const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    return parts.map((part, i) =>
        part.toLowerCase() === query.trim().toLowerCase()
            ? <mark key={i} className="bg-yellow-400/25 text-yellow-200 rounded px-0.5 not-italic">{part}</mark>
            : part
    );
};

const isNew = (d: string) => Date.now() - new Date(d).getTime() < 7 * 24 * 60 * 60 * 1000;

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

const toHtmlFromPlainText = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return `<p>${escapeHtml(trimmed).replace(/\n/g, '<br/>')}</p>`;
};

const stripHtml = (value: string) =>
    String(value || '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const toDateTimeLocalValue = (value?: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const timezoneOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
};

const isFuturePublish = (publishAt?: string | null) => {
    if (!publishAt) return false;
    const timestamp = new Date(publishAt).getTime();
    return Number.isFinite(timestamp) && timestamp > Date.now();
};

const formatPublishDate = (value?: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('vi-VN');
};

const BlogGIS: React.FC<BlogGISProps> = ({ user }) => {
    const navigate = useNavigate();
    const [posts, setPosts] = useState<BlogPost[]>([]);
    const [query, setQuery] = useState('');
    const [activeTag, setActiveTag] = useState('TẤT CẢ');
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    /* Bookmark state */
    const [bookmarks, setBookmarks] = useState<number[]>(() => loadBookmarks(user?.id));
    useEffect(() => { setBookmarks(loadBookmarks(user?.id)); }, [user?.id]);
    const toggleBookmark = useCallback((postId: number) => {
        setBookmarks((prev) => {
            const next = prev.includes(postId) ? prev.filter((b) => b !== postId) : [...prev, postId];
            saveBookmarks(user?.id, next);
            return next;
        });
    }, [user?.id]);

    /* Sort / view / bookmarks-only */
    const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'fastest' | 'popular'>('newest');
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [showBmOnly, setShowBmOnly] = useState(false);

    /* View counts */
    const [viewCounts, setViewCounts] = useState<Record<number, number>>(() => loadViewCounts());

    /* Likes */
    const [likeCounts, setLikeCounts] = useState<Record<number, number>>(() => loadAllLikes());
    const [likedByUser, setLikedByUser] = useState<number[]>(() => loadLikedByUser(undefined));

    /* Reading history + unread filter */
    const [readHistory, setReadHistory] = useState<number[]>(() => loadReadHistory(undefined));
    const [showUnread, setShowUnread] = useState(false);

    /* Sync likes + history when user changes */
    useEffect(() => {
        setLikedByUser(loadLikedByUser(user?.id));
        setReadHistory(loadReadHistory(user?.id));
    }, [user?.id]);

    /* Keyboard shortcuts */
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [showShortcuts, setShowShortcuts] = useState(false);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement).tagName;
            const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement).isContentEditable;
            if (e.key === 'Escape') {
                if (query) { setQuery(''); searchInputRef.current?.blur(); }
                setShowShortcuts(false);
                return;
            }
            if (e.key === '?' && !isInput) { e.preventDefault(); setShowShortcuts(v => !v); return; }
            if (e.key === '/' && !isInput) { e.preventDefault(); searchInputRef.current?.focus(); return; }
            if (e.key === 'g' && !isInput) { e.preventDefault(); setViewMode(v => v === 'list' ? 'grid' : 'list'); return; }
            if (e.key === 'b' && !isInput) { e.preventDefault(); setShowBmOnly(v => !v); return; }
            if (e.key === 'u' && !isInput) { e.preventDefault(); setShowUnread(v => !v); return; }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [query]);

    const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
    const [isComposerOpen, setIsComposerOpen] = useState(false);
    const [draftTitle, setDraftTitle] = useState('');
    const [draftSummary, setDraftSummary] = useState('');
    const [draftTags, setDraftTags] = useState('');
    const [draftCoverImage, setDraftCoverImage] = useState('');
    const [isScheduledPublish, setIsScheduledPublish] = useState(false);
    const [draftPublishAt, setDraftPublishAt] = useState('');
    const [activeEditorMode, setActiveEditorMode] = useState<'VISUAL' | 'HTML'>('VISUAL');

    const editorRef = useRef<HTMLDivElement | null>(null);
    const htmlRef = useRef<HTMLTextAreaElement | null>(null);

    const loadPosts = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await blogService.getPosts();
            setPosts(Array.isArray(data) ? data : []);
        } catch (e: any) {
            setError(e?.message || 'Không thể tải bài viết GIS.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPosts();
    }, []);

    const sortedPosts = useMemo(() => {
        const arr = [...posts];
        if (sortBy === 'oldest')  arr.sort((a, b) => +new Date(a.updated_at) - +new Date(b.updated_at));
        else if (sortBy === 'fastest') arr.sort((a, b) => {
            const ra = Math.max(1, Math.ceil(stripHtml(a.content_html).split(/\s+/).filter(Boolean).length / 220));
            const rb = Math.max(1, Math.ceil(stripHtml(b.content_html).split(/\s+/).filter(Boolean).length / 220));
            return ra - rb;
        });
        else if (sortBy === 'popular') arr.sort((a, b) => {
            const va = (viewCounts[a.id] ?? 0) + (likeCounts[a.id] ?? 0) * 3;
            const vb = (viewCounts[b.id] ?? 0) + (likeCounts[b.id] ?? 0) * 3;
            return vb - va;
        });
        else arr.sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at)); // newest
        return arr;
    }, [posts, sortBy, viewCounts, likeCounts]);

    const availableTags = useMemo(() => {
        const set = new Set<string>();
        posts.forEach((post) => (post.tags || []).forEach((tag) => set.add(String(tag).trim().toLowerCase())));
        return ['TẤT CẢ', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'))];
    }, [posts]);

    const filteredPosts = useMemo(() => {
        const q = query.trim().toLowerCase();
        return sortedPosts.filter((p) => {
            const byTag = activeTag === 'TẤT CẢ' || (p.tags || []).map((t) => String(t).toLowerCase()).includes(activeTag);
            const haystack = `${p.title} ${p.summary} ${stripHtml(p.content_html)} ${(p.tags || []).join(' ')}`.toLowerCase();
            const byQuery = !q || haystack.includes(q);
            const byBm = !showBmOnly || bookmarks.includes(p.id);
            const byUnread = !showUnread || !readHistory.includes(p.id);
            return byTag && byQuery && byBm && byUnread;
        });
    }, [sortedPosts, query, activeTag, showBmOnly, bookmarks, showUnread, readHistory]);

    const featuredPost = useMemo(() => filteredPosts[0], [filteredPosts]);
    const listPosts = useMemo(
        () => filteredPosts.filter((p) => !featuredPost || p.id !== featuredPost.id),
        [filteredPosts, featuredPost]
    );
    const postsPerPage = 6;
    const totalPages = Math.max(1, Math.ceil(listPosts.length / postsPerPage));
    const listStart = (currentPage - 1) * postsPerPage;
    const pageItems = useMemo(
        () => listPosts.slice(listStart, listStart + postsPerPage),
        [listPosts, listStart]
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [query, activeTag]);

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);

    const openCreate = () => {
        setEditingPost(null);
        setDraftTitle('');
        setDraftSummary('');
        setDraftTags('');
        setDraftCoverImage('');
        setIsScheduledPublish(false);
        setDraftPublishAt(toDateTimeLocalValue(new Date().toISOString()));
        setActiveEditorMode('VISUAL');
        setIsComposerOpen(true);
        setTimeout(() => {
            if (editorRef.current) editorRef.current.innerHTML = '<p><br/></p>';
            if (htmlRef.current) htmlRef.current.value = '<p><br/></p>';
        }, 0);
    };

    const openEdit = (post: BlogPost) => {
        setEditingPost(post);
        setDraftTitle(post.title || '');
        setDraftSummary(post.summary || '');
        setDraftTags((post.tags || []).join(', '));
        setDraftCoverImage(post.cover_image || '');
        setIsScheduledPublish(isFuturePublish(post.publish_at));
        setDraftPublishAt(toDateTimeLocalValue(post.publish_at || post.created_at));
        setActiveEditorMode('VISUAL');
        setIsComposerOpen(true);
        setTimeout(() => {
            if (editorRef.current) editorRef.current.innerHTML = post.content_html || '<p><br/></p>';
            if (htmlRef.current) htmlRef.current.value = post.content_html || '<p><br/></p>';
        }, 0);
    };

    const closeComposer = () => {
        setIsComposerOpen(false);
        setEditingPost(null);
        setSaving(false);
    };

    const getEditorHtml = () => {
        const raw = activeEditorMode === 'HTML'
            ? (htmlRef.current?.value || '')
            : (editorRef.current?.innerHTML || '');
        const plain = stripHtml(raw);
        if (!plain) return '';
        return raw;
    };

    const applyCommand = (command: string, value?: string) => {
        if (!editorRef.current) return;
        editorRef.current.focus();
        document.execCommand(command, false, value);
    };

    const applyLink = () => {
        const value = window.prompt('Nhập URL (https://...)');
        if (!value) return;
        applyCommand('createLink', value.trim());
    };

    const syncVisualToHtml = () => {
        if (editorRef.current && htmlRef.current) {
            htmlRef.current.value = editorRef.current.innerHTML;
        }
    };

    const syncHtmlToVisual = () => {
        if (editorRef.current && htmlRef.current) {
            editorRef.current.innerHTML = htmlRef.current.value;
        }
    };

    const applyHeading = (level: 'H1' | 'H2') => {
        applyCommand('formatBlock', level);
    };

    const savePost = async () => {
        if (!canWrite(user)) return;

        const title = draftTitle.trim();
        const summary = draftSummary.trim();
        const contentHtml = getEditorHtml();
        const tags = draftTags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
        const coverImage = draftCoverImage.trim();
        const publishAt = isScheduledPublish ? draftPublishAt.trim() : '';

        if (!title || !summary || !contentHtml) {
            setError('Vui lòng nhập tiêu đề, tóm tắt và nội dung bài viết.');
            return;
        }
        if (isScheduledPublish && !publishAt) {
            setError('Vui lòng chọn thời gian đăng tự động.');
            return;
        }

        const normalizedPublishAt = publishAt ? new Date(publishAt) : null;
        if (publishAt && (!normalizedPublishAt || Number.isNaN(normalizedPublishAt.getTime()))) {
            setError('Thời gian đăng bài không hợp lệ.');
            return;
        }

        setSaving(true);
        setError('');
        try {
            if (editingPost) {
                await blogService.updatePost(editingPost.id, {
                    title,
                    summary,
                    content_html: contentHtml,
                    cover_image: coverImage,
                    tags,
                    publish_at: normalizedPublishAt?.toISOString()
                });
            } else {
                await blogService.createPost({
                    title,
                    summary,
                    content_html: contentHtml,
                    cover_image: coverImage,
                    tags,
                    publish_at: normalizedPublishAt?.toISOString()
                });
            }

            closeComposer();
            await loadPosts();
        } catch (e: any) {
            setError(e?.message || 'Không thể lưu bài viết.');
        } finally {
            setSaving(false);
        }
    };

    const removePost = async (post: BlogPost) => {
        if (!canWrite(user)) return;
        const ok = window.confirm(`Xác nhận xóa bài viết: ${post.title}?`);
        if (!ok) return;

        setError('');
        try {
            await blogService.deletePost(post.id);
            await loadPosts();
        } catch (e: any) {
            setError(e?.message || 'Không thể xóa bài viết.');
        }
    };

    const getReadingTime = (html: string) => {
        const words = stripHtml(html).split(/\s+/).filter(Boolean).length;
        return Math.max(1, Math.ceil(words / 220));
    };

    const postCount = posts.length;
    const scheduledCount = useMemo(() => posts.filter((post) => isFuturePublish(post.publish_at)).length, [posts]);
    const tagCount = useMemo(() => {
        const set = new Set<string>();
        posts.forEach((post) => (post.tags || []).forEach((tag) => set.add(tag)));
        return set.size;
    }, [posts]);

    /* Tag frequency map for cloud */
    const tagFrequency = useMemo(() => {
        const freq: Record<string, number> = {};
        posts.forEach(p => (p.tags || []).forEach(t => {
            const k = t.trim().toLowerCase();
            freq[k] = (freq[k] ?? 0) + 1;
        }));
        return freq;
    }, [posts]);

    /* Personalized suggestions: find unread posts sharing tags with read posts */
    const suggestedPosts = useMemo(() => {
        if (readHistory.length === 0) return [];
        const readPosts = posts.filter(p => readHistory.includes(p.id));
        const preferredTags = new Set(readPosts.flatMap(p => (p.tags || []).map(t => t.toLowerCase())));
        if (preferredTags.size === 0) return [];
        return posts
            .filter(p => !readHistory.includes(p.id))
            .map(p => ({
                post: p,
                score: (p.tags || []).filter(t => preferredTags.has(t.toLowerCase())).length,
            }))
            .filter(x => x.score > 0)
            .sort((a, b) => b.score - a.score || +new Date(b.post.updated_at) - +new Date(a.post.updated_at))
            .slice(0, 4)
            .map(x => x.post);
    }, [posts, readHistory]);

    const totalViews = useMemo(() => Object.values(viewCounts).reduce((a, b) => a + b, 0), [viewCounts]);
    const totalLikes = useMemo(() => Object.values(likeCounts).reduce((a, b) => a + b, 0), [likeCounts]);

    return (
        <div className="absolute inset-0 overflow-y-auto bg-slate-950 text-white">
            <style>{`
                @keyframes blogOrbFloat {
                    0%, 100% { transform: translateY(0) scale(1); opacity: 0.6; }
                    50% { transform: translateY(-22px) scale(1.08); opacity: 0.9; }
                }
                @keyframes blogOrbFloat2 {
                    0%, 100% { transform: translateY(0) scale(1.05); opacity: 0.5; }
                    50% { transform: translateY(18px) scale(0.95); opacity: 0.8; }
                }
                @keyframes blogGridScroll {
                    from { transform: translateY(0); }
                    to { transform: translateY(40px); }
                }
                @keyframes blogShimmerText {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                @keyframes blogLogoSpin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes blogLogoSpinReverse {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(-360deg); }
                }
                @keyframes blogFadeSlideUp {
                    from { opacity: 0; transform: translateY(18px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes blogPulseGlow {
                    0%, 100% { box-shadow: 0 0 20px rgba(6,182,212,0.25), 0 0 60px rgba(6,182,212,0.08); }
                    50% { box-shadow: 0 0 35px rgba(6,182,212,0.4), 0 0 80px rgba(6,182,212,0.15); }
                }
                @keyframes blogDotBlink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.3; }
                }
                .blog-hero-title {
                    background: linear-gradient(110deg, #ffffff 0%, #a5f3fc 25%, #6ee7b7 55%, #a5f3fc 75%, #ffffff 100%);
                    background-size: 250% 250%;
                    animation: blogShimmerText 5s ease infinite;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                .blog-site-name {
                    background: linear-gradient(90deg, #67e8f9 0%, #34d399 50%, #67e8f9 100%);
                    background-size: 200% 100%;
                    animation: blogShimmerText 3s linear infinite;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                .blog-logo-ring-outer { animation: blogLogoSpin 18s linear infinite; }
                .blog-logo-ring-inner { animation: blogLogoSpinReverse 12s linear infinite; }
                .blog-orb-1 { animation: blogOrbFloat 7s ease-in-out infinite; }
                .blog-orb-2 { animation: blogOrbFloat2 9s ease-in-out infinite; }
                .blog-orb-3 { animation: blogOrbFloat 11s ease-in-out infinite 2s; }
                .blog-fade-1 { animation: blogFadeSlideUp 0.6s ease both; }
                .blog-fade-2 { animation: blogFadeSlideUp 0.6s ease 0.12s both; }
                .blog-fade-3 { animation: blogFadeSlideUp 0.6s ease 0.24s both; }
                .blog-fade-4 { animation: blogFadeSlideUp 0.6s ease 0.36s both; }
                .blog-hero-card { animation: blogPulseGlow 4s ease-in-out infinite; }
                .blog-live-dot { animation: blogDotBlink 2s ease-in-out infinite; }
            `}</style>

            {/* Page background */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="blog-orb-1 absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-cyan-600/10 blur-[80px]" />
                <div className="blog-orb-2 absolute top-1/3 -right-40 w-[400px] h-[400px] rounded-full bg-emerald-600/10 blur-[80px]" />
                <div className="blog-orb-3 absolute -bottom-20 left-1/3 w-[360px] h-[360px] rounded-full bg-indigo-600/8 blur-[80px]" />
            </div>

            <div className="relative mx-auto max-w-6xl px-4 md:px-8 py-6 md:py-10 space-y-6">

                {/* ── HERO HEADER ─────────────────────────────────────── */}
                <div className="blog-hero-card relative overflow-hidden rounded-3xl border border-cyan-800/30 bg-gradient-to-br from-slate-900 via-slate-900/95 to-cyan-950/40 shadow-2xl">

                    {/* Grid lines overlay */}
                    <div className="absolute inset-0 pointer-events-none opacity-[0.035]"
                        style={{ backgroundImage: 'linear-gradient(rgba(6,182,212,1) 1px,transparent 1px),linear-gradient(90deg,rgba(6,182,212,1) 1px,transparent 1px)', backgroundSize: '44px 44px' }} />

                    {/* Horizontal glow line at top */}
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/60 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

                    <div className="relative p-6 md:p-10">

                        {/* ── Top bar: Logo + Site name + Write button ── */}
                        <div className="blog-fade-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 mb-8">

                            {/* Logo block */}
                            <div className="flex items-center gap-4">
                                {/* Animated logo */}
                                <div className="relative w-16 h-16 md:w-20 md:h-20 flex-shrink-0">
                                    {/* Outer spinning ring */}
                                    <svg className="blog-logo-ring-outer absolute inset-0 w-full h-full" viewBox="0 0 80 80" fill="none">
                                        <circle cx="40" cy="40" r="37" stroke="url(#outerRingGrad)" strokeWidth="1.5" strokeDasharray="8 5" strokeLinecap="round" />
                                        <defs>
                                            <linearGradient id="outerRingGrad" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
                                                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.7" />
                                                <stop offset="100%" stopColor="#10b981" stopOpacity="0.2" />
                                            </linearGradient>
                                        </defs>
                                    </svg>
                                    {/* Inner spinning ring */}
                                    <svg className="blog-logo-ring-inner absolute inset-0 w-full h-full" viewBox="0 0 80 80" fill="none">
                                        <circle cx="40" cy="40" r="28" stroke="url(#innerRingGrad)" strokeWidth="1" strokeDasharray="4 8" strokeLinecap="round" />
                                        <defs>
                                            <linearGradient id="innerRingGrad" x1="80" y1="0" x2="0" y2="80" gradientUnits="userSpaceOnUse">
                                                <stop offset="0%" stopColor="#34d399" stopOpacity="0.6" />
                                                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.15" />
                                            </linearGradient>
                                        </defs>
                                    </svg>
                                    {/* Center icon */}
                                    <div className="absolute inset-0 m-3 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-slate-800 to-emerald-500/20 border border-cyan-600/30 flex items-center justify-center shadow-inner shadow-cyan-900/50">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className="w-7 h-7 md:w-8 md:h-8" stroke="url(#globeGrad)" strokeWidth="1.3">
                                            <defs>
                                                <linearGradient id="globeGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                                                    <stop offset="0%" stopColor="#67e8f9" />
                                                    <stop offset="100%" stopColor="#34d399" />
                                                </linearGradient>
                                            </defs>
                                            <circle cx="12" cy="12" r="10" />
                                            <line x1="2" y1="12" x2="22" y2="12" />
                                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                                            <path d="M4.2 7h15.6M4.2 17h15.6" />
                                        </svg>
                                    </div>
                                </div>

                                {/* Site name */}
                                <div>
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 blog-live-dot" />
                                        <span className="text-[9px] font-black tracking-[0.35em] uppercase text-slate-400">Hệ thống WebGIS</span>
                                    </div>
                                    <div className="blog-site-name text-xl md:text-2xl font-black tracking-tight leading-none">QLDDHCM</div>
                                    <div className="mt-1 text-[10px] text-slate-500 tracking-wide">Quản lý địa chính Hồ Chí Minh</div>
                                </div>
                            </div>

                            {/* Write button */}
                            {canWrite(user) && (
                                <button
                                    onClick={openCreate}
                                    className="group self-start sm:self-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black uppercase tracking-widest text-[11px] transition-all shadow-lg shadow-cyan-900/40 hover:shadow-cyan-700/50 hover:scale-[1.03] active:scale-95"
                                >
                                    <PenSquare size={14} className="group-hover:rotate-[-8deg] transition-transform" />
                                    Viết bài mới
                                </button>
                            )}
                        </div>

                        {/* ── Blog title section ── */}
                        <div className="blog-fade-2">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black tracking-[0.25em] uppercase bg-cyan-500/10 text-cyan-300 border border-cyan-600/25 mb-4">
                                <BookOpen size={11} />
                                GIS Knowledge Base
                            </div>
                            <h1 className="blog-hero-title text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight">
                                Thư viện bài viết GIS
                            </h1>
                            <p className="mt-3 text-sm md:text-base text-slate-400 max-w-2xl leading-relaxed">
                                Nơi chia sẻ kiến thức WebGIS, xử lý dữ liệu không gian,<br className="hidden md:block" /> quy trình vận hành và kinh nghiệm triển khai thực tế.
                            </p>
                        </div>

                        {/* ── Stats pills ── */}
                        <div className="blog-fade-3 mt-5 flex flex-wrap gap-2.5">
                            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[10px] uppercase tracking-widest font-black rounded-full border border-cyan-600/30 bg-cyan-900/20 text-cyan-200 backdrop-blur-sm">
                                <Sparkles size={11} className="text-cyan-400" /> {postCount} bài viết
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[10px] uppercase tracking-widest font-black rounded-full border border-emerald-600/30 bg-emerald-900/20 text-emerald-200 backdrop-blur-sm">
                                <Tag size={11} className="text-emerald-400" /> {tagCount} chủ đề
                            </span>
                            {canWrite(user) && scheduledCount > 0 && (
                                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[10px] uppercase tracking-widest font-black rounded-full border border-amber-600/30 bg-amber-900/20 text-amber-200 backdrop-blur-sm">
                                    <Clock size={11} className="text-amber-400" /> {scheduledCount} bài hẹn giờ
                                </span>
                            )}
                            {totalViews > 0 && (
                                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[10px] uppercase tracking-widest font-black rounded-full border border-slate-600/40 bg-slate-800/40 text-slate-300 backdrop-blur-sm">
                                    <Eye size={11} className="text-slate-400" /> {totalViews} lượt xem
                                </span>
                            )}
                            {totalLikes > 0 && (
                                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[10px] uppercase tracking-widest font-black rounded-full border border-rose-600/30 bg-rose-900/20 text-rose-200 backdrop-blur-sm">
                                    <Heart size={11} className="text-rose-400" /> {totalLikes} lượt thích
                                </span>
                            )}
                            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[10px] uppercase tracking-widest font-black rounded-full border border-indigo-600/30 bg-indigo-900/20 text-indigo-200 backdrop-blur-sm">
                                <BookOpen size={11} className="text-indigo-400" /> GIS · WebGIS · PostGIS
                            </span>
                        </div>

                        {/* ── Divider ── */}
                        <div className="blog-fade-4 mt-7 mb-5 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />

                        {/* ── Search ── */}
                        <div className="blog-fade-4 relative">
                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                            <input
                                ref={searchInputRef}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Tìm theo tiêu đề, nội dung, tag... (nhấn / để tìm kiếm)"
                                className="w-full rounded-2xl bg-slate-950/60 border border-slate-700/80 pl-10 pr-24 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500 focus:bg-slate-950 transition-colors backdrop-blur-sm"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                {query && (
                                    <button onClick={() => setQuery('')} className="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors">
                                        <X size={13} />
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowShortcuts(v => !v)}
                                    title="Phím tắt (?)"
                                    className={`px-2 py-1 rounded-lg text-[10px] font-black border transition-all ${showShortcuts ? 'bg-slate-700 border-slate-600 text-white' : 'border-slate-700 text-slate-500 hover:text-slate-300'}`}
                                >
                                    ?
                                </button>
                            </div>
                        </div>

                        {/* ── Keyboard shortcuts panel ── */}
                        {showShortcuts && (
                            <div className="mt-3 rounded-2xl border border-slate-700/60 bg-slate-900/80 backdrop-blur-sm p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                                <div className="col-span-full text-[9px] font-black uppercase tracking-[0.25em] text-slate-500 mb-1">Phím tắt</div>
                                {([
                                    ['/','Tìm kiếm'],['Esc','Xoá tìm kiếm'],['g','Grid / List'],
                                    ['b','Lọc đã lưu'],['u','Lọc chưa đọc'],['?','Đóng panel này'],
                                ] as [string, string][]).map(([key, desc]) => (
                                    <div key={key} className="flex items-center gap-2 text-xs text-slate-400">
                                        <kbd className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-white font-mono text-[11px] font-bold shadow">{key}</kbd>
                                        <span>{desc}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ── Tag chip bar + cloud ── */}
                        <div className="mt-3.5 flex flex-wrap gap-2 items-center">
                            {availableTags.map((tag) => {
                                const isActive = activeTag === tag;
                                const freq = tag === 'TẤT CẢ' ? 0 : (tagFrequency[tag.toLowerCase()] ?? 1);
                                const maxFreq = Math.max(1, ...Object.values(tagFrequency));
                                /* Scale font: 10px (freq=1) → 14px (freq=max) */
                                const fontSize = tag === 'TẤT CẢ' ? 10 : Math.round(10 + (freq / maxFreq) * 4);
                                return (
                                    <button
                                        key={tag}
                                        onClick={() => setActiveTag(tag)}
                                        style={{ fontSize: `${fontSize}px` }}
                                        className={`px-3.5 py-1.5 rounded-full font-black uppercase tracking-widest border transition-all ${
                                            isActive
                                                ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 border-transparent shadow-md shadow-cyan-900/40 scale-105'
                                                : 'border-slate-700/70 text-slate-400 hover:border-cyan-600/60 hover:text-cyan-300 hover:bg-cyan-950/30'
                                        }`}
                                    >
                                        {tag}{freq > 1 && !isActive && <span className="ml-1 opacity-50 font-normal normal-case tracking-normal text-[9px]">{freq}</span>}
                                    </button>
                                );
                            })}
                        </div>

                        {/* ── Toolbar: Sort + View toggle + Bookmarks filter ── */}
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            {/* Sort controls */}
                            <div className="flex items-center gap-1.5">
                                <SortDesc size={13} className="text-slate-500" />
                                {(['newest', 'oldest', 'popular', 'fastest'] as const).map((s) => {
                                    const labels = { newest: 'Mới nhất', oldest: 'Cũ nhất', popular: 'Phổ biến', fastest: 'Đọc nhanh' };
                                    return (
                                        <button
                                            key={s}
                                            onClick={() => setSortBy(s)}
                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
                                                sortBy === s
                                                    ? 'bg-slate-700 border-slate-600 text-white'
                                                    : 'border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                                            }`}
                                        >
                                            {labels[s]}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Right controls */}
                            <div className="flex items-center gap-2">
                                {/* Unread filter */}
                                <button
                                    onClick={() => setShowUnread(v => !v)}
                                    title="Chỉ hiện bài chưa đọc"
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                                        showUnread
                                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                            : 'border-slate-700 text-slate-400 hover:border-emerald-500/30 hover:text-emerald-300'
                                    }`}
                                >
                                    <Eye size={12} />
                                    Chưa đọc
                                    {readHistory.length > 0 && (
                                        <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 text-[9px]">{readHistory.length} đã đọc</span>
                                    )}
                                </button>

                                {/* Bookmarks filter */}
                                <button
                                    onClick={() => setShowBmOnly(v => !v)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                                        showBmOnly
                                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                            : 'border-slate-700 text-slate-400 hover:border-amber-500/30 hover:text-amber-300'
                                    }`}
                                >
                                    {showBmOnly ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
                                    Đã lưu{bookmarks.length > 0 && <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-200 text-[9px]">{bookmarks.length}</span>}
                                </button>

                                {/* View toggle */}
                                <div className="flex items-center border border-slate-700 rounded-xl overflow-hidden">
                                    <button
                                        onClick={() => setViewMode('list')}
                                        className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                        title="Dạng danh sách"
                                    >
                                        <LayoutList size={14} />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('grid')}
                                        className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                        title="Dạng lưới"
                                    >
                                        <LayoutGrid size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="rounded-xl border border-red-800/40 bg-red-950/20 p-3 text-sm text-red-200">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 flex items-center justify-center gap-3 text-slate-300">
                        <Loader2 size={16} className="animate-spin" /> Đang tải bài viết...
                    </div>
                ) : (
                    <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : 'grid grid-cols-1 gap-4 md:gap-5'}>
                        {/* Featured post — always full-width in both modes */}
                        {viewMode === 'list' && featuredPost && (
                            <article className="group relative overflow-hidden rounded-3xl border border-cyan-800/40 bg-gradient-to-br from-slate-900 to-cyan-950/30 p-5 md:p-6 shadow-2xl shadow-cyan-950/30">
                                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
                                <div className="flex items-center justify-between mb-3">
                                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">⭐ Bài nổi bật</div>
                                    <button
                                        onClick={() => toggleBookmark(featuredPost.id)}
                                        title={bookmarks.includes(featuredPost.id) ? 'Bỏ lưu' : 'Lưu bài'}
                                        className={`p-1.5 rounded-lg border transition-all ${
                                            bookmarks.includes(featuredPost.id)
                                                ? 'border-amber-500/40 text-amber-300 bg-amber-900/20'
                                                : 'border-slate-700 text-slate-500 hover:border-amber-500/40 hover:text-amber-300'
                                        }`}
                                    >
                                        {bookmarks.includes(featuredPost.id) ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                                    </button>
                                </div>
                                {featuredPost.cover_image && (
                                    <div className="mb-4 rounded-2xl border border-slate-700 overflow-hidden bg-slate-900 cursor-pointer" onClick={() => navigate(`/bloggis/${featuredPost.id}`)}>
                                        <img src={featuredPost.cover_image} alt={featuredPost.title} className="w-full h-64 md:h-80 object-cover group-hover:scale-[1.02] transition-transform duration-500" />
                                    </div>
                                )}
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                    {isNew(featuredPost.created_at) && (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 animate-pulse">✦ Mới</span>
                                    )}
                                </div>
                                <h2
                                    onClick={() => navigate(`/bloggis/${featuredPost.id}`)}
                                    className="text-2xl md:text-3xl font-black tracking-tight text-white hover:text-cyan-200 cursor-pointer transition-colors"
                                >{featuredPost.title}</h2>
                                <p className="mt-3 text-sm md:text-base text-slate-300 line-clamp-3">{featuredPost.summary}</p>
                                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                                        <CalendarDays size={12} />
                                        <span>{new Date(featuredPost.updated_at).toLocaleString('vi-VN')}</span>
                                        <span>•</span>
                                        <Clock size={12} />
                                        <span>{getReadingTime(featuredPost.content_html)} phút đọc</span>
                                        <span>•</span>
                                        <span>{featuredPost.author_name}</span>
                                    </div>
                                    <button
                                        onClick={() => navigate(`/bloggis/${featuredPost.id}`)}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black uppercase tracking-widest text-[10px] transition-all shadow-md shadow-cyan-900/30 hover:scale-105 active:scale-95"
                                    >
                                        Đọc tiếp <ChevronRight size={12} />
                                    </button>
                                </div>
                            </article>
                        )}

                        {filteredPosts.length === 0 && (
                            <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/90 to-slate-900/40 p-10 text-center">
                                <div className="mx-auto w-12 h-12 rounded-2xl border border-cyan-800/40 bg-cyan-900/20 flex items-center justify-center text-cyan-300 mb-4">
                                    <BookOpen size={22} />
                                </div>
                                <h3 className="text-lg font-black text-white tracking-tight">Chưa có bài viết nào</h3>
                                <p className="mt-2 text-sm text-slate-400">Bạn có thể bắt đầu bằng một bài viết giới thiệu bản đồ nền, quy trình số hóa hoặc mẹo phân tích không gian.</p>
                                {canWrite(user) && (
                                    <button
                                        onClick={openCreate}
                                        className="mt-5 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black uppercase tracking-widest text-[11px] transition-colors"
                                    >
                                        <Plus size={14} /> Tạo bài viết đầu tiên
                                    </button>
                                )}
                            </div>
                        )}

                        {pageItems.map((post) => {
                            const views = viewCounts[post.id] ?? 0;
                            const isBm = bookmarks.includes(post.id);
                            const isRead = readHistory.includes(post.id);
                            const postLikes = likeCounts[post.id] ?? 0;
                            const isLiked = likedByUser.includes(post.id);
                            const isScheduled = isFuturePublish(post.publish_at);
                            /* ── Grid card (compact) ── */
                            if (viewMode === 'grid') return (
                                <article key={post.id} className="group rounded-2xl border border-slate-800 hover:border-cyan-700/40 bg-gradient-to-br from-slate-900/90 to-slate-900/60 overflow-hidden shadow-lg transition-all hover:shadow-cyan-950/30 cursor-pointer flex flex-col" onClick={() => navigate(`/bloggis/${post.id}`)}>
                                    {post.cover_image
                                        ? <div className="overflow-hidden border-b border-slate-800"><img src={post.cover_image} alt={post.title} className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-500" /></div>
                                        : <div className="h-24 bg-gradient-to-br from-cyan-950/40 via-slate-900 to-emerald-950/30 flex items-center justify-center border-b border-slate-800"><BookOpen size={28} className="text-slate-700" /></div>
                                    }
                                    <div className="p-4 flex flex-col flex-1">
                                        <div className="flex flex-wrap gap-1 mb-2">
                                            {isNew(post.created_at) && <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-600/30 animate-pulse">✦ Mới</span>}
                                            {isRead && <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-400 border border-slate-600/40">✓ Đã đọc</span>}
                                            {canWrite(user) && isScheduled && <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-600/30">Hẹn đăng</span>}
                                            {(post.tags || []).slice(0, 2).map(t => <span key={t} className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-cyan-950/40 text-cyan-400/80 border border-cyan-900/40">#{t}</span>)}
                                        </div>
                                        <h2 className="text-sm font-black tracking-tight text-white group-hover:text-cyan-200 transition-colors line-clamp-2 flex-1">{highlightText(post.title, query)}</h2>
                                        <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500">
                                            <span className="flex items-center gap-1"><Clock size={10} />{getReadingTime(post.content_html)} phút</span>
                                            <span className="flex items-center gap-1.5">
                                                {views > 0 && <span className="flex items-center gap-0.5"><Eye size={10} />{views}</span>}
                                                <button
                                                    onClick={e => {
                                                        e.stopPropagation();
                                                        const result = toggleLikePost(post.id, user?.id);
                                                        setLikeCounts(result.counts);
                                                        setLikedByUser(result.likedBy);
                                                    }}
                                                    className={`p-1 rounded transition-colors flex items-center gap-0.5 ${isLiked ? 'text-rose-300' : 'text-slate-600 hover:text-rose-300'}`}
                                                >
                                                    <Heart size={11} fill={isLiked ? 'currentColor' : 'none'} />
                                                    {postLikes > 0 && postLikes}
                                                </button>
                                                <button
                                                    onClick={e => { e.stopPropagation(); toggleBookmark(post.id); }}
                                                    className={`p-1 rounded transition-colors ${isBm ? 'text-amber-300' : 'text-slate-600 hover:text-amber-300'}`}
                                                >
                                                    {isBm ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
                                                </button>
                                            </span>
                                        </div>
                                    </div>
                                </article>
                            );
                            /* ── List card (full) ── */
                            return (
                                <article key={post.id} className="group rounded-2xl border border-slate-800 hover:border-cyan-800/40 bg-gradient-to-br from-slate-900/85 to-slate-900/60 p-5 md:p-6 shadow-xl shadow-slate-950/60 transition-colors">
                                    {post.cover_image && (
                                        <div className="mb-4 rounded-xl border border-slate-700 overflow-hidden bg-slate-900 cursor-pointer" onClick={() => navigate(`/bloggis/${post.id}`)}>
                                            <img src={post.cover_image} alt={post.title} className="w-full h-56 md:h-72 object-cover group-hover:scale-[1.02] transition-transform duration-500" />
                                        </div>
                                    )}
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                {isNew(post.created_at) && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 animate-pulse">✦ Mới</span>}
                                                {isRead && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-700/60 text-slate-400 border border-slate-600/40">✓ Đã đọc</span>}
                                                {canWrite(user) && isScheduled && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-500/15 text-amber-300 border border-amber-600/30">Hẹn đăng {formatPublishDate(post.publish_at)}</span>}
                                            </div>
                                            <h2 onClick={() => navigate(`/bloggis/${post.id}`)} className="text-lg md:text-xl font-black tracking-tight cursor-pointer hover:text-cyan-200 transition-colors">{highlightText(post.title, query)}</h2>
                                            <p className="mt-2 text-sm text-slate-300 line-clamp-2">{highlightText(post.summary || '', query)}</p>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <button onClick={() => toggleBookmark(post.id)} title={isBm ? 'Bỏ lưu' : 'Lưu bài'}
                                                className={`p-2 rounded-lg border transition-all ${isBm ? 'border-amber-500/40 text-amber-300 bg-amber-900/20' : 'border-slate-700 text-slate-500 hover:border-amber-500/40 hover:text-amber-300'}`}>
                                                {isBm ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                                            </button>
                                            {canWrite(user) && (
                                                <>
                                                    <button onClick={() => openEdit(post)} className="p-2 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200" title="Sửa bài viết"><Edit3 size={14} /></button>
                                                    <button onClick={() => removePost(post)} className="p-2 rounded-lg border border-red-800/40 text-red-400 hover:bg-red-900/20" title="Xóa bài viết"><Trash2 size={14} /></button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mt-4 flex flex-wrap items-center gap-2">
                                        {(post.tags || []).map(tag => (
                                            <span key={`${post.id}-${tag}`} className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-cyan-900/40 text-cyan-300 border border-cyan-800/50">#{tag}</span>
                                        ))}
                                    </div>
                                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                                            <CalendarDays size={11} />
                                            <span>{new Date(post.updated_at).toLocaleString('vi-VN')}</span>
                                            <span>•</span>
                                            <Clock size={11} />
                                            <span>{getReadingTime(post.content_html)} phút đọc</span>
                                            {views > 0 && <><span>•</span><Eye size={11} /><span>{views} lượt xem</span></>}
                                            <span>•</span>
                                            <span>{post.author_name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {/* Like */}
                                            <button
                                                onClick={() => {
                                                    const result = toggleLikePost(post.id, user?.id);
                                                    setLikeCounts(result.counts);
                                                    setLikedByUser(result.likedBy);
                                                }}
                                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[10px] font-black transition-all ${
                                                    isLiked
                                                        ? 'border-rose-500/40 text-rose-300 bg-rose-900/20'
                                                        : 'border-slate-700 text-slate-500 hover:border-rose-500/30 hover:text-rose-300'
                                                }`}
                                            >
                                                <Heart size={11} fill={isLiked ? 'currentColor' : 'none'} />
                                                {postLikes > 0 ? postLikes : ''}
                                            </button>
                                            <button onClick={() => navigate(`/bloggis/${post.id}`)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-cyan-800/40 text-cyan-300 hover:bg-cyan-900/20 font-black uppercase tracking-widest text-[10px] transition-colors">
                                                Đọc tiếp <ChevronRight size={11} />
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}

                        {listPosts.length > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                                <span className="text-xs text-slate-400">
                                    Trang {currentPage}/{totalPages} • {filteredPosts.length} bài viết
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-bold text-slate-200 disabled:opacity-40 hover:bg-slate-800"
                                    >
                                        Trước
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-bold text-slate-200 disabled:opacity-40 hover:bg-slate-800"
                                    >
                                        Sau
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Gợi ý cho bạn ───────────────────────────────────── */}
                {suggestedPosts.length > 0 && (
                    <div className="rounded-3xl border border-indigo-800/30 bg-gradient-to-br from-slate-900/90 to-indigo-950/20 p-5 md:p-6 shadow-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                                <Sparkles size={14} className="text-indigo-300" />
                            </div>
                            <div>
                                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-300">Gợi ý cho bạn</div>
                                <div className="text-[10px] text-slate-500">Dựa trên lịch sử đọc của bạn</div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {suggestedPosts.map(post => {
                                const isBm = bookmarks.includes(post.id);
                                return (
                                    <button
                                        key={post.id}
                                        onClick={() => navigate(`/bloggis/${post.id}`)}
                                        className="group text-left flex gap-3 rounded-2xl border border-slate-800 hover:border-indigo-700/40 bg-slate-900/60 p-3 transition-all hover:shadow-indigo-950/30"
                                    >
                                        {post.cover_image
                                            ? <img src={post.cover_image} alt={post.title} className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border border-slate-700 group-hover:scale-105 transition-transform" />
                                            : <div className="w-16 h-16 rounded-xl flex-shrink-0 border border-slate-700 bg-gradient-to-br from-indigo-950/60 to-slate-900 flex items-center justify-center"><BookOpen size={18} className="text-slate-600" /></div>
                                        }
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap gap-1 mb-1">
                                                {(post.tags || []).slice(0, 2).map(t => (
                                                    <span key={t} className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-indigo-900/40 text-indigo-300/80 border border-indigo-800/40">#{t}</span>
                                                ))}
                                            </div>
                                            <p className="text-xs font-black text-white group-hover:text-indigo-200 transition-colors line-clamp-2 leading-snug">{post.title}</p>
                                            <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500">
                                                <span className="flex items-center gap-1"><Clock size={9} />{getReadingTime(post.content_html)} phút</span>
                                                {isBm && <BookmarkCheck size={11} className="text-amber-400" />}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {isComposerOpen && canWrite(user) && (
                <div className="fixed inset-0 z-[1000] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-4xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl max-h-[92vh] overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
                            <h3 className="text-base font-black uppercase tracking-wider">{editingPost ? 'Sửa bài viết' : 'Viết bài GIS mới'}</h3>
                            <button onClick={closeComposer} className="p-2 rounded-lg hover:bg-slate-800 text-slate-300">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4 overflow-y-auto">
                            <input
                                value={draftTitle}
                                onChange={(e) => setDraftTitle(e.target.value)}
                                placeholder="Tiêu đề bài viết"
                                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-2.5 text-sm outline-none focus:border-cyan-500"
                            />
                            <input
                                value={draftSummary}
                                onChange={(e) => setDraftSummary(e.target.value)}
                                placeholder="Tóm tắt ngắn"
                                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-2.5 text-sm outline-none focus:border-cyan-500"
                            />
                            <input
                                value={draftCoverImage}
                                onChange={(e) => setDraftCoverImage(e.target.value)}
                                placeholder="Link ảnh bìa (https://...)"
                                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-2.5 text-sm outline-none focus:border-cyan-500"
                            />
                            {draftCoverImage && (
                                <div className="rounded-xl border border-slate-700 overflow-hidden bg-slate-950">
                                    <img src={draftCoverImage} alt="Cover preview" className="w-full h-44 object-cover" />
                                </div>
                            )}
                            <input
                                value={draftTags}
                                onChange={(e) => setDraftTags(e.target.value)}
                                placeholder="Tag, cách nhau bởi dấu phẩy"
                                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-2.5 text-sm outline-none focus:border-cyan-500"
                            />

                            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 space-y-3">
                                <label className="flex items-center gap-3 text-sm text-slate-200">
                                    <input
                                        type="checkbox"
                                        checked={isScheduledPublish}
                                        onChange={(e) => setIsScheduledPublish(e.target.checked)}
                                        className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500"
                                    />
                                    Tự động đăng bài vào thời điểm chỉ định
                                </label>

                                {isScheduledPublish ? (
                                    <div className="space-y-2">
                                        <input
                                            type="datetime-local"
                                            value={draftPublishAt}
                                            onChange={(e) => setDraftPublishAt(e.target.value)}
                                            className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-2.5 text-sm outline-none focus:border-cyan-500"
                                        />
                                        <p className="text-xs text-amber-300">
                                            Bài viết sẽ tự xuất hiện trên trang blog khi tới {draftPublishAt ? formatPublishDate(new Date(draftPublishAt).toISOString()) : 'thời gian đã chọn'}.
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-400">Tắt tuỳ chọn này để đăng ngay sau khi bấm lưu.</p>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        syncVisualToHtml();
                                        setActiveEditorMode('VISUAL');
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider border ${activeEditorMode === 'VISUAL' ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}
                                >
                                    Visual
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        syncVisualToHtml();
                                        setActiveEditorMode('HTML');
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider border ${activeEditorMode === 'HTML' ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}
                                >
                                    HTML
                                </button>
                            </div>

                            <div className="rounded-xl border border-slate-700 overflow-hidden bg-slate-950">
                                <div className="px-3 py-2 border-b border-slate-700 flex flex-wrap items-center gap-2">
                                    <button type="button" onClick={() => applyHeading('H1')} className="p-1.5 rounded hover:bg-slate-800 text-slate-300" title="Heading 1"><Heading1 size={14} /></button>
                                    <button type="button" onClick={() => applyHeading('H2')} className="p-1.5 rounded hover:bg-slate-800 text-slate-300" title="Heading 2"><Heading2 size={14} /></button>
                                    <button type="button" onClick={() => applyCommand('bold')} className="p-1.5 rounded hover:bg-slate-800 text-slate-300" title="Bold"><Bold size={14} /></button>
                                    <button type="button" onClick={() => applyCommand('italic')} className="p-1.5 rounded hover:bg-slate-800 text-slate-300" title="Italic"><Italic size={14} /></button>
                                    <button type="button" onClick={() => applyCommand('underline')} className="p-1.5 rounded hover:bg-slate-800 text-slate-300" title="Underline"><Underline size={14} /></button>
                                    <button type="button" onClick={() => applyCommand('insertUnorderedList')} className="p-1.5 rounded hover:bg-slate-800 text-slate-300" title="Bullet list"><List size={14} /></button>
                                    <button type="button" onClick={applyLink} className="p-1.5 rounded hover:bg-slate-800 text-slate-300" title="Link"><Link2 size={14} /></button>
                                    <button type="button" onClick={() => {
                                        const imageUrl = window.prompt('Nhập URL ảnh (https://...)');
                                        if (imageUrl) applyCommand('insertImage', imageUrl.trim());
                                    }} className="p-1.5 rounded hover:bg-slate-800 text-slate-300" title="Insert image"><ImageIcon size={14} /></button>
                                    <button type="button" onClick={() => applyCommand('removeFormat')} className="p-1.5 rounded hover:bg-slate-800 text-slate-300" title="Clear format"><Type size={14} /></button>
                                </div>

                                {activeEditorMode === 'VISUAL' ? (
                                    <div
                                        ref={editorRef}
                                        contentEditable
                                        suppressContentEditableWarning
                                        onInput={syncVisualToHtml}
                                        className="min-h-[280px] max-h-[420px] overflow-y-auto px-4 py-3 text-sm leading-7 outline-none"
                                    />
                                ) : (
                                    <textarea
                                        ref={htmlRef}
                                        onChange={syncHtmlToVisual}
                                        className="w-full min-h-[280px] max-h-[420px] overflow-y-auto px-4 py-3 bg-slate-950 text-cyan-100 font-mono text-xs outline-none"
                                    />
                                )}
                            </div>
                        </div>

                        <div className="px-5 py-4 border-t border-slate-700 flex items-center justify-end gap-3">
                            <button onClick={closeComposer} className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white">Hủy</button>
                            <button onClick={savePost} disabled={saving} className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 text-xs font-black uppercase tracking-wider inline-flex items-center gap-2">
                                {saving && <Loader2 size={14} className="animate-spin" />}
                                Lưu bài viết
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BlogGIS;
