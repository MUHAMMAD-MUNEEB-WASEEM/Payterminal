# Merchant Ticket Size Feature

## Overview
Added a "Ticket Size" limit to merchants. This controls the maximum amount allowed for a single invoice. If an invoice total meets or exceeds the ticket size, the Create Invoice button is disabled and a warning message is displayed.

## What is Ticket Size?
- **Ticket Size**: The maximum dollar amount for a single invoice/transaction
- If set to $5,000, no invoice can be created with a total ≥ $5,000
- Different from "Amount Limit" (cumulative total processed)

## Changes Made

### Backend Updates
**File: `backend/src/routes/merchants.js`**
- Added `ticketSize` field to merchant creation endpoint
- Added `ticketSize` to merchant update endpoint
- Included `ticketSize` in public merchants list (for invoice creation form)

### Frontend Updates

**File: `frontend/src/pages/Merchants.jsx`**
- Added "Ticket Size" input field to merchant creation/edit form
- Field is optional - leave empty for no limit
- Help text explains ticket size is max amount per invoice

**File: `frontend/src/pages/Invoices.jsx`**
- Added `ticketSizeError` state to track violations
- Added `useEffect` hook to check ticket size when total or brand changes
- When brand changes, fetches merchants and checks if invoice total exceeds any ticket size
- Displays red warning banner if violation detected
- Create Invoice button is disabled when ticket size error exists
- Warning shows: merchant name, current total, and ticket size limit

## User Experience

### Creating an Invoice
1. User selects a brand with merchant having $5,000 ticket size
2. User adds items totaling $4,500 → Create button is **enabled** ✅
3. User adds more items, total becomes $5,500 → Create button **disabled** ❌
4. Red warning banner appears:
   ```
   ⚠️ Ticket Size Limit Exceeded
   Invoice total (USD $5,500.00) exceeds the ticket size limit 
   (USD $5,000.00) for merchant [Name].
   
   Please reduce the invoice total to be less than the ticket size limit.
   ```
5. User must remove items to get back under $5,000

## Database Fields
```javascript
merchant: {
  _id: ObjectId,
  nickname: String,
  gateway: String,
  credentials: Object,
  amountLimit: Number,        // Total transaction limit
  ticketSize: Number,         // Per-invoice maximum
  processedAmount: Number,
  isActive: Boolean,
  createdAt: ISO Date,
  updatedAt: ISO Date
}
```

## Validation Rules
- Ticket Size is checked in **real-time** as user adds items
- Validation only applies when a brand with merchants is selected
- If multiple merchants assigned to brand with different ticket sizes:
  - Any merchant's ticket size violation blocks invoice creation
  - User must reduce total below ALL ticket sizes
- Setting ticket size to 0 or leaving empty = no limit

## Testing
1. Go to Merchants page
2. Create/Edit a merchant with Ticket Size = $1,000
3. Go to Invoices page
4. Create new invoice, select the merchant's brand
5. Add items totaling $900 → button enabled
6. Add items to reach $1,050 → button disabled, warning appears
7. Remove items to get back to $900 → button re-enables, warning disappears

## Future Enhancements
- Add ticket size to per-brand merchant settings
- Show ticket size info on payment page
- Add ticket size enforcement in payment processor
- Email notifications when ticket size limits approached
