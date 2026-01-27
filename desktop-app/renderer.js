// ReelsMax - Renderer Script
// Handles AI detection and Reels control

const llmView = document.getElementById('llmView');
const reelsView = document.getElementById('reelsView');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const pauseOverlay = document.getElementById('pauseOverlay');
const llmSelector = document.getElementById('llmSelector');
const llmLabel = document.getElementById('llmLabel');
const socialSelector = document.getElementById('socialSelector');
const resizeHandle = document.getElementById('resizeHandle');
const reelsPanel = document.getElementById('reelsPanel');

let wasGenerating = false;
let isPaused = false;
let checkInterval = null;

// Social media platforms
const SOCIAL_PLATFORMS = {
  instagram: {
    name: 'Instagram Reels',
    url: 'https://www.instagram.com/reels/',
    icon: '📸'
  },
  tiktok: {
    name: 'TikTok',
    url: 'https://www.tiktok.com/foryou',
    icon: '🎵'
  },
  youtube: {
    name: 'YouTube Shorts',
    url: 'https://www.youtube.com/shorts',
    icon: '▶️'
  },
  twitter: {
    name: 'X (Twitter)',
    url: 'https://x.com/home',
    icon: '🐦'
  },
  reddit: {
    name: 'Reddit',
    url: 'https://www.reddit.com',
    icon: '🔴'
  },
  snapchat: {
    name: 'Snapchat Spotlight',
    url: 'https://www.snapchat.com/spotlight',
    icon: '👻'
  },
  facebook: {
    name: 'Facebook Reels',
    url: 'https://www.facebook.com/reel/',
    icon: '📘'
  }
};

// LLM detection selectors
const LLM_SELECTORS = {
  'chatgpt.com': {
    name: 'ChatGPT',
    generating: [
      'button[aria-label="Stop generating"]',
      'button[aria-label="Stop streaming"]',
      'button[data-testid="stop-button"]',
      '[class*="result-streaming"]'
    ]
  },
  'claude.ai': {
    name: 'Claude',
    generating: [
      'button[aria-label="Stop Response"]',
      'button[aria-label*="Stop"]'
    ]
  },
  'gemini.google.com': {
    name: 'Gemini',
    generating: [
      'button[aria-label="Stop generating"]',
      'mat-spinner'
    ]
  }
};

// Get current LLM config
function getCurrentLLM() {
  const url = llmView.src || llmSelector.value;
  for (const [domain, config] of Object.entries(LLM_SELECTORS)) {
    if (url.includes(domain)) {
      return { domain, ...config };
    }
  }
  return { domain: 'chatgpt.com', ...LLM_SELECTORS['chatgpt.com'] };
}

// Check if AI is generating
async function checkGenerating() {
  const llm = getCurrentLLM();

  try {
    // Execute script in webview to check for generating indicators
    const result = await llmView.executeJavaScript(`
      (function() {
        const selectors = ${JSON.stringify(llm.generating)};
        for (const selector of selectors) {
          try {
            const el = document.querySelector(selector);
            if (el) {
              const style = window.getComputedStyle(el);
              const rect = el.getBoundingClientRect();
              if (style.display !== 'none' &&
                  style.visibility !== 'hidden' &&
                  rect.width > 0 && rect.height > 0) {
                return true;
              }
            }
          } catch (e) {}
        }
        return false;
      })()
    `);

    return result;
  } catch (e) {
    return false;
  }
}

// Pause the reels
async function pauseReels() {
  if (isPaused) return;

  console.log('Pausing reels...');
  isPaused = true;

  // Show overlay
  pauseOverlay.classList.add('visible');
  statusDot.classList.remove('generating');
  statusDot.classList.add('paused');
  statusText.textContent = 'Paused - Response ready!';

  // Pause video in webview
  try {
    await reelsView.executeJavaScript(`
      (function() {
        const videos = document.querySelectorAll('video');
        videos.forEach(v => v.pause());
      })()
    `);
  } catch (e) {
    console.log('Could not pause video:', e);
  }
}

// Resume the reels
async function playReels() {
  if (!isPaused) return;

  console.log('Resuming reels...');
  isPaused = false;

  // Hide overlay
  pauseOverlay.classList.remove('visible');
  statusDot.classList.remove('paused');
  statusText.textContent = 'Playing';

  // Play video in webview
  try {
    await reelsView.executeJavaScript(`
      (function() {
        const videos = document.querySelectorAll('video');
        videos.forEach(v => v.play().catch(() => {}));
      })()
    `);
  } catch (e) {
    console.log('Could not play video:', e);
  }
}

// Monitor AI generation state
function startMonitoring() {
  if (checkInterval) return;

  checkInterval = setInterval(async () => {
    const generating = await checkGenerating();

    // Started generating
    if (!wasGenerating && generating) {
      console.log('AI started generating');
      statusDot.classList.add('generating');
      statusText.textContent = 'AI generating...';

      // Resume reels if paused
      if (isPaused) {
        playReels();
      }
    }

    // Finished generating
    if (wasGenerating && !generating) {
      console.log('AI finished generating');
      pauseReels();
    }

    wasGenerating = generating;
  }, 300);
}

// LLM selector change
llmSelector.addEventListener('change', () => {
  const url = llmSelector.value;
  const llm = Object.entries(LLM_SELECTORS).find(([domain]) => url.includes(domain));

  llmView.src = url;
  llmLabel.textContent = llm ? llm[1].name : 'Chat';
});

// Social platform selector change
socialSelector.addEventListener('change', () => {
  const platform = SOCIAL_PLATFORMS[socialSelector.value];
  if (platform) {
    reelsView.src = platform.url;
    console.log(`Switched to ${platform.name}`);
  }
});

// Resizable panel
let isResizing = false;
let startX = 0;
let startWidth = 0;

resizeHandle.addEventListener('mousedown', (e) => {
  isResizing = true;
  startX = e.clientX;
  startWidth = reelsPanel.offsetWidth;
  document.body.style.cursor = 'col-resize';
});

document.addEventListener('mousemove', (e) => {
  if (!isResizing) return;

  const diff = startX - e.clientX;
  const newWidth = Math.min(Math.max(startWidth + diff, 320), 600);
  reelsPanel.style.width = newWidth + 'px';
});

document.addEventListener('mouseup', () => {
  isResizing = false;
  document.body.style.cursor = '';
});

// Wait for webviews to load
llmView.addEventListener('dom-ready', () => {
  console.log('LLM view ready');
  startMonitoring();
});

reelsView.addEventListener('dom-ready', () => {
  console.log('Reels view ready');
  statusText.textContent = 'Ready - Start chatting!';
});

// Handle webview errors
llmView.addEventListener('did-fail-load', (e) => {
  console.log('LLM failed to load:', e);
});

reelsView.addEventListener('did-fail-load', (e) => {
  console.log('Reels failed to load:', e);
});
