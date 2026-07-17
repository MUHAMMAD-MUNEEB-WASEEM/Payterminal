# Merchant Information in Customer Details

## 🎯 Feature Overview
Added merchant nickname and gateway information to the "Customer & Payment Details" modal that opens when clicking the User icon (👤) in the invoice table's Actions column.

---

## ✅ Implementation Complete

### Changes Made

#### 1. Backend - Invoice Routes (`backend/src/routes/invoices.js`)

**Endpoint**: `GET /api/invoices/:id/billing`

**Updated to include merchant information**:
```javascript
// Get merchant information if available
let merchant = null;
if (invoice.selectedMerchantId) {
  merchant = await db.merchants.findOne({ _id: invoice.selectedMerchantId });
  if (merchant) {
    merchant = {
      nickname: merchant.nickname,
      gateway: merchant.gateway
    };
  }
}

// Return invoice with billing details and merchant info
const response = {
  invoiceId: invoice._id,
  invoiceNumber: invoice.invoiceNumber,
  customerName: invoice.customerName,
  customerEmail: invoice.customerEmail,
  customerSerialNumber: invoice.customerSerialNumber,
  amount: invoice.total,
  status: invoice.status,
  billingDetails: invoice.billingDetails || null,
  paymentDate: invoice.updatedAt,
  brand: result.brand,
  merchant: merchant  // ← NEW: Merchant info added
};
```

#### 2. Frontend - Invoices Page (`frontend/src/pages/Invoices.jsx`)

**Added merchant display section in the Customer & Payment Details modal**:
```jsx
{/* Merchant Info */}
{billingDetails.merchant && (
  <div className="bg-purple-50 rounded-lg p-4">
    <h3 className="text-sm font-semibold text-gray-700 mb-2">Payment Merchant</h3>
    <div className="grid grid-cols-2 gap-2 text-sm">
      <div>
        <p className="text-gray-600">Merchant Name</p>
        <p className="font-medium text-gray-900">{billingDetails.merchant.nickname}</p>
      </div>
      <div>
        <p className="text-gray-600">Gateway</p>
        <p className="font-medium capitalize text-gray-900">{billingDetails.merchant.gateway}</p>
      </div>
    </div>
  </div>
)}
```

**Position**: Right after "Invoice Information" section and before "Customer Information"

---

## 🎨 UI Display

### Customer & Payment Details Modal Layout

```
┌─────────────────────────────────────────┐
│  Customer & Payment Details         [X] │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Invoice Information             │   │
│  │ (Blue background)               │   │
│  │ - Invoice #, Amount, Status     │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Payment Merchant                │ ← NEW
│  │ (Purple background)             │   │
│  │ - Merchant Name: Main Stripe    │   │
│  │ - Gateway: stripe               │   │
│  └─────────────────────────────────┘   │
│                                         │
│  👤 Customer Information               │
│  - Name, Email, Serial Number          │
│                                         │
│  📍 Billing Address                    │
│  (if available)                        │
│                                         │
│  💳 Card Information                   │
│  (if available)                        │
│                                         │
│  Brand Information                     │
│  (if available)                        │
│                                         │
└─────────────────────────────────────────┘
```

---

## 📊 Data Flow

1. **User clicks User icon (👤)** in invoice table Actions column
2. **Frontend calls**: `GET /api/invoices/:id/billing`
3. **Backend retrieves**:
   - Invoice data
   - Brand data (existing)
   - **Merchant data (new)** - if `selectedMerchantId` exists
4. **Backend returns**: Invoice + Brand + Merchant
5. **Frontend displays**: All info in modal with merchant in purple card

---

## 🔍 What Information is Shown

### For Paid Invoices
- ✅ **Merchant Name** (nickname): e.g., "Main Stripe", "Backup PayPal"
- ✅ **Gateway**: e.g., "stripe", "paypal", "authorize", "beyondbancard"

### For Unpaid/Pending Invoices
- ℹ️ Merchant info section is **not shown** (no merchant selected yet)

---

## 🧪 Testing Instructions

### Test 1: View Paid Invoice Details
1. Login as admin or compliance user
2. Go to **Invoices** page
3. Find a **paid** invoice in the table
4. Click the **User icon (👤)** in the Actions column
5. **Expected**: Modal opens showing:
   - Invoice Information (blue card)
   - **Payment Merchant section (purple card)** ← Should see this
   - Customer Information
   - Billing details (if paid via payment form)

### Test 2: Verify Merchant Info Display
1. Open customer details for a paid invoice
2. Look for "Payment Merchant" section (purple background)
3. **Expected to see**:
   - Merchant Name: [merchant nickname]
   - Gateway: [stripe/paypal/authorize/beyondbancard]

### Test 3: Pending Invoice (No Merchant)
1. Open customer details for a **pending** (unpaid) invoice
2. **Expected**: "Payment Merchant" section is NOT shown
3. Only shows: Invoice Info, Customer Info (no merchant selected yet)

---

## 📋 Use Cases

### Admin/Compliance Reviewing Payments
**Scenario**: Admin wants to see which merchant processed a payment

1. View invoice list
2. Click User icon on any paid invoice
3. See "Payment Merchant" section
4. ✅ Know immediately which merchant account was used

### Troubleshooting Payment Issues
**Scenario**: Customer reports payment issue

1. Find invoice in table
2. View customer details
3. Check Payment Merchant section
4. ✅ Identify which gateway and merchant processed the payment
5. Can now check specific merchant account logs

### Merchant Usage Analytics
**Scenario**: Track which merchants are being used

1. Review multiple paid invoices
2. Check Payment Merchant in each
3. ✅ See distribution of payments across merchants

---

## 🎨 Visual Design

### Colors
- **Invoice Info**: Blue background (`bg-blue-50`)
- **Payment Merchant**: Purple background (`bg-purple-50`) ← NEW
- **Customer Info**: White background
- **Billing Address**: White background
- **Card Info**: White background

### Typography
- **Section Title**: Small, semibold, gray-700
- **Field Labels**: Gray-600, extra-small
- **Field Values**: Medium weight, gray-900
- **Gateway**: Capitalized (stripe → Stripe)

---

## 🔄 Server Status

- **Backend**: ✅ Running (Terminal 11, Port 5000)
- **Frontend**: ✅ Running (Terminal 8, Port 5173)
- **Changes Applied**: ✅ Backend restarted with merchant info feature

---

## 📊 API Response Example

```json
{
  "invoiceId": "abc123",
  "invoiceNumber": "INV-ABC123",
  "customerName": "John Doe",
  "customerEmail": "john@example.com",
  "customerSerialNumber": "SN12345",
  "amount": 100.00,
  "status": "paid",
  "paymentDate": "2025-01-17T...",
  "billingDetails": { ... },
  "brand": {
    "name": "Test Brand",
    "brandNo": "001"
  },
  "merchant": {              ← NEW
    "nickname": "Main Stripe",
    "gateway": "stripe"
  }
}
```

---

## ✅ Feature Complete

**Status**: ✅ Implemented and ready for testing

**What to Test**:
1. Click User icon (👤) on paid invoice
2. Look for "Payment Merchant" purple section
3. Verify merchant nickname and gateway are displayed
4. Confirm section only shows for paid invoices

**Files Modified**:
- ✅ `backend/src/routes/invoices.js` - Added merchant data to billing endpoint
- ✅ `frontend/src/pages/Invoices.jsx` - Added merchant display in modal

---

**The merchant information now appears when viewing customer details for paid invoices!** 🎉
