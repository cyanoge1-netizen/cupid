# ঘটকালি (Ghotkali) - বায়োডাটা ম্যানেজার

A local companion Progressive Web App (PWA) for matchmakers to store, organize, search, and re-share biodata records with partner matchmakers. Built offline-first with zero external backend dependencies.

---

## 🚀 Features (Phase 1 MVP)

- **📱 Offline-First & No Backend**: All personal records and photos stay in the phone's IndexedDB (via Dexie).
- **📥 Web Share Target Intake**: Share photos and biodata text directly from WhatsApp to the installed PWA.
- **🏷️ Deterministic Bangla Text Parser**: Automatically detects and pre-fills name, father, mother, district, upazila, village, age, height, education, profession, and phone from pasted text without AI calls.
- **🔍 Generous Bangla Fuzzy Search**: Full-text in-memory search with typo tolerance (edit distance $\le 1$), token fallback, and Bangla numeral normalization (`০-৯` $\leftrightarrow$ `0-9`).
- **🛡️ Duplicate Detection**: Warns when father name, name, district, or phone digits match an existing record ($\ge 4$ points).
- **🔢 Sequential Non-reusable Codes**: Atomic sequential code assignment (`B-0143`, `G-0087`).
- **🤝 Partner Management**: Associate records with partners, view real-time statistics (total, active, married), and tap to filter.
- **📤 Smart WhatsApp Sharing**: Formatted biodata text generator, photo attachment selector, and "কাকে পাঠালেন?" follow-up logger.
- **🗑️ 30-Day Trash & Soft Delete**: Safe delete with confirmation dialog and automatic 30-day purge on open.
- **💾 Zip Backup & Merge Restore**: Full database and photo backup in a single `.zip` file using `fflate`.
- **🔒 App Lock**: 4-digit PIN security with `SubtleCrypto` PBKDF2 salted hashing, locking after 2 minutes in the background.

---

## 🛠️ Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run unit tests (Vitest)
npm test

# Build for production
npm run build

# Preview production build locally
npm run preview
```

---

## 🌐 Deploying to GitHub Pages

1. Build the production bundle:
   ```bash
   npm run build
   ```
2. The compiled assets are placed in `dist/`.
3. If deploying to a GitHub Pages repository subpath (e.g. `https://<username>.github.io/<repo-name>/`), ensure the `base` path in `vite.config.ts` matches your repository name:
   ```ts
   // vite.config.ts
   export default defineConfig({
     base: './', // Or '/<repo-name>/'
     ...
   });
   ```
4. Deploy the `dist/` folder to GitHub Pages:
   - You can push the `dist/` directory to the `gh-pages` branch, or
   - Use GitHub Actions workflow to deploy automatically on pushes to `main`.

---

## 📱 How to Test the Web Share Target on an Android Phone

The Web Share Target API requires HTTPS and an installed PWA on Android Chrome.

### Step 1: Deploy or Tunnel over HTTPS
- Deploy to GitHub Pages or use a secure tunnel (e.g. Cloudflare Tunnels or `ngrok http 5173`).

### Step 2: Install the PWA on Android Chrome
1. Open your deployed HTTPS URL in Google Chrome on your Android phone.
2. Tap Chrome's three-dot menu `⋮` and select **"Add to Home screen"** or **"Install app"**.
3. Confirm the prompt to install **ঘটকালি**.

### Step 3: Test WhatsApp Share Intake
1. Open WhatsApp on your phone.
2. Select 1 or 2 photos and some biodata text.
3. Tap the **Share** button in WhatsApp.
4. Select **ঘটকালি** from the Android system share sheet.
5. The PWA will open directly into the **ইনবক্স (Inbox)** tab with the banner **"ইনবক্সে জমা হয়েছে"** and your photos and text ready to be organized!
6. Tap **"সাজিয়ে নিন"** to review the auto-filled fields and save.

---

## 🧪 Testing and Verification

Run the full automated test suite covering code generation, normalization, fuzzy search, text parser, duplicate scoring, PIN security, and zip backup/restore:

```bash
npm test
```
All 36 unit tests pass with zero warnings and errors.
