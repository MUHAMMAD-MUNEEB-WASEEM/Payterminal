# Compliance User - Refund & Chargeback Verification Feature

## Overview
Added verification code requirement for compliance users when updating invoice refund or chargeback amounts. Admin users can still update these values without verification.

---

## ✅ Changes Made

### 1. Backend - Invoice Routes (`backend/src/routes/invoices.js`)

#### Updated Refund Endpoint
**Route**: `PATCH /api/invoices/:id/refund`

**Changes**:
- Added `verificationCode` parameter support
- Added verification logic for compliance users
- Admin users bypass verification (no code required)

**Logic Flow**:
1. Validate refund amount (required, > 0, <= invoice total)
2. **If compliance user**:
   - Require verification code
   - Validate code against database
   - Check expiration
   - Mark code as used
3. Update invoice with refund amount and status
4. Return updated invoice

**Code Added**:
```javascript
// Compliance users need verification code
if (req.user.role === 'compliance') {
  if (!verificationCode) {
    return res.status(400).json({ message: 'Verification code is required' });
  }
  
  // Verify the code
  const verification = await db.verificationCodes.findOne({
    code: verificationCode,
    userId: req.user._id,
    action: 'update_refund',
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
```

#### Updated Chargeback Endpoint
**Route**: `PATCH /api/invoices/:id/chargeback`

**Changes**:
- Added `verificationCode` parameter support
- Added verification logic for compliance users (identical to refund)
- Admin users bypass verification

**Action Type**: `update_chargeback`

---

### 2. Backend - Verification Routes (`backend/src/routes/verification.js`)

**Added Valid Actions**:
```javascript
const validActions = [
  'reset_volume', 
  'reset_ticket_size', 
  'toggle_merchant', 
  'create_brand',
  'edit_brand',
  'delete_brand',
  'assign_merchant_to_brand',
  'archive_invoice',
  'unarchive_invoice',
  'update_refund',        // ← NEW
  'update_chargeback'     // ← NEW
];
```

---

### 3. Frontend - Invoices Page (`frontend/src/pages/Invoices.jsx`)

#### Updated State
```javascript
const [verificationModal, setVerificationModal] = useState({ 
  open: false, 
  action: '', 
  invoiceId: null, 
  invoiceNumber: null,   // ← NEW
  pendingAmount: null    // ← NEW
});
```

#### Updated handleRefund Function
**Changes**:
- Added `verificationCode` parameter
- Check if user is compliance → open verification modal
- Pass verification code to API when provided

**Flow for Compliance Users**:
1. User enters refund amount and clicks "Confirm Refund"
2. `handleRefund()` called without verification code
3. Function detects compliance user → opens verification modal
4. Modal shows "Send Verification Code" button
5. User receives code via email (logged to backend console)
6. User enters code → clicks "Update Refund"
7. `handleVerificationComplete()` calls `handleRefund()` again with code
8. API request sent with verification code
9. Backend validates code
10. Invoice updated

#### Updated handleChargeback Function
**Same flow as refund**, action type: `update_chargeback`

#### Updated handleVerificationComplete Function
```javascript
const handleVerificationComplete = (code) => {
  const { action, invoiceId, pendingAmount } = verificationModal;
  if (action === 'archive_invoice') {
    handleArchive(invoiceId, code);
  } else if (action === 'unarchive_invoice') {
    handleUnarchive(invoiceId, code);
  } else if (action === 'update_refund') {         // ← NEW
    const invoice = invoices.find(inv => inv._id === invoiceId);
    if (invoice) {
      handleRefund(invoice, code);
    }
  } else if (action === 'update_chargeback') {     // ← NEW
    const invoice = invoices.find(inv => inv._id === invoiceId);
    if (invoice) {
      handleChargeback(invoice, code);
    }
  }
};
```

#### Updated VerificationModal Component
```jsx
<VerificationModal
  isOpen={verificationModal.open}
  onClose={() => setVerificationModal({ 
    open: false, 
    action: '', 
    invoiceId: null, 
    invoiceNumber: null, 
    pendingAmount: null 
  })}
  onVerified={handleVerificationComplete}
  action={verificationModal.action}
  targetId={verificationModal.invoiceId}           // ← Invoice ID
  targetName={verificationModal.invoiceNumber}     // ← Invoice Number
  actionLabel={
    verificationModal.action === 'archive_invoice' ? 'Archive Invoice' :
    verificationModal.action === 'unarchive_invoice' ? 'Unarchive Invoice' :
    verificationModal.action === 'update_refund' ? 'Update Refund' :           // ← NEW
    verificationModal.action === 'update_chargeback' ? 'Update Chargeback' :   // ← NEW
    'Verify'
  }
  skipVerify={true}  // ← Prevents double verification
/>
```

---

## 🧪 Testing Guide

### Prerequisites
1. Backend server running on port 5000
2. Frontend server running on port 5173
3. Compliance user account created
4. At least one paid invoice in the system

### Test 1: Refund Invoice (Compliance User)

**Steps**:
1. Login as compliance user
2. Navigate to Invoices page
3. Find a paid invoice
4. Click "..." menu → "Mark as Refunded"
5. Enter refund amount (e.g., $50.00)
6. Click "Confirm Refund"

**Expected Result**:
- ✅ Verification modal opens (refund modal stays open in background)
- ✅ Modal shows "Verification Required" title
- ✅ Button shows "Send Verification Code"

**Continue**:
7. Click "Send Verification Code"

**Expected Backend Console Output**:
```
📥 Generate verification request: {
  action: 'update_refund',
  targetId: '[invoice_id]',
  targetName: 'INV-ABC123',
  userId: '[user_id]'
}

🔐 ====================
📧 VERIFICATION CODE: 123456
👤 User: Muneeb
🎯 Action: update_refund
⏰ Expires: 10:15:30 pm
🔐 ====================
```

**Continue**:
8. Enter the 6-digit code
9. Click "Update Refund"

**Expected Result**:
- ✅ Verification modal closes
- ✅ Refund modal closes
- ✅ Toast notification: "Invoice marked as refunded"
- ✅ Invoice status changes to "Refunded"
- ✅ Refund amount displayed on invoice

---

### Test 2: Chargeback Invoice (Compliance User)

**Steps**:
1. Find a paid invoice
2. Click "..." menu → "Mark as Chargebacked"
3. Enter chargeback amount
4. Click "Confirm Chargeback"

**Expected Result**:
- ✅ Verification modal opens
- ✅ Action shows "Update Chargeback"

**Continue**:
5. Click "Send Verification Code"
6. Check backend console for code
7. Enter code → Click "Update Chargeback"

**Expected Result**:
- ✅ Chargeback modal closes
- ✅ Toast: "Invoice marked as chargebacked"
- ✅ Invoice status changes to "Chargebacked"

---

### Test 3: Admin User (No Verification Required)

**Steps**:
1. Login as admin user
2. Navigate to Invoices
3. Mark invoice as refunded/chargebacked
4. Enter amount → Click confirm

**Expected Result**:
- ✅ NO verification modal appears
- ✅ Invoice updated immediately
- ✅ Toast notification appears

---

## 🔍 Verification Code Details

### Action Types Added
| Action | Description | Used By |
|--------|-------------|---------|
| `update_refund` | Update invoice refund amount | Compliance users only |
| `update_chargeback` | Update invoice chargeback amount | Compliance users only |

### Code Properties
- **Length**: 6 digits (e.g., 123456)
- **Expiration**: 10 minutes from generation
- **Single Use**: Code marked as "used" after successful validation
- **User Specific**: Code tied to the user who requested it
- **Action Specific**: Code tied to specific action (update_refund or update_chargeback)
- **Target Specific**: Code tied to specific invoice ID

---

## 📊 API Endpoints Summary

### Generate Verification Code
```
POST /api/verification/generate
Authorization: Bearer <token>
Body: {
  "action": "update_refund" | "update_chargeback",
  "targetId": "<invoice_id>",
  "targetName": "<invoice_number>"
}
```

### Update Refund (with verification for compliance)
```
PATCH /api/invoices/:id/refund
Authorization: Bearer <token>
Body: {
  "refundAmount": 50.00,
  "verificationCode": "123456"  // Required for compliance users
}
```

### Update Chargeback (with verification for compliance)
```
PATCH /api/invoices/:id/chargeback
Authorization: Bearer <token>
Body: {
  "chargebackAmount": 30.00,
  "verificationCode": "123456"  // Required for compliance users
}
```

---

## 🚨 Error Handling

### Frontend Errors
| Error | Cause | Solution |
|-------|-------|----------|
| "Verification code is required" | Compliance user trying to update without code | Generate and enter verification code |
| "Invalid or already used verification code" | Code already validated or doesn't exist | Request new code |
| "Verification code has expired" | Code older than 10 minutes | Request new code |
| "Refund amount cannot exceed invoice total" | Amount > invoice total | Enter valid amount |

### Backend Validation
- ✅ Refund/chargeback amount must be positive
- ✅ Amount cannot exceed invoice total
- ✅ Verification code required for compliance users
- ✅ Code must be valid, unused, and not expired
- ✅ Code must match user, action, and invoice

---

## 📋 Complete Compliance Actions Requiring Verification

1. ✅ Reset merchant volume
2. ✅ Reset merchant ticket size
3. ✅ Toggle merchant active/inactive
4. ✅ Create brand
5. ✅ Edit brand
6. ✅ Delete brand
7. ✅ Assign merchant to brand
8. ✅ Archive invoice
9. ✅ Unarchive invoice
10. ✅ **Update invoice refund amount** (NEW)
11. ✅ **Update invoice chargeback amount** (NEW)

---

## 🔧 Files Modified

### Backend
1. `backend/src/routes/invoices.js` - Added verification for refund/chargeback
2. `backend/src/routes/verification.js` - Added new action types

### Frontend
1. `frontend/src/pages/Invoices.jsx` - Added verification flow for refund/chargeback

---

## ✅ Feature Complete

All invoice update operations for compliance users now require email verification:
- Archive/Unarchive
- Refund
- Chargeback

Admin users continue to have direct access without verification requirements.

---

**Last Updated**: After adding refund/chargeback verification
**Status**: ✅ Complete and ready for testing
