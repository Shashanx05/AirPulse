// ==========================================================================
// AirPulse - Client Application Logic (WebRTC & Socket.io Direct Transfer)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const connectionStatus = document.getElementById('connectionStatus');
  const statusDot = connectionStatus.querySelector('.status-dot');
  const statusText = connectionStatus.querySelector('.status-text');
  
  const qrImage = document.getElementById('qrImage');
  const qrSpinner = document.getElementById('qrSpinner');
  const pinDisplay = document.getElementById('pinDisplay');
  const shareUrlInput = document.getElementById('shareUrlInput');
  const copyUrlBtn = document.getElementById('copyUrlBtn');
  
  const tabHostBtn = document.getElementById('tabHostBtn');
  const tabJoinBtn = document.getElementById('tabJoinBtn');
  const hostTabContent = document.getElementById('hostTabContent');
  const joinTabContent = document.getElementById('joinTabContent');
  const pinInput = document.getElementById('pinInput');
  const joinRoomBtn = document.getElementById('joinRoomBtn');
  
  const deviceCount = document.getElementById('deviceCount');
  const devicesList = document.getElementById('devicesList');
  
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const browseFilesBtn = document.getElementById('browseFilesBtn');
  
  const transferProgressCard = document.getElementById('transferProgressCard');
  const progressFileName = document.getElementById('progressFileName');
  const progressSubtext = document.getElementById('progressSubtext');
  const progressPercent = document.getElementById('progressPercent');
  const progressFill = document.getElementById('progressFill');
  
  const receivedCount = document.getElementById('receivedCount');
  const receivedFilesGrid = document.getElementById('receivedFilesGrid');
  const downloadAllBtn = document.getElementById('downloadAllBtn');
  
  const textShareInput = document.getElementById('textShareInput');
  const sendTextBtn = document.getElementById('sendTextBtn');
  const textSnippetsList = document.getElementById('textSnippetsList');
  const soundToggleBtn = document.getElementById('soundToggleBtn');

  // App State
  let socket = null;
  let currentRoom = null;
  let soundEnabled = true;
  let receivedFiles = [];
  let peerConnection = null;
  let dataChannel = null;
  
  // File Transfer State
  let activeIncomingFile = null;
  let activeOutgoingFile = null;
  const CHUNK_SIZE = 64 * 1024; // 64KB per chunk

  // Detect user agent device type
  function getDeviceInfo() {
    const ua = navigator.userAgent;
    let name = 'Desktop Browser';
    let type = 'desktop';

    if (/iPhone/i.test(ua)) { name = 'iPhone'; type = 'mobile'; }
    else if (/iPad/i.test(ua)) { name = 'iPad'; type = 'tablet'; }
    else if (/Android/i.test(ua)) { name = 'Android Phone'; type = 'mobile'; }
    else if (/Macintosh/i.test(ua)) { name = 'Mac Computer'; type = 'desktop'; }
    else if (/Windows/i.test(ua)) { name = 'Windows PC'; type = 'desktop'; }

    return { name, type };
  }

  const deviceData = getDeviceInfo();

  // Initialize Socket.io Connection
  socket = io();

  // Parse URL Parameters
  const urlParams = new URLSearchParams(window.location.search);
  const codeParam = urlParams.get('code');

  if (codeParam) {
    // Auto-join mode for mobile QR code scans
    switchTab('join');
    pinInput.value = codeParam;
    joinRoom(codeParam);
  } else {
    // Default Host mode
    socket.emit('create-room', deviceData);
  }

  // Socket Events
  socket.on('connect', () => {
    updateStatus('waiting', 'Connecting session...');
  });

  socket.on('room-created', ({ code, shareUrl, devices }) => {
    currentRoom = code;
    pinDisplay.textContent = code.replace(/(\d{3})(\d{3})/, '$1-$2');
    shareUrlInput.value = shareUrl;
    updateStatus('waiting', 'Waiting for mobile device...');
    loadQRCode(shareUrl);
    updateDevicesList(devices);
  });

  socket.on('room-joined', ({ code, devices }) => {
    currentRoom = code;
    pinDisplay.textContent = code.replace(/(\d{3})(\d{3})/, '$1-$2');
    updateStatus('online', 'Connected to Session');
    updateDevicesList(devices);
    showToast('Successfully connected to session!', 'success');
  });

  socket.on('join-error', ({ message }) => {
    showToast(message, 'error');
    updateStatus('offline', 'Disconnected');
  });

  socket.on('device-connected', ({ device, devices }) => {
    updateDevicesList(devices);
    updateStatus('online', `Connected with ${device.name}`);
    playChimeSound('connect');
    showToast(`${device.name} joined the room!`, 'info');
    setupWebRTC(true); // Host initiates WebRTC
  });

  socket.on('device-disconnected', ({ devices }) => {
    updateDevicesList(devices);
    if (devices.length <= 1) {
      updateStatus('waiting', 'Waiting for device...');
    }
    showToast('A device left the room', 'info');
  });

  // Chunked Socket File Transfers (Fallback & Signal)
  socket.on('file-meta', (meta) => {
    activeIncomingFile = {
      id: meta.id,
      name: meta.name,
      size: meta.size,
      type: meta.type,
      receivedSize: 0,
      chunks: [],
      startTime: Date.now()
    };
    showProgressCard(meta.name, meta.size);
  });

  socket.on('file-chunk', (chunkData) => {
    if (!activeIncomingFile || activeIncomingFile.id !== chunkData.id) return;

    // Convert array back to ArrayBuffer
    const buffer = new Uint8Array(chunkData.chunk).buffer;
    activeIncomingFile.chunks.push(buffer);
    activeIncomingFile.receivedSize += buffer.byteLength;

    updateProgress(activeIncomingFile.receivedSize, activeIncomingFile.size, activeIncomingFile.startTime);

    if (activeIncomingFile.receivedSize >= activeIncomingFile.size) {
      finalizeReceivedFile(activeIncomingFile);
      activeIncomingFile = null;
    }
  });

  // Receive Shared Text
  socket.on('receive-text', ({ text, senderName, timestamp }) => {
    addTextSnippet(text, senderName, timestamp);
    playChimeSound('receive');
    showToast(`New text received from ${senderName}`, 'info');
  });

  // QR Code Renderer
  async function loadQRCode(url) {
    try {
      const res = await fetch(`/api/qrcode?text=${encodeURIComponent(url)}`);
      const data = await res.json();
      qrImage.src = data.dataUrl;
      qrImage.style.display = 'block';
      qrSpinner.style.display = 'none';
    } catch (e) {
      qrSpinner.style.display = 'none';
    }
  }

  // WebRTC Signaling Setup
  function setupWebRTC(isInitiator) {
    const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    peerConnection = new RTCPeerConnection(config);

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc-signal', { signal: { candidate: event.candidate } });
      }
    };

    if (isInitiator) {
      dataChannel = peerConnection.createDataChannel('airpulse-channel');
      setupDataChannel();
      peerConnection.createOffer()
        .then(offer => peerConnection.setLocalDescription(offer))
        .then(() => {
          socket.emit('webrtc-signal', { signal: { sdp: peerConnection.localDescription } });
        });
    } else {
      peerConnection.ondatachannel = (event) => {
        dataChannel = event.channel;
        setupDataChannel();
      };
    }
  }

  socket.on('webrtc-signal', ({ signal }) => {
    if (!peerConnection) setupWebRTC(false);

    if (signal.sdp) {
      peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp))
        .then(() => {
          if (signal.sdp.type === 'offer') {
            peerConnection.createAnswer()
              .then(answer => peerConnection.setLocalDescription(answer))
              .then(() => {
                socket.emit('webrtc-signal', { signal: { sdp: peerConnection.localDescription } });
              });
          }
        });
    } else if (signal.candidate) {
      peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
    }
  });

  function setupDataChannel() {
    dataChannel.binaryType = 'arraybuffer';
    dataChannel.onopen = () => console.log('WebRTC DataChannel connected!');
  }

  // UI Event Handlers
  tabHostBtn.addEventListener('click', () => switchTab('host'));
  tabJoinBtn.addEventListener('click', () => switchTab('join'));

  function switchTab(mode) {
    if (mode === 'host') {
      tabHostBtn.classList.add('active');
      tabJoinBtn.classList.remove('active');
      hostTabContent.classList.remove('hidden');
      joinTabContent.classList.add('hidden');
    } else {
      tabJoinBtn.classList.add('active');
      tabHostBtn.classList.remove('active');
      joinTabContent.classList.remove('hidden');
      hostTabContent.classList.add('hidden');
    }
  }

  joinRoomBtn.addEventListener('click', () => {
    const code = pinInput.value.trim();
    if (code.length === 6) {
      joinRoom(code);
    } else {
      showToast('Please enter a valid 6-digit PIN code', 'error');
    }
  });

  function joinRoom(code) {
    socket.emit('join-room', { code, deviceData });
  }

  copyUrlBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(shareUrlInput.value);
    showToast('Direct pairing link copied!', 'success');
  });

  // Drag and Drop File Upload
  dropZone.addEventListener('click', () => fileInput.click());
  browseFilesBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) handleFilesSelected(files);
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleFilesSelected(e.target.files);
  });

  // File Transfer Logic
  async function handleFilesSelected(files) {
    if (!currentRoom) {
      showToast('Connect a device first before sending files', 'error');
      return;
    }

    for (let i = 0; i < files.length; i++) {
      await sendFile(files[i]);
    }
  }

  async function sendFile(file) {
    const fileId = Math.random().toString(36).substring(2, 9);
    showProgressCard(file.name, file.size);

    // Broadcast file metadata
    socket.emit('file-meta', {
      id: fileId,
      name: file.name,
      size: file.size,
      type: file.type
    });

    const startTime = Date.now();
    let offset = 0;

    while (offset < file.size) {
      const slice = file.slice(offset, offset + CHUNK_SIZE);
      const buffer = await slice.arrayBuffer();

      // Emit chunk via Sockets
      socket.emit('file-chunk', {
        id: fileId,
        chunk: Array.from(new Uint8Array(buffer))
      });

      offset += buffer.byteLength;
      updateProgress(offset, file.size, startTime);
      await new Promise(r => setTimeout(r, 5)); // prevent flooding socket queue
    }

    socket.emit('file-complete', { id: fileId });
    playChimeSound('complete');
    showToast(`Successfully sent ${file.name}`, 'success');
    setTimeout(hideProgressCard, 2000);
  }

  // Progress Bar Renderer
  function showProgressCard(name, totalSize) {
    transferProgressCard.classList.remove('hidden');
    progressFileName.textContent = name;
    progressPercent.textContent = '0%';
    progressFill.style.width = '0%';
    progressSubtext.textContent = `0 MB of ${formatBytes(totalSize)} • 0 MB/s`;
  }

  function updateProgress(transferred, total, startTime) {
    const percent = Math.min(100, Math.round((transferred / total) * 100));
    const elapsedSec = (Date.now() - startTime) / 1000 || 0.001;
    const speedMBps = ((transferred / (1024 * 1024)) / elapsedSec).toFixed(1);

    progressPercent.textContent = `${percent}%`;
    progressFill.style.width = `${percent}%`;
    progressSubtext.textContent = `${formatBytes(transferred)} of ${formatBytes(total)} • ${speedMBps} MB/s`;
  }

  function hideProgressCard() {
    transferProgressCard.classList.add('hidden');
  }

  // Finalize Received File
  function finalizeReceivedFile(fileObj) {
    const blob = new Blob(fileObj.chunks, { type: fileObj.type || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    
    const fileRecord = {
      name: fileObj.name,
      size: fileObj.size,
      type: fileObj.type,
      url: url,
      blob: blob
    };

    receivedFiles.push(fileRecord);
    renderReceivedFiles();
    playChimeSound('receive');
    showToast(`Received ${fileObj.name}!`, 'success');
    setTimeout(hideProgressCard, 1000);

    // Auto trigger download for mobile convenience
    triggerAutoDownload(url, fileObj.name);
  }

  function triggerAutoDownload(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Render Vault Received Files
  function renderReceivedFiles() {
    receivedCount.textContent = receivedFiles.length;
    if (receivedFiles.length > 0) downloadAllBtn.style.display = 'block';

    receivedFilesGrid.innerHTML = '';
    receivedFiles.forEach((file, idx) => {
      const isImage = file.type.startsWith('image/');
      const card = document.createElement('div');
      card.className = 'file-card';
      
      card.innerHTML = `
        <div class="file-card-preview">
          ${isImage ? `<img src="${file.url}" alt="Preview">` : `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          `}
        </div>
        <div class="file-card-info">
          <div class="file-card-name" title="${file.name}">${file.name}</div>
          <div class="file-card-size">${formatBytes(file.size)}</div>
        </div>
        <a href="${file.url}" download="${file.name}" class="btn btn-sm btn-primary" title="Download File">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </a>
      `;
      receivedFilesGrid.appendChild(card);
    });
  }

  downloadAllBtn.addEventListener('click', () => {
    receivedFiles.forEach(file => triggerAutoDownload(file.url, file.name));
  });

  // Text & Clipboard Transfer
  sendTextBtn.addEventListener('click', () => {
    const text = textShareInput.value.trim();
    if (!text) return;

    if (!currentRoom) {
      showToast('Connect a device first before sending text', 'error');
      return;
    }

    socket.emit('send-text', { text });
    addTextSnippet(text, 'You', new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    textShareInput.value = '';
    showToast('Text sent to device!', 'success');
  });

  function addTextSnippet(text, sender, time) {
    const snippet = document.createElement('div');
    snippet.className = 'snippet-card';
    snippet.innerHTML = `
      <div class="snippet-content">
        <span style="font-size:0.7rem; color: var(--text-dim); display:block;">${sender} • ${time}</span>
        <span class="snippet-text">${escapeHtml(text)}</span>
      </div>
      <button class="copy-btn copy-snippet" title="Copy text">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      </button>
    `;

    snippet.querySelector('.copy-snippet').addEventListener('click', () => {
      navigator.clipboard.writeText(text);
      showToast('Copied to clipboard!', 'success');
    });

    textSnippetsList.prepend(snippet);
  }

  // Device List Renderer
  function updateDevicesList(devices) {
    deviceCount.textContent = devices.length;
    if (devices.length === 0) {
      devicesList.innerHTML = '<div class="empty-state-text">Waiting for a second device to connect...</div>';
      return;
    }

    devicesList.innerHTML = '';
    devices.forEach(dev => {
      const isSelf = dev.id === socket.id;
      const chip = document.createElement('div');
      chip.className = 'device-chip';
      chip.innerHTML = `
        <span class="dev-name">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${dev.type === 'mobile' ? '<rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>' : '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>'}
          </svg>
          ${dev.name} ${isSelf ? '(This Device)' : ''}
        </span>
        <span class="dev-tag">${isSelf ? 'Self' : 'Paired'}</span>
      `;
      devicesList.appendChild(chip);
    });
  }

  // Status Badge Updater
  function updateStatus(state, text) {
    statusDot.className = `status-dot ${state}`;
    statusText.textContent = text;
  }

  // Audio Feedback Synthesizer
  soundToggleBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundToggleBtn.style.opacity = soundEnabled ? '1' : '0.4';
    showToast(`Sounds ${soundEnabled ? 'enabled' : 'disabled'}`, 'info');
  });

  function playChimeSound(type) {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'connect') {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      } else if (type === 'complete' || type === 'receive') {
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.12); // E5
        osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.25); // G5
      }

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {}
  }

  // Toast Notification System
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    document.getElementById('toastContainer').appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Utility Helpers
  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]);
  }
});
