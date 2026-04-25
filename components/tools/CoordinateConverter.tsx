import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import proj4 from 'proj4';
import { ArrowRightLeft, Upload, FileSpreadsheet, Download, MapPinned, RefreshCw, AlertTriangle, CheckCircle2, Search, ArrowUpDown, MapPin } from 'lucide-react';
import { removeAccents } from '../../utils/helpers';

proj4.defs('EPSG:9210', '+proj=tmerc +lat_0=0 +lon_0=105.75 +k=0.9999 +x_0=500000 +y_0=0 +ellps=WGS84 +towgs84=-191.904,-39.303,-111.450,0,0,0,0 +units=m +no_defs');
proj4.defs('EPSG:32648', '+proj=utm +zone=48 +datum=WGS84 +units=m +no_defs');
proj4.defs('EPSG:32649', '+proj=utm +zone=49 +datum=WGS84 +units=m +no_defs');

const defineVn2000Projection = (code: string, lon0: number) => {
    if (proj4.defs(code)) return;
    proj4.defs(code, `+proj=tmerc +lat_0=0 +lon_0=${lon0} +k=0.9999 +x_0=500000 +y_0=0 +ellps=WGS84 +towgs84=-191.904,-39.303,-111.450,0,0,0,0 +units=m +no_defs`);
};

[
    { code: 'VN2000_103_00', lon0: 103.0 },
    { code: 'VN2000_103_30', lon0: 103.5 },
    { code: 'VN2000_104_00', lon0: 104.0 },
    { code: 'VN2000_104_30', lon0: 104.5 },
    { code: 'VN2000_104_45', lon0: 104.75 },
    { code: 'VN2000_105_00', lon0: 105.0 },
    { code: 'VN2000_105_15', lon0: 105.25 },
    { code: 'VN2000_105_30', lon0: 105.5 },
    { code: 'VN2000_105_45', lon0: 105.75 },
    { code: 'VN2000_106_00', lon0: 106.0 },
    { code: 'VN2000_106_15', lon0: 106.25 },
    { code: 'VN2000_106_30', lon0: 106.5 },
    { code: 'VN2000_107_00', lon0: 107.0 },
    { code: 'VN2000_107_15', lon0: 107.25 },
    { code: 'VN2000_107_30', lon0: 107.5 },
    { code: 'VN2000_107_45', lon0: 107.75 },
    { code: 'VN2000_108_00', lon0: 108.0 },
    { code: 'VN2000_108_15', lon0: 108.25 },
    { code: 'VN2000_108_30', lon0: 108.5 },
    { code: 'VN2000_109_00', lon0: 109.0 }
].forEach((item) => defineVn2000Projection(item.code, item.lon0));

interface ParsedRow {
    [key: string]: string | number | null;
}

interface CoordinateSystemOption {
    code: string;
    label: string;
    hint: string;
}

const CRS_OPTIONS: CoordinateSystemOption[] = [
    { code: 'EPSG:4326', label: 'WGS84 - GPS', hint: 'X = Kinh độ, Y = Vĩ độ' },
    { code: 'EPSG:3857', label: 'Web Mercator', hint: 'Hệ bản đồ web phổ biến' },
    { code: 'EPSG:32648', label: 'UTM WGS84 Zone 48N', hint: 'Phổ biến ở miền Tây, Đông Nam Bộ' },
    { code: 'EPSG:32649', label: 'UTM WGS84 Zone 49N', hint: 'Phổ biến ở miền Trung, Tây Nguyên' },
    { code: 'EPSG:9210', label: 'VN-2000 Hồ Chí Minh / Bình Dương', hint: 'Kinh tuyến trục 105.75' },
    { code: 'VN2000_103_00', label: 'VN-2000 KT 103°00′', hint: 'Lai Châu, Điện Biên' },
    { code: 'VN2000_103_30', label: 'VN-2000 KT 103°30′', hint: 'Lào Cai, Lai Châu, Điện Biên' },
    { code: 'VN2000_104_00', label: 'VN-2000 KT 104°00′', hint: 'Sơn La, Yên Bái, Lào Cai' },
    { code: 'VN2000_104_30', label: 'VN-2000 KT 104°30′', hint: 'Sơn La, Hòa Bình, Thanh Hóa' },
    { code: 'VN2000_104_45', label: 'VN-2000 KT 104°45′', hint: 'Kiên Giang, Cà Mau, Bạc Liêu' },
    { code: 'VN2000_105_00', label: 'VN-2000 KT 105°00′', hint: 'Hà Nội, Bắc Ninh, Hưng Yên, Hà Nam' },
    { code: 'VN2000_105_15', label: 'VN-2000 KT 105°15′', hint: 'Nam Định, Thái Bình, Ninh Bình' },
    { code: 'VN2000_105_30', label: 'VN-2000 KT 105°30′', hint: 'An Giang, Đồng Tháp, Cần Thơ, Vĩnh Long' },
    { code: 'VN2000_105_45', label: 'VN-2000 KT 105°45′', hint: 'TP.HCM, Bình Dương, Đồng Nai, Tây Ninh, Long An' },
    { code: 'VN2000_106_00', label: 'VN-2000 KT 106°00′', hint: 'Bến Tre, Tiền Giang, Trà Vinh, Sóc Trăng' },
    { code: 'VN2000_106_15', label: 'VN-2000 KT 106°15′', hint: 'Bà Rịa - Vũng Tàu, Đồng Nai, Bình Phước' },
    { code: 'VN2000_106_30', label: 'VN-2000 KT 106°30′', hint: 'Bình Thuận, Đồng Nai, Lâm Đồng' },
    { code: 'VN2000_107_00', label: 'VN-2000 KT 107°00′', hint: 'Nghệ An, Hà Tĩnh, Quảng Bình' },
    { code: 'VN2000_107_15', label: 'VN-2000 KT 107°15′', hint: 'Quảng Trị, Thừa Thiên Huế' },
    { code: 'VN2000_107_30', label: 'VN-2000 KT 107°30′', hint: 'Đà Nẵng, Quảng Nam, Kon Tum' },
    { code: 'VN2000_107_45', label: 'VN-2000 KT 107°45′', hint: 'Quảng Ngãi, Gia Lai, Kon Tum' },
    { code: 'VN2000_108_00', label: 'VN-2000 KT 108°00′', hint: 'Bình Định, Phú Yên, Gia Lai' },
    { code: 'VN2000_108_15', label: 'VN-2000 KT 108°15′', hint: 'Khánh Hòa, Đắk Lắk, Đắk Nông' },
    { code: 'VN2000_108_30', label: 'VN-2000 KT 108°30′', hint: 'Ninh Thuận, Khánh Hòa, Lâm Đồng' },
    { code: 'VN2000_109_00', label: 'VN-2000 KT 109°00′', hint: 'Khánh Hòa, Ninh Thuận, Bình Thuận' },
    { code: 'VN2000_CUSTOM', label: 'VN-2000 tùy chỉnh kinh tuyến trục', hint: 'Tự nhập lon_0 theo hồ sơ đo đạc của tỉnh' }
];

const isNumericLike = (value: unknown) => {
    if (value === null || value === undefined || value === '') return false;
    const normalized = String(value).replace(/\s+/g, '').replace(',', '.');
    return normalized !== '' && !Number.isNaN(Number(normalized));
};

const toNumber = (value: unknown) => {
    if (!isNumericLike(value)) return null;
    return Number(String(value).replace(/\s+/g, '').replace(',', '.'));
};

const detectCoordinateColumns = (headers: string[]) => {
    const normalized = headers.map((header) => ({
        raw: header,
        key: removeAccents(String(header || '').toLowerCase())
    }));

    const findFirst = (keywords: string[]) => normalized.find((item) => keywords.some((kw) => item.key.includes(kw)))?.raw || '';

    const x = findFirst(['kinhdo', 'longitude', 'long', 'lng', 'lon', 'toaadox', 'toa do x', 'x']);
    const y = findFirst(['vido', 'latitude', 'lat', 'toaadoy', 'toa do y', 'y']);

    return { x, y };
};

const resolveProjectionCode = (selectedCode: string, customMeridian: string, prefix: 'SRC' | 'DST') => {
    if (selectedCode !== 'VN2000_CUSTOM') return selectedCode;

    const lon0 = Number(customMeridian);
    if (!Number.isFinite(lon0)) return '';

    const customCode = `VN2000_${prefix}_${String(customMeridian).replace(/\./g, '_')}`;
    defineVn2000Projection(customCode, lon0);
    return customCode;
};

const CoordinateConverter: React.FC = () => {
    const [fileName, setFileName] = useState('');
    const [rows, setRows] = useState<ParsedRow[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [xColumn, setXColumn] = useState('');
    const [yColumn, setYColumn] = useState('');
    const [sourceCrs, setSourceCrs] = useState('EPSG:4326');
    const [targetCrs, setTargetCrs] = useState('EPSG:9210');
    const [sourceCustomMeridian, setSourceCustomMeridian] = useState('105.75');
    const [targetCustomMeridian, setTargetCustomMeridian] = useState('105.75');
    const [provinceQuery, setProvinceQuery] = useState('');
    const [provinceTarget, setProvinceTarget] = useState<'SRC' | 'DST'>('DST');
    const [error, setError] = useState('');

    // Single-point manual conversion state
    const [singleX, setSingleX] = useState('');
    const [singleY, setSingleY] = useState('');
    const [singleResult, setSingleResult] = useState<{ x: string; y: string } | null>(null);
    const [singleError, setSingleError] = useState('');

    const handleSwapCrs = () => {
        setSourceCrs(targetCrs);
        setTargetCrs(sourceCrs);
        setSourceCustomMeridian(targetCustomMeridian);
        setTargetCustomMeridian(sourceCustomMeridian);
    };

    const handleSingleConvert = () => {
        setSingleError('');
        setSingleResult(null);
        const x = toNumber(singleX);
        const y = toNumber(singleY);
        if (x === null || y === null) {
            setSingleError('Vui lòng nhập giá trị X và Y hợp lệ.');
            return;
        }
        const srcCode = resolveProjectionCode(sourceCrs, sourceCustomMeridian, 'SRC');
        const dstCode = resolveProjectionCode(targetCrs, targetCustomMeridian, 'DST');
        if (!srcCode || !dstCode) {
            setSingleError('Hệ tọa độ chưa hợp lệ.');
            return;
        }
        try {
            const [rx, ry] = proj4(srcCode, dstCode, [x, y]);
            setSingleResult({ x: rx.toFixed(6), y: ry.toFixed(6) });
        } catch {
            setSingleError('Không thể chuyển đổi. Kiểm tra lại giá trị và hệ tọa độ.');
        }
    };

    const provincePresetOptions = useMemo(() => {
        const presetOptions = CRS_OPTIONS.filter((option) => option.code.startsWith('VN2000_') || option.code === 'EPSG:9210');
        const normalizedQuery = removeAccents(provinceQuery || '').trim();

        if (!normalizedQuery) {
            return presetOptions.slice(0, 10);
        }

        return presetOptions.filter((option) => removeAccents(`${option.label} ${option.hint}`).includes(normalizedQuery));
    }, [provinceQuery]);

    const convertedRows = useMemo(() => {
        if (!rows.length || !xColumn || !yColumn) return [] as ParsedRow[];

        const sourceProjectionCode = resolveProjectionCode(sourceCrs, sourceCustomMeridian, 'SRC');
        const targetProjectionCode = resolveProjectionCode(targetCrs, targetCustomMeridian, 'DST');

        if (!sourceProjectionCode || !targetProjectionCode) return [] as ParsedRow[];

        return rows.map((row, index) => {
            const x = toNumber(row[xColumn]);
            const y = toNumber(row[yColumn]);

            if (x === null || y === null) {
                return {
                    ...row,
                    converted_x: '',
                    converted_y: '',
                    conversion_status: 'Dòng không hợp lệ'
                };
            }

            try {
                const [nextX, nextY] = proj4(sourceProjectionCode, targetProjectionCode, [x, y]);
                return {
                    ...row,
                    converted_x: Number(nextX.toFixed(6)),
                    converted_y: Number(nextY.toFixed(6)),
                    conversion_status: 'OK',
                    row_index: index + 1
                };
            } catch {
                return {
                    ...row,
                    converted_x: '',
                    converted_y: '',
                    conversion_status: 'Lỗi chuyển đổi'
                };
            }
        });
    }, [rows, xColumn, yColumn, sourceCrs, targetCrs, sourceCustomMeridian, targetCustomMeridian]);

    const successCount = convertedRows.filter((row) => row.conversion_status === 'OK').length;

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setError('');
        setFileName(file.name);

        try {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const firstSheet = workbook.Sheets[firstSheetName];
            const json = XLSX.utils.sheet_to_json<ParsedRow>(firstSheet, { defval: '' });

            if (!json.length) {
                setRows([]);
                setHeaders([]);
                setError('File Excel không có dữ liệu để xử lý.');
                return;
            }

            const nextHeaders = Object.keys(json[0]);
            const detected = detectCoordinateColumns(nextHeaders);
            const numericCandidates = nextHeaders.filter((header) => json.some((row) => isNumericLike(row[header])));

            setRows(json);
            setHeaders(nextHeaders);
            setXColumn(detected.x || numericCandidates[0] || nextHeaders[0] || '');
            setYColumn(detected.y || numericCandidates[1] || nextHeaders[1] || '');
        } catch (err) {
            console.error(err);
            setRows([]);
            setHeaders([]);
            setError('Không thể đọc file. Vui lòng dùng định dạng XLSX, XLS hoặc CSV.');
        }
    };

    const handleDownload = () => {
        if (!convertedRows.length) return;
        const worksheet = XLSX.utils.json_to_sheet(convertedRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Converted');
        XLSX.writeFile(workbook, `chuyen_he_toa_do_${Date.now()}.xlsx`);
    };

    const previewRows = convertedRows.slice(0, 20);

    return (
        <div className="p-6 md:p-8 bg-slate-950 absolute inset-0 overflow-y-auto animate-in fade-in duration-500">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-6">
                    <div className="flex items-center gap-4">
                        <div className="bg-emerald-600/15 p-4 rounded-3xl border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                            <ArrowRightLeft className="text-emerald-400 w-8 h-8" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">Chuyển đổi hệ tọa độ từ Excel</h1>
                            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Tải file lên, chọn cột X/Y và xuất kết quả đã chuyển đổi</p>
                        </div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-[11px] text-slate-300 font-bold">
                        Hỗ trợ: XLSX, XLS, CSV
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                    <div className="xl:col-span-2 space-y-6">
                        <div className="bg-slate-900 rounded-[2rem] border border-slate-800 p-6 shadow-2xl">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">
                                1. Tải file Excel
                            </label>
                            <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-[1.5rem] p-6 text-center cursor-pointer transition-all bg-slate-950/60">
                                <Upload className="text-emerald-400" size={28} />
                                <div>
                                    <div className="text-sm font-black text-white">Chọn file dữ liệu tọa độ</div>
                                    <div className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Bấm để tải file từ máy tính</div>
                                </div>
                                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
                            </label>

                            {fileName && (
                                <div className="mt-4 flex items-center gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3">
                                    <FileSpreadsheet className="text-emerald-400 shrink-0" size={18} />
                                    <div className="min-w-0">
                                        <div className="text-[10px] uppercase tracking-widest text-emerald-300 font-black">Đã nhận file</div>
                                        <div className="text-sm text-white font-bold truncate">{fileName}</div>
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-red-300">
                                    <AlertTriangle size={16} className="shrink-0" />
                                    <span className="text-sm font-bold">{error}</span>
                                </div>
                            )}
                        </div>

                        <div className="bg-slate-900 rounded-[2rem] border border-slate-800 p-6 shadow-2xl space-y-4">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                2. Cấu hình chuyển đổi
                            </label>

                            <div className="space-y-2">
                                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Tìm nhanh theo tỉnh/thành</div>
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400" />
                                    <input
                                        value={provinceQuery}
                                        onChange={(e) => setProvinceQuery(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 pl-10 text-white font-bold outline-none"
                                        placeholder="Ví dụ: Đồng Nai, Cần Thơ, Đà Nẵng..."
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setProvinceTarget('SRC')}
                                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${provinceTarget === 'SRC' ? 'bg-blue-600/20 border-blue-500/50 text-blue-300' : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                                    >
                                        Áp vào hệ nguồn
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setProvinceTarget('DST')}
                                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${provinceTarget === 'DST' ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300' : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                                    >
                                        Áp vào hệ đích
                                    </button>
                                </div>
                                <div className="max-h-44 overflow-y-auto space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-2">
                                    {provincePresetOptions.length === 0 ? (
                                        <div className="px-3 py-2 text-sm text-slate-400">Không tìm thấy tỉnh/thành phù hợp.</div>
                                    ) : provincePresetOptions.map((option) => (
                                        <button
                                            key={option.code}
                                            type="button"
                                            onClick={() => {
                                                if (provinceTarget === 'SRC') {
                                                    setSourceCrs(option.code);
                                                } else {
                                                    setTargetCrs(option.code);
                                                }
                                                setProvinceQuery(option.hint.split(',')[0] || option.label);
                                            }}
                                            className={`w-full text-left px-3 py-2 rounded-lg transition-all border ${
                                                (provinceTarget === 'SRC' ? sourceCrs : targetCrs) === option.code
                                                    ? 'bg-emerald-600/20 border-emerald-500/40 text-white'
                                                    : 'bg-slate-900 border-slate-800 text-slate-200 hover:border-emerald-500/30 hover:bg-slate-800'
                                            }`}
                                        >
                                            <div className="text-[11px] font-black uppercase tracking-wide">{option.label}</div>
                                            <div className="text-[10px] text-slate-400 mt-1">{option.hint}</div>
                                        </button>
                                    ))}
                                </div>
                                <div className="text-[10px] text-emerald-300 font-bold">Chọn hệ nguồn/đích rồi bấm gợi ý để áp nhanh.</div>
                            </div>

                            <div className="space-y-2">
                                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Hệ nguồn</div>
                                <select value={sourceCrs} onChange={(e) => setSourceCrs(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-bold outline-none">
                                    {CRS_OPTIONS.map((option) => (
                                        <option key={option.code} value={option.code}>{option.label}</option>
                                    ))}
                                </select>
                                {sourceCrs === 'VN2000_CUSTOM' && (
                                    <input
                                        value={sourceCustomMeridian}
                                        onChange={(e) => setSourceCustomMeridian(e.target.value)}
                                        className="w-full bg-slate-950 border border-emerald-700 rounded-xl p-3 text-white font-bold outline-none"
                                        placeholder="Ví dụ: 105.75"
                                    />
                                )}
                            </div>

                            <div className="flex justify-center">
                                <button
                                    type="button"
                                    onClick={handleSwapCrs}
                                    title="Hoán đổi hệ nguồn và hệ đích"
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white hover:border-emerald-500/50 transition-all text-[10px] font-black uppercase tracking-widest"
                                >
                                    <ArrowUpDown size={14} /> Hoán đổi nguồn / đích
                                </button>
                            </div>

                            <div className="space-y-2">
                                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Hệ đích</div>
                                <select value={targetCrs} onChange={(e) => setTargetCrs(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-bold outline-none">
                                    {CRS_OPTIONS.map((option) => (
                                        <option key={option.code} value={option.code}>{option.label}</option>
                                    ))}
                                </select>
                                {targetCrs === 'VN2000_CUSTOM' && (
                                    <input
                                        value={targetCustomMeridian}
                                        onChange={(e) => setTargetCustomMeridian(e.target.value)}
                                        className="w-full bg-slate-950 border border-emerald-700 rounded-xl p-3 text-white font-bold outline-none"
                                        placeholder="Ví dụ: 105.75"
                                    />
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Cột X</div>
                                    <select value={xColumn} onChange={(e) => setXColumn(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-bold outline-none">
                                        <option value="">Chọn cột</option>
                                        {headers.map((header) => <option key={header} value={header}>{header}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Cột Y</div>
                                    <select value={yColumn} onChange={(e) => setYColumn(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-bold outline-none">
                                        <option value="">Chọn cột</option>
                                        {headers.map((header) => <option key={header} value={header}>{header}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-4 text-sm text-slate-300 leading-relaxed space-y-1">
                                <div className="font-black text-white mb-1">Gợi ý</div>
                                <div>{CRS_OPTIONS.find((item) => item.code === sourceCrs)?.hint}</div>
                                {targetCrs === 'VN2000_CUSTOM' || sourceCrs === 'VN2000_CUSTOM' ? (
                                    <div className="text-emerald-300 text-xs">Bạn có thể nhập trực tiếp kinh tuyến trục của địa phương nếu hồ sơ kỹ thuật yêu cầu riêng.</div>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    <div className="xl:col-span-3 space-y-6">
                        {/* Single-point conversion */}
                        <div className="bg-slate-900 rounded-[2rem] border border-slate-800 p-6 shadow-2xl space-y-4">
                            <div className="flex items-center gap-3">
                                <MapPin size={16} className="text-emerald-400 shrink-0" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Chuyển đổi tọa độ đơn lẻ (nhập tay)</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-black">X (kinh độ / Easting)</div>
                                    <input
                                        value={singleX}
                                        onChange={(e) => setSingleX(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-bold outline-none focus:border-emerald-500 transition-colors"
                                        placeholder="Ví dụ: 106.660172"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Y (vĩ độ / Northing)</div>
                                    <input
                                        value={singleY}
                                        onChange={(e) => setSingleY(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-bold outline-none focus:border-emerald-500 transition-colors"
                                        placeholder="Ví dụ: 10.762622"
                                    />
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleSingleConvert}
                                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                            >
                                <ArrowRightLeft size={14} /> Chuyển đổi ngay
                            </button>
                            {singleError && (
                                <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-red-300">
                                    <AlertTriangle size={14} className="shrink-0" />
                                    <span className="text-sm font-bold">{singleError}</span>
                                </div>
                            )}
                            {singleResult && (
                                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-[10px] uppercase tracking-widest text-emerald-300 font-black mb-1">X kết quả</div>
                                        <div className="text-white font-black text-lg select-all">{singleResult.x}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] uppercase tracking-widest text-emerald-300 font-black mb-1">Y kết quả</div>
                                        <div className="text-white font-black text-lg select-all">{singleResult.y}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Tổng số dòng</div>
                                <div className="text-2xl font-black text-white mt-2">{rows.length}</div>
                            </div>
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Chuyển thành công</div>
                                <div className="text-2xl font-black text-emerald-400 mt-2">{successCount}</div>
                            </div>
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Xuất kết quả</div>
                                    <div className="text-sm text-white font-bold mt-2">Tải file Excel mới</div>
                                </div>
                                <button
                                    onClick={handleDownload}
                                    disabled={!convertedRows.length}
                                    className="px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-400 text-white font-black text-[10px] uppercase tracking-widest transition-all"
                                >
                                    <Download size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="bg-slate-900 rounded-[2rem] border border-slate-800 p-6 shadow-2xl">
                            <div className="flex items-center justify-between gap-3 mb-4">
                                <div>
                                    <h3 className="text-lg font-black text-white">Bảng xem trước kết quả</h3>
                                    <p className="text-slate-400 text-sm">Hiển thị tối đa 20 dòng đầu sau khi chuyển đổi</p>
                                </div>
                                {convertedRows.length > 0 && (
                                    <div className="flex items-center gap-2 text-emerald-300 text-sm font-bold">
                                        <CheckCircle2 size={16} /> Sẵn sàng tải xuống
                                    </div>
                                )}
                            </div>

                            {previewRows.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-slate-700 p-10 text-center bg-slate-950/60">
                                    <MapPinned className="mx-auto text-slate-500 mb-3" size={30} />
                                    <div className="text-white font-black mb-2">Chưa có dữ liệu chuyển đổi</div>
                                    <div className="text-slate-400 text-sm">Hãy tải file Excel và chọn đúng cột tọa độ X/Y.</div>
                                </div>
                            ) : (
                                <div className="overflow-auto max-h-96 rounded-2xl border border-slate-800">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-slate-950 text-slate-300">
                                            <tr>
                                                {Object.keys(previewRows[0]).map((key) => (
                                                    <th key={key} className="px-3 py-2 text-left font-black uppercase text-[10px] tracking-wider whitespace-nowrap">{key}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {previewRows.map((row, idx) => (
                                                <tr key={idx} className="border-t border-slate-800 odd:bg-slate-900 even:bg-slate-950/60">
                                                    {Object.keys(previewRows[0]).map((key) => (
                                                        <td key={key} className="px-3 py-2 text-slate-200 whitespace-nowrap">
                                                            {(row as ParsedRow)[key] as React.ReactNode}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        <div className="bg-slate-900 rounded-[2rem] border border-slate-800 p-5 flex items-start gap-3 text-slate-300">
                            <RefreshCw size={18} className="text-blue-400 shrink-0 mt-0.5" />
                            <div className="text-sm leading-relaxed">
                                Nếu file gốc dùng GPS, hãy đặt X là kinh độ và Y là vĩ độ. Sau khi chuyển đổi, hệ thống sẽ thêm hai cột mới là converted_x và converted_y.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CoordinateConverter;
