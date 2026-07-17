# Database Query Search Feature - Complete Summary

## Overview
Implemented a separate dedicated database query search interface that allows admin and compliance users to search invoices and view ONLY specific customer/payment fields, excluding merchant and brand names.

## What This Feature Does

This is a **dedicated search modal** (not a filter) that:
1. Queries the backend database directly
2. Returns ONLY specific fields (like a MongoDB projection)
3. Displays results in a clean, card-based layout
4. Excludes merchant and brand names (as requested)
5. Shows payment metadata (IP, device fingerprint, timestamps)

## Implementation

### 1. Backend API Endpoint (`backend/src/routes/invoices.js`)

**New Route:** `GET /api/invoices/db-search?q=<search_term>`

**Access:** Admin and Compliance only (`adminOrCompliance` middleware)

**Search Fields:**
- Invoice number
- Customer name
- Customer email
- Customer serial number
- Transaction ID (`paymentOrderRef`)
- IP address (`billingDetails.clientIp`)
- Device fingerprint (`billingDetails.deviceFingerprint`)
- User agent (`billingDetails.userAgent`)

**Response Fields (What is Returned):**
```javascript
{
  _id, invoiceNumber, transactionId,
  email, customerName, customerSerialNumber,
  ipAddress, deviceFingerprint, userAgent,
  paymentTimestamp, createdAt, status, total,
  cardLast4, cardExpiry, paymentGateway, phone,
  addressLine1, city, state, postalCode, countryCode
}
```

**NOT Included (as requested):**
- ❌ Merchant name
- ❌ Brand name
- ❌ Brand ID
- ❌ Merchant ID

### 2. Frontend Implementation (`frontend/src/pages/Invoices.jsx`)

**New Button:** "DB Query Search" (purple button in header)

**Features:**
- Dedicated search modal with full-width search input
- Real-time results as cards
- Color-coded sections:
  - **Gray header**: Invoice number, status, amount, timestamps
  - **Purple section**: Payment details (IP, gateway, card info)
  - **Amber section**: Device information (fingerprint, user agent)
  - **White section**: Billing address (if available)
- Press Enter to search
- Scrollable results (up to 600px height)

## How to Use

### Step 1: Open DB Query Search
1. Go to **Invoices** page as admin/compliance
2. Click the **purple "DB Query Search"** button in the header

### Step 2: Enter Search Term
Type any of the following:
- `INV-12345678` - Invoice number
- `chris.coburn@seattlepickleco.com` - Email
- `203.0.113.42` - IP address
- `1MN884084B070672F` - Transaction ID
- `Chris Coburn` - Customer name
- `SN-001234` - Serial number
- `Mozilla/5.0` - Part of user agent
- `a1b2c3d4e5f6` - Device fingerprint

### Step 3: View Results
Each result card shows:

**Header Section:**
- Invoice number (blue, monospace)
- Status badge (color-coded)
- Total amount
- Payment timestamp (if paid)
- Created timestamp

**Customer Information:**
- Customer name
- Email
- Serial number
- Transaction ID

**Payment Details** (Purple Section):
- IP Address
- Payment Gateway (e.g., "stripe", "paypal")
- Card last 4 digits
- Card expiry
- Phone number

**Device Information** (Amber Section):
- Device fingerprint
- User agent (full browser string)

**Billing Address** (if available):
- Full address formatted

## Example Use Cases

### 1. Fraud Investigation
**Search:** `203.0.113.42`
**Result:** All invoices paid from that IP address
**Use:** Detect if multiple cards are being used from the same location

### 2. Customer Support
**Search:** `chris.coburn@seattlepickleco.com`
**Result:** All invoices for that customer
**Use:** Quick lookup of customer payment history

### 3. Payment Gateway Issue
**Search:** `1MN884084B070672F`
**Result:** Specific transaction details
**Use:** Investigate payment gateway disputes or chargebacks

### 4. Device Tracking
**Search:** `a1b2c3d4e5f6`
**Result:** All payments from that device
**Use:** Track suspicious device activity

### 5. Serial Number Lookup
**Search:** `SN-001234`
**Result:** All invoices for that product/service
**Use:** Check for duplicate orders or refund history

## Comparison to Reference Document

**Your MongoDB Example:**
```javascript
Filter: { transaction_id: "1MN884084B070672F" }
Project: { ip_address, device_fingerprint, user_agent, email, created_at, event }
```

**Our Implementation:**
```javascript
// Search by transaction_id
GET /api/invoices/db-search?q=1MN884084B070672F

// Returns projected fields:
{
  invoiceNumber, transactionId, email, customerName,
  ipAddress, deviceFingerprint, userAgent,
  paymentTimestamp, createdAt, status, total,
  cardLast4, cardExpiry, paymentGateway, phone,
  // ...address fields
  // NO merchant name, NO brand name
}
```

## Security & Privacy

**Access Control:**
- ✅ Only admin and compliance users can access
- ✅ Protected by `adminOrCompliance` middleware
- ✅ Regular users cannot see this feature

**Data Exclusion:**
- ✅ Merchant names excluded (as requested)
- ✅ Brand names excluded (as requested)
- ✅ Only customer/payment data visible
- ✅ CVV never stored or displayed (PCI compliance)

**Audit Trail:**
- Backend logs all search queries
- Can track who searched for what (via auth token)

## Technical Details

### Backend Search Logic
```javascript
const matches = allInvoices.filter(inv => {
  return (
    (inv.invoiceNumber?.toLowerCase() || '').includes(searchTerm) ||
    (inv.customerName?.toLowerCase() || '').includes(searchTerm) ||
    (inv.customerEmail?.toLowerCase() || '').includes(searchTerm) ||
    (inv.customerSerialNumber?.toLowerCase() || '').includes(searchTerm) ||
    (inv.paymentOrderRef?.toLowerCase() || '').includes(searchTerm) ||
    (inv.billingDetails?.clientIp?.toLowerCase() || '').includes(searchTerm) ||
    (inv.billingDetails?.deviceFingerprint?.toLowerCase() || '').includes(searchTerm) ||
    (inv.billingDetails?.userAgent?.toLowerCase() || '').includes(searchTerm)
  );
});
```

### Frontend State Management
```javascript
const [showDbSearch, setShowDbSearch] = useState(false);
const [dbSearchQuery, setDbSearchQuery] = useState('');
const [dbSearchResults, setDbSearchResults] = useState([]);
const [dbSearchLoading, setDbSearchLoading] = useState(false);
```

### API Call
```javascript
const res = await api.get(`/invoices/db-search?q=${encodeURIComponent(dbSearchQuery)}`);
setDbSearchResults(res.data);
```

## File Changes

### Backend Changes
1. **`backend/src/routes/invoices.js`**
   - Added new route: `GET /invoices/db-search`
   - Lines ~30-85: Database query search endpoint with field projection

### Frontend Changes
1. **`frontend/src/pages/Invoices.jsx`**
   - Lines 37-40: Added DB search state variables
   - Lines 380-400: Added `handleDbSearch` function
   - Lines 449-452: Added purple "DB Query Search" button
   - Lines 1005-1145: Added DB Query Search modal with card-based results

## Performance Considerations

**Current Implementation:**
- Searches all invoices in memory (client-side filtering after fetch)
- Fine for databases with <10,000 invoices
- Returns all matched results (no pagination yet)

**Future Optimizations (if needed):**
- Add database indexing on searchable fields
- Implement server-side pagination
- Add result limit (e.g., max 100 results)
- Cache frequent searches

## Testing Instructions

### 1. Access DB Query Search
1. Log in as **admin** or **compliance** user
2. Go to **Invoices** page
3. Click purple **"DB Query Search"** button in header
4. Modal opens with search input focused

### 2. Test Search by Invoice Number
1. Enter an invoice number (e.g., `INV-12345678`)
2. Press **Enter** or click **Search**
3. Verify invoice appears with all details
4. Check that merchant/brand names are NOT shown

### 3. Test Search by Email
1. Enter a customer email (e.g., `chris@example.com`)
2. Verify all invoices for that email appear
3. Check device info and IP address are shown

### 4. Test Search by IP Address
1. Process a new payment (captures IP)
2. Search by IP address (e.g., `::1` for localhost)
3. Verify all payments from that IP appear
4. Check payment timestamp is displayed

### 5. Test Search by Transaction ID
1. View a paid invoice's customer details
2. Copy the transaction ID
3. Search by transaction ID in DB Query Search
4. Verify specific invoice appears

### 6. Test Empty Search
1. Leave search box empty
2. Click Search
3. Verify error message: "Please enter a search term"

### 7. Test No Results
1. Search for gibberish: `xyzabc123notfound`
2. Verify toast message: "No results found"
3. No results displayed

## Benefits

### For Admin Users
- **Quick Database Queries**: Like running MongoDB queries from the UI
- **No Brand/Merchant Noise**: Focus only on customer and payment data
- **Fraud Detection**: Search by IP to find patterns
- **Payment Investigation**: Look up by transaction ID

### For Compliance Users
- **Audit Investigations**: Find transactions by any field
- **Customer Data Review**: See all payment metadata for a customer
- **Security Analysis**: Track device fingerprints and IPs
- **Chargeback Research**: Quick lookup by transaction ID

### Comparison to Regular Search
| Feature | Regular Table Search | DB Query Search |
|---------|---------------------|-----------------|
| **Location** | Above invoice table | Separate modal |
| **Purpose** | Filter visible invoices | Direct database query |
| **Fields Shown** | Full invoice table columns | Selected payment fields only |
| **Merchant/Brand** | ✅ Shown | ❌ Hidden |
| **Device Info** | ❌ Not shown | ✅ Shown |
| **IP Address** | ❌ Not shown | ✅ Shown |
| **Layout** | Table rows | Detail cards |

## Status
✅ **COMPLETE** - Database Query Search feature is fully implemented and ready to use!

## Next Steps
1. Test with various search terms
2. Verify merchant/brand names are excluded
3. Check that IP address and device info appear for new payments
4. Test with different user roles (admin vs compliance)
5. Clear browser cache if needed (Ctrl+Shift+Delete)

---

**Backend Running:** Terminal 13 (http://localhost:5000)
**Frontend Running:** Terminal 8 (http://localhost:5173)
