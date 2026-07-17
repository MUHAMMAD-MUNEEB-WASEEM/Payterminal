# ⚡ Quick Test Guide - Compliance User Verification

## 🔴 STEP 1: CLEAR BROWSER CACHE (MANDATORY)

**Before any testing:**
1. Press `Ctrl + Shift + Delete`
2. Select "All time" + Check ALL boxes
3. Click "Clear data"
4. Close ALL browser windows
5. Restart browser
6. Go to http://localhost:5173

---

## ✅ STEP 2: Quick Test Sequence

### Login
```
URL: http://localhost:5173
Email: muneeb@gmail.com (or your compliance user)
Password: [your password]
```

### Test 1: Toggle Merchant (30 seconds)
1. Go to **Merchants** page
2. Click **power button** (green icon)
3. Modal opens → Click **"Send Verification Code"**
4. Check backend console for 6-digit code
5. Enter code → Click **"Toggle Merchant"**
6. ✅ Success toast appears

### Test 2: Reset Merchant Volume (30 seconds)
1. Find merchant with processed amount > $0
2. Click **"Reset Volume"** button
3. Send code → Enter code
4. ✅ Volume resets to $0.00

### Test 3: Create Brand (45 seconds)
1. Go to **Brands** page
2. Click **"Add Brand"**
3. Fill: Name, Office #, Upload logo
4. Click **"Create"**
5. Modal opens → Send code → Enter code
6. ✅ Brand created

### Test 4: Update Refund (45 seconds)
1. Go to **Invoices** page
2. Click **"..."** menu on paid invoice
3. Click **"Mark as Refunded"**
4. Enter amount (e.g., $50.00)
5. Click **"Confirm Refund"**
6. Modal opens → Send code → Enter code
7. ✅ Invoice status = "Refunded"

### Test 5: Update Chargeback (45 seconds)
1. Click **"..."** menu on paid invoice
2. Click **"Mark as Chargebacked"**
3. Enter amount
4. Click **"Confirm Chargeback"**
5. Send code → Enter code
6. ✅ Invoice status = "Chargebacked"

---

## 🔍 What to Check

### Frontend Console (F12)
Should see:
```
🔘 Toggle requested for merchant: [id]
🔐 Opening verification modal
🔓 VerificationModal opened with props: { targetId: '...', targetName: '...' }
```

### Backend Console
Should see:
```
📧 VERIFICATION CODE: 123456
👤 User: Muneeb
🎯 Action: toggle_merchant
```

---

## 🚨 Red Flags

❌ **targetId: null** → Clear browser cache again
❌ **"Invalid verification code"** → Clear browser cache again
❌ **Modal doesn't open** → Clear browser cache again
❌ **"Admin access required"** → Check backend running on Terminal 9

---

## ✅ Success Indicators

All these should work:
- ✅ Modal opens for every operation
- ✅ Code generates (shows in backend console)
- ✅ Code validates successfully
- ✅ Operation completes
- ✅ Success toast appears
- ✅ UI updates (status changes, etc.)

---

## 🎯 All Verification Actions

1. Toggle merchant active/inactive
2. Reset merchant volume
3. Reset merchant ticket size
4. Create brand
5. Edit brand
6. Delete brand
7. Assign merchant to brand
8. Archive invoice
9. Unarchive invoice
10. Update refund amount (NEW)
11. Update chargeback amount (NEW)

---

## 📊 Current Status

- **Backend**: ✅ Running (Terminal 9, Port 5000)
- **Frontend**: ✅ Running (Terminal 8, Port 5173)
- **Cache**: ⚠️ YOU need to clear
- **Code**: ✅ All updates deployed

---

## 🔧 If Something Goes Wrong

1. **Clear browser cache again** (most common fix)
2. Check both consoles for errors
3. Verify servers running:
   - Backend: http://localhost:5000
   - Frontend: http://localhost:5173
4. Try different browser
5. Check documentation: `COMPLIANCE_COMPLETE_SUMMARY.md`

---

**Ready to test! Start with clearing cache, then login and test. 🚀**
