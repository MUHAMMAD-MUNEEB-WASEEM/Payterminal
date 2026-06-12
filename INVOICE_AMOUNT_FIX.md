# Invoice Amount 100x Multiplier Fix

## Problem
When creating invoices with small amounts, NMI was receiving 100x the intended amount:
- Entered: **$5** → NMI received: **$500**
- Entered: **$1** → NMI received: **$100**

## Root Cause
In `backend/src/utils/nmi-payment.js`, the amount was being multiplied by 100 to convert to cents:
```javascript
amount: (paymentData.amount * 100).toFixed(0), // WRONG - converts $5 to 50000 cents
```

However, NMI API accepts amounts in decimal dollars format (e.g., "5.00" or "1.00"), not cents. The multiplication was causing a 100x overcharge.

## Solution
Changed both payment request paths in `nmi-payment.js` to send amounts as strings in dollar format:

### Tokenized Payment (line ~97)
```javascript
// BEFORE
amount: (paymentData.amount * 100).toFixed(0),

// AFTER  
amount: String(paymentData.amount),
```

### Raw Card Payment (line ~201)
```javascript
// BEFORE
amount: (paymentData.amount * 100).toFixed(0),

// AFTER
amount: String(paymentData.amount),
```

## NMI API Format
NMI accepts amount in decimal dollars:
- `"5.00"` → $5.00 charge ✅
- `"1.50"` → $1.50 charge ✅
- `"500"` → $500.00 charge ❌ (what was happening before)

## Testing
After restart, test with:
1. Create invoice with **$5.00**
2. Go to payment page and verify amount shows as **$5.00**
3. Approve with test card: `4111 1111 1111 1111`
4. Expected: $5.00 charge in NMI ✅

## Files Changed
- `backend/src/utils/nmi-payment.js` (2 locations - tokenized and raw card paths)

## Status
✅ Fix applied and backend restarted
✅ Ready for testing
