# How to Deploy AirPulse (Free 24/7 Hosting)

When you deploy your application to **GitHub Pages**, GitHub only hosts static HTML/CSS/JS files (`public/`). GitHub Pages **does not run Node.js backend servers** (`server.js`), which causes the app to show **"Disconnected"**.

To make AirPulse **ALWAYS RUNNING** online, follow this 2-minute free deployment guide!

---

## 🚀 Option 1: Free Render.com Host (Recommended - Always Online)

1. **Sign up / Log in to [Render.com](https://render.com)** (Free).
2. Click **New +** → Select **Web Service**.
3. Connect your GitHub repository: `Shashanx05/AirPulse`.
4. Configure the settings:
   - **Name**: `airpulse-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: `Free`
5. Click **Create Web Service**.
6. Render will build your app and give you a free URL (e.g. `https://airpulse-backend.onrender.com`).

### Link your GitHub Pages frontend to your Render backend:
- Open your GitHub Pages site (`https://shashanx05.github.io/AirPulse/`).
- Click the **Server Settings** icon (top right navbar).
- Enter your Render backend URL (`https://airpulse-backend.onrender.com`) and click **Save & Connect**.
- **Done!** Your site is now live 24/7 on GitHub Pages with instant phone-to-desktop pairing!

---

## 💻 Option 2: Local Wi-Fi Host (Running on your PC)

If you are running `node server.js` on your PC:
1. Start the server locally:
   ```bash
   node server.js
   ```
2. Open your GitHub Pages site or local browser.
3. Click **Server Settings** in the top navbar and enter your computer's local IP address (e.g. `http://192.168.1.15:3000`).
