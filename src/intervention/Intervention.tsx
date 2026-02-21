import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import './zen-intervention.css'

const HEALTH_QUOTES = [
    "Take a deep breath. Focus on the now.",
    "Is this how you want to spend your next 10 minutes?",
    "You control your time, not the algorithm.",
    "Breathe in... breathe out.",
    "Your attention is your most valuable asset.",
    "Pause for a moment. What are you seeking right now?",
]

const ZEN_TOPICS: Record<string, string[]> = {
    'Focus': ["focus", "time", "work", "productivity", "goal", "attention"],
    'Peace': ["peace", "calm", "soul", "still", "quiet", "breath", "mind"],
    'Inspiration': ["inspire", "dream", "great", "believe", "future", "possible"],
    'Philosophy': ["life", "wisdom", "mind", "truth", "knowledge", "nature"],
    'Determination': ["grit", "strong", "power", "will", "persist", "tough", "courage"]
}

interface BlockedSite {
    domain: string;
    id: number;
    duration: number;
    savedCount?: number;
}

interface UserQuote {
    text: string;
    id: number;
}

const Intervention = () => {
    const [duration, setDuration] = useState(5)
    const [timeLeft, setTimeLeft] = useState(5)
    const [isReady, setIsReady] = useState(false)
    const [quote, setQuote] = useState("")
    const [customText, setCustomText] = useState("Take a breath")

    // Appearance Config
    const [themeColor, setThemeColor] = useState('#14b8a6')
    const [bgMode, setBgMode] = useState<'gradient' | 'image'>('gradient')
    const [bgImage, setBgImage] = useState('')
    const [blurIntensity, setBlurIntensity] = useState(10)

    const searchParams = new URLSearchParams(window.location.search)
    // Preference: hash fragment (full URL from regex redirect), then query param (legacy fallback)
    const targetUrl = window.location.hash
        ? window.location.hash.substring(1)
        : (searchParams.get('url') || 'https://google.com')
    const domain = new URL(targetUrl).hostname.replace(/^www\./, '')

    useEffect(() => {
        const loadSettings = async () => {
            chrome.storage.sync.get([
                'customText', 'quotesEnabled', 'manualQuotes', 'apiQuotesEnabled',
                'blockedSites', 'themeColor', 'bgMode', 'bgImage', 'blurIntensity',
                'zenTopic', 'quoteCache'
            ], async (data) => {
                const storageData = data as {
                    customText?: string;
                    quotesEnabled?: boolean;
                    manualQuotes?: UserQuote[];
                    apiQuotesEnabled?: boolean;
                    blockedSites?: BlockedSite[];
                    themeColor?: string;
                    bgMode?: 'gradient' | 'image';
                    bgImage?: string;
                    blurIntensity?: number;
                    zenTopic?: string;
                    quoteCache?: string[];
                };

                // 1. Settings & Appearance
                if (storageData.customText) setCustomText(storageData.customText)
                if (storageData.themeColor) setThemeColor(storageData.themeColor)
                if (storageData.bgMode) setBgMode(storageData.bgMode)
                if (storageData.bgImage) setBgImage(storageData.bgImage)
                if (storageData.blurIntensity !== undefined) setBlurIntensity(storageData.blurIntensity)

                // 2. Duration Logic
                if (storageData.blockedSites) {
                    const site = storageData.blockedSites.find(s => domain.includes(s.domain) || s.domain.includes(domain))
                    if (site && site.duration) {
                        setDuration(site.duration)
                        setTimeLeft(site.duration)
                    } else {
                        setDuration(5)
                        setTimeLeft(5)
                    }
                }

                // 3. Quote Selection with Caching
                if (storageData.quotesEnabled !== false) {
                    const topic = storageData.zenTopic || 'Peace'
                    const keywords = ZEN_TOPICS[topic] || ZEN_TOPICS['Peace']
                    let cache = storageData.quoteCache || []
                    let selectedQuote = ""

                    if (storageData.apiQuotesEnabled) {
                        // Try to get from cache first
                        if (cache.length > 0) {
                            selectedQuote = cache.shift() || ""
                            chrome.storage.sync.set({ quoteCache: cache })
                        } else {
                            // Cache empty, fetch new batch
                            try {
                                const response = await fetch('https://zenquotes.io/api/quotes')
                                const json = await response.json()
                                if (Array.isArray(json)) {
                                    // Filter batch for matches
                                    const matches = json.filter(q =>
                                        keywords.some(k => q.q.toLowerCase().includes(k))
                                    ).map(q => q.q)

                                    if (matches.length > 0) {
                                        selectedQuote = matches.shift()
                                        // Store a small pool of 5 as requested
                                        chrome.storage.sync.set({ quoteCache: matches.slice(0, 4) })
                                    } else if (json.length > 0) {
                                        // Fallback to random from batch if no keyword match
                                        selectedQuote = json[Math.floor(Math.random() * json.length)].q
                                    }
                                }
                            } catch (err) { console.warn("API Fetch failed") }
                        }
                    }

                    if (!selectedQuote && storageData.manualQuotes && storageData.manualQuotes.length > 0) {
                        selectedQuote = storageData.manualQuotes[Math.floor(Math.random() * storageData.manualQuotes.length)].text
                    }

                    if (!selectedQuote) {
                        selectedQuote = HEALTH_QUOTES[Math.floor(Math.random() * HEALTH_QUOTES.length)]
                    }

                    setQuote(selectedQuote)
                }
            })
        }

        loadSettings()
    }, [domain])

    useEffect(() => {
        if (timeLeft <= 0) {
            setIsReady(true)
            return
        }

        const timer = setInterval(() => {
            setTimeLeft((prev) => prev - 1)
        }, 1000)

        return () => clearInterval(timer)
    }, [timeLeft])

    const handleContinue = () => {
        // Increment saved count for the domain
        chrome.storage.sync.get(['blockedSites'], (data) => {
            const blockedSites = (data.blockedSites || []) as BlockedSite[]
            const siteIndex = blockedSites.findIndex(s => s.domain === domain)

            if (siteIndex !== -1) {
                blockedSites[siteIndex].savedCount = (blockedSites[siteIndex].savedCount || 0) + 1
                chrome.storage.sync.set({ blockedSites })
            }
        })

        chrome.runtime.sendMessage({
            type: 'BYPASS_SITE',
            domain: domain,
            duration: 10 * 60 * 1000 // 10 minutes
        }, () => {
            window.location.href = targetUrl
        })
    }

    const handleCancel = () => window.close()

    // Timer ring constants
    const radius = 100;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (Math.max(0, timeLeft) / duration) * circumference;

    return (
        <div className="intervention-wrapper">
            <div
                className={`zen-background ${bgMode}`}
                style={{
                    backgroundImage: bgMode === 'image' ? `url(${bgImage})` : undefined,
                    filter: bgMode === 'image' ? `blur(${blurIntensity}px) brightness(0.6)` : undefined
                }}
            />

            <motion.div
                className="glass-card"
                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            >
                <div className="orb-container">
                    <motion.div
                        className="breathing-orb"
                        style={{
                            background: `radial-gradient(circle at 30% 30%, #fff, ${themeColor})`,
                            boxShadow: `0 0 60px 20px ${themeColor}66, 0 0 120px 40px ${themeColor}33`
                        }}
                        animate={{
                            scale: [1, 1.8, 1],
                            opacity: [0.6, 1, 0.6],
                        }}
                        transition={{
                            duration: 8,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    />
                    <div className="orb-glow" style={{ background: `radial-gradient(circle, ${themeColor}4d 0%, transparent 70%)` }}></div>

                    <div className="timer-circle-container">
                        <svg className="progress-ring" width="220" height="220">
                            <circle
                                className="progress-ring-circle-bg"
                                strokeWidth="2"
                                fill="transparent"
                                r={radius}
                                cx="110"
                                cy="110"
                            />
                            <motion.circle
                                className="progress-ring-circle"
                                strokeWidth="2"
                                strokeDasharray={`${circumference} ${circumference}`}
                                animate={{ strokeDashoffset: offset }}
                                stroke={themeColor}
                                fill="transparent"
                                r={radius}
                                cx="110"
                                cy="110"
                            />
                        </svg>
                    </div>
                </div>

                <motion.h1
                    initial={{ opacity: 0, filter: "blur(10px)" }}
                    animate={{ opacity: 1, filter: "blur(0px)" }}
                    transition={{ delay: 0.5, duration: 1 }}
                >
                    {customText}
                </motion.h1>

                <AnimatePresence mode="wait">
                    {quote && (
                        <motion.p
                            key={quote}
                            className="zen-quote"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ delay: 1, duration: 1 }}
                        >
                            {quote}
                        </motion.p>
                    )}
                </AnimatePresence>

                <div className="button-group">
                    <motion.button
                        className="btn-zen"
                        disabled={!isReady}
                        onClick={handleContinue}
                        whileHover={isReady ? { scale: 1.05 } : {}}
                        whileTap={isReady ? { scale: 0.95 } : {}}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: isReady ? 1 : 0.3, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        {isReady ? `Continue to ${domain}` : `Focusing... ${timeLeft}s`}
                    </motion.button>

                    <motion.button
                        className="cancel-zen"
                        onClick={handleCancel}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.5 }}
                        whileHover={{ opacity: 1 }}
                    >
                        Actually, I'll do something else
                    </motion.button>
                </div>
            </motion.div>
        </div>
    )
}

export default Intervention
