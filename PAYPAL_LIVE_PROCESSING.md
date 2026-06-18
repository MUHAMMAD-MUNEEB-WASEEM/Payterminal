# PayPal Live Card Processing - Complete Setup

## ✅ Status: LIVE PROCESSING ENABLED

The PayPal integration now supports **real card processing** in both sandbox (test) and live (production) modes using PayPal REST API v2.

## Setup Requirements

### 1. Get PayPal Credentials

**For Sandbox (Testing):**
1. Go to https://developer.paypal.com/
2. Log in with your PayPal account
3. Select **Sandbox** environment (top left)
4. Go to **Apps & Credentials**
5. Click **Create App** under "REST API apps"
6. Copy:
   - **Client ID**
   - **Client Secret**

**For Live (Production - Real Transactions):**
1. Go to https://developer.paypal.com/
2. Log in with your PayPal account
3. Select **Live** environment (top left)
4. Go to **Apps & Credentials**
5. Your live credentials will be displayed
6. Copy:
   - **Client ID**
   - **Client Secret**

⚠️ **IMPORTANT**: Make sure your PayPal business account is verified and active before using live credentials.

### 2. Create PayPal Merchant in Admin

1. Go to Admin Dashboard → **Merchants**
2. Click **Add Merchant**
3. Fill in:
   - **Nickname**: "PayPal" (or your choice)
   - **Gateway**: Select "paypal"
   - **Mode**: 
     - `sandbox` for testing
     - `live` for real payments
   - **Client ID**: Paste your PayPal Client ID
   - **Client Secret**: Paste your PayPal Client Secret
4. Save

### 3. Assign to Brand

1. Go to your **Brand**
2. Add PayPal merchant as payment method
3. Optionally set as default

## Testing Payments

### Sandbox Mode (Test Cards)

Use these cards with ANY future expiry and CVV:

| Card Type | Number |
|-----------|--------|
| Visa | `4111111111111111` |
| Mastercard | `5555555555554444` |
| Amex | `378282246310005` |
| Discover | `6011111111111117` |

**Example:**
- Card: `4111111111111111`
- Expiry: `12/2025`
- CVV: `123`
- Amount: Any positive number

### Live Mode (Real Credit Cards)

⚠️ **WARNING**: Live mode will charge real credit cards. Only use when:
- Testing is complete
- Your PayPal account is fully verified
- You understand the fees (~2.9% + $0.30 per transaction)
- You have proper business insurance

## How It Works

### Payment Flow

1. **Customer enters card details** on payment page
2. **Backend validates** card format, CVV, expiry
3. **Authentication**: Gets OAuth token from PayPal
4. **Create Order**: Sends order to PayPal with card payment source
5. **Capture Payment**: Captures order to charge the card
6. **Return Result**: Transaction ID sent back to frontend
7. **Invoice Updated**: Marked as "paid" with transaction reference

### API Calls Made

- `POST /v1/oauth2/token` - Get access token
- `POST /v2/checkout/orders` - Create order with card source
- `POST /v2/checkout/orders/{id}/capture` - Capture (charge) the card

### Transaction IDs

Real PayPal transactions generate IDs like:
```
5BC80F67E2D9A1234567890ABCDEF
```

These are stored in invoice's `paymentOrderRef` field.

## Testing End-to-End

### Test in Sandbox Mode

1. Create PayPal merchant with `mode: sandbox`
2. Go to http://localhost:5173
3. Create invoice (e.g., $10.00)
4. Select PayPal payment method
5. Enter test card: `4111111111111111`
6. Expiry: `12/2025`, CVV: `123`
7. Click **Pay**
8. ✅ Should succeed - invoice marked PAID
9. Check transaction ID in invoice details

### Test Expired Card (Should Fail)

1. Use test card: `4111111111111111`
2. Expiry: `01/2020` (expired)
3. CVV: `123`
4. Click **Pay**
5. ❌ Should fail with "Card has expired"

### Test Invalid Format (Should Fail)

1. Card: `123` (too short)
2. CVV: `12` (too short)
3. Click **Pay**
4. ❌ Should fail with validation error

## Error Handling

The implementation handles:

| Error | PayPal Response | User Message |
|-------|-----------------|--------------|
| Invalid card | `MALFORMED_REQUEST_JSON` | "Order creation failed..." |
| Declined card | `DECLINED` | "Card declined..." |
| Expired card | Validation fails | "Card has expired" |
| Invalid CVV | Validation fails | "Invalid CVV format" |
| Auth failed | `401 Unauthorized` | "PayPal authentication failed" |
| Network error | Connection error | "Payment processing failed" |

## Security Notes

✅ **Secure:**
- HTTPS for all API calls
- Card validated on backend
- OAuth 2.0 authentication
- Only transaction IDs stored (never full card data)
- PCI compliance through PayPal

❌ **NOT Secure (Don't Do):**
- Sending card data to frontend
- Storing card numbers
- Logging full card details
- Disabling HTTPS

## Debugging

### Check Payment Logs

Backend logs all PayPal activity:
```
backend/logs/payment-route.log
```

Look for:
- ✅ "Payment successful" - Success
- ❌ "Payment capture failed" - Card declined
- ❌ "Order creation failed" - Invalid data or auth issue

### Common Issues

**Issue**: "PayPal authentication failed"
- **Cause**: Wrong Client ID/Secret
- **Fix**: Verify credentials in merchant settings

**Issue**: "Card has expired"
- **Cause**: Expiry date in past
- **Fix**: Use future date (e.g., 12/2025)

**Issue**: "Invalid card number format"
- **Cause**: Card number wrong length
- **Fix**: Use 13-19 digits

**Issue**: Payment succeeds but invoice not marked paid
- **Cause**: Database issue or network lag
- **Fix**: Refresh page, check logs

## Moving from Sandbox to Live

### Checklist

- [ ] Test all payments work in sandbox mode
- [ ] Verify PayPal account is fully verified
- [ ] Get live Client ID and Secret from PayPal
- [ ] Update merchant mode to "live"
- [ ] Update Client ID and Secret
- [ ] Test with small amount ($0.01)
- [ ] Monitor first few transactions
- [ ] Check PayPal account for deposits

### Steps

1. Go to Admin → Merchants
2. Edit PayPal merchant
3. Change **Mode** from "sandbox" to "live"
4. Update **Client ID** and **Client Secret** with live values
5. Save
6. Test payment with real card (use small amount first)

## Production Guidelines

✅ **DO:**
- Use HTTPS in production
- Validate all inputs
- Log transactions for reconciliation
- Monitor PayPal account
- Handle errors gracefully
- Test refunds periodically

❌ **DON'T:**
- Disable SSL/HTTPS
- Log full card details
- Use test credentials in production
- Ignore PayPal errors
- Store card data locally

## Fees & Costs

PayPal charges:
- **2.9% + $0.30 USD** per transaction (US)
- Rates vary by country
- No setup or monthly fees
- Funds deposit in 1-2 business days

Example:
- Invoice: $100.00
- Fee: $3.20 (2.9% + $0.30)
- You receive: $96.80

## Support

**PayPal Developer Support:**
- https://developer.paypal.com/support/
- https://developer.paypal.com/docs/

**For this implementation:**
- Check logs in `backend/logs/payment-route.log`
- Verify merchant credentials
- Test in sandbox first

## Summary

✅ **Sandbox Mode**: Works with test cards, no real charges
✅ **Live Mode**: Real card processing, real charges
✅ **Secure**: OAuth 2.0, HTTPS, no card storage
✅ **Production Ready**: Full error handling and logging

You're ready to process real PayPal payments!
