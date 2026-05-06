
import React, { useState, useRef, useEffect, useContext } from 'react';
import { Branch, User, getRoleLabel } from '../types';
import { authService, API_URL } from '../services/mockBackend';
import { UNSAFE_NavigationContext } from 'react-router-dom';
import { User as UserIcon, Camera, Save, Lock, Mail, Building, Shield, RefreshCw, CheckCircle2, AlertTriangle, Key, Loader2, Eye, EyeOff, Undo2, Copy, Check, Wand2, UploadCloud, XCircle } from 'lucide-react';

interface UserProfileProps {
    user: User;
    onUpdateUser: (updatedUser: User) => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ user, onUpdateUser }) => {
    const CROP_VIEW_SIZE = 280;
    const AVATAR_OUTPUT_SIZE = 400;
    const [name, setName] = useState(user.name);
    const [username, setUsername] = useState(user.username || '');
    const [avatarPreview, setAvatarPreview] = useState<string>('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const [loading, setLoading] = useState(false);
    const [processingImage, setProcessingImage] = useState(false);
    const [passLoading, setPassLoading] = useState(false);
    const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [showOldPassword, setShowOldPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [capsLockState, setCapsLockState] = useState({ old: false, next: false, confirm: false });
    const [branches, setBranches] = useState<Branch[]>([]);
    const [branchLoading, setBranchLoading] = useState(true);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [draftRestored, setDraftRestored] = useState(false);
    const [isDragActive, setIsDragActive] = useState(false);
    const [compactMode, setCompactMode] = useState<boolean>(window.innerHeight < 860);
    const [cropSource, setCropSource] = useState<string | null>(null);
    const [cropFileName, setCropFileName] = useState<string>('avatar.jpg');
    const [cropZoom, setCropZoom] = useState<number>(1);
    const [cropOffset, setCropOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [cropImageSize, setCropImageSize] = useState<{ width: number; height: number } | null>(null);
    const [isCropDragging, setIsCropDragging] = useState(false);
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [pendingTransition, setPendingTransition] = useState<{ retry: () => void } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cropDragOriginRef = useRef<{ x: number; y: number } | null>(null);
    const navigationContext = useContext(UNSAFE_NavigationContext) as { navigator?: { block?: (blocker: (tx: { retry: () => void }) => void) => () => void } };

    const MAX_AVATAR_SIZE_MB = 5;
    const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    const trimmedName = name.trim();
    const trimmedUsername = username.trim().toLowerCase().replace(/\s+/g, '');
    const hasProfileChanges = trimmedName !== user.name.trim() || trimmedUsername !== (user.username || '').trim().toLowerCase() || !!selectedFile;
    const nameError = trimmedName.length === 0
        ? 'Họ và tên không được để trống'
        : trimmedName.length > 80
            ? 'Họ và tên tối đa 80 ký tự'
            : null;
    const usernameError = trimmedUsername && !/^[a-z0-9._-]+$/.test(trimmedUsername)
        ? 'Chỉ dùng chữ thường, số, dấu chấm, gạch dưới'
        : trimmedUsername.length > 30 ? 'Tối đa 30 ký tự' : null;

    const passwordChecks = {
        length: newPassword.length >= 8,
        uppercase: /[A-Z]/.test(newPassword),
        number: /\d/.test(newPassword),
        special: /[^A-Za-z0-9]/.test(newPassword),
        matches: confirmPassword.length > 0 && newPassword === confirmPassword,
        differentFromOld: newPassword.length > 0 && newPassword !== oldPassword
    };
    const passwordScore = [passwordChecks.length, passwordChecks.uppercase, passwordChecks.number, passwordChecks.special].filter(Boolean).length;
    const passwordStrength = passwordScore <= 1 ? 'Yếu' : passwordScore <= 3 ? 'Trung bình' : 'Mạnh';
    const canSubmitPassword = !!oldPassword && !!newPassword && !!confirmPassword && Object.values(passwordChecks).every(Boolean);
    const branch = branches.find(item => item.id === user.branchId);
    const draftStorageKey = `user_profile_draft_${user.id}`;
    const accountStatusItems = [
        { label: 'Email', value: user.email, tone: 'text-cyan-300' },
        { label: 'Xác thực', value: user.is_verified === false ? 'Chưa xác thực' : 'Đã xác thực', tone: user.is_verified === false ? 'text-amber-300' : 'text-emerald-300' },
        { label: 'Trò chuyện', value: user.can_chat === false ? 'Bị hạn chế' : 'Đang bật', tone: user.can_chat === false ? 'text-red-300' : 'text-emerald-300' }
    ];

    const buildAvatarUrl = (avatar?: string) => {
        if (!avatar) return '';
        if (avatar.startsWith('http') || avatar.startsWith('data:')) {
            return avatar;
        }
        const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
        const cleanPath = avatar.startsWith('/') ? avatar : `/${avatar}`;
        return `${baseUrl}${cleanPath}?v=${Date.now()}`;
    };

    useEffect(() => {
        setName(user.name);
        setUsername(user.username || '');
        setAvatarPreview(buildAvatarUrl(user.avatar));
        setSelectedFile(null);
        setDraftRestored(false);
    }, [user.avatar, user.name, user.username]);

    useEffect(() => {
        const savedDraft = sessionStorage.getItem(draftStorageKey);
        if (!savedDraft) return;

        try {
            const parsed = JSON.parse(savedDraft) as { name?: string };
            if (parsed.name && parsed.name !== user.name) {
                setName(parsed.name);
                setDraftRestored(true);
            }
        } catch {
            sessionStorage.removeItem(draftStorageKey);
        }
    }, [draftStorageKey, user.name]);

    useEffect(() => {
        let isMounted = true;
        const loadBranches = async () => {
            setBranchLoading(true);
            try {
                const data = await authService.getBranches();
                if (isMounted) {
                    setBranches(data);
                }
            } finally {
                if (isMounted) {
                    setBranchLoading(false);
                }
            }
        };
        loadBranches();
        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (!hasProfileChanges) return;
            event.preventDefault();
            event.returnValue = '';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasProfileChanges]);

    useEffect(() => {
        if (!profileMessage) return;
        const timer = window.setTimeout(() => setProfileMessage(null), 4500);
        return () => window.clearTimeout(timer);
    }, [profileMessage]);

    useEffect(() => {
        if (!passwordMessage) return;
        const timer = window.setTimeout(() => setPasswordMessage(null), 4500);
        return () => window.clearTimeout(timer);
    }, [passwordMessage]);

    useEffect(() => {
        if (name !== user.name) {
            sessionStorage.setItem(draftStorageKey, JSON.stringify({ name }));
            return;
        }
        sessionStorage.removeItem(draftStorageKey);
    }, [draftStorageKey, name, user.name]);

    useEffect(() => {
        const handleResize = () => setCompactMode(window.innerHeight < 860);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const navigator = navigationContext?.navigator;
        if (!hasProfileChanges || !navigator?.block) return;

        const unblock = navigator.block((tx) => {
            const safeTransition = {
                retry: () => {
                    unblock();
                    tx.retry();
                },
            };
            setPendingTransition(safeTransition);
            setShowLeaveModal(true);
        });

        return unblock;
    }, [hasProfileChanges, navigationContext]);

    useEffect(() => {
        if (!hasProfileChanges) {
            setPendingTransition(null);
            setShowLeaveModal(false);
        }
    }, [hasProfileChanges]);

    const clampCropOffset = (x: number, y: number, width: number, height: number, zoom: number) => {
        const baseScale = Math.max(CROP_VIEW_SIZE / width, CROP_VIEW_SIZE / height);
        const displayWidth = width * baseScale * zoom;
        const displayHeight = height * baseScale * zoom;
        const maxX = Math.max(0, (displayWidth - CROP_VIEW_SIZE) / 2);
        const maxY = Math.max(0, (displayHeight - CROP_VIEW_SIZE) / 2);
        return {
            x: Math.min(maxX, Math.max(-maxX, x)),
            y: Math.min(maxY, Math.max(-maxY, y)),
        };
    };

    const openCropModal = (file: File): Promise<void> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const source = reader.result as string;
                const img = new Image();
                img.src = source;
                img.onload = () => {
                    setCropSource(source);
                    setCropImageSize({ width: img.width, height: img.height });
                    setCropFileName(file.name || 'avatar.jpg');
                    setCropZoom(1);
                    setCropOffset({ x: 0, y: 0 });
                    resolve();
                };
                img.onerror = () => reject(new Error('Lỗi nạp ảnh'));
            };
            reader.onerror = () => reject(new Error('Lỗi đọc file'));
            reader.readAsDataURL(file);
        });
    };

    const applyAvatarCrop = async () => {
        if (!cropSource) return;
        setProcessingImage(true);
        setProfileMessage(null);

        try {
            const image = new Image();
            image.src = cropSource;

            await new Promise<void>((resolve, reject) => {
                image.onload = () => resolve();
                image.onerror = () => reject(new Error('Lỗi nạp ảnh'));
            });

            const safeOffset = clampCropOffset(cropOffset.x, cropOffset.y, image.width, image.height, cropZoom);
            const baseScale = Math.max(CROP_VIEW_SIZE / image.width, CROP_VIEW_SIZE / image.height);
            const scale = baseScale * cropZoom;
            const displayWidth = image.width * scale;
            const displayHeight = image.height * scale;
            const left = (CROP_VIEW_SIZE - displayWidth) / 2 + safeOffset.x;
            const top = (CROP_VIEW_SIZE - displayHeight) / 2 + safeOffset.y;

            const sourceX = Math.max(0, (0 - left) / scale);
            const sourceY = Math.max(0, (0 - top) / scale);
            const sourceWidth = Math.min(image.width - sourceX, CROP_VIEW_SIZE / scale);
            const sourceHeight = Math.min(image.height - sourceY, CROP_VIEW_SIZE / scale);

            const canvas = document.createElement('canvas');
            canvas.width = AVATAR_OUTPUT_SIZE;
            canvas.height = AVATAR_OUTPUT_SIZE;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Không thể xử lý ảnh');

            ctx.drawImage(
                image,
                sourceX,
                sourceY,
                sourceWidth,
                sourceHeight,
                0,
                0,
                AVATAR_OUTPUT_SIZE,
                AVATAR_OUTPUT_SIZE
            );

            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob((result) => {
                    if (result) resolve(result);
                    else reject(new Error('Không thể tạo ảnh đầu ra'));
                }, 'image/jpeg', 0.8);
            });

            const fileName = cropFileName.replace(/\.[^/.]+$/, '') || 'avatar';
            const finalFile = new File([blob], `${fileName}.jpg`, {
                type: 'image/jpeg',
                lastModified: Date.now(),
            });

            setSelectedFile(finalFile);
            setAvatarPreview(canvas.toDataURL('image/jpeg', 0.9));
            setCropSource(null);
            setCropImageSize(null);
            setCropZoom(1);
            setCropOffset({ x: 0, y: 0 });
            setProfileMessage({ type: 'success', text: 'Đã áp dụng ảnh đại diện mới' });
        } catch {
            setProfileMessage({ type: 'error', text: 'Không thể xử lý ảnh này' });
        } finally {
            setProcessingImage(false);
        }
    };

    const closeCropModal = () => {
        setCropSource(null);
        setCropImageSize(null);
        setCropZoom(1);
        setCropOffset({ x: 0, y: 0 });
        cropDragOriginRef.current = null;
        setIsCropDragging(false);
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        await processAvatarFile(file || null);
        e.target.value = '';
    };

    const processAvatarFile = async (file: File | null) => {
        if (file) {
            if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
                setProfileMessage({ type: 'error', text: 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP' });
                return;
            }
            if (file.size > MAX_AVATAR_SIZE_MB * 1024 * 1024) {
                setProfileMessage({ type: 'error', text: `Ảnh tải lên phải nhỏ hơn ${MAX_AVATAR_SIZE_MB}MB` });
                return;
            }
            setProcessingImage(true);
            setProfileMessage(null);
            try {
                await openCropModal(file);
            } catch {
                setProfileMessage({ type: 'error', text: 'Không thể xử lý ảnh này' });
            } finally {
                setProcessingImage(false);
            }
        }
    };

    const handleUpdateProfile = async () => {
        if (nameError) {
            setProfileMessage({ type: 'error', text: nameError });
            return;
        }
        if (usernameError) {
            setProfileMessage({ type: 'error', text: usernameError });
            return;
        }
        if (!hasProfileChanges) {
            setProfileMessage({ type: 'error', text: 'Chưa có thay đổi nào để lưu' });
            return;
        }
        setLoading(true);
        setProfileMessage(null);
        try {
            const result = await authService.updateProfile(user.id, trimmedName, selectedFile, trimmedUsername || undefined);
            const updatedUser = { ...user, name: trimmedName, username: trimmedUsername || undefined, avatar: result.avatar || user.avatar };
            onUpdateUser(updatedUser);
            setSelectedFile(null);
            sessionStorage.removeItem(draftStorageKey);
            setDraftRestored(false);
            setProfileMessage({ type: 'success', text: 'Cập nhật hồ sơ thành công!' });
        } catch (e: any) {
            setProfileMessage({ type: 'error', text: e.message || 'Lỗi cập nhật hồ sơ' });
        } finally {
            setLoading(false);
        }
    };

    const handleRevertAvatarSelection = () => {
        setSelectedFile(null);
        setAvatarPreview(buildAvatarUrl(user.avatar));
        setProfileMessage({ type: 'success', text: 'Đã hoàn tác ảnh đại diện chưa lưu' });
    };

    const handleResetProfileChanges = () => {
        setName(user.name);
        setUsername(user.username || '');
        setSelectedFile(null);
        setAvatarPreview(buildAvatarUrl(user.avatar));
        sessionStorage.removeItem(draftStorageKey);
        setDraftRestored(false);
        setProfileMessage({ type: 'success', text: 'Đã khôi phục lại thông tin hồ sơ ban đầu' });
    };

    const handlePasswordKeyboardState = (field: 'old' | 'next' | 'confirm') => (event: React.KeyboardEvent<HTMLInputElement>) => {
        setCapsLockState(prev => ({ ...prev, [field]: event.getModifierState('CapsLock') }));
    };

    const renderCapsLockHint = (active: boolean) => {
        if (!active) return null;
        return <p className="mt-1.5 text-[11px] font-bold text-amber-400">Caps Lock đang bật</p>;
    };

    const handleCopy = async (value: string, field: string) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopiedField(field);
            window.setTimeout(() => {
                setCopiedField((current) => (current === field ? null : current));
            }, 1800);
        } catch {
            setProfileMessage({ type: 'error', text: 'Không thể sao chép vào bộ nhớ tạm' });
        }
    };

    const generateStrongPassword = () => {
        const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        const lowercase = 'abcdefghijkmnopqrstuvwxyz';
        const numbers = '23456789';
        const specials = '!@#$%^&*_-+=';
        const allChars = `${uppercase}${lowercase}${numbers}${specials}`;
        const seed = [
            uppercase[Math.floor(Math.random() * uppercase.length)],
            lowercase[Math.floor(Math.random() * lowercase.length)],
            numbers[Math.floor(Math.random() * numbers.length)],
            specials[Math.floor(Math.random() * specials.length)]
        ];

        while (seed.length < 12) {
            seed.push(allChars[Math.floor(Math.random() * allChars.length)]);
        }

        const generated = seed
            .sort(() => Math.random() - 0.5)
            .join('');

        setNewPassword(generated);
        setConfirmPassword(generated);
        setShowNewPassword(true);
        setShowConfirmPassword(true);
        setPasswordMessage({ type: 'success', text: 'Đã tạo mật khẩu mạnh tự động. Kiểm tra lại trước khi lưu.' });
    };

    const resetPasswordForm = () => {
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPasswordMessage({ type: 'success', text: 'Đã xóa toàn bộ dữ liệu nhập mật khẩu' });
    };

    const handleChangePassword = async () => {
        if (!oldPassword || !newPassword || !confirmPassword) {
            setPasswordMessage({ type: 'error', text: 'Vui lòng điền đầy đủ thông tin mật khẩu' });
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordMessage({ type: 'error', text: 'Mật khẩu xác nhận không khớp' });
            return;
        }
        if (!canSubmitPassword) {
            setPasswordMessage({ type: 'error', text: 'Mật khẩu mới chưa đạt yêu cầu bảo mật' });
            return;
        }

        setPassLoading(true);
        setPasswordMessage(null);
        try {
            await authService.changePassword(user.id, oldPassword, newPassword);
            setPasswordMessage({ type: 'success', text: 'Đổi mật khẩu thành công!' });
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (e: any) {
            setPasswordMessage({ type: 'error', text: e.message || 'Đổi mật khẩu thất bại' });
        } finally {
            setPassLoading(false);
        }
    };

    const renderMessage = (message: { type: 'success' | 'error', text: string } | null) => {
        if (!message) return null;
        return (
            <div className={`p-4 rounded-xl border flex items-center gap-3 ${message.type === 'success' ? 'bg-green-900/20 border-green-800 text-green-400' : 'bg-red-900/20 border-red-800 text-red-400'}`}>
                {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                <span className="font-bold text-sm">{message.text}</span>
            </div>
        );
    };

    const passwordFieldClassName = 'w-full bg-gray-950 border border-gray-700 rounded-xl p-3 pr-11 text-white focus:border-orange-500 outline-none transition-all';

    const handleCropPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!cropSource) return;
        setIsCropDragging(true);
        cropDragOriginRef.current = { x: event.clientX - cropOffset.x, y: event.clientY - cropOffset.y };
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const handleCropPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!isCropDragging || !cropImageSize || !cropDragOriginRef.current) return;
        const nextOffset = {
            x: event.clientX - cropDragOriginRef.current.x,
            y: event.clientY - cropDragOriginRef.current.y,
        };
        setCropOffset(clampCropOffset(nextOffset.x, nextOffset.y, cropImageSize.width, cropImageSize.height, cropZoom));
    };

    const handleCropPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        setIsCropDragging(false);
        cropDragOriginRef.current = null;
    };

    useEffect(() => {
        if (!cropImageSize) return;
        setCropOffset((prev) => clampCropOffset(prev.x, prev.y, cropImageSize.width, cropImageSize.height, cropZoom));
    }, [cropImageSize, cropZoom]);

    return (
        <div className="h-full w-full overflow-y-auto bg-slate-950 custom-scrollbar animate-in fade-in duration-300">
            <div className={`min-h-full w-full px-3 ${compactMode ? 'py-3 md:px-5 md:py-4 lg:px-6' : 'py-4 md:px-6 md:py-6 lg:px-8'}`}>
                <div className={`mx-auto w-full max-w-5xl ${compactMode ? 'space-y-4 pb-6 md:space-y-5 md:pb-8' : 'space-y-5 pb-8 md:space-y-6 md:pb-10'}`}>
                <div className={`flex items-center gap-4 border-b border-gray-800 ${compactMode ? 'pb-4' : 'pb-6'}`}>
                    <div className="bg-blue-600/20 p-4 rounded-full border border-blue-500/30 shadow-[0_0_15px_rgba(37,99,235,0.3)]">
                        <UserIcon className="text-blue-400 w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-white uppercase tracking-tight">Hồ sơ cá nhân</h1>
                        <p className="text-gray-400 text-sm font-medium">Quản lý thông tin tài khoản hệ thống</p>
                    </div>
                </div>

                <div className={`grid grid-cols-1 md:grid-cols-3 ${compactMode ? 'gap-3' : 'gap-4'}`}>
                    {accountStatusItems.map((item) => (
                        <div key={item.label} className={`bg-gray-900/80 border border-gray-800 rounded-2xl shadow-lg ${compactMode ? 'px-4 py-3' : 'px-5 py-4'}`}>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500 mb-2">{item.label}</p>
                            <p className={`text-sm font-black truncate ${item.tone}`}>{item.value}</p>
                        </div>
                    ))}
                </div>

                <div className={`grid grid-cols-1 md:grid-cols-3 ${compactMode ? 'gap-5' : 'gap-8'}`}>
                    <div className={`md:col-span-2 ${compactMode ? 'space-y-4' : 'space-y-6'}`}>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleUpdateProfile();
                            }}
                            className={`bg-gray-900 rounded-2xl border border-gray-800 shadow-xl relative overflow-hidden ${compactMode ? 'p-4 md:p-5' : 'p-6'}`}
                        >
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <span className="w-1 h-6 bg-blue-500 rounded-full"></span>
                                Thông tin chung
                            </h3>

                            <div className="mb-5 space-y-3">
                                {renderMessage(profileMessage)}
                                {draftRestored && (
                                    <div className="p-3 rounded-xl border border-cyan-800 bg-cyan-950/20 text-cyan-300 text-xs font-bold uppercase tracking-wider">
                                        Đã khôi phục bản nháp tên hiển thị từ phiên làm việc trước
                                    </div>
                                )}
                                <div className="text-[11px] font-bold uppercase tracking-widest text-gray-500 bg-gray-950/70 border border-gray-800 rounded-xl px-4 py-3 flex items-center justify-between">
                                    <span>{hasProfileChanges ? 'Có thay đổi chưa lưu' : 'Thông tin đã đồng bộ'}</span>
                                    <span className={hasProfileChanges ? 'text-amber-400' : 'text-emerald-400'}>{hasProfileChanges ? 'Pending' : 'Synced'}</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button type="button" onClick={() => handleCopy(user.email, 'email-top')} className="inline-flex items-center gap-2 rounded-xl border border-gray-800 bg-gray-950/60 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-300 hover:text-white transition-colors">
                                        {copiedField === 'email-top' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />} Copy email
                                    </button>
                                    <button type="button" onClick={() => handleCopy(user.branchId, 'branch-id')} className="inline-flex items-center gap-2 rounded-xl border border-gray-800 bg-gray-950/60 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-300 hover:text-white transition-colors">
                                        {copiedField === 'branch-id' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />} Copy branch ID
                                    </button>
                                </div>
                            </div>
                            
                            <div className={`flex flex-col sm:flex-row items-start ${compactMode ? 'gap-5' : 'gap-8'}`}>
                                <div
                                    className={`mx-auto sm:mx-0 transition-all ${isDragActive ? 'scale-[1.02]' : ''}`}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        setIsDragActive(true);
                                    }}
                                    onDragLeave={() => setIsDragActive(false)}
                                    onDrop={async (e) => {
                                        e.preventDefault();
                                        setIsDragActive(false);
                                        const file = e.dataTransfer.files?.[0] || null;
                                        await processAvatarFile(file);
                                    }}
                                >
                                    <div className="relative w-32 h-32 mx-auto">
                                        <div className="w-32 h-32 rounded-full border-4 border-gray-800 overflow-hidden bg-gray-800 shadow-2xl relative">
                                            {processingImage && (
                                                <div className="absolute inset-0 z-10 bg-black/60 flex items-center justify-center">
                                                    <Loader2 className="text-white animate-spin" size={32} />
                                                </div>
                                            )}
                                            {avatarPreview ? (
                                                <img src={avatarPreview} alt="Profile" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-gray-700 text-gray-500">
                                                    <UserIcon size={48} />
                                                </div>
                                            )}
                                            {isDragActive && (
                                                <div className="absolute inset-0 z-10 bg-cyan-500/20 border-2 border-dashed border-cyan-400 flex items-center justify-center text-cyan-300 backdrop-blur-sm">
                                                    <UploadCloud size={28} />
                                                </div>
                                            )}
                                        </div>

                                        <button 
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={processingImage}
                                            className="absolute bottom-1 right-1 p-2 bg-blue-600 rounded-full text-white shadow-lg hover:bg-blue-500 transition-all border-2 border-gray-900 active:scale-90 disabled:opacity-50 z-20"
                                        >
                                            <Camera size={16} />
                                        </button>
                                    </div>

                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />

                                    <div className="mt-3 space-y-2 flex flex-col items-center">
                                        <p className="text-center text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500 leading-4 max-w-[9.5rem]">
                                            Kéo thả ảnh hoặc bấm biểu tượng camera
                                        </p>
                                        {selectedFile && (
                                            <button
                                                type="button"
                                                onClick={handleRevertAvatarSelection}
                                                className="inline-flex items-center gap-1 rounded-full bg-slate-950 border border-slate-700 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-white transition-all"
                                            >
                                                <Undo2 size={12} /> Hoàn tác
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex-1 w-full space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase mb-1.5 block tracking-wider">Họ và Tên</label>
                                        <input 
                                            type="text" 
                                            value={name} 
                                            onChange={(e) => setName(e.target.value)} 
                                            className={`w-full bg-gray-950 border rounded-xl p-3 text-white font-medium focus:border-blue-500 outline-none transition-all ${nameError ? 'border-red-700' : 'border-gray-700'}`}
                                            maxLength={80}
                                            autoComplete="name"
                                        />
                                        <div className="mt-1.5 flex items-center justify-between text-[11px]">
                                            <span className={nameError ? 'text-red-400 font-bold' : 'text-gray-500'}>{nameError || 'Tên hiển thị sẽ cập nhật cho toàn hệ thống'}</span>
                                            <span className="text-gray-600">{trimmedName.length}/80</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase mb-1.5 block tracking-wider flex items-center gap-1">
                                            <UserIcon size={12}/> Tên đăng nhập
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-mono text-sm select-none">@</span>
                                            <input
                                                type="text"
                                                value={username}
                                                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                                                className={`w-full bg-gray-950 border rounded-xl pl-7 pr-3 py-3 text-white font-mono text-sm focus:border-blue-500 outline-none transition-all ${usernameError ? 'border-red-700' : 'border-gray-700'}`}
                                                maxLength={30}
                                                autoComplete="username"
                                                placeholder="vd: nguyen.van.a"
                                            />
                                        </div>
                                        <div className="mt-1.5 flex items-center justify-between text-[11px]">
                                            <span className={usernameError ? 'text-red-400 font-bold' : 'text-gray-500'}>{usernameError || 'Dùng để đăng nhập thay thế email'}</span>
                                            <span className="text-gray-600">{trimmedUsername.length}/30</span>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase mb-1.5 block tracking-wider flex items-center gap-1"><Mail size={12}/> Email</label>
                                        <div className="w-full bg-gray-800/50 border border-gray-800 rounded-xl p-3 text-gray-400 font-mono text-sm truncate flex items-center justify-between gap-3">
                                            <span className="truncate">{user.email}</span>
                                            <button type="button" onClick={() => handleCopy(user.email, 'email')} className="shrink-0 text-gray-500 hover:text-white transition-colors">
                                                {copiedField === 'email' ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase mb-1.5 block tracking-wider flex items-center gap-1"><Building size={12}/> Chi nhánh</label>
                                            <div className="w-full bg-gray-800/50 border border-gray-800 rounded-xl p-3 text-sm space-y-1">
                                                <div className="text-white font-bold truncate flex items-center justify-between gap-3">
                                                    <span className="truncate">{branchLoading ? 'Đang tải chi nhánh...' : (branch?.name || 'Chưa xác định chi nhánh')}</span>
                                                    <button type="button" onClick={() => handleCopy(branch?.name || user.branchId, 'branch')} className="shrink-0 text-gray-500 hover:text-white transition-colors">
                                                        {copiedField === 'branch' ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                                                    </button>
                                                </div>
                                                <div className="text-gray-500 font-mono text-xs uppercase tracking-wider">
                                                    {branch?.code ? `${branch.code} • ` : ''}{user.branchId}
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase mb-1.5 block tracking-wider flex items-center gap-1"><Shield size={12}/> Vai trò</label>
                                            <div className="w-full bg-gray-800/50 border border-gray-800 rounded-xl p-3 flex items-center">
                                                <div className="inline-flex items-center px-3 py-0.5 rounded-lg bg-blue-900/20 border border-blue-800 text-blue-400 text-xs font-black uppercase tracking-widest">
                                                    {getRoleLabel(user.role)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className={`${compactMode ? 'mt-6' : 'mt-8'} flex justify-end gap-3`}>
                                <button
                                    type="button"
                                    onClick={handleResetProfileChanges}
                                    disabled={!hasProfileChanges || loading || processingImage}
                                    className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-6 py-2.5 rounded-xl font-bold text-sm border border-gray-700 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Undo2 size={18} /> Hoàn nguyên
                                </button>
                                <button 
                                    type="submit"
                                    disabled={loading || processingImage || !!nameError || !hasProfileChanges}
                                    className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-900/20 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? <RefreshCw className="animate-spin" size={18}/> : <Save size={18}/>}
                                    Lưu thay đổi
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="md:col-span-1">
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleChangePassword();
                            }}
                            className={`bg-gray-900 rounded-2xl border border-gray-800 shadow-xl h-full flex flex-col ${compactMode ? 'p-4 md:p-5' : 'p-6'}`}
                        >
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <Lock size={18} className="text-orange-500"/>
                                Đổi mật khẩu
                            </h3>

                            <div className="mb-5">{renderMessage(passwordMessage)}</div>
                            
                            <div className="space-y-4 flex-1">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1.5 block tracking-wider">Mật khẩu hiện tại</label>
                                    <div className="relative">
                                        <input 
                                            type={showOldPassword ? 'text' : 'password'} 
                                            value={oldPassword} 
                                            onChange={(e) => setOldPassword(e.target.value)} 
                                            onKeyUp={handlePasswordKeyboardState('old')}
                                            onKeyDown={handlePasswordKeyboardState('old')}
                                            className={passwordFieldClassName}
                                            placeholder="••••••"
                                            autoComplete="current-password"
                                        />
                                        <button type="button" onClick={() => setShowOldPassword(prev => !prev)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                                            {showOldPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                    {renderCapsLockHint(capsLockState.old)}
                                </div>
                                <hr className="border-gray-800 my-2" />
                                <div>
                                    <div className="flex items-center justify-between gap-3 mb-1.5">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Mật khẩu mới</label>
                                        <div className="flex items-center gap-3">
                                            <button type="button" onClick={generateStrongPassword} className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-cyan-300 hover:text-white transition-colors">
                                                <Wand2 size={12} /> Tạo mạnh
                                            </button>
                                            <button type="button" onClick={() => handleCopy(newPassword, 'generated-password')} disabled={!newPassword} className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white disabled:opacity-40 transition-colors">
                                                {copiedField === 'generated-password' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />} Copy
                                            </button>
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <input 
                                            type={showNewPassword ? 'text' : 'password'} 
                                            value={newPassword} 
                                            onChange={(e) => setNewPassword(e.target.value)} 
                                            onKeyUp={handlePasswordKeyboardState('next')}
                                            onKeyDown={handlePasswordKeyboardState('next')}
                                            className={passwordFieldClassName}
                                            placeholder="••••••"
                                            autoComplete="new-password"
                                        />
                                        <button type="button" onClick={() => setShowNewPassword(prev => !prev)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                                            {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                    {renderCapsLockHint(capsLockState.next)}
                                    <div className="mt-3 space-y-2">
                                        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
                                            <span className="text-gray-500">Độ mạnh mật khẩu</span>
                                            <span className={passwordStrength === 'Mạnh' ? 'text-emerald-400' : passwordStrength === 'Trung bình' ? 'text-amber-400' : 'text-red-400'}>{passwordStrength}</span>
                                        </div>
                                        <div className="grid grid-cols-4 gap-1.5">
                                            {[0, 1, 2, 3].map(index => (
                                                <div key={index} className={`h-1.5 rounded-full ${passwordScore > index ? (passwordScore >= 4 ? 'bg-emerald-500' : passwordScore >= 2 ? 'bg-amber-500' : 'bg-red-500') : 'bg-gray-800'}`}></div>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-1 gap-1 text-[11px]">
                                            <span className={passwordChecks.length ? 'text-emerald-400' : 'text-gray-500'}>• Tối thiểu 8 ký tự</span>
                                            <span className={passwordChecks.uppercase ? 'text-emerald-400' : 'text-gray-500'}>• Có ít nhất 1 chữ in hoa</span>
                                            <span className={passwordChecks.number ? 'text-emerald-400' : 'text-gray-500'}>• Có ít nhất 1 chữ số</span>
                                            <span className={passwordChecks.special ? 'text-emerald-400' : 'text-gray-500'}>• Có ít nhất 1 ký tự đặc biệt</span>
                                            <span className={passwordChecks.differentFromOld ? 'text-emerald-400' : 'text-gray-500'}>• Khác mật khẩu hiện tại</span>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1.5 block tracking-wider">Xác nhận mật khẩu mới</label>
                                    <div className="relative">
                                        <input 
                                            type={showConfirmPassword ? 'text' : 'password'} 
                                            value={confirmPassword} 
                                            onChange={(e) => setConfirmPassword(e.target.value)} 
                                            onKeyUp={handlePasswordKeyboardState('confirm')}
                                            onKeyDown={handlePasswordKeyboardState('confirm')}
                                            className={passwordFieldClassName}
                                            placeholder="••••••"
                                            autoComplete="new-password"
                                        />
                                        <button type="button" onClick={() => setShowConfirmPassword(prev => !prev)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                                            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                    {renderCapsLockHint(capsLockState.confirm)}
                                    <p className={`mt-1.5 text-[11px] font-bold ${confirmPassword.length === 0 ? 'text-gray-500' : passwordChecks.matches ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {confirmPassword.length === 0 ? 'Nhập lại mật khẩu mới để xác nhận' : passwordChecks.matches ? 'Mật khẩu xác nhận khớp' : 'Mật khẩu xác nhận chưa khớp'}
                                    </p>
                                </div>
                            </div>

                            <div className={`${compactMode ? 'mt-6' : 'mt-8'} space-y-3`}>
                                <button
                                    type="button"
                                    onClick={resetPasswordForm}
                                    disabled={passLoading || (!oldPassword && !newPassword && !confirmPassword)}
                                    className="w-full bg-gray-800 hover:bg-gray-700 text-gray-200 px-6 py-2.5 rounded-xl font-bold text-sm border border-gray-700 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <XCircle size={18} /> Xóa dữ liệu nhập
                                </button>
                                <button 
                                    type="submit"
                                    disabled={passLoading || !canSubmitPassword}
                                    className="w-full bg-orange-600 hover:bg-orange-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-orange-900/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {passLoading ? <RefreshCw className="animate-spin" size={18}/> : <Key size={18}/>}
                                    Cập nhật mật khẩu
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
                </div>
            </div>

            {cropSource && (
                <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-xl bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-5 md:p-6 space-y-5">
                        <div className="flex items-center justify-between gap-3">
                            <h3 className="text-lg font-bold text-white">Cắt ảnh đại diện</h3>
                            <button type="button" onClick={closeCropModal} className="text-gray-500 hover:text-white transition-colors">
                                <XCircle size={20} />
                            </button>
                        </div>

                        <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">
                            Kéo ảnh để thay đổi vị trí, dùng thanh zoom để phóng to/thu nhỏ trước khi áp dụng.
                        </p>

                        <div
                            className="mx-auto rounded-2xl overflow-hidden border border-gray-700 bg-gray-950 relative touch-none"
                            style={{ width: CROP_VIEW_SIZE, height: CROP_VIEW_SIZE }}
                            onPointerDown={handleCropPointerDown}
                            onPointerMove={handleCropPointerMove}
                            onPointerUp={handleCropPointerUp}
                            onPointerLeave={handleCropPointerUp}
                        >
                            <img
                                src={cropSource}
                                alt="Avatar crop"
                                draggable={false}
                                className="absolute left-1/2 top-1/2 max-w-none select-none"
                                style={{
                                    transform: `translate(calc(-50% + ${cropOffset.x}px), calc(-50% + ${cropOffset.y}px)) scale(${cropZoom})`,
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    cursor: isCropDragging ? 'grabbing' : 'grab',
                                }}
                            />
                            <div className="absolute inset-0 border-2 border-cyan-400/70 pointer-events-none"></div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-[11px] uppercase tracking-wider font-bold text-gray-400">
                                <span>Zoom ảnh</span>
                                <span className="text-cyan-300">{cropZoom.toFixed(2)}x</span>
                            </div>
                            <input
                                type="range"
                                min={1}
                                max={3}
                                step={0.05}
                                value={cropZoom}
                                onChange={(e) => setCropZoom(Number(e.target.value))}
                                className="w-full accent-cyan-500"
                            />
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
                            <button
                                type="button"
                                onClick={closeCropModal}
                                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-gray-700 bg-gray-800 text-gray-200 font-bold text-sm hover:bg-gray-700 transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={applyAvatarCrop}
                                disabled={processingImage}
                                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-cyan-600 text-white font-bold text-sm hover:bg-cyan-500 transition-colors disabled:opacity-50"
                            >
                                {processingImage ? 'Đang xử lý...' : 'Áp dụng ảnh'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showLeaveModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6 space-y-4">
                        <h3 className="text-lg font-bold text-white">Bạn có thay đổi chưa lưu</h3>
                        <p className="text-sm text-gray-300 leading-relaxed">
                            Nếu rời trang ngay bây giờ, các thay đổi trong hồ sơ sẽ bị mất. Bạn muốn tiếp tục điều hướng hay ở lại để lưu dữ liệu?
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
                            <button
                                type="button"
                                onClick={() => {
                                    setPendingTransition(null);
                                    setShowLeaveModal(false);
                                }}
                                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-gray-700 bg-gray-800 text-gray-200 font-bold text-sm hover:bg-gray-700 transition-colors"
                            >
                                Ở lại
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    pendingTransition?.retry();
                                    setPendingTransition(null);
                                    setShowLeaveModal(false);
                                }}
                                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-500 transition-colors"
                            >
                                Rời trang
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserProfile;
