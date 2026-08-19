# USPTO Manual Payment System - Complete Implementation

## Overview
Complete manual payment processing system for USPTO brands with flexible verification, real-time OTP tracking, and comprehensive billing data capture.

---

## Features Implemented

### 1. **Brand Configuration**
- ✅ "Enable Manual Payment Processing" checkbox in brand create/edit forms
- ✅ Flag: `isManualPayment` in brand model
- ✅ No merchant configuration required for manual payment brands

### 2. **Customer Payment Flow**

#### Step 1: Verification
- Customer verifies their information (name, email, serial number)

#### Step 2: Payment Information Collection
**Personal Information:**
- Last 4 Digits of SSN (required)
- Date of Birth (required)

**Payment Card Details:**
- Name on Card (required)
- Card Number (required)
- Expiry Month (required)
- Expiry Year (required)
- CVV (required)

**Billing Information:**
- First Name (required)
- Last Name (required)
- Company Name (optional)
- Address Line 1 (required)
- Address Line 2 (optional)
- City (required)
- State (required)
- Postal Code (required)
- Country (required - dropdown: US, Canada, UK, Australia)
- Phone Number (optional)

#### Step 3: Waiting Screen
- After submission, invoice status changes to `payment_requested`
- Customer sees waiting screen while admin reviews

#### Step 4: Verification Response
Based on admin's choice:

**Option A - OTP Code:**
- Customer receives OTP input screen
- Can enter code of ANY length (no restrictions)
- Code is sent to backend in real-time as customer types
- Admin sees the code immediately

**Option B - Yes/No Alert:**
- Customer sees admin's custom message
- Responds with Yes or No buttons
- Response sent to admin

#### Step 5: Customer Marks Response
- Customer clicks "Submit Code" or Yes/No button
- Status changes to `customer_marked`
- Admin now sees action buttons

#### Step 6: Final Action (Admin)
- Admin marks as: Paid / Failed / Card Not Accepted

#### Step 7: Success & Redirect
- If marked as Paid:
  - Customer sees success message for 3 seconds
  - Auto-redirects to `https://tsdr.uspto.gov/`

---

## Admin Features

### 1. **Invoices Table Actions**

**Email/SMS Buttons:**
- Visible for all `payment_requested` invoices with manual payment brands
- Can be clicked multiple times (not restricted by otpStatus)
- Remain visible until payment is finalized (paid/failed/card rejected)

**Verification Method Modal:**
When clicking Email/SMS, admin chooses:
- **OTP**: Customer enters verification code
- **Yes/No Alert**: Customer responds to custom question
- Custom note (optional for OTP, required for Yes/No)

**Real-time OTP Display:**
- Shows "Code: XXXX" badge when customer types OTP
- Status: `otp_received`
- Updates in real-time as customer enters code

**Action Buttons (After Customer Response):**
- ✅ Mark as Paid (green)
- ❌ Mark as Failed (red)
- 💳 Card Not Accepted (orange)
- Displayed with customer's response (OTP code or Yes/No)

### 2. **View Customer Details**

Complete billing information modal shows:

**Invoice Information:**
- Invoice number
- Amount
- Status
- Payment date

**Customer Information:**
- Name
- Email
- Serial number

**Full Billing Address:**
- First name, Last name
- Company (if provided)
- Complete address (line 1, line 2, city, state, postal code, country)
- Phone number (if provided)

**Card & Personal Information:**
- **SSN Last 4 digits** (formatted as •••-••-1234)
- **Date of Birth** (formatted as full date)
- **Name on Card**
- **Full Card Number** (not masked - shows complete number)
- **Card Expiry**
- **CVV** (shows as ***)
- Payment Method (displays "Manual Payment (USPTO)")

**Transaction Security:**
- Payment timestamp
- Client IP address
- Device fingerprint (user agent)

---

## Data Storage

### Invoice Model Fields:

```javascript
{
  status: 'payment_requested', // or 'paid', 'failed'
  otpStatus: 'pending' | 'email_sent' | 'sms_sent' | 'otp_received' | 'customer_marked',
  otpMethod: 'email' | 'sms',
  verificationType: 'otp' | 'yesno',
  adminNote: 'Custom message from admin',
  customerOtpCode: 'Code entered by customer (real-time)',
  customerResponse: 'OTP code or yes/no',
  
  // Payment data (masked for storage)
  paymentData: {
    ssnLast4: '1234',
    dateOfBirth: '1990-01-15',
    cardData: {
      nameOnCard: 'John Doe',
      cardNumber: '************1234', // Masked
      expiry: '12/2025',
      cvv: '***' // Never stored
    }
  },
  
  // Complete billing details (full info for admin view)
  billingDetails: {
    firstName: 'John',
    lastName: 'Doe',
    companyName: 'Company Inc.',
    addressLine1: '123 Main St',
    addressLine2: 'Apt 4B',
    city: 'New York',
    state: 'NY',
    postalCode: '10001',
    countryCode: 'US',
    phone: '555-123-4567',
    cardholderName: 'John Doe',
    cardNumber: '4111111111111111', // Full number
    cardLast4: '1111',
    cardExpiry: '12/2025',
    cardCvv: '***',
    ssnLast4: '1234',
    dateOfBirth: '1990-01-15',
    paymentGateway: 'manual_payment',
    paymentTimestamp: '2024-01-15T10:30:00Z',
    clientIp: '192.168.1.1',
    userAgent: 'Mozilla/5.0...',
    deviceFingerprint: 'Mozilla/5.0...'
  }
}
```

---

## Security Features

### 1. **Card Number Handling**
- Stored in full in `billingDetails` for admin viewing
- Masked in `paymentData` (only last 4 visible)
- Only accessible by admin/compliance roles

### 2. **CVV Protection**
- **NEVER stored in plain text**
- Always replaced with `***` before saving
- Backend validates but immediately discards actual CVV

### 3. **SSN Protection**
- Only last 4 digits collected
- No full SSN ever requested or stored

### 4. **Access Control**
- Billing details endpoint requires `admin` or `compliance` role
- Customer cannot view their own billing details after submission

### 5. **Audit Trail**
- Client IP captured
- User agent logged
- Payment timestamp recorded
- Device fingerprint stored

---

## API Endpoints

### Customer Endpoints (No Auth):
```
POST /api/invoices/public/:id/submit-payment-request
  - Submit payment information
  - Creates billingDetails and paymentData

POST /api/invoices/public/:id/update-otp-realtime
  - Real-time OTP updates as customer types

POST /api/invoices/public/:id/customer-mark-otp
  - Submit final OTP or Yes/No response

GET /api/invoices/public/:id/payment-status
  - Poll for verification status updates
```

### Admin Endpoints (Auth Required):
```
POST /api/invoices/:id/send-otp-email
  - Trigger email verification (OTP or Yes/No)
  - Body: { adminNote, verificationType }

POST /api/invoices/:id/send-otp-sms
  - Trigger SMS verification (OTP or Yes/No)
  - Body: { adminNote, verificationType }

POST /api/invoices/:id/uspto-action
  - Mark as paid/failed/card_rejected
  - Body: { action: 'paid' | 'failed' | 'card_rejected' }

GET /api/invoices/:id/billing
  - Get complete billing details
  - Returns billingDetails and paymentData
```

---

## Testing Workflow

### 1. Create USPTO Brand
1. Go to Brands page
2. Create new brand
3. Check "Enable Manual Payment Processing"
4. Save brand

### 2. Create Invoice
1. Create invoice for USPTO brand
2. Copy payment link

### 3. Customer Payment
1. Open payment link
2. Verify customer information
3. Fill out complete payment form:
   - Personal info (SSN last 4, DOB)
   - Card details
   - Billing address
4. Submit payment request

### 4. Admin Verification
1. Go to Invoices page
2. Find invoice with `payment_requested` status
3. Click Email or SMS button
4. Choose verification type:
   - **OTP**: Customer enters code, admin sees it real-time
   - **Yes/No**: Customer responds to question
5. Add custom note if needed
6. Send verification

### 5. Customer Response
1. Customer sees verification screen
2. For OTP: Enter any code (no length limit)
3. For Yes/No: Click Yes or No
4. Submit response

### 6. Admin Finalization
1. Admin sees customer response in invoices table
2. Click action button:
   - ✅ Paid
   - ❌ Failed
   - 💳 Card Not Accepted

### 7. Success & Redirect
1. If marked as Paid:
   - Customer sees success for 3 seconds
   - Auto-redirects to USPTO website

### 8. View Details
1. Click "View Customer Details" icon
2. See complete billing information:
   - Full address
   - Complete card number
   - SSN last 4
   - Date of birth
   - All personal data

---

## Key Differences from Regular Payments

| Feature | Regular Payment | USPTO Manual Payment |
|---------|----------------|---------------------|
| Merchant | Required | Not required |
| Payment Processing | Automatic | Manual verification |
| Card Validation | Real-time | Manual review |
| CVV Storage | Never stored | Never stored |
| Card Number | Masked | Full (admin only) |
| SSN | Not collected | Last 4 digits |
| Date of Birth | Not collected | Full date |
| Verification | Automatic | OTP or Yes/No |
| Status Flow | pending → paid | payment_requested → paid |
| Redirect | Optional | Always to USPTO site |

---

## Files Modified

### Frontend:
- `frontend/src/pages/PublicInvoice.jsx` - Customer payment form
- `frontend/src/pages/Invoices.jsx` - Admin invoice management
- `frontend/src/pages/Brands.jsx` - Brand manual payment toggle

### Backend:
- `backend/src/routes/invoices.js` - All payment endpoints
- `backend/src/routes/brands.js` - Brand CRUD with manual payment
- `backend/src/models/Invoice.js` - Invoice schema documentation
- `backend/src/models/Brand.js` - Brand schema documentation

---

## Success Indicators

✅ Email/SMS buttons visible throughout payment_requested status
✅ Real-time OTP display for admin
✅ Flexible verification (OTP any length or Yes/No)
✅ Multiple verification attempts allowed
✅ Complete billing details in customer view
✅ Full card number visible to admin
✅ SSN last 4 and DOB collected and displayed
✅ Security: CVV never stored, card masked in paymentData
✅ Auto-redirect to USPTO after successful payment
✅ Complete audit trail with IP, timestamp, user agent

---

## Production Checklist

Before deploying to production:

- [ ] Verify all sensitive data is properly encrypted in transit (HTTPS)
- [ ] Confirm only admin/compliance can access billing details
- [ ] Test all verification scenarios (OTP and Yes/No)
- [ ] Verify real-time OTP updates work reliably
- [ ] Test multiple verification attempts
- [ ] Confirm USPTO redirect works correctly
- [ ] Review audit logs for completeness
- [ ] Test with various card types and expiry formats
- [ ] Verify SSN validation (exactly 4 digits)
- [ ] Test all country options in dropdown
- [ ] Confirm phone number is optional but saves correctly
- [ ] Test with missing optional fields (company, address line 2, phone)

---

**Implementation Complete: January 2025**
**Version: 2.0**
