# Collect.js Payment Flow - Visual Guide

## Complete Payment Journey

### Step 1: Customer Arrives at Payment Page
```
┌────────────────────────────────────────────────────┐
│                  Payment Page Load                 │
├────────────────────────────────────────────────────┤
│                                                    │
│  URL: http://localhost:5174/pay/96blK1TMqHn493Br │
│                                                    │
│  Frontend fetches:                                 │
│  ✅ Invoice details                              │
│  ✅ Customer information                         │
│  ✅ Available payment methods (merchants)       │
│                                                    │
└────────────────────────────────────────────────────┘
                         ↓
```

### Step 2: Customer Verifies Information
```
┌────────────────────────────────────────────────────┐
│              Customer Verification                 │
├────────────────────────────────────────────────────┤
│                                                    │
│  [Your Name:         Ashley James      ]          │
│  [Your Email:        ashley@example.com]          │
│  [Serial Number:     SERIAL123        ]          │
│                                                    │
│  [Verify & Continue →]                            │
│                                                    │
└────────────────────────────────────────────────────┘
                         ↓
                         
Backend validates against invoice customer info:
✅ Name matches
✅ Email matches  
✅ Serial number matches
                         ↓
```

### Step 3: Collect.js Loads
```
┌────────────────────────────────────────────────────┐
│           Collect.js Script Loading                │
├────────────────────────────────────────────────────┤
│                                                    │
│  Frontend detects:                                 │
│  - Step = "payment"                                │
│  - Gateway = "beyondbancard"                       │
│  - Merchant has tokenizationKey                    │
│                                                    │
│  Action: Load Collect.js from CDN                  │
│  script.src = "https://cdn.collectjs.com/..."     │
│                                                    │
│  Browser Console:                                  │
│  ✅ Collect.js initialized                       │
│                                                    │
└────────────────────────────────────────────────────┘
                         ↓
```

### Step 4: Payment Form Displays
```
┌──────────────────────────────────────────────────────┐
│                   Payment Form                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Invoice Details:                                    │
│  ├─ Invoice #: INV-6MCGD61S                        │
│  ├─ Amount: USD $1.00                              │
│  └─ Due: 06/12/2026                                │
│                                                      │
│  Card Details (YOUR INPUT):                         │
│  ├─ Name on Card: [John Doe________]              │
│  ├─ Card Number: [4111 1111 1111 1111]           │
│  ├─ Expiry: [12] / [25]                          │
│  └─ CVV: [999]                                    │
│                                                      │
│  🔒 [PAY USD $1.00]                               │
│                                                      │
└──────────────────────────────────────────────────────┘
                         ↓
                   Customer enters card
                  and clicks Pay button
                         ↓
```

### Step 5: Collect.js Tokenizes (Client-Side)
```
┌──────────────────────────────────────────────────────┐
│              Collect.js Tokenization                 │
├──────────────────────────────────────────────────────┤
│              (CLIENT-SIDE - Browser)                │
│                                                      │
│  Collect.js processes:                              │
│  ├─ Card Number: 4111 1111 1111 1111             │
│  ├─ Expiry: 12/25                                 │
│  ├─ CVV: 999                                      │
│  └─ Cardholder: John Doe                          │
│                                                      │
│  Validation:                                        │
│  ✅ Luhn check passed                             │
│  ✅ Expiry valid                                  │
│  ✅ CVV valid                                     │
│  ✅ Card type detected: Visa                      │
│                                                      │
│  Tokenization:                                      │
│  ✅ Card data encrypted                           │
│  ✅ Sent to Collect.js backend                    │
│  ✅ Token generated                               │
│                                                      │
│  🎟️  Token: jsk23j4k234_token_random_string      │
│                                                      │
│  Browser Console:                                   │
│  ✅ Collect.js token received: jsk23j4k...       │
│                                                      │
└──────────────────────────────────────────────────────┘
                         ↓
           ⚠️  IMPORTANT: Card data NEVER leaves
           this frame. Raw cards NOT transmitted!
                         ↓
```

### Step 6: Token Sent to Backend
```
┌──────────────────────────────────────────────────────┐
│        Frontend → Backend (Safe Token Only)          │
├──────────────────────────────────────────────────────┤
│                                                      │
│  POST /api/invoices/public/96blK1TMqHn493Br/pay   │
│                                                      │
│  Request Body:                                      │
│  {                                                  │
│    "token": "jsk23j4k234_token_string",           │
│    "cardHolder": "John Doe",                       │
│    "merchantId": "R2uYnSvxeIzUObOQ"               │
│  }                                                  │
│                                                      │
│  ✅ NO raw card data in request!                   │
│  ✅ Token is safe to transmit                      │
│  ✅ Cardholder name only for reference             │
│                                                      │
│  Network Tab Shows:                                 │
│  Request Body: { token, cardHolder, merchantId }   │
│  ✅ No cardNumber, cvv, or expiry!                 │
│                                                      │
└──────────────────────────────────────────────────────┘
                         ↓
           Backend receives token safely
                         ↓
```

### Step 7: Backend Processing
```
┌──────────────────────────────────────────────────────┐
│           Backend Payment Processing                 │
├──────────────────────────────────────────────────────┤
│                                                      │
│  1. Validate Request                               │
│     ✅ Token exists                                │
│     ✅ Merchant found                              │
│     ✅ Invoice found                               │
│                                                      │
│  2. Prepare Payment Request                         │
│     {                                               │
│       type: "sale",                                 │
│       payment_token: "jsk23j4k234_token",         │
│       amount: 100,              # $1.00 in cents  │
│       currency: "USD",                            │
│       firstname: "John",                          │
│       lastname: "Doe",                            │
│       orderid: "INV-6MCGD61S",                   │
│       username: "PPejd3YuesXf4dT6vnsuY3F44732...", │
│       password: "v4_merchant_N6eGFG7GwJBg5z7..."  │
│     }                                               │
│                                                      │
│  3. Logs in Backend:                                │
│     Backend logs:                                   │
│     🚀 BeyondBancard payment processor started    │
│     🔷 Processing tokenized payment...            │
│     📍 Using endpoint: https://beyondbancard...  │
│     📤 SENDING TOKENIZED REQUEST TO BEYONDBANCARD │
│     📍 Endpoint: https://beyond...tact.php       │
│                                                      │
└──────────────────────────────────────────────────────┘
                         ↓
```

### Step 8: Backend → BeyondBancard Payment API
```
┌──────────────────────────────────────────────────────┐
│    Backend Sends to BeyondBancard Payment API        │
├──────────────────────────────────────────────────────┤
│                                                      │
│  HTTP POST Request:                                  │
│  https://beyondbancard.transactiongateway.com/      │
│         api/transact.php                             │
│                                                      │
│  Headers:                                            │
│  Content-Type: application/x-www-form-urlencoded   │
│                                                      │
│  Form Data (URL-encoded):                           │
│  type=sale                                          │
│  &payment_token=jsk23j4k234_token                  │
│  &amount=100                                        │
│  &currency=USD                                      │
│  &username=PPejd3YuesXf4dT6vnsuY3F447...          │
│  &password=v4_merchant_N6eGFG7GwJBg5z7D6...      │
│  &firstname=John                                    │
│  &lastname=Doe                                      │
│  &orderid=INV-6MCGD61S                            │
│                                                      │
│  🔒 HTTPS Encrypted Connection                      │
│  ✅ API credentials sent securely                   │
│  ✅ Token sent securely                             │
│  ✅ BeyondBancard processes payment                 │
│                                                      │
└──────────────────────────────────────────────────────┘
                         ↓
        BeyondBancard processes the token
        with the payment network (Visa/MC/Amex)
                         ↓
```

### Step 9: BeyondBancard Response
```
┌──────────────────────────────────────────────────────┐
│         BeyondBancard Payment Response               │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Response Format: Query String                      │
│  response=1&                                         │
│  responsetext=Success&                              │
│  transactionid=123456789&                           │
│  authcode=ABC123&                                   │
│  ...                                                 │
│                                                      │
│  Parsing:                                            │
│  ✅ response = 1      (Approved)                   │
│  ✅ transactionid = 123456789                       │
│  ✅ authcode = ABC123                               │
│                                                      │
│  Backend Logs:                                       │
│  ✅ Response received - Status 200                 │
│  📥 Raw response: response=1&responsetext=...     │
│  ✅ TOKENIZED PAYMENT SUCCESSFUL                   │
│  ✅ Transaction ID: 123456789                      │
│                                                      │
│  Result Object:                                      │
│  {                                                   │
│    success: true,                                    │
│    transactionId: "123456789",                      │
│    authCode: "ABC123",                              │
│    message: "Payment processed successfully"        │
│  }                                                   │
│                                                      │
└──────────────────────────────────────────────────────┘
                         ↓
        Backend receives successful response
                         ↓
```

### Step 10: Backend Sends Result to Frontend
```
┌──────────────────────────────────────────────────────┐
│    Backend Response to Frontend (Success)            │
├──────────────────────────────────────────────────────┤
│                                                      │
│  HTTP 200 OK                                         │
│                                                      │
│  Response Body:                                      │
│  {                                                   │
│    status: "paid",                                   │
│    message: "Payment successful!",                  │
│    transactionId: "123456789",                      │
│    redirectUrl: null,                               │
│    enableRedirect: false                            │
│  }                                                   │
│                                                      │
│  Frontend receives & processes:                      │
│  ✅ Detects status = "paid"                         │
│  ✅ Calls toast.success("Payment successful!")      │
│  ✅ Navigates to success page after 1 second        │
│                                                      │
└──────────────────────────────────────────────────────┘
                         ↓
```

### Step 11: Success Page Displays
```
┌──────────────────────────────────────────────────────┐
│              Payment Success Page                    │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ╔════════════════════════════════════════╗         │
│  ║  ✅ Payment Successful!               ║         │
│  ║                                        ║         │
│  ║  Your payment of USD $1.00 has been   ║         │
│  ║  processed successfully.               ║         │
│  ║                                        ║         │
│  ║  Transaction Details                  ║         │
│  ║  INV-6MCGD61S                         ║         │
│  ║                                        ║         │
│  ║  A confirmation email has been sent   ║         │
│  ║  to ashley@example.com                ║         │
│  ╚════════════════════════════════════════╝         │
│                                                      │
│  Frontend Console:                                   │
│  ✅ PAYMENT SUCCESS                                │
│  ✅ Status: paid                                    │
│  ✅ Transaction ID: 123456789                      │
│                                                      │
└──────────────────────────────────────────────────────┘
```

## Error Scenarios

### Scenario A: Authentication Failed (Most Likely)

```
┌──────────────────────────────────────────────────────┐
│    BeyondBancard Response - Authentication Failed    │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Response:                                           │
│  response=3&                                         │
│  responsetext=Authentication Failed&                │
│  ...                                                 │
│                                                      │
│  Parsing:                                            │
│  ✅ response = 3 (Error)                            │
│  ✅ responsetext = "Authentication Failed"          │
│                                                      │
│  Backend Logs:                                       │
│  ❌ PAYMENT ERROR: Authentication Failed            │
│  ❌ Response: Authentication Failed                 │
│                                                      │
│  Frontend Shows:                                     │
│  ❌ Error: "Authentication failed - Invalid API     │
│      Key or Secret. Response: Authentication Failed"│
│                                                      │
│  Result: Red error message displayed                │
│                                                      │
│  🔍 Analysis:                                        │
│  • Collect.js worked ✅ (token generated)           │
│  • Token sent to backend ✅                          │
│  • Backend sent request ✅                           │
│  • BUT credentials need BeyondBancard activation ⚠️  │
│                                                      │
│  ✉️  Contact BeyondBancard Support:                  │
│  "Please activate these credentials for the          │
│   Payment API endpoint"                              │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Scenario B: Collect.js Fails to Load

```
┌──────────────────────────────────────────────────────┐
│        Collect.js Fails to Load                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Browser Console:                                    │
│  ❌ Failed to load Collect.js                       │
│                                                      │
│  Frontend Toast:                                     │
│  ❌ Payment system failed to load.                  │
│     Please refresh.                                  │
│                                                      │
│  🔍 Causes:                                          │
│  • No internet connection                            │
│  • Blocked by adblocker                              │
│  • CDN down (cdn.collectjs.com)                      │
│                                                      │
│  ✅ Solutions:                                       │
│  1. Refresh page                                     │
│  2. Check internet connection                        │
│  3. Disable adblocker                                │
│  4. Check CDN status                                 │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Scenario C: Card Declined

```
┌──────────────────────────────────────────────────────┐
│            Card Declined (Expected)                  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Using test card: 4222 2222 2222 2220              │
│  (This card is designed to be declined)             │
│                                                      │
│  BeyondBancard Response:                            │
│  response=2&                                         │
│  responsetext=Card Declined&                        │
│  ...                                                 │
│                                                      │
│  Frontend Shows:                                     │
│  ❌ Error: "Payment declined - Card Declined"       │
│                                                      │
│  ✅ This is EXPECTED behavior                       │
│  Retry with approved test card: 4111 1111 1111 1111 │
│                                                      │
└──────────────────────────────────────────────────────┘
```

## Data Flow Summary

```
┌─────────────────┐
│  Customer Card  │
│  (Browser Only) │
└────────┬────────┘
         │
    (NOT transmitted)
         │
         ↓
    ┌─────────────────┐
    │  Collect.js     │
    │  (Client-side)  │
    └────────┬────────┘
             │
        TOKEN (safe to send)
             │
             ↓
    ┌─────────────────┐
    │  Your Backend   │
    │  (Node.js)      │
    └────────┬────────┘
             │
    TOKEN + API Credentials
             │
             ↓
    ┌──────────────────────────┐
    │  BeyondBancard Payment   │
    │  API                     │
    │  /api/transact.php       │
    └────────┬─────────────────┘
             │
        Transaction Result
             │
             ↓
    ┌─────────────────┐
    │  Success/Fail   │
    │  Response       │
    └────────┬────────┘
             │
             ↓
    ┌─────────────────┐
    │  Frontend       │
    │  Shows Result   │
    └─────────────────┘
```

## Key Points

### ✅ What's Secure
- Card never leaves browser
- Token is reusable but safe
- API credentials only on backend
- HTTPS encrypted connections

### ⚠️ Potential Issues
- Collect.js requires internet (external CDN)
- Credentials must be activated by BeyondBancard
- Token generated client-side must be trusted

### 📊 Expected Timings
- Collect.js load: ~1 second
- Tokenization: ~0.5 seconds
- API request: ~2 seconds
- Total: ~3-4 seconds

---

## Testing This Flow

1. **Monitor Browser**: F12 → Console for token messages
2. **Monitor Backend**: `tail -f backend/logs/beyondbancard.log`
3. **Monitor Network**: F12 → Network → Filter POST
4. **Expected Result**: Green success or red auth error

---

**Flow Status**: ✅ Complete and ready for testing!
