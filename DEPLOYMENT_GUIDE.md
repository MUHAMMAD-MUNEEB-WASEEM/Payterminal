# PayTerminal Deployment Guide

## 🚀 Free Hosting Setup

### Architecture
- **Frontend**: Vercel (Free tier - unlimited bandwidth)
- **Backend**: Render.com (Free tier - 750 hours/month)
- **Database**: NeDB (embedded, no external DB needed)
- **File Storage**: Backend server (logos stored locally)

---

## Part 1: Deploy Backend to Render.com

### Step 1: Prepare Backend for Deployment

1. **Create `render.yaml`** (already created for you)
2. **Ensure `.gitignore` excludes sensitive files**
3. **Set environment variables on Render**

### Step 2: Deploy to Render

1. **Sign up at Render.com**
   - Go to https://render.com
   - Sign up with GitHub (recommended)

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Or use "Deploy from Git URL"

3. **Configure Service**
   ```
   Name: payterminal-backend
   Environment: Node
   Build Command: npm install
   Start Command: node server.js
   Instance Type: Free
   ```

4. **Add Environment Variables**
   Go to "Environment" tab and add:
   ```
   PORT=5000
   JWT_SECRET=your-super-secret-jwt-key-change-this
   FRONTEND_URL=https://your-frontend.vercel.app
   NODE_ENV=production
   ```

5. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment (5-10 minutes)
   - Note your backend URL: `https://payterminal-backend.onrender.com`

### Step 3: Important Notes

⚠️ **Free Tier Limitations:**
- Service spins down after 15 minutes of inactivity
- First request after spin-down takes 30-60 seconds
- 750 hours/month (enough for 24/7 if only one service)

💡 **Persistent Storage:**
- NeDB files persist on Render's disk
- Data survives restarts
- Backup recommended for production

---

## Part 2: Deploy Frontend to Vercel

### Step 1: Prepare Frontend

1. **Update API URL** (already done in `frontend/src/api/axios.js`)
2. **Build test locally**
   ```bash
   cd frontend
   npm run build
   ```

### Step 2: Deploy to Vercel

#### Option A: Vercel CLI (Recommended)

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy Frontend**
   ```bash
   cd frontend
   vercel
   ```

4. **Follow prompts:**
   ```
   Set up and deploy? Yes
   Which scope? Your account
   Link to existing project? No
   Project name? payterminal
   Directory? ./
   Override settings? No
   ```

5. **Set Environment Variable**
   ```bash
   vercel env add VITE_API_URL
   # Enter: https://payterminal-backend.onrender.com
   ```

6. **Deploy to Production**
   ```bash
   vercel --prod
   ```

#### Option B: Vercel Dashboard

1. **Sign up at Vercel.com**
   - Go to https://vercel.com
   - Sign up with GitHub

2. **Import Project**
   - Click "Add New" → "Project"
   - Import your GitHub repository
   - Select `frontend` as root directory

3. **Configure Build**
   ```
   Framework Preset: Vite
   Root Directory: frontend
   Build Command: npm run build
   Output Directory: dist
   Install Command: npm install
   ```

4. **Add Environment Variable**
   ```
   VITE_API_URL=https://payterminal-backend.onrender.com
   ```

5. **Deploy**
   - Click "Deploy"
   - Wait 2-3 minutes
   - Get your URL: `https://payterminal.vercel.app`

---

## Part 3: Connect Frontend to Backend

### Update Frontend API URL

The frontend needs to know where the backend is:

1. **Create `.env.production` in frontend folder**
   ```env
   VITE_API_URL=https://payterminal-backend.onrender.com
   ```

2. **Update CORS on Backend**
   Backend already configured to accept your frontend URL

3. **Test Connection**
   - Open frontend URL
   - Try to login
   - Check browser console for errors

---

## Part 4: Post-Deployment Setup

### 1. Update Backend CORS

In Render dashboard, update `FRONTEND_URL` environment variable:
```
FRONTEND_URL=https://payterminal.vercel.app
```

### 2. Test All Features

- ✅ Login/Signup
- ✅ Create brands
- ✅ Add merchants
- ✅ Create invoices
- ✅ Payment links
- ✅ File uploads (logos)

### 3. Set Up Custom Domain (Optional)

**Vercel:**
- Go to Project Settings → Domains
- Add your custom domain
- Update DNS records

**Render:**
- Go to Settings → Custom Domain
- Add your domain
- Update DNS records

---

## Alternative Free Hosting Options

### Backend Alternatives

1. **Railway.app**
   - 500 hours/month free
   - $5 credit/month
   - Better performance than Render
   - Persistent storage included

2. **Fly.io**
   - 3 shared VMs free
   - Persistent volumes included
   - Global deployment

3. **Cyclic.sh**
   - Unlimited free tier
   - AWS Lambda based
   - No cold starts
   - Limited to 1GB storage

### Frontend Alternatives

1. **Netlify**
   - 100GB bandwidth/month
   - Automatic HTTPS
   - Form handling

2. **Cloudflare Pages**
   - Unlimited bandwidth
   - Fast global CDN
   - Free SSL

3. **GitHub Pages**
   - Free for public repos
   - Custom domain support
   - Simple setup

---

## Troubleshooting

### Backend Issues

**Problem: 502 Bad Gateway**
- Solution: Wait 60 seconds for cold start
- Check Render logs for errors

**Problem: Database not persisting**
- Solution: Ensure using Render Disk (not ephemeral)
- Check data directory exists

**Problem: File uploads failing**
- Solution: Ensure uploads directory is writable
- Check disk space on Render

### Frontend Issues

**Problem: API calls failing**
- Solution: Check CORS settings
- Verify VITE_API_URL is correct
- Check browser console

**Problem: Build failing**
- Solution: Check Node version compatibility
- Clear cache: `vercel --force`

**Problem: Environment variables not working**
- Solution: Redeploy after adding env vars
- Prefix with `VITE_` for Vite

---

## Production Checklist

Before going live:

- [ ] Change JWT_SECRET to strong random string
- [ ] Update FRONTEND_URL to production URL
- [ ] Test all payment gateways
- [ ] Set up error monitoring (Sentry)
- [ ] Configure backup strategy
- [ ] Test on mobile devices
- [ ] Set up custom domain
- [ ] Enable HTTPS (automatic on Vercel/Render)
- [ ] Test payment flows end-to-end
- [ ] Document admin credentials securely

---

## Monitoring & Maintenance

### Render.com
- Check logs: Dashboard → Logs
- Monitor usage: Dashboard → Metrics
- Set up alerts for downtime

### Vercel
- Analytics: Dashboard → Analytics
- Error tracking: Dashboard → Logs
- Performance monitoring included

### Recommended Tools
- **Uptime monitoring**: UptimeRobot (free)
- **Error tracking**: Sentry (free tier)
- **Analytics**: Google Analytics or Plausible

---

## Costs

### Free Tier Limits

**Render.com:**
- ✅ 750 hours/month (enough for 24/7)
- ✅ 512MB RAM
- ✅ Shared CPU
- ⚠️ Spins down after 15 min inactivity

**Vercel:**
- ✅ Unlimited bandwidth
- ✅ 100GB/month
- ✅ Automatic HTTPS
- ✅ No cold starts

**Total Cost: $0/month** 🎉

### Upgrade Options

If you need better performance:

**Render Starter ($7/month):**
- No spin-down
- 512MB RAM
- Always on

**Vercel Pro ($20/month):**
- Advanced analytics
- Password protection
- More team features

---

## Next Steps

1. Follow Part 1 to deploy backend
2. Follow Part 2 to deploy frontend
3. Test everything works
4. Share your live URL!

Your PayTerminal will be live at:
- Frontend: `https://payterminal.vercel.app`
- Backend: `https://payterminal-backend.onrender.com`

🎉 **Congratulations on deploying PayTerminal!**
