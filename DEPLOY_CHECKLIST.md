# 📋 Deployment Checklist

## Pre-Deployment

- [ ] All features tested locally
- [ ] Environment variables documented
- [ ] Sensitive data removed from code
- [ ] `.gitignore` files in place
- [ ] Database backup created (if needed)

## Backend Deployment (Render.com)

- [ ] Sign up at https://render.com
- [ ] Create new Web Service
- [ ] Connect GitHub repository
- [ ] Set root directory to `backend`
- [ ] Configure build command: `npm install`
- [ ] Configure start command: `node server.js`
- [ ] Add environment variables:
  - [ ] `JWT_SECRET` (generate random string)
  - [ ] `FRONTEND_URL` (will update after frontend deploy)
  - [ ] `NODE_ENV=production`
- [ ] Enable persistent disk for data storage
- [ ] Deploy and wait for completion
- [ ] Copy backend URL: `https://______.onrender.com`
- [ ] Test backend health: `https://______.onrender.com/api`

## Frontend Deployment (Vercel)

- [ ] Update `frontend/.env.production` with backend URL
- [ ] Sign up at https://vercel.com
- [ ] Import project from GitHub
- [ ] Set root directory to `frontend`
- [ ] Framework preset: Vite
- [ ] Add environment variable:
  - [ ] `VITE_API_URL=https://your-backend.onrender.com`
- [ ] Deploy and wait for completion
- [ ] Copy frontend URL: `https://______.vercel.app`

## Post-Deployment Configuration

- [ ] Update backend `FRONTEND_URL` env var with Vercel URL
- [ ] Restart backend service on Render
- [ ] Test CORS is working
- [ ] Verify file uploads work
- [ ] Test all API endpoints

## Testing

- [ ] Open frontend URL
- [ ] Login with admin credentials
- [ ] Create a test brand
- [ ] Upload brand logo
- [ ] Add a test merchant
- [ ] Create a test invoice
- [ ] Open payment link
- [ ] Complete test payment
- [ ] Verify payment success
- [ ] Check notifications work
- [ ] Test on mobile device

## Security

- [ ] Change default admin password
- [ ] Verify HTTPS is enabled (automatic)
- [ ] Check CORS settings
- [ ] Review exposed environment variables
- [ ] Set up error monitoring (optional)

## Optional Enhancements

- [ ] Set up custom domain on Vercel
- [ ] Set up custom domain on Render
- [ ] Configure uptime monitoring (UptimeRobot)
- [ ] Set up error tracking (Sentry)
- [ ] Enable analytics (Google Analytics)
- [ ] Set up automated backups
- [ ] Configure email notifications

## Troubleshooting

### If backend returns 502:
- Wait 60 seconds for cold start
- Check Render logs for errors
- Verify environment variables are set

### If frontend can't connect to backend:
- Check VITE_API_URL is correct
- Verify CORS settings on backend
- Check browser console for errors
- Ensure backend is running

### If file uploads fail:
- Check disk is mounted on Render
- Verify uploads directory exists
- Check file size limits

## Success Criteria

✅ Frontend loads without errors  
✅ Can login as admin  
✅ Can create brands with logos  
✅ Can add merchants  
✅ Can create invoices  
✅ Payment links work  
✅ Payments process successfully  
✅ Data persists across restarts  

## Live URLs

**Frontend**: https://______.vercel.app  
**Backend**: https://______.onrender.com  
**Admin Login**: admin / admin (change this!)

---

## Need Help?

- Render Docs: https://render.com/docs
- Vercel Docs: https://vercel.com/docs
- Check `DEPLOYMENT_GUIDE.md` for detailed instructions
- Check `QUICK_DEPLOY.md` for fast deployment

🎉 **Your PayTerminal is now live!**
