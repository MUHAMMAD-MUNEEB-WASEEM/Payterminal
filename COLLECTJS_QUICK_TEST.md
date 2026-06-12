# Collect.js Quick Test Guide

## ✅ Setup Complete

The tokenization key has been added to your BeyondBancard merchant:
- **Key**: Q8N5U4-543kky-kZr2CC-ns8K2Y
- **Merchant ID**: R2uYnSvxeIzUObOQ
- **Status**: Ready for testing

## Test Steps

### 1. Verify Backend is Running
```bash
cd backend
npm start
```

Output should show:
```
Server running on port 5000
Database connected
```

### 2. Start Frontend (in new terminal)
```bash
cd frontend
npm run dev
```

Frontend will be at `http://localhost:5174`

### 3. Navigate to Payment Page
Go to: `http://localhost:5174/pay/96blK1TMqHn493Br`

Or any invoice ID (this one is pre-verified and ready to test)

### 4. Payment Flow
1. **Step 1**: You should see the customer information (already verified)
2. **Step 2**: Invoice details showing amount ($1.00)
3. **Step 3**: "Card Details" section with payment form

### 5. Collect.js Integration Test

When you're on the payment form:

**Browser Console Check** (F12 → Console tab):
```javascript
// Should see:
"✅ Collect.js initialized"
```

**Form Behavior**:
- Card number field will work normally (front-end validation)
- Click "Pay" button

**Expected Flow**:
1. Card details are captured
2. Collect.js tokenizes the card (you won't see the raw card data)
3. Logs in console: `🔷 Using Collect.js for tokenization...`
4. Token is generated
5. Token is sent to backend (not raw card)
6. Backend processes with BeyondBancard

### 6. Test Cards

Use these test cards in the payment form:

#### Approved Cards
- **Visa**: 4111 1111 1111 1111
- **Mastercard**: 5555 5555 5555 4444
- **American Express**: 3782 822463 10005

#### Declined Cards
- **Visa (Declined)**: 4222 2222 2222 2220

#### Any Details Work
- **Expiry**: 12/25 (or any future date)
- **CVV**: 999 (or any 3-4 digits)
- **Cardholder**: Any name (John Doe)

### 7. Monitor Logs

While testing, watch the logs:

```bash
# Terminal 1: Backend logs show payment processing
tail -f backend/logs/beyondbancard.log
```

#### Expected Log Output

**Starting**:
```
🚀 BeyondBancard payment processor started
🔷 Processing tokenized payment...
📍 Using endpoint: https://beyondbancard.transactiongateway.com/api/transact.php
📤 SENDING TOKENIZED REQUEST TO BEYONDBANCARD
```

**Success** (if credentials are activated):
```
✅ Response received - Status 200
📥 Raw response: response=1&responsetext=Success&transactionid=123456789...
✅ TOKENIZED PAYMENT SUCCESSFUL
```

**Failure** (if credentials not activated):
```
✅ Response received - Status 200
📥 Raw response: response=3&responsetext=Authentication Failed...
❌ PAYMENT ERROR: Authentication Failed
```

### 8. Browser Network Tab Test

Open DevTools (F12) → Network tab:

**Look for POST request to**:
```
http://localhost:5000/api/invoices/public/96blK1TMqHn493Br/pay
```

**Request Payload** (should NOT include raw card data):
```json
{
  "token": "jsk23j4k234_token_from_collectjs...",
  "cardHolder": "John Doe",
  "merchantId": "R2uYnSvxeIzUObOQ"
}
```

Notice: No `cardNumber`, `cvv`, `expiryMonth`, `expiryYear` - just the token!

**Response** (payment result):
```json
{
  "status": "paid" or "failed",
  "message": "Payment successful!" or "error message",
  "transactionId": "123456789"
}
```

### 9. Full Test Scenarios

#### Scenario A: Happy Path
1. Page loads ✅
2. Invoice displayed ✅
3. Enter test card: 4111 1111 1111 1111 ✅
4. Click Pay ✅
5. Collect.js tokenizes ✅
6. Backend sends token to BeyondBancard ✅
7. Response: Payment successful ✅

#### Scenario B: Collect.js Not Loading
**Symptom**: "Pay" button doesn't work

**Check**:
1. Browser console (F12) for errors
2. Verify tokenizationKey is set: `console.log(window.CollectJS)`
3. Check network tab for Collect.js script loading failure

**Fix**:
- Verify merchant has `tokenizationKey` in database
- Run setup again: `node setup-collectjs.js`

#### Scenario C: Token Generated but Payment Fails
**Symptom**: Token sent, but BeyondBancard returns authentication error

**Check Logs**:
```
❌ PAYMENT ERROR: Authentication Failed
```

**This means**:
- Collect.js is working ✅
- Token generation working ✅
- Backend correctly using token ✅
- BUT: BeyondBancard credentials need activation ⚠️

**Solution**:
- Contact BeyondBancard support
- Ask to activate credentials for live transactions
- Or use test mode (see Alternative section below)

## Alternative: Test Mode

If credentials aren't activated, test with sandbox mode:

```javascript
// In backend/.env or database:
// Set merchant mode to "sandbox" instead of "live"
```

Then payments in sandbox automatically approve test cards.

## Troubleshooting

### Collect.js Script Not Loading
```
✖️ Failed to load Collect.js
```

**Check**:
1. Internet connection (needs external CDN)
2. Browser allows loading from `cdn.collectjs.com`
3. No adblocker blocking the script

### Token Callback Never Fires
**Symptom**: Click pay, nothing happens

**Check**:
1. Console for JavaScript errors
2. Network tab for Collect.js script loaded
3. Verify tokenizationKey is correct
4. Browser cookies/localStorage enabled

### Backend Not Receiving Token
**Symptom**: Browser console shows request, backend logs show error

**Check**:
1. Backend is running on port 5000
2. Frontend API URL is correct: `http://localhost:5000/api`
3. Check backend console for errors

## Files Involved

| File | Purpose |
|------|---------|
| `frontend/src/pages/PublicInvoice.jsx` | Payment form with Collect.js |
| `backend/src/utils/beyondbancard.js` | Token processing |
| `backend/setup-collectjs.js` | Setup script |
| `backend/logs/beyondbancard.log` | Payment logs |

## Next Steps

1. **If test succeeds**: Credentials are activated, payment system works! ✅
2. **If test fails with auth error**: Contact BeyondBancard support with your credentials
3. **If test fails with technical error**: Check logs and consult troubleshooting

## Support

**For Collect.js issues**:
- [BeyondBancard Collect.js Docs](https://beyondbancard.com/docs/collectjs)

**For Payment API issues**:
- [BeyondBancard Payment API Docs](https://beyondbancard.com/docs/payment-api)

**For this implementation**:
- Check backend logs: `backend/logs/beyondbancard.log`
- Check browser console: F12 → Console tab
- Check network tab: F12 → Network tab, filter for API requests
