import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MapPin, ArrowLeft, Home, Search, RefreshCw } from 'lucide-react';

const NotFound: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [countdown, setCountdown] = useState(15);

    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    navigate('/', { replace: true });
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [navigate]);

    const suggestions = [
        { label: 'Trang chủ bản đồ', path: '/', icon: <Home size={14} /> },
        { label: 'Tra cứu giá đất', path: '/giadata', icon: <Search size={14} /> },
        { label: 'Giới thiệu', path: '/gioithieu', icon: <MapPin size={14} /> },
    ];

    return (
        <div className="fixed inset-0 w-screen h-screen bg-slate-950 flex items-center justify-center overflow-hidden">
            {/* Background grid */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.04)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />
            {/* Glow left */}
            <div className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-blue-700/10 rounded-full blur-[140px] pointer-events-none" />
            {/* Glow right */}
            <div className="absolute top-1/2 right-1/4 translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] bg-indigo-700/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="relative z-10 w-full h-full flex flex-col md:flex-row items-center justify-center px-10 md:px-20 gap-12 md:gap-20 animate-in fade-in duration-500">

                {/* LEFT — 404 big number */}
                <div className="flex flex-col items-center md:items-end shrink-0 select-none">
                    <div className="relative">
                        <span className="text-[200px] md:text-[260px] lg:text-[320px] font-black leading-none tracking-tighter text-transparent bg-gradient-to-b from-slate-600 via-slate-800 to-slate-950 bg-clip-text block">
                            404
                        </span>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-24 h-24 bg-blue-600/15 border border-blue-500/30 rounded-3xl flex items-center justify-center backdrop-blur-sm shadow-2xl shadow-blue-900/40">
                                <MapPin className="text-blue-400" size={44} />
                            </div>
                        </div>
                    </div>
                    <p className="text-[11px] font-black text-slate-700 uppercase tracking-[0.4em] -mt-4">
                        QLDDHCM — Page not found
                    </p>
                </div>

                {/* Divider */}
                <div className="hidden md:block w-px h-64 bg-gradient-to-b from-transparent via-slate-700 to-transparent shrink-0" />

                {/* RIGHT — content */}
                <div className="flex flex-col items-center md:items-start text-center md:text-left max-w-xl w-full">
                    <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full mb-5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                        Lỗi 404 — Không tìm thấy trang
                    </div>

                    <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-white uppercase tracking-tighter leading-tight mb-4">
                        Trang không<br />tồn tại
                    </h1>

                    <p className="text-slate-400 text-sm md:text-base leading-relaxed mb-2">
                        Địa chỉ{' '}
                        <code className="bg-slate-800 text-blue-400 px-2 py-0.5 rounded-lg font-mono text-xs border border-slate-700">
                            {location.pathname}
                        </code>{' '}
                        không tồn tại hoặc đã bị xóa.
                    </p>
                    <p className="text-slate-600 text-xs mb-8">
                        Tự động về trang chủ sau{' '}
                        <span className="text-blue-400 font-black tabular-nums text-sm">{countdown}s</span>
                    </p>

                    {/* Progress bar */}
                    <div className="w-full bg-slate-800/60 rounded-full h-1 mb-8 overflow-hidden border border-slate-800">
                        <div
                            className="h-full bg-gradient-to-r from-blue-600 to-indigo-400 rounded-full transition-all duration-1000"
                            style={{ width: `${(countdown / 15) * 100}%` }}
                        />
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-3 mb-10 w-full">
                        <button
                            onClick={() => navigate(-1)}
                            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 border border-slate-700"
                        >
                            <ArrowLeft size={15} /> Quay lại
                        </button>
                        <button
                            onClick={() => navigate('/', { replace: true })}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-900/40"
                        >
                            <Home size={15} /> Về trang chủ
                        </button>
                    </div>

                    {/* Suggestions */}
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.25em] mb-3 w-full">Bạn có thể ghé thăm</p>
                    <div className="flex flex-col gap-2 w-full">
                        {suggestions.map(s => (
                            <button
                                key={s.path}
                                onClick={() => navigate(s.path)}
                                className="flex items-center gap-3 px-5 py-3.5 bg-slate-900/60 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/30 rounded-xl transition-all text-left group"
                            >
                                <span className="text-blue-400 shrink-0">{s.icon}</span>
                                <span className="text-sm text-slate-400 group-hover:text-white transition-colors font-medium">{s.label}</span>
                                <ArrowLeft size={12} className="ml-auto rotate-180 text-slate-700 group-hover:text-blue-400 transition-colors" />
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotFound;
