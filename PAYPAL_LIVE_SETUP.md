# PayPal Live Card Processing Setup

## Overview
The PayPal payment processor now supports **live card processing** using the official PayPal Checkout SDK. This allows you to accept real credit card payments directly.

## Prerequisites

### 1. PayPal Business Account
- Go to https://www.paypal.com/business
- Sign up for a Business account if you don't have one
- Verify your email and complete KYC (Know Your Customer) verification

### 2. API Signature / Certificates
You need to obtain your PayPal API credentials:

#### Step 1: Go to PayPal Developer Dashboard
1. Visit https://developer.paypal.com/
2. Log in with your PayPal account
3. Click on **Settings** (gear icon)
4. Select **API Signature** or **API Certificate**

#### Step 2: Get Your Credentials
For **API Signature** (Recommended):
1. Go to **API Signature** tab
2. Select **Signature** from dropdown
3. You'll see:
   - **API Username** (Merchant ID)
   - **API Password**
   - **Signature**

For **OAuth 2.0 Credentials** (Newer approach):
1. Go to **API Signature** tab
2. Select **REST API apps**
3. Click **Create App**
4. You'll get:
   - **Client ID**
   - **Client Secret**

### 3. Obtain Your Client ID and Secret

The current implementation uses **OAuth 2.0 (Client ID + Secret)**, which is the modern approach:

**For Live Credentials:**
1. Go to https://developer.paypal.com/dashboard/
2. Log in with your PayPal account
3. Select **Live** environment (top of page)
4. Go to **Apps & Credentials**
5. Click **Create App** under "REST API apps"
6. Enter an app name (e.g., "Payterminal")
7. Copy your:
   - **Client ID**
   - **Client Secret**

**For Sandbox Testing (Before Going Live):**
1. Go to https://developer.paypal.com/dashboard/
2. Log in with your PayPal account
3. Select **Sandbox** environment
4. Go to **Apps & Credentials**
5. Click **Create App**
6. Copy your sandbox **Client ID** and **Client Secret**

## Configuration

### 1. Set Environment Variables

In your `.env` file (or backend `.env`):

```env
# PayPal - LIVE
PAYPAL_MODE=live
PAYPAL_CLIENT_ID=your_live_client_id_here
PAYPAL_CLIENT_SECRET=your_live_client_secret_here

# OR for Sandbox Testing:
# PAYPAL_MODE=sandbox
# PAYPAL_CLIENT_ID=your_sandbox_client_id_here
# PAYPAL_CLIENT_SECRET=your_sandbox_client_secret_here
```

### 2. Create PayPal Merchant in Admin Panel

1. Go to **Admin Dashboard** → **Merchants**
2. Click **Add Merchant**
3. Fill in the form:
   - **Nickname**: "PayPal" or "PayPal Live"
   - **Gateway**: Select "paypal"
   - **Mode**: Select "live" (or "sandbox" for testing)
   - **Client ID**: Paste your PayPal Client ID
   - **Client Secret**: Paste your PayPal Client Secret
4. Click **Save**

### 3. Assign to Brand

1. Go to **Admin Dashboard** → **Brands**
2. Select your brand
3. Click **Add Payment Method** or **Assign Merchant**
4. Select the PayPal merchant you just created
5. Optionally set as **Default** payment method

## Testing Payments

### Sandbox Mode (Recommended Before Live)

When `PAYPAL_MODE=sandbox`:

**Test Cards:**
- **Visa**: 4111111111111111 (CVV: 123, Expiry: 12/2025)
- **Mastercard**: 5555555555554444 (CVV: 123, Expiry: 12/2025)
- **Amex**: 378282246310005 (CVV: 1234, Expiry: 12/2025)
- **Discover**: 6011111111111117 (CVV: 123, Expiry: 12/2025)

All amounts work. Transactions won't be charged to actual cards.

### Live Mode (Real Payments)

When `PAYPAL_MODE=live`:

**Real Credit Cards:**
- Use actual Visa, Mastercard, American Express, or Discover cards
- Real charges will be made to the cardholder
- Transactions appear in your PayPal account

**⚠️ WARNING**: Only enable live mode when:
- You've tested thoroughly in sandbox
- Your PayPal account is fully verified
- You understand the fees (typically 2.9% + $0.30 per transaction)
- You have proper business insurance

## How It Works

1. **Invoice Created**: Admin creates invoice with amount
2. **Customer Pays**: Customer enters card details on payment page
3. **Request Sent**: Card data sent securely to PayPal
4. **PayPal Processes**: PayPal validates card and charges cardholder
5. **Invoice Updated**: Invoice marked as "paid" upon success
6. **Funds Settle**: PayPal deposits funds to your bank account (usually 24-48 hours)

## Transaction Flow

```
Customer Card Input
        ↓
Backend validates card format
        ↓
PayPal API: Create Order
        ↓
PayPal API: Capture Payment
        ↓
Success: Invoice marked PAID
        ↓
Funds settle to your PayPal account
```

## Fees

- **Transaction Fee**: 2.9% + $0.30 per transaction
- **Example**: $100 payment costs $3.20 in fees
- Fees are deducted before funds appear in your account

## Troubleshooting

### "Invalid Client ID/Secret"
- Verify credentials are copied correctly
- Ensure you're using the right environment (Live vs Sandbox)
- Check that credentials haven't been revoked in PayPal dashboard

### "Card Declined"
- Verify card number, expiry, CVV are correct
- In sandbox, use provided test cards
- In live, ensure card hasn't exceeded limit

### "Amount format error"
- Amounts must be sent as decimal strings (e.g., "10.50" not "1050")
- This is handled automatically by the processor

### Payment captured but invoice not updated
- Check backend logs: `backend/logs/payment-route.log`
- Verify invoice ID is correct
- Ensure database connection is working

## Support

For PayPal API issues:
- PayPal Developer Support: https://developer.paypal.com/support/
- Technical Documentation: https://developer.paypal.com/docs/
- API Reference: https://developer.paypal.com/docs/api/

For issues with this implementation:
- Check backend logs
- Verify merchant configuration
- Test with sandbox credentials first
