# Compliance Role Implementation

## Overview
New "Compliance" user role with specific permissions and email verification for sensitive actions.

## Compliance Role Permissions

### ✅ Can Access:
1. **Dashboard** - View only
2. **All Invoices** - View all invoices across all brands
3. **Archive Invoices** - Mark invoices as archived (also available to admin)
4. **Update Refund/Chargeback** - Modify refund and chargeback amounts
5. **View Client Info** - Access customer billing details
6. **View Brands** - See all brands
7. **Create Brands** - With email verification code
8. **Assign Merchants to Brands** - With email verification code

### ❌ Cannot Access:
1. **Delete Invoices** - Only admin can delete
2. **Delete Brands** - Only admin can delete
3. **Delete Merchants** - Only admin can delete
4. **Delete Users** - Only admin can delete
5. **Approve/Reject Users** - Only admin

### 🔐 Actions Requiring Email Verification:
1. **Reset Merchant Volume** - Clear processedAmount to 0
2. **Reset Merchant Ticket Size** - Modify ticket size limit
3. **Turn Merchant On/Off** - Toggle isActive status
4. **Create Brand** - New brand creation
5. **Assign Merchant to Brand** - Link merchants to brands

**Verification Email:** `muneebwaseem78@gmail.com`

## Implementation Components

### Backend Changes

#### 1. Models
- ✅ **User.js**: Add 'compliance' to role enum
- ✅ **Invoice.js**: Add `archived` field (boolean)
- New: **VerificationCode.js**: Store verification codes

#### 2. Middleware
- ✅ **auth.js**: Add `adminOrCompliance` middleware
- New verification code checking middleware

#### 3. Routes

**Invoices** (`invoices.js`):
- Archive/unarchive endpoints (admin + compliance)
- Refund/chargeback update (admin + compliance)
- View billing details (admin + compliance)
- Delete remains admin-only

**Merchants** (`merchants.js`):
- Reset volume endpoint with email verification
- Reset ticket size endpoint with email verification
- Toggle active status endpoint with email verification
- Delete remains admin-only

**Brands** (`brands.js`):
- Create brand with email verification (admin + compliance)
- Assign merchant with email verification (admin + compliance)
- Delete remains admin-only

**New: Verification** (`verification.js`):
- Generate verification code endpoint
- Verify code endpoint
- Resend code endpoint

#### 4. Email Service
New email utility to send verification codes to `muneebwaseem78@gmail.com`

### Frontend Changes

#### 1. Components
- Update role checks throughout
- Add verification code modal component
- Show/hide features based on compliance role

#### 2. Pages

**Users.jsx**:
- Add 'Compliance' option to role dropdown

**Invoices.jsx**:
- Add Archive/Unarchive button (admin + compliance)
- Hide Delete button for compliance users
- Show billing details button (admin + compliance)

**Merchants.jsx**:
- Add Reset Volume button (with verification)
- Add Reset Ticket Size button (with verification)
- Add Toggle Active button (with verification)
- Hide Delete button for compliance users

**Brands.jsx**:
- Create brand button (with verification for compliance)
- Assign merchant button (with verification for compliance)
- Hide Delete button for compliance users

**Dashboard.jsx**:
- Accessible by admin + compliance

## Database Schema Updates

### Invoices Collection
```javascript
{
  // ... existing fields
  archived: false, // NEW: boolean field
  archivedAt: null, // NEW: timestamp when archived
  archivedBy: null // NEW: user ID who archived it
}
```

### Verification Codes Collection
```javascript
{
  _id: 'auto',
  code: '123456', // 6-digit code
  userId: 'user_id', // who requested
  action: 'reset_volume', // what action
  targetId: 'merchant_id', // what resource
  email: 'muneebwaseem78@gmail.com',
  used: false,
  createdAt: 'ISO date',
  expiresAt: 'ISO date' // 10 minutes expiry
}
```

## Email Configuration

Add to `.env`:
```
ADMIN_EMAIL=muneebwaseem78@gmail.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

## Security Considerations

1. **Verification Codes**: 
   - 6-digit random codes
   - 10-minute expiration
   - Single-use only
   - Sent to fixed admin email

2. **Role Checks**:
   - Backend enforces all permissions
   - Frontend hides unavailable features
   - API endpoints verify role on each request

3. **Audit Trail**:
   - Log who archived invoices
   - Log who performed sensitive actions
   - Track verification code usage

## Testing Checklist

- [ ] Compliance user can log in
- [ ] Compliance user sees Dashboard
- [ ] Compliance user sees all invoices
- [ ] Compliance user can archive/unarchive invoices
- [ ] Compliance user can update refund/chargeback
- [ ] Compliance user can view billing details
- [ ] Compliance user CANNOT delete invoices
- [ ] Compliance user receives verification codes
- [ ] Verification codes expire after 10 minutes
- [ ] Verification codes work for merchant actions
- [ ] Verification codes work for brand creation
- [ ] Admin email receives all verification codes
