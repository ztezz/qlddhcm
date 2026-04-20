
import React from 'react';
import { LandPrice2026, User } from '../../types';
import { formatCurrency } from '../../utils/helpers';
import { resolvePdfTemplateSettings } from '../../utils/pdfTemplatePresets';

interface Props {
    data: LandPrice2026;
    user?: User | null;
    systemSettings?: Record<string, string>;
}

const LandPricePrintTemplate: React.FC<Props> = ({ data, user, systemSettings }) => {
    const calculatePositions = (basePrice: number) => {
        return [
            { pos: 1, label: 'Vị trí 1', factor: 1, price: basePrice, desc: 'Mặt tiền đường' },
            { pos: 2, label: 'Vị trí 2', factor: 0.7, price: basePrice * 0.7, desc: 'Hẻm ≥ 5m' },
            { pos: 3, label: 'Vị trí 3', factor: 0.5, price: basePrice * 0.5, desc: 'Hẻm 3m - <5m' },
            { pos: 4, label: 'Vị trí 4', factor: 0.35, price: basePrice * 0.35, desc: 'Hẻm < 3m' },
        ];
    };

    const effectiveSettings = resolvePdfTemplateSettings(systemSettings);
    const pdfHeader1 = effectiveSettings.pdf_header_1 || 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
    const pdfHeader2 = effectiveSettings.pdf_header_2 || 'Độc lập - Tự do - Hạnh phúc';
    const pdfLocationText = effectiveSettings.pdf_location_text || 'TP. Hồ Chí Minh';
    const pdfSignerTitle = 'Người tra cứu';
    const pdfSignerName = effectiveSettings.pdf_signer_name || user?.name || 'HỆ THỐNG WEBGIS';
    const pdfNoteText = effectiveSettings.pdf_note_text || 'Dữ liệu bảng giá đất được trích xuất từ hệ thống và có giá trị tham khảo.';
    const pdfFooterText = effectiveSettings.pdf_footer_text || effectiveSettings.footer_text || 'Trung tâm dữ liệu GIS';
    const showSigner = effectiveSettings.pdf_show_signer !== 'false';
    const showSignatureImage = effectiveSettings.pdf_show_signature_image !== 'false';
    const showStamp = effectiveSettings.pdf_show_stamp !== 'false';
    const signatureStyle = String(effectiveSettings.pdf_signature_style || 'HANDWRITTEN').toUpperCase();
    const signatureImage = effectiveSettings.pdf_signature_image || '';
    const stampImage = effectiveSettings.pdf_stamp_image || '';
    const signatureWidth = Math.max(80, Number(effectiveSettings.pdf_signature_width || 160));
    const signatureHeight = Math.max(36, Number(effectiveSettings.pdf_signature_height || 62));
    const stampSize = Math.max(76, Math.min(112, Math.round(signatureWidth * 0.62)));
    const stampTransform = 'translate(-5%, -28%) rotate(-18deg)';

    const signatureFontFamily = signatureStyle === 'DIGITAL'
        ? '"Segoe Script", "Brush Script MT", cursive'
        : signatureStyle === 'FORMAL'
            ? '"Times New Roman", serif'
            : '"Brush Script MT", "Segoe Script", cursive';
    const signatureColor = signatureStyle === 'DIGITAL' ? '#1d4ed8' : '#111827';
    const signatureLabel = signatureStyle === 'DIGITAL' ? 'Ký số xác nhận' : signatureStyle === 'FORMAL' ? 'Ký duyệt hồ sơ' : 'Chữ ký xác nhận';

    const RenderTable = ({ title, price }: { title: string; price: number }) => (
        <div style={{ marginBottom: '25px', pageBreakInside: 'avoid' }}>
            <h4 style={{ fontSize: '13px', fontWeight: '800', marginBottom: '8px', textTransform: 'uppercase', color: '#000000' }}>{title}</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', color: '#000000' }}>
                <thead>
                    <tr style={{ backgroundColor: '#e0e0e0' }}>
                        <th style={{ border: '1px solid #000000', padding: '6px', textAlign: 'center', width: '50px', fontWeight: 'bold' }}>VT</th>
                        <th style={{ border: '1px solid #000000', padding: '6px', textAlign: 'left', fontWeight: 'bold' }}>Mô tả</th>
                        <th style={{ border: '1px solid #000000', padding: '6px', textAlign: 'center', width: '70px', fontWeight: 'bold' }}>Hệ số</th>
                        <th style={{ border: '1px solid #000000', padding: '6px', textAlign: 'right', width: '140px', fontWeight: 'bold' }}>Đơn giá (VNĐ/m²)</th>
                    </tr>
                </thead>
                <tbody>
                    {calculatePositions(price).map((row) => (
                        <tr key={row.pos}>
                            <td style={{ border: '1px solid #000000', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>{row.pos}</td>
                            <td style={{ border: '1px solid #000000', padding: '6px' }}>{row.desc}</td>
                            <td style={{ border: '1px solid #000000', padding: '6px', textAlign: 'center' }}>{row.factor * 100}%</td>
                            <td style={{ border: '1px solid #000000', padding: '6px', textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace' }}>
                                {formatCurrency(row.price, true).replace(' VNĐ/m²', '')}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderSignerBlock = () => {
        if (!showSigner) return null;

        return (
            <div style={{ textAlign: 'center', width: '300px' }}>
                <p style={{ fontStyle: 'italic', fontSize: '13px', color: '#000000', margin: '0' }}>
                    {pdfLocationText}, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}
                </p>
                <p style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '13px', color: '#000000', margin: '5px 0 8px' }}>
                    {pdfSignerTitle}
                </p>
                <div style={{ position: 'relative', height: `${Math.max(signatureHeight + 16, 68)}px`, marginBottom: '4px' }}>
                    {showSignatureImage && signatureImage ? (
                        <img
                            src={signatureImage}
                            alt="signature"
                            style={{
                                maxWidth: `${signatureWidth}px`,
                                maxHeight: `${signatureHeight}px`,
                                objectFit: 'contain',
                                margin: '0 auto',
                                display: 'block',
                                filter: signatureStyle === 'DIGITAL' ? 'hue-rotate(180deg) saturate(1.2)' : 'none'
                            }}
                        />
                    ) : (
                        <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                            <span style={{ fontSize: '10px', color: '#6b7280', marginBottom: '2px' }}>{signatureLabel}</span>
                            <span style={{ fontFamily: signatureFontFamily, fontSize: signatureStyle === 'FORMAL' ? '22px' : '28px', color: signatureColor, fontWeight: signatureStyle === 'FORMAL' ? 700 : 500 }}>
                                {pdfSignerName}
                            </span>
                        </div>
                    )}

                    {showStamp && (
                        stampImage ? (
                            <img
                                src={stampImage}
                                alt="stamp"
                                style={{
                                    position: 'absolute',
                                    left: '50%',
                                    top: '50%',
                                    width: `${stampSize}px`,
                                    height: `${stampSize}px`,
                                    objectFit: 'contain',
                                    opacity: 0.82,
                                    transform: stampTransform,
                                    transformOrigin: 'center',
                                    zIndex: 2,
                                    pointerEvents: 'none'
                                }}
                            />
                        ) : (
                            <div
                                style={{
                                    position: 'absolute',
                                    left: '50%',
                                    top: '50%',
                                    width: `${stampSize}px`,
                                    height: `${stampSize}px`,
                                    border: '2px solid #dc2626',
                                    borderRadius: '50%',
                                    color: '#dc2626',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    textAlign: 'center',
                                    fontSize: '9px',
                                    lineHeight: 1.2,
                                    fontWeight: 'bold',
                                    opacity: 0.72,
                                    transform: stampTransform,
                                    transformOrigin: 'center',
                                    zIndex: 2,
                                    pointerEvents: 'none'
                                }}
                            >
                                MỘC
                                <br />
                                XÁC NHẬN
                            </div>
                        )
                    )}
                </div>
                <p style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '14px', color: '#000000', margin: '6px 0 0 0' }}>
                    {pdfSignerName}
                </p>
            </div>
        );
    };

    return (
        <div id="land-price-print-template" style={{
            width: '794px',
            minHeight: '1123px',
            padding: '40px 50px',
            backgroundColor: '#ffffff',
            color: '#000000',
            fontFamily: '"Times New Roman", Times, serif',
            position: 'fixed',
            top: 0,
            left: '-10000px',
            zIndex: -1000,
            visibility: 'visible',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box'
        }}>
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 'bold', margin: 0, color: '#000000' }}>{pdfHeader1}</h3>
                <p style={{ fontSize: '14px', fontWeight: 'bold', margin: '5px 0 20px 0', textDecoration: 'underline', color: '#000000' }}>{pdfHeader2}</p>

                <h1 style={{ fontSize: '22px', fontWeight: '900', marginTop: '30px', color: '#000000' }}>KẾT QUẢ TRA CỨU GIÁ ĐẤT 2026</h1>
                <p style={{ fontSize: '13px', fontStyle: 'italic', color: '#000000' }}>Thời điểm xuất: {new Date().toLocaleString('vi-VN')}</p>
            </div>

            <div style={{ marginBottom: '30px', border: '2px solid #000000', padding: '15px' }}>
                <table style={{ width: '100%', fontSize: '14px', color: '#000000' }}>
                    <tbody>
                        <tr>
                            <td style={{ padding: '4px', width: '110px', fontWeight: 'bold', verticalAlign: 'top' }}>Tên đường:</td>
                            <td style={{ padding: '4px', fontWeight: 'bold', fontSize: '15px', textTransform: 'uppercase' }}>{data.tenduong}</td>
                        </tr>
                        <tr>
                            <td style={{ padding: '4px', fontWeight: 'bold', verticalAlign: 'top' }}>Khu vực:</td>
                            <td style={{ padding: '4px' }}>{data.phuongxa} (Tỉnh cũ: {data.tinhcu})</td>
                        </tr>
                        <tr>
                            <td style={{ padding: '4px', fontWeight: 'bold', verticalAlign: 'top' }}>Đoạn đường:</td>
                            <td style={{ padding: '4px' }}>Từ <b>{data.tu || 'Đầu đường'}</b> đến <b>{data.den || 'Cuối đường'}</b></td>
                        </tr>
                        <tr>
                            <td style={{ padding: '4px', fontWeight: 'bold', verticalAlign: 'top' }}>Năm áp dụng:</td>
                            <td style={{ padding: '4px', fontWeight: 'bold' }}>{data.nam_ap_dung}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 'bold', borderBottom: '2px solid #000000', paddingBottom: '5px', marginBottom: '20px', color: '#000000' }}>CHI TIẾT BẢNG GIÁ</h3>

                <RenderTable title="1. Đất Ở (ODT)" price={data.dato} />
                <RenderTable title="2. Đất Thương Mại Dịch Vụ (TMDV)" price={data.dattmdv} />
                <RenderTable title="3. Đất Sản Xuất Kinh Doanh (SXKD)" price={data.datsxkdpnn} />
            </div>

            {pdfNoteText && (
                <div style={{ marginTop: '8px', marginBottom: '18px', padding: '8px 10px', border: '1px dashed #000', fontSize: '12px', fontStyle: 'italic', backgroundColor: '#faf7e8' }}>
                    <strong>Ghi chú:</strong> {pdfNoteText}
                </div>
            )}

            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', pageBreakInside: 'avoid' }}>
                {renderSignerBlock()}
            </div>

            <div style={{ marginTop: '20px', borderTop: '1px solid #000000', paddingTop: '10px', fontSize: '11px', textAlign: 'center', color: '#000000', fontStyle: 'italic' }}>
                Hệ thống WebGIS GeoMaster - {pdfFooterText}
            </div>
        </div>
    );
};

export default LandPricePrintTemplate;
