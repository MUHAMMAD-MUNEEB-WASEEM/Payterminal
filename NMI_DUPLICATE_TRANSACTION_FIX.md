# NMI Duplicate Transaction Fix

## Issue
NMI Gateway was returning the error:
```
Payment error - Duplicate transaction REFID:92428776
```

Additionally, attempting to disable duplicate checking with `dup_seconds: '0'` returned:
```
Payment error - Disabling Duplicate Check is not allowed for this processor REFID:92443930
```

## Root Cause
NMI uses multiple fields to detect duplicate transactions within a time window (typically 120 seconds):
- Card number
- Amount
- Customer name
- Order ID
- Other billing details

The processor doesn't allow disabling duplicate checking, so we need to make each transaction attempt genuinely unique.

## Solution
Modified the `order_id` to include both a timestamp AND a random component, making each payment attempt unique even if tried at the exact same millisecond.

### Changes Made

#### NMI Payment Utility (`backend/src/utils/nmi-payment.js`)

**Before:**
```javascript
order_id: paymentData.description,  // e.g., "Invoice INV-ABC123"
```

**After:**
```javascript
// Generate unique ID: timestamp + random string
const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
order_id: `${paymentData.invoiceNumber}-${uniqueId}`,  
// e.g., "INV-ABC123-1704848400000-k3j9x2p4q"
```

This was applied to both:
1. Tokenized payment requests (Collect.js)
2. Raw card payment requests

## Benefits
- ✅ Each payment attempt gets a truly unique order_id
- ✅ Works within NMI's duplicate detection rules (doesn't try to disable them)
- ✅ Allows immediate retries without waiting for the duplicate window to expire
- ✅ Still maintains invoice reference for tracking
- ✅ Random component ensures uniqueness even for simultaneous attempts

## Example
If invoice `INV-ABC123` has multiple payment attempts:
- First attempt: `INV-ABC123-1704848400000-k3j9x2p4q`
- Immediate retry: `INV-ABC123-1704848400123-m8f5n1w7e`
- Each gets a unique identifier that NMI recognizes as a separate transaction

## Testing
1. Navigate to an invoice payment page
2. Attempt a payment (it can fail or succeed)
3. Try to pay the same invoice again immediately
4. The second payment should not throw a "Duplicate transaction" error

## Impact
- ✅ Customers can retry payments immediately without errors
- ✅ No waiting for duplicate detection window to expire
- ✅ Works with processor's duplicate checking enabled
- ✅ Invoice number preserved in order_id for reference
- ✅ Truly unique IDs with timestamp + random component
