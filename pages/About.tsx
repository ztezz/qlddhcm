import React from 'react';
import { MapPin, Users, ShieldCheck, Layers, Globe, Phone, Mail, Building, ChevronRight, Info } from 'lucide-react';

const About: React.FC = () => {
    const features = [
        {
            icon: <MapPin className="text-blue-400" size={24} />,
            title: 'Tra cứu bản đồ',
            desc: 'Hiển thị bản đồ thửa đất, quy hoạch sử dụng đất với dữ liệu không gian chính xác, cập nhật liên tục.'
        },
        {
            icon: <Layers className="text-indigo-400" size={24} />,
            title: 'Quản lý lớp dữ liệu',
            desc: 'Tích hợp nhiều lớp bản đồ (WMS/WFS), hỗ trợ chồng xếp dữ liệu quy hoạch, hiện trạng và giá đất.'
        },
        {
            icon: <Globe className="text-cyan-400" size={24} />,
            title: 'Tra cứu giá đất',
            desc: 'Cung cấp thông tin bảng giá đất năm 2026 theo từng loại đất, vị trí và khu vực trên địa bàn.'
        },
        {
            icon: <ShieldCheck className="text-emerald-400" size={24} />,
            title: 'Bảo mật dữ liệu',
            desc: 'Hệ thống phân quyền nhiều cấp, bảo vệ thông tin theo vai trò người dùng, đảm bảo an toàn dữ liệu.'
        },
        {
            icon: <Users className="text-violet-400" size={24} />,
            title: 'Quản lý người dùng',
            desc: 'Hỗ trợ quản lý tài khoản, phân quyền truy cập theo đơn vị, cán bộ và cấp quản lý.'
        },
        {
            icon: <Building className="text-amber-400" size={24} />,
            title: 'Quản lý chi nhánh',
            desc: 'Liên kết thông tin thửa đất với từng chi nhánh, phường/xã, hỗ trợ quản lý đa đơn vị đầu mối.'
        }
    ];

    const stats = [
        { label: 'Thửa đất quản lý', value: '12.000+' },
        { label: 'Chi nhánh kết nối', value: '10+' },
        { label: 'Loại đất hỗ trợ', value: '20+' },
        { label: 'Người dùng', value: '500+' }
    ];

    return (
        <div className="h-full w-full overflow-y-auto bg-slate-950 text-white">
            {/* Hero Banner */}
            <div className="relative bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 border-b border-white/5 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(59,130,246,0.15)_0%,_transparent_60%)] pointer-events-none" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(99,102,241,0.1)_0%,_transparent_50%)] pointer-events-none" />
                <div className="max-w-5xl mx-auto px-6 py-16 md:py-24 relative z-10">
                    <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full mb-6">
                        <Info size={12} />
                        Giới thiệu hệ thống
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-white leading-none mb-4">
                        Quản lý đất đai
                        <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent"> Hồ Chí Minh</span>
                    </h1>
                    <p className="text-slate-400 text-base md:text-lg max-w-2xl leading-relaxed">
                        Hệ thống GIS tích hợp phục vụ quản lý, tra cứu và phân tích dữ liệu địa chính, thửa đất trên địa bàn TP.HCM và các tỉnh liên quan.
                    </p>
                    {/* Stats Row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10">
                        {stats.map((s, i) => (
                            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center backdrop-blur-sm">
                                <div className="text-2xl font-black text-white tracking-tighter">{s.value}</div>
                                <div className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5 font-bold">{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-12 space-y-14">
                {/* About Section */}
                <section>
                    <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-400 mb-3">Về chúng tôi</h2>
                    <h3 className="text-2xl font-black uppercase tracking-tighter text-white mb-4">Nền tảng GIS địa chính hiện đại</h3>
                    <div className="grid md:grid-cols-2 gap-6 text-slate-400 text-sm leading-relaxed">
                        <p>
                            Hệ thống QLDDHCM được xây dựng nhằm số hóa và hiện đại hóa công tác quản lý địa chính tại TP.HCM. Với công nghệ bản đồ WebGIS tiên tiến, hệ thống cho phép tra cứu, phân tích và quản lý thông tin thửa đất một cách nhanh chóng, chính xác.
                        </p>
                        <p>
                            Ứng dụng tích hợp cơ sở dữ liệu không gian (PostGIS), dịch vụ bản đồ WMS/WFS và bảng giá đất mới nhất, hỗ trợ cán bộ địa chính, nhà đầu tư và người dân dễ dàng tiếp cận thông tin quy hoạch sử dụng đất.
                        </p>
                    </div>
                </section>

                {/* Features */}
                <section>
                    <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-400 mb-3">Tính năng</h2>
                    <h3 className="text-2xl font-black uppercase tracking-tighter text-white mb-6">Chức năng hệ thống</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {features.map((f, i) => (
                            <div
                                key={i}
                                className="bg-slate-900/60 border border-white/5 hover:border-blue-500/30 rounded-2xl p-5 transition-all duration-200 hover:bg-slate-900/80 group"
                            >
                                <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200">
                                    {f.icon}
                                </div>
                                <h4 className="text-sm font-black uppercase tracking-tight text-white mb-2">{f.title}</h4>
                                <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Technology */}
                <section>
                    <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-400 mb-3">Công nghệ</h2>
                    <h3 className="text-2xl font-black uppercase tracking-tighter text-white mb-6">Nền tảng kỹ thuật</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { name: 'React 18', desc: 'Frontend' },
                            { name: 'Node.js', desc: 'Backend API' },
                            { name: 'PostgreSQL', desc: 'Cơ sở dữ liệu' },
                            { name: 'PostGIS', desc: 'Dữ liệu không gian' },
                            { name: 'OpenLayers', desc: 'Hiển thị bản đồ' },
                            { name: 'GeoServer', desc: 'WMS/WFS Server' },
                            { name: 'TypeScript', desc: 'Ngôn ngữ lập trình' },
                            { name: 'Tailwind CSS', desc: 'Giao diện người dùng' }
                        ].map((t, i) => (
                            <div key={i} className="bg-slate-900/60 border border-white/5 rounded-xl p-4 text-center">
                                <div className="text-sm font-black text-white tracking-tight">{t.name}</div>
                                <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5 font-medium">{t.desc}</div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Contact */}
                <section>
                    <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-400 mb-3">Liên hệ</h2>
                    <h3 className="text-2xl font-black uppercase tracking-tighter text-white mb-6">Thông tin liên hệ</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-6 flex items-start gap-4">
                            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center shrink-0">
                                <Building className="text-blue-400" size={20} />
                            </div>
                            <div>
                                <div className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1">Đơn vị phát triển</div>
                                <div className="text-sm font-bold text-white leading-relaxed">
                                    Trung tâm Công nghệ GIS<br />
                                    <span className="text-slate-400 font-normal">TP. Hồ Chí Minh, Việt Nam</span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-6 flex items-start gap-4">
                            <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center shrink-0">
                                <Mail className="text-indigo-400" size={20} />
                            </div>
                            <div>
                                <div className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1">Hỗ trợ kỹ thuật</div>
                                <div className="text-sm font-bold text-white">
                                    support@qlddhcm.io.vn
                                    <br />
                                    <a href="https://qlddhcm.io.vn" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 font-normal text-xs flex items-center gap-1 mt-1 transition-colors">
                                        qlddhcm.io.vn <ChevronRight size={12} />
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Footer note */}
                <div className="border-t border-white/5 pt-8 pb-4 text-center">
                    <p className="text-slate-600 text-xs">
                        © {new Date().getFullYear()} QLDDHCM — Webgis Hồ Chí Minh. Bảo lưu mọi quyền.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default About;
