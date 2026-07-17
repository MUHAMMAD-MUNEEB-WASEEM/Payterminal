# Compliance User Testing Guide

## ✅ Current Status (After Latest Fixes)

### Backend Server
- **Status**: ✅ RUNNING on http://localhost:5000 (Terminal ID 7)
- All verification endpoints working correctly

### Frontend Server  
- **Status**: ✅ RUNNING on http://localhost:5173 (Terminal ID 8)
- **Cache**: ✅ CLEARED - Fresh JavaScript loaded
- All compliance features updated with proper verification flow

---

## 🔴 CRITICAL: Clear Browser Cache

**BEFORE TESTING**, you MUST clear your browser cache completely:

### Option 1: Hard Clear (Recommended)
1. Close ALL browser tabs
2. Open browser settings
3. Clear browsing data → Select "All time" → Check all boxes
4. Close and restart browser
5. Navigate to http://localhost:5173

### Option 2: Use Different Browser
- If using Chrome, try Firefox or Edge
- This guarantees no cached code

### Option 3: Incognito/Private Window
- Open a fresh incognito/private window
- Navigate to http://localhost:5173

---

## 🧪 Testing Checklist for Compliance User

### Test 1: Login as Compliance User ✓
```
Email: muneeb@gmail.com (or your compliance user email)
Password: (your password)
```

**Expected Result**:
- ✅ Login successful
- ✅ Dashboard loads
- ✅ Navigation shows: Dashboard, Invoices, Brands, Merchants, Notifications

---

### Test 2: Merchants Page Access ✓
**Steps**:
1. Navigate to "Merchants" page

**Expected Result**:
- ✅ No "Admin access required" error
- ✅ All merchants visible (same as admin sees)
- ✅ Merchant cards show: toggle button, reset volume, reset ticket size

---

### Test 3: Toggle Merchant Active/Inactive ✓
**Steps**:
1. Find any active merchant
2. Click the power button (green icon)
3. Verification modal should open

**Expected Console Logs**:
```
🔘 Toggle requested for merchant: [merchant_id]
🔐 Opening verification modal for toggle
🔓 VerificationModal opened with props: { action: 'toggle_merchant', targetId: '[merchant_id]', targetName: '[merchant_nickname]' }
```

**Expected Behavior**:
- ✅ Modal opens with title "Verification Required"
- ✅ Shows "Send Verification Code" button
- ✅ Click button → "Sending Code..." appears
- ✅ Backend console shows 6-digit code (e.g., "📧 VERIFICATION CODE: 123456")
- ✅ Enter code in modal
- ✅ Click "Toggle Merchant" button
- ✅ Merchant status changes (Active ↔ Inactive)
- ✅ Toast notification: "Merchant activated/deactivated"

**If it fails with "Invalid or already used verification code"**:
- The code is being validated twice (bug not fixed)
- Check that `skipVerify={true}` is set in VerificationModal component

---

### Test 4: Reset Merchant Volume ✓
**Steps**:
1. Find a merchant with processed amount > $0
2. Click "Reset Volume" button
3. Verification modal should open

**Expected Console Logs**:
```
📊 Reset volume requested for: [merchant_id]
🔐 Opening verification modal for reset volume
🔓 VerificationModal opened with props: { action: 'reset_volume', targetId: '[merchant_id]', targetName: '[merchant_nickname]' }
```

**Expected Behavior**:
- ✅ Modal opens
- ✅ Click "Send Verification Code"
- ✅ Backend console shows code
- ✅ Enter code → Click "Reset Volume"
- ✅ Merchant's processed amount resets to $0.00
- ✅ Toast: "Merchant volume reset successfully"

---

### Test 5: Reset Ticket Size ✓
**Steps**:
1. Find a merchant with ticket size set
2. Click "Reset" button (under ticket size display)
3. Verification modal should open

**Expected Console Logs**:
```
📏 Reset ticket size requested for: [merchant_id]
🔐 Opening verification modal for reset ticket size
```

**Expected Behavior**:
- ✅ Modal opens
- ✅ Code sent → Enter code
- ✅ Ticket size updated
- ✅ Toast: "Ticket size reset successfully"

---

### Test 6: Create Brand ✓
**Steps**:
1. Navigate to "Brands" page
2. Click "Add Brand" button
3. Fill in: Brand name, Office #, Logo (required), Redirect URL (optional)
4. Click "Create" button

**Expected Console Logs**:
```
🔓 VerificationModal opened with props: { action: 'create_brand', ... }
```

**Expected Behavior**:
- ✅ Verification modal opens (not the create form submitting directly)
- ✅ Click "Send Verification Code"
- ✅ Enter code → Click "Create Brand"
- ✅ Brand created
- ✅ Toast: "Brand created"
- ✅ Create modal closes

---

### Test 7: Edit Brand ✓
**Steps**:
1. Click edit button on any brand
2. Modify brand name or other fields
3. Click "Update" button

**Expected Behavior**:
- ✅ Verification modal opens
- ✅ Code sent → Enter code
- ✅ Brand updated
- ✅ Toast: "Brand updated"

---

### Test 8: Delete Brand ✓
**Steps**:
1. Click delete button on any brand

**Expected Behavior**:
- ✅ NO confirmation dialog (for compliance users)
- ✅ Verification modal opens directly with title "Verification Required"
- ✅ Modal shows the action context
- ✅ Code sent → Enter code
- ✅ Brand deleted
- ✅ Toast: "Brand deleted"

---

### Test 9: Archive/Unarchive Invoice ✓
**Steps**:
1. Navigate to "Invoices" page
2. Click "Archive" button on any active invoice

**Expected Behavior**:
- ✅ Verification modal opens
- ✅ Code sent → Enter code
- ✅ Invoice moves to "Archived" tab
- ✅ Toast: "Invoice archived successfully"

**Then test unarchive**:
1. Switch to "Archived" tab
2. Click "Unarchive" button
3. Enter verification code
4. Invoice moves back to "Active" tab

---

## 🚨 Common Issues & Solutions

### Issue 1: "Invalid or already used verification code"
**Cause**: Browser is using cached JavaScript that validates code twice

**Solution**:
1. Close ALL browser tabs with the app
2. Clear browser cache completely (all time, all data)
3. Restart browser
4. Navigate to http://localhost:5173

### Issue 2: Modal opens but "targetId: null, targetName: null"
**Cause**: Browser cache not cleared

**Solution**: Same as Issue 1

### Issue 3: "Admin access required" on Merchants page
**Cause**: Backend server not running

**Solution**: Backend is now running (Terminal ID 7). If error persists, check backend console for errors.

### Issue 4: Verification code not generated
**Cause**: Backend action validation failing

**Check Backend Console**: Should show:
```
📥 Generate verification request: { action: '...', targetId: '...', targetName: '...' }
```

If `targetId` or `targetName` are null → Browser cache issue

---

## 📋 Updated File List

### Frontend Files Modified:
1. `frontend/src/pages/Merchants.jsx` - Added targetId/targetName props to VerificationModal
2. `frontend/src/pages/Brands.jsx` - Already had skipVerify={true}
3. `frontend/src/components/VerificationModal.jsx` - Supports skipVerify prop

### Backend Files (Already Correct):
1. `backend/src/routes/verification.js` - Validates actions
2. `backend/src/routes/merchants.js` - Has verification endpoints
3. `backend/src/routes/brands.js` - Has verification support
4. `backend/src/middleware/auth.js` - adminOrCompliance middleware

---

## 🎯 Expected Backend Console Output

When verification code is requested:
```
📥 Generate verification request: {
  action: 'reset_volume',
  targetId: 'R2uYnSvxeIzUObOQ',  ← Should have merchant ID
  targetName: 'Main Stripe',      ← Should have merchant nickname
  userId: '0ozri6LE25LwqPb0'
}

🔐 ====================
📧 VERIFICATION CODE: 123456
👤 User: Muneeb
🎯 Action: reset_volume
⏰ Expires: 9:22:23 pm
🔐 ====================
```

---

## ✅ Success Criteria

All tests pass when:
1. ✅ Verification modal opens for all compliance operations
2. ✅ targetId and targetName are NOT null in backend logs
3. ✅ Code is generated successfully
4. ✅ Code validates successfully (not marked as "already used")
5. ✅ Operation completes (merchant toggled, volume reset, brand created, etc.)
6. ✅ Success toast notification appears
7. ✅ UI updates to reflect changes

---

## 🔧 If Still Having Issues After Cache Clear

1. **Check browser DevTools Console** (F12):
   - Look for JavaScript errors
   - Check Network tab for failed API calls
   - Look for the debug logs (🔓, 🎯, 🔐)

2. **Check Backend Console**:
   - Should show verification request with proper targetId/targetName
   - Should show 6-digit code
   - Should show verification attempt

3. **Verify servers are running**:
   - Backend: http://localhost:5000 (Terminal ID 7)
   - Frontend: http://localhost:5173 (Terminal ID 8)

4. **Last Resort - Complete Fresh Start**:
   ```cmd
   # Stop both servers
   # Clear Vite cache
   cd frontend
   rd /s /q node_modules\.vite
   
   # Restart backend
   cd ..\backend
   npm start
   
   # Restart frontend  
   cd ..\frontend
   npm run dev
   
   # Clear browser completely and restart
   ```

---

## 📞 Support

If issues persist after following all steps above, provide:
1. Browser console screenshot (F12 → Console tab)
2. Backend console output (copy last 50 lines)
3. Specific action being tested (toggle/reset/create/delete)
4. Browser name and version

---

**Last Updated**: After fixing targetId/targetName props in Merchants.jsx
**Frontend Cache**: Cleared - Fresh build loaded
**Backend Status**: Running with all verification endpoints active
