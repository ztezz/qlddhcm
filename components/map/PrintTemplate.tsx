
import React, { useEffect, useRef, useState } from 'react';
import { LandParcel, User } from '../../types';
import QRCode from 'qrcode';
import { resolvePdfTemplateSettings } from '../../utils/pdfTemplatePresets';
import { formatParcelIdentifier, getRawParcelIdentifier } from '../../utils/helpers';

interface PrintTemplateProps {
    parcel: LandParcel;
    user?: User | null;
    systemSettings?: Record<string, string>;
    templateId?: string;
}

interface GeometryPoint {
    id: number;
    x: number;
    y: number;
    distanceNext?: string;
}

const PrintTemplate: React.FC<PrintTemplateProps> = ({ parcel, user, systemSettings, templateId = 'print-template' }) => {
    const formData = parcel.properties;
    const parcelCanvasRef = useRef<HTMLCanvasElement>(null);
    const [geometryPoints, setGeometryPoints] = useState<GeometryPoint[]>([]);
    const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

    const getAttribute = (data: any, keys: string[]) => {
        for (const key of keys) {
            if (data[key] !== undefined && data[key] !== null && data[key] !== '') return data[key];
        }
        return "";
    };

    const parcelIdentifier = formatParcelIdentifier(formData, systemSettings?.parcel_identifier_format);
    const rawParcelIdentifier = getRawParcelIdentifier(formData) || '--';
    const sheetNumber = getAttribute(formData, ['so_to', 'sodoto', 'shmap']);
    const parcelNumber = getAttribute(formData, ['so_thua', 'sothua', 'shthua']);

    useEffect(() => {
        // Generate QR Code for Print Verification
        const generateQR = async () => {
            try {
                const verificationContent = `VERIFY: ${parcel.id}\nPARCEL: ${rawParcelIdentifier}\nSHEET: ${sheetNumber || '--'}\nLOT: ${parcelNumber || '--'}\nWEBGIS GEOMASTER AUTHENTICATED`;
                const url = await QRCode.toDataURL(verificationContent, {
                    width: 120,
                    margin: 0,
                    color: { dark: '#000000', light: '#ffffff' }
                });
                setQrCodeUrl(url);
            } catch (err) {
                console.error("QR Print Error:", err);
            }
        };
        generateQR();

        if (!parcel.geometry || !parcel.geometry.coordinates) return;

        let rawCoords: any[] = [];
        if (parcel.geometry.type === 'Polygon') {
            rawCoords = parcel.geometry.coordinates[0];
        } else if (parcel.geometry.type === 'MultiPolygon') {
            rawCoords = parcel.geometry.coordinates[0][0];
        }

        if (rawCoords.length > 0) {
            const isClosed = JSON.stringify(rawCoords[0]) === JSON.stringify(rawCoords[rawCoords.length - 1]);
            const filteredCoords = (isClosed && rawCoords.length > 1) ? rawCoords.slice(0, -1) : rawCoords;

            const points: GeometryPoint[] = filteredCoords.map((c: any, i: number) => ({
                id: i + 1,
                x: c[0],
                y: c[1]
            }));

            const isWGS84 = points[0].x > 100 && points[0].x < 110;

            for (let i = 0; i < points.length; i++) {
                const p1 = points[i];
                const p2 = points[i + 1] || points[0]; 
                
                let dist = 0;
                if (isWGS84) {
                    const avgLat = (p1.y + p2.y) / 2;
                    const cosLat = Math.cos(avgLat * Math.PI / 180);
                    const dx = (p2.x - p1.x) * 111319.9 * cosLat;
                    const dy = (p2.y - p1.y) * 111319.9;
                    dist = Math.sqrt(dx * dx + dy * dy);
                } else {
                    const dx = p2.x - p1.x;
                    const dy = p2.y - p1.y;
                    dist = Math.sqrt(dx * dx + dy * dy);
                }
                p1.distanceNext = dist.toFixed(2);
            }
            setGeometryPoints(points);

            const canvas = parcelCanvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    
                    const xs = points.map(p => p.x);
                    const ys = points.map(p => p.y);
                    const minX = Math.min(...xs), maxX = Math.max(...xs);
                    const minY = Math.min(...ys), maxY = Math.max(...ys);
                    const rangeX = maxX - minX || 0.000001;
                    const rangeY = maxY - minY || 0.000001;
                    
                    const padding = 40; // Giảm padding để hình vẽ to hơn
                    const availableW = canvas.width - padding * 2;
                    const availableH = canvas.height - padding * 2;
                    const scale = Math.min(availableW / rangeX, availableH / rangeY);
                    
                    const offsetX = (canvas.width - rangeX * scale) / 2;
                    const offsetY = (canvas.height - rangeY * scale) / 2;
                    
                    const tx = (x: number) => offsetX + (x - minX) * scale;
                    const ty = (y: number) => canvas.height - (offsetY + (y - minY) * scale);

                    ctx.beginPath();
                    ctx.lineWidth = 2.5;
                    ctx.strokeStyle = "#000000";
                    ctx.lineJoin = "round";
                    points.forEach((pt, idx) => {
                        const px = tx(pt.x);
                        const py = ty(pt.y);
                        if (idx === 0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    });
                    ctx.closePath();
                    ctx.stroke();

                    points.forEach((pt, idx) => {
                        const pNext = points[idx + 1] || points[0];
                        const x1 = tx(pt.x), y1 = ty(pt.y);
                        const x2 = tx(pNext.x), y2 = ty(pNext.y);
                        const pointLabelStep = points.length > 60 ? 4 : points.length > 40 ? 3 : points.length > 24 ? 2 : 1;
                        const edgeLabelStep = points.length > 60 ? 5 : points.length > 40 ? 4 : points.length > 24 ? 3 : 1;
                        
                        ctx.beginPath();
                        ctx.arc(x1, y1, 2.5, 0, Math.PI * 2);
                        ctx.fillStyle = "#000000";
                        ctx.fill();

                        if (idx % pointLabelStep === 0) {
                            ctx.font = points.length > 40 ? "bold 10px Arial" : "bold 12px Arial";
                            ctx.fillStyle = "#000000";
                            const anglePoint = Math.atan2(y1 - (canvas.height/2), x1 - (canvas.width/2));
                            ctx.fillText(pt.id.toString(), x1 + Math.cos(anglePoint) * 15 - 4, y1 + Math.sin(anglePoint) * 15 + 4);
                        }

                        if (pt.distanceNext && idx % edgeLabelStep === 0) {
                            const midX = (x1 + x2) / 2;
                            const midY = (y1 + y2) / 2;
                            ctx.save();
                            ctx.translate(midX, midY);
                            let angle = Math.atan2(y2 - y1, x2 - x1);
                            if (angle > Math.PI/2 || angle < -Math.PI/2) angle += Math.PI;
                            ctx.rotate(angle);
                            ctx.font = points.length > 40 ? "italic bold 8px Arial" : "italic bold 10px Arial";
                            ctx.textAlign = "center";
                            ctx.fillStyle = "#000000";
                            ctx.fillText(pt.distanceNext, 0, -5);
                            ctx.restore();
                        }
                    });
                }
            }
        }
    }, [parcel, parcelIdentifier]);

    // Tự động tính toán kích thước font bảng dựa trên số lượng điểm
    const getTableStyles = () => {
        const count = geometryPoints.length;
        if (count > 60) return { fontSize: '11px', padding: '5px', lineHeight: '1.35', rowHeight: '26px' };
        if (count > 30) return { fontSize: '12px', padding: '6px', lineHeight: '1.4', rowHeight: '28px' };
        return { fontSize: '13px', padding: '7px', lineHeight: '1.45', rowHeight: '30px' };
    };

    const tableStyle = getTableStyles();
    const firstPageRows = geometryPoints.length > 60 ? 12 : 16;
    const nextPageRows = 24;
    const firstRows = geometryPoints.slice(0, firstPageRows);
    const tailRows = geometryPoints.slice(firstPageRows);
    const extraChunks: GeometryPoint[][] = [];
    for (let i = 0; i < tailRows.length; i += nextPageRows) {
        extraChunks.push(tailRows.slice(i, i + nextPageRows));
    }
    const effectiveSettings = resolvePdfTemplateSettings(systemSettings);
    const pdfHeader1 = effectiveSettings.pdf_header_1 || 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
    const pdfHeader2 = effectiveSettings.pdf_header_2 || 'Độc lập - Tự do - Hạnh phúc';
    const pdfTitle = effectiveSettings.pdf_title || effectiveSettings.pdf_header_text || 'TRÍCH LỤC BẢN ĐỒ ĐỊA CHÍNH';
    const pdfLocationText = effectiveSettings.pdf_location_text || 'TP. Hồ Chí Minh';
    const pdfSignerTitle = effectiveSettings.pdf_signer_title || 'Người trích lục';
    const pdfSignerName = effectiveSettings.pdf_signer_name || user?.name || 'HỆ THỐNG WEBGIS';
    const pdfNoteText = effectiveSettings.pdf_note_text || '';
    const pdfFooterText = effectiveSettings.pdf_footer_text || effectiveSettings.footer_text || 'Trung tâm dữ liệu GIS';
    const showQr = effectiveSettings.pdf_show_qr !== 'false';
    const showSigner = effectiveSettings.pdf_show_signer !== 'false';
    const showSignatureImage = effectiveSettings.pdf_show_signature_image !== 'false';
    const showStamp = effectiveSettings.pdf_show_stamp !== 'false';
    const signatureStyle = String(effectiveSettings.pdf_signature_style || 'HANDWRITTEN').toUpperCase();
    const signatureImage = effectiveSettings.pdf_signature_image || '';
    const stampImage = effectiveSettings.pdf_stamp_image || '';
    const signatureWidth = Math.max(80, Number(effectiveSettings.pdf_signature_width || 160));
    const signatureHeight = Math.max(36, Number(effectiveSettings.pdf_signature_height || 62));
    const stampSize = Math.max(76, Math.min(112, Math.round(signatureWidth * 0.62)));
    const stampTransform = `translate(-5%, -28%) rotate(-18deg)`;

    const signatureFontFamily = signatureStyle === 'DIGITAL'
        ? '"Segoe Script", "Brush Script MT", cursive'
        : signatureStyle === 'FORMAL'
            ? '"Times New Roman", serif'
            : '"Brush Script MT", "Segoe Script", cursive';
    const signatureColor = signatureStyle === 'DIGITAL' ? '#1d4ed8' : '#111827';
    const signatureLabel = signatureStyle === 'DIGITAL' ? 'Ký số xác nhận' : signatureStyle === 'FORMAL' ? 'Ký duyệt hồ sơ' : 'Chữ ký xác nhận';

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
                            <div style={{
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
                            }}>
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

    const renderTable = (rows: GeometryPoint[]) => (
        <table style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
            fontSize: tableStyle.fontSize,
            textAlign: "center",
            border: "1px solid #000",
            color: "#000000",
            lineHeight: tableStyle.lineHeight,
            fontFamily: 'Arial, Helvetica, sans-serif',
            backgroundColor: '#ffffff'
        }}>
            <thead>
                <tr style={{ backgroundColor: "#f2f2f2" }}>
                    <th style={{ border: "0.75px solid #000", padding: tableStyle.padding, fontWeight: "bold", verticalAlign: 'middle', height: tableStyle.rowHeight }}>Số hiệu đỉnh</th>
                    <th style={{ border: "0.75px solid #000", padding: tableStyle.padding, fontWeight: "bold", verticalAlign: 'middle', height: tableStyle.rowHeight }}>Tọa độ X (m)</th>
                    <th style={{ border: "0.75px solid #000", padding: tableStyle.padding, fontWeight: "bold", verticalAlign: 'middle', height: tableStyle.rowHeight }}>Tọa độ Y (m)</th>
                    <th style={{ border: "0.75px solid #000", padding: tableStyle.padding, fontWeight: "bold", verticalAlign: 'middle', height: tableStyle.rowHeight }}>Cạnh (m)</th>
                </tr>
            </thead>
            <tbody>
                {rows.map((p, i) => (
                    <tr key={`${p.id}-${i}`}>
                        <td style={{ border: "0.75px solid #000", padding: tableStyle.padding, fontWeight: "bold", verticalAlign: 'middle', height: tableStyle.rowHeight }}>{p.id}</td>
                        <td style={{ border: "0.75px solid #000", padding: tableStyle.padding, verticalAlign: 'middle', height: tableStyle.rowHeight, whiteSpace: 'nowrap' }}>{p.x.toFixed(3)}</td>
                        <td style={{ border: "0.75px solid #000", padding: tableStyle.padding, verticalAlign: 'middle', height: tableStyle.rowHeight, whiteSpace: 'nowrap' }}>{p.y.toFixed(3)}</td>
                        <td style={{ border: "0.75px solid #000", padding: tableStyle.padding, fontWeight: "bold", verticalAlign: 'middle', height: tableStyle.rowHeight, whiteSpace: 'nowrap' }}>{p.distanceNext || "-"}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );

    return (
        <div id={templateId} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="print-page" style={{
                width: "794px",
                minHeight: "1123px",
                padding: "40px 60px",
                backgroundColor: "#ffffff",
                color: "#000000",
                fontFamily: '"Times New Roman", Times, serif',
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                position: "relative"
            }}>
                <div style={{ textAlign: "center", marginBottom: "10px" }}>
                    <h3 style={{ fontWeight: "bold", fontSize: "14px", textTransform: "uppercase", margin: "0", color: "#000000" }}>
                        {pdfHeader1}
                    </h3>
                    <p style={{ fontWeight: "bold", fontSize: "13px", margin: "4px 0", display: "inline-block", borderBottom: "1.5px solid #000", paddingBottom: "5px", color: "#000000" }}>
                        {pdfHeader2}
                    </p>
                </div>

                <h1 style={{ fontSize: "19px", fontWeight: "bold", textTransform: "uppercase", margin: "20px 0", textAlign: "center", color: "#000000" }}>
                    {pdfTitle}
                </h1>

                <div style={{ fontSize: "14px", lineHeight: "1.5", marginBottom: "10px", color: "#000000" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <p style={{ margin: "0" }}><strong>1. Thửa đất số:</strong> {getAttribute(formData, ["so_thua", "sothua", "shthua"]) || "..."}</p>
                        <p style={{ margin: "0" }}><strong>Tờ bản đồ số:</strong> {getAttribute(formData, ["so_to", "sodoto", "shmap"]) || "..."}</p>
                        <p style={{ margin: "0" }}><strong>Diện tích:</strong> <span style={{ fontWeight: "bold" }}>{getAttribute(formData, ["dientich", "area"]) ? Number(getAttribute(formData, ["dientich", "area"])).toFixed(1) : "..."} m²</span></p>
                    </div>
                    <p style={{ margin: "4px 0" }}><strong>2. Địa chỉ:</strong> {getAttribute(formData, ["diachi", "address", "dc"]) || "Chưa xác định"}</p>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <p style={{ margin: "0" }}><strong>3. Mục đích sử dụng:</strong> {formData.landType || "Đất ở"}</p>
                        <p style={{ margin: "0" }}><strong>4. Người sử dụng:</strong> <span style={{ textTransform: "uppercase", fontWeight: "bold" }}>{getAttribute(formData, ["tenchu", "ownerName"]) || "Chưa xác định"}</span></p>
                    </div>
                    <p style={{ margin: "4px 0", fontWeight: "bold" }}>5. Sơ đồ thửa đất:</p>
                </div>

                <div style={{ width: "100%", border: "1px solid #000", padding: "5px", marginBottom: "10px", position: "relative", backgroundColor: "#ffffff" }}>
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "380px" }}>
                        <canvas ref={parcelCanvasRef} width={650} height={380} style={{ maxWidth: "100%" }} />
                    </div>
                </div>

                {pdfNoteText && (
                    <div style={{ marginBottom: "10px", padding: "8px 10px", border: "1px dashed #000", fontSize: "12px", fontStyle: "italic", backgroundColor: "#faf7e8" }}>
                        <strong>Ghi chú:</strong> {pdfNoteText}
                    </div>
                )}

                <div style={{ width: "100%", marginBottom: "15px" }}>
                    <p style={{ fontWeight: "bold", fontSize: "13px", marginBottom: "5px", fontStyle: "italic", color: "#000000" }}>6. Bảng kê tọa độ và khoảng cách:</p>
                    {renderTable(firstRows)}
                </div>

                {extraChunks.length === 0 && (
                    <>
                        <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "auto", paddingBottom: "10px" }}>
                            <div style={{ textAlign: "center", width: "120px" }}>
                                {showQr && qrCodeUrl && <img src={qrCodeUrl} alt="QR Verify" style={{ width: "70px", height: "70px", border: "1px solid #000", padding: "1px" }} />}
                                {showQr && <p style={{ fontSize: "8px", color: "#000000", marginTop: "4px", fontStyle: "italic" }}>Quét xác thực</p>}
                            </div>

                            {renderSignerBlock()}
                        </div>

                        <div style={{ paddingTop: "10px", textAlign: "center", fontSize: "9px", color: "#333", borderTop: "0.5px solid #000" }}>
                            Cổng thông tin Địa chính GeoMaster - {pdfFooterText}
                        </div>
                    </>
                )}
            </div>

            {extraChunks.map((chunk, chunkIndex) => {
                const isLastChunk = chunkIndex === extraChunks.length - 1;
                return (
                    <div key={`page-${chunkIndex}`} className="print-page" style={{
                        width: "794px",
                        minHeight: "1123px",
                        padding: "40px 60px",
                        backgroundColor: "#ffffff",
                        color: "#000000",
                        fontFamily: '"Times New Roman", Times, serif',
                        boxSizing: "border-box",
                        display: "flex",
                        flexDirection: "column",
                        position: "relative"
                    }}>
                        <h2 style={{ fontSize: "16px", fontWeight: "bold", margin: "0 0 10px 0", textAlign: "center" }}>
                            BẢNG KÊ TỌA ĐỘ VÀ KHOẢNG CÁCH (TIẾP THEO)
                        </h2>
                        {renderTable(chunk)}

                        {isLastChunk && (
                            <>
                                <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "auto", paddingBottom: "10px" }}>
                                    <div style={{ textAlign: "center", width: "120px" }}>
                                        {showQr && qrCodeUrl && <img src={qrCodeUrl} alt="QR Verify" style={{ width: "70px", height: "70px", border: "1px solid #000", padding: "1px" }} />}
                                        {showQr && <p style={{ fontSize: "8px", color: "#000000", marginTop: "4px", fontStyle: "italic" }}>Quét xác thực</p>}
                                    </div>

                                    {renderSignerBlock()}
                                </div>

                                <div style={{ paddingTop: "10px", textAlign: "center", fontSize: "9px", color: "#333", borderTop: "0.5px solid #000" }}>
                                    Cổng thông tin Địa chính QLDDHCM - {pdfFooterText}
                                </div>
                            </>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default PrintTemplate;
