# Billing Details Route Fix

## Issue
Getting "Failed to load billing details" error when clicking the User icon button to view customer details for paid invoices.

## Root Cause
The Express route `/invoices/:id/billing` was being caught by the generic `/:id` route handler before it could be processed. In Express, routes are matched in the order they're defined, so a generic `:id` parameter route will match before more specific sub-routes if defined before them.

## Solution
Reordered routes in `/backend/src/routes/invoices.js`:

### Before (Incorrect Order):
```
router.get('/:id', ...)           // Line 442 - Matches /invoices/<id> first!
router.post('/:id/pay', ...)
router.get('/:id/status', ...)
...
router.get('/:id/billing', ...)   // Line 734 - Never reached because /:id already matched
```

### After (Correct Order):
```
router.get('/:id/status', ...)    // Specific routes first
router.get('/:id/billing', ...)   // These match before the generic :id
router.get('/:id', ...)           // Generic route comes last
router.post('/:id/pay', ...)
router.patch('/:id/status', ...)
router.patch('/:id/refund', ...)
router.patch('/:id/reverse', ...)
router.patch('/:id/undo', ...)
router.patch('/:id/chargeback', ...)
router.delete('/:id', ...)
```

## Changes Made

### Backend (`/backend/src/routes/invoices.js`)
1. Moved `router.get('/:id/status', ...)` to line ~443 (before generic `:id`)
2. Moved `router.get('/:id/billing', ...)` to line ~470 (before generic `:id`)
3. Kept generic `router.get('/:id', ...)` at line ~510 (after specific routes)
4. Removed duplicate `/:id/billing` route that was at the end
5. Added console logging to billing endpoint for debugging:
   - Logs when request is received
   - Logs when invoice is found/not found
   - Logs before sending response

### Frontend (`/frontend/src/pages/Invoices.jsx`)
1. Enhanced `handleViewBillingDetails` function with debug logging:
   - Logs when fetching starts
   - Logs successful response
   - Logs error details with status code

## Testing the Fix

To verify the fix is working:

1. **Ensure a paid invoice exists** - Process a test payment first
2. **Click the User icon** on any paid invoice in the Invoices table
3. **Check browser console** for logs showing:
   - "📋 Fetching billing details for invoice: [invoiceId]"
   - "✅ Billing details response: [data]"
4. **The modal should appear** showing all customer details:
   - Customer name, email, serial number
   - Billing address (street, city, state, zip)
   - Card information (last 4 digits, cardholder name, gateway)
   - Brand information

## How It Works

**Data Flow:**
1. User clicks User icon button for paid invoice
2. Frontend calls `GET /api/invoices/{id}/billing` 
3. Backend finds invoice by ID
4. Backend populates brand info using `withBrand()` function
5. Backend returns JSON with all stored customer/billing data
6. Frontend displays modal with formatted details

**What Data is Stored:**
When a payment is successfully processed, the backend stores:
```javascript
billingDetails: {
  firstName,
  lastName,
  companyName,
  addressLine1,
  addressLine2,
  city,
  state,
  postalCode,
  countryCode,
  cardholderName,
  cardLast4,            // Only last 4 digits for security
  paymentGateway        // stripe, paypal, authorize, beyondbancard
}
```

## Security Notes
- ✅ Full card numbers are NOT stored (only last 4 digits)
- ✅ Endpoint requires `auth` middleware + `adminOnly` check
- ✅ Only admins can view customer billing details
- ✅ All data is encrypted in transit (HTTPS in production)

## Next Steps
1. Restart backend server
2. Try clicking the User icon again on a paid invoice
3. Monitor backend logs at `backend/logs/payment-route.log`
4. Check browser console for any remaining errors
