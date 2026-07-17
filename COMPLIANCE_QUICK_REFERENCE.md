# Compliance Role - Quick Reference Card

## 🎯 Quick Actions

### Admin Tasks:
```
Create Compliance User:
  Users Page → "Add Compliance User" → Fill Form → Create

Revoke Compliance:
  Users Page → Compliance Section → ShieldOff Icon → Confirm

Delete Compliance User:
  Users Page → Compliance Section → Trash Icon → Confirm
```

### Compliance User Tasks:
```
With Verification:
  - Archive/Unarchive Invoice
  - Reset Merchant Volume
  - Reset Merchant Ticket Size
  - Toggle Merchant Active/Inactive
  - Create Brand
  - Assign Merchant to Brand

Without Verification:
  - View Dashboard
  - View All Invoices
  - Update Refunds/Chargebacks
  - View Billing Details
  - Edit Merchants/Brands
```

## 📧 Email Settings

**Admin Email**: `muneebwaseem78@gmail.com`

**Development** (console only):
```env
ADMIN_EMAIL=muneebwaseem78@gmail.com
```

**Production** (real emails):
```env
ADMIN_EMAIL=muneebwaseem78@gmail.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

## 🔐 API Endpoints

### Verification:
```
POST /api/verification/generate
Body: { action: 'archive_invoice' | 'reset_volume' | etc. }

POST /api/verification/verify
Body: { code: '123456', action: 'archive_invoice' }

POST /api/verification/resend
Body: { action: 'archive_invoice' }
```

### User Management:
```
POST /api/auth/register (Admin Only)
Body: { username, email, password, role: 'compliance' }

PATCH /api/users/:id/role (Admin Only)
Body: { role: 'user' | 'compliance' }

GET /api/users (Admin Only)
Returns: All non-admin users
```

## 🎨 UI Elements

### Icons:
- 🛡️ **Shield**: Compliance user
- 🚫 **ShieldOff**: Revoke compliance
- 👤+ **UserPlus**: Add compliance user
- 🗑️ **Trash2**: Delete user
- ✅ **CheckCircle**: Approve
- ❌ **XCircle**: Reject

### Color Codes:
- **Blue** (#3B82F6): Compliance users/actions
- **Purple** (#A855F7): Admin users
- **Gray** (#6B7280): Regular users
- **Green** (#10B981): Success/Approved
- **Red** (#EF4444): Delete/Rejected
- **Yellow** (#F59E0B): Pending/Warning

## 🔄 Verification Flow

```
Action → Check Role → Show Modal → Send Code → Email → Enter Code → Verify → Execute
```

**Code Specs**:
- Format: 6 digits (e.g., 123456)
- Expiry: 10 minutes
- Usage: Single-use only
- Delivery: muneebwaseem78@gmail.com

## 📱 Pages Modified

| Page | Changes |
|------|---------|
| **Users** | Compliance management section, create/revoke/delete |
| **Layout** | Compliance users see all nav items + notifications |
| **Dashboard** | Already supports compliance (no changes) |
| **Invoices** | Archive/unarchive buttons with verification |
| **Merchants** | Reset volume/ticket, toggle with verification |
| **Brands** | Create brand, assign merchant with verification |

## ⚡ Quick Troubleshooting

**Verification code not received?**
- Check console logs (development mode)
- Verify SMTP settings (production mode)
- Click "Resend" button

**Can't create compliance user?**
- Must be logged in as admin
- Check username/email not already taken
- Password must be 6+ characters

**Compliance user can't perform action?**
- Verify they're logged in
- Check if action requires verification
- Ensure verification code is entered correctly

**Revoked user still has permissions?**
- User must log out and log back in
- Check role was actually changed in database

## 🎯 Testing Checklist

**Admin Tests**:
- [ ] Create compliance user
- [ ] View compliance users section
- [ ] Revoke compliance role
- [ ] Delete compliance user

**Compliance Tests**:
- [ ] Login with compliance credentials
- [ ] Archive invoice (with verification)
- [ ] Reset merchant volume (with verification)
- [ ] Create brand (with verification)
- [ ] Try to delete something (should fail)

**Verification Tests**:
- [ ] Receive code by email
- [ ] Enter valid code (success)
- [ ] Enter invalid code (error)
- [ ] Wait 10+ minutes (expired error)
- [ ] Use same code twice (already used error)
- [ ] Resend code (new code sent)

## 📊 Permissions Quick View

### ✅ Compliance CAN:
- View all invoices
- Archive/unarchive (verify)
- Update refunds/chargebacks
- View billing details
- Reset merchant volume (verify)
- Reset ticket size (verify)
- Toggle merchant (verify)
- Create brand (verify)
- Assign merchant (verify)
- Edit merchants/brands

### ❌ Compliance CANNOT:
- Delete anything
- Create other users
- Manage user approvals
- Access admin-only features

## 🔗 Quick Links

**Documentation**:
- Full Implementation: `COMPLIANCE_ROLE_COMPLETE.md`
- Admin Management: `ADMIN_COMPLIANCE_MANAGEMENT.md`
- Feature Summary: `COMPLIANCE_FEATURE_SUMMARY.md`

**Code Locations**:
- Backend Verification: `backend/src/routes/verification.js`
- Email Service: `backend/src/utils/emailService.js`
- Verification Modal: `frontend/src/components/VerificationModal.jsx`
- User Management: `frontend/src/pages/Users.jsx`

---

**Version**: 1.0.0  
**Last Updated**: 2024  
**Status**: ✅ Production Ready
