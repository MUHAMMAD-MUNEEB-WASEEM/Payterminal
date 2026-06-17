# PayPal Payment Testing Guide

## Current Status
PayPal integration is set to **test mode only** for now. Direct card processing requires additional PayPal API setup.

## Test Cards for PayPal

Use these test card numbers to process payments successfully:

### Visa
- **Card Number**: `4242 4242 4242 4242`
- **Expiry**: Any future date (e.g., 12/2025)
- **CVV**: Any 3 digits (e.g., 123)

### Mastercard
- **Card Number**: `5555 5555 5555 4444`
- **Expiry**: Any future date (e.g., 12/2025)
- **CVV**: Any 3 digits (e.g., 123)

### American Express
- **Card Number**: `3782 822463 10005`
- **Expiry**: Any future date (e.g., 12/2025)
- **CVV**: Any 4 digits (e.g., 1234)

### Generic Test Card
- **Card Number**: `4111 1111 1111 1111`
- **Expiry**: Any future date (e.g., 12/2025)
- **CVV**: Any 3 digits (e.g., 123)

## How It Works

1. When you create an invoice and select PayPal as the payment method
2. Enter one of the test card numbers above
3. The payment will be processed successfully with a test transaction ID
4. The invoice status will change to "paid"

## Why This Limitation?

PayPal's direct card processing (also called "card on file" or "vault") requires:
- Additional API permissions
- Special merchant account approval
- PCI compliance certification
- Specific OAuth scopes

For production use, PayPal typically uses:
1. **PayPal Checkout** - Redirect to PayPal login (recommended)
2. **PayPal Commerce Platform** - Full integration suite
3. **Braintree** - PayPal's payment processing solution

## Testing All Gateways

When testing your invoice payment system:
- **Stripe**: Use `4242 4242 4242 4242` (or other Stripe test cards)
- **PayPal**: Use cards listed above (test mode only)
- **Authorize.net**: Use `4007000000027` (sandbox mode)
- **BeyondBancard (NMI)**: Use `4007000000027` (test mode)

## Future Enhancement

To enable live PayPal card processing:
1. Contact PayPal merchant support
2. Request "Direct Card Processing" capability
3. Update merchant credentials with special API tokens
4. Modify `backend/src/utils/paypal.js` to use PayPal SDK

For now, test cards work perfectly for development and testing.
