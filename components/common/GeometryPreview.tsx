import React from 'react';

interface GeometryPreviewProps {
    geometry?: any;
    height?: number;
    stroke?: string;
    fill?: string;
    className?: string;
}

const getRings = (geometry: any): number[][][] => {
    if (!geometry || !geometry.coordinates) return [];
    if (geometry.type === 'Polygon') return geometry.coordinates || [];
    if (geometry.type === 'MultiPolygon') return (geometry.coordinates || []).flat();
    return [];
};

const GeometryPreview: React.FC<GeometryPreviewProps> = ({
    geometry,
    height = 140,
    stroke = '#34d399',
    fill = 'rgba(52, 211, 153, 0.18)',
    className = '',
}) => {
    const rings = getRings(geometry);
    const outerRings = rings.filter(r => Array.isArray(r) && r.length >= 3);

    if (outerRings.length === 0) {
        return (
            <div className={`flex items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-950/60 text-[10px] text-slate-500 ${className}`} style={{ height }}>
                Không có hình học
            </div>
        );
    }

    const points = outerRings.flat();
    const xs = points.map(p => Number(p[0])).filter(Number.isFinite);
    const ys = points.map(p => Number(p[1])).filter(Number.isFinite);

    if (xs.length === 0 || ys.length === 0) {
        return (
            <div className={`flex items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-950/60 text-[10px] text-slate-500 ${className}`} style={{ height }}>
                Geometry không hợp lệ
            </div>
        );
    }

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width = 220;
    const padding = 14;
    const usableW = width - padding * 2;
    const usableH = height - padding * 2;
    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;
    const scale = Math.min(usableW / spanX, usableH / spanY);
    const drawW = spanX * scale;
    const drawH = spanY * scale;
    const offsetX = padding + (usableW - drawW) / 2;
    const offsetY = padding + (usableH - drawH) / 2;

    const toSvgPoint = (p: number[]) => {
        const x = offsetX + (Number(p[0]) - minX) * scale;
        const y = offsetY + (maxY - Number(p[1])) * scale;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
    };

    return (
        <div className={`rounded-lg border border-slate-700/70 bg-slate-950/70 overflow-hidden ${className}`} style={{ height }}>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
                <defs>
                    <pattern id="geom-preview-grid" width="16" height="16" patternUnits="userSpaceOnUse">
                        <path d="M 16 0 L 0 0 0 16" fill="none" stroke="rgba(148,163,184,0.08)" strokeWidth="1" />
                    </pattern>
                </defs>
                <rect x="0" y="0" width={width} height={height} fill="url(#geom-preview-grid)" />
                {outerRings.map((ring, idx) => (
                    <polygon
                        key={idx}
                        points={ring.map(toSvgPoint).join(' ')}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                    />
                ))}
            </svg>
        </div>
    );
};

export default GeometryPreview;
