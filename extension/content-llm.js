// ReelsMaxing - LLM Content Script

(function() {
  'use strict';

  let wasGenerating = false;
  let checkInterval = null;
  let statusIndicator = null;
  let reelsPanel = null;
  let isPanelOpen = false;
  let isDropdownOpen = false;
  let scalePhoneHandler = null;

  const SOCIAL_OPTIONS = [
    { value: "instagram", label: "Instagram", url: "https://www.instagram.com/reels/" },
    { value: "tiktok", label: "TikTok", url: "https://www.tiktok.com/foryou" },
    { value: "youtube", label: "YouTube Shorts", url: "https://m.youtube.com/shorts" },
    { value: "twitter", label: "X (Twitter)", url: "https://mobile.x.com/home" },
    { value: "reddit", label: "Reddit", url: "https://www.reddit.com" },
    { value: "facebook", label: "Facebook", url: "https://m.facebook.com/reel/" }
  ];

  let currentPlatform = 'instagram';
  let currentSocialUrl = SOCIAL_OPTIONS[0].url;

  const GENERATION_SELECTORS = {
    'chatgpt.com': [
      'button[aria-label="Stop generating"]',
      'button[aria-label="Stop streaming"]',
      'button[data-testid="stop-button"]',
      'button[class*="stop"]',
      '[class*="result-streaming"]',
      '[data-message-author-role="assistant"][class*="streaming"]'
    ],
    'chat.openai.com': [
      'button[aria-label="Stop generating"]',
      'button[data-testid="stop-button"]',
      'button[class*="stop"]'
    ],
    'claude.ai': [
      'button[aria-label="Stop Response"]',
      'button[aria-label*="Stop"]',
      '[data-testid="stop-button"]',
      '[class*="streaming"]'
    ],
    'gemini.google.com': [
      'button[aria-label="Stop generating"]',
      'button[data-testid="stop-button"]',
      'button[mattooltip="Stop"]',
      'mat-spinner',
      '[class*="loading-indicator"]'
    ]
  };

  function getSelectors() {
    const hostname = window.location.hostname;
    for (const [site, selectors] of Object.entries(GENERATION_SELECTORS)) {
      if (hostname.includes(site)) {
        return selectors;
      }
    }
    return [];
  }

  function isGenerating() {
    const selectors = getSelectors();
    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          if (element && isVisible(element)) {
            return true;
          }
        }
      } catch (e) {}
    }

    if (window.location.hostname.includes('chatgpt')) {
      const cursor = document.querySelector('[class*="cursor"]');
      if (cursor && isVisible(cursor)) return true;
      const thinking = document.querySelector('[class*="thinking"], [class*="Thinking"]');
      if (thinking && isVisible(thinking)) return true;
    }

    return false;
  }

  function isVisible(element) {
    try {
      if (!element) return false;
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
      }
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    } catch (e) {
      return false;
    }
  }

  function getLogoUrl() {
    try {
      return chrome.runtime.getURL('ReelsMax_logo.jpg');
    } catch (e) {
      return '';
    }
  }

  function createPanel() {
    if (reelsPanel) return;

    // Add styles first
    const style = document.createElement('style');
    style.id = 'reelsmax-styles';
    style.textContent = `
      #reelsmax-panel {
        position: fixed;
        top: 0;
        right: 0;
        width: 380px;
        height: 100vh;
        background: #ffffff;
        border-left: 1px solid #e5e5e5;
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        box-shadow: -2px 0 10px rgba(0,0,0,0.1);
      }

      #reelsmax-panel * {
        box-sizing: border-box;
      }

      #reelsmax-panel .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        border-bottom: 1px solid #e5e5e5;
        background: #ffffff;
        flex-shrink: 0;
      }

      #reelsmax-panel .logo-section {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      #reelsmax-panel .logo {
        width: 28px;
        height: 28px;
        border-radius: 6px;
        background: rgba(23, 23, 23, 0.1);
        overflow: hidden;
      }

      #reelsmax-panel .logo img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      #reelsmax-panel .app-name {
        font-size: 14px;
        font-weight: 600;
        color: #0a0a0a;
      }

      #reelsmax-panel .header-right {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      #reelsmax-panel .status-section {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      #reelsmax-panel .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        transition: all 0.3s ease;
      }

      #reelsmax-panel .status-dot.generating {
        background: #f59e0b;
        box-shadow: 0 0 6px rgba(245, 158, 11, 0.6);
        animation: reelsmax-pulse 1.5s ease-in-out infinite;
      }

      #reelsmax-panel .status-dot.paused {
        background: #f87171;
        box-shadow: 0 0 6px rgba(248, 113, 113, 0.6);
      }

      @keyframes reelsmax-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      #reelsmax-panel .status-text {
        font-size: 11px;
        color: #737373;
      }

      #reelsmax-panel .close-btn {
        background: transparent;
        border: none;
        color: #737373;
        font-size: 18px;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        line-height: 1;
      }

      #reelsmax-panel .close-btn:hover {
        background: #f5f5f5;
        color: #0a0a0a;
      }

      #reelsmax-panel .selector-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-bottom: 1px solid #e5e5e5;
        background: rgba(245, 245, 245, 0.3);
        flex-shrink: 0;
      }

      #reelsmax-panel .selector-icon {
        color: #737373;
      }

      #reelsmax-panel .select-wrapper {
        position: relative;
        flex: 1;
      }

      #reelsmax-panel .select-button {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: 6px 10px;
        background: #ffffff;
        border: 1px solid #e5e5e5;
        border-radius: 6px;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s;
        color: #0a0a0a;
      }

      #reelsmax-panel .select-button:hover {
        background: #f5f5f5;
      }

      #reelsmax-panel .select-chevron {
        transition: transform 0.2s;
      }

      #reelsmax-panel .select-button.open .select-chevron {
        transform: rotate(180deg);
      }

      #reelsmax-panel .select-dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        margin-top: 4px;
        background: #ffffff;
        border: 1px solid #e5e5e5;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 100;
        display: none;
        max-height: 250px;
        overflow-y: auto;
      }

      #reelsmax-panel .select-dropdown.open {
        display: block;
      }

      #reelsmax-panel .select-option {
        display: flex;
        align-items: center;
        padding: 8px 10px;
        cursor: pointer;
        font-size: 13px;
        transition: background 0.15s;
        color: #0a0a0a;
      }

      #reelsmax-panel .select-option:hover {
        background: #f5f5f5;
      }

      #reelsmax-panel .select-option.selected {
        background: rgba(245, 245, 245, 0.5);
      }

      #reelsmax-panel .option-check {
        width: 16px;
        margin-right: 8px;
      }

      #reelsmax-panel .option-check svg {
        display: none;
      }

      #reelsmax-panel .select-option.selected .option-check svg {
        display: block;
      }

      #reelsmax-panel .frame-container {
        flex: 1;
        position: relative;
        background: #000;
        overflow: hidden;
      }

      #reelsmax-panel .phone-wrapper {
        position: absolute;
        top: 0;
        left: 0;
        width: 375px;
        height: 812px;
        overflow: hidden;
        background: #000;
        transform-origin: top left;
      }

      #reelsmax-panel .social-frame {
        width: 375px;
        height: 812px;
        border: none;
        display: block;
      }

      #reelsmax-panel .pause-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(8px);
        display: none;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 50;
      }

      #reelsmax-panel .pause-overlay.visible {
        display: flex;
      }

      #reelsmax-panel .pause-icon {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: rgba(23, 23, 23, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 12px;
      }

      #reelsmax-panel .pause-icon svg {
        width: 32px;
        height: 32px;
        color: #171717;
      }

      #reelsmax-panel .pause-title {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 6px;
        color: #0a0a0a;
      }

      #reelsmax-panel .pause-subtitle {
        font-size: 13px;
        color: #737373;
        text-align: center;
        padding: 0 20px;
      }

      #reelsmax-panel .loading {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: white;
        font-size: 14px;
      }

    `;

    document.head.appendChild(style);

    // Create the panel
    reelsPanel = document.createElement('div');
    reelsPanel.id = 'reelsmax-panel';
    reelsPanel.innerHTML = `
      <div class="header">
        <div class="logo-section">
          <div class="logo">
            <img src="${getLogoUrl()}" alt="ReelsMaxing">
          </div>
          <span class="app-name">ReelsMaxing</span>
        </div>
        <div class="header-right">
          <div class="status-section">
            <div class="status-dot paused" id="reelsmax-status-dot"></div>
            <span class="status-text" id="reelsmax-status-text">Paused</span>
          </div>
          <button class="close-btn" id="reelsmax-close">✕</button>
        </div>
      </div>

      <div class="selector-bar">
        <svg class="selector-icon" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
        </svg>
        <div class="select-wrapper">
          <button class="select-button" id="reelsmax-select-btn">
            <span id="reelsmax-selected-label">Instagram</span>
            <svg class="select-chevron" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          <div class="select-dropdown" id="reelsmax-dropdown"></div>
        </div>
      </div>

      <div class="frame-container">
        <div class="loading" id="reelsmax-loading" style="display: none;">Loading...</div>
        <div class="phone-wrapper">
          <iframe
            class="social-frame"
            id="reelsmax-iframe"
            src="about:blank"
            data-saved-src="${currentSocialUrl}"
            allow="autoplay; fullscreen; encrypted-media"
          ></iframe>
        </div>

        <div class="pause-overlay" id="reelsmax-overlay">
          <div class="pause-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <h2 class="pause-title">AI Response Ready!</h2>
          <p class="pause-subtitle">Read the response in the chat. Generate a new prompt to continue watching.</p>
        </div>
      </div>
    `;

    document.body.appendChild(reelsPanel);

    // Initialize dropdown
    initDropdown();

    // Add event listeners
    document.getElementById('reelsmax-close').addEventListener('click', closePanel);
    document.getElementById('reelsmax-select-btn').addEventListener('click', toggleDropdown);
    document.getElementById('reelsmax-iframe').addEventListener('load', () => {
      document.getElementById('reelsmax-loading').style.display = 'none';
    });

    // Close dropdown on outside click
    document.addEventListener('click', handleOutsideClick);

    // Scale phone to fit the frame container
    function scalePhone() {
      const container = reelsPanel.querySelector('.frame-container');
      const phoneWrapper = reelsPanel.querySelector('.phone-wrapper');
      if (!container || !phoneWrapper) return;

      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const phoneWidth = 375;
      const phoneHeight = 812;

      const scaleX = containerWidth / phoneWidth;
      const scaleY = containerHeight / phoneHeight;
      const scale = Math.min(scaleX, scaleY);

      phoneWrapper.style.transform = `scale(${scale})`;

      // Center the phone in the container
      const scaledWidth = phoneWidth * scale;
      const scaledHeight = phoneHeight * scale;
      phoneWrapper.style.left = `${(containerWidth - scaledWidth) / 2}px`;
      phoneWrapper.style.top = `${(containerHeight - scaledHeight) / 2}px`;
    }

    // Scale on load and resize
    requestAnimationFrame(scalePhone);
    scalePhoneHandler = scalePhone;
    window.addEventListener('resize', scalePhoneHandler);

    // Add class to enable page width constraint
    document.documentElement.classList.add('reelsmax-active');

    // Constrain page width - push content left to make room for panel
    const pageStyle = document.createElement('style');
    pageStyle.id = 'reelsmax-page-style';
    pageStyle.textContent = `
      html.reelsmax-active {
        overflow-x: hidden !important;
      }
      html.reelsmax-active body {
        margin-right: 380px !important;
        width: calc(100% - 380px) !important;
        max-width: calc(100vw - 380px) !important;
        min-width: 0 !important;
        overflow-x: hidden !important;
      }
      html.reelsmax-active body > * {
        max-width: 100% !important;
      }
      /* Ensure fixed elements within body also respect the constraint */
      html.reelsmax-active [style*="position: fixed"],
      html.reelsmax-active [style*="position:fixed"] {
        max-width: calc(100vw - 380px) !important;
      }
    `;
    document.head.appendChild(pageStyle);

    isPanelOpen = true;
    updateIndicator();

    // Start with reels paused
    showPauseOverlay();

    console.log('ReelsMaxing: Panel opened');
  }

  function initDropdown() {
    const dropdown = document.getElementById('reelsmax-dropdown');
    dropdown.innerHTML = SOCIAL_OPTIONS.map(opt => `
      <div class="select-option ${opt.value === currentPlatform ? 'selected' : ''}" data-value="${opt.value}" data-url="${opt.url}">
        <span class="option-check">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
        </span>
        ${opt.label}
      </div>
    `).join('');

    dropdown.querySelectorAll('.select-option').forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        selectPlatform(option.dataset.value, option.dataset.url, option.textContent.trim());
        closeDropdown();
      });
    });
  }

  function toggleDropdown(e) {
    e.stopPropagation();
    isDropdownOpen = !isDropdownOpen;
    const dropdown = document.getElementById('reelsmax-dropdown');
    const btn = document.getElementById('reelsmax-select-btn');
    dropdown.classList.toggle('open', isDropdownOpen);
    btn.classList.toggle('open', isDropdownOpen);
  }

  function closeDropdown() {
    isDropdownOpen = false;
    const dropdown = document.getElementById('reelsmax-dropdown');
    const btn = document.getElementById('reelsmax-select-btn');
    if (dropdown) dropdown.classList.remove('open');
    if (btn) btn.classList.remove('open');
  }

  function handleOutsideClick(e) {
    const btn = document.getElementById('reelsmax-select-btn');
    const dropdown = document.getElementById('reelsmax-dropdown');
    if (btn && dropdown && !btn.contains(e.target) && !dropdown.contains(e.target)) {
      closeDropdown();
    }
  }

  function selectPlatform(value, url, label) {
    currentPlatform = value;
    currentSocialUrl = url;

    const iframe = document.getElementById('reelsmax-iframe');
    const overlay = document.getElementById('reelsmax-overlay');
    const isPlaying = !overlay || !overlay.classList.contains('visible');

    document.getElementById('reelsmax-selected-label').textContent = label;

    // Save the new URL
    iframe.dataset.savedSrc = url;

    // Only load immediately if currently playing (not paused)
    if (isPlaying) {
      document.getElementById('reelsmax-loading').style.display = 'block';
      iframe.src = url;
    }

    // Update selected state
    document.querySelectorAll('#reelsmax-dropdown .select-option').forEach(opt => {
      opt.classList.toggle('selected', opt.dataset.value === value);
    });
  }

  function closePanel() {
    if (reelsPanel) {
      reelsPanel.remove();
      reelsPanel = null;
    }
    const style = document.getElementById('reelsmax-styles');
    if (style) style.remove();

    // Remove page constraint style
    const pageStyle = document.getElementById('reelsmax-page-style');
    if (pageStyle) pageStyle.remove();

    if (scalePhoneHandler) {
      window.removeEventListener('resize', scalePhoneHandler);
      scalePhoneHandler = null;
    }
    document.removeEventListener('click', handleOutsideClick);
    document.documentElement.classList.remove('reelsmax-active');
    isPanelOpen = false;
    updateIndicator();
    console.log('ReelsMaxing: Panel closed');
  }

  function togglePanel() {
    if (isPanelOpen) {
      closePanel();
    } else {
      createPanel();
    }
  }

  function showPauseOverlay() {
    const overlay = document.getElementById('reelsmax-overlay');
    const dot = document.getElementById('reelsmax-status-dot');
    const text = document.getElementById('reelsmax-status-text');
    const iframe = document.getElementById('reelsmax-iframe');

    if (overlay) overlay.classList.add('visible');
    if (dot) {
      dot.classList.remove('generating');
      dot.classList.add('paused');
    }
    if (text) text.textContent = 'Paused';

    // Actually pause the content by clearing the iframe src
    if (iframe && iframe.src !== 'about:blank') {
      iframe.dataset.savedSrc = iframe.src;
      iframe.src = 'about:blank';
    }
  }

  function hidePauseOverlay() {
    const overlay = document.getElementById('reelsmax-overlay');
    const dot = document.getElementById('reelsmax-status-dot');
    const text = document.getElementById('reelsmax-status-text');
    const iframe = document.getElementById('reelsmax-iframe');
    const loading = document.getElementById('reelsmax-loading');

    if (overlay) overlay.classList.remove('visible');
    if (dot) {
      dot.classList.remove('paused');
      dot.classList.add('generating');
    }
    if (text) text.textContent = 'Generating...';

    // Restore the iframe content
    if (iframe && iframe.dataset.savedSrc) {
      if (loading) loading.style.display = 'block';
      iframe.src = iframe.dataset.savedSrc;
    }
  }

  function updateIndicator() {
    if (!statusIndicator) return;
    const textSpan = statusIndicator.querySelector('.indicator-text');
    if (textSpan) {
      textSpan.textContent = isPanelOpen ? 'Close ReelsMaxing' : 'Open ReelsMaxing';
    }
  }

  function showIndicator() {
    // Add indicator styles first
    const indicatorStyle = document.createElement('style');
    indicatorStyle.id = 'reelsmax-indicator-styles';
    indicatorStyle.textContent = `
      #reelsmax-indicator {
        position: fixed !important;
        bottom: 20px !important;
        right: 20px !important;
        left: auto !important;
        top: auto !important;
        background: rgba(26, 26, 46, 0.95) !important;
        color: white !important;
        padding: 10px 16px !important;
        border-radius: 25px !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
        font-size: 13px !important;
        font-weight: 500 !important;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3) !important;
        z-index: 2147483647 !important;
        display: flex !important;
        align-items: center !important;
        gap: 10px !important;
        cursor: pointer !important;
        transition: transform 0.3s ease !important;
        border: 1px solid rgba(102, 126, 234, 0.3) !important;
        transform: none !important;
        margin: 0 !important;
        width: auto !important;
        height: auto !important;
      }
      #reelsmax-indicator:hover {
        transform: scale(1.02) !important;
      }
      #reelsmax-indicator .indicator-dot {
        width: 8px !important;
        height: 8px !important;
        border-radius: 50% !important;
        background: #4ade80 !important;
        box-shadow: 0 0 8px #4ade80 !important;
        flex-shrink: 0 !important;
      }
      #reelsmax-indicator .indicator-text {
        color: white !important;
        white-space: nowrap !important;
      }
    `;
    document.head.appendChild(indicatorStyle);

    statusIndicator = document.createElement('div');
    statusIndicator.id = 'reelsmax-indicator';
    statusIndicator.innerHTML = `
      <div class="indicator-dot"></div>
      <span class="indicator-text">Open ReelsMaxing</span>
    `;
    document.body.appendChild(statusIndicator);
    statusIndicator.addEventListener('click', togglePanel);
  }

  function startMonitoring() {
    if (checkInterval) return;

    checkInterval = setInterval(() => {
      try {
        // Check if extension context is still valid
        if (!chrome.runtime?.id) {
          clearInterval(checkInterval);
          return;
        }

        const generating = isGenerating();

        if (!wasGenerating && generating) {
          console.log('ReelsMaxing: AI started generating');
          wasGenerating = true;
          hidePauseOverlay();
        }

        if (wasGenerating && !generating) {
          console.log('ReelsMaxing: AI finished generating');
          wasGenerating = false;
          showPauseOverlay();
        }
      } catch (e) {
        // Extension context invalidated, stop monitoring
        clearInterval(checkInterval);
      }
    }, 200);
  }

  function init() {
    console.log('ReelsMaxing: Content script loaded');
    showIndicator();
    startMonitoring();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 500);
  }
})();
