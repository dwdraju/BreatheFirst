# 🧘 BreatheFirst

**BreatheFirst** is a mindful Chrome extension designed to help you regain control over your digital life. Instead of mindless scrolling, it introduces a gentle, 5-second intervention before you access distracting websites, encouraging you to take a breath and refocus.

## ✨ Features

- **Mindful Intervention**: A beautiful, full-screen breathing exercise appears when you visit blocked sites.
- **Dynamic Redirection**: Remembers exactly where you were going. Access subpages like `reddit.com/r/all` directly after your breath.
- **Zen Aesthetics**: Premium design with animated gradients, glassmorphism, and high-quality nature backgrounds.
- **Smart Quotes**: Integration with ZenQuotes.io to provide meaningful wisdom during your intervals.
- **Cross-Device Sync**: Settings are automatically synced to your Google account using `chrome.storage.sync`.
- **Backup & Restore**: Export your entire configuration to a JSON file for safe-keeping or migration.
- **Highly Customizable**: Edit blocked sites, durations, custom headlines, and theme colors.

## 🚀 Getting Started

### Prerequisites
- Google Chrome or a Chromium-based browser.
- [Node.js](https://nodejs.org/) and npm (for development).

### Installation (Development Mode)
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/breathefirst.git
   cd breathefirst
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the project:
   ```bash
   npm run build
   ```
4. Load in Chrome:
   - Go to `chrome://extensions/`
   - Enable **Developer mode** (top right).
   - Click **Load unpacked** and select the `dist` folder in the project directory.

## 🛠️ Usage

1. Open the **Options** page by clicking the extension icon and selecting **Extension Settings**.
2. Add the domains you want to block (e.g., `facebook.com`, `instagram.com`).
3. Set your preferred intervention duration (default is 5 seconds).
4. Customize your theme and quotes in the **Appearance** and **Mindful Quotes** tabs.
5. Enjoy a more intentional browsing experience!

## 🔒 Privacy

BreatheFirst respects your privacy. All your data is stored locally in your browser or synced via your private Google profile. No external tracking or analytics are included.

## 📜 License

MIT License - feel free to use and modify for your own mindful journey.

---

*Made with ❤️ by Antigravity*
