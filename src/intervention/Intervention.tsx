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

    // Advanced Features State
    const [isIntentPhase, setIsIntentPhase] = useState(false)
    const [intent, setIntent] = useState('')
    const [hardMode, setHardMode] = useState(false)
    const [affirmation, setAffirmation] = useState('')
    const [visitCount, setVisitCount] = useState(0)
    const [totalTimeSaved, setTotalTimeSaved] = useState(0)
    const [isDurationScaled, setIsDurationScaled] = useState(false)

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

                // 4. Initial Visit Sync (Advanced Features)
                chrome.runtime.sendMessage({ type: 'RECORD_VISIT', domain }, (response: {
                    duration: number,
                    hardMode: boolean,
                    visitCount: number,
                    intentEnabled: boolean
                }) => {
                    if (response) {
                        if (response.duration > (storageData.blockedSites?.find(s => domain.includes(s.domain))?.duration || 5)) {
                            setIsDurationScaled(true)
                        }
                        setDuration(response.duration)
                        setTimeLeft(response.duration)
                        setHardMode(response.hardMode)
                        setVisitCount(response.visitCount)
                        if (response.intentEnabled) setIsIntentPhase(true)
                    }
                })

                // 5. Get Global Stats
                chrome.storage.sync.get(['stats'], (data) => {
                    const statsData = data.stats as { totalTimeSaved: number } | undefined;
                    if (statsData) setTotalTimeSaved(statsData.totalTimeSaved);
                })
            })
        }

        loadSettings()
    }, [domain])

    // Wait for intent if enabled
    const startBreath = () => {
        if (isIntentPhase && !intent.trim()) return
        setIsIntentPhase(false)
    }

    useEffect(() => {
        if (isIntentPhase) return // Don't start timer until intent is set
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
        // Update stats in background
        chrome.runtime.sendMessage({
            type: 'UPDATE_STATS',
            type_action: 'continue',
            duration
        })

        chrome.runtime.sendMessage({
            type: 'BYPASS_SITE',
            domain: domain,
            duration: 15 * 60 * 1000 // 15 minutes
        }, () => {
            window.location.href = targetUrl
        })
    }

    const handleCancel = () => {
        // Update stats in background
        chrome.runtime.sendMessage({
            type: 'UPDATE_STATS',
            type_action: 'cancel',
            duration
        })
        window.close()
    }

    const isAffirmationCorrect = !hardMode || affirmation.trim().toLowerCase() === "i am in control of my time"
    const canContinue = isReady && isAffirmationCorrect

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
                <div className="live-stats">
                    <motion.div animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 3, repeat: Infinity }}>
                        {Math.floor(totalTimeSaved / 60)}m reclaimed this week
                    </motion.div>
                </div>

                <div className="orb-container">
                    <motion.div
                        className="breathing-orb"
                        style={{
                            background: `radial-gradient(circle at 30% 30%, #fff, ${themeColor})`,
                            boxShadow: `0 0 60px 20px ${themeColor}66, 0 0 120px 40px ${themeColor}33`
                        }}
                        animate={isIntentPhase ? { scale: 0.8, opacity: 0.3 } : {
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

                    {!isIntentPhase && (
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
                    )}
                </div>

                <motion.h1
                    initial={{ opacity: 0, filter: "blur(10px)" }}
                    animate={{ opacity: 1, filter: "blur(0px)" }}
                    transition={{ delay: 0.5, duration: 1 }}
                >
                    {isIntentPhase ? "What is your intention?" : customText}
                </motion.h1>

                {isDurationScaled && !isIntentPhase && (
                    <motion.div
                        className="scaling-notice"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                    >
                        Deep Breath Lock active: {visitCount} visits this hour.
                    </motion.div>
                )}

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
                    {isIntentPhase ? (
                        <div className="intent-container">
                            <input
                                className="zen-input-field"
                                type="text"
                                placeholder="I need to check..."
                                value={intent}
                                onChange={(e) => setIntent(e.target.value)}
                                autoFocus
                            />
                            <div className="button-group" style={{ marginTop: '1.5rem', width: '100%', gap: '1rem' }}>
                                <motion.button
                                    className="btn-zen"
                                    style={{ flex: 2 }}
                                    onClick={startBreath}
                                    disabled={!intent.trim()}
                                    whileHover={intent.trim() ? { scale: 1.02 } : {}}
                                    whileTap={intent.trim() ? { scale: 0.98 } : {}}
                                >
                                    Set Intent
                                </motion.button>
                                <motion.button
                                    className="btn-zen-secondary"
                                    style={{ flex: 1 }}
                                    onClick={() => {
                                        setIntent("Just breathing");
                                        setIsIntentPhase(false);
                                    }}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    Skip
                                </motion.button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {hardMode && isReady && (
                                <motion.div
                                    className="affirmation-box"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    <label className="affirmation-label">Type to confirm control:</label>
                                    <input
                                        className="zen-input-field"
                                        style={{ marginBottom: '1.5rem', fontSize: '0.875rem' }}
                                        type="text"
                                        placeholder="I am in control of my time"
                                        value={affirmation}
                                        onChange={(e) => setAffirmation(e.target.value)}
                                    />
                                </motion.div>
                            )}
                            <motion.button
                                className="btn-zen"
                                disabled={!canContinue}
                                onClick={handleContinue}
                                whileHover={canContinue ? { scale: 1.05 } : {}}
                                whileTap={canContinue ? { scale: 0.95 } : {}}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: canContinue ? 1 : (isReady ? 0.3 : 0.2), y: 0 }}
                                transition={{ duration: 0.5 }}
                            >
                                {isReady
                                    ? (hardMode && !isAffirmationCorrect ? "Affirmation required" : `Continue to ${domain}`)
                                    : `Focusing... ${timeLeft}s`}
                            </motion.button>
                        </>
                    )}

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
