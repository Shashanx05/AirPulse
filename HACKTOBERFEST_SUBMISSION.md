# AirPulse — Instant Phone-to-Desktop Direct File Sharing ⚡

*This is a submission for the [Hacktoberfest Weekend Challenge: Build for a Friend](https://dev.to/challenges/hacktoberfest-weekend-2026-10-01)*

## What I Built

I built **AirPulse**, an ultra-fast, zero-config cross-device file sharing application that lets you instantly transfer files, photos, videos, documents, and clipboard text snippets between your mobile phone and desktop computer using a simple **QR Code scan** or a **6-digit PIN code**.

### The Problem & The Friend I Built It For
My friend (and honestly, almost everyone I know) constantly runs into the annoying hurdle of transferring files between their mobile phone and PC:
- Messaging apps compress photos/videos and clog up personal chat histories.
- Email attachment size limits block large documents and video clips.
- Cloud storage requires logging in, uploading, waiting, sharing links, and managing storage caps.

**AirPulse** solves this by establishing a direct local network / WebRTC bridge between the phone camera scan and the desktop browser. **No app downloads, no account registration, no file size limits, and zero cloud tracking.**

---

## Demo

![AirPulse Demo](https://raw.githubusercontent.com/placeholder/airpulse-demo.png)

### Key Features
- 📱 **QR Code & 6-Digit PIN Pairing**: Scan with your phone camera or enter a quick PIN (e.g. `769-619`) to pair devices in under 2 seconds.
- ⚡ **Bidirectional Transfer**: Send files from **Phone ⇄ Desktop** seamlessly.
- 🚀 **High-Speed Direct Streaming**: Direct WebRTC DataChannels with chunked WebSocket fallback — files stream straight device-to-device.
- 🎨 **Glassmorphism Dark UI**: Built with responsive neon gradients, subtle glowing animations, progress bars with transfer speed (MB/s) and ETA timers.
- 📋 **Clipboard & Text Sharing**: Send quick links, Wi-Fi passwords, or text notes between phone and PC with one click.
- 🔊 **Web Audio Sound Effects**: Subtle audio chimes confirm when a device connects or when a file transfer finishes.

### Live Local Setup
```bash
# Clone the repository & install dependencies
npm install

# Start the local AirPulse server
npm start
```
Open `http://localhost:3000` on your desktop, then scan the displayed QR Code with your mobile phone!

---

## Code

Check out the full open-source repository on GitHub:

{% github https://github.com/Shashanx05/AirPulse/tree/main %}

Direct Link: [https://github.com/Shashanx05/AirPulse/tree/main](https://github.com/Shashanx05/AirPulse/tree/main)

The application is structured into a lightweight, high-performance Node.js backend with an ultra-responsive frontend:

```
├── server.js            # Express server, Socket.io signaling, local IP auto-detection & QR generation
├── package.json         # Dependencies (Express, Socket.io, QRCode, IP)
└── public/
    ├── index.html       # Single Page App layout with pairing hub, dropzone, & received vault
    ├── style.css        # Premium dark glassmorphism styling & keyframe glow animations
    └── app.js           # Socket.io client, WebRTC DataChannel engine, file chunker, & audio synthesizer
```

### Highlights from `server.js` (Local IP & QR Code Engine):
```javascript
// Auto-detect local Wi-Fi IP address for seamless mobile camera scanning
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && !alias.internal) return alias.address;
    }
  }
  return '127.0.0.1';
}

// Generate dynamic QR Code pointing directly to mobile pairing URL
app.get('/api/qrcode', async (req, res) => {
  const text = req.query.text || `http://${localIp}:${PORT}`;
  const qrDataUrl = await QRCode.toDataURL(text, { margin: 2, scale: 8 });
  res.json({ dataUrl: qrDataUrl });
});
```

---

## How I Built It

AirPulse was built using an open tech stack centered around modern web standards:
- **Node.js & Express**: Provides static file serving and dynamic API routes for network detection.
- **Socket.io**: Real-time room management and signaling server for instant pairing.
- **WebRTC DataChannels**: Peer-to-peer binary data channel for low-latency direct file streaming.
- **Vanilla HTML5 / CSS3 / Web Audio API**: Clean, dependency-free frontend with glassmorphic aesthetics and audio feedback.

I built this project with the assistance of **Antigravity AI**, an agentic coding assistant that helped plan the architecture, scaffold the WebSocket signaling pipeline, design the responsive CSS glassmorphism layout, and polish the user experience.

---

## Why Does Open Innovation Matter?

Open innovation and open standards (such as **WebRTC**, **WebSockets**, and **Open-Source Node.js packages**) are fundamental to building tools like AirPulse:

1. **Privacy & Security**: File transfers happen locally between devices on your network. Closed, proprietary platforms force user data through corporate servers, harvesting metadata or charging subscription fees for basic file sharing.
2. **Interoperability**: Open web standards break down artificial walled gardens (like Apple AirDrop or Android Quick Share) by allowing **any** phone (iOS/Android) to share files with **any** desktop OS (Windows, macOS, Linux) without installing proprietary software.
3. **Zero Friction**: Open web technologies make it possible to turn any browser tab into a file-sharing receiver in seconds.

---

## My Agent Session

This project was created in pair programming collaboration with **Antigravity AI Assistant**. The agent helped iterate on real-time WebRTC data channel chunking, responsive glassmorphism CSS, and local IP detection.

---

## Prize Categories

- **Build for a Friend**: Solved the daily struggle of cross-platform file transfers between mobile and PC.
- **Open Innovation / Web Applications**: Built entirely on open web standards (WebRTC, WebSockets, HTML5).
