# Authorize.net Setup Guide

## ⚠️ CRITICAL SECURITY NOTICE

**NEVER share your API credentials publicly!** The credentials you shared have been exposed and must be regenerated immediately.

## Step 1: Regenerate Your Credentials

1. Log into your Authorize.net account at https://account.authorize.net/
2. Go to **Account** → **Settings** → **API Credentials and Keys**
3. Click **Regenerate Transaction Key** or **New Transaction Key**
4. Save the new credentials securely

## Step 2: Understanding Authorize.net Credentials

Authorize.net uses different credential types:

### For Transaction Processing (What You Need)
- **API Login ID**: Your merchant identifier (e.g., `87fSG8mf`)
- **Transaction Key**: Secret key for API authentication (e.g., `4e26c8Vwf62KGw24`)

### For Accept.js (Client-Side - Optional)
- **Public Client Key**: For browser-side tokenization
- **API Login ID**: Same as above

### What You Shared (DO NOT USE THESE ANYMORE)
```
❌ API Login ID: 87fSG8mf
❌ Transaction Key: 4e26c8Vwf62KGw24
❌ Public Key: 6CrSzF22qUTPwuP35QYd9q8QT8JpC464dhGqTn8JHj8cE5xvzWPqMNxU7dSSwDzH
❌ Secret Key: C5329A5B5DF4439987D25F59582EA8FF...
```

**These are now compromised and must be regenerated!**

## Step 3: Secure Configuration

### Option A: Using Environment Variables (Recommended)

1. Add to `backend/.env`:
```env
# Authorize.net Credentials (KEEP SECRET!)
AUTHORIZE_API_LOGIN_ID=your_new_api_login_id
AUTHORIZE_TRANSACTION_KEY=your_new_transaction_key
AUTHORIZE_MODE=sandbox  # or 'production'
```

2. Never commit `.env` to git (already in `.gitignore`)

### Option B: Store in Merchant Configuration (Current Method)

When creating a merchant in the admin panel:
1. Go to **Merchants** page
2. Click **Add Merchant**
3. Select **Authorize.net** as gateway
4. Enter:
   - **API Login ID**: Your new API Login ID
   - **Transaction Key**: Your new Transaction Key
   - **Mode**: Select `sandbox` for testing or `live` for production

## Step 4: Testing

### Test Mode (Sandbox)
Use Authorize.net test cards:
- **Visa**: `4007000000027`
- **Mastercard**: `5424000000000015`
- **Amex**: `370000000000002`
- **Discover**: `6011000000000012`

Any future expiry date and any 3-4 digit CVV.

### Test Transaction
1. Create an invoice
2. Assign it to a brand with Authorize.net merchant
3. Open payment link
4. Use test card above
5. Should process successfully in sandbox mode

## Step 5: Going Live

### Prerequisites
1. Complete Authorize.net account verification
2. Have your account approved for live transactions
3. Understand PCI compliance requirements

### Switch to Production
1. Update merchant configuration:
   - Mode: `live` (instead of `sandbox`)
   - Use production API credentials
2. Test with real card (small amount)
3. Verify transaction in Authorize.net dashboard

## Security Best Practices

### ✅ DO:
- Store credentials in environment variables or encrypted database
- Use HTTPS for all API calls
- Regenerate keys if compromised
- Use sandbox mode for testing
- Implement rate limiting
- Log transactions (without card details)
- Use PCI-compliant hosting

### ❌ DON'T:
- Share credentials publicly (chat, email, code repos)
- Commit credentials to git
- Store credentials in frontend code
- Log full card numbers
- Use production credentials for testing
- Share credentials between environments

## Credential Storage in PayTerminal

Your PayTerminal system stores merchant credentials securely:

1. **Database**: Credentials stored in NeDB (local file)
2. **API Response**: Credentials masked when sent to frontend
3. **Payment Processing**: Credentials only used server-side

### How It Works:
```javascript
// Frontend receives masked credentials
{
  _id: "merchant123",
  nickname: "Main Authorize.net",
  gateway: "authorize",
  credentials: { configured: true }  // ← Actual keys hidden
}

// Backend uses real credentials for payment
const merchant = await db.merchants.findOne({ _id: merchantId });
// merchant.credentials = { apiLoginId: "...", transactionKey: "..." }
processAuthorizePayment(merchant.credentials, paymentData);
```

## Troubleshooting

### Error: "Authentication failed"
- Check API Login ID and Transaction Key are correct
- Verify you're using the right mode (sandbox vs live)
- Ensure credentials haven't expired

### Error: "Invalid card number"
- In sandbox mode, use Authorize.net test cards
- In live mode, ensure card is valid and has funds

### Error: "Transaction declined"
- Check card has sufficient funds
- Verify billing address if AVS is enabled
- Check CVV is correct

## Support

- **Authorize.net Support**: https://support.authorize.net/
- **Developer Docs**: https://developer.authorize.net/
- **Test Guide**: https://developer.authorize.net/hello_world/testing_guide/

## Next Steps

1. ✅ Regenerate your compromised credentials
2. ✅ Add new credentials to PayTerminal merchant
3. ✅ Test with sandbox test cards
4. ✅ Verify transactions in Authorize.net dashboard
5. ✅ Review security best practices
6. ✅ Never share credentials again!

---

**Remember**: Your API credentials are like passwords. Treat them with the same level of security!
