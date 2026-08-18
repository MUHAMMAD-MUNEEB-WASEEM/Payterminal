# USPTO Manual Payment Feature - Complete Test Guide

## Overview
The USPTO Office manual payment feature allows customers to submit payment information that gets verified manually by an administrator before being processed.

## Test Flow

### Prerequisites
1. Backend server running on `http://localhost:5000`
2. Frontend running on `http://localhost:5173`
3. Admin user logged in
4. USPTO Office brand exists with `isManualPayment: true`

---

## Complete Test Scenario

### Step 1: Create Invoice with USPTO Brand

**Admin Panel:**
1. Navigate to **Invoices** page
2. Click **New Invoice** button
3. Fill in form:
   - Brand: Select "USPTO Office"
   - Customer Name: `Test Customer`
   - Customer Email: `test@example.com`
   - Customer Serial Number: `SN-12345`
   - Add item: "Filing Fee" - Amount: $100.00
4. Click **Create Invoice**
5. Copy the payment link (click the link icon)

**Expected Result:** ✅ Invoice created with status `pending`

---

### Step 2: Customer Fills Payment Form

**Customer Side (Public Invoice Page):**
1. Open payment link in new browser/incognito window
2. See verification screen
3. Enter matching details:
   - Full Name: `Test Customer`
   - Email: `test@example.com`
   - Serial Number: `SN-12345`
4. Click **Verify & Continue**

**Expected Result:** ✅ Verification succeeds, payment form appears

5. Fill USPTO payment form:
   - **Personal Information:**
     - Last 4 Digits of SSN: `1234`
     - Date of Birth: `1990-01-01`
   - **Payment Card Details:**
     - Name on Card: `Test Customer`
     - Card Number: `4111 1111 1111 1111`
     - Expiry Month: `12`
     - Expiry Year: `2025`
     - CVV: `123`
6. Click **Submit Payment Request**

**Expected Result:** ✅ 
- Status changes to `payment_requested`
- Customer sees loading screen: "Processing Your Payment"
- Screen shows: "Please wait... An administrator will review your request"
- Page polls for OTP status

---

### Step 3: Admin Triggers Email OTP Screen

**Admin Panel:**
1. Refresh Invoices page
2. Find the invoice (status should show "Payment Requested")
3. See two buttons in Actions column:
   - 📧 Email button (blue)
   - 💬 SMS button (purple)
4. Click **Email** button (📧)

**Modal appears:**
- Title: "Show Payment Shared Status"
- Shows invoice number
- Optional text area for custom note

5. (Optional) Enter custom note: "We are reviewing your information"
6. Click **Show Shared Status**

**Expected Result:** ✅
- Modal closes
- Backend logs: "OTP screen triggered for invoice..."
- Invoice `otpStatus` updated to `email_sent`

---

### Step 4: Customer Sees OTP Input Screen

**Customer Side (auto-updates via polling):**
- Loading screen automatically changes to OTP input screen
- Shows: "Verification Required"
- Shows: "OTP sent to your **email**"
- Shows custom note if admin entered one
- Input field for 6-digit code

**Expected Result:** ✅ Customer sees OTP input form

---

### Step 5: Customer Enters ANY 6-Digit Code

**Customer Side:**
1. Enter any 6 digits (e.g., `123456`)
2. Click **Proceed with Payment**

**Expected Result:** ✅
- Code is accepted (no validation)
- Status changes to "Payment Marked by Customer"
- Customer sees confirmation screen:
  - ✅ Green checkmark icon
  - "Payment Marked by Customer"
  - "What's Next?" message
  - Invoice details displayed

---

### Step 6: Admin Takes Final Action

**Admin Panel:**
1. Refresh Invoices page
2. Find the invoice (status still "Payment Requested")
3. Now see THREE action buttons in Actions column:
   - ✅ Check icon (green) - "Mark as Paid"
   - ❌ X icon (red) - "Mark as Failed"
   - 💳 Card icon (orange) - "Card Not Accepted"

**Choose one of the following:**

#### Option A: Mark as Paid
1. Click the **✅ Check** button
2. Confirm the action

**Expected Result:** ✅
- Invoice status changes to `paid`
- Customer sees success screen (via polling)
- Green checkmark with "Payment Successful!" message

#### Option B: Mark as Failed
1. Click the **❌ X** button
2. Confirm the action

**Expected Result:** ✅
- Invoice status changes to `failed`
- Customer sees error toast: "Payment was not accepted"

#### Option C: Card Not Accepted
1. Click the **💳 Card** button
2. Confirm the action

**Expected Result:** ✅
- Invoice status changes to `failed`
- Admin action logged as `card_rejected`

---

## Testing Variations

### Test Email vs SMS Flow

**Repeat Steps 1-2, then:**

1. In Step 3, click **SMS** button instead of Email
2. Verify customer sees: "OTP sent to your **text message**"
3. Continue Steps 5-6 normally

**Expected Result:** ✅ Flow works identically

---

### Test Multiple Invoices Simultaneously

1. Create 3 invoices with USPTO brand
2. Have 3 customers submit payment requests
3. Process them in different orders:
   - Invoice 1: Email → Paid
   - Invoice 2: SMS → Failed
   - Invoice 3: Email → Card Not Accepted

**Expected Result:** ✅ All invoices handled independently

---

## Verification Checklist

### Backend Endpoints Working
- ✅ `POST /api/invoices/public/:id/submit-payment-request`
- ✅ `GET /api/invoices/public/:id/payment-status`
- ✅ `POST /api/invoices/public/:id/customer-mark-otp`
- ✅ `POST /api/invoices/:id/send-otp-email` (admin only)
- ✅ `POST /api/invoices/:id/send-otp-sms` (admin only)
- ✅ `POST /api/invoices/:id/uspto-action` (admin only)

### Frontend States
- ✅ `verify` - Customer verification form
- ✅ `payment` - USPTO payment form (SSN, DOB, card info)
- ✅ `otp-waiting` - Loading screen with polling
- ✅ `otp-input` - OTP code entry (no validation)
- ✅ `customer-marked` - Confirmation screen after OTP entry
- ✅ `success` - Final success screen (after admin marks paid)

### Admin Interface
- ✅ Email button shows when status = `payment_requested` and `!otpStatus`
- ✅ SMS button shows when status = `payment_requested` and `!otpStatus`
- ✅ Action buttons (Paid/Failed/Card) show when `otpStatus === 'customer_marked'`
- ✅ Modal has custom note text area
- ✅ Modal shows "Show Shared Status" button

### Security & Data
- ✅ CVV never stored (replaced with `***`)
- ✅ Card number masked (only last 4 stored)
- ✅ SSN only last 4 digits collected
- ✅ No actual emails/SMS sent
- ✅ No OTP validation performed
- ✅ Customer can enter any 6-digit code

---

## Expected Console Logs

### Backend Logs (when customer submits):
```
========== USPTO PAYMENT REQUEST ==========
Invoice INV-XXXXXXXX status changed to payment_requested
========== USPTO PAYMENT REQUEST COMPLETE ==========
```

### Backend Logs (when admin triggers OTP):
```
========== ADMIN TRIGGER OTP SCREEN ==========
OTP screen triggered for invoice INV-XXXXXXXX
========== ADMIN TRIGGER OTP SCREEN COMPLETE ==========
```

### Backend Logs (when customer marks):
```
========== CUSTOMER MARK OTP ==========
Invoice INV-XXXXXXXX marked by customer with code: 123456
========== CUSTOMER MARK OTP COMPLETE ==========
```

### Backend Logs (when admin finalizes):
```
========== ADMIN USPTO ACTION ==========
Invoice INV-XXXXXXXX marked as: paid
========== ADMIN USPTO ACTION COMPLETE ==========
```

---

## Common Issues & Solutions

### Issue: Admin buttons don't appear after customer marks
**Solution:** Check that:
- `inv.status === 'payment_requested'`
- `inv.brand?.isManualPayment === true`
- `inv.otpStatus === 'customer_marked'`
- Refresh the admin page

### Issue: Customer stuck on loading screen
**Solution:** Check:
- Backend running and accessible
- Payment status endpoint returning correct data
- Browser console for polling errors

### Issue: OTP input screen doesn't appear
**Solution:** Check:
- Admin clicked Email or SMS button
- Backend updated `otpStatus` to `email_sent` or `sms_sent`
- Customer page is polling (check Network tab)

---

## Database State Verification

Use the backend data files to verify states:

```bash
# Check invoice status
cat backend/data/invoices.db | grep "INV-XXXXXXXX"
```

**Invoice fields to verify:**
- `status`: "payment_requested" → "paid" or "failed"
- `otpStatus`: "pending" → "email_sent"/"sms_sent" → "customer_marked" → "verified"
- `otpMethod`: "email" or "sms"
- `adminNote`: Custom message from admin
- `paymentData`: Contains masked card info and SSN last 4

---

## Success Criteria

✅ **Complete Flow Works:**
1. Customer submits payment request
2. Admin triggers OTP screen (Email or SMS)
3. Customer enters any code and marks payment
4. Admin sees action buttons
5. Admin marks payment (Paid/Failed/Card Not Accepted)
6. Customer sees final status

✅ **Security Requirements Met:**
- No CVV stored
- Card numbers masked
- No actual OTP generation/validation
- Admin control over final status

✅ **User Experience:**
- Clear status messages at each step
- Polling updates UI automatically
- No page refreshes needed
- Custom admin notes displayed

---

## Next Steps After Testing

1. ✅ Verify complete flow works end-to-end
2. ✅ Test both Email and SMS paths
3. ✅ Test all three admin actions (Paid/Failed/Card Not Accepted)
4. ✅ Verify security (no sensitive data stored)
5. ✅ Document any issues found
6. ✅ Ready for production use

---

**Last Updated:** [Current Context]
**Status:** Ready for Testing
