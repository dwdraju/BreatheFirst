import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Settings, Trash2, Plus, Info, CheckCircle, Quote, Sparkles, Palette, Image as ImageIcon, Sliders, Clock, Download, Upload } from 'lucide-react'
import './options-zen.css'

interface BlockedSite {
    domain: string;
    id: number;
    duration: number; // in seconds
    savedCount?: number;
}

interface UserQuote {
    text: string;
    id: number;
}

const Options = () => {
    const [activeTab, setActiveTab] = useState<'blocking' | 'appearance' | 'quotes'>('blocking')
    const [blockedSites, setBlockedSites] = useState<BlockedSite[]>([])
    const [newDomain, setNewDomain] = useState('')
    const [newDuration, setNewDuration] = useState(5)
    const [customText, setCustomText] = useState('')
    const [quotesEnabled, setQuotesEnabled] = useState(true)
    const [showSaved, setShowSaved] = useState(false)

    // Appearance State
    const [themeColor, setThemeColor] = useState('#14b8a6')
    const [bgMode, setBgMode] = useState<'gradient' | 'image'>('gradient')
    const [bgImage, setBgImage] = useState('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=80')
    const [blurIntensity, setBlurIntensity] = useState(10)

    // Quote Management State
    const [manualQuotes, setManualQuotes] = useState<UserQuote[]>([])
    const [newQuoteText, setNewQuoteText] = useState('')
    const [apiQuotesEnabled, setApiQuotesEnabled] = useState(false)
    const [zenTopic, setZenTopic] = useState('Peace')

    useEffect(() => {
        chrome.storage.sync.get([
            'blockedSites', 'customText', 'quotesEnabled',
            'manualQuotes', 'apiQuotesEnabled',
            'themeColor', 'bgMode', 'bgImage', 'blurIntensity'
        ], (data) => {
            const storageData = data as {
                blockedSites?: BlockedSite[];
                customText?: string;
                quotesEnabled?: boolean;
                manualQuotes?: UserQuote[];
                apiQuotesEnabled?: boolean;
                zenTopic?: string;
                themeColor?: string;
                bgMode?: 'gradient' | 'image';
                bgImage?: string;
                blurIntensity?: number;
            };
            if (storageData.blockedSites) setBlockedSites(storageData.blockedSites)
            if (storageData.customText) setCustomText(storageData.customText)
            if (storageData.quotesEnabled !== undefined) setQuotesEnabled(storageData.quotesEnabled)
            if (storageData.manualQuotes) setManualQuotes(storageData.manualQuotes)
            if (storageData.apiQuotesEnabled !== undefined) setApiQuotesEnabled(storageData.apiQuotesEnabled)
            if (storageData.zenTopic) setZenTopic(storageData.zenTopic)

            if (storageData.themeColor) setThemeColor(storageData.themeColor)
            if (storageData.bgMode) setBgMode(storageData.bgMode)
            if (storageData.bgImage) setBgImage(storageData.bgImage)
            if (storageData.blurIntensity !== undefined) setBlurIntensity(storageData.blurIntensity)
        })
    }, [])

    const handleAddSite = (e: React.FormEvent) => {
        e.preventDefault()
        if (!newDomain) return

        const formattedDomain = newDomain.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0]
        if (blockedSites.some(s => s.domain === formattedDomain)) return

        const maxId = blockedSites.reduce((max, site) => Math.max(max, site.id), 0)
        const newId = maxId >= 2147483647 ? Math.floor(Math.random() * 10000) + 1 : maxId + 1

        const newSite = {
            domain: formattedDomain,
            id: newId,
            duration: newDuration
        }

        const updated = [...blockedSites, newSite]
        setBlockedSites(updated)
        chrome.storage.sync.set({ blockedSites: updated })
        setNewDomain('')
        setNewDuration(10)
    }

    const handleRemoveSite = (id: number) => {
        const updated = blockedSites.filter(s => s.id !== id)
        setBlockedSites(updated)
        chrome.storage.sync.set({ blockedSites: updated })
    }

    const handleUpdateDuration = (id: number, duration: number) => {
        const updated = blockedSites.map(s => s.id === id ? { ...s, duration } : s)
        setBlockedSites(updated)
        chrome.storage.sync.set({ blockedSites: updated })
    }

    const handleAddQuote = (e: React.FormEvent) => {
        e.preventDefault()
        if (!newQuoteText.trim()) return

        const newQuote = {
            text: newQuoteText.trim(),
            id: Date.now()
        }

        const updated = [...manualQuotes, newQuote]
        setManualQuotes(updated)
        chrome.storage.sync.set({ manualQuotes: updated })
        setNewQuoteText('')
    }

    const handleRemoveQuote = (id: number) => {
        const updated = manualQuotes.filter(q => q.id !== id)
        setManualQuotes(updated)
        chrome.storage.sync.set({ manualQuotes: updated })
    }

    const toggleApiQuotes = () => {
        const newState = !apiQuotesEnabled
        setApiQuotesEnabled(newState)
        chrome.storage.sync.set({
            apiQuotesEnabled: newState,
            quoteCache: [] // Clear cache when toggling
        })
    }

    const handleTopicChange = (topic: string) => {
        setZenTopic(topic)
        chrome.storage.sync.set({
            zenTopic: topic,
            quoteCache: [] // Clear cache when topic changes
        })
    }

    const handleSaveSettings = () => {
        chrome.storage.sync.set({
            customText,
            quotesEnabled,
            themeColor,
            bgMode,
            bgImage,
            blurIntensity
        })
        setShowSaved(true)
        setTimeout(() => setShowSaved(false), 3000)
    }

    const handleExport = () => {
        chrome.storage.sync.get(null, (data) => {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `breathefirst-backup-${new Date().toISOString().split('T')[0]}.json`
            a.click()
            URL.revokeObjectURL(url)
        })
    }

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target?.result as string)
                chrome.storage.sync.set(data, () => {
                    window.location.reload()
                })
            } catch (err) {
                alert('Invalid backup file')
            }
        }
        reader.readAsText(file)
    }

    const themes = [
        { name: 'Ocean', color: '#14b8a6' },
        { name: 'Forest', color: '#10b981' },
        { name: 'Sunset', color: '#f59e0b' },
        { name: 'Aurora', color: '#8b5cf6' },
        { name: 'Midnight', color: '#334155' }
    ]

    return (
        <div className="options-layout">
            <aside className="sidebar">
                <div className="brand">
                    <div style={{ width: 32, height: 32, background: themeColor, borderRadius: 8 }}></div>
                    BreatheFirst
                </div>

                <nav className="nav-list">
                    <div
                        className={`nav-item ${activeTab === 'blocking' ? 'active' : ''}`}
                        onClick={() => setActiveTab('blocking')}
                        style={activeTab === 'blocking' ? { color: themeColor, backgroundColor: `${themeColor}15` } : {}}
                    >
                        <Shield size={20} />
                        Blocking Rules
                    </div>
                    <div
                        className={`nav-item ${activeTab === 'quotes' ? 'active' : ''}`}
                        onClick={() => setActiveTab('quotes')}
                        style={activeTab === 'quotes' ? { color: themeColor, backgroundColor: `${themeColor}15` } : {}}
                    >
                        <Quote size={20} />
                        Mindful Quotes
                    </div>
                    <div
                        className={`nav-item ${activeTab === 'appearance' ? 'active' : ''}`}
                        onClick={() => setActiveTab('appearance')}
                        style={activeTab === 'appearance' ? { color: themeColor, backgroundColor: `${themeColor}15` } : {}}
                    >
                        <Settings size={20} />
                        Appearance
                    </div>
                </nav>

                <div className="footer-info">
                    <Info size={16} />
                    <span>v1.2.0</span>
                </div>
            </aside>

            <main className="main-content">
                <AnimatePresence mode="wait">
                    {activeTab === 'blocking' && (
                        <motion.div
                            key="blocking"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            <header className="content-header">
                                <h1>Blocking Rules</h1>
                                <p>Manage the websites and intervention durations.</p>
                            </header>

                            <div className="card-zen" style={{ marginBottom: '2rem' }}>
                                <div className="card-header">
                                    <h2>Add New Domain</h2>
                                </div>
                                <form className="add-site-form" onSubmit={handleAddSite}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px auto', gap: '1rem', width: '100%' }}>
                                        <input
                                            className="zen-input"
                                            type="text"
                                            placeholder="e.g. reddit.com"
                                            value={newDomain}
                                            onChange={(e) => setNewDomain(e.target.value)}
                                        />
                                        <div className="duration-input-wrapper">
                                            <div className="duration-label-mini">Seconds</div>
                                            <input
                                                className="zen-input"
                                                type="number"
                                                min="1"
                                                max="600"
                                                value={newDuration}
                                                onChange={(e) => setNewDuration(parseInt(e.target.value) || 10)}
                                            />
                                        </div>
                                        <button type="submit" className="btn-primary" style={{ backgroundColor: themeColor }}>
                                            <Plus size={20} />
                                            Add Site
                                        </button>
                                    </div>
                                </form>
                            </div>

                            <div className="card-zen" style={{ marginBottom: '2rem' }}>
                                <div className="section-header-zen">
                                    <Settings size={20} />
                                    <h3>Backup & Restore</h3>
                                </div>
                                <p className="help-text" style={{ marginBottom: '1.5rem' }}>
                                    Keep your settings safe. Download a backup to restore later or on another device.
                                </p>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <button className="btn-secondary-zen btn-backup" onClick={handleExport}>
                                        <Download size={18} />
                                        Download Backup
                                    </button>
                                    <label className="btn-secondary-zen btn-restore" style={{ cursor: 'pointer' }}>
                                        <Upload size={18} />
                                        Import Backup
                                        <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
                                    </label>
                                </div>
                            </div>

                            <div className="card-zen">
                                <div className="card-header">
                                    <h2>Active Restrictions</h2>
                                </div>
                                <div className="site-list-zen">
                                    {blockedSites.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                            No websites blocked yet. Add one above!
                                        </div>
                                    ) : (
                                        blockedSites.map(site => (
                                            <motion.div
                                                key={site.id}
                                                className="site-item-zen"
                                                layout
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                            >
                                                <div className="domain-info">
                                                    <div className="domain-dot" style={{ backgroundColor: themeColor }}></div>
                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                        <span className="domain-name">{site.domain}</span>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                            <div className="site-duration-tag">
                                                                <Clock size={12} style={{ marginRight: 4 }} />
                                                                {site.duration}s interval
                                                            </div>
                                                            <div className="site-saved-tag" style={{ color: themeColor, fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                                                                <Sparkles size={12} style={{ marginRight: 4 }} />
                                                                {site.savedCount || 0} saved
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                                    <div className="duration-stepper">
                                                        <input
                                                            type="number"
                                                            className="stepper-input"
                                                            value={site.duration}
                                                            onChange={(e) => handleUpdateDuration(site.id, parseInt(e.target.value) || 1)}
                                                        />
                                                        <span>sec</span>
                                                    </div>
                                                    <button className="btn-icon" onClick={() => handleRemoveSite(site.id)}>
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </motion.div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'quotes' && (
                        <motion.div
                            key="quotes"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            <header className="content-header">
                                <h1>Mindful Quotes</h1>
                                <p>Curate the wisdom shared during your intervals.</p>
                            </header>

                            <div className="api-toggle-card" style={{ backgroundColor: `${themeColor}10`, borderColor: `${themeColor}30` }}>
                                <div className="api-info">
                                    <h3 style={{ color: themeColor }}>
                                        <Sparkles size={18} style={{ verticalAlign: 'middle', marginRight: 8, color: themeColor }} />
                                        Zen API Infusion
                                    </h3>
                                    <p style={{ color: themeColor, opacity: 0.8 }}>Pull wisdom from ZenQuotes.io based on your vibe.</p>
                                </div>
                                <div
                                    className={`switch-zen ${apiQuotesEnabled ? 'active' : ''}`}
                                    onClick={toggleApiQuotes}
                                    style={apiQuotesEnabled ? { backgroundColor: themeColor } : {}}
                                >
                                    <motion.div
                                        className="switch-thumb-zen"
                                        animate={{ x: apiQuotesEnabled ? 24 : 0 }}
                                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                    />
                                </div>
                            </div>

                            {apiQuotesEnabled && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="card-zen"
                                    style={{ marginBottom: '2rem' }}
                                >
                                    <div className="section-header-zen">
                                        <Sparkles size={20} style={{ color: themeColor }} />
                                        <h3>Choose Your Focus</h3>
                                    </div>
                                    <div className="topic-grid">
                                        {['Focus', 'Peace', 'Inspiration', 'Philosophy', 'Determination'].map(topic => (
                                            <button
                                                key={topic}
                                                className={`topic-btn ${zenTopic === topic ? 'active' : ''}`}
                                                style={zenTopic === topic ? { backgroundColor: themeColor, borderColor: themeColor } : {}}
                                                onClick={() => handleTopicChange(topic)}
                                            >
                                                {topic}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="help-text" style={{ marginTop: '1rem' }}>
                                        The extension will fetch quotes related to <strong>{zenTopic}</strong> and cache them for efficiency.
                                    </p>
                                </motion.div>
                            )}

                            <div className="card-zen" style={{ marginBottom: '2rem' }}>
                                <div className="card-header">
                                    <h2>Add Manual Quote</h2>
                                </div>
                                <form className="manual-quote-form" onSubmit={handleAddQuote}>
                                    <textarea
                                        className="zen-textarea"
                                        placeholder="Type a quote that inspires you..."
                                        value={newQuoteText}
                                        onChange={(e) => setNewQuoteText(e.target.value)}
                                    />
                                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                        <button type="submit" className="btn-primary" style={{ backgroundColor: themeColor }}>
                                            <Plus size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                                            Add to Collection
                                        </button>
                                    </div>
                                </form>
                            </div>

                            <div className="card-zen">
                                <div className="card-header">
                                    <h2>Your Collection</h2>
                                </div>
                                <div className="site-list-zen">
                                    {manualQuotes.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                            Your custom collection is empty.
                                        </div>
                                    ) : (
                                        manualQuotes.map(quote => (
                                            <motion.div
                                                key={quote.id}
                                                className="quote-item-zen"
                                                layout
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                            >
                                                <div className="quote-content">"{quote.text}"</div>
                                                <div className="quote-actions">
                                                    <button className="btn-icon" onClick={() => handleRemoveQuote(quote.id)}>
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </motion.div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'appearance' && (
                        <motion.div
                            key="appearance"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            <header className="content-header">
                                <h1>Appearance</h1>
                                <p>Customize how the intervention page looks and speaks to you.</p>
                            </header>

                            <div className="card-zen">
                                <div className="section-header-zen">
                                    <Palette size={20} />
                                    <h3>Theme & Colors</h3>
                                </div>

                                <div className="input-group">
                                    <label className="input-label">Intervention Headline</label>
                                    <input
                                        className="zen-input"
                                        type="text"
                                        value={customText}
                                        onChange={(e) => setCustomText(e.target.value)}
                                        placeholder="e.g. Take a breath"
                                    />
                                </div>

                                <div className="input-group">
                                    <label className="input-label">Theme Accent Color</label>
                                    <div className="theme-grid">
                                        {themes.map(t => (
                                            <div
                                                key={t.name}
                                                className={`theme-swatch ${themeColor === t.color ? 'active' : ''}`}
                                                style={{ backgroundColor: t.color, outlineColor: t.color }}
                                                onClick={() => setThemeColor(t.color)}
                                                title={t.name}
                                            >
                                                {themeColor === t.color && <CheckCircle size={16} color="white" />}
                                            </div>
                                        ))}
                                        <input
                                            type="color"
                                            value={themeColor}
                                            onChange={(e) => setThemeColor(e.target.value)}
                                            className="color-picker-custom"
                                        />
                                    </div>
                                </div>

                                <div className="section-header-zen" style={{ marginTop: '3rem' }}>
                                    <ImageIcon size={20} />
                                    <h3>Background</h3>
                                </div>

                                <div className="input-group">
                                    <label className="input-label">Background Mode</label>
                                    <div className="mode-toggle-group">
                                        <button
                                            className={`mode-btn ${bgMode === 'gradient' ? 'active' : ''}`}
                                            onClick={() => setBgMode('gradient')}
                                            style={bgMode === 'gradient' ? { color: themeColor } : {}}
                                        >
                                            Animated Gradient
                                        </button>
                                        <button
                                            className={`mode-btn ${bgMode === 'image' ? 'active' : ''}`}
                                            onClick={() => setBgMode('image')}
                                            style={bgMode === 'image' ? { color: themeColor } : {}}
                                        >
                                            Nature Image
                                        </button>
                                    </div>
                                </div>

                                {bgMode === 'image' && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        className="input-group"
                                    >
                                        <label className="input-label">Custom Image URL</label>
                                        <input
                                            className="zen-input"
                                            type="text"
                                            value={bgImage}
                                            onChange={(e) => setBgImage(e.target.value)}
                                            placeholder="https://images.unsplash.com/..."
                                        />
                                        <p className="help-text">Use a high-quality Unsplash URL for best results.</p>
                                    </motion.div>
                                )}

                                <div className="section-header-zen" style={{ marginTop: '3rem' }}>
                                    <Sliders size={20} />
                                    <h3>Atmosphere</h3>
                                </div>

                                <div className="input-group">
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <label className="input-label">Background Blur</label>
                                        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{blurIntensity}px</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="40"
                                        value={blurIntensity}
                                        onChange={(e) => setBlurIntensity(parseInt(e.target.value))}
                                        className="zen-range"
                                        style={{ '--accent': themeColor } as any}
                                    />
                                </div>

                                <div className="input-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '1rem', marginTop: '2rem' }}>
                                    <input
                                        type="checkbox"
                                        checked={quotesEnabled}
                                        onChange={(e) => setQuotesEnabled(e.target.checked)}
                                        id="quote-toggle"
                                        style={{ width: 20, height: 20, accentColor: themeColor }}
                                    />
                                    <label htmlFor="quote-toggle" className="input-label" style={{ margin: 0, cursor: 'pointer' }}>
                                        Enable Mindfulness Quotes
                                    </label>
                                </div>

                                <div style={{ marginTop: '3rem', borderTop: '1px solid var(--border-color)', paddingTop: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <button
                                        className="btn-primary"
                                        onClick={handleSaveSettings}
                                        style={{ backgroundColor: themeColor, boxShadow: `0 4px 14px 0 ${themeColor}66` }}
                                    >
                                        Save Changes
                                    </button>
                                    <AnimatePresence>
                                        {showSaved && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0 }}
                                                style={{ color: themeColor, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', fontWeight: 600 }}
                                            >
                                                <CheckCircle size={16} />
                                                Settings saved successfully
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    )
}

export default Options
