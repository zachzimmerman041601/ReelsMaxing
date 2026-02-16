import React, { useState, useEffect, useRef } from "react"
import { createRoot } from "react-dom/client"

// Utility function to merge class names
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}

const llmOptions = [
  { value: "chatgpt", label: "ChatGPT", url: "https://chatgpt.com" },
  { value: "claude", label: "Claude", url: "https://claude.ai" },
  { value: "gemini", label: "Gemini", url: "https://gemini.google.com" },
]

const socialOptions = [
  { value: "instagram", label: "Instagram", url: "https://www.instagram.com/reels/" },
  { value: "tiktok", label: "TikTok", url: "https://www.tiktok.com/foryou" },
  { value: "youtube", label: "YouTube", url: "https://www.youtube.com/shorts" },
  { value: "twitter", label: "X (Twitter)", url: "https://x.com/home" },
  { value: "reddit", label: "Reddit", url: "https://www.reddit.com" },
  { value: "snapchat", label: "Snapchat", url: "https://www.snapchat.com/spotlight" },
  { value: "facebook", label: "Facebook", url: "https://www.facebook.com/reel/" },
]

const LLM_SELECTORS: Record<string, { name: string; generating: string[] }> = {
  "chatgpt.com": {
    name: "ChatGPT",
    generating: [
      'button[aria-label="Stop generating"]',
      'button[aria-label="Stop streaming"]',
      'button[data-testid="stop-button"]',
      '[class*="result-streaming"]'
    ]
  },
  "claude.ai": {
    name: "Claude",
    generating: [
      'button[aria-label="Stop Response"]',
      'button[aria-label*="Stop"]'
    ]
  },
  "gemini.google.com": {
    name: "Gemini",
    generating: [
      'button[aria-label="Stop generating"]',
      "mat-spinner"
    ]
  }
}

// Custom Select Component - styled like shadcn/ui
function Select({
  value,
  onChange,
  options,
  className
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  className?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const selectRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const selectedOption = options.find(opt => opt.value === value)

  return (
    <div ref={selectRef} className={cn("relative inline-block", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm",
          "ring-offset-background placeholder:text-muted-foreground",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
          "hover:bg-muted/50 transition-colors",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        <span className="truncate">{selectedOption?.label}</span>
        <svg
          className={cn("h-4 w-4 opacity-50 shrink-0 transition-transform", isOpen && "rotate-180")}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full min-w-[8rem] overflow-hidden rounded-md border border-border bg-card text-foreground shadow-md animate-in fade-in-0 zoom-in-95">
          <div className="p-1">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value)
                  setIsOpen(false)
                }}
                className={cn(
                  "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none",
                  "hover:bg-muted focus:bg-muted transition-colors",
                  opt.value === value && "bg-muted/50"
                )}
              >
                {/* Checkmark for selected item */}
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                  {opt.value === value && (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ReelsMaxing() {
  const [llmProvider, setLlmProvider] = useState("chatgpt")
  const [socialPlatform, setSocialPlatform] = useState("instagram")
  const [status, setStatus] = useState<"ready" | "generating" | "paused">("paused")
  const [isPaused, setIsPaused] = useState(true)
  const [reelsWidth, setReelsWidth] = useState(400)

  const llmViewRef = useRef<any>(null)
  const reelsViewRef = useRef<any>(null)
  const wasGeneratingRef = useRef(false)
  const isResizingRef = useRef(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  const currentLlm = llmOptions.find((opt) => opt.value === llmProvider)
  const currentSocial = socialOptions.find((opt) => opt.value === socialPlatform)

  // Get current LLM config for detection
  const getCurrentLLMConfig = () => {
    const url = currentLlm?.url || ""
    for (const [domain, config] of Object.entries(LLM_SELECTORS)) {
      if (url.includes(domain)) {
        return { domain, ...config }
      }
    }
    return { domain: "chatgpt.com", ...LLM_SELECTORS["chatgpt.com"] }
  }

  // Check if AI is generating
  const checkGenerating = async (): Promise<boolean> => {
    const llm = getCurrentLLMConfig()
    const llmView = llmViewRef.current

    if (!llmView) return false

    try {
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
      `)
      return result
    } catch (e) {
      return false
    }
  }

  // Pause reels
  const pauseReels = async () => {
    if (isPaused) return

    setIsPaused(true)
    setStatus("paused")

    const reelsView = reelsViewRef.current
    if (reelsView) {
      try {
        await reelsView.executeJavaScript(`
          (function() {
            const videos = document.querySelectorAll('video');
            videos.forEach(v => v.pause());
          })()
        `)
      } catch (e) {
        console.log("Could not pause video:", e)
      }
    }
  }

  // Play reels
  const playReels = async () => {
    if (!isPaused) return

    setIsPaused(false)
    setStatus("ready")

    const reelsView = reelsViewRef.current
    if (reelsView) {
      try {
        await reelsView.executeJavaScript(`
          (function() {
            const videos = document.querySelectorAll('video');
            videos.forEach(v => v.play().catch(() => {}));
          })()
        `)
      } catch (e) {
        console.log("Could not play video:", e)
      }
    }
  }

  // Pause videos on initial load
  useEffect(() => {
    const reelsView = reelsViewRef.current
    if (reelsView) {
      const handleDomReady = () => {
        // Pause videos after page loads
        setTimeout(async () => {
          try {
            await reelsView.executeJavaScript(`
              (function() {
                const videos = document.querySelectorAll('video');
                videos.forEach(v => v.pause());
              })()
            `)
          } catch (e) {
            console.log("Could not pause on load:", e)
          }
        }, 1000)
      }
      reelsView.addEventListener('dom-ready', handleDomReady)
      return () => reelsView.removeEventListener('dom-ready', handleDomReady)
    }
  }, [socialPlatform])

  // Monitor AI generation
  useEffect(() => {
    const interval = setInterval(async () => {
      const generating = await checkGenerating()

      // Started generating
      if (!wasGeneratingRef.current && generating) {
        setStatus("generating")
        if (isPaused) {
          playReels()
        }
      }

      // Finished generating
      if (wasGeneratingRef.current && !generating) {
        pauseReels()
      }

      wasGeneratingRef.current = generating
    }, 300)

    return () => clearInterval(interval)
  }, [llmProvider, isPaused])

  // Resize handling
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return
      const diff = startXRef.current - e.clientX
      const newWidth = Math.min(Math.max(startWidthRef.current + diff, 350), 600)
      setReelsWidth(newWidth)
    }

    const handleMouseUp = () => {
      isResizingRef.current = false
      document.body.style.cursor = ""
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [])

  const handleResizeStart = (e: React.MouseEvent) => {
    isResizingRef.current = true
    startXRef.current = e.clientX
    startWidthRef.current = reelsWidth
    document.body.style.cursor = "col-resize"
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border bg-card px-5 py-3" style={{ WebkitAppRegion: "drag" } as any}>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 overflow-hidden">
            <img src="ReelsMax_logo.jpg" alt="ReelsMaxing" className="h-9 w-9 object-contain" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">ReelsMaxing</h1>
        </div>

        <div className="flex items-center gap-2" style={{ WebkitAppRegion: "no-drag" } as any}>
          <div
            className={cn(
              "h-2.5 w-2.5 rounded-full transition-all",
              status === "ready" && "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]",
              status === "generating" && "animate-pulse bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]",
              status === "paused" && "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]"
            )}
          />
          <span className="text-sm text-muted-foreground">
            {status === "ready" && "Ready"}
            {status === "generating" && "Generating..."}
            {status === "paused" && "Paused"}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* LLM Panel */}
        <div className="flex flex-1 flex-col border-r border-border">
          <div className="flex h-10 items-center gap-2 border-b border-border bg-muted/30 px-4">
            <svg
              className="h-4 w-4 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <Select
              value={llmProvider}
              onChange={setLlmProvider}
              options={llmOptions}
              className="w-[140px]"
            />
          </div>
          <webview
            ref={llmViewRef}
            src={currentLlm?.url || "https://chatgpt.com"}
            partition="persist:llm"
            className="flex-1 w-full h-full"
          />
        </div>

        {/* Resize Handle */}
        <div
          className="w-1 bg-border hover:bg-primary cursor-col-resize transition-colors"
          onMouseDown={handleResizeStart}
        />

        {/* Reels Panel */}
        <div className="flex flex-col shrink-0" style={{ width: `${reelsWidth}px` }}>
          {/* Header - Always accessible, not covered by overlay */}
          <div className="relative flex h-10 items-center gap-2 border-b border-border bg-muted/30 px-4 z-30">
            <svg
              className="h-4 w-4 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            <Select
              value={socialPlatform}
              onChange={setSocialPlatform}
              options={socialOptions}
              className="w-[180px]"
            />
          </div>

          {/* Webview container - relative for overlay positioning */}
          <div className="relative flex-1">
            <webview
              ref={reelsViewRef}
              src={currentSocial?.url || "https://www.instagram.com/reels/"}
              partition="persist:social"
              className="absolute inset-0 w-full h-full"
            />

            {/* Pause Overlay - Only covers the webview, not the header */}
            {isPaused && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm z-20">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                  <svg
                    className="h-10 w-10 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h2 className="mb-2 text-xl font-semibold text-foreground">
                  AI Response Ready!
                </h2>
                <p className="mb-1 text-sm text-muted-foreground">
                  Read the response in the chat
                </p>
                <p className="text-xs text-muted-foreground/60">
                  Generate a new prompt to continue watching
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Mount the app
const container = document.getElementById("root")
if (container) {
  const root = createRoot(container)
  root.render(<ReelsMaxing />)
}
