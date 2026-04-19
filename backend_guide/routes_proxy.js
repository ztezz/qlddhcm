
import express from 'express';
const router = express.Router();

// DANH SÁCH CÁC TÊN MIỀN ĐƯỢC PHÉP PROXY (FORWARD)
const ALLOWED_PROXY_DOMAINS = [
    'vietbando.com',
    'images.vietbando.com',
    'localhost',
    '10.12.32.11',
    'api.datdaihcm.pro',
    'datdaihcm.pro',
    'openstreetmap.org',
    'tile.openstreetmap.org',
    'google.com',
    'mt0.google.com',
    'mt1.google.com',
    'mt2.google.com',
    'mt3.google.com',
    'khm0.google.com',
    'khm1.google.com'
];

const removeNullFieldsDeep = (value) => {
    if (Array.isArray(value)) {
        return value.map(removeNullFieldsDeep);
    }

    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value)
                .filter(([, child]) => child !== null && child !== undefined && !(typeof child === 'string' && child.trim() === ''))
                .map(([key, child]) => [key, removeNullFieldsDeep(child)])
        );
    }

    return value;
};

const sanitizeFeatureInfoPayload = (payload) => {
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.features)) {
        return payload;
    }

    return {
        ...payload,
        features: payload.features.map((feature) => ({
            ...feature,
            properties: removeNullFieldsDeep(feature?.properties || {})
        }))
    };
};

router.get('/vietbando', async (req, res) => {
    const { z, x, y } = req.query;
    if (!z || !x || !y) return res.status(400).send("Missing tile coordinates");
    const targetUrl = `http://images.vietbando.com/ImageLoader/GetImage.ashx?Ver=2016&LayerIds=VBD&Y=${y}&X=${x}&Level=${z}`;
    
    try {
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Referer': 'http://vietbando.com/',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
            }
        });

        if (!response.ok) return res.status(404).send('Tile not found'); 
        const buffer = Buffer.from(await response.arrayBuffer());
        res.set('Content-Type', response.headers.get('content-type') || 'image/png');
        res.set('Cache-Control', 'public, max-age=86400');
        res.set('Access-Control-Allow-Origin', '*');
        res.send(buffer);
    } catch (error) {
        res.status(404).send('Tile error');
    }
});

router.get('/forward', async (req, res) => {
    let targetUrlString = req.query.url;
    if (!targetUrlString) return res.status(400).send("Missing 'url' parameter");

    try {
        const finalUrl = new URL(targetUrlString);
        
        // --- GEO-FENCE BẢO MẬT: CHỈ CHO PHÉP CÁC TÊN MIỀN TRONG WHITELIST ---
        const isAllowed = ALLOWED_PROXY_DOMAINS.some(domain => 
            finalUrl.hostname === domain || finalUrl.hostname.endsWith('.' + domain)
        );

        if (!isAllowed) {
            console.error(`[Security Alert] Unauthorized proxy attempt to: ${finalUrl.hostname}`);
            return res.status(403).json({ 
                error: "Forbidden", 
                message: "Server không được phép tải dữ liệu từ nguồn này." 
            });
        }

        const isStaticTile = /\/\d+\/\d+\/\d+(\.png|\.jpg|\.jpeg)/i.test(targetUrlString);
        
        if (!isStaticTile && !targetUrlString.includes('{z}')) {
            Object.keys(req.query).forEach(key => {
                if (key !== 'url') {
                    finalUrl.searchParams.set(key, req.query[key]);
                }
            });
            const layers = finalUrl.searchParams.get('LAYERS');
            if (layers && !finalUrl.searchParams.get('QUERY_LAYERS')) {
                finalUrl.searchParams.set('QUERY_LAYERS', layers);
            }
        }

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Referer': finalUrl.origin + '/' 
        };

        const response = await fetch(finalUrl.toString(), { headers });

        if (!response.ok) {
            console.error(`[Proxy Fail] Status: ${response.status} URL: ${finalUrl.toString()}`);
            return res.status(response.status).send(`Target server returned ${response.status}`);
        }

        const contentType = response.headers.get('content-type') || '';
        if (contentType) res.set('Content-Type', contentType);
        
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Cache-Control', 'public, max-age=3600'); 

        const requestType = String(finalUrl.searchParams.get('REQUEST') || '').toLowerCase();
        if (contentType.includes('application/json') || requestType === 'getfeatureinfo') {
            const rawText = await response.text();
            try {
                const parsed = JSON.parse(rawText);
                const cleaned = sanitizeFeatureInfoPayload(parsed);
                return res.json(cleaned);
            } catch {
                return res.send(rawText);
            }
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        res.send(buffer);
    } catch (e) {
        console.error(`[Proxy Critical] Error fetching: ${targetUrlString} -> ${e.message}`);
        res.status(502).json({ error: "Gateway Error", message: e.message });
    }
});

export default router;
