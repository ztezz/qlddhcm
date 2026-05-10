
import React, { useState, useEffect } from 'react';
import { authService, API_URL } from '../services/mockBackend';
import { User, Branch } from '../types';
import { Lock, Mail, Loader2, KeyRound, ArrowLeft, UserPlus, Building, User as UserIcon, CheckCircle, ShieldCheck, Info, CheckCircle2, AlertTriangle, Hash, Eye, EyeOff, Sun, Moon, Zap, Shield, Check, RefreshCw } from 'lucide-react';
import { VideoBackground } from '../components/VideoBackground';

interface LoginProps {
  onLogin: (user: User) => void;
  onCancel: () => void;
  systemName?: string;
  logoUrl?: string;
  footerText?: string;
  allowRegistration?: boolean;
  initialToken?: string | null;
  verificationToken?: string | null;
}

const Login: React.FC<LoginProps> = ({ onLogin, onCancel, systemName, logoUrl, footerText, allowRegistration = true, initialToken, verificationToken }) => {
  // View states: LOGIN | FORGOT | VERIFY_REG_OTP | VERIFY_RESET_OTP | REGISTER
  const [view, setView] = useState<'LOGIN' | 'FORGOT' | 'VERIFY_REG_OTP' | 'VERIFY_RESET_OTP' | 'REGISTER'>('LOGIN');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  
  // Dialog State
  const [dialog, setDialog] = useState<{
      isOpen: boolean;
      type: 'success' | 'error' | 'info';
      title: string;
      message: string;
      onClose?: () => void;
  }>({ isOpen: false, type: 'info', title: '', message: '' });

  const showDialog = (type: 'success' | 'error' | 'info', title: string, message: string, onClose?: () => void) => {
      setDialog({ isOpen: true, type, title, message, onClose });
  };

  // Login State
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [captchaQuestion, setCaptchaQuestion] = useState('');
  const [captchaImageUrl, setCaptchaImageUrl] = useState('');
  const [captchaCodeLength, setCaptchaCodeLength] = useState(5);
  const [captchaChallengeId, setCaptchaChallengeId] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');

  // OTP State
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Register State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regBranch, setRegBranch] = useState('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  const loadCaptchaChallenge = async (useRefresh = false) => {
    try {
      const data = useRefresh
        ? await authService.refreshCaptcha()
        : await authService.getCaptchaChallenge();
      setCaptchaQuestion(data.question);
      setCaptchaImageUrl(data.imageDataUrl || '');
      setCaptchaCodeLength(Number(data.codeLength) > 0 ? Number(data.codeLength) : 5);
      setCaptchaChallengeId(data.challengeId);
      if (useRefresh) {
        setError('');
      }
    } catch (err: any) {
      setCaptchaQuestion('Không tải được CAPTCHA. Vui lòng thử lại.');
      setCaptchaImageUrl('');
      setCaptchaChallengeId('');
      if (useRefresh) {
        setError(err?.message || 'Bạn đang làm mới CAPTCHA quá nhanh. Vui lòng thử lại sau.');
      }
    }
  };

  useEffect(() => {
    if (view === 'REGISTER') {
        const loadBranches = async () => {
            const data = await authService.getBranches();
            setBranches(data);
            if (data.length > 0) setRegBranch(data[0].id);
        };
        loadBranches();
    }
    // Load remembered login
    if (view === 'LOGIN') {
        const remembered = localStorage.getItem('rememberedLogin');
        if (remembered) {
            setEmailOrUsername(remembered);
            setRememberMe(true);
        }
      setCaptchaInput('');
      loadCaptchaChallenge();
    }
  }, [view]);

  // Password strength checker
  const getPasswordStrength = (pwd: string): { score: number; text: string; color: string } => {
    let score = 0;
    let text = 'Yếu';
    let color = 'text-red-500';
    
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) score++;
    
    if (score <= 1) { text = 'Yếu'; color = 'text-red-500'; }
    else if (score <= 2) { text = 'Trung bình'; color = 'text-orange-500'; }
    else if (score <= 3) { text = 'Khá'; color = 'text-yellow-500'; }
    else if (score <= 4) { text = 'Mạnh'; color = 'text-green-500'; }
    else { text = 'Rất mạnh'; color = 'text-emerald-500'; }
    
    return { score, text, color };
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!captchaChallengeId || !captchaInput.trim()) {
      setError('Vui lòng nhập CAPTCHA hợp lệ trước khi đăng nhập.');
      setCaptchaInput('');
      return;
    }

    setLoading(true);
    try {
      // Verify CAPTCHA first, then use short-lived verification token for login
      const verifyResult = await authService.verifyCaptcha(captchaChallengeId, captchaInput.trim());
      const user = await authService.login(emailOrUsername, password, verifyResult.captchaVerificationToken);
      if (rememberMe) {
        localStorage.setItem('rememberedLogin', emailOrUsername);
      } else {
        localStorage.removeItem('rememberedLogin');
      }
      onLogin(user);
    } catch (err: any) {
      setError(err.message || 'Email/Tên tài khoản hoặc mật khẩu không đúng');
      showDialog('error', 'Đăng nhập thất bại', err.message || 'Email/Tên tài khoản hoặc mật khẩu không đúng');
      loadCaptchaChallenge();
      setCaptchaInput('');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError('');
      try {
          if (!regBranch) throw new Error('Vui lòng chọn chi nhánh');
          if (regPassword.length < 8) throw new Error('Mật khẩu phải từ 8 ký tự');
          if (regPassword !== regConfirmPassword) throw new Error('Mật khẩu xác nhận không khớp');
          if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(regPassword)) {
              throw new Error('Mật khẩu phải chứa chữ hoa, chữ thường và số');
          }
            await authService.register(regName, regEmail, regBranch, regPassword);
          setOtpCode(''); // Reset OTP input
          setView('VERIFY_REG_OTP'); // Chuyển sang màn hình nhập OTP
      } catch (err: any) {
          setError(err.message || 'Đăng ký thất bại');
          showDialog('error', 'Lỗi đăng ký', err.message);
      } finally {
          setLoading(false);
      }
  };

  const handleVerifyRegistration = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
          // Gọi API verify với email và code
          // Lưu ý: Cần update service frontend để gửi thêm email
          // Ở đây giả lập gọi hàm verifyEmail với object body tùy chỉnh hoặc cập nhật authService
          const res = await fetch(`${API_URL}/api/auth/verify-email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: regEmail, code: otpCode })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Xác thực thất bại");

          showDialog('success', 'Kích hoạt thành công', 'Tài khoản của bạn đã sẵn sàng. Vui lòng đăng nhập.', () => {
              setView('LOGIN');
              setEmailOrUsername(regEmail);
          });
      } catch (e: any) {
          showDialog('error', 'Lỗi xác thực', e.message);
      } finally {
          setLoading(false);
      }
  };

  const handleSendResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await authService.forgotPassword(emailOrUsername);
      setOtpCode('');
      setView('VERIFY_RESET_OTP');
    } catch (err: any) {
        setError(err.message || 'Gửi mã khôi phục thất bại');
        showDialog('error', 'Lỗi gửi mã', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
        setError("Mật khẩu xác nhận không khớp.");
        return;
    }
    if (newPassword.length < 8) {
        setError("Mật khẩu phải từ 8 ký tự.");
        return;
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
        setError("Mật khẩu phải chứa chữ hoa, chữ thường và số.");
        return;
    }

    setLoading(true);
    try {
      // Cần gọi API reset với email, code, newPassword
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: emailOrUsername, code: otpCode, newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Đặt lại mật khẩu thất bại");

      showDialog('success', 'Đổi mật khẩu thành công', 'Mật khẩu của bạn đã được cập nhật. Vui lòng đăng nhập lại.', () => {
          setView('LOGIN');
      });
    } catch(err: any) {
        setError(err.message || 'Xác thực thất bại');
        showDialog('error', 'Lỗi đổi mật khẩu', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto">

      {/* Video Background - Full Screen */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <VideoBackground />
      </div>

      <div className="bg-gray-900/80 border border-gray-700 rounded-xl sm:rounded-2xl shadow-2xl p-4 sm:p-8 w-full max-w-md max-h-[calc(100vh-1rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto relative animate-in zoom-in-95 duration-300 z-10 backdrop-blur-sm">
        
        <button 
            onClick={onCancel}
            className={`absolute top-3 left-3 sm:top-4 sm:left-4 ${
              theme === 'dark' ? 'text-gray-500 hover:text-white' : 'text-gray-600 hover:text-black'
            } transition-colors flex items-center gap-1 text-sm font-bold`}
        >
            <ArrowLeft size={16} /> Đóng
        </button>

        <div className="text-center mb-5 sm:mb-8">
          {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="mx-auto h-20 sm:h-24 mb-3 sm:mb-4 object-contain drop-shadow-lg" />
          ) : null}
          <div className="flex items-center justify-center gap-2 mb-2">
            <Zap className={theme === 'dark' ? 'text-blue-400' : 'text-blue-600'} size={28} />
            <h2 className={`text-2xl sm:text-3xl font-black ${
              theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
            }`}>{systemName || 'GeoMaster'}</h2>
          </div>
          <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            Hệ thống Quản lý Đất đai Chuyên nghiệp
          </p>
        </div>

        {error && (
          <div className={`${
            theme === 'dark'
              ? 'bg-red-500/10 border border-red-500 text-red-400'
              : 'bg-red-50 border border-red-300 text-red-700'
          } p-3 rounded-lg mb-4 text-sm text-center animate-in shake duration-300`}>
            <div className="flex items-center justify-center gap-2">
              <AlertTriangle size={16} />
              {error}
            </div>
          </div>
        )}

        {/* --- VIEW: LOGIN --- */}
        {view === 'LOGIN' && (
          <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5 animate-in fade-in duration-300">
            <div>
              <label className={`block text-sm mb-2 uppercase font-black tracking-widest text-[11px] ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-700'
              }`}>Email hoặc Tên Tài Khoản</label>
              <div className="relative group">
                <UserIcon className={`absolute left-4 top-3.5 ${
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                } group-focus-within:text-blue-500 transition-colors`} size={18} />
                <input
                  type="text"
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  className={`w-full rounded-lg p-3 pl-12 text-sm font-medium transition-all duration-200 ${
                    theme === 'dark'
                      ? 'bg-gray-800 border border-gray-600 text-white focus:outline-none focus:border-blue-500 focus:shadow-lg focus:shadow-blue-500/20'
                      : 'bg-gray-50 border border-gray-300 text-black focus:outline-none focus:border-blue-500 focus:shadow-lg focus:shadow-blue-500/10'
                  }`}
                  required
                  placeholder="Email hoặc tên tài khoản..."
                />
              </div>
            </div>

            <div>
              <label className={`block text-sm mb-2 uppercase font-black tracking-widest text-[11px] ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-700'
              }`}>Mật Khẩu</label>
              <div className="relative group">
                <Lock className={`absolute left-4 top-3.5 ${
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                } group-focus-within:text-blue-500 transition-colors`} size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full rounded-lg p-3 pl-12 pr-12 text-sm font-medium transition-all duration-200 ${
                    theme === 'dark'
                      ? 'bg-gray-800 border border-gray-600 text-white focus:outline-none focus:border-blue-500 focus:shadow-lg focus:shadow-blue-500/20'
                      : 'bg-gray-50 border border-gray-300 text-black focus:outline-none focus:border-blue-500 focus:shadow-lg focus:shadow-blue-500/10'
                  }`}
                  required
                  placeholder="Nhập mật khẩu..."
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute right-4 top-3.5 ${
                    theme === 'dark' ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-black'
                  } transition-colors`}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 sm:pt-2">
              <label className={`flex items-center gap-2 cursor-pointer text-sm font-medium ${
                theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-700 hover:text-black'
              } transition-colors`}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                />
                Nhớ tài khoản này
              </label>
              <button type="button" onClick={() => setView('FORGOT')} className={`text-xs font-bold uppercase transition-colors ${
                theme === 'dark'
                  ? 'text-gray-400 hover:text-white'
                  : 'text-blue-600 hover:text-blue-700'
              }`}>
                Quên mật khẩu?
              </button>
            </div>


            <div>
              <label className={`block text-sm mb-2 uppercase font-black tracking-widest text-[11px] ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-700'
              }`}>CAPTCHA Bảo Mật</label>
              <div className="grid grid-cols-[1fr_auto] gap-2 mb-2">
                <div className={`rounded-lg px-2 py-2 text-center ${
                  theme === 'dark'
                    ? 'bg-gray-800 border border-gray-600'
                    : 'bg-blue-50 border border-blue-200'
                }`}>
                  {captchaImageUrl ? (
                    <img
                      src={captchaImageUrl}
                      alt="CAPTCHA"
                      className="mx-auto h-14 w-full max-w-[200px] object-contain"
                    />
                  ) : (
                    <div className={`font-mono font-black tracking-[0.15em] ${theme === 'dark' ? 'text-cyan-300' : 'text-blue-700'}`}>
                      {captchaQuestion}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    loadCaptchaChallenge(true);
                    setCaptchaInput('');
                  }}
                  className={`rounded-lg px-3 transition-colors ${
                    theme === 'dark'
                      ? 'bg-gray-800 border border-gray-600 text-gray-300 hover:text-white hover:border-blue-500'
                      : 'bg-white border border-gray-300 text-gray-600 hover:text-black hover:border-blue-400'
                  }`}
                  aria-label="Làm mới CAPTCHA"
                >
                  <RefreshCw size={16} />
                </button>
              </div>
              <input
                type="text"
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, captchaCodeLength))}
                className={`w-full rounded-lg p-3 text-sm font-medium transition-all duration-200 ${
                  theme === 'dark'
                    ? 'bg-gray-800 border border-gray-600 text-white focus:outline-none focus:border-cyan-500 focus:shadow-lg focus:shadow-cyan-500/20'
                    : 'bg-gray-50 border border-gray-300 text-black focus:outline-none focus:border-cyan-500 focus:shadow-lg focus:shadow-cyan-500/10'
                }`}
                required
                placeholder="Nhập mã trong hình"
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className={`w-full font-black py-3 rounded-lg transition-all flex justify-center items-center gap-2 shadow-lg uppercase tracking-widest text-xs active:scale-95 ${
                theme === 'dark'
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30 disabled:opacity-50'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 disabled:opacity-50'
              }`}
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <>
                <Shield size={18} />
                Đăng Nhập
              </>}
            </button>

            {allowRegistration && (
                <div className={`text-center pt-2 border-t mt-1 sm:mt-2 ${
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                }`}>
                    <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'} mb-2`}>Chưa có tài khoản?</p>
                    <button type="button" onClick={() => setView('REGISTER')} className={`text-xs font-black uppercase transition-colors ${
                      theme === 'dark'
                        ? 'text-blue-400 hover:text-blue-300'
                        : 'text-blue-600 hover:text-blue-700'
                    }`}>
                        Đăng Ký Ngay
                    </button>
                </div>
            )}
          </form>
        )}

        {/* --- VIEW: VERIFY REGISTRATION OTP --- */}
        {view === 'VERIFY_REG_OTP' && (
            <form onSubmit={handleVerifyRegistration} className="space-y-6 animate-in fade-in duration-300">
                <div className="text-center">
                    <div className={`w-16 h-16 ${
                      theme === 'dark'
                        ? 'bg-blue-500/20 text-blue-500 border border-blue-500/30'
                        : 'bg-blue-100 text-blue-600 border border-blue-300'
                    } rounded-full flex items-center justify-center mx-auto mb-4`}>
                        <Mail size={32} />
                    </div>
                    <h3 className={`text-xl font-black uppercase ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>Xác Thực Tài Khoản</h3>
                    <p className={`text-xs mt-2 px-4 ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                        Chúng tôi đã gửi mã xác thực 6 số đến <b>{regEmail}</b>. Vui lòng nhập mã để kích hoạt.
                    </p>
                </div>

                <div>
                    <label className={`block text-[11px] uppercase font-black mb-2 text-center tracking-widest ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-700'
                    }`}>Nhập Mã Xác Thực</label>
                    <div className="relative">
                        <Hash className={`absolute left-4 top-3.5 ${
                          theme === 'dark' ? 'text-blue-500' : 'text-blue-600'
                        }`} size={20} />
                        <input 
                            type="text" 
                            value={otpCode} 
                            onChange={e => setOtpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} 
                            className={`w-full rounded-lg p-3 pl-12 text-center font-mono text-xl tracking-[0.5em] font-black transition-all ${
                              theme === 'dark'
                                ? 'bg-gray-800 border border-gray-600 text-white focus:border-blue-500 focus:shadow-lg focus:shadow-blue-500/20'
                                : 'bg-gray-50 border border-gray-300 text-black focus:border-blue-500 focus:shadow-lg focus:shadow-blue-500/10'
                            }`}
                            required 
                            placeholder="000000"
                            autoFocus
                        />
                    </div>
                </div>

                <button 
                  type="submit" 
                  disabled={loading || otpCode.length < 6}
                  className={`w-full font-black py-3 rounded-lg transition-all flex justify-center items-center gap-2 uppercase text-xs shadow-lg disabled:opacity-50 ${
                    theme === 'dark'
                      ? 'bg-green-600 hover:bg-green-500 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <>
                      <CheckCircle2 size={18} />
                      Kích Hoạt Tài Khoản
                    </>}
                </button>
                
                <button 
                  type="button" 
                  onClick={() => setView('REGISTER')}
                  className={`w-full text-xs uppercase font-bold mt-2 transition-colors ${
                    theme === 'dark'
                      ? 'text-gray-500 hover:text-gray-300'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  ← Quay Lại Đăng Ký
                </button>
            </form>
        )}

        {/* --- VIEW: VERIFY RESET OTP & NEW PASSWORD --- */}
        {view === 'VERIFY_RESET_OTP' && (
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4 animate-in fade-in duration-300">
                <div className="text-center mb-4">
                    <ShieldCheck size={48} className={`mx-auto mb-2 ${
                      theme === 'dark' ? 'text-orange-500' : 'text-orange-600'
                    }`}/>
                    <h3 className={`text-xl font-black uppercase ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>Đặt Lại Mật Khẩu</h3>
                    <p className={`text-xs mt-1 ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}>Nhập mã OTP từ email và mật khẩu mới của bạn.</p>
                </div>
                
                <div>
                    <label className={`block text-[11px] uppercase font-black mb-2 tracking-widest ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-700'
                    }`}>Mã Xác Thực (OTP)</label>
                    <div className="relative">
                        <Hash className={`absolute left-4 top-3 ${
                          theme === 'dark' ? 'text-orange-500' : 'text-orange-600'
                        }`} size={18} />
                        <input 
                            type="text" 
                            value={otpCode} 
                            onChange={e => setOtpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} 
                            className={`w-full rounded-lg p-2.5 pl-12 text-center font-mono text-lg tracking-widest font-bold transition-all ${
                              theme === 'dark'
                                ? 'bg-gray-800 border border-gray-600 text-white focus:border-orange-500'
                                : 'bg-gray-50 border border-gray-300 text-black focus:border-orange-500'
                            }`}
                            required 
                            placeholder="000000"
                        />
                    </div>
                </div>

                <div>
                    <label className={`block text-[11px] uppercase font-black mb-2 tracking-widest ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-700'
                    }`}>Mật Khẩu Mới</label>
                    <div className="relative group">
                        <Lock className={`absolute left-4 top-3 ${
                          theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                        } group-focus-within:text-orange-500 transition-colors`} size={18} />
                        <input 
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword} 
                          onChange={e => setNewPassword(e.target.value)} 
                          className={`w-full rounded-lg p-2.5 pl-12 pr-10 text-sm font-medium transition-all ${
                            theme === 'dark'
                              ? 'bg-gray-800 border border-gray-600 text-white focus:border-orange-500'
                              : 'bg-gray-50 border border-gray-300 text-black focus:border-orange-500'
                          }`}
                          required 
                          minLength={8}
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className={`absolute right-3 top-2.5 ${
                            theme === 'dark' ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-black'
                          }`}
                        >
                          {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>

                <div>
                    <label className={`block text-[11px] uppercase font-black mb-2 tracking-widest ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-700'
                    }`}>Xác Nhận Mật Khẩu</label>
                    <div className="relative group">
                        <Lock className={`absolute left-4 top-3 ${
                          theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                        } group-focus-within:text-orange-500 transition-colors`} size={18} />
                        <input 
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword} 
                          onChange={e => setConfirmPassword(e.target.value)} 
                          className={`w-full rounded-lg p-2.5 pl-12 pr-10 text-sm font-medium transition-all ${
                            theme === 'dark'
                              ? 'bg-gray-800 border border-gray-600 text-white focus:border-orange-500'
                              : 'bg-gray-50 border border-gray-300 text-black focus:border-orange-500'
                          }`}
                          required 
                          minLength={8}
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className={`absolute right-3 top-2.5 ${
                            theme === 'dark' ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-black'
                          }`}
                        >
                          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className={`w-full font-black py-3 rounded-lg transition-all flex justify-center items-center gap-2 uppercase text-xs shadow-lg ${
                    theme === 'dark'
                      ? 'bg-orange-600 hover:bg-orange-500 text-white'
                      : 'bg-orange-600 hover:bg-orange-700 text-white'
                  }`}
                >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <>
                      <ShieldCheck size={18} />
                      Xác Nhận Đổi Mật Khẩu
                    </>}
                </button>

                <button 
                  type="button" 
                  onClick={() => setView('FORGOT')}
                  className={`w-full text-xs uppercase font-bold transition-colors ${
                    theme === 'dark'
                      ? 'text-gray-500 hover:text-gray-300'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  ↻ Gửi Lại Mã
                </button>
            </form>
        )}

        {/* --- VIEW: FORGOT PASSWORD (EMAIL INPUT) --- */}
        {view === 'FORGOT' && (
            <form onSubmit={handleSendResetCode} className="space-y-6 animate-in fade-in duration-300">
                <div className="text-center mb-4">
                    <KeyRound size={48} className={`mx-auto mb-2 ${
                      theme === 'dark' ? 'text-orange-400' : 'text-orange-600'
                    }`} />
                    <h3 className={`text-xl font-black uppercase ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>Quên Mật Khẩu?</h3>
                </div>
                <p className={`text-sm text-center ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>Nhập email hoặc tên tài khoản đã đăng ký. Chúng tôi sẽ gửi <b>Mã xác thực</b> để bạn đặt lại mật khẩu.</p>
                
                <div className="relative group">
                    <UserIcon className={`absolute left-4 top-3.5 ${
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                    } group-focus-within:text-orange-500 transition-colors`} size={18} />
                    <input
                      type="text"
                      value={emailOrUsername}
                      onChange={(e) => setEmailOrUsername(e.target.value)}
                      className={`w-full rounded-lg p-3 pl-12 text-sm font-medium transition-all ${
                        theme === 'dark'
                          ? 'bg-gray-800 border border-gray-600 text-white focus:border-orange-500 focus:shadow-lg focus:shadow-orange-500/20'
                          : 'bg-gray-50 border border-gray-300 text-black focus:border-orange-500 focus:shadow-lg focus:shadow-orange-500/10'
                      }`}
                      placeholder="Email hoặc tên tài khoản..."
                      required
                    />
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className={`w-full py-3 rounded-lg font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all flex justify-center items-center gap-2 ${
                    theme === 'dark'
                      ? 'bg-blue-600 hover:bg-blue-500 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                    {loading ? <Loader2 className="animate-spin" size={20}/> : <>
                      <Mail size={18} />
                      Gửi Mã Xác Thực
                    </>}
                </button>

                <button 
                  type="button" 
                  onClick={() => setView('LOGIN')}
                  className={`w-full text-xs font-bold uppercase flex items-center justify-center gap-2 transition-colors ${
                    theme === 'dark'
                      ? 'text-gray-400 hover:text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <ArrowLeft size={14}/> Quay Lại Đăng Nhập
                </button>
            </form>
        )}

        {/* --- VIEW: REGISTER --- */}
        {view === 'REGISTER' && (
             <form onSubmit={handleRegister} className="space-y-4 animate-in fade-in duration-300">
                <h3 className={`text-xl font-black text-center uppercase mb-4 ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>Đăng Ký Tài Khoản</h3>

                <div>
                  <label className={`block text-[11px] uppercase font-black mb-2 tracking-widest ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-700'
                  }`}>Họ Và Tên</label>
                  <div className="relative group">
                    <UserIcon className={`absolute left-4 top-2.5 ${
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                    } group-focus-within:text-blue-500 transition-colors`} size={16} />
                    <input 
                      type="text" 
                      value={regName} 
                      onChange={(e) => setRegName(e.target.value)} 
                      className={`w-full rounded-lg p-2.5 pl-12 text-sm font-medium transition-all ${
                        theme === 'dark'
                          ? 'bg-gray-800 border border-gray-600 text-white focus:border-blue-500'
                          : 'bg-gray-50 border border-gray-300 text-black focus:border-blue-500'
                      }`}
                      required 
                      placeholder="Nguyễn Văn A"
                    />
                  </div>
                </div>

                <div>
                  <label className={`block text-[11px] uppercase font-black mb-2 tracking-widest ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-700'
                  }`}>Email</label>
                  <div className="relative group">
                    <Mail className={`absolute left-4 top-2.5 ${
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                    } group-focus-within:text-blue-500 transition-colors`} size={16} />
                    <input 
                      type="email" 
                      value={regEmail} 
                      onChange={(e) => setRegEmail(e.target.value)} 
                      className={`w-full rounded-lg p-2.5 pl-12 text-sm font-medium transition-all ${
                        theme === 'dark'
                          ? 'bg-gray-800 border border-gray-600 text-white focus:border-blue-500'
                          : 'bg-gray-50 border border-gray-300 text-black focus:border-blue-500'
                      }`}
                      required 
                      placeholder="email@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className={`block text-[11px] uppercase font-black mb-2 tracking-widest ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-700'
                  }`}>Chi Nhánh</label>
                  <div className="relative group">
                    <Building className={`absolute left-4 top-2.5 ${
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                    } group-focus-within:text-blue-500 transition-colors z-10 pointer-events-none`} size={16} />
                    <select 
                      value={regBranch} 
                      onChange={(e) => setRegBranch(e.target.value)}
                      className={`w-full rounded-lg p-2.5 pl-12 text-sm font-medium transition-all appearance-none ${
                        theme === 'dark'
                          ? 'bg-gray-800 border border-gray-600 text-white focus:border-blue-500'
                          : 'bg-gray-50 border border-gray-300 text-black focus:border-blue-500'
                      }`}
                      required
                    >
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={`block text-[11px] uppercase font-black mb-2 tracking-widest ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-700'
                  }`}>Mật Khẩu</label>
                  <div className="relative group">
                    <Lock className={`absolute left-4 top-2.5 ${
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                    } group-focus-within:text-blue-500 transition-colors`} size={16} />
                    <input 
                      type={showRegPassword ? "text" : "password"}
                      value={regPassword} 
                      onChange={(e) => setRegPassword(e.target.value)} 
                      className={`w-full rounded-lg p-2.5 pl-12 pr-10 text-sm font-medium transition-all ${
                        theme === 'dark'
                          ? 'bg-gray-800 border border-gray-600 text-white focus:border-blue-500'
                          : 'bg-gray-50 border border-gray-300 text-black focus:border-blue-500'
                      }`}
                      required 
                      minLength={8}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className={`absolute right-3 top-2.5 ${
                        theme === 'dark' ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-black'
                      }`}
                    >
                      {showRegPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {regPassword && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1 flex-1 bg-gray-300 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all ${
                            getPasswordStrength(regPassword).score <= 1 ? 'w-1/4 bg-red-500' :
                            getPasswordStrength(regPassword).score <= 2 ? 'w-2/4 bg-orange-500' :
                            getPasswordStrength(regPassword).score <= 3 ? 'w-3/4 bg-yellow-500' :
                            getPasswordStrength(regPassword).score <= 4 ? 'w-full bg-green-500' :
                            'w-full bg-emerald-500'
                          }`}
                        />
                      </div>
                      <span className={`text-xs font-bold ${getPasswordStrength(regPassword).color}`}>
                        {getPasswordStrength(regPassword).text}
                      </span>
                    </div>
                  )}
                  <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
                    • Tối thiểu 8 ký tự • Chữ hoa, thường, số
                  </p>
                </div>

                <div>
                  <label className={`block text-[11px] uppercase font-black mb-2 tracking-widest ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-700'
                  }`}>Xác Nhận Mật Khẩu</label>
                  <div className="relative group">
                    <Lock className={`absolute left-4 top-2.5 ${
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                    } group-focus-within:text-blue-500 transition-colors`} size={16} />
                    <input 
                      type={showRegConfirmPassword ? "text" : "password"}
                      value={regConfirmPassword} 
                      onChange={(e) => setRegConfirmPassword(e.target.value)} 
                      className={`w-full rounded-lg p-2.5 pl-12 pr-10 text-sm font-medium transition-all ${
                        theme === 'dark'
                          ? 'bg-gray-800 border border-gray-600 text-white focus:border-blue-500'
                          : 'bg-gray-50 border border-gray-300 text-black focus:border-blue-500'
                      }`}
                      required 
                      minLength={8}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                      className={`absolute right-3 top-2.5 ${
                        theme === 'dark' ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-black'
                      }`}
                    >
                      {showRegConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {regPassword && regConfirmPassword && (
                    <div className={`mt-2 flex items-center gap-2 text-xs font-bold ${
                      regPassword === regConfirmPassword ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {regPassword === regConfirmPassword ? (
                        <><Check size={14} /> Mật khẩu khớp</>
                      ) : (
                        <><AlertTriangle size={14} /> Mật khẩu không khớp</>
                      )}
                    </div>
                  )}
                </div>

                <button 
                  type="submit" 
                  disabled={loading || regPassword !== regConfirmPassword || regPassword.length < 8}
                  className={`w-full font-black py-3 rounded-lg mt-4 transition-all flex justify-center items-center gap-2 uppercase text-xs shadow-lg disabled:opacity-50 ${
                    theme === 'dark'
                      ? 'bg-green-600 hover:bg-green-500 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : <>
                    <UserPlus size={18} /> 
                    Đăng Ký Ngay
                  </>}
                </button>

                <div className={`text-center mt-2 pt-3 border-t ${
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                }`}>
                    <button 
                      type="button" 
                      onClick={() => setView('LOGIN')}
                      className={`text-xs uppercase font-bold transition-colors ${
                        theme === 'dark'
                          ? 'text-gray-400 hover:text-white'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      ← Quay Lại Đăng Nhập
                    </button>
                </div>
             </form>
        )}

        {/* FOOTER TEXT */}
        {footerText && (
            <div className={`mt-6 pt-4 border-t ${
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            }`}>
                <p className={`text-[10px] uppercase font-bold tracking-widest text-center ${
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-600'
                }`}>{footerText}</p>
            </div>
        )}
      </div>

      {/* --- SYSTEM DIALOG (MODAL) --- */}
      {dialog.isOpen && (
          <div className={`fixed inset-0 z-[2000] flex items-center justify-center p-4 animate-in fade-in duration-200 ${
            theme === 'dark'
              ? 'bg-black/90 backdrop-blur-md'
              : 'bg-black/40 backdrop-blur-sm'
          }`}>
              <div className={`rounded-3xl w-full max-w-sm border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 ${
                theme === 'dark'
                  ? 'bg-gray-900 border-gray-800'
                  : 'bg-white border-gray-200'
              }`}>
                  <div className="p-8 text-center flex flex-col items-center">
                      {dialog.type === 'success' && <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                        theme === 'dark'
                          ? 'bg-emerald-500/20 text-emerald-500'
                          : 'bg-green-100 text-green-600'
                      }`}><CheckCircle2 size={32}/></div>}
                      
                      {dialog.type === 'error' && <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                        theme === 'dark'
                          ? 'bg-red-500/20 text-red-500'
                          : 'bg-red-100 text-red-600'
                      }`}><AlertTriangle size={32}/></div>}
                      
                      {dialog.type === 'info' && <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                        theme === 'dark'
                          ? 'bg-blue-500/20 text-blue-500'
                          : 'bg-blue-100 text-blue-600'
                      }`}><Info size={32}/></div>}
                      
                      <h3 className={`text-lg font-black uppercase tracking-tight mb-2 ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>{dialog.title}</h3>
                      <p className={`text-sm leading-relaxed mb-6 ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}>{dialog.message}</p>
                      
                      <button 
                        onClick={() => { setDialog({ ...dialog, isOpen: false }); dialog.onClose?.(); }}
                        className={`w-full py-3 rounded-xl font-black text-sm uppercase tracking-widest shadow-lg transition-all active:scale-95 ${
                          theme === 'dark'
                            ? 'bg-blue-600 hover:bg-blue-500 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                      >
                        Đóng
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Login;
