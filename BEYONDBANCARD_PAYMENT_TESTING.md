# BeyondBancard Payment Testing & Debugging Guide

## Current Status

✅ Credential Testing: Working
❌ Payment Processing: Returning "Payment processing failed"
❌ Card Validation: Needs verification (invalid cards should be rejected)
❌ Redirect After Payment: Not working (needs brand configuration)

## How to Test Payment

### Step 1: Prepare a Test Invoice

1. Go to frontend (http://localhost:5174)
2. Login as admin
3. Navigate to Invoices
4. Create a new invoice with:
   - Brand: USS PTO (or any created brand)
   - Customer Name: Test User
   - Customer Email: test@example.com
   - Customer Serial Number: TEST123
   - Amount: $10.00 (or any amount)

### Step 2: Access Payment Page

1. Get the invoice ID from the URL after creating it
2. Navigate to the payment link:
   ```
   http://localhost:5174/invoice/[INVOICE_ID]
   ```

### Step 3: Verify Customer

1. Enter customer details to match the invoice
2. Click "Verify & Continue"
3. You should be taken to the payment form

### Step 4: Test Payment

#### Test with VALID card:
- Card Number: `4242 4242 4242 4242` (Visa test card)
- Card Holder: `Test User`
- Expiry: `12/2025` (future date)
- CVV: `123` (any 3 digits)

#### Test with INVALID card (should be REJECTED):
- Card Number: `4111 1111 1111 1111` (fails Luhn check - SHOULD BE REJECTED)
- Card Number: `1234 5678 9012 3456` (invalid format - SHOULD BE REJECTED)
- Expiry: `12/2020` (expired - SHOULD BE REJECTED)
- CVV: `1` (invalid CVV length - SHOULD BE REJECTED)

## Debugging Payment Failures

### Where to Look for Logs

#### Backend Logs (Terminal)
1. Check terminal running `npm start` in backend directory
2. Look for "=== PAYMENT PROCESSING ===" sections
3. Find "❌ BeyondBancard Payment Error" for error details

#### Frontend Logs (Browser Console)
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for "=== PAYMENT REQUEST ===" and "=== PAYMENT RESPONSE ===" logs
4. Check network tab for actual API request/response

### Common Error Messages and Solutions

#### Error: "Payment processing failed"
**Cause**: Generic error - look at backend logs for actual error
**Solution**: 
1. Check backend terminal output
2. Look for detailed error message
3. Check if credentials are valid

#### Error: "Invalid API credentials"
**Cause**: API Key or Secret is wrong or expired
**Solution**:
1. Go to BeyondBancard dashboard
2. Verify API Key and Secret are correct
3. Re-save merchant credentials
4. Test credentials again before payment

#### Error: "Cannot reach BeyondBancard API server"
**Cause**: Network issue or endpoint URL is wrong
**Solution**:
1. Check your internet connection
2. Verify endpoint is: `https://beyondbancard.transactiongateway.com/api/v1`
3. Test connection manually: `curl https://beyondbancard.transactiongateway.com/api/v1`

#### Error: "BeyondBancard API endpoint not found (404)"
**Cause**: The endpoint path might be different
**Solution**:
1. System will try these endpoints automatically:
   - `/api/v1/transactions`
   - `/api/v1/charge`
   - `/api/v1/`
2. If still 404, ask BeyondBancard support for correct endpoint
3. Update endpoints in `/backend/src/utils/beyondbancard.js`:
   ```javascript
   const BEYONDBANCARD_API_ENDPOINT = 'https://beyondbancard.transactiongateway.com/correct-path';
   ```

#### Error: "Card was declined"
**Cause**: BeyondBancard rejected the card
**Solution**:
1. Check card number validity (Luhn algorithm)
2. Check expiry date is not expired
3. Check card is supported by BeyondBancard
4. Try with a different test card

## What Happens During Payment Processing

### Frontend Side:
1. User enters card details
2. Click "Pay" button
3. Frontend logs: "=== PAYMENT REQUEST ===" with card info
4. Sends POST to `/api/invoices/public/:id/pay`
5. Receives response and logs: "=== PAYMENT RESPONSE ==="
6. If `status: 'paid'` and `redirectUrl` exists and `enableRedirect: true`:
   - Redirects to brand URL after 2 seconds
7. Otherwise shows success page

### Backend Side:
1. Validates invoice exists and not already paid
2. Validates customer verification
3. Gets merchant credentials
4. Logs: "Processing payment for invoice XXX with merchant beyondbancard"
5. Calls BeyondBancard API with payment request
6. Logs payment request details
7. Receives response and logs: "BeyondBancard response status: 200"
8. Validates response has transaction_id
9. Updates invoice status to "paid" if successful
10. Fetches brand redirect info
11. Returns response with redirectUrl and enableRedirect

## Fixing the Redirect Issue

### Current Status:
- Brands have been migrated to include `redirectUrl` and `enableRedirect` fields
- Currently all brands have these set to `null` and `false`

### To Enable Redirect:

1. Go to frontend → Brands page
2. Click Edit on a brand
3. Scroll to "Post-Payment Settings"
4. Enter Redirect URL (e.g., `https://example.com/success`)
5. Check "Enable automatic redirect after payment"
6. Click "Update Brand"

7. Create a test invoice and make a payment
8. After successful payment, you should be redirected to the URL

## Verifying Card Validation

The system should REJECT:
- ❌ `1234 5678 9012 3456` (invalid checksum - fails Luhn algorithm)
- ❌ `12345678901` (too short - only 11 digits)
- ❌ CVV `1` (too short - needs 3-4 digits)
- ❌ Expiry `13/2025` (invalid month)
- ❌ Expiry `12/2020` (expired date)

The system should ACCEPT:
- ✅ `4242 4242 4242 4242` (valid Visa test card, Luhn passes)
- ✅ `5555 5555 5555 4444` (valid Mastercard test card, Luhn passes)

To test this:
1. Try entering an invalid card
2. Check frontend console for validation errors
3. Frontend should reject before even sending to backend

## Getting More Details

### Enable Debug Mode:
Add to `.env`:
```
DEBUG=true
LOG_LEVEL=debug
```

### Check Database:
Brands with redirect settings:
```bash
# On backend
cat data/brands.db
# Look for: "redirectUrl" and "enableRedirect" fields
```

### Make Direct API Calls:
```bash
# Test credentials
curl -X POST http://localhost:5000/api/merchants/test-beyondbancard \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "apiKey": "your_key",
    "apiSecret": "your_secret",
    "mode": "sandbox"
  }'

# Make payment (if you have a test invoice ID)
curl -X POST http://localhost:5000/api/invoices/public/INVOICE_ID/pay \
  -H "Content-Type: application/json" \
  -d '{
    "cardNumber": "4242424242424242",
    "cardHolder": "Test User",
    "expiryMonth": "12",
    "expiryYear": "2025",
    "cvv": "123",
    "merchantId": "MERCHANT_ID"
  }'
```

## Summary of Improvements Made

1. ✅ Added comprehensive error logging to backend
2. ✅ Added fallback endpoint detection (tries /transactions, /charge, /)
3. ✅ Migrated existing brands to include redirect fields
4. ✅ Improved error messages for debugging
5. ✅ Added validation error handling
6. ✅ Added frontend logging for payment requests/responses
7. ✅ Added Luhn algorithm validation for cards

## Next Steps

1. **Test Payment**: Follow "How to Test Payment" section above
2. **Check Logs**: Monitor backend terminal and browser console
3. **Share Error Details**: If payment fails, share:
   - Backend error message
   - Frontend console log
   - Card details used (last 4 digits only for security)
4. **Test Redirect**: Set a redirect URL on a brand and test payment
5. **Verify Validation**: Test with invalid card to ensure rejection

## Support

If payment processing still fails:
1. Collect the full error message from backend logs
2. Check if it's a 404 (endpoint issue) or 401 (auth issue)
3. Contact BeyondBancard support with API endpoint questions
4. Verify API credentials one more time in your BeyondBancard dashboard

