// ReelsMaxing - Side Panel Script (Direct Embed)

const socialOptions = [
  { value: "instagram", label: "Instagram", url: "https://www.instagram.com/reels/" },
  { value: "tiktok", label: "TikTok", url: "https://www.tiktok.com/foryou" },
  { value: "youtube", label: "YouTube", url: "https://www.youtube.com/shorts" },
  { value: "twitter", label: "X (Twitter)", url: "https://x.com/home" },
  { value: "reddit", label: "Reddit", url: "https://www.reddit.com" },
  { value: "snapchat", label: "Snapchat", url: "https://www.snapchat.com/spotlight" },
  { value: "facebook", label: "Facebook", url: "https://www.facebook.com/reel/" }
];

const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const pauseOverlay = document.getElementById('pauseOverlay');
const selectButton = document.getElementById('selectButton');
const selectDropdown = document.getElementById('selectDropdown');
const selectedLabel = document.getElementById('selectedLabel');
const socialFrame = document.getElementById('socialFrame');
const loading = document.getElementById('loading');

let currentPlatform = 'instagram';
let isPaused = true;
let isDropdownOpen = false;

// Hide loading when frame loads
socialFrame.addEventListener('load', () => {
  loading.style.display = 'none';
});

// Initialize dropdown
function initDropdown() {
  selectDropdown.innerHTML = socialOptions.map(opt => `
    <div class="select-option ${opt.value === currentPlatform ? 'selected' : ''}" data-value="${opt.value}">
      <span class="option-check">
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
      </span>
      ${opt.label}
    </div>
  `).join('');

  selectDropdown.querySelectorAll('.select-option').forEach(option => {
    option.addEventListener('click', () => {
      selectPlatform(option.dataset.value);
      closeDropdown();
    });
  });
}

function toggleDropdown() {
  isDropdownOpen = !isDropdownOpen;
  selectDropdown.classList.toggle('open', isDropdownOpen);
  selectButton.classList.toggle('open', isDropdownOpen);
}

function closeDropdown() {
  isDropdownOpen = false;
  selectDropdown.classList.remove('open');
  selectButton.classList.remove('open');
}

function selectPlatform(value) {
  currentPlatform = value;
  const option = socialOptions.find(o => o.value === value);
  if (!option) return;

  selectedLabel.textContent = option.label;

  selectDropdown.querySelectorAll('.select-option').forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.value === value);
  });

  // Show loading and change iframe src
  loading.style.display = 'block';
  socialFrame.src = option.url;

  chrome.runtime.sendMessage({ type: 'SET_SOCIAL_URL', url: option.url });
}

function updateStatus(status) {
  statusDot.className = 'status-dot ' + status;
  if (status === 'ready') {
    statusText.textContent = 'Ready';
  } else if (status === 'generating') {
    statusText.textContent = 'Generating...';
  } else {
    statusText.textContent = 'Paused';
  }
}

function showPause() {
  isPaused = true;
  pauseOverlay.classList.add('visible');
  updateStatus('paused');
}

function hidePause() {
  isPaused = false;
  pauseOverlay.classList.remove('visible');
  updateStatus('generating');
}

selectButton.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleDropdown();
});

document.addEventListener('click', (e) => {
  if (!selectButton.contains(e.target) && !selectDropdown.contains(e.target)) {
    closeDropdown();
  }
});

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('SidePanel received:', message.type);

  if (message.type === 'PAUSE_REELS' || message.type === 'PAUSE_SIDEPANEL') {
    showPause();
  }
  if (message.type === 'PLAY_REELS' || message.type === 'PLAY_SIDEPANEL') {
    hidePause();
  }
  if (message.type === 'INIT_STATE') {
    if (message.socialUrl) {
      const option = socialOptions.find(o => o.url === message.socialUrl);
      if (option) {
        currentPlatform = option.value;
        selectedLabel.textContent = option.label;
        socialFrame.src = option.url;
      }
    }
    if (message.isPaused) {
      showPause();
    } else {
      hidePause();
    }
  }
  return true;
});

// Initialize
initDropdown();

// Start paused
showPause();

// Notify background
chrome.runtime.sendMessage({ type: 'SIDEPANEL_READY' });

console.log('ReelsMaxing: Side panel initialized with direct embed');
