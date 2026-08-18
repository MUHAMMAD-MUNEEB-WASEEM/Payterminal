# 🚀 Start Testing USPTO Feature - Quick Guide

## Prerequisites Check

### 1. Servers Running?

**Backend:**
```bash
cd backend
npm start
```
✅ Should see: `Server running on port 5000`

**Frontend:**
```bash
cd frontend
npm run dev
```
✅ Should see: `Local: http://localhost:5173`

---

## Quick Test (5 Minutes)

### Step 1: Login as Admin
1. Open browser: `http://localhost:5173`
2. Login with admin credentials
3. Navigate to **Invoices** page

### Step 2: Create USPTO Invoice
1. Click **New Invoice** button
2. Select brand: **USPTO Office**
3. Fill in:
   - Customer Name: `Test Customer`
   - Customer Email: `test@example.com`
   - Customer Serial Number: `SN-12345`
   - Add item: `Filing Fee` - `100.00`
4. Click **Create Invoice**
5. Click the **link icon** 🔗 to copy payment link

### Step 3: Customer Submits Payment
1. Open payment link in **incognito/private window**
2. Verify with matching details:
   - Name: `Test Customer`
   - Email: `test@example.com`
   - Serial: `SN-12345`
3. Fill USPTO form:
   - SSN Last 4: `1234`
   - DOB: `1990-01-01`
   - Card: `4111 1111 1111 1111`
   - Expiry: `12 / 2025`
   - CVV: `123`
   - Name: `Test Customer`
4. Click **Submit Payment Request**
5. ✅ See loading screen: "Processing Your Payment"

### Step 4: Admin Triggers OTP Screen
1. Go back to admin window
2. Refresh Invoices page
3. Find invoice (status: **Payment Requested**)
4. Click **📧 Email** button (blue envelope)
5. (Optional) Type note: `We're reviewing your info`
6. Click **Show Shared Status**
7. ✅ Modal closes

### Step 5: Customer Enters Code
1. Go back to customer window
2. ✅ See OTP input screen (auto-updates)
3. Enter any 6 digits: `123456`
4. Click **Proceed with Payment**
5. ✅ See: "Payment Marked by Customer"

### Step 6: Admin Finalizes
1. Go back to admin window
2. Refresh Invoices page
3. Find invoice (still **Payment Requested**)
4. Now see **3 action buttons**:
   - ✅ Green checkmark (Paid)
   - ❌ Red X (Failed)
   - 💳 Orange card (Card Not Accepted)
5. Click **✅ Paid**
6. Confirm action
7. ✅ Status changes to **Paid**

### Step 7: Customer Sees Result
1. Go back to customer window
2. ✅ See success screen (auto-updates)
3. Shows: "Payment Successful! USD $100.00"

---

## 🎉 Success!

If all steps worked, the USPTO feature is working correctly!

---

## What If Something Breaks?

### Customer stuck on loading screen?
- Check backend console for errors
- Check browser console (F12) for errors
- Verify polling is happening (Network tab)

### Admin buttons don't appear?
- Refresh the page
- Check invoice `otpStatus` in database
- Verify `brand.isManualPayment === true`

### OTP input screen doesn't show?
- Check backend updated `otpStatus` to `email_sent`
- Check browser console for polling errors
- Verify `payment-status` endpoint is responding

### Backend errors?
- Check logs in `backend/logs/` folder
- Check console output for stack traces
- Verify all dependencies installed: `npm install`

### Frontend errors?
- Check browser console (F12)
- Verify frontend compiled without errors
- Check for React errors in console

---

## Test Variations

### Try SMS Path
Repeat test but click **💬 SMS** button instead of Email in Step 4.
✅ Should work identically, customer just sees "text message" instead of "email"

### Try Failed Action
In Step 6, click **❌ Failed** instead of Paid.
✅ Invoice should be marked as failed

### Try Card Not Accepted
In Step 6, click **💳 Card Not Accepted**.
✅ Invoice should be marked as failed with action logged

---

## Console Logs to Look For

### Backend Console (during test):
```
========== USPTO PAYMENT REQUEST ==========
Invoice INV-XXXXXXXX status changed to payment_requested
========== USPTO PAYMENT REQUEST COMPLETE ==========

========== ADMIN TRIGGER OTP SCREEN ==========
OTP screen triggered for invoice INV-XXXXXXXX
========== ADMIN TRIGGER OTP SCREEN COMPLETE ==========

========== CUSTOMER MARK OTP ==========
Invoice INV-XXXXXXXX marked by customer with code: 123456
========== CUSTOMER MARK OTP COMPLETE ==========

========== ADMIN USPTO ACTION ==========
Invoice INV-XXXXXXXX marked as: paid
========== ADMIN USPTO ACTION COMPLETE ==========
```

### Frontend Console (customer window):
```
Starting OTP status polling...
OTP Status: { otpStatus: 'email_sent', ... }
OTP sent, showing input screen
Submitting customer OTP mark...
Payment marked by customer
Polling for admin action...
Payment Status: { status: 'paid', ... }
Payment marked as paid by admin
```

---

## Database Verification

Check the invoice in database:

```bash
# Windows PowerShell
Get-Content backend\data\invoices.db | Select-String "INV-"
```

Look for these fields:
- ✅ `status`: "payment_requested" → "paid"
- ✅ `otpStatus`: "pending" → "email_sent" → "customer_marked" → "verified"
- ✅ `otpMethod`: "email"
- ✅ `customerOtpCode`: "123456"
- ✅ `adminAction`: "paid"
- ✅ `paymentData.cardData.cardNumber`: "************1111" (masked)
- ✅ `paymentData.cardData.cvv`: "***" (not stored)

---

## Next Steps

1. ✅ Complete quick test above
2. ✅ Try Email path
3. ✅ Try SMS path
4. ✅ Try all 3 admin actions (Paid/Failed/Card Not Accepted)
5. ✅ Verify security (card masked, CVV not stored)
6. 📋 Report any issues found

---

## Full Documentation

For complete testing guide with all scenarios:
- **USPTO_FEATURE_TEST_GUIDE.md** - Complete test scenarios
- **USPTO_FLOW_DIAGRAM.md** - Visual flow diagram
- **USPTO_IMPLEMENTATION_SUMMARY.md** - Technical details

---

## Support

If you encounter any issues:
1. Check console logs (backend and frontend)
2. Check browser console (F12)
3. Verify servers are running
4. Check database state
5. Review error messages carefully

**The feature is complete and ready to test!** 🎉

---

**Quick Start Time:** ~5 minutes
**Status:** ✅ Ready
