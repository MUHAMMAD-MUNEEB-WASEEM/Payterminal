# ✅ Correct Credentials Setup - Key Roles Clarified

## The Breakthrough

You've correctly identified the key roles! Let's use them properly:

## Your Keys & Their Roles

| Key | Value | Role | Location | Used By |
|-----|-------|------|----------|---------|
| **Public (Tokenization)** | `Q8N5U4-543kky-...` | Collect.js tokenization | Frontend JavaScript | Browser |
| **Private (API)** | `PPejd3YuesXf4dT6...` | Payment API security | Backend .env | Node.js server |
| ❌ V4 API | `v4_merchant_N6eG...` | **Not needed** | - | - |
| ❌ Checkout | `checkout_public_...` | Hosted form | - | - |
| ❌ Cart | `9z46hy3TA2sE...` | Hosted checkout | - | - |

---

## Setup: Use Private (API) Key

### Step 1: Run Setup Script

```bash
cd backend
node setup-correct-credentials.js
```

**What it does**:
- ✅ Sets Private (API) key as `apiKey`
- ✅ Sets Private (API) key as `apiSecret`
- ✅ Keeps Tokenization key in database
- ✅ Mode: sandbox (test)

**Expected Output**:
```
✅ UPDATED TO CORRECT CREDENTIALS
✅ Using Private (API) key for Payment API

✅ Key Roles Configured:
   ✅ Public (Tokenization): Used by Collect.js in frontend
   ✅ Private (API): Used for Payment API authentication
```

### Step 2: Test Payment

1. **Go to**: `http://localhost:5174/pay/96blK1TMqHn493Br`
2. **Test card**: `4111 1111 1111 1111`
3. **Result**: Check for success

---

## How It Works Now

```
┌──────────────────────────────────────┐
│         COLLECTION.JS                │
│      (Client-side - Browser)         │
│                                      │
│ Uses: Public (Tokenization) Key      │
│  Q8N5U4-543kky-kZr2CC-ns8K2Y        │
│                                      │
│ Tokenizes card → Token: jsk23j4...   │
└──────────────────┬───────────────────┘
                   │
                   ↓ Token (safe)
┌──────────────────────────────────────┐
│          YOUR BACKEND                │
│       (Node.js - Server)             │
│                                      │
│ Uses: Private (API) Key              │
│  PPejd3YuesXf4dT6vnsuY3F44732HTf3   │
│                                      │
│ Receives token from frontend         │
│ Sends to BeyondBancard with API key  │
└──────────────────┬───────────────────┘
                   │
                   ↓ Token + API Key
┌──────────────────────────────────────┐
│      BEYONDBANCARD PAYMENT API       │
│                                      │
│ Validates API Key                    │
│ Processes token → Payment result     │
└──────────────────┬───────────────────┘
                   │
                   ↓ Response
             ✅ Success or ❌ Error
```

---

## Request Format (What Gets Sent)

### To BeyondBancard Payment API:

```
POST https://beyondbancard.transactiongateway.com/api/transact.php

Form Data:
{
  type: 'sale',
  payment_token: 'jsk23j4...',              // From Collect.js
  amount: 100,                              // In cents
  currency: 'USD',
  firstname: 'John',
  lastname: 'Doe',
  username: 'PPejd3YuesXf4dT6...',         // Private (API) Key
  password: 'PPejd3YuesXf4dT6...'          // Private (API) Key
}
```

**Important**:
- ✅ Card data NOT in request (tokenized by Collect.js)
- ✅ Token sent securely
- ✅ Private (API) key sent for authentication
- ✅ Public key NEVER sent to backend or API

---

## Expected Flow

### 1️⃣ Customer enters card
```
Card number: 4111 1111 1111 1111
Expiry: 12/25
CVV: 999
```

### 2️⃣ Collect.js tokenizes (client-side)
```
Browser Console:
✅ Collect.js initialized
✅ Card validated locally
✅ Tokenization request sent to BeyondBancard
```

### 3️⃣ Token received
```
Browser Console:
✅ Collect.js token received: jsk23j4k234_token_string
```

### 4️⃣ Token sent to your backend
```
POST /api/invoices/public/96blK1TMqHn493Br/pay

{
  token: "jsk23j4k234_token_string",
  cardHolder: "John Doe",
  merchantId: "R2uYnSvxeIzUObOQ"
}
```

### 5️⃣ Backend processes with Private (API) key
```
Backend sends:
POST /api/transact.php

{
  payment_token: "jsk23j4k234_token_string",
  username: "PPejd3YuesXf4dT6vnsuY3F44732HTf3",  // Private API key
  password: "PPejd3YuesXf4dT6vnsuY3F44732HTf3",  // Private API key
  ...
}
```

### 6️⃣ BeyondBancard responds
```
response=1&responsetext=Success&transactionid=123456789
OR
response=3&responsetext=Authentication Failed
```

### 7️⃣ Result shown to customer
```
✅ Payment Successful!
Transaction ID: 123456789
OR
❌ Payment Failed: [error message]
```

---

## Configuration Summary

### Frontend (PublicInvoice.jsx)
```javascript
// Collect.js loads with:
merchantKey: "Q8N5U4-543kky-kZr2CC-ns8K2Y"  // Public Tokenization key
```

### Backend (.env or database)
```
// Merchant credentials:
apiKey: "PPejd3YuesXf4dT6vnsuY3F44732HTf3"      // Private (API) Key
apiSecret: "PPejd3YuesXf4dT6vnsuY3F44732HTf3"   // Private (API) Key
tokenizationKey: "Q8N5U4-543kky-kZr2CC-ns8K2Y" // Public Tokenization key
```

### API Request Format
```
username: "PPejd3YuesXf4dT6vnsuY3F44732HTf3"    // Private (API) Key
password: "PPejd3YuesXf4dT6vnsuY3F44732HTf3"    // Private (API) Key
payment_token: "jsk23j4..."                     // From Collect.js
```

---

## Verify Setup

### Check 1: Frontend has Tokenization Key
```bash
grep -r "Q8N5U4" frontend/src/
```
Should find: Tokenization key used in Collect.js configuration

### Check 2: Backend has Private (API) Key
```bash
node backend/check-credentials.js
```
Should show:
```
API Key: PPejd3YuesXf4dT6vnsuY3F44732HTf3
API Secret: PPejd3YuesXf4dT6vnsuY3F44732HTf3
```

---

## Expected Results

### ✅ Success (Best Case)
```
Browser:
✅ Collect.js token received
✅ Payment Successful!
Transaction ID: 123456789

Backend Logs:
✅ Response received - Status 200
✅ TOKENIZED PAYMENT SUCCESSFUL
```

### ❌ Authentication Failed (Most Likely)
```
Browser:
❌ Payment Failed
❌ Authentication failed - Invalid API Key or Secret

Backend Logs:
❌ PAYMENT ERROR: Authentication Failed
Response: Authentication Failed (response code 3)
```

**Meaning**: Credentials format correct, but Private (API) key not activated in BeyondBancard system for this endpoint.

### ❌ Other Error
```
Check backend/logs/beyondbancard.log for specific error
```

---

## Troubleshooting

### Issue: Collect.js not loading
**Fix**: Verify `Q8N5U4-543kky-kZr2CC-ns8K2Y` is set in database
```bash
node backend/check-credentials.js
```

### Issue: Backend shows wrong credentials
**Fix**: Run setup script
```bash
node backend/setup-correct-credentials.js
```

### Issue: Still getting authentication error
**Meaning**: Private (API) key format is correct, but:
- Key not activated in BeyondBancard system
- Key doesn't have permission for this endpoint
- Key is for different environment

**Solution**: Contact BeyondBancard with:
```
Hi,

We're using Collect.js with your Payment API.

Credentials:
- Private (API) Key: PPejd3YuesXf4dT6vnsuY3F44732HTf3
- Tokenization Key: Q8N5U4-543kky-kZr2CC-ns8K2Y
- Endpoint: https://beyondbancard.transactiongateway.com/api/transact.php
- Format: Form-encoded POST with payment_token

Getting: "Authentication Failed (response code 3)"

Can you confirm:
1. Is the Private (API) key activated?
2. Does it have permission for /api/transact.php endpoint?
3. Is it the correct key for this environment?

Thank you
```

---

## Next Steps

1. **Run Setup**: `node backend/setup-correct-credentials.js`
2. **Test Payment**: Go to payment page with test card
3. **Check Result**: Success or specific error
4. **If Fails**: Contact BeyondBancard with details above

---

## Quick Reference

| Component | Key | Value |
|-----------|-----|-------|
| Frontend (Collect.js) | Public (Tokenization) | `Q8N5U4-543kky-...` |
| Backend (Payment API) | Private (API) | `PPejd3YuesXf4dT6...` |
| ❌ Not Used | V4 API | `v4_merchant_N6eG...` |
| ❌ Not Used | Checkout | `checkout_public_...` |
| ❌ Not Used | Cart | `9z46hy3TA2sE...` |

---

**Ready? Run the setup script and test!** 🚀
