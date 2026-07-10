# NMI Duplicate Transaction Fix

## Issue
NMI Gateway was returning the error:
```
Payment error - Duplicate transaction REFID:92428776
```

## Root Cause
NMI uses the `order_id` field to detect and prevent duplicate transactions. When a payment fails and the customer retries, the same invoice number was being sent as the `order_id`, causing NMI to reject it as a duplicate.

## Solution
Modified the `order_id` to include a timestamp, making it unique for each payment attempt while still maintaining the invoice reference.

### Changes Made

#### NMI Payment Utility (`backend/src/utils/nmi-payment.js`)

**Before:**
```javascript
order_id: paymentData.description,  // e.g., "Invoice INV-ABC123"
```

**After:**
```javascript
order_id: `${paymentData.description}-${Date.now()}`,  // e.g., "Invoice INV-ABC123-1704848400000"
```

This was applied to both:
1. Tokenized payment requests (Collect.js)
2. Raw card payment requests

## Benefits
- ✅ Allows customers to retry failed payments without duplicate transaction errors
- ✅ Each payment attempt gets a unique order_id
- ✅ Still maintains invoice reference in the order_id for tracking
- ✅ The `order_description` field still contains the original invoice number for reference

## Example
If invoice `INV-ABC123` has multiple payment attempts:
- First attempt: `order_id = "Invoice INV-ABC123-1704848400000"`
- Retry attempt: `order_id = "Invoice INV-ABC123-1704848500000"`
- Each gets a unique identifier, preventing duplicate detection

## Testing
1. Navigate to an invoice payment page
2. Attempt a payment (it can fail or succeed)
3. Try to pay the same invoice again
4. The second payment should not throw a "Duplicate transaction" error

## Impact
- ✅ Customers can retry payments without errors
- ✅ NMI accepts multiple payment attempts for the same invoice
- ✅ No change to the order description (still shows invoice number)
- ✅ Timestamp ensures uniqueness across all payment attempts
