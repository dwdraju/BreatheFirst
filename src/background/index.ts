/// <reference types="chrome" />

const REDIRECT_URL = chrome.runtime.getURL('intervention.html');

// Track bypass timeouts per rule ID (tabId + 10000)
const bypassTimeouts = new Map<number, ReturnType<typeof setTimeout>>();

interface BlockedSite {
    domain: string;
    id: number;
    duration: number;
}

interface VisitRecord {
    timestamp: number;
    type: 'continue' | 'cancel';
}

interface AppStats {
    totalTimeSaved: number;
    totalCanceled: number;
}

interface AppSettings {
    intentEnabled: boolean;
    scalingEnabled: boolean;
    hardModeThreshold: number;
}

// Helper to update DNR rules based on storage
async function updateBlockingRules() {
    const data = await chrome.storage.sync.get(['blockedSites', 'extensionEnabled']) as {
        blockedSites?: BlockedSite[];
        extensionEnabled?: boolean;
    };
    const blockedSites = data.blockedSites || [];
    const extensionEnabled = data.extensionEnabled !== false; // Default to true

    // Get current dynamic rules
    const currentRules = await chrome.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = currentRules.map(rule => rule.id);

    if (!extensionEnabled) {
        // If disabled, just remove all rules and return
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds,
            addRules: []
        });
        return;
    }

    const newRules = blockedSites.map((site) => {
        // Build a regex that matches the domain and any subdomains
        // Escape dots in the domain for the regex
        const escapedDomain = site.domain.replace(/\./g, '\\.');
        const regexFilter = `^https?://(?:[^/:]*\\.)?${escapedDomain}(?:/.*)?$`;

        return {
            id: site.id,
            priority: 1,
            action: {
                type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
                redirect: { regexSubstitution: `${REDIRECT_URL}#\\0` }
            },
            condition: {
                regexFilter,
                resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME]
            }
        };
    });

    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds,
        addRules: newRules as chrome.declarativeNetRequest.Rule[]
    });
}

// Listen for storage changes to sync rules
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && (changes.blockedSites || changes.extensionEnabled)) {
        updateBlockingRules();
    }
});

// Handle messages for bypassing and toggling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'BYPASS_SITE') {
        const { domain, duration } = message;
        handleBypass(domain, duration, sender.tab?.id).then(() => {
            sendResponse({ success: true });
        }).catch((err) => {
            console.error('Bypass failed:', err);
            sendResponse({ success: false });
        });
        return true; // Keep the message channel open for async response
    } else if (message.type === 'TOGGLE_EXTENSION') {
        updateBlockingRules();
        sendResponse({ success: true });
    } else if (message.type === 'RECORD_VISIT') {
        handleRecordVisit(message.domain).then(sendResponse);
        return true;
    } else if (message.type === 'UPDATE_STATS') {
        handleUpdateStats(message.type_action, message.duration).then(sendResponse);
        return true;
    }
});

async function handleRecordVisit(domain: string) {
    const data = await chrome.storage.sync.get(['visitHistory', 'settings', 'blockedSites']) as {
        visitHistory?: Record<string, VisitRecord[]>;
        settings?: AppSettings;
        blockedSites?: BlockedSite[];
    };

    const history = data.visitHistory || {};
    const settings = data.settings || { intentEnabled: true, scalingEnabled: true, hardModeThreshold: 3 };
    const site = data.blockedSites?.find(s => s.domain === domain);

    if (!site) return { duration: 5, hardMode: false, visitCount: 0 };

    const now = Date.now();
    const oneHourAgo = now - 3600000;

    // Clean up old history and filter for this domain in last hour
    const domainHistory = (history[domain] || []).filter(v => v.timestamp > oneHourAgo);
    const visitCountInLastHour = domainHistory.length;

    let duration = site.duration;
    let hardMode = false;

    if (settings.scalingEnabled && visitCountInLastHour >= 3) {
        // Scale duration: +5s for every 2 visits over threshold
        const extraScale = Math.floor((visitCountInLastHour - 2) / 2) * 5;
        duration += Math.min(extraScale, 30); // Cap at +30s
    }

    if (visitCountInLastHour >= settings.hardModeThreshold) {
        hardMode = true;
    }

    // record the load timestamp (we'll update type later on continue/cancel)
    const newRecord: VisitRecord = { timestamp: now, type: 'cancel' }; // Default to cancel until proven otherwise
    history[domain] = [...domainHistory, newRecord];

    await chrome.storage.sync.set({ visitHistory: history });

    return {
        duration,
        hardMode,
        visitCount: visitCountInLastHour + 1,
        intentEnabled: settings.intentEnabled
    };
}

async function handleUpdateStats(action: 'continue' | 'cancel', duration: number) {
    const data = await chrome.storage.sync.get(['stats']) as { stats?: AppStats };
    const stats = data.stats || { totalTimeSaved: 0, totalCanceled: 0 };

    if (action === 'cancel') {
        stats.totalTimeSaved += duration;
        stats.totalCanceled += 1;
    }

    await chrome.storage.sync.set({ stats });
    return { success: true, stats };
}

async function handleBypass(domain: string, duration: number, tabId?: number) {
    if (!tabId) {
        console.error('Bypass failed: No tabId');
        return;
    }

    const ruleId = tabId + 10000;

    // Clear any existing timeout for this rule (tab) to avoid collisions
    if (bypassTimeouts.has(ruleId)) {
        clearTimeout(bypassTimeouts.get(ruleId));
        bypassTimeouts.delete(ruleId);
    }

    // Explicitly remove existing rule with this ID AND add the new one.
    // Using ALLOW_ALL_REQUESTS ensures this rule overrides any dynamic redirects for this tab.
    // We add wildcards to domain to be more permissive with subdomains.
    await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [ruleId],
        addRules: [{
            id: ruleId,
            priority: 100, // Very high priority
            action: { type: chrome.declarativeNetRequest.RuleActionType.ALLOW_ALL_REQUESTS },
            condition: {
                urlFilter: `*${domain}*`,
                tabIds: [tabId],
                resourceTypes: [
                    chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
                    chrome.declarativeNetRequest.ResourceType.SUB_FRAME
                ]
            }
        }]
    });

    // Remove the session rule after duration (ms)
    const timeout = setTimeout(async () => {
        try {
            await chrome.declarativeNetRequest.updateSessionRules({
                removeRuleIds: [ruleId]
            });
        } finally {
            bypassTimeouts.delete(ruleId);
        }
    }, duration);

    bypassTimeouts.set(ruleId, timeout);
}

// Initial sync
chrome.runtime.onInstalled.addListener(async () => {
    // 1. Migration from local to sync (if needed)
    const localData = await chrome.storage.local.get(null);
    const syncData = await chrome.storage.sync.get(null);

    if (Object.keys(localData).length > 0 && Object.keys(syncData).length === 0) {
        console.log('Migrating local storage to sync storage...');
        await chrome.storage.sync.set(localData);
        // We keep local data as a backup for now, but sync is primary
    }

    updateBlockingRules();

    // 2. Set default settings if none exist (in sync storage)
    chrome.storage.sync.get(['blockedSites'], (data) => {
        if (!data.blockedSites) {
            chrome.storage.sync.set({
                blockedSites: [
                    { domain: 'instagram.com', id: 1, duration: 5 },
                    { domain: 'facebook.com', id: 2, duration: 5 },
                    { domain: 'twitter.com', id: 3, duration: 5 },
                    { domain: 'reddit.com', id: 4, duration: 5 }
                ],
                customText: 'Take a breath',
                quotesEnabled: true,
                manualQuotes: [
                    { text: "The present moment is the only time over which we have dominion.", id: 1001 },
                    { text: "Breathe in, and you know you are alive. Breathe out, and you know you are making a difference.", id: 1002 },
                    { text: "The soul usually knows what to do to heal itself. The challenge is to silence the mind.", id: 1003 }
                ],
                settings: {
                    intentEnabled: true,
                    scalingEnabled: true,
                    hardModeThreshold: 3
                },
                stats: {
                    totalTimeSaved: 0,
                    totalCanceled: 0
                }
            });
        }
    });
});

console.log('BreatheFirst Service Worker Active');
