# 🚀 Quick Deploy Guide

## Deploy in 10 Minutes!

### Step 1: Deploy Backend (5 minutes)

1. **Go to Render.com**
   - Visit: https://render.com
   - Sign up with GitHub

2. **Create Web Service**
   - Click "New +" → "Web Service"
   - Connect your repository
   - Select `backend` folder

3. **Configure**
   ```
   Name: payterminal-backend
   Build Command: npm install
   Start Command: node server.js
   ```

4. **Add Environment Variables**
   ```
   JWT_SECRET=your-secret-key-here-change-this
   FRONTEND_URL=https://your-app.vercel.app
   ```

5. **Deploy** → Copy your backend URL

### Step 2: Deploy Frontend (5 minutes)

1. **Update Frontend API URL**
   - Edit `frontend/.env.production`
   - Set: `VITE_API_URL=https://your-backend.onrender.com`

2. **Go to Vercel.com**
   - Visit: https://vercel.com
   - Sign up with GitHub

3. **Import Project**
   - Click "Add New" → "Project"
   - Select your repository
   - Root Directory: `frontend`

4. **Add Environment Variable**
   ```
   VITE_API_URL=https://your-backend.onrender.com
   ```

5. **Deploy** → Get your frontend URL

### Step 3: Update CORS

1. Go back to Render dashboard
2. Update `FRONTEND_URL` to your Vercel URL
3. Restart backend service

### Done! 🎉

Your app is live at:
- Frontend: `https://your-app.vercel.app`
- Backend: `https://your-backend.onrender.com`

## Test It

1. Open frontend URL
2. Login with: `admin` / `admin`
3. Create a brand
4. Add a merchant
5. Create an invoice
6. Test payment link

## Important Notes

⚠️ **First Load**: Backend takes 30-60 seconds to wake up (free tier)
💾 **Data**: Persists across restarts
🔒 **HTTPS**: Automatic on both platforms
💰 **Cost**: $0/month

## Need Help?

Check `DEPLOYMENT_GUIDE.md` for detailed instructions and troubleshooting.
