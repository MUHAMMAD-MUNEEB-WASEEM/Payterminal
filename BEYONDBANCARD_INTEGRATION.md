# BeyondBancard Payment Gateway Integration

## Overview
BeyondBancard has been successfully integrated into PayTerminal as a payment gateway option alongside Stripe, PayPal, and Authorize.net.

## Features

### Admin Dashboard
1. **Add BeyondBancard Merchant**
   - Navigate to Merchants page
   - Click "Add Merchant"
   - Select "BeyondBancard" from Gateway dropdown
   - Enter merchant nickname (e.g., "Main BeyondBancard Account")

2. **Configure Credentials**
   - **API Key**: Your BeyondBancard API Key (found in dashboard)
   - **API Secret**: Your BeyondBancard API Secret (keep secure)
   - **Mode**: Choose between Sandbox (test) or Live (production)

3. **Test Credentials**
   - Click "🧪 Test Credentials" button
   - System verifies your credentials are valid
   - Shows success/error message

4. **Amount Limits** (optional)
   - Set maximum processing amount per merchant
   - Auto-failover when limit reached
   - Admin receives notification when limit reached

5. **Brand Assignment**
   - Assign BeyondBancard merchant to specific brands
   - Multiple merchants can be assigned to one brand
   - Automatic failover if first merchant reaches limit

### Payment Processing

When customers pay invoices:
1. Customer verifies their details
2. System selects appropriate merchant (considers amount limits)
3. Card details are securely sent to BeyondBancard API
4. Payment is processed in test or live mode
5. Transaction ID is recorded
6. Invoice status updated to "paid"

### Error Handling
- **Invalid Credentials**: Returns 401 auth error
- **Declined Payment**: Returns 402 payment declined error
- **Invalid Payment Data**: Returns 400 bad request error
- **Network Errors**: Gracefully handled with retry capability

## Backend Implementation

### New Files
- `backend/src/utils/beyondbancard.js` - BeyondBancard payment processor

### Updated Files
- `backend/src/routes/invoices.js` - Added beyondbancard case to payment processor
- `backend/src/routes/merchants.js` - Added beyondbancard gateway validation and test endpoint

### API Endpoints

#### Process Payment
```
POST /public/:invoiceId/pay
{
  cardNumber: "4242...",
  cardHolder: "John Doe",
  expiryMonth: "12",
  expiryYear: "2025",
  cvv: "123",
  merchantId: "merchant_id"
}
```

#### Test BeyondBancard Credentials
```
POST /merchants/test-beyondbancard
{
  apiKey: "your_api_key",
  apiSecret: "your_api_secret",
  mode: "sandbox" | "live"
}
```

## Frontend Implementation

### Merchants Page Updates
- Added BeyondBancard icon (🏦) 
- Added BeyondBancard option to gateway dropdown
- Added form fields for API Key and API Secret
- Added test credentials button for validation
- Added helper text with documentation links

### User Interface
1. Clear form labels with explanations
2. Password fields for sensitive data (API Secret)
3. Mode selector (Sandbox/Live)
4. Inline validation and testing
5. Success/error toast notifications

## API Endpoint Configuration

The BeyondBancard utility expects:

**Sandbox Endpoint**: `https://sandbox-api.beyondbancard.com/v1`
**Live Endpoint**: `https://api.beyondbancard.com/v1`

To update endpoints, modify `/backend/src/utils/beyondbancard.js`:
```javascript
const BEYONDBANCARD_API_ENDPOINT = 'https://api.beyondbancard.com/v1';
const BEYONDBANCARD_SANDBOX_ENDPOINT = 'https://sandbox-api.beyondbancard.com/v1';
```

## Payment Request Format

BeyondBancard expects payments in the following format:
```json
{
  "amount": 1000,
  "currency": "USD",
  "card": {
    "number": "4242424242424242",
    "name": "John Doe",
    "expiryMonth": "12",
    "expiryYear": "2025",
    "cvv": "123"
  },
  "description": "Invoice INV-XXXXXXXX",
  "reference": "TXN-1234567890",
  "metadata": {
    "integration": "PayTerminal"
  }
}
```

## Response Format

Success Response:
```json
{
  "success": true,
  "transactionId": "txn_xxxxx",
  "message": "Payment processed successfully",
  "authCode": "auth_code",
  "reference": "TXN-1234567890"
}
```

Error Response:
```json
{
  "success": false,
  "error": "Payment declined",
  "errorCode": "PAYMENT_DECLINED"
}
```

## Getting BeyondBancard Credentials

1. Create account at https://beyondbancard.com
2. Navigate to Dashboard > API Settings
3. Generate API Key and Secret
4. Copy both into PayTerminal merchant form

## Testing

### Test Credentials
Use the test credentials provided by BeyondBancard for sandbox testing.

### Test Cards
Contact BeyondBancard support for test card numbers.

### Sandbox vs Live
- **Sandbox**: For testing - transactions are not real
- **Live**: For production - requires live credentials

## Troubleshooting

### "Invalid API credentials"
- Verify API Key and Secret are correct
- Check if credentials are for correct environment (test vs live)
- Ensure credentials haven't expired

### "Payment declined"
- Verify card details are correct
- Check card is not expired
- Ensure card supports USD currency
- Check if amount exceeds card limit

### "Network error"
- Verify BeyondBancard API endpoint is accessible
- Check internet connection
- Retry payment after a few seconds

## Support

For BeyondBancard API support, visit: https://beyondbancard.com/support

## Notes

- Amounts are converted to cents before sending to BeyondBancard
- All transactions include metadata for tracking
- Unique transaction reference (TXN-timestamp) for each payment
- Merchant limit system supports BeyondBancard merchants
- Refund and chargeback tracking applies to all gateways including BeyondBancard
