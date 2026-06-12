# Testing with V4 API Credentials

## The Issue

The original API Key (`PPejd3YuesXf4dT6vnsuY3F44732HTf3`) paired with the original API Secret wasn't being accepted by BeyondBancard's Payment API.

**Solution**: Use the V4 API format with the same API Key but the V4 API Secret.

## V4 Credentials You Provided

```
API Key (same): PPejd3YuesXf4dT6vnsuY3F44732HTf3
API Secret (V4): v4_merchant_N6eGFG7GwJBg5z7D6cj2aZCcmtau9hew
```

## Step-by-Step: Update & Test

### Step 1: Update Merchant with V4 Credentials

Run the setup script:
```bash
cd backend
node setup-v4-credentials.js
```

**Expected Output**:
```
🔄 Updating BeyondBancard merchant with V4 API credentials...
📋 Current Merchant: Test Beyond
✅ UPDATED TO V4 API CREDENTIALS
```

### Step 2: Verify Backend is Running

If the backend isn't running, start it:
```bash
npm start
```

The backend will automatically reload after the script updates the database.

### Step 3: Test Payment

1. Open payment page: `http://localhost:5174/pay/96blK1TMqHn493Br`
2. Verify customer info and click "Verify & Continue"
3. Enter test card:
   - Card: **4111 1111 1111 1111**
   - Name: John Doe
   - Expiry: **12/25**
   - CVV: **999**
4. Click "Pay USD $1.00"

### Step 4: Monitor for Success

**In Browser Console** (F12):
```
✅ Collect.js token received: jsk23j4...
```

**In Backend Logs** (watch `backend/logs/beyondbancard.log`):
```
🔷 Processing tokenized payment...
📤 SENDING TOKENIZED REQUEST TO BEYONDBANCARD
✅ Response received - Status 200
```

**Expected Result**:
- ✅ **Success**: Green page "Payment Successful!"
- ❌ **Auth Still Fails**: Red error "Authentication Failed"
- ❌ **Different Error**: Check error code below

## Possible Results

### Result 1: Success ✅ (Best Case)
```
Status: paid
Message: Payment successful!
Transaction ID: 123456789
```

**Action**: System is working! Contact BeyondBancard to verify these are your production credentials if needed.

### Result 2: Authentication Failed ❌ (Expected)
```
Status: failed
Message: Authentication failed - Invalid API Key or Secret
Error Code: AUTH_FAILED
```

**Meaning**: V4 API credentials are correct format, but still not accepted by BeyondBancard.

**Next Steps**:
- Verify credentials with BeyondBancard support
- Check if V4 credentials need special activation
- Confirm these are the correct API Secret for V4 API

### Result 3: Other Error ❌
```
Status: failed
Message: [Different error]
Error Code: [Different code]
```

**Check**: Backend logs for specific error code
- `PAYMENT_DECLINED`: Card declined (try different test card)
- `TIMEOUT_ERROR`: Network issue
- `NETWORK_ERROR`: Can't reach BeyondBancard
- Other: Check backend logs for details

## Verify Credentials Are Updated

Check the database was updated correctly:

**Create verification script** (`backend/check-credentials.js`):
```javascript
const path = require('path');
const Datastore = require('@seald-io/nedb');

const db = new Datastore({ 
  filename: path.join(__dirname, 'data', 'merchants.db'), 
  autoload: true 
});

db.findOne({ gateway: 'beyondbancard' }, (err, merchant) => {
  if (err || !merchant) {
    console.log('❌ Merchant not found');
    process.exit(1);
  }

  console.log('✅ Merchant found:', merchant.nickname);
  console.log('📋 Current Credentials:');
  console.log('   API Key:', merchant.credentials?.apiKey);
  console.log('   API Secret:', merchant.credentials?.apiSecret);
  console.log('   Mode:', merchant.credentials?.mode);
  
  process.exit(0);
});
```

**Run it**:
```bash
node backend/check-credentials.js
```

**Should show**:
```
✅ Merchant found: Test Beyond
📋 Current Credentials:
   API Key: PPejd3YuesXf4dT6vnsuY3F44732HTf3
   API Secret: v4_merchant_N6eGFG7GwJBg5z7D6cj2aZCcmtau9hew
   Mode: sandbox
```

## Technical Details: Why V4?

BeyondBancard has multiple API formats:

| Format | Usage | Keys |
|--------|-------|------|
| **Legacy API** | Old format | API Key + Old Secret |
| **V4 API** ✅ | Modern format | API Key + V4 Secret (different) |
| **Tokenization** | Client-side | Public Key (not for API) |
| **Checkout** | Hosted form | Checkout Key |

**You're using**: V4 API with Collect.js tokenization
- ✅ Modern, secure approach
- ✅ Proper token-based payments
- ✅ Should work with V4 Secret

## Troubleshooting V4 Setup

### Issue: Script doesn't find merchant
**Error**: "BeyondBancard merchant not found"
**Fix**:
1. Ensure backend database has merchants
2. Run: `node setup-collectjs.js` first to create merchant
3. Then run: `node setup-v4-credentials.js`

### Issue: Credentials don't seem to update
**Error**: Payment still fails after running script
**Fix**:
1. Stop backend (`Ctrl+C`)
2. Run: `node backend/setup-v4-credentials.js`
3. Restart backend: `npm start`
4. Try payment again

### Issue: Still getting authentication failed
**Error**: "Authentication failed" with V4 credentials
**Fix**: Contact BeyondBancard support with:
```
Hi,

We've switched to V4 API format with these credentials:
- API Key: PPejd3YuesXf4dT6vnsuY3F44732HTf3
- API Secret: v4_merchant_N6eGFG7GwJBg5z7D6cj2aZCcmtau9hew

Still getting "Authentication Failed" error.

Can you confirm:
1. Are these V4 API credentials valid and active?
2. Do they need any special activation?
3. Should we use a different API format?

Error response: "response=3&responsetext=Authentication Failed"

Thank you
```

## Collect.js + V4 API Flow

```
Customer enters card
        ↓
Collect.js tokenizes (client-side)
   Token: jsk23j4...
        ↓
Frontend sends token to backend
        ↓
Backend receives:
   - Token from Collect.js
   - V4 API credentials
   - Payment amount
        ↓
Backend sends to BeyondBancard:
   POST /api/transact.php
   payment_token=jsk23j4...
   username=PPejd3YuesXf4dT6vnsuY3F44732HTf3
   password=v4_merchant_N6eGFG7GwJBg5z7D6cj2aZCcmtau9hew
        ↓
BeyondBancard processes:
   ✅ Validates V4 credentials
   ✅ Uses token to process card
   ✅ Returns result
        ↓
Response:
   response=1&responsetext=Success&transactionid=...
   OR
   response=3&responsetext=Authentication Failed
```

## Next Steps

1. **Run setup script**: `node backend/setup-v4-credentials.js`
2. **Test payment**: Go to payment page with test card
3. **Check result**: Success or specific error
4. **If auth fails**: Contact BeyondBancard with details above

## Alternative if V4 Still Fails

If V4 credentials don't work either:

### Option 1: Test Mode (Immediate)
Auto-approve all test cards:
```bash
node backend/setup-test-mode.js
```

### Option 2: Stripe (15 minutes)
Fully integrated, just needs test keys in `.env`

### Option 3: Contact Support
Provide BeyondBancard:
- Original API Key: `PPejd3YuesXf4dT6vnsuY3F44732HTf3`
- V4 API Secret: `v4_merchant_N6eGFG7GwJBg5z7D6cj2aZCcmtau9hew`
- Error: "Authentication Failed (response code 3)"
- Request: Verify credentials are active

---

**Ready to test? Run the setup script and go to payment page!** 🚀
