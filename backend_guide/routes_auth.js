
import express from 'express';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './middleware_auth.js';

const CAPTCHA_TTL_MS = 2 * 60 * 1000;
const CAPTCHA_VERIFY_TOKEN_TTL_MS = 2 * 60 * 1000;
const CAPTCHA_REFRESH_WINDOW_MS = 60 * 1000;
const CAPTCHA_REFRESH_MAX_PER_WINDOW = 8;
const CAPTCHA_REFRESH_BLOCK_MS = 2 * 60 * 1000;
const captchaStore = new Map();
const captchaVerificationStore = new Map();
const captchaRefreshStore = new Map();
const CAPTCHA_CODE_LENGTH = 5;
const CAPTCHA_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_FAILED_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const LOCK_DURATION_MS = 10 * 60 * 1000;
const loginAttemptStore = new Map();

// Hàm tạo mã OTP 6 số
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateCaptchaCode = (length = CAPTCHA_CODE_LENGTH) => {
    let code = '';
    for (let i = 0; i < length; i += 1) {
        const randomIndex = Math.floor(Math.random() * CAPTCHA_CHARS.length);
        code += CAPTCHA_CHARS[randomIndex];
    }
    return code;
};

const buildCaptchaSvg = (captchaText) => {
    const width = 180;
    const height = 56;
    const chars = captchaText.split('');
    const charSpacing = 28;
    const leftPadding = 22;

    const textNodes = chars.map((char, index) => {
        const x = leftPadding + index * charSpacing + Math.floor(Math.random() * 4);
        const y = 38 + Math.floor(Math.random() * 5) - 2;
        const rotate = Math.floor(Math.random() * 30) - 15;
        const color = ['#1d4ed8', '#0f766e', '#7c3aed', '#be123c'][Math.floor(Math.random() * 4)];
        return `<text x="${x}" y="${y}" transform="rotate(${rotate} ${x} ${y})" font-size="30" font-family="Verdana, sans-serif" font-weight="700" fill="${color}">${char}</text>`;
    }).join('');

    const noiseLines = Array.from({ length: 6 }).map(() => {
        const x1 = Math.floor(Math.random() * width);
        const x2 = Math.floor(Math.random() * width);
        const y1 = Math.floor(Math.random() * height);
        const y2 = Math.floor(Math.random() * height);
        const stroke = ['#93c5fd', '#a7f3d0', '#fbcfe8', '#fde68a'][Math.floor(Math.random() * 4)];
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="1.5" />`;
    }).join('');

    const noiseDots = Array.from({ length: 30 }).map(() => {
        const cx = Math.floor(Math.random() * width);
        const cy = Math.floor(Math.random() * height);
        const r = Math.random() * 1.6 + 0.4;
        return `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(2)}" fill="#94a3b8" opacity="0.45" />`;
    }).join('');

    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="captcha">
            <defs>
                <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#eff6ff" />
                    <stop offset="100%" stop-color="#dbeafe" />
                </linearGradient>
            </defs>
            <rect x="0" y="0" width="${width}" height="${height}" rx="10" ry="10" fill="url(#bg)" stroke="#bfdbfe" />
            ${noiseLines}
            ${noiseDots}
            ${textNodes}
        </svg>
    `.trim();

    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
};

const generateCaptchaChallenge = () => {
    const captchaCode = generateCaptchaCode();
    const challengeId = crypto.randomUUID();

    captchaStore.set(challengeId, {
        answer: captchaCode.toLowerCase(),
        expiresAt: Date.now() + CAPTCHA_TTL_MS
    });

    return {
        challengeId,
        imageDataUrl: buildCaptchaSvg(captchaCode)
    };
};

const cleanupCaptchaStore = () => {
    const now = Date.now();
    for (const [id, value] of captchaStore.entries()) {
        if (!value || value.expiresAt <= now) {
            captchaStore.delete(id);
        }
    }

    for (const [token, value] of captchaVerificationStore.entries()) {
        if (!value || value.expiresAt <= now) {
            captchaVerificationStore.delete(token);
        }
    }

    for (const [key, value] of captchaRefreshStore.entries()) {
        if (!value) {
            captchaRefreshStore.delete(key);
            continue;
        }
        const windowExpired = !value.blockedUntil && now - (value.windowStartedAt || 0) > CAPTCHA_REFRESH_WINDOW_MS;
        const blockExpired = value.blockedUntil && value.blockedUntil <= now;
        if (windowExpired || blockExpired) {
            captchaRefreshStore.delete(key);
        }
    }
};

const cleanupLoginAttemptStore = () => {
    const now = Date.now();
    for (const [key, value] of loginAttemptStore.entries()) {
        if (!value) {
            loginAttemptStore.delete(key);
            continue;
        }
        const isExpired = !value.lockedUntil && (!value.lastFailedAt || now - value.lastFailedAt > ATTEMPT_WINDOW_MS);
        const lockExpired = value.lockedUntil && value.lockedUntil <= now;
        if (isExpired || lockExpired) {
            loginAttemptStore.delete(key);
        }
    }
};

const getClientIp = (req) => {
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (typeof xForwardedFor === 'string' && xForwardedFor.trim()) {
        return xForwardedFor.split(',')[0].trim();
    }
    return req.ip || 'unknown';
};

const getAttemptKey = (req, identity) => `${String(identity || '').toLowerCase()}|${getClientIp(req)}`;


const getRefreshRateLimitKey = (req) => `captcha-refresh|${getClientIp(req)}`;

const createCaptchaVerificationToken = (req, challengeId) => {
    const token = crypto.randomUUID();
    captchaVerificationStore.set(token, {
        challengeId,
        clientIp: getClientIp(req),
        expiresAt: Date.now() + CAPTCHA_VERIFY_TOKEN_TTL_MS
    });
    return token;
};

const checkCaptchaRefreshRateLimit = (req) => {
    const now = Date.now();
    const key = getRefreshRateLimitKey(req);
    const current = captchaRefreshStore.get(key);

    if (!current || !current.windowStartedAt || now - current.windowStartedAt > CAPTCHA_REFRESH_WINDOW_MS) {
        captchaRefreshStore.set(key, { windowStartedAt: now, count: 1, blockedUntil: null });
        return { allowed: true, retryAfterSec: 0 };
    }

    if (current.blockedUntil && current.blockedUntil > now) {
        return { allowed: false, retryAfterSec: Math.ceil((current.blockedUntil - now) / 1000) };
    }

    const nextCount = (current.count || 0) + 1;
    if (nextCount > CAPTCHA_REFRESH_MAX_PER_WINDOW) {
        const blockedUntil = now + CAPTCHA_REFRESH_BLOCK_MS;
        captchaRefreshStore.set(key, {
            windowStartedAt: current.windowStartedAt,
            count: nextCount,
            blockedUntil
        });
        return { allowed: false, retryAfterSec: Math.ceil(CAPTCHA_REFRESH_BLOCK_MS / 1000) };
    }

    captchaRefreshStore.set(key, {
        windowStartedAt: current.windowStartedAt,
        count: nextCount,
        blockedUntil: null
    });

    return { allowed: true, retryAfterSec: 0 };
};

const getLockRemainingSeconds = (attemptInfo) => {
    if (!attemptInfo?.lockedUntil) return 0;
    return Math.max(0, Math.ceil((attemptInfo.lockedUntil - Date.now()) / 1000));
};

const recordFailedAttempt = (attemptKey) => {
    const now = Date.now();
    const current = loginAttemptStore.get(attemptKey);

    if (!current || !current.lastFailedAt || now - current.lastFailedAt > ATTEMPT_WINDOW_MS) {
        loginAttemptStore.set(attemptKey, { count: 1, lastFailedAt: now, lockedUntil: null });
        return { count: 1, lockedUntil: null };
    }

    const nextCount = (current.count || 0) + 1;
    const next = {
        count: nextCount,
        lastFailedAt: now,
        lockedUntil: nextCount >= MAX_FAILED_ATTEMPTS ? now + LOCK_DURATION_MS : null
    };
    loginAttemptStore.set(attemptKey, next);
    return next;
};

// Hàm lấy cấu hình mail từ DB và tạo Transporter
const createDynamicTransporter = async (pool) => {
    try {
        const res = await pool.query(`
            SELECT key, value FROM system_settings 
            WHERE key IN ('mail_host', 'mail_port', 'mail_user', 'mail_pass', 'mail_from_name', 'mail_from_email', 'system_name')
        `);
        
        const settings = {};
        res.rows.forEach(r => settings[r.key] = r.value);

        // Fallback sang biến môi trường nếu DB chưa cấu hình
        if (!settings.mail_host || !settings.mail_user || !settings.mail_pass) {
            if (process.env.MAIL_HOST && process.env.MAIL_USER && process.env.MAIL_PASS) {
                console.log("📧 Dùng cấu hình SMTP từ biến môi trường (.env)");
                settings.mail_host      = process.env.MAIL_HOST;
                settings.mail_port      = process.env.MAIL_PORT || '587';
                settings.mail_user      = process.env.MAIL_USER;
                settings.mail_pass      = process.env.MAIL_PASS;
                settings.mail_from_name = process.env.MAIL_FROM_NAME || settings.mail_from_name;
                settings.mail_from_email = process.env.MAIL_FROM_EMAIL || settings.mail_from_email;
            } else {
                console.warn("⚠️ Mail Server chưa được cấu hình đầy đủ trong System Settings.");
                return null;
            }
        }

        settings.mail_from_email = settings.mail_from_email || process.env.MAIL_FROM_EMAIL || settings.mail_user;

        const transporter = nodemailer.createTransport({
            host: settings.mail_host,
            port: parseInt(settings.mail_port) || 587, // Mặc định 587 nếu không nhập
            secure: parseInt(settings.mail_port) === 465, // True nếu port 465 (SSL), False nếu 587 (TLS)
            auth: {
                user: settings.mail_user,
                pass: settings.mail_pass
            }
        });

        // Test kết nối
        await transporter.verify();
        
        return { 
            transporter, 
            from: `"${settings.mail_from_name || settings.system_name || 'GeoMaster System'}" <${settings.mail_from_email}>`,
            systemName: settings.system_name || 'GeoMaster'
        };
    } catch (error) {
        console.error("❌ Lỗi kết nối Mail Server:", error.message);
        return null;
    }
};

// Hàm tạo giao diện Email OTP chuyên nghiệp
const getHtmlTemplate = (systemName, title, greetingName, message, code) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; margin: 0; padding: 0; color: #cbd5e1; }
            .container { max-width: 600px; margin: 40px auto; background-color: #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.3); border: 1px solid #334155; }
            .header { background-color: #0f172a; padding: 30px; text-align: center; border-bottom: 1px solid #334155; }
            .logo { color: #3b82f6; font-size: 28px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; margin: 0; text-decoration: none; }
            .badge { background-color: #2563eb; color: white; font-size: 10px; padding: 2px 6px; border-radius: 4px; vertical-align: middle; margin-left: 8px; }
            .content { padding: 40px 30px; text-align: center; }
            .title { color: #f8fafc; font-size: 22px; font-weight: 700; margin-top: 0; margin-bottom: 20px; }
            .text { font-size: 15px; line-height: 1.6; color: #94a3b8; margin-bottom: 20px; text-align: left; }
            .otp-box { 
                background-color: #0f172a; 
                border: 2px dashed #3b82f6; 
                border-radius: 12px; 
                padding: 20px; 
                margin: 30px 0; 
                text-align: center;
            }
            .otp-code { 
                font-size: 36px; 
                font-weight: 900; 
                color: #3b82f6; 
                letter-spacing: 8px; 
                font-family: 'Courier New', Courier, monospace; 
            }
            .footer { background-color: #0f172a; padding: 25px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #334155; }
            strong { color: #e2e8f0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">${systemName}<span class="badge">SECURE</span></div>
            </div>
            <div class="content">
                <h1 class="title">${title}</h1>
                <p class="text">Xin chào <strong>${greetingName}</strong>,</p>
                <p class="text">${message}</p>
                
                <div class="otp-box">
                    <div class="otp-code">${code}</div>
                </div>
                
                <p class="text" style="font-size: 13px; text-align: center;">Mã xác thực này có hiệu lực trong vòng 15 phút.<br/>Tuyệt đối không chia sẻ mã này cho bất kỳ ai.</p>
            </div>
            <div class="footer">
                <p>&copy; ${new Date().getFullYear()} ${systemName}. All rights reserved.</p>
                <p>Email này được gửi tự động từ hệ thống.</p>
            </div>
        </div>
    </body>
    </html>
    `;
};

export default function(pool, logSystemAction) {
    const router = express.Router();
    // --- CAPTCHA CHALLENGE ---
    router.get('/captcha-challenge', async (req, res) => {
        cleanupCaptchaStore();
        const challenge = generateCaptchaChallenge();
        res.json({
            challengeId: challenge.challengeId,
            imageDataUrl: challenge.imageDataUrl,
            question: 'Nhap ma trong hinh',
            codeLength: CAPTCHA_CODE_LENGTH,
            expiresInSec: CAPTCHA_TTL_MS / 1000
        });
    });

    // --- CAPTCHA REFRESH (RATE LIMITED) ---
    router.get('/captcha-refresh', async (req, res) => {
        cleanupCaptchaStore();
        const rateLimit = checkCaptchaRefreshRateLimit(req);
        if (!rateLimit.allowed) {
            return res.status(429).json({
                error: `Ban dang lam moi CAPTCHA qua nhanh. Vui long thu lai sau ${rateLimit.retryAfterSec} giay.`,
                retryAfterSec: rateLimit.retryAfterSec
            });
        }

        const challenge = generateCaptchaChallenge();
        res.json({
            challengeId: challenge.challengeId,
            imageDataUrl: challenge.imageDataUrl,
            question: 'Nhap ma trong hinh',
            codeLength: CAPTCHA_CODE_LENGTH,
            expiresInSec: CAPTCHA_TTL_MS / 1000
        });
    });

    // --- CAPTCHA VERIFY ---
    router.post('/captcha-verify', async (req, res) => {
        const { captchaChallengeId, captchaAnswer, turnstileToken } = req.body;

        cleanupCaptchaStore();

        // Support Cloudflare Turnstile verify
        if (turnstileToken) {
            try {
                const secretKey = process.env.TURNSTILE_SECRET_KEY || '1x00000000000000000000000000000000';
                const verifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
                
                const response = await fetch(verifyUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        secret: secretKey,
                        response: turnstileToken,
                        remoteip: getClientIp(req)
                    })
                });

                const result = await response.json();
                if (!result.success) {
                    return res.status(400).json({ error: "Xác thực Turnstile CAPTCHA thất bại hoặc đã hết hạn." });
                }

                const captchaVerificationToken = createCaptchaVerificationToken(req, 'turnstile');
                return res.json({
                    captchaVerificationToken,
                    expiresInSec: CAPTCHA_VERIFY_TOKEN_TTL_MS / 1000
                });
            } catch (err) {
                console.error("Turnstile verification error:", err);
                return res.status(500).json({ error: "Lỗi kết nối tới hệ thống xác thực CAPTCHA." });
            }
        }

        const submittedAnswer = String(captchaAnswer || '').trim().toLowerCase();

        const challenge = captchaStore.get(captchaChallengeId);
        if (!captchaChallengeId || !challenge) {
            return res.status(400).json({ error: "CAPTCHA khong hop le hoac da het han. Vui long thu lai." });
        }

        if (challenge.expiresAt <= Date.now()) {
            captchaStore.delete(captchaChallengeId);
            return res.status(400).json({ error: "CAPTCHA da het han. Vui long tai lai ma." });
        }

        if (!submittedAnswer || submittedAnswer !== challenge.answer) {
            captchaStore.delete(captchaChallengeId);
            return res.status(400).json({ error: "Ma CAPTCHA khong chinh xac." });
        }

        captchaStore.delete(captchaChallengeId);
        const captchaVerificationToken = createCaptchaVerificationToken(req, captchaChallengeId);

        res.json({
            captchaVerificationToken,
            expiresInSec: CAPTCHA_VERIFY_TOKEN_TTL_MS / 1000
        });
    });
    // --- LOGIN ---
    router.post('/login', async (req, res) => {
        const { identifier, email, password, captchaVerificationToken } = req.body;
        const identity = (identifier || email || '').trim();

        cleanupLoginAttemptStore();
        cleanupCaptchaStore();

        try {
            if (!identity) {
                return res.status(400).json({ error: "Vui long nhap email hoac ten tai khoan." });
            }

            const attemptKey = getAttemptKey(req, identity);
            const attemptInfo = loginAttemptStore.get(attemptKey);
            if (attemptInfo?.lockedUntil && attemptInfo.lockedUntil > Date.now()) {
                const remainingSec = getLockRemainingSeconds(attemptInfo);
                return res.status(429).json({ error: `Dang nhap bi tam khoa. Vui long thu lai sau ${remainingSec} giay.` });
            }

            if (!captchaVerificationToken) {
                recordFailedAttempt(attemptKey);
                return res.status(400).json({ error: "Vui long xac thuc CAPTCHA truoc khi dang nhap." });
            }

            const verifyInfo = captchaVerificationStore.get(captchaVerificationToken);
            if (!verifyInfo || verifyInfo.expiresAt <= Date.now()) {
                captchaVerificationStore.delete(captchaVerificationToken);
                recordFailedAttempt(attemptKey);
                return res.status(400).json({ error: "Phien xac thuc CAPTCHA khong hop le hoac da het han." });
            }

            if (verifyInfo.clientIp && verifyInfo.clientIp !== getClientIp(req)) {
                captchaVerificationStore.delete(captchaVerificationToken);
                recordFailedAttempt(attemptKey);
                return res.status(400).json({ error: "Xac thuc CAPTCHA khong khop thiet bi hoac ket noi." });
            }

            captchaVerificationStore.delete(captchaVerificationToken);

            const result = await pool.query(
                `SELECT * FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1) OR LOWER(name) = LOWER($1) LIMIT 1`,
                [identity]
            );
            const user = result.rows[0];

            if (!user || user.password_hash !== password) {
                const failed = recordFailedAttempt(attemptKey);
                if (failed.lockedUntil) {
                    const remainingSec = getLockRemainingSeconds(failed);
                    return res.status(429).json({ error: `Ban da nhap sai qua nhieu lan. Khoa tam thoi ${remainingSec} giay.` });
                }
                return res.status(401).json({ error: "Email/ten tai khoan hoac mat khau khong dung." });
            }

            loginAttemptStore.delete(attemptKey);

            if (user.is_verified === false) {
                return res.status(403).json({ error: "Tai khoan chua kich hoat. Vui long kiem tra email lay ma xac thuc." });
            }

            const userData = {
                id: user.id, email: user.email, username: user.username, name: user.name,
                role: user.role, branchId: user.branch_id, avatar: user.avatar
            };

            // Generate JWT Token
            const token = jwt.sign(
                { id: user.id, role: user.role, branchId: user.branch_id },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            await logSystemAction(req, 'LOGIN', 'Dang nhap thanh cong', userData);

            // Return both user info and token
            res.json({ user: userData, token });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- REGISTER ---
    router.post('/register', async (req, res) => {
        const { name, email, username, branchId, password } = req.body;
        const accountPassword = String(password || '123');
        const code = generateOTP();
        
        try {
            const check = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
            if (check.rows.length > 0) return res.status(400).json({ error: "Email đã tồn tại." });

            if (username) {
                const usernameCheck = await pool.query(`SELECT id FROM users WHERE LOWER(username) = LOWER($1)`, [username]);
                if (usernameCheck.rows.length > 0) return res.status(400).json({ error: "Tên đăng nhập đã tồn tại." });
            }

            const id = 'u-' + Date.now();
            await pool.query(
                `INSERT INTO users (id, email, username, password_hash, name, role, branch_id, is_verified, verification_token) 
                 VALUES ($1, $2, $3, $4, $5, 'VIEWER', $6, false, $7)`,
                [id, email, username || null, accountPassword, name, branchId, code]
            );

            // Gửi mail async (không chặn response)
            (async () => {
                const mailConfig = await createDynamicTransporter(pool);
                if (mailConfig) {
                    const htmlContent = getHtmlTemplate(
                        mailConfig.systemName,
                        'Mã xác thực đăng ký',
                        name,
                        'Cảm ơn bạn đã đăng ký tài khoản. Sử dụng mã code bên dưới để kích hoạt tài khoản của bạn.',
                        code
                    );
                    await mailConfig.transporter.sendMail({
                        from: mailConfig.from,
                        to: email,
                        subject: `[${code}] Mã xác thực tài khoản`,
                        html: htmlContent
                    });
                }
            })();

            res.json({ status: 'ok', message: 'Mã xác thực đã được gửi đến email.' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- VERIFY ACCOUNT (REGISTER OTP) ---
    router.post('/verify-email', async (req, res) => {
        const { email, code } = req.body;
        try {
            const result = await pool.query(
                `UPDATE users SET is_verified = true, verification_token = NULL 
                 WHERE email = $1 AND verification_token = $2 
                 RETURNING id`, 
                [email, code]
            );
            
            if (result.rows.length === 0) return res.status(400).json({ error: "Mã xác thực không đúng hoặc đã hết hạn." });
            res.json({ status: 'ok' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- FORGOT PASSWORD (REQUEST OTP) ---
    router.post('/forgot-password', async (req, res) => {
        const { identifier, email } = req.body;
        const identity = (identifier || email || '').trim();
        try {
            if (!identity) {
                return res.status(400).json({ error: "Vui lòng nhập email hoặc tên tài khoản." });
            }

            const userCheck = await pool.query(
                `SELECT id, name, email FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1) OR LOWER(name) = LOWER($1) LIMIT 1`,
                [identity]
            );
            if (userCheck.rows.length === 0) return res.status(404).json({ error: "Email hoặc tên tài khoản không tồn tại." });
            
            const userName = userCheck.rows[0].name || "Người dùng";
            const targetEmail = userCheck.rows[0].email;
            const code = generateOTP();
            const expires = new Date(Date.now() + 15 * 60 * 1000); 

            await pool.query(`DELETE FROM password_reset_tokens WHERE email = $1`, [targetEmail]);
            await pool.query(`INSERT INTO password_reset_tokens (email, token, expires_at) VALUES ($1, $2, $3)`, [targetEmail, code, expires]);

            (async () => {
                const mailConfig = await createDynamicTransporter(pool);
                if (mailConfig) {
                    const htmlContent = getHtmlTemplate(
                        mailConfig.systemName,
                        'Yêu cầu đặt lại mật khẩu',
                        userName,
                        'Chúng tôi nhận được yêu cầu khôi phục mật khẩu. Nhập mã bên dưới vào ứng dụng để đặt lại mật khẩu mới.',
                        code
                    );
                    await mailConfig.transporter.sendMail({
                        from: mailConfig.from,
                        to: targetEmail,
                        subject: `[${code}] Mã xác thực khôi phục mật khẩu`,
                        html: htmlContent
                    });
                }
            })();

            res.json({ status: 'ok', message: 'Mã OTP đã được gửi.' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- RESET PASSWORD (SUBMIT OTP) ---
    router.post('/reset-password', async (req, res) => {
        const { email, identifier, code, newPassword } = req.body;
        const identity = (identifier || email || '').trim();
        try {
            if (!identity) {
                return res.status(400).json({ error: "Vui lòng nhập email hoặc tên tài khoản." });
            }

            const userRes = await pool.query(
                `SELECT email FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(name) = LOWER($1) LIMIT 1`,
                [identity]
            );
            if (userRes.rows.length === 0) {
                return res.status(404).json({ error: "Tài khoản không tồn tại." });
            }

            const targetEmail = userRes.rows[0].email;
            const tokenRes = await pool.query(`SELECT * FROM password_reset_tokens WHERE email = $1 AND token = $2 AND expires_at > NOW()`, [targetEmail, code]);
            if (tokenRes.rows.length === 0) return res.status(400).json({ error: "Mã OTP sai hoặc đã hết hạn." });

            await pool.query(`UPDATE users SET password_hash = $1 WHERE email = $2`, [newPassword, targetEmail]);
            await pool.query(`DELETE FROM password_reset_tokens WHERE email = $1`, [targetEmail]);
            res.json({ status: 'ok' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    return router;
}
