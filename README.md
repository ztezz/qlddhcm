<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1SUDSgue8S3DOP3Bw2wsil3-MnCHbRb9b

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run frontend only:
   `npm run dev`
4. Run backend only:
   `npm run dev:backend`
5. Run frontend and backend together in two independent processes:
   `npm run dev:all`

Frontend dev server runs on `http://localhost:3000` and proxies `/api` plus `/uploads` to the backend on `http://localhost:3004`.

## API Configuration

Production frontend domains `geo.gisvn.space` and `qlddhcm.io.vn` now default to:
`https://apigeo.gisvn.space`

You can override the API base URL with Vite environment variables.

Create `.env.local` in the project root when needed:

```env
VITE_API_URL=https://apigeo.gisvn.space
VITE_DEV_API_PROXY_TARGET=https://apigeo.gisvn.space
```

How it works:

1. `VITE_API_URL`: frontend calls this exact API host directly.
2. `VITE_DEV_API_PROXY_TARGET`: Vite proxy forwards `/api` and `/uploads` to this target during local development.
3. If `VITE_API_URL` is not set, production website domains still use `https://apigeo.gisvn.space` by default.
4. If `VITE_API_URL` is not set in local development, frontend keeps using current origin and Vite proxy handles the API routing.
"# qlddhcm"  
