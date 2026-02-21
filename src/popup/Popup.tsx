import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Settings, ExternalLink, ShieldCheck, Heart } from 'lucide-react'
import './popup-zen.css'

const Popup = () => {
    const [enabled, setEnabled] = useState(true)

    useEffect(() => {
        chrome.storage.local.get(['extensionEnabled'], (data) => {
            const storageData = data as { extensionEnabled?: boolean };
            if (storageData.extensionEnabled !== undefined) setEnabled(storageData.extensionEnabled)
        })
    }, [])

    const toggleExtension = () => {
        const newState = !enabled
        setEnabled(newState)
        chrome.storage.local.set({ extensionEnabled: newState })
        chrome.runtime.sendMessage({ type: 'TOGGLE_EXTENSION', enabled: newState })
    }

    const openOptions = () => {
        chrome.runtime.openOptionsPage()
    }

    return (
        <div className="popup-zen-wrapper">
            <div className="popup-header">
                <div className="logo-zen">
                    <ShieldCheck size={18} color="white" />
                </div>
                <h1>BreatheFirst</h1>
            </div>

            <div className="status-section">
                <div className="label-group">
                    <span className="status-label">Zen Mode</span>
                    <span className="status-desc">{enabled ? 'Active' : 'Paused'}</span>
                </div>
                <div
                    className={`zen-switch ${enabled ? 'active' : ''}`}
                    onClick={toggleExtension}
                >
                    <motion.div
                        className="switch-thumb"
                        animate={{ x: enabled ? 20 : 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                </div>
            </div>

            <div className="nav-links">
                <div className="nav-link-zen" onClick={openOptions}>
                    <Settings size={18} />
                    <span>Extension Settings</span>
                </div>
                <a
                    className="nav-link-zen"
                    href="https://github.com/dwdraju/BreatheFirst"
                    target="_blank"
                    rel="noreferrer"
                >
                    <ExternalLink size={18} />
                    <span>Learn More</span>
                </a>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 4 }}>
                    Made with <Heart size={10} fill="#cbd5e1" color="#cbd5e1" /> by Antigravity
                </div>
            </div>
        </div>
    )
}

export default Popup
