# Multi-Gateway Payment System Implementation

## ✅ Backend Changes Completed

### 1. New Database Collections
- `merchants` - Store payment gateway configurations (Stripe, PayPal, Authorize.net)
- `brandMerchants` - Link merchants to brands (many-to-many)
- `userBrands` - Assign brands to users (many-to-many)

### 2. New API Endpoints

#### Merchants Management (`/api/merchants`)
- `GET /` - List all merchants (admin only)
- `POST /` - Create new merchant (admin only)
- `PATCH /:id` - Update merchant (admin only)
- `DELETE /:id` - Delete merchant (admin only)
- `GET /brand/:brandId` - Get merchants for a brand
- `POST /brand/:brandId/assign` - Assign merchant to brand
- `DELETE /brand/:brandId/merchant/:merchantId` - Remove merchant from brand

#### User-Brand Management (`/api/user-brands`)
- `GET /user/:userId` - Get brands assigned to user (admin)
- `GET /my-brands` - Get brands for current user
- `POST /user/:userId/assign` - Assign brand to user (admin)
- `DELETE /user/:userId/brand/:brandId` - Remove brand from user (admin)

#### Invoice Updates (`/api/invoices`)
- `POST /public/:id/verify` - Verify customer details before payment

### 3. Updated Invoice Model
New fields added:
- `customerName` (required)
- `customerSerialNumber` (required)
- `customerVerified` (boolean)
- `selectedMerchantId` (which gateway to use)

## 🔨 Frontend Changes Needed

### 1. New Pages to Create

#### `/merchants` - Merchants Management (Admin Only)
```jsx
Features:
- List all merchants (Stripe, PayPal, Authorize.net)
- Add new merchant with nickname
- Configure gateway credentials
- Activate/deactivate merchants
- Delete merchants
```

#### Update `/brands` - Brand Management
```jsx
Add features:
- Assign merchants to brand
- Set default merchant for brand
- View assigned merchants
```

#### Update `/users` - User Management
```jsx
Add features:
- Assign brands to users
- View user's assigned brands
- Remove brand assignments
```

#### Update `/invoices` - Invoice Creation
```jsx
Add fields:
- Customer Name (required)
- Customer Email (required)
- Customer Serial Number (required)
- Show only brands assigned to user (non-admin)
```

#### Update `/pay/:invoiceId` - Public Payment Page
```jsx
Add verification step:
1. Show form asking for:
   - Name
   - Email
   - Serial Number
2. Verify against invoice data
3. If verified, show:
   - Available payment gateways (Stripe, PayPal, Authorize.net)
   - Customer details
   - Invoice details
4. Process payment with selected gateway
```

### 2. Payment Gateway Integration

#### Stripe Integration
```javascript
// Install: npm install stripe
// Frontend: Use Stripe Elements
// Backend: Process with Stripe API
```

#### PayPal Integration
```javascript
// Install: npm install @paypal/checkout-server-sdk
// Frontend: Use PayPal Buttons
// Backend: Process with PayPal SDK
```

#### Authorize.net Integration
```javascript
// Install: npm install authorizenet
// Frontend: Use Accept.js
// Backend: Process with Authorize.net API
```

## 📋 Implementation Steps

### Step 1: Create Merchants Page
1. Create `frontend/src/pages/Merchants.jsx`
2. Add CRUD operations for merchants
3. Add gateway credential forms (Stripe API key, PayPal Client ID, etc.)

### Step 2: Update Brands Page
1. Add "Manage Merchants" button for each brand
2. Show modal to assign/remove merchants
3. Set default merchant

### Step 3: Update Users Page
1. Add "Assign Brands" button for each user
2. Show modal to assign/remove brands

### Step 4: Update Invoice Creation
1. Add customer fields (name, email, serial number)
2. Filter brands by user assignment (non-admin)
3. Validate all fields

### Step 5: Update Public Payment Page
1. Add verification form (step 1)
2. Show available gateways after verification (step 2)
3. Implement gateway-specific payment forms
4. Process payment based on selected gateway

### Step 6: Install Payment SDKs
```bash
cd backend
npm install stripe @paypal/checkout-server-sdk authorizenet
```

### Step 7: Create Payment Utilities
- `backend/src/utils/stripe.js`
- `backend/src/utils/paypal.js`
- `backend/src/utils/authorize.js`

## 🔐 Environment Variables to Add

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# PayPal
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_MODE=sandbox

# Authorize.net
AUTHORIZE_API_LOGIN_ID=...
AUTHORIZE_TRANSACTION_KEY=...
AUTHORIZE_MODE=sandbox
```

## 🎯 User Flow

### Admin Flow:
1. Create merchants (Stripe, PayPal, Authorize.net) with nicknames
2. Assign merchants to brands
3. Assign brands to users
4. Users can only create invoices for their assigned brands

### Invoice Creation Flow:
1. User selects brand (from assigned brands)
2. Enters customer details (name, email, serial number)
3. Adds line items
4. Creates invoice
5. Shares payment link with customer

### Customer Payment Flow:
1. Opens payment link
2. Sees verification form
3. Enters name, email, serial number
4. System verifies details
5. Shows available payment gateways
6. Customer selects gateway (Stripe/PayPal/Authorize.net)
7. Enters payment details
8. Payment processed
9. Redirects to uspto.gov

## 📝 Next Actions

Would you like me to:
1. Create the Merchants management page?
2. Update the Brands page with merchant assignment?
3. Update the Users page with brand assignment?
4. Update the Invoice creation form?
5. Update the Public payment page with verification?
6. Implement Stripe integration?
7. Implement PayPal integration?
8. Implement Authorize.net integration?

Let me know which part you'd like me to implement first!
