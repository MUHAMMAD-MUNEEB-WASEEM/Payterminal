# Merchant Amount Limit Feature

## Overview
The merchant amount limit feature allows admins to set processing limits for each payment merchant. When a merchant reaches its limit, it automatically becomes unavailable for new payments, and the system fails over to the next available merchant in the brand's merchant list.

## Key Features

### 1. Amount Limit Configuration
- **Location**: Merchants page → Add/Edit Merchant
- **Field**: "Amount Limit (USD)" - optional field
- **Behavior**: 
  - Leave empty for unlimited processing
  - Set a dollar amount (e.g., 10000.00) to cap total processed payments
  - Can be edited at any time

### 2. Real-Time Tracking
- **Processed Amount**: Automatically increments with each successful payment
- **Visual Progress Bar**: 
  - Green: < 80% of limit
  - Yellow: 80-99% of limit
  - Red: 100% (limit reached)
- **Remaining Amount**: Shows how much capacity is left
- **Reset Button**: Admin can reset processed amount to $0.00

### 3. Automatic Failover
When multiple merchants are assigned to a brand:
1. Merchants are ordered by assignment date (first assigned = first priority)
2. System uses the first merchant that hasn't reached its limit
3. When Merchant A reaches limit:
   - Admin receives notification
   - Merchant A is automatically skipped
   - System switches to Merchant B
   - Process continues with remaining merchants

### 4. Admin Notifications
- **Trigger**: When a merchant reaches its amount limit
- **Location**: Bell icon in top navigation bar
- **Content**: "Merchant '[nickname]' has reached its amount limit of $[amount]"
- **Actions**: 
  - Mark as read
  - Delete notification
  - Mark all as read
- **Auto-refresh**: Checks for new notifications every 30 seconds

### 5. Payment Processing Logic
```
1. Customer verifies identity
2. System fetches merchants for brand (ordered by priority)
3. Filter out merchants that reached limit
4. Auto-select first available merchant
5. Process payment
6. Update merchant's processed amount
7. Check if limit reached → create notification if yes
```

## Database Schema

### Merchants Collection
```javascript
{
  _id: string,
  nickname: string,
  gateway: 'stripe' | 'paypal' | 'authorize',
  credentials: object,
  amountLimit: number | null,      // NEW: Max amount in USD
  processedAmount: number,          // NEW: Total processed so far
  isActive: boolean,
  createdAt: string,
  updatedAt: string
}
```

### Notifications Collection
```javascript
{
  _id: string,
  type: 'merchant_limit_reached',
  merchantId: string,
  merchantNickname: string,
  amountLimit: number,
  processedAmount: number,
  message: string,
  read: boolean,
  createdAt: string
}
```

## API Endpoints

### Merchants
- `POST /api/merchants` - Create merchant (with optional amountLimit)
- `PATCH /api/merchants/:id` - Update merchant (including amountLimit, processedAmount)
- `GET /api/merchants/brand/:brandId/public` - Get available merchants (filters by limit)

### Notifications
- `GET /api/notifications` - Get all notifications (admin only)
- `GET /api/notifications/unread-count` - Get unread count (admin only)
- `PATCH /api/notifications/:id/read` - Mark as read (admin only)
- `POST /api/notifications/mark-all-read` - Mark all as read (admin only)
- `DELETE /api/notifications/:id` - Delete notification (admin only)

## Usage Examples

### Example 1: Single Merchant with Limit
```
Brand: USPTO Office #1
Merchant: Stripe Main (Limit: $5,000)

Payment Flow:
- Invoice $100 → Stripe Main (Processed: $100)
- Invoice $200 → Stripe Main (Processed: $300)
- ... continues until $5,000
- Invoice $100 → ERROR: No merchants available
- Admin receives notification
- Admin resets processed amount or adds new merchant
```

### Example 2: Multiple Merchants with Failover
```
Brand: USPTO Office #2
Merchants:
  1. Stripe Primary (Limit: $10,000) - Assigned first
  2. PayPal Backup (Limit: $5,000) - Assigned second
  3. Authorize.net Reserve (No limit) - Assigned third

Payment Flow:
- Invoices 1-50 → Stripe Primary (Total: $10,000) ✓
- Invoice 51 → Stripe Primary SKIPPED (limit reached)
           → PayPal Backup (Total: $200) ✓
- Admin notified: "Stripe Primary reached $10,000 limit"
- Invoices 52-100 → PayPal Backup (Total: $5,000) ✓
- Invoice 101 → PayPal Backup SKIPPED (limit reached)
            → Authorize.net Reserve ✓
- Admin notified: "PayPal Backup reached $5,000 limit"
- All future invoices → Authorize.net Reserve (unlimited)
```

## Admin Workflow

### Setting Up Limits
1. Go to Merchants page
2. Click "Add Merchant" or "Edit" existing merchant
3. Fill in gateway credentials
4. Set "Amount Limit (USD)" (e.g., 10000.00)
5. Save merchant
6. Assign merchant to brands

### Monitoring Usage
1. View Merchants page
2. Check progress bars on each merchant card
3. Green = healthy, Yellow = approaching limit, Red = limit reached
4. Click bell icon to see limit notifications

### Resetting Limits
1. Go to Merchants page
2. Find merchant with processed amount
3. Click "Reset" button below progress bar
4. Confirm reset
5. Processed amount returns to $0.00

### Managing Failover
1. Assign multiple merchants to a brand (in priority order)
2. Set limits on each merchant
3. System automatically uses next available merchant
4. Monitor notifications for limit alerts
5. Reset or add new merchants as needed

## Testing

### Test Scenario 1: Limit Reached
1. Create merchant with $100 limit
2. Assign to brand
3. Create invoice for $50 → Pay successfully
4. Create invoice for $60 → Pay successfully
5. Check merchant: Processed = $110, Limit reached
6. Create invoice for $10 → Should fail (no merchants available)
7. Check notifications: Should see limit alert

### Test Scenario 2: Automatic Failover
1. Create Merchant A with $100 limit
2. Create Merchant B with $200 limit
3. Assign both to same brand (A first, then B)
4. Pay invoice $100 → Uses Merchant A
5. Pay invoice $50 → Uses Merchant B (A reached limit)
6. Check notifications: Alert for Merchant A

## Notes
- Limits are checked BEFORE payment processing
- Processed amounts update AFTER successful payment
- Notifications are created immediately when limit reached
- Reset does not affect historical invoice records
- Unlimited merchants (no limit set) never get skipped
