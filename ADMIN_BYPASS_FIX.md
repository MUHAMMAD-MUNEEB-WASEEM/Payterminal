# Admin User - Bypass Verification Fix

## 🐛 Issue Found
Admin users were being required to provide verification codes for merchant operations (reset volume, reset ticket size, toggle active), when they should be able to perform these actions without verification.

## ❌ Problem
Backend endpoints were checking for `verificationCode` for ALL users:
```javascript
if (!verificationCode) {
  return res.status(400).json({ message: 'Verification code is required' });
}
```

This meant even admin users got the error: **"Verification code is required"**

---

## ✅ Solution Applied

Updated all three merchant operation endpoints to check user role BEFORE requiring verification:

### 1. Reset Merchant Volume (`POST /api/merchants/:id/reset-volume`)
### 2. Reset Merchant Ticket Size (`POST /api/merchants/:id/reset-ticket-size`)
### 3. Toggle Merchant Active (`POST /api/merchants/:id/toggle-active`)

**New Logic**:
```javascript
// Compliance users need verification code, admin users bypass
if (req.user.role === 'compliance') {
  if (!verificationCode) {
    return res.status(400).json({ message: 'Verification code is required' });
  }
  
  // Verify the code
  const verification = await db.verificationCodes.findOne({
    code: verificationCode,
    userId: req.user._id,
    action: 'reset_volume', // or 'reset_ticket_size', 'toggle_merchant'
    targetId: req.params.id,
    used: false,
  });
  
  if (!verification) {
    return res.status(400).json({ message: 'Invalid or already used verification code' });
  }
  
  if (new Date(verification.expiresAt) < new Date()) {
    return res.status(400).json({ message: 'Verification code has expired' });
  }
  
  // Mark verification as used
  await db.verificationCodes.update(
    { _id: verification._id },
    { $set: { used: true, usedAt: new Date().toISOString() } }
  );
}

// Admin users skip all verification - proceed directly to operation
// Reset volume / ticket size / toggle active...
```

---

## 🎯 Expected Behavior Now

### For Admin Users:
- ✅ Click "Reset Volume" → Immediately resets (no modal)
- ✅ Click "Reset Ticket Size" → Immediately updates (no modal)
- ✅ Click power button (toggle) → Immediately toggles (no modal)
- ✅ **NO verification code required**
- ✅ **NO verification modal appears**

### For Compliance Users:
- ⚠️ Click any merchant operation button
- ⚠️ Verification modal opens
- ⚠️ Must generate and enter 6-digit code
- ⚠️ Code validated before operation proceeds

---

## 📁 Files Modified

### Backend
- ✅ `backend/src/routes/merchants.js` - Added role check before verification

### Changes Summary
1. **Line ~420**: Reset volume endpoint - Added `if (req.user.role === 'compliance')`
2. **Line ~470**: Reset ticket size endpoint - Added `if (req.user.role === 'compliance')`
3. **Line ~525**: Toggle active endpoint - Added `if (req.user.role === 'compliance')`

---

## 🧪 Testing Instructions

### Test as Admin User
1. Login as admin
2. Go to Merchants page
3. Click "Reset Volume" on any merchant
4. **Expected**: Volume resets immediately, NO modal appears
5. Click "Reset" under ticket size
6. **Expected**: Updates immediately, NO modal appears
7. Click power button to toggle active
8. **Expected**: Status toggles immediately, NO modal appears

### Test as Compliance User (Should Still Work)
1. Login as compliance user
2. Go to Merchants page
3. Click "Reset Volume"
4. **Expected**: Verification modal opens
5. Generate code → Enter code
6. **Expected**: Volume resets after verification

---

## 🔄 Server Status

- **Backend**: ✅ Restarted with fix (Terminal ID 10)
- **Port**: http://localhost:5000
- **Status**: Running with updated merchant routes

---

## 📊 Complete Verification Matrix

| Operation | Admin | Compliance |
|-----------|-------|------------|
| Reset Merchant Volume | ✅ Direct (no verification) | ⚠️ Requires code |
| Reset Merchant Ticket Size | ✅ Direct (no verification) | ⚠️ Requires code |
| Toggle Merchant Active | ✅ Direct (no verification) | ⚠️ Requires code |
| Create Brand | ✅ Direct (no verification) | ⚠️ Requires code |
| Edit Brand | ✅ Direct (no verification) | ⚠️ Requires code |
| Delete Brand | ✅ Direct (no verification) | ⚠️ Requires code |
| Archive Invoice | ✅ Direct (no verification) | ⚠️ Requires code |
| Unarchive Invoice | ✅ Direct (no verification) | ⚠️ Requires code |
| Update Refund | ✅ Direct (no verification) | ⚠️ Requires code |
| Update Chargeback | ✅ Direct (no verification) | ⚠️ Requires code |

---

## ✅ Fix Complete

**Status**: Backend updated and restarted
**Testing**: Ready for admin user testing
**Next Step**: Test as admin user - all merchant operations should work without verification modal

---

**Last Updated**: After fixing admin bypass for merchant operations
