
import React, { useState } from 'react';
import { LandPrice2026, User } from '../../types';
import { Calculator, Store, HardHat, FileText, Map as MapIcon, Gavel, X, Loader2 } from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import LandPricePrintTemplate from './LandPricePrintTemplate';

interface LandPriceDetailModalProps {
    data: LandPrice2026;
    user?: User | null;
    systemSettings?: Record<string, string>;
    onClose: () => void;
}

const LandPriceDetailModal: React.FC<LandPriceDetailModalProps> = ({ data, user, systemSettings, onClose }) => {
    const [isExporting, setIsExporting] = useState(false);

    const calculatePositions = (basePrice: number) => {
        return [
            { pos: 1, label: 'Vị trí 1', factor: 1, price: basePrice, desc: 'Thửa đất có ít nhất một mặt giáp trực tiếp lề đường có tên trong bảng giá đất' },
            { pos: 2, label: 'Vị trí 2', factor: 0.7, price: basePrice * 0.7, desc: 'Thửa đất không mặt tiền, nằm trong hẻm có chiều rộng từ 5m trở lên' },
            { pos: 3, label: 'Vị trí 3', factor: 0.5, price: basePrice * 0.5, desc: 'Thửa đất không mặt tiền, nằm trong hẻm có chiều rộng từ 3m đến dưới 5m' },
            { pos: 4, label: 'Vị trí 4', factor: 0.35, price: basePrice * 0.35, desc: 'Thửa đất không mặt tiền, nằm trong hẻm có chiều rộng dưới 3m' },
        ];
    };

    const handleExportPdf = async () => {
        const element = document.getElementById('land-price-print-template');
        if (!element) {
            alert("Không tìm thấy mẫu in!");
            return;
        }
        
        setIsExporting(true);
        try {
            // Chờ 1 chút để DOM cập nhật layout
            await new Promise(resolve => setTimeout(resolve, 200));

            const canvas = await html2canvas(element, {
                scale: 4, // Tăng scale lên 4 để chữ cực nét, đen đậm
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                windowWidth: 800 // Cố định chiều rộng để layout không vỡ
            });

            const imgData = canvas.toDataURL('image/png', 1.0);
            const pdf = new jsPDF('p', 'mm', 'a4');
            
            const pdfWidth = 210; // A4 Width in mm
            const pdfHeight = 297; // A4 Height in mm
            
            const imgWidth = pdfWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            let heightLeft = imgHeight;
            let position = 0;

            // Trang đầu tiên
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
            heightLeft -= pdfHeight;

            // Các trang tiếp theo
            while (heightLeft > 0) {
                position = heightLeft - imgHeight; // Vị trí âm để hiển thị phần dưới của ảnh
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
                heightLeft -= pdfHeight;
            }
            
            // Tên file sạch
            const safeName = data.tenduong
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-zA-Z0-9]/g, '_');
                
            pdf.save(`GiaDat_${safeName}_2026.pdf`);
        } catch (err) {
            console.error("PDF Export Error:", err);
            alert("Có lỗi xảy ra khi tạo file PDF. Vui lòng thử lại.");
        } finally {
            setIsExporting(false);
        }
    };

    const PriceTableSection = ({ title, icon: Icon, basePrice, colorClass, label }: { title: string, icon: any, basePrice: number, colorClass: string, label: string }) => {
        return (
            <div className="space-y-4">
                <div className="flex justify-between items-end px-2">
                    <h4 className={`text-[10px] font-black ${colorClass} uppercase tracking-[0.2em] flex items-center gap-2`}>
                        <Icon size={14}/> {title}
                    </h4>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-950 px-3 py-1 rounded-full border border-slate-800">
                        Đơn vị tính: VNĐ/m²
                    </span>
                </div>

                <div className="bg-slate-950 rounded-[2rem] border border-slate-800 overflow-hidden shadow-inner">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-900/50 text-slate-500 uppercase text-[9px] font-black tracking-widest border-b border-slate-800">
                            <tr>
                                <th className="p-4 w-20 text-center">Vị trí</th>
                                <th className="p-4">Mô tả áp dụng</th>
                                <th className="p-4 w-24 text-center">Hệ số</th>
                                <th className="p-4 text-right">Giá {label}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {calculatePositions(basePrice).map((p) => (
                                <tr key={p.pos} className={p.pos === 1 ? 'bg-blue-600/5' : ''}>
                                    <td className="p-5 text-center">
                                        <span className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto text-xs font-black ${
                                            p.pos === 1 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                                        }`}>
                                            {p.pos}
                                        </span>
                                    </td>
                                    <td className="p-5">
                                        <div className="font-bold text-slate-200 text-sm">{p.desc}</div>
                                        <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">
                                            {p.pos === 1 ? 'Giáp trực tiếp lề đường chính' : `Hẻm của tuyến đường`}
                                        </p>
                                    </td>
                                    <td className="p-5 text-center">
                                        <span className="text-[10px] font-mono font-bold text-slate-500">{p.factor * 100}%</span>
                                    </td>
                                    <td className={`p-5 text-right font-mono font-black ${colorClass} text-base`}>
                                        {formatCurrency(p.price, true)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <>
            {/* Template in ẩn (vẫn render trong DOM nhưng user không thấy) */}
            <LandPricePrintTemplate data={data} user={user} systemSettings={systemSettings} />

            <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="bg-gray-900 border border-gray-800 rounded-[2.5rem] w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    {/* Modal Header */}
                    <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className="bg-emerald-600/20 p-3 rounded-2xl border border-emerald-500/30">
                                <FileText className="text-emerald-400" size={24}/>
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white uppercase tracking-tight">Chi tiết bảng giá đất</h3>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Tra cứu chuyên sâu theo vị trí</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-all text-slate-500 hover:text-white">
                            <X size={24}/>
                        </button>
                    </div>

                    {/* Modal Content */}
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        <div className="space-y-12">
                            
                            {/* Section 1: General Info & Legal Basis */}
                            <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-6 items-stretch">
                                <div className="flex flex-col gap-4">
                                    <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <MapIcon size={14}/> Thông tin tuyến đường
                                    </h4>
                                    <div className="bg-slate-950/50 rounded-3xl p-5 border border-slate-800 space-y-3 flex-1">
                                        <div className="flex justify-between items-baseline border-b border-slate-800/50 pb-2">
                                            <span className="text-[10px] text-slate-500 font-bold uppercase">Tên đường</span>
                                            <span className="text-base font-black text-white">{data.tenduong}</span>
                                        </div>
                                        <div className="flex justify-between items-center border-b border-slate-800/50 pb-2">
                                            <span className="text-[10px] text-slate-500 font-bold uppercase">Khu vực</span>
                                            <span className="text-[11px] font-bold text-slate-300">{data.phuongxa} (Tỉnh: {data.tinhcu})</span>
                                        </div>
                                        <div className="flex flex-col gap-1 border-b border-slate-800/50 pb-2">
                                            <span className="text-[10px] text-slate-500 font-bold uppercase mb-1">Đoạn đường</span>
                                            <span className="text-[11px] font-bold text-slate-300">Từ: {data.tu || 'Đầu đường'}</span>
                                            <span className="text-[11px] font-bold text-slate-300">Đến: {data.den || 'Cuối đường'}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] text-slate-500 font-bold uppercase">Năm áp dụng</span>
                                            <span className="text-xs font-black text-amber-400">{data.nam_ap_dung}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-4">
                                    <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <Gavel size={14}/> Căn cứ pháp lý
                                    </h4>
                                    <div className="bg-emerald-950/10 rounded-3xl p-5 border border-emerald-900/20 space-y-3 flex-1 flex flex-col">
                                        <div>
                                            <p className="text-[9px] text-slate-500 font-bold uppercase mb-1">Nguồn dữ liệu</p>
                                            <p className="text-[9px] font-bold text-slate-200 leading-relaxed italic">
                                                {data.nguon_du_lieu || 'Bảng giá đất ban hành kèm theo Quyết định của UBND Tỉnh.'}
                                            </p>
                                        </div>
                                        {data.ghi_chu && (
                                            <div className="mt-auto pt-4 border-t border-emerald-900/20">
                                                <p className="text-[9px] text-slate-500 font-bold uppercase mb-1">Ghi chú</p>
                                                <p className="text-[10px] font-bold text-slate-400 leading-relaxed truncate-2-lines">
                                                    {data.ghi_chu}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Detailed Price Tables */}
                            <div className="space-y-16">
                                <PriceTableSection 
                                    title="1. Bảng giá Đất ở (ODT)" 
                                    icon={Calculator} 
                                    basePrice={data.dato} 
                                    colorClass="text-emerald-400" 
                                    label="Đất Ở"
                                />

                                <PriceTableSection 
                                    title="2. Bảng giá Đất Thương mại, dịch vụ (TMDV)" 
                                    icon={Store} 
                                    basePrice={data.dattmdv} 
                                    colorClass="text-blue-400" 
                                    label="TMDV"
                                />

                                <PriceTableSection 
                                    title="3. Bảng giá Đất Sản xuất, kinh doanh (SXKD)" 
                                    icon={HardHat} 
                                    basePrice={data.datsxkdpnn} 
                                    colorClass="text-orange-400" 
                                    label="SXKD"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="p-6 border-t border-slate-800 bg-slate-950/30 flex justify-end gap-3">
                        <button 
                            onClick={onClose}
                            className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all"
                        >
                            Đóng lại
                        </button>
                        <button 
                            onClick={handleExportPdf}
                            disabled={isExporting}
                            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-blue-900/20 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            {isExporting ? <Loader2 size={16} className="animate-spin"/> : <FileText size={16}/>}
                            {isExporting ? 'Đang tạo PDF...' : 'Xuất chi tiết (PDF)'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default LandPriceDetailModal;
