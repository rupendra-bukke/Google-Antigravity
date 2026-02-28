# 📱 Trade-Craft — Mobile App (React Native + Expo)

> **Status: Phase 2 — Coming after PWA is live**

---

## 🗺️ Plan

This folder will contain the React Native version of Trade-Craft for Android and iOS.

Both this app and the web app share the **same backend** (Render) and **same database** (Upstash Redis) — only the UI is different.

---

## 🧱 Tech Stack (Planned)

| Layer | Tool | Why |
|-------|------|-----|
| Framework | **Expo + React Native** | We already know React from the web app |
| Navigation | **Expo Router** | File-based routing (same idea as Next.js) |
| HTTP calls | **fetch / axios** | Same backend API endpoints |
| Styling | **NativeWind** | Tailwind-like classes for React Native |
| Icons | **@expo/vector-icons** | Built-in icon library |

---

## 📡 Shared Backend (Already Done)

The mobile app will call the **same Render backend** the web app uses:

```
GET https://your-app.onrender.com/api/v1/checkpoints?symbol=^NSEI
GET https://your-app.onrender.com/api/v1/advanced-analyze?symbol=^NSEI
```

No changes needed on the backend — it already returns JSON that works for both web and mobile.

---

## 🚀 How to Set Up (Future Steps)

```bash
# Step 1: Install Expo CLI
npm install -g expo-cli

# Step 2: Create new project
npx create-expo-app stock-intelligence-mobile
cd stock-intelligence-mobile

# Step 3: Start the dev server
npx expo start

# Step 4: Scan QR code with Expo Go app on your phone
```

---

## 📋 Screens to Build

| Screen | Purpose |
|--------|---------|
| Dashboard | IST clock, market status, 7 checkpoint cards |
| Checkpoint Detail | Full analysis for one checkpoint |
| Settings | Symbol selection (Nifty / BankNifty) |

---

## 📦 Publishing (When Ready)

| Store | Fee | Steps |
|-------|-----|-------|
| Google Play | $25 one-time | `eas build --platform android` → upload APK |
| Apple App Store | $99/year | Needs Mac or EAS cloud build |

---

*Created: Feb 2026 | Phase 1 (PWA) is live — see ../stock-intelligence-app*
