# ACTION PLAN: NMI Payment Testing - IMMEDIATE NEXT STEPS

## ✅ WHAT'S BEEN COMPLETED

### 1. Backend Setup ✅
- ✅ Created: `backend/src/utils/nmi-payment.js` - NMI payment processor with full logging
- ✅ Updated: `backend/src/routes/invoices.js` - Routes to NMI processor
- ✅ Created: `backend/setup-nmi-credentials.js` - Setup automation script
- ✅ Run: Setup script executed successfully - merchant credentials updated

### 2. Merchant Configuration ✅
- ✅ Security Key: `PPejd3YuesXf4dT6vnsuY3F44732HTf3` (Private/API key as security_key)
- ✅ Tokenization Key: `Q8N5U4-543kky-kZr2CC-ns8K2Y` (Public key for Collect.js)
- ✅ Mode: `sandbox` (test mode)
- ✅ Endpoint: `https://secure.nmi.com/api/transact.php`

### 3. Frontend Improvements ✅
- ✅ Enhanced Collect.js initialization with better error handling
- ✅ Improved tokenization callback with proper response parsing
- ✅ Added condition to ONLY use Collect.js for beyondbancard gateway
- ✅ Better logging for debugging

### 4. Servers Running ✅
- ✅ Backend: Running on port 5000 (npm start)
- ✅ Frontend: Running on port 5174 (npm run dev)

---

## 🚀 IMMEDIATE ACTION: TEST THE PAYMENT

### Step 1: Open Browser and Go to Payment Page

```
http://localhost:5174/pay/96blK1TMqHn493Br
```

### Step 2: Verify Customer Information

**Enter:**
- Name: Ashley James
- Email: ashley@example.com
- Serial Number: SN123456

Click: "Verify & Continue"

### Step 3: Enter Payment Information

**Card Details:**
```
Name on Card: John Doe
Card Number: 4111 1111 1111 1111  (Visa Test Card)
Expiry: 12/25
CVV: 999
```

### Step 4: Submit Payment

Click: "Pay USD $100.00"

### Step 5: Monitor Logs (in separate terminal)

```bash
# Terminal 1: Watch the NMI logs
cd backend
node -e "
const fs = require('fs');
const path = require('path');
let lastSize = 0;
setInterval(() => {
  try {
    const stat = fs.statSync('logs/nmi-payment.log');
    if (stat.size > lastSize) {
      const content = fs.readFileSync('logs/nmi-payment.log', 'utf8');
      const lines = content.split('\n');
      console.log(lines.slice(-10).join('\n'));
      lastSize = stat.size;
    }
  } catch(e) {
    console.log('Waiting for first payment...');
  }
}, 1000);
" &

# Or use simpler tail command if available:
# tail -f backend/logs/nmi-payment.log
```

---

## 📊 EXPECTED RESULTS

### ✅ SUCCESS Path

**Browser shows:**
```
Payment Successful!
Your payment of USD $100.00 has been processed successfully.
Transaction Details: INV-XXXXX
```

**Backend logs show:**
```
🚀 NMI payment processor started
🔷 Processing tokenized payment with NMI...
📤 SENDING TOKENIZED REQUEST TO NMI
Endpoint: https://secure.nmi.com/api/transact.php
✅ Response received - Status 200
📥 Raw response: response=1&responsetext=Success...
✅ PAYMENT SUCCESSFUL
Transaction ID: 123456789
```

---

### ⚠️ FAILURE Path & Troubleshooting

#### Error 1: "Collect.js not ready"
```
❌ Payment system is not ready. Please refresh and try again.
```
**Fix**: 
1. Refresh browser (Ctrl+R)
2. Wait 2-3 seconds for Collect.js to load
3. Try again

#### Error 2: "Card tokenization failed"
```
❌ Card tokenization failed: [error message]
```
**Meaning**: Collect.js couldn't tokenize the card
**Fix**:
1. Check browser console (F12) for errors
2. Verify card number format is correct
3. Try different test card

#### Error 3: "Authentication failed - Invalid API Key or Secret"
```
❌ PAYMENT FAILED: Authentication failed
```
**Meaning**: NMI rejected the security_key
**Possible Causes**:
1. Setup script didn't update merchant properly
2. Database wasn't saved correctly
3. Security key is incorrect

**Fix**:
1. Run setup again:
   ```bash
   cd backend
   node setup-nmi-credentials.js
   ```
2. Check merchant config:
   ```bash
   node check-merchant.js
   ```

#### Error 4: "Cannot reach payment gateway"
```
❌ Request error: connect ECONNREFUSED
```
**Meaning**: Can't reach NMI API
**Fix**:
1. Check internet connection
2. Verify firewall allows HTTPS to secure.nmi.com
3. Try from different network

---

## 🔍 DEBUGGING CHECKLIST

### 1. Verify Merchant Setup
```bash
cd backend
node check-merchant.js
```

Expected output:
```
Merchant: Test Beyond
  Gateway: beyondbancard
  Credentials:
    - security_key: PPejd3Ye...
    - mode: sandbox
```

### 2. Check Frontend Console (F12 Browser DevTools)

**Expected to see:**
```
📦 Collect.js script loaded
🔷 Initializing Collect.js...
✅ Collect.js initialized successfully
🔷 Using Collect.js for tokenization...
🔷 Calling CollectJS.startTokenization()...
📥 Collect.js Response: {token: "...", card: {...}}
✅ Collect.js token received: ...
```

### 3. Check Backend Logs

**File**: `backend/logs/nmi-payment.log` (or `backend/logs/payment-route.log`)

Should show the full payment flow with timestamps

### 4. Network Tab (F12 Browser DevTools)

**Check POST request to**: `/api/invoices/public/96blK1TMqHn493Br/pay`

**Request payload should have**:
```json
{
  "token": "...",
  "cardHolder": "John Doe",
  "merchantId": "..."
}
```

**NOT**: `cardNumber`, `expiryMonth`, etc. (those should NOT be sent)

---

## 🎯 KEY VALIDATION POINTS

### Frontend-to-Backend Flow
- [ ] Collect.js initializes
- [ ] Form submission triggers Collect.js
- [ ] Token is generated by Collect.js
- [ ] Token is sent to backend (NOT raw card data)
- [ ] Payment API receives token

### Backend-to-NMI Flow
- [ ] Backend receives token + merchant ID
- [ ] Reads security_key from merchant config
- [ ] Posts to NMI endpoint with token + security_key
- [ ] NMI validates and processes
- [ ] Response is parsed correctly
- [ ] Payment status is updated

### Success Criteria
- [ ] No "Authentication Failed" error
- [ ] Response code 1 (approved) in NMI response
- [ ] Transaction ID is present
- [ ] Invoice status changes to "paid"
- [ ] Browser shows success page

---

## 📝 DATA VALIDATION

### Test Card Details
```
✅ Visa Test Card: 4111 1111 1111 1111
   - Expiry: 12/25
   - CVV: 999
   - Status: Should approve (response=1)

❌ Decline Test: 4222 2222 2222 2220
   - Expiry: 12/25
   - CVV: 999
   - Status: Should decline (response=2)
```

### Invoice Details
```
Invoice ID: 96blK1TMqHn493Br
Amount: $100.00
Customer: Ashley James
Email: ashley@example.com
Serial: SN123456
```

---

## 🚨 CRITICAL FILES TO CHECK IF ISSUES ARISE

1. **NMI Processor**: `backend/src/utils/nmi-payment.js`
   - Check: Endpoint URL is correct
   - Check: Request format is valid
   - Check: Response parsing works

2. **Invoice Routes**: `backend/src/routes/invoices.js`
   - Check: Routes to NMI processor for beyondbancard
   - Check: Passes correct merchant credentials
   - Check: Passes correct payment data

3. **Frontend Component**: `frontend/src/pages/PublicInvoice.jsx`
   - Check: Collect.js script loads
   - Check: Callback function is called
   - Check: Token is sent to backend

4. **Merchant Config**: `backend/data/merchants.db`
   - Check: security_key is set correctly
   - Check: gateway is "beyondbancard"

---

## 📞 SUPPORT INFORMATION

If payment fails with specific NMI error:

1. **Note the response code**:
   - `response=1`: Success
   - `response=2`: Declined
   - `response=3`: Error

2. **Get error details from logs**:
   ```bash
   grep "responsetext" backend/logs/nmi-payment.log
   ```

3. **Common NMI Response Codes**:
   - `1`: Transaction approved
   - `2`: Transaction declined
   - `3`: Transaction error
   - See response text for specific reason

4. **When contacting NMI support**:
   - Include: Error response code and text
   - Include: Timestamp of failed attempt
   - Include: Test card used
   - Include: Full error message from logs

---

## 🎉 SUCCESS INDICATORS

When everything is working correctly:

1. ✅ Browser shows "Payment Successful!" page
2. ✅ Backend logs show "✅ PAYMENT SUCCESSFUL"
3. ✅ Invoice status changes to "paid"
4. ✅ Transaction ID is displayed
5. ✅ No errors in logs
6. ✅ Page may redirect to brand URL (if configured)

---

## ⏱️ TIMELINE EXPECTATIONS

- **Page Load**: 1-2 seconds
- **Collect.js Init**: 1-2 seconds
- **Form Submission**: 0.5 seconds
- **Tokenization**: 1-2 seconds
- **NMI Processing**: 2-5 seconds
- **Total**: ~5-10 seconds for payment

If taking longer than 15 seconds, likely network issue.

---

## NEXT STEPS AFTER TESTING

### If Success ✅
1. Test with different cards (MC, Amex)
2. Test decline card to verify error handling
3. Check email notification (if configured)
4. Monitor invoice database for status change

### If Failure ❌
1. Gather all error logs
2. Check debugging checklist
3. Verify merchant credentials
4. Try setup script again
5. Contact NMI support with details

---

**Ready to test?**

→ Go to: `http://localhost:5174/pay/96blK1TMqHn493Br`

→ Verify customer info and proceed to payment

→ Watch the logs in backend terminal

Good luck! 🚀

