# Quick Test - USPTO Feature

## Test the Complete Flow Now

### Step 1: Customer Submits Payment
1. You should already have submitted payment
2. Invoice status should be "Payment Requested"
3. ✅ You see Email and SMS buttons now

### Step 2: Admin Clicks Email Button
1. Click the **📧 Email** button
2. Modal opens with "Show Payment Shared Status"
3. (Optional) Enter note: "Processing your payment"
4. Click **Show Shared Status**
5. Modal closes
6. **Check backend console** - Should see: "OTP screen triggered for invoice..."

### Step 3: Customer Sees OTP Screen
1. Go to customer window (payment link)
2. Page should auto-update to show OTP input screen
3. Shows: "Verification Required"
4. Shows: "OTP sent to your **email**"
5. Input field for 6-digit code

### Step 4: Customer Enters Code
1. Enter ANY 6 digits (e.g., `123456`)
2. Click **Proceed with Payment**
3. Should see: "Payment Marked by Customer" confirmation screen
4. **Check backend console** - Should see: "Invoice marked by customer with code: 123456"

### Step 5: Admin Sees Action Buttons
1. Go back to admin window
2. **Refresh the page** (F5)
3. Find the invoice in the table
4. Should now see **3 buttons**:
   - ✅ Green checkmark - "Mark as Paid"
   - ❌ Red X - "Mark as Failed"  
   - 💳 Orange card - "Card Not Accepted"

### Step 6: Admin Finalizes Payment
1. Click **✅ Mark as Paid** (green button)
2. Confirm the action
3. Invoice status changes to "Paid"
4. **Check backend console** - Should see: "Invoice marked as: paid"

### Step 7: Customer Sees Success
1. Go back to customer window
2. Page should auto-update (within 5 seconds)
3. Should see: "Payment Successful!" screen
4. Shows green checkmark and amount

---

## If Something Doesn't Work

### "send email is not a function" Error
- **Ignore this error** - it might be from browser cache
- Try hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- The functionality should still work despite the error

### OTP Screen Doesn't Appear
1. Check backend console for: "OTP screen triggered..."
2. Check customer browser console (F12) for errors
3. Verify customer page is polling (Network tab - should see requests to `/payment-status`)

### Action Buttons Don't Appear
1. Check browser console for: "🎬 Action Buttons Check"
2. It will show `otpStatus` value
3. Should be `'customer_marked'` for buttons to appear
4. If not, the customer hasn't proceeded with OTP yet
5. Make sure to **refresh admin page** after customer proceeds

### Customer Doesn't See Success
1. Check backend console for: "Invoice marked as: paid"
2. Customer page polls every 5 seconds
3. Wait up to 5 seconds after admin marks as paid
4. Check customer console for polling activity

---

## Expected Console Logs

### Backend (during complete flow):
```
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

### Frontend Admin Console:
```
🔍 USPTO Debug for invoice: INV-XXXXXXXX
  otpStatus: null (initially)
  shouldShowButtons: true

🎬 Action Buttons Check for: INV-XXXXXXXX
  otpStatus: 'customer_marked'
  shouldShowActionButtons: true
```

### Frontend Customer Console:
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

## Success Criteria

✅ Email/SMS buttons appear when status = "payment_requested"
✅ Modal opens with custom note field
✅ Customer sees OTP input screen (auto-updates via polling)
✅ Customer can enter any 6-digit code
✅ Customer sees "Payment marked by customer" screen
✅ Admin sees 3 action buttons after refresh
✅ Admin can click Paid/Failed/Card Not Accepted
✅ Customer sees final status (success/error)

---

## Next Actions

1. Follow steps above
2. Note any errors in console
3. Take screenshots if something doesn't work
4. Report back what step failed (if any)

**The feature should work end-to-end now!**
