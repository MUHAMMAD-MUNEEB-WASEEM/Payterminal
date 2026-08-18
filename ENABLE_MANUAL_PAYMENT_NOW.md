# Enable Manual Payment for Your Brand - Quick Guide

## Step 1: Edit Your Brand

1. Open your browser
2. Go to **Brands** page
3. Find your brand in the list
4. Click the **pencil icon** (Edit) next to your brand name

## Step 2: Enable Manual Payment

1. Scroll down to the **"Payment Processing"** section
2. You'll see a new checkbox: **"Enable Manual Payment Processing"**
3. ✅ Check this box
4. You should see a purple info box appear explaining what this does
5. Click **"Update Brand"** at the bottom

## Step 3: Verify It's Enabled

1. The brand should update successfully
2. If you edit the brand again, the checkbox should still be checked
3. Now invoices created with this brand will use manual payment flow

## Step 4: Test the Feature

1. Create a new invoice with this brand
2. Fill in customer details
3. Send payment link to customer (or open in incognito)
4. Follow the test flow in `USPTO_FINAL_COMPLETE.md`

---

## What You'll See

### When Checkbox is UNCHECKED:
```
⬜ Enable Manual Payment Processing
   Automatic payment processing through merchant gateways
```

### When Checkbox is CHECKED:
```
✅ Enable Manual Payment Processing
   🔐 Manual verification required. Customer payment requests must be approved by admin.

   ┌─────────────────────────────────────────────────────┐
   │ Manual Payment Mode: Customers will submit payment │
   │ information that requires admin verification and   │
   │ approval before processing.                        │
   └─────────────────────────────────────────────────────┘
```

---

## Visual Location in Form

```
Create/Edit Brand Form
├── Brand Name *
├── Brand Office # 
├── Brand Logo *
├── Post-Payment Settings
│   ├── Redirect URL (optional)
│   └── Enable automatic redirect after payment
└── 🆕 Payment Processing  ← NEW SECTION
    └── ✅ Enable Manual Payment Processing
```

---

## Important Notes

1. **No Backend Restart Needed** - The backend already supports this
2. **Existing Invoices Not Affected** - Only new invoices will use manual flow
3. **Can Toggle Anytime** - You can enable/disable whenever needed
4. **Works Per Brand** - Each brand can have different settings

---

## After Enabling

When you create an invoice with this brand:

✅ Customer sees USPTO payment form (SSN, DOB, card details)
✅ Admin sees Email/SMS buttons
✅ Customer enters OTP (any 6 digits)
✅ Admin sees Paid/Failed/Card Not Accepted buttons
✅ Customer redirects to USPTO after approval

---

## Need Help?

Check these documents:
- `USPTO_FINAL_COMPLETE.md` - Complete documentation
- `QUICK_TEST_NOW.md` - Testing guide
- `USPTO_FLOW_DIAGRAM.md` - Visual flow diagram

---

**That's it! Your brand is ready for manual payment processing.** 🎉
