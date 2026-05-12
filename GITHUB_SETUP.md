# 📦 Push PayTerminal to GitHub

## Quick Guide (5 Minutes)

### Step 1: Initialize Git Repository

Open your terminal in the project root folder and run:

```bash
# Initialize git repository
git init

# Add all files
git add .

# Create first commit
git commit -m "Initial commit: PayTerminal - Invoice & Payment Management Platform"
```

### Step 2: Create GitHub Repository

1. **Go to GitHub**
   - Visit: https://github.com/new
   - Or click "+" → "New repository"

2. **Repository Settings**
   ```
   Repository name: payterminal
   Description: Invoice & Payment Management Platform with Multi-Gateway Support
   Visibility: Private (recommended) or Public
   
   ❌ DO NOT initialize with README, .gitignore, or license
   (We already have these files)
   ```

3. **Click "Create repository"**

### Step 3: Push to GitHub

GitHub will show you commands. Use these:

```bash
# Add GitHub as remote
git remote add origin https://github.com/YOUR_USERNAME/payterminal.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**Replace `YOUR_USERNAME` with your actual GitHub username!**

### Alternative: Using GitHub Desktop

1. **Download GitHub Desktop**
   - Visit: https://desktop.github.com/

2. **Add Repository**
   - File → Add Local Repository
   - Choose your project folder

3. **Publish to GitHub**
   - Click "Publish repository"
   - Choose name and visibility
   - Click "Publish"

---

## Verify Upload

After pushing, check on GitHub:

✅ You should see:
```
payterminal/
├── backend/
├── frontend/
├── README.md
├── DEPLOYMENT_GUIDE.md
├── QUICK_DEPLOY.md
└── ... other files
```

❌ You should NOT see:
- `node_modules/` folders
- `.env` files
- `*.db` database files
- `uploads/` folder with images

---

## Important: Protect Sensitive Data

### Before Pushing, Verify:

```bash
# Check what will be committed
git status

# If you see .env or database files, they should be ignored
# If they appear, add them to .gitignore and run:
git rm --cached backend/.env
git rm --cached backend/data/*.db
git commit -m "Remove sensitive files"
```

### Files That Should Be Ignored:

- ✅ `.env` files (contain secrets)
- ✅ `node_modules/` (too large)
- ✅ `*.db` files (database data)
- ✅ `uploads/` (user uploaded files)

---

## After Pushing to GitHub

### Deploy Backend to Render

1. Go to https://render.com
2. New Web Service
3. Connect GitHub repository
4. Select your `payterminal` repo
5. Root directory: `backend`
6. Deploy!

### Deploy Frontend to Vercel

1. Go to https://vercel.com
2. Import Project
3. Select your `payterminal` repo
4. Root directory: `frontend`
5. Deploy!

---

## Troubleshooting

### Problem: "Permission denied (publickey)"

**Solution: Use HTTPS instead of SSH**
```bash
git remote set-url origin https://github.com/YOUR_USERNAME/payterminal.git
git push -u origin main
```

### Problem: "Repository not found"

**Solution: Check repository name and username**
```bash
# Verify remote URL
git remote -v

# Update if wrong
git remote set-url origin https://github.com/CORRECT_USERNAME/payterminal.git
```

### Problem: ".env file is being tracked"

**Solution: Remove from git**
```bash
git rm --cached backend/.env
git rm --cached frontend/.env.local
git commit -m "Remove environment files"
git push
```

### Problem: "node_modules being uploaded"

**Solution: Ensure .gitignore is working**
```bash
# Remove from git
git rm -r --cached node_modules
git rm -r --cached backend/node_modules
git rm -r --cached frontend/node_modules
git commit -m "Remove node_modules"
git push
```

---

## Update Repository Later

When you make changes:

```bash
# Check what changed
git status

# Add changes
git add .

# Commit with message
git commit -m "Add new feature: merchant limits"

# Push to GitHub
git push
```

---

## Repository Settings (Recommended)

After pushing, configure on GitHub:

1. **Settings → General**
   - Add description
   - Add topics: `payment`, `invoice`, `nodejs`, `react`

2. **Settings → Branches**
   - Set `main` as default branch
   - Enable branch protection (optional)

3. **Settings → Secrets** (for CI/CD later)
   - Add `JWT_SECRET`
   - Add other sensitive variables

---

## Next Steps

1. ✅ Push to GitHub (you're here!)
2. 📦 Deploy backend to Render
3. 🚀 Deploy frontend to Vercel
4. 🎉 Your app is live!

Check `QUICK_DEPLOY.md` for deployment instructions.
