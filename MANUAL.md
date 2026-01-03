# 🏥 ClinicCore - Master Deployment Guide

This is your step-by-step manual to bringing the clinic system to life.

## 🟢 Step 1: Firebase (Database & Auth)
1.  Go to [console.firebase.google.com](https://console.firebase.google.com/).
2.  Create a Project ("ClinicCore").
3.  **Enable Firestore**: Create Database -> Start in Production Mode.
4.  **Enable Auth**: Authentication -> Sign-in Method -> Email/Password -> Enable.
5.  **Create Users**: Manually add users in the generic "Users" tab:
    -   `doctor@clinic.com` (Password: `clinic123`)
    -   `sec@clinic.com` (Password: `sec123`)
6.  **Get Config**: Project Settings -> General -> Web App -> Copy the `const firebaseConfig = { ... }` object.
7.  **Paste Config**: Open `assets/js/firebase-config.js` and paste your keys there.

## ⚡ Step 2: Cloudflare Workers (Backend)
1.  Go to [dash.cloudflare.com](https://dash.cloudflare.com/) -> Workers & Pages.
2.  Create Application -> Create Worker -> Name it `clinic-core-backend`.
3.  **Copy Code**: Copy the content of `backend/worker.js` and paste it into the Cloudflare Online Editor (or use `wrangler deploy` if you have it).
4.  **Environment Variables (Secrets)**:
    -   Go to Worker Settings -> Variables.
    -   Add `GEMINI_API_KEY`: Get this from [aistudio.google.com](https://aistudio.google.com/).
    -   Add `WHATSAPP_TOKEN`: From Meta Developers (see Step 3).
    -   Add `WHATSAPP_PHONE_ID`: From Meta Developers.
5.  **Deploy**: Click "Deploy". Note the Worker URL (e.g., `https://clinic-core-backend.user.workers.dev`).

## 💬 Step 3: WhatsApp Integration
1.  Go to [developers.facebook.com](https://developers.facebook.com/) -> My Apps.
2.  Create App -> Business -> WhatsApp.
3.  **API Setup**: In the value "Callback URL", paste your Worker URL + `/api/webhook/whatsapp`.
4.  **Verify Token**: Enter the same token you saved in Step 2.
5.  **Phone Number**: Use the Test Number provided by Meta for free testing.

## 🌐 Step 4: Hosting (Frontend)
1.  You have a folder `c:/Ahmed/DoctorsSoftware`.
2.  Upload the contents of this folder to **GitHub**.
3.  Go to GitHub Repo Settings -> Pages -> Source: `main` branch.
4.  Your site will be live at `https://yourname.github.io/repo`.

## ✅ Final Check
-   [ ] Does `firebase-config.js` have real keys?
-   [ ] Is the Worker deployed?
-   [ ] Is the WhatsApp Webhook green/verified?

### 💡 Note on Files
The system uses **Links** for files to keep costs at zero. Doctors can paste links from Google Drive/Dropbox directly into the patient's record.

**You are ready to go! 🚀**
