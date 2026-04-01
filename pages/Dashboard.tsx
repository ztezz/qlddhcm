
import React, { useEffect, useState, useRef } from 'react';
import { statsService } from '../services/mockBackend';
import { DashboardStats, User } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Sector, LineChart, Line } from 'recharts';
import { FileText, Download, RefreshCw, DollarSign, Scaling, Building, ChevronRight, Activity, Loader2, AlertTriangle, ListFilter, Wifi, Image, ArrowUpRight, ArrowDownRight, Minus, PieChart as PieChartIcon, Table2, CalendarDays, RotateCcw, Braces } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { toBlob } from 'html-to-image';

const COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#3b82f6', '#475569'];

const MOCK_FALLBACK: DashboardStats = {
    totalParcels: 12450,
    totalArea: 450200,
    totalValue: 21800000000,
    parcelsByType: [
        { name: 'Đất ở đô thị', value: 4500 },
        { name: 'Đất nông nghiệp', value: 3200 },
        { name: 'Đất trồng cây lâu năm', value: 2100 },
        { name: 'Đất sản xuất kinh doanh', value: 1500 },
        { name: 'Đất tôn giáo', value: 450 },
        { name: 'Đất công trình công cộng', value: 700 }
    ],
    valueByBranch: [
        { name: 'Phường Hiệp Thành', value: 2400 },
        { name: 'Phường Phú Lợi', value: 2100 },
        { name: 'Phường Phú Hòa', value: 1950 },
        { name: 'Phường Phú Mỹ', value: 1800 },
        { name: 'Phường Phú Cường', value: 1600 }
    ]
};

interface DashboardProps {
    user: User;
}

const renderActiveShape = (props: any) => {
  const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload } = props;
  return (
    <g>
      <text x={cx} y={cy} dy={8} textAnchor="middle" fill="#fff" className="font-display font-black text-lg uppercase tracking-tighter">
        {payload.name}
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 10} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} startAngle={startAngle} endAngle={endAngle} innerRadius={outerRadius + 14} outerRadius={outerRadius + 18} fill={fill} opacity={0.3} />
    </g>
  );
};

const TinySparkline: React.FC<{ values: number[]; stroke: string }> = ({ values, stroke }) => {
    const data = values.map((value, index) => ({ index, value }));
    return (
        <div className="h-10 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
                    <Line
                        type="monotone"
                        dataKey="value"
                        stroke={stroke}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

const TrendBadge: React.FC<{ direction: 'up' | 'down' | 'flat'; label: string }> = ({ direction, label }) => {
    if (direction === 'up') {
        return (
            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <ArrowUpRight size={11} /> {label} so với kỳ trước
            </span>
        );
    }
    if (direction === 'down') {
        return (
            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                <ArrowDownRight size={11} /> {label} so với kỳ trước
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full bg-gray-500/20 text-gray-300 border border-gray-500/30">
            <Minus size={11} /> {label} so với kỳ trước
        </span>
    );
};

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
    const [previousStats, setPreviousStats] = useState<DashboardStats | null>(null);
    const [timePreset, setTimePreset] = useState<'all' | '7d' | '30d' | '90d' | 'custom'>('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [branchLimit, setBranchLimit] = useState<0 | 5 | 10>(5);
    const [branchSort, setBranchSort] = useState<'value-desc' | 'value-asc' | 'name-asc'>('value-desc');
    const [typeQuery, setTypeQuery] = useState('');
    const [typeView, setTypeView] = useState<'chart' | 'table'>('chart');
    const [kpiHistory, setKpiHistory] = useState<Array<{ ts: number; totalParcels: number; totalArea: number; totalValue: number }>>([]);
    const [movingAverageWindow, setMovingAverageWindow] = useState<2 | 3 | 5>(3);
    const [trendVisibility, setTrendVisibility] = useState({
        parcels: true,
        area: true,
        value: true,
        movingAverage: true
    });
  const dashboardRef = useRef<HTMLDivElement>(null);

  const exportFileBase = () => `ThongKe_${new Date().toISOString().replace(/[:.]/g, '-')}`;

  const downloadBlob = (blob: Blob, fileName: string) => {
      const nav = window.navigator as Navigator & { msSaveOrOpenBlob?: (b: Blob, n?: string) => boolean };
      if (typeof nav.msSaveOrOpenBlob === 'function') {
          nav.msSaveOrOpenBlob(blob, fileName);
          return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Delay revocation to avoid race conditions in some browsers.
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const safeExcelCell = (value: unknown) => {
      const raw = value === null || value === undefined ? '' : String(value);
      const escaped = raw.replace(/"/g, '""');
      const dangerous = /^[=+\-@]/.test(escaped.trim());
      const safe = dangerous ? `'${escaped}` : escaped;
      return `"${safe}"`;
  };

  const blobToDataUrl = async (blob: Blob) => {
      return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
              if (typeof reader.result === 'string') resolve(reader.result);
              else reject(new Error('Cannot convert blob to data URL'));
          };
          reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
          reader.readAsDataURL(blob);
      });
  };

  const captureDashboardBlob = async (pixelRatio = 2) => {
      if (!dashboardRef.current) {
          throw new Error('Dashboard reference not found');
      }

      const element = dashboardRef.current;
      const orbs = element.querySelectorAll('.animate-orb-move');
      const hiddenSnapshot: Array<{ el: HTMLElement; display: string }> = [];

      // Hide heavy animated layers before capture to reduce rendering failures.
      orbs.forEach((orb) => {
          const el = orb as HTMLElement;
          hiddenSnapshot.push({ el, display: el.style.display });
          el.style.display = 'none';
      });

      try {
          const blob = await toBlob(element, {
              pixelRatio,
              cacheBust: true,
              skipFonts: true,
              backgroundColor: '#0B0C10',
              style: {
                  transform: 'none',
                  isolation: 'isolate'
              }
          });

          if (!blob) {
              throw new Error('Capture failed: cannot create image blob');
          }
          return blob;
      } finally {
          hiddenSnapshot.forEach(({ el, display }) => {
              el.style.display = display;
          });
      }
  };

      const getTimeParams = () => {
          if (timePreset === 'custom') {
              return {
                  from: dateFrom || undefined,
                  to: dateTo || undefined
              };
          }
          return { period: timePreset };
      };

  const fetchStats = async () => {
    try {
        setLoading(true);
        setErrorMessage(null);
                const data = await statsService.getDashboardStats(getTimeParams());
        const resolvedStats = (!data || data.totalParcels === 0) ? MOCK_FALLBACK : data;

        if (stats) {
            setPreviousStats(stats);
        }

        if (!data || data.totalParcels === 0) {
            setErrorMessage('Không lấy được dữ liệu thực tế, hệ thống đang hiển thị dữ liệu mẫu để không gián đoạn theo dõi.');
        } else {
            setErrorMessage(null);
        }
        setStats(resolvedStats);
        setKpiHistory(prev => {
            const next = [...prev, {
                ts: Date.now(),
                totalParcels: resolvedStats.totalParcels,
                totalArea: resolvedStats.totalArea,
                totalValue: resolvedStats.totalValue
            }];
            return next.slice(-12);
        });
        setLastUpdated(new Date());
    } catch (err: any) {
        if (stats) {
            setPreviousStats(stats);
        }
        setStats(MOCK_FALLBACK);
        setErrorMessage('Kết nối máy chủ thống kê thất bại. Hệ thống đã tự động chuyển sang dữ liệu mẫu.');
    } finally {
        setTimeout(() => setLoading(false), 500); 
    }
  };

  useEffect(() => {
    fetchStats();
        if (!autoRefresh) return;
        const interval = setInterval(fetchStats, 60000); 
    return () => clearInterval(interval);
        }, [user, autoRefresh, timePreset]);

  // EXPORT TO EXCEL/CSV (an toàn và bám theo dữ liệu đang lọc)
  const handleExportExcel = async () => {
    setIsExporting('EXCEL');
    try {
        const exportedAt = new Date().toLocaleString('vi-VN');
        const selectedPeriod = timePreset === 'custom' ? `Tùy chọn (${dateFrom || '...'} -> ${dateTo || '...'})` : timePreset;
        const sourceStats = stats || MOCK_FALLBACK;

        const rows = [
            ['BAO CAO THONG KE QUAN LY DAT DAI - GEOMASTER'],
            ['Chi nhanh', user.branchId || 'Tru so chinh'],
            ['Thoi diem xuat', exportedAt],
            ['Bo loc thoi gian', selectedPeriod],
            ['Che do loai dat', typeView === 'chart' ? 'Bieu do' : 'Bang'],
            ['Tu khoa loc loai dat', typeQuery || '(khong)'],
            ['Bo loc khu vuc', branchLimit === 0 ? 'Tat ca' : `Top ${branchLimit}`],
            ['Sap xep khu vuc', branchSort],
            [''],
            ['--- CHI SO TONG QUAN ---'],
            ['Chi tieu', 'Gia tri', 'Don vi'],
            ['Tong so thua dat', sourceStats.totalParcels, 'Thua'],
            ['Tong dien tich', sourceStats.totalArea.toFixed(2), 'm2'],
            ['Gia tri tich luy (tam tinh)', sourceStats.totalValue, 'VND'],
            [''],
            ['--- CO CAU LOAI DAT (DU LIEU DANG LOC) ---'],
            ['Loai dat', 'So luong thua', 'Ty trong (%)'],
            ...filteredTypeData.map(item => [
                item.name,
                item.value,
                totalTypeParcels > 0 ? ((item.value / totalTypeParcels) * 100).toFixed(2) : '0.00'
            ]),
            [''],
            ['--- MAT DO THEO KHU VUC (DU LIEU DANG LOC) ---'],
            ['Ten khu vuc/phan khu', 'So luong thua'],
            ...filteredBranchData.map(item => [item.name, item.value])
        ];

        let csvContent = '\uFEFF';
        rows.forEach((rowArray) => {
            csvContent += rowArray.map(safeExcelCell).join(',') + '\r\n';
        });

        downloadBlob(
            new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }),
            `${exportFileBase()}.csv`
        );
    } catch (error) {
        console.error('CSV Export Error:', error);
        alert('Khong the xuat file CSV. Vui long thu lai.');
    } finally {
        setIsExporting(null);
    }
  };

  // EXPORT TO PDF - Fixed Blur & Ghosting Issues
  const handleExportPDF = async () => {
    if (!dashboardRef.current) return;
    setIsExporting('PDF');

    try {
        const imageBlob = await captureDashboardBlob(2);
        const imgData = await blobToDataUrl(imageBlob);

        // Decode once to compute dimensions reliably.
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new window.Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Cannot decode captured image'));
            img.src = imgData;
        });

        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pdfWidth;
        const imgHeight = (image.height * pdfWidth) / image.width;

        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
            heightLeft -= pdfHeight;
        }
        pdf.save(`${exportFileBase()}.pdf`);
    } catch (error) {
        console.error("PDF Export Error:", error);
        alert("Có lỗi khi tạo PDF. Hệ thống đã được ghi nhận lỗi.");
    } finally {
        setIsExporting(null);
    }
  };

  const handleExportPNG = async () => {
    if (!dashboardRef.current) return;
    setIsExporting('PNG');

    try {
        const blob = await captureDashboardBlob(2);
        downloadBlob(blob, `${exportFileBase()}.png`);
    } catch (error) {
        console.error('PNG Export Error:', error);
        alert('Có lỗi khi xuất ảnh PNG.');
    } finally {
        setIsExporting(null);
    }
  };

  const handleExportJSON = async () => {
    setIsExporting('JSON');
    try {
        const payload = {
            metadata: {
                exportedAt: new Date().toISOString(),
                branchId: user.branchId || null,
                timePreset,
                dateFrom: dateFrom || null,
                dateTo: dateTo || null,
                branchLimit,
                branchSort,
                typeQuery,
                typeView,
                movingAverageWindow,
                trendVisibility
            },
            overview: stats || MOCK_FALLBACK,
            filtered: {
                landTypes: filteredTypeData,
                branches: filteredBranchData
            },
            trend: trendChartData
        };

        const content = JSON.stringify(payload, null, 2);
        downloadBlob(new Blob([content], { type: 'application/json;charset=utf-8;' }), `${exportFileBase()}.json`);
    } catch (error) {
        console.error('JSON Export Error:', error);
        alert('Khong the xuat file JSON. Vui long thu lai.');
    } finally {
        setIsExporting(null);
    }
  };

  if (loading && !stats) return (
      <div className="p-8 flex h-full items-center justify-center flex-col gap-4 bg-[#0B0C10] mesh-bg animate-mesh">
          <RefreshCw className="animate-spin w-10 h-10 text-cyan-500" />
          <p className="text-cyan-400 font-display font-black uppercase tracking-[0.3em] text-[10px]">Đang truy xuất hệ thống...</p>
      </div>
  );

  const displayStats = stats || MOCK_FALLBACK;
  const branchDataSorted = [...displayStats.valueByBranch].sort((a, b) => {
      if (branchSort === 'value-asc') return a.value - b.value;
      if (branchSort === 'name-asc') return a.name.localeCompare(b.name, 'vi');
      return b.value - a.value;
  });
  const filteredBranchData = branchLimit === 0 ? branchDataSorted : branchDataSorted.slice(0, branchLimit);
  const dominantType = [...displayStats.parcelsByType].sort((a, b) => b.value - a.value)[0];
  const avgAreaPerParcel = displayStats.totalParcels > 0 ? displayStats.totalArea / displayStats.totalParcels : 0;
  const formatCompactCurrency = (value: number) => new Intl.NumberFormat('vi-VN', { notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 1 }).format(value);
  const typeFilter = typeQuery.trim().toLowerCase();
  const filteredTypeData = displayStats.parcelsByType.filter(item => item.name.toLowerCase().includes(typeFilter));
  const totalTypeParcels = displayStats.parcelsByType.reduce((acc, cur) => acc + cur.value, 0);
    const parcelsHistoryValues = kpiHistory.map(item => item.totalParcels);
    const areaHistoryValues = kpiHistory.map(item => item.totalArea);
    const valueHistoryValues = kpiHistory.map(item => item.totalValue);
    const movingAverageAt = (values: number[], index: number, windowSize: number) => {
        if (index < windowSize - 1) return null;
        const slice = values.slice(index - windowSize + 1, index + 1);
        return slice.reduce((acc, cur) => acc + cur, 0) / windowSize;
    };

    const trendChartData = kpiHistory.map((item, index) => {
        const maParcels = movingAverageAt(parcelsHistoryValues, index, movingAverageWindow);
        const maArea = movingAverageAt(areaHistoryValues, index, movingAverageWindow);
        const maValue = movingAverageAt(valueHistoryValues, index, movingAverageWindow);
        return {
            time: new Date(item.ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            totalParcels: item.totalParcels,
            totalArea: Math.round(item.totalArea),
            totalValueBillion: Number((item.totalValue / 1e9).toFixed(2)),
            totalParcelsMA: maParcels ? Math.round(maParcels) : null,
            totalAreaMA: maArea ? Math.round(maArea) : null,
            totalValueBillionMA: maValue ? Number((maValue / 1e9).toFixed(2)) : null
        };
    });

  const getTrend = (current: number, previous: number | null) => {
      if (previous === null || previous === 0) {
          return { direction: 'flat' as const, label: 'N/A' };
      }
      const delta = current - previous;
      const pct = Math.abs((delta / previous) * 100);
      if (delta > 0) return { direction: 'up' as const, label: `+${pct.toFixed(1)}%` };
      if (delta < 0) return { direction: 'down' as const, label: `-${pct.toFixed(1)}%` };
      return { direction: 'flat' as const, label: '0.0%' };
  };

  const cardTheme = {
      blue: {
          line: 'bg-blue-500',
          iconWrap: 'bg-blue-500/20 text-blue-400',
          activity: 'text-blue-500'
      },
      purple: {
          line: 'bg-violet-500',
          iconWrap: 'bg-violet-500/20 text-violet-400',
          activity: 'text-violet-500'
      },
      cyan: {
          line: 'bg-cyan-500',
          iconWrap: 'bg-cyan-500/20 text-cyan-400',
          activity: 'text-cyan-500'
      }
  } as const;

  return (
    <div id="dashboard-export-root" ref={dashboardRef} className="relative p-6 bg-[#0B0C10] mesh-bg animate-mesh min-h-full text-white overflow-x-hidden overflow-y-auto h-full custom-scrollbar">
      
      {/* BACKGROUND DECORATION */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0 decoration-layers">
          <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full animate-orb-move"></div>
          <div className="absolute bottom-[0%] right-[-5%] w-[30%] h-[30%] bg-purple-600/10 blur-[100px] rounded-full animate-orb-move" style={{ animationDelay: '-8s' }}></div>
      </div>

      {/* HEADER SECTION */}
      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 animate-reveal-up pl-12 md:pl-0">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 font-black text-[9px] uppercase tracking-[0.3em] mb-1">
             <div className="w-1 h-1 rounded-full bg-cyan-500 shadow-[0_0_8px_#22d3ee] animate-pulse"></div>
             Khai thác dữ liệu thời gian thực
          </div>
          <h2 className="text-3xl font-black tracking-tighter uppercase font-display bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            Hệ thống Thống kê
          </h2>
          <div className="text-gray-500 text-[10px] flex items-center gap-2 mt-2 font-bold">
            <span className="bg-white/5 border border-white/10 px-3 py-1 rounded-lg text-gray-400 backdrop-blur-md uppercase">
                SYNC: {lastUpdated.toLocaleTimeString()}
            </span>
            <ChevronRight size={12} className="text-blue-500" />
            <span className="font-black text-blue-400 uppercase tracking-widest">{user.branchId}</span>
          </div>
        </div>
        <div className="flex gap-2 export-buttons">
                    <button
                        onClick={fetchStats}
                        disabled={loading || !!isExporting}
                        className="flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-sky-600 px-4 py-2 rounded-xl text-[10px] font-black transition-all shadow-xl active:scale-95 disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> LÀM MỚI
                    </button>
          <button 
            onClick={handleExportExcel}
            disabled={!!isExporting}
            className="flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-emerald-600 px-4 py-2 rounded-xl text-[10px] font-black transition-all shadow-xl active:scale-95 group disabled:opacity-50"
          >
            {isExporting === 'EXCEL' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} EXCEL
          </button>
          <button 
            onClick={handleExportPDF}
            disabled={!!isExporting}
            className="flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-rose-600 px-4 py-2 rounded-xl text-[10px] font-black transition-all shadow-xl active:scale-95 group disabled:opacity-50"
          >
            {isExporting === 'PDF' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} PDF
          </button>
                    <button
                        onClick={handleExportPNG}
                        disabled={!!isExporting}
                        className="flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-indigo-600 px-4 py-2 rounded-xl text-[10px] font-black transition-all shadow-xl active:scale-95 group disabled:opacity-50"
                    >
                        {isExporting === 'PNG' ? <Loader2 size={14} className="animate-spin" /> : <Image size={14} />} PNG
                    </button>
                    <button
                        onClick={handleExportJSON}
                        disabled={!!isExporting}
                        className="flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-cyan-700 px-4 py-2 rounded-xl text-[10px] font-black transition-all shadow-xl active:scale-95 group disabled:opacity-50"
                    >
                        {isExporting === 'JSON' ? <Loader2 size={14} className="animate-spin" /> : <Braces size={14} />} JSON
                    </button>
        </div>
      </div>

            <div className="relative z-10 mb-6 bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
                    <CalendarDays size={14} className="text-cyan-400" /> Bộ lọc thời gian
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {[
                        { label: 'Toàn bộ', value: 'all' as const },
                        { label: '7 ngày', value: '7d' as const },
                        { label: '30 ngày', value: '30d' as const },
                        { label: '90 ngày', value: '90d' as const },
                        { label: 'Tùy chọn', value: 'custom' as const }
                    ].map(option => (
                        <button
                            key={option.value}
                            onClick={() => setTimePreset(option.value)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border transition-all ${timePreset === option.value ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' : 'bg-gray-900/50 border-gray-700 text-gray-400 hover:text-white'}`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                {timePreset === 'custom' && (
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="bg-black/20 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-cyan-500"
                        />
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="bg-black/20 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-cyan-500"
                        />
                        <button
                            onClick={fetchStats}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase bg-cyan-600 hover:bg-cyan-500 text-white transition-all"
                        >
                            Áp dụng
                        </button>
                    </div>
                )}
            </div>

            {errorMessage && (
                <div className="relative z-10 mb-6 bg-amber-500/10 border border-amber-500/30 text-amber-100 px-4 py-3 rounded-2xl flex items-start gap-3 animate-reveal-up">
                    <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300 mb-1">Cảnh báo dữ liệu</p>
                        <p className="text-xs text-amber-100/90 leading-relaxed">{errorMessage}</p>
                    </div>
                </div>
            )}

            <div className="relative z-10 mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                    <p className="text-[9px] text-gray-500 font-black uppercase tracking-[0.18em] mb-1">Loại đất chiếm ưu thế</p>
                    <p className="text-sm font-black text-cyan-400 uppercase tracking-wide">{dominantType?.name || 'Chưa có dữ liệu'}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                    <p className="text-[9px] text-gray-500 font-black uppercase tracking-[0.18em] mb-1">Diện tích TB / thửa</p>
                    <p className="text-sm font-black text-white">{avgAreaPerParcel.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} m2</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 flex items-center justify-between">
                    <div>
                        <p className="text-[9px] text-gray-500 font-black uppercase tracking-[0.18em] mb-1">Tự động làm mới</p>
                        <p className="text-xs text-gray-300">Cập nhật mỗi 60 giây</p>
                    </div>
                    <button
                        onClick={() => setAutoRefresh(prev => !prev)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${autoRefresh ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
                    >
                        <Wifi size={12} className="inline mr-1" />{autoRefresh ? 'BẬT' : 'TẮT'}
                    </button>
                </div>
            </div>

      {/* METRIC CARDS */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {[
                    {
                        label: 'QUY MÔ THỬA',
                        value: displayStats.totalParcels.toLocaleString(),
                        suffix: 'thửa',
                        icon: Building,
                        color: 'blue' as const,
                        delay: '0.1s',
                        trend: getTrend(displayStats.totalParcels, previousStats?.totalParcels ?? null),
                        sparkline: parcelsHistoryValues
                    },
                    {
                        label: 'DIỆN TÍCH QUẢN LÝ',
                        value: Math.round(displayStats.totalArea).toLocaleString(),
                        suffix: 'm²',
                        icon: Scaling,
                        color: 'purple' as const,
                        delay: '0.2s',
                        trend: getTrend(displayStats.totalArea, previousStats?.totalArea ?? null),
                        sparkline: areaHistoryValues
                    },
                    {
                        label: 'GIÁ TRỊ TÍCH LŨY',
                        value: formatCompactCurrency(displayStats.totalValue),
                        suffix: 'VNĐ',
                        icon: DollarSign,
                        color: 'cyan' as const,
                        delay: '0.3s',
                        trend: getTrend(displayStats.totalValue, previousStats?.totalValue ?? null),
                        sparkline: valueHistoryValues
                    }
        ].map((card, idx) => (
          <div key={idx} 
               style={{ animationDelay: card.delay }}
               className="bg-white/5 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-xl relative overflow-hidden group hover:bg-white/10 transition-all duration-500 animate-reveal-up opacity-0">
                            <div className={`absolute top-0 left-0 w-full h-0.5 ${cardTheme[card.color].line} group-hover:h-1 transition-all`}></div>
              <div className="flex justify-between items-start mb-4">
                                    <div className={`${cardTheme[card.color].iconWrap} p-3 rounded-xl group-hover:scale-110 transition-all shadow-lg`}>
                      <card.icon size={20} />
                  </div>
                                    <Activity className={`${cardTheme[card.color].activity} opacity-20 group-hover:opacity-100 transition-opacity`} size={16} />
              </div>
              <h3 className="text-gray-500 text-[9px] font-black uppercase tracking-[0.2em] mb-1">{card.label}</h3>
              <div className="flex items-end gap-1.5">
                <p className="text-3xl font-black font-display tracking-tighter leading-none">{card.value}</p>
                <span className="text-gray-600 text-[9px] font-bold uppercase mb-0.5">{card.suffix}</span>
              </div>
                            <div className="mt-3">
                                <TrendBadge direction={card.trend.direction} label={card.trend.label} />
                            </div>
                            {card.sparkline.length > 1 && (
                                <TinySparkline
                                    values={card.sparkline}
                                    stroke={card.color === 'blue' ? '#60a5fa' : card.color === 'purple' ? '#a78bfa' : '#22d3ee'}
                                />
                            )}
          </div>
        ))}
      </div>

            <div className="relative z-10 mb-8 bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-xl animate-reveal-up opacity-0" style={{ animationDelay: '0.35s' }}>
                <div className="flex items-center justify-between gap-3 mb-5">
                    <div>
                        <h3 className="text-lg font-black uppercase tracking-tighter text-emerald-400 font-display">Xu hướng đồng bộ KPI</h3>
                        <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-1">Biến động qua các lần cập nhật gần nhất</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="text-[9px] text-gray-400 font-black uppercase tracking-widest bg-black/20 border border-white/10 rounded-lg px-3 py-1.5">
                            {trendChartData.length} mốc dữ liệu
                        </div>
                        <button
                            onClick={() => {
                                setKpiHistory([]);
                                setPreviousStats(null);
                            }}
                            className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-all"
                        >
                            <RotateCcw size={12} /> Reset trend
                        </button>
                    </div>
                </div>

                <div className="mb-4 flex flex-wrap items-center gap-2">
                    {[
                        { key: 'parcels' as const, label: 'Số thửa', color: 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10' },
                        { key: 'area' as const, label: 'Diện tích', color: 'text-violet-300 border-violet-500/40 bg-violet-500/10' },
                        { key: 'value' as const, label: 'Giá trị', color: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10' }
                    ].map(item => (
                        <button
                            key={item.key}
                            onClick={() => setTrendVisibility(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border transition-all ${trendVisibility[item.key] ? item.color : 'text-gray-500 border-gray-700 bg-gray-900/50'}`}
                        >
                            {trendVisibility[item.key] ? 'ON' : 'OFF'} • {item.label}
                        </button>
                    ))}

                    <button
                        onClick={() => setTrendVisibility(prev => ({ ...prev, movingAverage: !prev.movingAverage }))}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border transition-all ${trendVisibility.movingAverage ? 'text-amber-300 border-amber-500/40 bg-amber-500/10' : 'text-gray-500 border-gray-700 bg-gray-900/50'}`}
                    >
                        {trendVisibility.movingAverage ? 'ON' : 'OFF'} • Moving Avg
                    </button>

                    <select
                        value={movingAverageWindow}
                        onChange={(e) => setMovingAverageWindow(Number(e.target.value) as 2 | 3 | 5)}
                        className="bg-black/20 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] font-black text-gray-300 uppercase outline-none"
                    >
                        <option value={2}>MA 2</option>
                        <option value={3}>MA 3</option>
                        <option value={5}>MA 5</option>
                    </select>
                </div>

                <div className="h-[300px]">
                    {trendChartData.length < 2 ? (
                        <div className="h-full flex items-center justify-center text-center text-gray-500 text-xs font-bold uppercase tracking-widest">
                            Cần thêm dữ liệu để hiển thị xu hướng theo thời gian
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trendChartData} margin={{ top: 16, right: 24, left: 4, bottom: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                <XAxis dataKey="time" tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                <YAxis yAxisId="left" tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={60} />
                                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={48} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'rgba(11, 12, 16, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                    formatter={(value: number, name: string) => {
                                        if (name === 'totalValueBillion' || name === 'totalValueBillionMA') return [`${value.toLocaleString('vi-VN')} tỷ`, name.includes('MA') ? 'Giá trị (MA)' : 'Giá trị'];
                                        if (name === 'totalArea' || name === 'totalAreaMA') return [`${value.toLocaleString('vi-VN')} m2`, name.includes('MA') ? 'Diện tích (MA)' : 'Diện tích'];
                                        if (name === 'totalParcelsMA') return [value.toLocaleString('vi-VN'), 'Số thửa (MA)'];
                                        return [value.toLocaleString('vi-VN'), 'Số thửa'];
                                    }}
                                />
                                <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 800, paddingTop: '8px' }} />
                                {trendVisibility.parcels && <Line yAxisId="left" type="monotone" dataKey="totalParcels" name="Số thửa" stroke="#22d3ee" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />}
                                {trendVisibility.area && <Line yAxisId="left" type="monotone" dataKey="totalArea" name="Diện tích" stroke="#a78bfa" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />}
                                {trendVisibility.value && <Line yAxisId="right" type="monotone" dataKey="totalValueBillion" name="Giá trị (tỷ)" stroke="#34d399" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />}

                                {trendVisibility.movingAverage && trendVisibility.parcels && (
                                    <Line yAxisId="left" type="monotone" dataKey="totalParcelsMA" name={`Số thửa (MA${movingAverageWindow})`} stroke="#67e8f9" strokeWidth={2} dot={false} strokeDasharray="6 4" connectNulls />
                                )}
                                {trendVisibility.movingAverage && trendVisibility.area && (
                                    <Line yAxisId="left" type="monotone" dataKey="totalAreaMA" name={`Diện tích (MA${movingAverageWindow})`} stroke="#c4b5fd" strokeWidth={2} dot={false} strokeDasharray="6 4" connectNulls />
                                )}
                                {trendVisibility.movingAverage && trendVisibility.value && (
                                    <Line yAxisId="right" type="monotone" dataKey="totalValueBillionMA" name={`Giá trị (MA${movingAverageWindow})`} stroke="#6ee7b7" strokeWidth={2} dot={false} strokeDasharray="6 4" connectNulls />
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
        {/* CHART 1: DOUGHNUT */}
        <div className="bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-xl animate-reveal-left opacity-0" style={{ animationDelay: '0.4s' }}>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-black uppercase tracking-tighter text-blue-400 font-display">Cơ cấu loại đất</h3>
                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-1">Phân bổ chi tiết toàn vùng</p>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        value={typeQuery}
                        onChange={(e) => setTypeQuery(e.target.value)}
                        placeholder="Lọc loại đất..."
                        className="bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-gray-500 outline-none focus:border-cyan-500"
                    />
                    <button
                        onClick={() => setTypeView(prev => prev === 'chart' ? 'table' : 'chart')}
                        className="bg-white/10 p-2 rounded-xl text-gray-400 hover:text-white transition-all"
                        title="Chuyển chế độ hiển thị"
                    >
                        {typeView === 'chart' ? <Table2 size={16} /> : <PieChartIcon size={16} />}
                    </button>
                    <div className="bg-white/10 p-2 rounded-xl text-gray-400 hover:text-white cursor-pointer transition-all" onClick={fetchStats}>
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""}/>
                    </div>
                </div>
            </div>
            <div className="h-[380px] relative">
                {filteredTypeData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-center text-gray-500 text-xs font-bold uppercase tracking-widest">
                        Không có loại đất phù hợp với bộ lọc
                    </div>
                ) : typeView === 'chart' ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <defs>
                                {COLORS.map((color, i) => (
                                    <linearGradient key={`pie-grad-${i}`} id={`pie-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={color} stopOpacity={1}/>
                                        <stop offset="100%" stopColor={color} stopOpacity={0.6}/>
                                    </linearGradient>
                                ))}
                            </defs>
                            <Pie
                                {...({
                                    activeIndex: activeIndex !== null ? activeIndex : undefined,
                                    activeShape: renderActiveShape
                                } as any)}
                                data={filteredTypeData}
                                cx="50%" cy="45%"
                                innerRadius={90} outerRadius={130}
                                paddingAngle={4}
                                dataKey="value" nameKey="name"
                                cornerRadius={10}
                                stroke="rgba(255,255,255,0.05)" strokeWidth={4}
                                onMouseEnter={(_, index) => setActiveIndex(index)}
                                onMouseLeave={() => setActiveIndex(null)}
                            >
                                {filteredTypeData.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={`url(#pie-grad-${index % COLORS.length})`} className="cursor-pointer hover:brightness-110 transition-all outline-none" />
                                ))}
                            </Pie>
                            <Tooltip 
                                contentStyle={{ backgroundColor: 'rgba(11, 12, 16, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', backdropFilter: 'blur(10px)' }}
                                itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: '800' }}
                            />
                            <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: '800' }} />
                        </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full overflow-auto custom-scrollbar pr-1">
                        <div className="space-y-2">
                            {filteredTypeData.map((item, idx) => {
                                const percent = totalTypeParcels > 0 ? (item.value / totalTypeParcels) * 100 : 0;
                                return (
                                    <div key={`${item.name}-${idx}`} className="bg-white/5 border border-white/10 rounded-xl p-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-xs font-black text-white truncate">{item.name}</p>
                                            <p className="text-[10px] font-black text-cyan-300">{item.value.toLocaleString()} thửa</p>
                                        </div>
                                        <div className="mt-2 w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                            <div className="h-full bg-cyan-500" style={{ width: `${Math.min(percent, 100)}%` }} />
                                        </div>
                                        <p className="mt-1 text-[9px] text-gray-500 font-bold">{percent.toFixed(2)}%</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
                {typeView === 'chart' && activeIndex === null && filteredTypeData.length > 0 && (
                    <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                        <p className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em]">Tổng quan</p>
                        <p className="text-3xl font-black text-white font-display leading-tight">100%</p>
                    </div>
                )}
            </div>
        </div>

        {/* CHART 2: BAR CHART */}
        <div className="bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-xl animate-reveal-up opacity-0" style={{ animationDelay: '0.5s' }}>
            <div className="mb-6 flex items-center justify-between gap-3">
                <div>
                    <h3 className="text-lg font-black uppercase tracking-tighter text-orange-500 font-display">Mật độ khu vực</h3>
                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-1">Số lượng thửa đất theo Phường/Xã</p>
                </div>
                <div className="flex items-center gap-2 bg-black/20 border border-white/10 rounded-xl p-1">
                    <ListFilter size={14} className="text-gray-500 ml-2" />
                    <select
                        value={branchSort}
                        onChange={(e) => setBranchSort(e.target.value as 'value-desc' | 'value-asc' | 'name-asc')}
                        className="bg-transparent text-[10px] font-black text-gray-300 uppercase outline-none"
                    >
                        <option value="value-desc">Giảm dần</option>
                        <option value="value-asc">Tăng dần</option>
                        <option value="name-asc">A-Z</option>
                    </select>
                    {[
                        { label: 'Top 5', value: 5 as 5 },
                        { label: 'Top 10', value: 10 as 10 },
                        { label: 'Tất cả', value: 0 as 0 }
                    ].map(option => (
                        <button
                            key={option.value}
                            onClick={() => setBranchLimit(option.value)}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${branchLimit === option.value ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="h-[380px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                        data={filteredBranchData} 
                        layout="vertical" 
                        margin={{ right: 60, left: 20, top: 10, bottom: 10 }}
                    >
                        <defs>
                            <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#f97316" />
                                <stop offset="100%" stopColor="#ef4444" />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={true} vertical={false} />
                        <XAxis type="number" hide />
                        <YAxis 
                            dataKey="name" 
                            type="category" 
                            width={130} 
                            stroke="#94a3b8" 
                            tick={{fontSize: 10, fontWeight: '800'}} 
                            axisLine={false} 
                            tickLine={false} 
                        />
                        <Tooltip 
                            cursor={{fill: 'rgba(255,255,255,0.05)', radius: 8}} 
                            contentStyle={{ backgroundColor: 'rgba(11, 12, 16, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        />
                        <Bar 
                            dataKey="value" 
                            fill="url(#barGradient)" 
                            radius={[0, 10, 10, 0]} 
                            barSize={18} 
                            animationDuration={1500}
                            label={{ 
                                position: 'right', 
                                fill: '#94a3b8', 
                                fontSize: 10, 
                                fontWeight: '900', 
                                offset: 12,
                                formatter: (val: number) => val.toLocaleString()
                            }}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
