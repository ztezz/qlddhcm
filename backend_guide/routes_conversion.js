import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { authenticateToken } from './middleware_auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadRoot = path.join(__dirname, 'uploads');
const cadRoot = path.join(uploadRoot, 'cad-conversions');
const inputRoot = path.join(cadRoot, 'input');
const outputRoot = path.join(cadRoot, 'output');

for (const dir of [uploadRoot, cadRoot, inputRoot, outputRoot]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const MAX_UPLOAD_SIZE = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.dwg', '.dgn']);
const MAX_ACTIVE_JOBS = 2;
const MAX_PENDING_PER_USER = 5;
const JOB_TIMEOUT_MS = 15 * 60 * 1000;
const JOB_TTL_MS = 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

const jobs = new Map();
const queue = [];
let activeJobs = 0;
let cleanupStarted = false;

const getSafeBasename = (name = '') => {
    const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
    return base || 'unknown';
};

const getUserIdFromReq = (req) => {
    const fromToken = req.user?.id || req.user?.userId || req.user?.sub;
    const fromHeader = req.headers['x-user-id'];
    return String(fromToken || fromHeader || 'anonymous').trim();
};

const makeResultPath = (jobId) => path.join(outputRoot, `${jobId}.geojson`);

const cleanupJobFiles = (job) => {
    if (!job) return;
    for (const p of [job.inputPath, job.resultPath]) {
        if (p && fs.existsSync(p)) {
            try { fs.unlinkSync(p); } catch (_) {}
        }
    }
};

const serializeJob = (job) => ({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    sourceFile: job.sourceFile,
    sourceExt: job.sourceExt,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    error: job.error,
    result: job.status === 'succeeded' ? { downloadUrl: `/api/conversions/${job.id}/result` } : null
});

const updateJobStatus = (job, status, progress, error = null) => {
    job.status = status;
    job.progress = progress;
    if (status === 'processing' && !job.startedAt) job.startedAt = new Date().toISOString();
    if (status === 'succeeded' || status === 'failed' || status === 'cancelled') job.finishedAt = new Date().toISOString();
    job.error = error;
};

const createMockGeoJsonResult = (job) => {
    const content = {
        type: 'FeatureCollection',
        features: [],
        metadata: {
            jobId: job.id,
            sourceFile: job.sourceFile,
            note: 'CAD conversion worker chưa được tích hợp (GDAL/ODA). Đây là output mô phỏng để kiểm thử API contract.'
        }
    };
    fs.writeFileSync(job.resultPath, JSON.stringify(content, null, 2), 'utf8');
};

const runJob = async (job, logSystemAction) => {
    const timeoutHandle = setTimeout(() => {
        if (job.status === 'processing') {
            updateJobStatus(job, 'failed', 0, 'Job timeout.');
            cleanupJobFiles(job);
        }
    }, JOB_TIMEOUT_MS);

    try {
        updateJobStatus(job, 'processing', 10, null);

        await new Promise((resolve) => setTimeout(resolve, 300));
        if (job.status === 'cancelled') return;
        updateJobStatus(job, 'processing', 60, null);

        await new Promise((resolve) => setTimeout(resolve, 300));
        if (job.status === 'cancelled') return;

        createMockGeoJsonResult(job);
        updateJobStatus(job, 'succeeded', 100, null);

        await logSystemAction(
            { headers: { 'x-user-id': job.userId, 'x-user-name': encodeURIComponent(job.userName || 'System') } },
            'CAD_CONVERSION_SUCCEEDED',
            `Job ${job.id} hoàn tất cho file ${job.sourceFile}`,
            { id: job.userId, name: job.userName || 'System' }
        );
    } catch (err) {
        updateJobStatus(job, 'failed', 0, err?.message || 'Conversion failed.');
        cleanupJobFiles(job);
        await logSystemAction(
            { headers: { 'x-user-id': job.userId, 'x-user-name': encodeURIComponent(job.userName || 'System') } },
            'CAD_CONVERSION_FAILED',
            `Job ${job.id} thất bại: ${job.error}`,
            { id: job.userId, name: job.userName || 'System' }
        );
    } finally {
        clearTimeout(timeoutHandle);
    }
};

const pumpQueue = async (logSystemAction) => {
    if (activeJobs >= MAX_ACTIVE_JOBS) return;
    const next = queue.shift();
    if (!next) return;

    const job = jobs.get(next);
    if (!job || job.status !== 'queued') return pumpQueue(logSystemAction);

    activeJobs += 1;
    try {
        await runJob(job, logSystemAction);
    } finally {
        activeJobs = Math.max(0, activeJobs - 1);
        setImmediate(() => pumpQueue(logSystemAction));
    }
};

const startCleanupLoop = () => {
    if (cleanupStarted) return;
    cleanupStarted = true;

    setInterval(() => {
        const now = Date.now();
        for (const [jobId, job] of jobs.entries()) {
            const createdAtTs = new Date(job.createdAt).getTime();
            if (!Number.isFinite(createdAtTs)) continue;
            if (now - createdAtTs > JOB_TTL_MS) {
                cleanupJobFiles(job);
                jobs.delete(jobId);
            }
        }
    }, CLEANUP_INTERVAL_MS);
};

const createUpload = () => multer({
    storage: multer.diskStorage({
        destination: (_, __, cb) => cb(null, inputRoot),
        filename: (_, file, cb) => {
            const safeName = getSafeBasename(file.originalname);
            cb(null, `${Date.now()}-${crypto.randomUUID()}-${safeName}`);
        }
    }),
    limits: { fileSize: MAX_UPLOAD_SIZE },
    fileFilter: (_, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(ext)) {
            cb(new Error('Chỉ hỗ trợ file .dwg hoặc .dgn.'));
            return;
        }
        cb(null, true);
    }
});

export default function(pool, logSystemAction) {
    const router = express.Router();
    const upload = createUpload();

    startCleanupLoop();

    router.post('/conversions/cad', authenticateToken, upload.single('file'), async (req, res) => {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: 'Vui lòng upload file CAD (.dwg/.dgn).' });
        }

        const userId = getUserIdFromReq(req);
        const userName = String(req.user?.name || req.headers['x-user-name'] || 'System').trim();

        const queuedByUser = Array.from(jobs.values()).filter(
            (j) => j.userId === userId && (j.status === 'queued' || j.status === 'processing')
        ).length;

        if (queuedByUser >= MAX_PENDING_PER_USER) {
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            return res.status(429).json({ error: `Bạn đã đạt giới hạn ${MAX_PENDING_PER_USER} job đang chờ/xử lý.` });
        }

        const sourceExt = path.extname(file.originalname || '').toLowerCase();
        const sourceFile = getSafeBasename(file.originalname || 'input');
        const jobId = crypto.randomUUID();
        const job = {
            id: jobId,
            userId,
            userName,
            sourceFile,
            sourceExt,
            inputPath: file.path,
            resultPath: makeResultPath(jobId),
            status: 'queued',
            progress: 0,
            createdAt: new Date().toISOString(),
            startedAt: null,
            finishedAt: null,
            error: null
        };

        jobs.set(jobId, job);
        queue.push(jobId);

        await logSystemAction(req, 'CAD_CONVERSION_CREATED', `Tạo job ${jobId} cho file ${sourceFile}`);
        setImmediate(() => pumpQueue(logSystemAction));

        return res.status(202).json({
            jobId,
            status: 'queued',
            progress: 0,
            message: 'Job đã được tạo và đưa vào hàng chờ.'
        });
    });

    router.get('/conversions/:jobId', authenticateToken, async (req, res) => {
        const { jobId } = req.params;
        const job = jobs.get(jobId);
        if (!job) return res.status(404).json({ error: 'Không tìm thấy job.' });

        const userId = getUserIdFromReq(req);
        if (job.userId !== userId && req.user?.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Bạn không có quyền truy cập job này.' });
        }

        return res.json(serializeJob(job));
    });

    router.get('/conversions/:jobId/result', authenticateToken, async (req, res) => {
        const { jobId } = req.params;
        const job = jobs.get(jobId);
        if (!job) return res.status(404).json({ error: 'Không tìm thấy job.' });

        const userId = getUserIdFromReq(req);
        if (job.userId !== userId && req.user?.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Bạn không có quyền truy cập kết quả job này.' });
        }

        if (job.status !== 'succeeded') {
            return res.status(409).json({ error: `Job chưa sẵn sàng. Trạng thái hiện tại: ${job.status}.` });
        }

        if (!fs.existsSync(job.resultPath)) {
            return res.status(404).json({ error: 'Kết quả job không còn tồn tại.' });
        }

        return res.download(job.resultPath, `${path.parse(job.sourceFile).name}.geojson`);
    });

    router.delete('/conversions/:jobId', authenticateToken, async (req, res) => {
        const { jobId } = req.params;
        const job = jobs.get(jobId);
        if (!job) return res.status(404).json({ error: 'Không tìm thấy job.' });

        const userId = getUserIdFromReq(req);
        if (job.userId !== userId && req.user?.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Bạn không có quyền hủy job này.' });
        }

        if (job.status === 'processing') {
            updateJobStatus(job, 'cancelled', 0, 'Job bị hủy bởi người dùng.');
        } else if (job.status === 'queued') {
            updateJobStatus(job, 'cancelled', 0, 'Job bị hủy trước khi xử lý.');
        }

        const queueIdx = queue.indexOf(jobId);
        if (queueIdx >= 0) queue.splice(queueIdx, 1);

        cleanupJobFiles(job);
        jobs.delete(jobId);

        await logSystemAction(req, 'CAD_CONVERSION_CANCELLED', `Hủy job ${jobId}`);
        return res.json({ status: 'ok' });
    });

    router.use((err, req, res, next) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ error: 'File vượt quá kích thước tối đa 50MB.' });
            }
            return res.status(400).json({ error: err.message });
        }

        if (err?.message) {
            return res.status(400).json({ error: err.message });
        }

        return next(err);
    });

    return router;
}
