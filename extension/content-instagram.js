// ReelsMax - Instagram Content Script
// Controls Reels playback via messages from background script

(function() {
  'use strict';

  // Prevent double initialization
  if (window.reelsMaxInitialized) return;
  window.reelsMaxInitialized = true;

  let isPaused = false;
  let overlay = null;

  // Create pause overlay
  function createOverlay() {
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'reelsmax-overlay';
    overlay.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        backdrop-filter: blur(5px);
        cursor: pointer;
      ">
        <div style="
          font-size: 60px;
          margin-bottom: 20px;
        ">⏸️</div>
        <div style="
          color: white;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 24px;
          font-weight: 700;
          text-align: center;
          margin-bottom: 10px;
        ">AI Response Ready!</div>
        <div style="
          color: rgba(255,255,255,0.7);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 14px;
        ">Click anywhere to resume</div>
      </div>
    `;

    // Click to resume
    overlay.addEventListener('click', () => {
      playReel();
    });

    return overlay;
  }

  // Pause the current reel
  function pauseReel() {
    console.log('ReelsMax: Attempting to pause reel');

    // Find all videos and pause them
    const videos = document.querySelectorAll('video');
    let paused = false;

    videos.forEach(video => {
      if (!video.paused) {
        video.pause();
        paused = true;
        console.log('ReelsMax: Paused video');
      }
    });

    if (paused || videos.length > 0) {
      isPaused = true;

      // Show overlay
      const ov = createOverlay();
      if (!document.body.contains(ov)) {
        document.body.appendChild(ov);
      }
      ov.style.display = 'block';
    }
  }

  // Play/resume the current reel
  function playReel() {
    console.log('ReelsMax: Attempting to resume reel');

    // Hide overlay
    if (overlay) {
      overlay.style.display = 'none';
    }

    // Find all videos and play them
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
      if (video.paused) {
        video.play().catch(e => console.log('ReelsMax: Could not auto-play', e));
        console.log('ReelsMax: Resumed video');
      }
    });

    isPaused = false;
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('ReelsMax Instagram: Received message', message.type);

    if (message.type === 'PAUSE_REELS') {
      pauseReel();
      sendResponse({ success: true, paused: isPaused });
    }

    if (message.type === 'PLAY_REELS') {
      playReel();
      sendResponse({ success: true, paused: isPaused });
    }

    return true;
  });

  // Track video state changes (user manually plays/pauses)
  function observeVideos() {
    const handleVideo = (video) => {
      video.addEventListener('play', () => {
        if (overlay) overlay.style.display = 'none';
        isPaused = false;
      });
    };

    // Handle existing videos
    document.querySelectorAll('video').forEach(handleVideo);

    // Watch for new videos
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeName === 'VIDEO') {
            handleVideo(node);
          }
          if (node.querySelectorAll) {
            node.querySelectorAll('video').forEach(handleVideo);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Initialize
  function init() {
    console.log('ReelsMax: Instagram Reels controller initialized');
    observeVideos();

    // Notify background that we're ready
    chrome.runtime.sendMessage({ type: 'INSTAGRAM_READY' }).catch(() => {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
