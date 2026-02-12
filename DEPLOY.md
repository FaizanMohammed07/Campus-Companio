# Deployment Guide

This project is structured as a monorepo with separate `FRONTEND` and `BACKEND` directories.

## 1. Backend Deployment (Render)

1.  Create a new **Web Service** on [Render](https://render.com/).
2.  Connect your GitHub repository.
3.  Configure the service:
    - **Root Directory**: `BACKEND`
    - **Build Command**: `npm install && npm run build`
    - **Start Command**: `npm start`
    - **Environment Variables**:
      - `NODE_ENV`: `production`
      - `CORS_ORIGINS`: The URL of your deployed frontend (e.g., `https://campus-companio.vercel.app`). Separate multiple URLs with commas.
      - (Add any other env vars from `.env` here, e.g. database credentials)

4.  Deploy. Once deployed, copy the **Render URL** (e.g., `https://campus-companio-backend.onrender.com`).

---

## 2. Frontend Deployment (Vercel)

1.  Create a new Project on [Vercel](https://vercel.com/new).
2.  Connect your GitHub repository.
3.  Configure the project:
    - **Root Directory**: Click "Edit" and select `FRONTEND`.
    - **Framework Preset**: Vite (should be auto-detected).
    - **Build Command**: `npm run build` (default).
    - **Output Directory**: `dist` (default).
    - **Environment Variables**:
      - `VITE_API_BASE_URL`: The URL of your deployed backend (e.g., `https://campus-companio-backend.onrender.com`).

4.  Deploy.

## Notes on CORS & API Connection

### Option A: Direct Connection (Recommended)

If you set `VITE_API_BASE_URL` in Vercel to your backend URL:

1.  The frontend will fetch directly from the backend.
2.  **You MUST set `CORS_ORIGINS` in Render** to match your Vercel URL (e.g., `https://my-app.vercel.app`), otherwise requests will fail.

### Option B: Proxy via Vercel

If you leave `VITE_API_BASE_URL` empty:

1.  Requests go to `/api/...` on Vercel.
2.  `vercel.json` rewrites them to the backend.
3.  You must edit `FRONTEND/vercel.json` to replace the placeholder backend URL with your actual Render URL.
4.  This avoids some CORS issues, but Option A is more performant.
