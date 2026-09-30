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

The repository includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically builds and deploys to GitHub Pages on every push to `main`.

### Step-by-Step Deployment Setup:

1. **Push to GitHub**:
   Push the codebase to your GitHub repository `main` branch.

2. **Enable GitHub Pages**:
   - Go to your repository on GitHub.
   - Click **Settings** > **Pages** (in the left sidebar).
   - Under **Build and deployment** > **Source**, select **GitHub Actions**.

3. **Automatic Base Path Resolution**:
   - The workflow automatically sets `VITE_BASE=/${{ github.event.repository.name }}/`.
   - The Vite build embeds this base path into all asset links, manifest `scope`, `start_url`, and the `share_target` action.

4. **Manual Build with `VITE_BASE`** (Optional):
   To build locally for GitHub Pages:
   ```bash
   VITE_BASE="/<repo-name>/" npm run build
   ```

---

## 📱 How to Test the Web Share Target on an Android Phone

The Web Share Target API requires HTTPS and an installed PWA on Android Chrome.

### Step 1: Deploy or Tunnel over HTTPS
- Deploy to GitHub Pages (or use Cloudflare Tunnels / `ngrok http 5173` during development).

### Step 2: Install the PWA on Android Chrome
1. Open your deployed HTTPS URL in Google Chrome on your Android phone.
2. Tap Chrome's three-dot menu `⋮` and select **"Add to Home screen"** or **"Install app"**.
3. Confirm the prompt to install **ঘটকালি**.

### Step 3: Test WhatsApp Share Intake
1. Open WhatsApp on your phone.
2. Select 1 or 2 photos and some biodata text in any chat.
3. Tap the **Share** button in WhatsApp.
4. Select **ঘটকালি** from the Android system share sheet.
5. The PWA will open directly into the **ইনবক্স (Inbox)** tab with the banner **"ইনবক্সে জমা হয়েছে"** and your photos and text ready to be organized!
6. Tap **"সাজিয়ে নিন"** to review the auto-filled fields and save.

---

## ✅ Phone Test Checklist

Use this checklist to verify the installed PWA on an Android phone:

- [ ] **PWA Install Banner**: Opening the app in Chrome shows the install prompt or icon in the address bar.
- [ ] **App Launcher & Icons**: Installed icon appears on the home screen with the correct green badge and maskable icon framing.
- [ ] **Offline Operation**: Turn on Airplane mode and open the app. All screens and previously saved biodata load instantly without network connection.
- [ ] **WhatsApp Multi-Share**: Share 2 photos + text from WhatsApp to Ghotkali. Verify both photos and text are grouped into a single `InboxItem`.
- [ ] **Inbox Staging**: Newly shared item appears with the banner "ইনবক্সে জমা হয়েছে" and quick "কার কাছ থেকে এসেছে?" partner chips.
- [ ] **Bangla Text Parser**: Tap "সাজিয়ে নিন". Verify name, father, mother, district, upazila, age, and profession are auto-filled from the text.
- [ ] **Live Code Preview**: Toggle between "পাত্রী" (`B`) and "পাত্র" (`G`). The preview code updates live (`B-0001` / `G-0001`) and is only committed on save.
- [ ] **Duplicate Warning**: Create another biodata with the same father name and district. Verify the duplicate warning card appears ($\ge 4$ points) showing matched fields and partner attribution, with "বিদ্যমান রেকর্ডে যুক্ত করুন" and "নতুন হিসেবে তৈরি করুন" options.
- [ ] **Generous Search**:
  - [ ] Search with typo (e.g. `"ডাক্তর"` finds `"ডাক্তার"`).
  - [ ] Search with Bangla numerals (e.g. `"০১৪৩"` finds `"0143"`).
  - [ ] Search multi-word across fields (e.g. `"সিলেট রহিম"` finds records in Sylhet with father Rahim).
- [ ] **Status Lifecycle**: Change status to "বিবাহিত" (Married). Verify confirmation prompt asking "কে বিবাহ সম্পন্ন করেছে?" and recording partner attribution.
- [ ] **WhatsApp Share Out**: On a person card or detail screen, tap the share icon. Select photo and text summary, tap share, and verify the "কাকে পাঠালেন?" prompt logs a `SendLog`.
- [ ] **Soft Delete & Trash**: Delete a person. Confirm dialog shows their name and code. Record moves to Trash. Tap "পুনরুদ্ধার" to restore.
- [ ] **Zip Backup & Merge**:
  - [ ] In Settings, tap "ব্যাকআপ এক্সপোর্ট (Zip)". Save or share the zip file.
  - [ ] In Settings, tap "ব্যাকআপ রিস্টোর (Zip)". Select the zip and choose "মার্জ করুন". Verify all records and photos are restored with matching counts.
- [ ] **4-Digit PIN Lock**: Set a 4-digit PIN in Settings. Switch to another app for >2 minutes. Switch back to Ghotkali and verify the PIN lock screen appears and unlocks cleanly.

---

## 🧪 Automated Test Suite

Run the full automated test suite covering code generation, normalization, fuzzy search, text parser, duplicate scoring, PIN security, and zip backup/restore:

```bash
npm test
```
All 38 unit tests pass with zero warnings and errors.
