# Deployment Guide (GitHub Pages & Automation)

This project is set up for automatic deployment to GitHub Pages.

## Prerequisites
1. A GitHub account.
2. Git installed on your computer.

## Steps to Deploy

### 1. Configure Local Credentials
Before deploying, ensure your local `assets/js/firebase-config.js` has the real Firebase keys so the app works for users.

### 2. Upload to GitHub
1. Initialize a git repository in the root `c:/Ahmed/DoctorsSoftware`:
   ```bash
   git init
   git add .
   git commit -m "Initial deploy"
   ```
2. Create a new repository on GitHub.
3. Push your code:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git branch -M main
   git push -u origin main
   ```

### 3. Setup Automation (The "Automatic" Part)
To make the system automatically check for new articles and create the pages:

1. Go to your GitHub Repository.
2. Click **Settings** > **Secrets and variables** > **Actions**.
3. Click **New repository secret**.
4. Add these two secrets (copy values from your `firebase-config.js`):
   - Name: `FIREBASE_API_KEY`
     Value: (Your API Key)
   - Name: `FIREBASE_PROJECT_ID`
     Value: (Your Project ID, e.g., "clinic-app-123")

**That's it!**
- The system will run **every hour** automatically.
- It will check for new articles, generate the pages, and update your site.
- You can also manually trigger it by going to the "Actions" tab > "Auto-Publish Blog" > "Run workflow".

### 4. Enable GitHub Pages
1. Go to **Settings** > **Pages**.
2. Under **Source**, select `Deploy from a branch`.
3. Select `main` branch and `/ (root)` folder.
4. Click **Save**.

## Verification
- Write an article in your Content Manager.
- Wait for the next hour OR go to GitHub Actions and click "Run workflow".
- Refresh your blog page to see the new article.
