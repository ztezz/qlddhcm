import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
// Fix: Added missing 'Info' icon to the lucide-react imports
import { QrCode, Link as LinkIcon, Type, Phone, Download, Palette, Mail, Wifi, Shield, Lock, Eye, EyeOff, Info } from 'lucide-react';

const QRGenerator: React.FC = () => {
    const [inputType, setInputType] = useState<'URL' | 'TEXT' | 'PHONE' | 'EMAIL' | 'WIFI'>('URL');
    const [inputValue, setInputValue] = useState('');
    const [qrColor, setQrColor] = useState('#000000');
    const [qrDataUrl, setQrDataUrl] = useState('');
    
    // WiFi specific states
    const [wifiPass, setWifiPass] = useState('');
    const [wifiEncr, setWifiEncr] = useState('WPA');
    const [showPass, setShowPass] = useState(false);

    const escapeWifiField = (value: string) => value.replace(/([\\;,:])/g, '\\$1');

    const generateQR = async () => {
        if (!inputValue.trim() && inputType !== 'WIFI') {
            setQrDataUrl('');
            return;
        }

        if (inputType === 'WIFI' && !inputValue.trim()) {
            setQrDataUrl('');
            return;
        }

        let finalValue = inputValue;
        if (inputType === 'PHONE') {
            finalValue = `tel:${inputValue.replace(/[^0-9+]/g, '')}`;
        } else if (inputType === 'EMAIL') {
            finalValue = `mailto:${inputValue.trim()}`;
        } else if (inputType === 'URL' && !inputValue.startsWith('http')) {
            finalValue = `https://${inputValue}`;
        } else if (inputType === 'WIFI') {
            // Escape reserved chars in SSID/password for QR WiFi format.
            const ssid = escapeWifiField(inputValue.trim());
            const passPart = wifiEncr === 'nopass' ? '' : `P:${escapeWifiField(wifiPass)};`;
            finalValue = `WIFI:T:${wifiEncr};S:${ssid};${passPart};`;
        }

        try {
            const url = await QRCode.toDataURL(finalValue, {
                width: 1024,
                margin: 2,
                color: {
                    dark: qrColor + 'ff',
                    light: '#ffffffff'
                },
                errorCorrectionLevel: 'H'
            });
            setQrDataUrl(url);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        const timer = setTimeout(generateQR, 300);
        return () => clearTimeout(timer);
    }, [inputValue, inputType, qrColor, wifiPass, wifiEncr]);

    return (
        <div className="p-8 bg-slate-950 min-h-full flex justify-center animate-in fade-in duration-500">
            <div className="w-full max-w-6xl">
                <div className="flex items-center gap-4 mb-10 border-b border-slate-800 pb-6">
                    <div className="bg-blue-600/20 p-4 rounded-3xl border border-blue-500/30 shadow-[0_0_20px_rgba(37,99,235,0.2)]">
                        <QrCode className="text-blue-400 w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-white uppercase tracking-tight">Trình tạo mã QR</h1>
                        <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Công cụ hỗ trợ tạo mã định danh chuyên nghiệp</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    {/* Cấu hình Input */}
                    <div className="lg:col-span-3 space-y-6">
                        <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 p-8 shadow-2xl">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 block">Chọn loại dữ liệu</label>
                            
                            <div className="grid grid-cols-5 gap-2 mb-8 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
                                <button 
                                    onClick={() => { setInputType('URL'); setInputValue(''); }}
                                    className={`flex flex-col items-center gap-2 py-4 rounded-xl transition-all ${inputType === 'URL' ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    <LinkIcon size={18}/>
                                    <span className="text-[9px] font-black uppercase">Link</span>
                                </button>
                                <button 
                                    onClick={() => { setInputType('TEXT'); setInputValue(''); }}
                                    className={`flex flex-col items-center gap-2 py-4 rounded-xl transition-all ${inputType === 'TEXT' ? 'bg-emerald-600 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    <Type size={18}/>
                                    <span className="text-[9px] font-black uppercase">Văn bản</span>
                                </button>
                                <button 
                                    onClick={() => { setInputType('PHONE'); setInputValue(''); }}
                                    className={`flex flex-col items-center gap-2 py-4 rounded-xl transition-all ${inputType === 'PHONE' ? 'bg-orange-600 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    <Phone size={18}/>
                                    <span className="text-[9px] font-black uppercase">SĐT</span>
                                </button>
                                <button 
                                    onClick={() => { setInputType('EMAIL'); setInputValue(''); }}
                                    className={`flex flex-col items-center gap-2 py-4 rounded-xl transition-all ${inputType === 'EMAIL' ? 'bg-purple-600 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    <Mail size={18}/>
                                    <span className="text-[9px] font-black uppercase">Email</span>
                                </button>
                                <button 
                                    onClick={() => { setInputType('WIFI'); setInputValue(''); setWifiPass(''); }}
                                    className={`flex flex-col items-center gap-2 py-4 rounded-xl transition-all ${inputType === 'WIFI' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    <Wifi size={18}/>
                                    <span className="text-[9px] font-black uppercase">WiFi</span>
                                </button>
                            </div>

                            <div className="space-y-4">
                                {inputType === 'WIFI' ? (
                                    <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                                                    Tên mạng (SSID)
                                                </label>
                                                <div className="relative">
                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"><Wifi size={16}/></div>
                                                    <input 
                                                        className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 pl-12 text-white outline-none focus:border-indigo-500 font-bold"
                                                        value={inputValue}
                                                        onChange={e => setInputValue(e.target.value)}
                                                        placeholder="Mạng WiFi nhà bạn"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Bảo mật</label>
                                                <div className="relative">
                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"><Shield size={16}/></div>
                                                    <select 
                                                        className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 pl-12 text-white outline-none focus:border-indigo-500 font-bold appearance-none cursor-pointer"
                                                        value={wifiEncr}
                                                        onChange={e => setWifiEncr(e.target.value)}
                                                    >
                                                        <option value="WPA">WPA/WPA2/WPA3</option>
                                                        <option value="WEP">WEP</option>
                                                        <option value="nopass">Không mật khẩu</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        {wifiEncr !== 'nopass' && (
                                            <div className="space-y-2 animate-in fade-in duration-300">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Mật khẩu WiFi</label>
                                                <div className="relative">
                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"><Lock size={16}/></div>
                                                    <input 
                                                        type={showPass ? "text" : "password"}
                                                        className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 pl-12 pr-12 text-white outline-none focus:border-indigo-500 font-mono"
                                                        value={wifiPass}
                                                        onChange={e => setWifiPass(e.target.value)}
                                                        placeholder="Nhập mật khẩu WiFi..."
                                                    />
                                                    <button 
                                                        type="button"
                                                        onClick={() => setShowPass(!showPass)}
                                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                                    >
                                                        {showPass ? <EyeOff size={18}/> : <Eye size={18}/>}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">
                                            {inputType === 'URL' ? 'Địa chỉ Website (URL)' : 
                                             inputType === 'TEXT' ? 'Nội dung văn bản' : 
                                             inputType === 'PHONE' ? 'Số điện thoại liên lạc' : 'Địa chỉ Email nhận thư'}
                                        </label>
                                        {inputType === 'TEXT' ? (
                                            <textarea 
                                                value={inputValue}
                                                onChange={(e) => setInputValue(e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-5 text-white outline-none focus:border-blue-500 h-40 resize-none transition-all shadow-inner"
                                                placeholder="Nhập nội dung cần tạo mã QR..."
                                            />
                                        ) : (
                                            <div className="relative">
                                                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500">
                                                    {inputType === 'URL' ? <LinkIcon size={18}/> : 
                                                     inputType === 'PHONE' ? <Phone size={18}/> : <Mail size={18}/>}
                                                </div>
                                                <input 
                                                    type={inputType === 'PHONE' ? 'tel' : inputType === 'EMAIL' ? 'email' : 'text'}
                                                    value={inputValue}
                                                    onChange={(e) => setInputValue(e.target.value)}
                                                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-5 pl-14 text-white outline-none focus:border-blue-500 font-bold transition-all shadow-inner"
                                                    placeholder={inputType === 'URL' ? 'www.example.com' : 
                                                                 inputType === 'PHONE' ? '090...' : 'example@mail.com'}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="pt-4 border-t border-slate-800">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block ml-1 flex items-center gap-2">
                                        <Palette size={14}/> Tùy chỉnh màu sắc
                                    </label>
                                    <div className="flex flex-wrap gap-3">
                                        {['#000000', '#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#4f46e5'].map(color => (
                                            <button 
                                                key={color}
                                                onClick={() => setQrColor(color)}
                                                className={`w-10 h-10 rounded-full border-4 transition-all ${qrColor === color ? 'border-white scale-110 shadow-lg shadow-black/50' : 'border-transparent hover:scale-105'}`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                        <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-slate-700 group">
                                            <input 
                                                type="color" 
                                                value={qrColor} 
                                                onChange={(e) => setQrColor(e.target.value)}
                                                className="absolute inset-[-10px] w-[200%] h-[200%] cursor-pointer"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Preview QR */}
                    <div className="lg:col-span-2">
                        <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 p-8 shadow-2xl sticky top-8 flex flex-col items-center">
                            <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] mb-8">Kết quả hiển thị</h3>
                            
                            <div className="bg-white p-4 rounded-[2rem] shadow-2xl mb-8 relative group overflow-hidden">
                                {qrDataUrl ? (
                                    <img src={qrDataUrl} alt="Generated QR" className="w-56 h-56 animate-in zoom-in-50 duration-300" />
                                ) : (
                                    <div className="w-56 h-56 flex flex-col items-center justify-center text-slate-200 gap-4">
                                        <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                                            <QrCode size={32} className="text-slate-300 animate-pulse" />
                                        </div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center px-4 leading-relaxed">Vui lòng nhập thông tin<br/>để xem trước mã QR</p>
                                    </div>
                                )}
                            </div>
                            <div className="w-full"> 
                                {qrDataUrl ? (
                                    <a
                                        href={qrDataUrl}
                                        download={`QR_${inputType}_${Date.now()}.png`}
                                        className="w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition-all shadow-xl bg-blue-600 hover:bg-blue-500 text-white active:scale-95 shadow-blue-900/30"
                                    >
                                        <Download size={18}/> Tải ảnh PNG (HD)
                                    </a>
                                ) : (
                                    <button
                                        type="button"
                                        disabled
                                        className="w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition-all shadow-xl bg-slate-800 text-slate-500 cursor-not-allowed opacity-50"
                                    >
                                        <Download size={18}/> T???i ???nh PNG (HD)
                                    </button>
                                )}
                            </div>

                            <div className="mt-8 bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50 w-full">
                                <div className="flex items-center gap-2 mb-2 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                    <Info size={12}/> Thông tin định dạng
                                </div>
                                <p className="text-[10px] text-slate-400 leading-relaxed">
                                    {inputType === 'WIFI' 
                                        ? "Dùng camera quét để kết nối WiFi tự động không cần nhập mật khẩu." 
                                        : "Tương thích với tất cả ứng dụng quét mã QR và Camera thông minh trên iOS/Android."}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QRGenerator;