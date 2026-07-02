import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, RefreshCw, Layers, Sparkles, HelpCircle, ArrowLeftRight, Trash2, Plus, Play, CheckCircle } from 'lucide-react';
import proj4 from 'proj4';
import * as proj from 'ol/proj';
import { registerDynamicVn2000, Vn2000Zone } from '../../utils/editorProjection';
import { adminService } from '../../services/apiClient';

interface OcrCoordinateModalProps {
    isOpen: boolean;
    onClose: () => void;
    centralMeridian: number;
    projectionZone: Vn2000Zone;
    onDrawShape: (coords: [number, number][]) => void;
}

interface ParsedPoint {
    id: string;
    indexStr: string;
    xStr: string; // Northing
    yStr: string; // Easting
}

export const OcrCoordinateModal: React.FC<OcrCoordinateModalProps> = ({
    isOpen,
    onClose,
    centralMeridian: defaultCentralMeridian,
    projectionZone: defaultProjectionZone,
    onDrawShape
}) => {
    const [step, setStep] = useState<'upload' | 'scanning' | 'edit'>('upload');
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressStatus, setProgressStatus] = useState('');
    const [rawText, setRawText] = useState('');
    
    // Coordinates settings
    const [coordSystem, setCoordSystem] = useState<'VN2000' | 'WGS84'>('VN2000');
    const [centralMeridian, setCentralMeridian] = useState(defaultCentralMeridian);
    const [projectionZone, setProjectionZone] = useState<Vn2000Zone>(defaultProjectionZone);

    // Gemini API settings (loaded from global system settings)
    const [useGemini, setUseGemini] = useState<boolean>(false);
    const [geminiKey, setGeminiKey] = useState<string>('');
    const [geminiModel, setGeminiModel] = useState<string>('gemini-flash-latest');

    // 9router API settings (loaded from global system settings)
    const [useNineRouter, setUseNineRouter] = useState<boolean>(false);
    const [nineRouterKey, setNineRouterKey] = useState<string>('');
    const [nineRouterModel, setNineRouterModel] = useState<string>('9router/ag/gemini-3.5-flash-extra-low');



    // Parsed points
    const [points, setPoints] = useState<ParsedPoint[]>([]);
    
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Reset state on open/close and load system settings
    useEffect(() => {
        if (isOpen) {
            setStep('upload');
            setImageSrc(null);
            setIsScanning(false);
            setProgress(0);
            setProgressStatus('');
            setRawText('');
            setPoints([]);
            setCoordSystem('VN2000');
            setCentralMeridian(defaultCentralMeridian);
            setProjectionZone(defaultProjectionZone);

            // Fetch global settings from database
            const fetchGlobalSettings = async () => {
                try {
                    const settingsList = await adminService.getSettings();
                    const useGeminiSetting = settingsList.find(s => s.key === 'ocr_use_gemini');
                    const keySetting = settingsList.find(s => s.key === 'ocr_gemini_key');
                    const modelSetting = settingsList.find(s => s.key === 'ocr_gemini_model');
                    
                    const useNineRouterSetting = settingsList.find(s => s.key === 'ocr_use_9router');
                    const nineRouterKeySetting = settingsList.find(s => s.key === 'ocr_9router_key');
                    const nineRouterModelSetting = settingsList.find(s => s.key === 'ocr_9router_model');

                    if (useGeminiSetting) {
                        setUseGemini(useGeminiSetting.value === 'true');
                    }
                    if (keySetting && keySetting.value) {
                        setGeminiKey(keySetting.value);
                    }
                    if (modelSetting && modelSetting.value) {
                        setGeminiModel(modelSetting.value);
                    }

                    if (useNineRouterSetting) {
                        setUseNineRouter(useNineRouterSetting.value === 'true');
                    }
                    if (nineRouterKeySetting && nineRouterKeySetting.value) {
                        setNineRouterKey(nineRouterKeySetting.value);
                    }
                    if (nineRouterModelSetting && nineRouterModelSetting.value) {
                        setNineRouterModel(nineRouterModelSetting.value);
                    }

                } catch (e) {
                    console.error("Failed to load global OCR settings from server:", e);
                }
            };
            fetchGlobalSettings();
        }
    }, [isOpen, defaultCentralMeridian, defaultProjectionZone]);

    if (!isOpen) return null;

    // Load Tesseract.js dynamically from CDN
    const loadTesseract = (): Promise<any> => {
        return new Promise((resolve, reject) => {
            if ((window as any).Tesseract) {
                resolve((window as any).Tesseract);
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/tesseract.js@v5.0.5/dist/tesseract.min.js';
            script.async = true;
            script.onload = () => {
                resolve((window as any).Tesseract);
            };
            script.onerror = () => {
                reject(new Error('Không thể tải thư viện OCR Tesseract từ CDN. Vui lòng kiểm tra kết nối mạng.'));
            };
            document.head.appendChild(script);
        });
    };

    // Handle Image Upload
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        readImageFile(file);
    };

    const readImageFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target?.result) {
                setImageSrc(event.target.result as string);
            }
        };
        reader.readAsDataURL(file);
    };

    // Clean number string (VN-2000 values: dots for thousands, comma for decimals or vice versa)
    const cleanNumberString = (str: string): string => {
        let cleaned = str.replace(/[^0-9.,]/g, '');
        if (!cleaned) return '';
        
        const lastDot = cleaned.lastIndexOf('.');
        const lastComma = cleaned.lastIndexOf(',');
        
        if (lastDot !== -1 && lastComma !== -1) {
            if (lastComma > lastDot) {
                // Format: 1.234.567,89 -> remove dots, convert comma to dot
                return cleaned.replace(/\./g, '').replace(/,/g, '.');
            } else {
                // Format: 1,234,567.89 -> remove commas
                return cleaned.replace(/,/g, '');
            }
        } else if (lastComma !== -1) {
            // Only contains commas: could be thousands separators or single decimal comma
            const commaCount = (cleaned.match(/,/g) || []).length;
            if (commaCount === 1) {
                // Single comma: e.g. 589123,45 -> decimal
                return cleaned.replace(/,/g, '.');
            } else {
                // Multiple commas: e.g. 2,109,123 -> thousands separator
                return cleaned.replace(/,/g, '');
            }
        } else if (lastDot !== -1) {
            // Only contains dots: could be thousands separators or single decimal dot
            const dotCount = (cleaned.match(/\./g) || []).length;
            if (dotCount > 1) {
                // Multiple dots: e.g. 2.109.123 -> thousands separator
                return cleaned.replace(/\./g, '');
            }
        }
        return cleaned;
    };

    // Preprocess raw token to fix common OCR character misrecognitions
    const preprocessOcrToken = (token: string): string => {
        let t = token.trim();
        
        // Remove brackets, pipes at ends
        t = t.replace(/^[|\[\]\s]+/, '').replace(/[|\[\]\s]+$/, '');
        
        // Replace leading letters with numbers:
        // I, l, i followed by digits -> 1
        t = t.replace(/^[Ili](?=\d)/, '1');
        // J, j followed by digits -> strip it (often J12... means 12...)
        t = t.replace(/^[Jj](?=\d)/, '');
        // s, S followed by digits -> 5
        t = t.replace(/^[sS](?=\d)/, '5');
        
        // Fix merged index column (e.g. "11237533,246" or "21237533,246")
        // If the clean number has 11 digits and the 2nd and 3rd digits represent a valid VN2000 northing prefix (12, 21, 22, 20),
        // it means the 1-digit row index was merged with the Northing coordinate.
        const cleanDigits = t.replace(/[^0-9]/g, '');
        if (cleanDigits.length === 11) {
            const secondAndThird = cleanDigits.slice(1, 3);
            if (secondAndThird === '12' || secondAndThird === '21' || secondAndThird === '22' || secondAndThird === '20') {
                t = t.slice(1);
            }
        }
        
        return t;
    };

    // Split token containing merged coordinates (e.g. "12375088031587343472")
    const splitMergedToken = (token: string): string[] => {
        // Remove all non-digits to analyze length
        const digits = token.replace(/[^0-9]/g, '');
        if (digits.length >= 15 && digits.length <= 22) {
            // Find transition to Easting-like prefix (starts with 4, 5, 6 or merged 14, 15, 16)
            let splitIdx = 10;
            for (let i = 8; i <= 12; i++) {
                const substring = digits.slice(i);
                if (/^(4|5|6|14|15|16)/.test(substring)) {
                    splitIdx = i;
                    break;
                }
            }
            const part1 = digits.slice(0, splitIdx);
            const part2 = digits.slice(splitIdx);
            return [part1, part2];
        }
        return [token];
    };

    // Auto-fix decimal points for coordinates without separators
    const autoFixCoordinateDecimals = (valStr: string, type: 'northing' | 'easting'): string => {
        let cleanDigits = valStr.replace(/[^0-9]/g, '');
        if (cleanDigits.length >= 8 && !valStr.includes('.') && !valStr.includes(',')) {
            // For Easting: check if it has 10 digits and starts with 14, 15, 16 (merged pipe)
            if (type === 'easting' && cleanDigits.length === 10 && /^(14|15|16)/.test(cleanDigits)) {
                cleanDigits = cleanDigits.slice(1); // strip the leading '1'
            }

            if (type === 'northing') {
                return cleanDigits.slice(0, 7) + '.' + cleanDigits.slice(7);
            } else {
                return cleanDigits.slice(0, 6) + '.' + cleanDigits.slice(6);
            }
        } else if (type === 'easting' && valStr.includes('.')) {
            // Even if it has a decimal point, check if it has a merged leading '1' (e.g. 1587347.657)
            const numericValue = parseFloat(valStr);
            if (numericValue >= 1000000 && /^(14|15|16)/.test(cleanDigits)) {
                // Strip the leading '1'
                const cleanWithoutOne = cleanDigits.slice(1);
                return cleanWithoutOne.slice(0, 6) + '.' + cleanWithoutOne.slice(6);
            }
        }
        return valStr;
    };

    // Intelligent parser for recognized text
    const parseOcrText = (text: string) => {
        const lines = text.split('\n');
        const parsedPoints: ParsedPoint[] = [];

        lines.forEach((line) => {
            // Clean spacing around commas/dots (e.g. "1237527 , 999" -> "1237527,999")
            let processedLine = line.replace(/([0-9]+)\s*([.,])\s*([0-9]+)/g, '$1$2$3');
            
            // Extract raw tokens using spaces/pipes/slashes/semicolons
            const rawTokens = processedLine.trim().split(/[\s\t|/\\;]+/).filter(Boolean);

            // Preprocess and split merged tokens
            const tokens: string[] = [];
            rawTokens.forEach(t => {
                const preprocessed = preprocessOcrToken(t);
                if (preprocessed) {
                    const split = splitMergedToken(preprocessed);
                    tokens.push(...split);
                }
            });

            const numberCandidates: { raw: string; cleaned: string; value: number }[] = [];
            let indexStr = '';

            tokens.forEach((token) => {
                const cleaned = cleanNumberString(token);
                if (cleaned) {
                    const val = parseFloat(cleaned);
                    if (!isNaN(val)) {
                        numberCandidates.push({ raw: token, cleaned, value: val });
                    }
                }
            });

            if (numberCandidates.length >= 2) {
                let xStr = '';
                let yStr = '';
                let foundPair = false;

                // Pre-apply decimal auto-fixing or normalization to all candidates
                const fixedCandidates = numberCandidates.map(c => {
                    let fixedCleaned = c.cleaned;
                    let fixedValue = c.value;
                    
                    if (coordSystem === 'VN2000') {
                        if (!c.cleaned.includes('.') && !c.cleaned.includes(',')) {
                            const cleanDigits = c.cleaned.replace(/[^0-9]/g, '');
                            if (/^(14|15|16)/.test(cleanDigits) && cleanDigits.length === 10) {
                                fixedCleaned = autoFixCoordinateDecimals(c.cleaned, 'easting');
                            } else if (/^(1|2)/.test(cleanDigits) && cleanDigits.length >= 9) {
                                fixedCleaned = autoFixCoordinateDecimals(c.cleaned, 'northing');
                            } else if (/^(3|4|5|6|7|8|9)/.test(cleanDigits) && cleanDigits.length >= 8) {
                                fixedCleaned = autoFixCoordinateDecimals(c.cleaned, 'easting');
                            }
                        } else {
                            fixedCleaned = autoFixCoordinateDecimals(c.cleaned, 'easting');
                        }
                        fixedValue = parseFloat(fixedCleaned);
                    }
                    
                    return { ...c, fixedCleaned, fixedValue };
                });

                if (coordSystem === 'VN2000') {
                    const northings = fixedCandidates.filter(c => c.fixedValue >= 900000 && c.fixedValue <= 3000000);
                    const eastings = fixedCandidates.filter(c => c.fixedValue >= 100000 && c.fixedValue < 900000);

                    if (northings.length >= 1 && eastings.length >= 1) {
                        xStr = northings[0].fixedCleaned;
                        yStr = eastings[0].fixedCleaned;
                        foundPair = true;
                    }
                } else {
                    // WGS84: Latitude (8 to 30) and Longitude (95 to 115)
                    const lats = fixedCandidates.filter(c => c.fixedValue >= 8 && c.fixedValue <= 30);
                    const lons = fixedCandidates.filter(c => c.fixedValue >= 95 && c.fixedValue <= 115);

                    if (lats.length >= 1 && lons.length >= 1) {
                        xStr = lats[0].fixedCleaned;
                        yStr = lons[0].fixedCleaned;
                        foundPair = true;
                    }
                }

                // Fallback: match the two largest numbers based on their fixed/corrected values
                if (!foundPair) {
                    const sorted = [...fixedCandidates].sort((a, b) => b.fixedValue - a.fixedValue);
                    if (sorted.length >= 2) {
                        xStr = sorted[0].fixedCleaned;
                        yStr = sorted[1].fixedCleaned;
                        foundPair = true;
                    }
                }

                if (foundPair) {
                    // Guess point index: the first small number < 100 in the line that isn't coordinate
                    const indexToken = numberCandidates.find(c => {
                        const cleanC = c.cleaned.replace(/[^0-9]/g, '');
                        const cleanX = xStr.replace(/[^0-9]/g, '');
                        const cleanY = yStr.replace(/[^0-9]/g, '');
                        return cleanC !== cleanX && cleanC !== cleanY && c.value > 0 && c.value < 100;
                    });
                    
                    if (indexToken) {
                        indexStr = Math.round(indexToken.value).toString();
                    } else {
                        const match = line.trim().match(/^(\d+)\b/);
                        if (match) {
                            indexStr = match[1];
                        }
                    }

                    // Validate geographical range bounds (Vietnam coordinates check) to filter out garbage noise
                    if (coordSystem === 'VN2000') {
                        const valX = parseFloat(xStr);
                        const valY = parseFloat(yStr);
                        if (isNaN(valX) || isNaN(valY) || valX < 900000 || valX > 3000000 || valY < 100000 || valY > 900000) {
                            return; // Skip this garbage noise row
                        }
                    } else {
                        const valX = parseFloat(xStr);
                        const valY = parseFloat(yStr);
                        if (isNaN(valX) || isNaN(valY) || valX < 8 || valX > 30 || valY < 95 || valY > 115) {
                            return; // Skip WGS84 noise
                        }
                    }

                    // Validate guessed index (must be a small positive number < 100)
                    let finalIndex = '';
                    if (indexStr) {
                        const parsedIdx = parseInt(indexStr, 10);
                        if (!isNaN(parsedIdx) && parsedIdx > 0 && parsedIdx < 100) {
                            finalIndex = parsedIdx.toString();
                        }
                    }

                    parsedPoints.push({
                        id: 'pt-' + Math.random().toString(36).substr(2, 9),
                        indexStr: finalIndex || (parsedPoints.length + 1).toString(),
                        xStr,
                        yStr
                    });
                }
            }
        });

        setPoints(parsedPoints);
    };

    // Convert image to grayscale and binarize using adaptive average thresholding
    const binarizeImage = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        const len = data.length;
        
        // Calculate average relative luminance
        let sumLuminance = 0;
        for (let i = 0; i < len; i += 4) {
            const r = data[i];
            const g = data[i+1];
            const b = data[i+2];
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            data[i] = gray; // store temporary gray value in R channel
            sumLuminance += gray;
        }
        
        const avgLuminance = sumLuminance / (len / 4);
        
        // Apply high-contrast binarization threshold
        // Pixels darker than 85% of average become solid black (0), others white (255)
        const threshold = avgLuminance * 0.85;
        
        for (let i = 0; i < len; i += 4) {
            const gray = data[i];
            const val = gray < threshold ? 0 : 255;
            data[i] = val;
            data[i+1] = val;
            data[i+2] = val;
            data[i+3] = 255; // fully opaque
        }
        
        ctx.putImageData(imgData, 0, 0);
    };

    // Detect and erase vertical grid lines (table borders) to prevent Tesseract from skipping columns
    const eraseVerticalGridLines = (canvas: HTMLCanvasElement) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const width = canvas.width;
        const height = canvas.height;
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        
        // Count dark pixels in each column
        const colDarkCounts = new Array(width).fill(0);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (width * y + x) << 2;
                const r = data[idx];
                const g = data[idx+1];
                const b = data[idx+2];
                const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                if (gray < 180) {
                    colDarkCounts[x]++;
                }
            }
        }
        
        // Find columns where more than 65% of the vertical pixels are dark (vertical lines)
        const lineThreshold = height * 0.65;
        const verticalLineColumns: number[] = [];
        for (let x = 0; x < width; x++) {
            if (colDarkCounts[x] > lineThreshold) {
                verticalLineColumns.push(x);
            }
        }
        
        // Erase detected vertical lines by painting them white
        if (verticalLineColumns.length > 0) {
            verticalLineColumns.forEach(x => {
                for (let y = 0; y < height; y++) {
                    const idx = (width * y + x) << 2;
                    data[idx] = 255;   // R
                    data[idx+1] = 255; // G
                    data[idx+2] = 255; // B
                }
            });
            ctx.putImageData(imgData, 0, 0);
        }
    };

    // Preprocess image: remove vertical lines, scale up 2x, and add 20px padding
    const preprocessImage = (src: string): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                // Step 1: Draw to a temporary canvas of original size to erase vertical grid lines
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = img.width;
                tempCanvas.height = img.height;
                const tempCtx = tempCanvas.getContext('2d');
                if (!tempCtx) {
                    resolve(src);
                    return;
                }
                tempCtx.drawImage(img, 0, 0);
                
                try {
                    eraseVerticalGridLines(tempCanvas);
                } catch (e) {
                    console.error('Error erasing vertical lines:', e);
                }

                // Step 2: Upscale by 2x and add 20px white padding around edges
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(src);
                    return;
                }
                
                const scale = 2.0;
                const padding = 20; 
                
                canvas.width = img.width * scale + padding * 2;
                canvas.height = img.height * scale + padding * 2;
                
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                
                // Solid white background
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Draw upscaled clean image with padding offset
                ctx.drawImage(tempCanvas, padding, padding, img.width * scale, img.height * scale);
                
                // Output as high quality JPEG (Tesseract will handle binarization internally using Otsu)
                const jpegData = canvas.toDataURL('image/jpeg', 0.95);
                resolve(jpegData);
            };
            img.onerror = () => {
                resolve(src);
            };
            img.src = src;
        });
    };

    // Run OCR using Tesseract.js or backend proxy
    const handleStartScan = async () => {
        if (!imageSrc) return;
        
        setIsScanning(true);
        setStep('scanning');
        setProgress(0);
        
        if (useNineRouter && nineRouterKey) {
            setProgressStatus('Đang gửi hình ảnh lên 9router API (qua server)...');
            try {
                const cleanImageSrc = await preprocessImage(imageSrc);
                setProgress(30);
                
                setProgressStatus('9router đang phân tích và trích xuất dữ liệu...');
                const result = await adminService.runOcr({
                    engine: '9router',
                    image: cleanImageSrc,
                    nineRouterKey,
                    nineRouterModel
                });
                setProgress(90);
                
                const parsedPoints = (result.data || []).map((item: any, idx: number) => ({
                    id: 'pt-' + Math.random().toString(36).substr(2, 9),
                    indexStr: (item.index || item.Đỉnh || item.id || (idx + 1)).toString(),
                    xStr: (item.x || item.X || '').toString(),
                    yStr: (item.y || item.Y || '').toString()
                }));

                setPoints(parsedPoints);
                setRawText('Dữ liệu phản hồi dạng JSON từ 9router:\n\n' + JSON.stringify(parsedPoints.map(p => ({
                    đỉnh: p.indexStr,
                    x: p.xStr,
                    y: p.yStr
                })), null, 2));
                
                setProgressStatus('Hoàn tất quét ảnh!');
                setProgress(100);
                
                setTimeout(() => {
                    setStep('edit');
                    setIsScanning(false);
                }, 600);
                return;
            } catch (e: any) {
                console.error("9router OCR error, falling back to Tesseract:", e);
                setProgressStatus('9router API lỗi. Tự động chuyển sang Tesseract offline...');
                await new Promise(r => setTimeout(r, 1200));
            }
        }
        
        if (useGemini && geminiKey) {
            setProgressStatus('Đang gửi hình ảnh lên Google Gemini API (qua server)...');
            try {
                const cleanImageSrc = await preprocessImage(imageSrc);
                setProgress(30);
                
                setProgressStatus('Gemini đang phân tích và trích xuất dữ liệu...');
                const result = await adminService.runOcr({
                    engine: 'gemini',
                    image: cleanImageSrc,
                    geminiKey,
                    geminiModel
                });
                setProgress(90);
                
                const parsedPoints = (result.data || []).map((item: any, idx: number) => ({
                    id: 'pt-' + Math.random().toString(36).substr(2, 9),
                    indexStr: (item.index || item.Đỉnh || item.id || (idx + 1)).toString(),
                    xStr: (item.x || item.X || '').toString(),
                    yStr: (item.y || item.Y || '').toString()
                }));

                setPoints(parsedPoints);
                setRawText('Dữ liệu phản hồi dạng JSON từ Google Gemini:\n\n' + JSON.stringify(parsedPoints.map(p => ({
                    đỉnh: p.indexStr,
                    x: p.xStr,
                    y: p.yStr
                })), null, 2));
                
                setProgressStatus('Hoàn tất quét ảnh!');
                setProgress(100);
                
                setTimeout(() => {
                    setStep('edit');
                    setIsScanning(false);
                }, 600);
                return;
            } catch (e: any) {
                console.error("Gemini OCR error, falling back to Tesseract:", e);
                setProgressStatus('Gemini API lỗi. Tự động chuyển sang Tesseract offline...');
                await new Promise(r => setTimeout(r, 1200));
            }
        }


        setProgressStatus('Đang tiền xử lý hình ảnh (loại bỏ độ trong suốt)...');

        try {
            // Remove transparency by rendering on solid white canvas
            const cleanImageSrc = await preprocessImage(imageSrc);

            setProgressStatus('Đang tải thư viện OCR Tesseract...');
            const Tesseract = await loadTesseract();
            setProgressStatus('Đang khởi chạy bộ máy nhận diện...');
            
            const result = await Tesseract.recognize(
                cleanImageSrc,
                'vie+eng', // Load Vietnamese and English
                {
                    logger: (m: any) => {
                        if (m.status === 'recognizing text') {
                            setProgressStatus(`Đang nhận diện chữ viết: ${Math.round(m.progress * 100)}%`);
                            setProgress(Math.round(m.progress * 100));
                        }
                    }
                }
            );

            const text = result.data.text;
            setRawText(text);
            setProgressStatus('Hoàn tất nhận dạng. Đang phân tích tọa độ...');
            
            // Wait slightly for a smooth transition
            setTimeout(() => {
                parseOcrText(text);
                setStep('edit');
                setIsScanning(false);
            }, 600);

        } catch (e: any) {
            setIsScanning(false);
            setStep('upload');
            alert(e.message || 'Lỗi quét ảnh OCR.');
        }
    };

    // Swap X and Y coordinates for all points
    const handleSwapXY = () => {
        setPoints(prev => prev.map(p => ({
            ...p,
            xStr: p.yStr,
            yStr: p.xStr
        })));
    };

    // Update cell value
    const handleUpdatePoint = (id: string, field: 'indexStr' | 'xStr' | 'yStr', value: string) => {
        setPoints(prev => prev.map(p => {
            if (p.id === id) {
                return { ...p, [field]: value };
            }
            return p;
        }));
    };

    // Delete point
    const handleDeletePoint = (id: string) => {
        setPoints(prev => prev.filter(p => p.id !== id));
    };

    // Add empty point
    const handleAddPoint = () => {
        setPoints(prev => [
            ...prev,
            {
                id: 'pt-' + Math.random().toString(36).substr(2, 9),
                indexStr: (prev.length + 1).toString(),
                xStr: '',
                yStr: ''
            }
        ]);
    };

    // Plot Points and Draw Shape
    const handlePlotAndDraw = () => {
        try {
            if (points.length < 3) {
                alert("Cần ít nhất 3 tọa độ điểm để dựng hình thửa đất.");
                return;
            }

            const transformedCoords: [number, number][] = [];
            const vnProj = coordSystem === 'VN2000' ? registerDynamicVn2000(centralMeridian, projectionZone) : null;

            for (const p of points) {
                const x = parseFloat(p.xStr);
                const y = parseFloat(p.yStr);

                if (isNaN(x) || isNaN(y)) {
                    alert(`Tọa độ tại điểm thứ ${p.indexStr} không hợp lệ.`);
                    return;
                }

                if (coordSystem === 'VN2000') {
                    // OpenLayers expects coordinates in [Easting, Northing] or [Y, X] order!
                    // X in land certificate = Northing
                    // Y in land certificate = Easting
                    // So we pass [Y, X] to projection transform
                    const geomPoint = proj.transform([y, x], vnProj!, 'EPSG:3857');
                    transformedCoords.push(geomPoint as [number, number]);
                } else {
                    // WGS84: standard [Lon, Lat] or [Y, X]
                    const geomPoint = proj.fromLonLat([y, x]);
                    transformedCoords.push(geomPoint as [number, number]);
                }
            }

            // Close the polygon if not already closed
            if (transformedCoords.length > 0) {
                const first = transformedCoords[0];
                const last = transformedCoords[transformedCoords.length - 1];
                if (first[0] !== last[0] || first[1] !== last[1]) {
                    transformedCoords.push([...first] as [number, number]);
                }
            }

            onDrawShape(transformedCoords);
            onClose();
        } catch (e: any) {
            alert(`Lỗi khi dựng hình: ${e.message}`);
        }
    };

    // Render SVG Preview of the points
    const renderSvgPreview = () => {
        const validCoords = points
            .map(p => ({ x: parseFloat(p.xStr), y: parseFloat(p.yStr) }))
            .filter(c => !isNaN(c.x) && !isNaN(c.y));

        if (validCoords.length < 3) {
            return (
                <div className="w-full h-full bg-slate-950/50 rounded-2xl flex flex-col items-center justify-center text-slate-600 border border-slate-800 border-dashed p-8 text-center text-[10px] font-bold uppercase tracking-wider">
                    Chờ đủ 3 tọa độ hợp lệ để xem trước hình học
                </div>
            );
        }

        // Bounding box calculation
        const xs = validCoords.map(c => c.x);
        const ys = validCoords.map(c => c.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const width = maxX - minX || 1;
        const height = maxY - minY || 1;
        
        // Scale to 140x140 with 15px padding inside a 170x170 box
        const size = 170;
        const pad = 20;
        const scaleX = (size - pad * 2) / width;
        const scaleY = (size - pad * 2) / height;
        const scale = Math.min(scaleX, scaleY);

        // Center alignment calculations
        const offsetX = pad + (size - pad * 2 - width * scale) / 2;
        const offsetY = pad + (size - pad * 2 - height * scale) / 2;

        // Map real-world coordinates to SVG pixels
        // X_real is Northing (vertical, increases upwards), so Y_svg = size - mappedY
        // Y_real is Easting (horizontal, increases rightwards), so X_svg = mappedX
        const svgPoints = validCoords.map(c => {
            const mappedX = offsetX + (c.y - minY) * scale;
            const mappedY = size - (offsetY + (c.x - minX) * scale); // Invert Y for screen coordinates
            return `${mappedX},${mappedY}`;
        }).join(' ');

        return (
            <div className="relative w-full h-full bg-slate-950/70 rounded-3xl border border-slate-800 flex flex-col items-center justify-center p-4">
                <span className="absolute top-3 left-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Xem trước thửa đất</span>
                <svg className="w-[170px] h-[170px] drop-shadow-[0_0_15px_rgba(59,130,246,0.2)]" viewBox={`0 0 ${size} ${size}`}>
                    {/* Grid background lines */}
                    <circle cx={size/2} cy={size/2} r={size/2 - 5} fill="none" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2 2" />
                    
                    {/* Polygon path */}
                    <polygon
                        points={svgPoints}
                        fill="rgba(59, 130, 246, 0.15)"
                        stroke="#3b82f6"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                    />

                    {/* Vertices indicator points */}
                    {validCoords.map((c, i) => {
                        const mappedX = offsetX + (c.y - minY) * scale;
                        const mappedY = size - (offsetY + (c.x - minX) * scale);
                        return (
                            <g key={i}>
                                <circle
                                    cx={mappedX}
                                    cy={mappedY}
                                    r="4"
                                    fill="#10b981"
                                    stroke="#1e293b"
                                    strokeWidth="1"
                                />
                                <text
                                    x={mappedX + 6}
                                    y={mappedY - 6}
                                    fill="#94a3b8"
                                    fontSize="8"
                                    fontWeight="bold"
                                    fontFamily="sans-serif"
                                >
                                    {points[i]?.indexStr || (i + 1)}
                                </text>
                            </g>
                        );
                    })}
                </svg>
                <div className="mt-2 text-[9px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1 rounded-full">
                    <CheckCircle size={10} className="text-emerald-500"/> Khép góc thành công
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-[2.5rem] w-full max-w-4xl p-8 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-600/20 p-2.5 rounded-2xl border border-blue-500/30 text-blue-400">
                            <Sparkles size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-white uppercase tracking-tight">Quét Bảng Tọa Độ (OCR)</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Trích xuất tọa độ từ ảnh chụp bản vẽ / sổ đỏ</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-all bg-slate-800 hover:bg-slate-700 p-2 rounded-xl"><X size={20}/></button>
                </div>

                {/* Step 1: Upload */}
                {step === 'upload' && (
                    <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Left: Settings */}
                            <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-5">
                                <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2"><Layers size={14} className="text-blue-500"/> 1. Cấu hình hệ tọa độ</h4>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Hệ tọa độ</label>
                                        <div className="grid grid-cols-2 gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
                                            <button onClick={() => setCoordSystem('VN2000')} className={`py-2 rounded-lg text-xs font-bold uppercase transition-all ${coordSystem === 'VN2000' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>VN-2000</button>
                                            <button onClick={() => setCoordSystem('WGS84')} className={`py-2 rounded-lg text-xs font-bold uppercase transition-all ${coordSystem === 'WGS84' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>WGS-84</button>
                                        </div>
                                    </div>

                                    {coordSystem === 'VN2000' && (
                                        <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-300">
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Kinh tuyến trục</label>
                                                <input
                                                    type="number"
                                                    value={centralMeridian}
                                                    onChange={e => setCentralMeridian(parseFloat(e.target.value))}
                                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-blue-500 font-bold"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Múi chiếu</label>
                                                <select
                                                    value={projectionZone}
                                                    onChange={e => setProjectionZone(e.target.value as Vn2000Zone)}
                                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-blue-500 font-bold"
                                                >
                                                    <option value="3">3 Độ (k = 0.9999)</option>
                                                    <option value="6">6 Độ (k = 0.9996)</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="p-4 bg-blue-900/10 border border-blue-500/20 rounded-2xl flex gap-3 text-blue-300 text-[10px] leading-relaxed">
                                    <HelpCircle size={16} className="shrink-0 text-blue-400 mt-0.5" />
                                    <div>
                                        <p className="font-black uppercase tracking-wider mb-1">Mẹo quét ảnh tối ưu:</p>
                                        <div className="flex items-center gap-1.5 font-bold mb-2 text-[9px] uppercase tracking-wider">
                                            <span className="text-slate-400">Động cơ OCR:</span>
                                            {useNineRouter && nineRouterKey ? (
                                                <span className="text-blue-400 bg-blue-950/40 border border-blue-500/20 px-1.5 py-0.5 rounded font-black">9router</span>
                                            ) : useGemini && geminiKey ? (
                                                <span className="text-purple-400 bg-purple-950/40 border border-purple-500/20 px-1.5 py-0.5 rounded font-black">Google Gemini</span>
                                            ) : (
                                                <span className="text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 px-1.5 py-0.5 rounded font-black">Tesseract Offline</span>
                                            )}
                                        </div>
                                        <ul className="list-disc pl-4 space-y-1 font-bold">
                                            <li className="text-emerald-400 font-extrabold">Cắt (Crop) sát bảng tọa độ: Hãy cắt ảnh chỉ lấy vùng chứa các cột số (Đỉnh, X, Y) để tránh chữ thừa xung quanh gây nhiễu AI.</li>
                                            <li>Chụp ảnh bảng tọa độ vuông góc, rõ nét và không bị bóng mờ.</li>
                                            <li>Vùng chữ số rõ ràng giúp AI nhận diện đúng 99% các con số.</li>
                                            <li>Sau khi quét, bạn có thể chỉnh sửa lại các điểm bị lệch trước khi dựng hình.</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* Right: Upload Area */}
                            <div className="flex flex-col">
                                {imageSrc ? (
                                    <div className="flex-1 bg-slate-950 rounded-3xl border border-slate-800 p-4 flex flex-col items-center justify-center relative group min-h-[220px]">
                                        <img src={imageSrc} alt="Coordinate table draft" className="max-h-[200px] object-contain rounded-xl opacity-90" />
                                        <button
                                            onClick={() => setImageSrc(null)}
                                            className="absolute top-4 right-4 bg-red-600 hover:bg-red-500 text-white p-2 rounded-xl transition-all shadow-lg active:scale-95"
                                            title="Xóa hình ảnh"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex-1 bg-slate-950 hover:bg-slate-900/50 cursor-pointer rounded-3xl border-2 border-dashed border-slate-800 hover:border-blue-500/50 p-8 flex flex-col items-center justify-center text-center gap-4 transition-all min-h-[220px]"
                                    >
                                        <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center border border-slate-800 text-slate-500">
                                            <Upload size={24} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black uppercase text-slate-300 tracking-wider">Tải lên hình ảnh bảng tọa độ</p>
                                            <p className="text-[10px] text-slate-500 mt-1">Hỗ trợ định dạng PNG, JPG, JPEG</p>
                                        </div>
                                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                                    </div>
                                )}
                            </div>
                        </div>

                        {imageSrc && (
                            <button
                                onClick={handleStartScan}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-blue-900/30 transition-all active:scale-95"
                            >
                                <Sparkles size={16} /> BẮT ĐẦU QUÉT ẢNH & TRÍCH XUẤT TOẠ ĐỘ
                            </button>
                        )}
                    </div>
                )}

                {/* Step 2: Scanning */}
                {step === 'scanning' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-6">
                        <div className="relative w-full max-w-md bg-slate-950 rounded-3xl border border-slate-800 p-6 overflow-hidden min-h-[160px] flex items-center justify-center">
                            {imageSrc && <img src={imageSrc} alt="Scanning" className="max-h-[120px] object-contain rounded-lg opacity-30 blur-[1px]" />}
                            
                            {/* Scanning Laser Line */}
                            <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_12px_#3b82f6] animate-pulse" style={{
                                animation: 'scan 2.5s infinite linear',
                                top: '0%'
                            }}></div>
                        </div>

                        <style>{`
                            @keyframes scan {
                                0% { top: 5%; }
                                50% { top: 95%; }
                                100% { top: 5%; }
                            }
                        `}</style>

                        <div className="space-y-2 w-full max-w-md">
                            <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <span>{progressStatus}</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                                <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 3: Edit & Preview */}
                {step === 'edit' && (
                    <div className="flex-1 overflow-hidden flex flex-col md:flex-row gap-6 min-h-0">
                        {/* Left: Coordinate Table */}
                        <div className="flex-1 flex flex-col min-h-0">
                            <div className="flex justify-between items-center mb-3 shrink-0">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">🔍 BẢNG KẾT QUẢ TRÍCH XUẤT ({points.length} điểm)</h4>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSwapXY}
                                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1 transition-all"
                                        title="Hoán đổi cột X và Y"
                                    >
                                        <ArrowLeftRight size={10} /> ĐẢO X ⇄ Y
                                    </button>
                                    <button
                                        onClick={handleAddPoint}
                                        className="px-3 py-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1 transition-all"
                                    >
                                        <Plus size={10} /> THÊM ĐIỂM
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 bg-slate-950 rounded-3xl border border-slate-800 overflow-hidden flex flex-col min-h-0">
                                <div className="overflow-y-auto flex-1 custom-scrollbar">
                                    <table className="w-full text-xs font-mono border-collapse text-left">
                                        <thead className="bg-slate-900 text-slate-500 text-[10px] font-black uppercase tracking-widest sticky top-0 z-10">
                                            <tr>
                                                <th className="p-3 text-center w-12">Điểm</th>
                                                <th className="p-3">Tọa độ X (Northing - m)</th>
                                                <th className="p-3">Tọa độ Y (Easting - m)</th>
                                                <th className="p-3 text-center w-12"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800 text-slate-300">
                                            {points.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="p-12 text-center text-slate-600 italic text-[10px] font-bold uppercase">Không tìm thấy tọa độ. Hãy bấm thêm điểm.</td>
                                                </tr>
                                            ) : points.map((p, i) => (
                                                <tr key={p.id} className="hover:bg-slate-900/30 group">
                                                    <td className="p-2 text-center font-bold text-slate-600">
                                                        <input
                                                            type="text"
                                                            value={p.indexStr}
                                                            onChange={e => handleUpdatePoint(p.id, 'indexStr', e.target.value)}
                                                            className="w-full bg-transparent border-none text-center outline-none focus:text-white font-bold"
                                                        />
                                                    </td>
                                                    <td className="p-2">
                                                        <input
                                                            type="text"
                                                            value={p.xStr}
                                                            onChange={e => handleUpdatePoint(p.id, 'xStr', e.target.value)}
                                                            placeholder="Nhập X..."
                                                            className="w-full bg-transparent border-none text-blue-400 font-bold outline-none focus:bg-slate-900/60 rounded px-2 py-1"
                                                        />
                                                    </td>
                                                    <td className="p-2">
                                                        <input
                                                            type="text"
                                                            value={p.yStr}
                                                            onChange={e => handleUpdatePoint(p.id, 'yStr', e.target.value)}
                                                            placeholder="Nhập Y..."
                                                            className="w-full bg-transparent border-none text-emerald-400 font-bold outline-none focus:bg-slate-900/60 rounded px-2 py-1"
                                                        />
                                                    </td>
                                                    <td className="p-2 text-center">
                                                        <button
                                                            onClick={() => handleDeletePoint(p.id)}
                                                            className="text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Right: SVG Polygon Geometry Preview */}
                        <div className="w-full md:w-[240px] shrink-0 flex flex-col gap-4">
                            <div className="flex-1 min-h-[170px]">
                                {renderSvgPreview()}
                            </div>

                            <div className="bg-slate-950 p-4 rounded-3xl border border-slate-800 text-[9px] font-bold text-slate-500 uppercase tracking-widest space-y-2">
                                <div className="flex justify-between">
                                    <span>Hệ tọa độ:</span>
                                    <span className="text-white">{coordSystem}</span>
                                </div>
                                {coordSystem === 'VN2000' && (
                                    <>
                                        <div className="flex justify-between">
                                            <span>Kinh tuyến trục:</span>
                                            <span className="text-white">{centralMeridian}°</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Múi chiếu:</span>
                                            <span className="text-white">{projectionZone} Độ</span>
                                        </div>
                                    </>
                                )}
                            </div>

                            <details className="bg-slate-950 p-4 rounded-3xl border border-slate-800 text-[9px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer select-none">
                                <summary className="outline-none hover:text-white">Xem văn bản quét thô (Raw OCR)</summary>
                                <textarea
                                    readOnly
                                    value={rawText}
                                    className="w-full mt-2 bg-slate-900 border border-slate-800 text-slate-300 p-2 rounded-xl h-24 font-mono text-[9px] outline-none resize-none cursor-text select-text"
                                    onClick={e => e.stopPropagation()}
                                />
                            </details>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => setStep('upload')}
                                    className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all"
                                >
                                    Quét lại
                                </button>
                                <button
                                    onClick={handlePlotAndDraw}
                                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-1.5 shadow-xl shadow-blue-900/30 transition-all active:scale-95"
                                >
                                    <Play size={12} /> DỰNG HÌNH
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
