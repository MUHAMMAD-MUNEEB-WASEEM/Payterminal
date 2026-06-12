# Collect.js Implementation for BeyondBancard

## Overview

Collect.js is a secure tokenization system that:
- **Keeps card data off your servers** - Cards never touch your backend
- **Generates secure tokens** - Safe to send to the Payment API
- **Works with BeyondBancard Payment API** - Complete solution

## Current Implementation Status

### ✅ Completed
1. **Frontend Integration** (`frontend/src/pages/PublicInvoice.jsx`)
   - Added Collect.js script loader
   - Integrated tokenization callback
   - Conditional payment flow for BeyondBancard
   - Fallback for other gateways

2. **Backend Support** (`backend/src/utils/beyondbancard.js`)
   - Token handling in payment processor
   - `payment_token` parameter support
   - Separate tokenized payment flow
   - Full logging for token-based payments

### 🔧 Setup Required

#### Step 1: Add Tokenization Key to Merchant Credentials

The tokenization key must be stored in the merchant's credentials. Your public key is:
```
Q8N5U4-543kky-kZr2CC-ns8K2Y
```

Add this to your merchant record in the database:

```javascript
// Example: Adding tokenization key to existing merchant
db.merchants.updateOne(
  { _id: "R2uYnSvxeIzUObOQ" },
  { $set: { tokenizationKey: "Q8N5U4-543kky-kZr2CC-ns8K2Y" } }
)
```

Or when creating a new merchant:
```javascript
const merchant = {
  nickname: "BeyondBancard - Tokenized",
  gateway: "beyondbancard",
  credentials: {
    apiKey: "PPejd3YuesXf4dT6vnsuY3F44732HTf3",
    apiSecret: "v4_merchant_N6eGFG7GwJBg5z7D6cj2aZCcmtau9hew",
    mode: "sandbox"
  },
  tokenizationKey: "Q8N5U4-543kky-kZr2CC-ns8K2Y",
  isActive: true,
  isDefault: true
}
```

#### Step 2: Test Flow

1. **Start the servers**
   ```bash
   # Backend
   cd backend && npm start
   
   # Frontend (new terminal)
   cd frontend && npm run dev
   ```

2. **Go to payment page**
   ```
   http://localhost:5174/pay/96blK1TMqHn493Br
   ```
   Or any valid invoice ID

3. **Payment Flow**
   - Verify customer information
   - Select BeyondBancard payment method
   - Collect.js will load automatically
   - Enter card details in Collect.js iframe
   - Click "Pay" button
   - Collect.js tokenizes the card
   - Frontend sends token to backend
   - Backend processes token with BeyondBancard

#### Step 3: How It Works

```
Customer enters card → Collect.js iframe (client-side) → Token generated
                                                             ↓
                                         Token sent to backend (safe)
                                                             ↓
                        Backend uses token + API credentials
                        with BeyondBancard Payment API
                                                             ↓
                        Transaction processed, card never touched server
```

## Key Differences from Raw Card Processing

### Before (Raw Card Data)
❌ Card numbers sent to your server
❌ PCI-DSS compliance burden
❌ Authentication issues with raw cards

### After (Collect.js Tokenization)
✅ Cards never leave customer's browser
✅ Tokens sent to server instead
✅ BeyondBancard handles the authentication

## API Changes

### Payment Request (Old)
```json
{
  "cardNumber": "4242 4242 4242 4242",
  "cardHolder": "John Doe",
  "expiryMonth": "12",
  "expiryYear": "2025",
  "cvv": "123",
  "merchantId": "R2uYnSvxeIzUObOQ"
}
```

### Payment Request (New - Tokenized)
```json
{
  "token": "jsk23j4k234_token_from_collectjs",
  "cardHolder": "John Doe",
  "merchantId": "R2uYnSvxeIzUObOQ"
}
```

## Backend Processing

The backend processor (`beyondbancard.js`) now handles both:

1. **Tokenized payments** (preferred)
   ```javascript
   const paymentRequest = {
     type: 'sale',
     payment_token: 'jsk23j4k234_token_from_collectjs',
     // ... other fields
   };
   ```

2. **Raw card data** (fallback)
   ```javascript
   const paymentRequest = {
     type: 'sale',
     ccnumber: '4242424242424242',
     ccexp: '1225',
     cvv: '123',
     // ... other fields
   };
   ```

## Expected Response

From BeyondBancard Payment API:
```
response=1&responsetext=Success&transactionid=123456789&authcode=ABC123
```

Response codes:
- `1` = Approved ✅
- `2` = Declined ❌
- `3` = Error ❌

## Troubleshooting

### Collect.js Not Loading
- Check browser console for errors
- Verify tokenization key is correct
- Check merchant has tokenizationKey set in database

### Tokenization Fails
- Ensure Collect.js is loaded before form submission
- Check if `collectJsReady` state is true
- Verify callback is properly configured

### Payment Still Fails with Token
- Check backend logs in `backend/logs/beyondbancard.log`
- Verify API credentials are correct
- Confirm token format is valid

## Next Steps

1. **Update merchant in database** with tokenization key
2. **Test with test card**: `4111 1111 1111 1111`
3. **Verify logs** in `backend/logs/beyondbancard.log`
4. **Monitor frontend console** for token generation

## Files Modified

- `frontend/src/pages/PublicInvoice.jsx` - Added Collect.js integration
- `backend/src/utils/beyondbancard.js` - Added token handling

## References

- [Collect.js Documentation](https://beyondbancard.com/docs/collectjs)
- [Payment API Documentation](https://beyondbancard.com/docs/payment-api)
- [Tokenization Setup Guide](https://beyondbancard.com/docs/tokenization)
