# BeyondBancard Payment Debugging

## Current Issue

User is getting "Payment processing failed" error when trying to make a payment with BeyondBancard.

## How to Get Debug Information

### Step 1: Open Backend Terminal
Look at the terminal window where backend is running (npm start). You should see logs from your payment attempt.

### Step 2: Check for Error Details
Look for logs like:

```
❌ PAYMENT PROCESSOR ERROR:
Gateway: BeyondBancard
Error message: [detailed error message here]
Error code: [code here]
---Response Details---
Response status: [status code]
Response data: [actual API response]
```

### Step 3: Share These Details
When you see the error, please copy and paste the following information:

1. **Error message** - The line that says "Error message: ..."
2. **Error code** - The line that says "Error code: ..." (if any)
3. **Response status** - The line that says "Response status: ..."
4. **Response data** - The entire API response in JSON format

Example of what to look for:

```
❌ PAYMENT PROCESSOR ERROR:
Gateway: BeyondBancard
Error message: Cannot POST /transactions (404)
Error code: ENOTFOUND
---Response Details---
Response status: 404
Response data: {"error":"Not Found"}
```

## What Each Error Means

### Error: "Cannot POST /transactions (404)"
- **Cause**: The `/transactions` endpoint doesn't exist on BeyondBancard API
- **Solution**: System will try `/charge` and `/` endpoints automatically. If all fail, the endpoint URL might be wrong.

### Error: "401 Unauthorized"
- **Cause**: API Key or Secret is wrong
- **Solution**: Go to Merchants, edit the BeyondBancard merchant, and verify credentials are correct

### Error: "400 Bad Request"
- **Cause**: The request data format might be wrong
- **Solution**: This depends on what the API response says. Check the response data for details.

### Error: "Cannot connect to BeyondBancard API"
- **Cause**: Network issue or API endpoint is not reachable
- **Solution**: 
  1. Check your internet connection
  2. Verify the endpoint URL is correct
  3. Check if BeyondBancard servers are down

## Testing Steps

### Step 1: Create a Test Invoice
1. Go to http://localhost:5174/dashboard
2. Login with admin account
3. Create a new invoice for $1.00
4. Note the invoice ID

### Step 2: Access Payment Page
1. Go to: `http://localhost:5174/invoice/[INVOICE_ID]`
2. Verify customer details
3. Click "Verify & Continue"

### Step 3: Enter Card Details
Use one of these test cards:
- **Visa 4242**: `4242 4242 4242 4242` (should work)
- **Mastercard 5555**: `5555 5555 5555 4444` (should work)
- **Your card**: `[Card ending in 5753]` (what you tested with)

All with:
- Expiry: `04/2031` (or any future date)
- CVV: `123` (any 3 digits)
- Name: `Test User`

### Step 4: Make Payment
1. Click "Pay $1.00" button
2. Watch browser console for request/response logs
3. Check backend terminal for error details

## Backend Logs to Check

### Look for These Patterns

**Successful Payment:**
```
Processing payment for invoice INV-XXXXX with merchant beyondbancard
Request payload: {...}
✅ Request succeeded on endpoint: /transactions
BeyondBancard response status: 200
Payment successful! Transaction ID: txn_xxxxx
```

**Failed Payment:**
```
Processing payment for invoice INV-XXXXX with merchant beyondbancard
Request payload: {...}
❌ /transactions endpoint failed: {"message":"...","status":404,...}
```

## Quick Fixes to Try

### 1. Verify Credentials
```bash
Go to Merchants > Edit BeyondBancard merchant > Test Credentials
```

### 2. Check if Test Card Works
```
Card: 4242 4242 4242 4242
Expiry: 12/2025
CVV: 123
```

### 3. Try Different Endpoint
If you're still getting 404 errors, the endpoint might need to be updated in the code:

File: `/backend/src/utils/beyondbancard.js`

Look for:
```javascript
const BEYONDBANCARD_API_ENDPOINT = 'https://beyondbancard.transactiongateway.com/api/v1';
const BEYONDBANCARD_SANDBOX_ENDPOINT = 'https://api.sandbox.transactiongateway.com/api/v1';
```

Try changing to:
```javascript
const BEYONDBANCARD_API_ENDPOINT = 'https://beyondbancard.transactiongateway.com';
const BEYONDBANCARD_SANDBOX_ENDPOINT = 'https://api.sandbox.transactiongateway.com';
```

Or contact BeyondBancard support to confirm the correct API endpoint.

## Information to Get from BeyondBancard

If debugging doesn't reveal the issue, contact BeyondBancard support with these questions:

1. **Correct API Endpoint**: What is the correct endpoint for processing payments?
   - Example: `https://beyondbancard.transactiongateway.com/api/v1/transactions`

2. **Transaction Endpoint**: What is the path to create a transaction/charge?
   - Example: `/transactions` or `/charge` or `/payments`

3. **Request Format**: What is the exact JSON request format expected?
   - Example: Field names, required fields, optional fields

4. **Response Format**: What does a successful response look like?
   - Example: `{ "transaction_id": "...", "status": "approved" }`

5. **Authentication**: Is Basic Auth with API Key/Secret the correct method?
   - Or should it be Header-based, JWT token, etc.?

6. **Test Card**: What test card numbers can we use in sandbox mode?
   - Example: `4242 4242 4242 4242` for Visa

## Next Steps

1. **Collect Error Details**: Run a payment and copy the error from backend logs
2. **Share Error**: Share the complete error message with the details above
3. **Fix Based on Error**: We'll update the code based on what the error tells us
4. **Re-test**: Test payment again with the updated code

## Debug Endpoint (For Advanced Users)

Once logged in as admin, you can test the payment processor directly:

```bash
curl -X POST http://localhost:5000/api/merchants/debug-beyondbancard-payment \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "your_api_key",
    "apiSecret": "your_api_secret",
    "mode": "sandbox",
    "amount": 1.00
  }'
```

This will test the BeyondBancard payment processor with a test payment and show detailed results.

