# Customer Details Feature Guide

## Overview
The Invoices tab now has a button to view all customer information stored from the payment process. This includes address details, zip code, and card information (last 4 digits).

## How to Use

### Step 1: Find a Paid Invoice
Navigate to the **Invoices** tab in the dashboard.

Look for invoices with status **"paid"** (shown in green badge).

### Step 2: Click the User Icon Button
In the **Actions** column on the right, you'll see a **User icon** (👤) button next to paid invoices.

The buttons visible for paid invoices are:
- ✓ Green checkmark - Indicates payment is complete
- 👤 User icon - **View customer details** ← This one!
- ↩️ Undo icon - Undo payment (back to pending)
- ⟳ Reverse icon - Reverse payment
- 🗑️ Trash icon - Delete invoice

### Step 3: View Customer Details Modal
Clicking the User icon opens a modal showing all stored information organized in sections:

#### 📋 Invoice Information Section
- Invoice # (e.g., INV-ABC12345)
- Amount (e.g., USD $500.00)
- Status (paid/refunded/chargebacked)
- Payment Date

#### 👤 Customer Information Section
- **Name**: Customer's full name
- **Email**: Customer's email address
- **Serial Number**: Customer's reference number (e.g., SN-123456)

#### 📍 Billing Address Section
- **First Name & Last Name**: Individual name breakdown
- **Company**: Business name (if provided)
- **Address Line 1**: Street address
- **Address Line 2**: Apt/Suite (if provided)
- **City**: City name
- **State**: State/Province code
- **Postal Code**: ZIP/Postal code ✅
- **Country**: Country code (e.g., US)

#### 💳 Card Information Section
- **Cardholder Name**: Name on the card
- **Card Last 4 Digits**: ••••XXXX (masked for security)
- **Payment Gateway**: Which processor (stripe/paypal/authorize/beyondbancard)

#### 🏢 Brand Section
- Brand name associated with the invoice

## Example

### Invoices Table
```
Invoice #        | Customer          | Brand    | Amount   | Status | Link      | Date         | Actions
INV-2024-00521  | John Smith        | Acme Inc | $1,250   | Paid   | ✓ Opened | 6/24/2026  | ✓ 👤 ↩️ ⟳ 🗑️
INV-2024-00520  | Sarah Johnson     | Tech Co  | $850     | Pending| Not open | 6/23/2026  | 🔗 🗑️
```

### Billing Details Modal (After Clicking 👤)
```
═══════════════════════════════════════════════════════════════════
                   Customer & Payment Details
═══════════════════════════════════════════════════════════════════

INVOICE INFORMATION
┌─────────────────────────────────────────────────────────────────┐
│ Invoice #: INV-2024-00521          Amount: USD $1,250.00        │
│ Status: Paid                       Payment Date: 6/24/2026      │
└─────────────────────────────────────────────────────────────────┘

CUSTOMER INFORMATION
┌─────────────────────────────────────────────────────────────────┐
│ Name: John Smith                                                │
│ Email: john.smith@company.com                                  │
│ Serial Number: SN-SMITH-12345                                  │
└─────────────────────────────────────────────────────────────────┘

BILLING ADDRESS
┌─────────────────────────────────────────────────────────────────┐
│ First Name: John          Last Name: Smith                      │
│ Company: Acme Manufacturing                                    │
│ Address Line 1: 123 Business Park Avenue                       │
│ Address Line 2: Suite 400                                      │
│ City: New York            State: NY                             │
│ Postal Code: 10001        Country: US                           │
└─────────────────────────────────────────────────────────────────┘

CARD INFORMATION
┌─────────────────────────────────────────────────────────────────┐
│ Cardholder Name: John Smith                                    │
│ Card Last 4 Digits: ••••4242                                   │
│ Payment Gateway: Stripe                                        │
└─────────────────────────────────────────────────────────────────┘

Brand: Acme Inc
```

## Important Notes

### Security & Privacy
✅ **Full card numbers are NEVER stored** - Only the last 4 digits are saved
✅ **Admin-only access** - Only users with admin role can view billing details
✅ **Payment processing secure** - Card data is tokenized by payment processors
✅ **HTTPS encryption** - All data transmitted over secure connection

### What Data is Stored
This feature stores all information that customers enter on the payment link page:
- Customer identification (name, email, serial number)
- Billing address (all fields from the payment form)
- Card details (only last 4 digits + cardholder name)
- Payment method used (which gateway processed it)

### What Data is NOT Stored
❌ Full credit card numbers
❌ CVV/Security codes
❌ Card expiration dates
❌ Any PCI-regulated sensitive data

## Troubleshooting

### "Failed to load billing details" Error

**If you see this error:**

1. **Check Admin Status**
   - Only admins can view billing details
   - Verify your user account has admin role

2. **Verify Invoice is Paid**
   - Only paid invoices show the User button
   - Check invoice status shows "Paid" (green badge)

3. **Check Backend Logs**
   - Open `backend/logs/payment-route.log`
   - Look for entries with "BILLING DETAILS REQUEST"
   - Check for any error messages

4. **Restart Backend Server**
   ```bash
   npm stop
   npm start
   ```

5. **Check Browser Console**
   - Open DevTools (F12)
   - Go to Console tab
   - Click User button again
   - Look for error messages with details

6. **Verify Network Request**
   - Open DevTools Network tab
   - Click User button
   - Look for request to `/api/invoices/{id}/billing`
   - Check response status (should be 200)

### Data is Incomplete

**If some fields are missing:**

1. **Payment might be old** - Data is only stored when payment processes successfully
2. **Gateway limitation** - Some gateways may not capture all optional fields
3. **Customer didn't fill all fields** - Some fields like Company Name are optional

## Use Cases

1. **Order Fulfillment**
   - Verify shipping address before fulfilling order
   - Ensure address is complete and correct

2. **Customer Support**
   - Quickly pull up customer information for support tickets
   - Verify customer identity with email/serial number

3. **Accounting & Reconciliation**
   - Link invoice payment to customer details
   - Export for bookkeeping/reconciliation

4. **Fraud Prevention**
   - Review billing address for suspicious patterns
   - Check cardholder name matches identity

5. **Analytics & Reporting**
   - Analyze customer data by geography
   - Track payment methods by customer segment

## Feature Status
✅ **Fully Implemented** - All customer details storage and retrieval working
✅ **Secure** - Only last 4 card digits stored, admin-only access
✅ **Production Ready** - Tested and deployed
