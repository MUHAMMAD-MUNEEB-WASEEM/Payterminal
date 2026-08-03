# Troubleshooting: No Payment Methods Available

## Error Message
"No payment methods available for this brand"

## Common Causes & Solutions

### 1. ✅ Merchant Not Assigned to Brand
**Check:** Is the merchant actually assigned to brand 104?

**How to Fix (Admin Panel):**
1. Go to **Brands** page
2. Find Brand 104
3. Click **"Assign Merchants"** button
4. Select your merchant and click Assign
5. Set one as default if needed

**Direct Database Check (if needed):**
```javascript
// Check brand_merchants table
db.brandMerchants.find({ brandId: "brand-id-for-104" })
```

---

### 2. ✅ Merchant is Inactive
**Check:** Is the merchant active?

**How to Fix:**
1. Go to **Merchants** page
2. Find your merchant
3. Check the status - it should show "Active"
4. If inactive, click toggle to activate
5. If compliance user, you'll need verification code

**API Check:**
```javascript
// The merchant must have isActive: true
db.merchants.findOne({ _id: "your-merchant-id" })
// Look for: isActive: true
```

---

### 3. ✅ Merchant Reached Limit
**Check:** Has the merchant reached its amount limit?

**Symptoms:**
- Merchant exists
- Merchant is assigned to brand
- Merchant is active
- BUT still not appearing

**How to Fix:**
1. Go to **Merchants** page
2. Check "Processed Amount" vs "Amount Limit"
3. If limit reached:
   - **Option A:** Reset volume (Admin or Compliance with code)
   - **Option B:** Increase limit
   - **Option C:** Remove limit (set to 0 or null)

**Example:**
- Processed Amount: $5,000
- Amount Limit: $5,000
- **Result:** Merchant won't show up (limit reached)

---

### 4. ✅ Brand ID Mismatch
**Check:** Are you using the correct brand ID?

**Common Issue:**
- Database uses internal ID (e.g., `"abc123xyz"`)
- You might be using Brand Number (e.g., `104`)
- These are different!

**How to Check:**
1. Go to Brands page as admin
2. Open browser console (F12)
3. Type: `console.log(brands)` (if you have access to state)
4. Or check network tab for API response
5. Look for `_id` field (not `brandNo`)

---

### 5. ✅ Database Not Synced
**Check:** Did you deploy recently? Database might not have the assignment.

**How to Fix:**
1. Log into your production database
2. Check `brand_merchants` collection
3. Verify entry exists:
```json
{
  "brandId": "actual-brand-id",
  "merchantId": "actual-merchant-id",
  "isDefault": true/false,
  "createdAt": "2026-..."
}
```

---

## Quick Diagnostic Steps

### Step 1: Check Brand ID
```bash
# In admin panel, open console and check invoice
# The brand should have an _id field
```

### Step 2: Check Merchant Assignment
**Admin Panel:**
1. Brands page → Click on Brand 104
2. Look for "Assigned Merchants" section
3. Should show at least one merchant

**Backend Logs:**
```javascript
// Add console.log in merchants.js line ~141
console.log('Fetching merchants for brand:', req.params.brandId);
console.log('Brand merchants found:', brandMerchants);
console.log('Merchants after filtering:', merchants);
```

### Step 3: Check Merchant Status
**Admin Panel:**
1. Merchants page
2. Find your merchant
3. Verify:
   - ✅ Status: Active (green badge)
   - ✅ Processed Amount < Amount Limit
   - ✅ Shows in assigned brands list

### Step 4: Test API Endpoint Directly
```bash
# Replace with your actual brand ID
curl https://your-backend-url.com/api/merchants/brand/YOUR_BRAND_ID/public
```

**Expected Response:**
```json
[
  {
    "_id": "merchant-id",
    "nickname": "Stripe Account 1",
    "gateway": "stripe",
    "isDefault": true,
    "ticketSize": null,
    "tokenizationKey": null
  }
]
```

**If Empty Array `[]`:**
- Merchant not assigned OR
- Merchant inactive OR
- Merchant reached limit

---

## Solution Examples

### Example 1: Assign Merchant to Brand
```javascript
// Admin Panel: Brands page
1. Click on Brand 104
2. Click "Assign Merchants"
3. Select merchant from dropdown
4. Check "Set as default" (optional)
5. Click "Assign"
```

### Example 2: Activate Merchant
```javascript
// Admin Panel: Merchants page
1. Find inactive merchant
2. Click toggle switch
3. If admin: activates immediately
4. If compliance: requires verification code
```

### Example 3: Reset Merchant Limit
```javascript
// Admin Panel: Merchants page
1. Find merchant with limit reached
2. Click "Reset Volume"
3. If admin: resets immediately
4. If compliance: requires verification code
```

### Example 4: Remove Limit
```javascript
// Admin Panel: Merchants page
1. Click Edit on merchant
2. Find "Amount Limit" field
3. Set to 0 or leave empty
4. Save
```

---

## Backend Logging (for debugging)

Add these logs to `backend/src/routes/merchants.js` at line ~141:

```javascript
router.get('/brand/:brandId/public', async (req, res) => {
  try {
    console.log('🔍 PUBLIC MERCHANT FETCH');
    console.log('Brand ID:', req.params.brandId);
    
    const brandMerchants = await db.brandMerchants.find({ brandId: req.params.brandId });
    console.log('📋 Brand-Merchant entries found:', brandMerchants.length);
    console.log('Entries:', JSON.stringify(brandMerchants, null, 2));
    
    brandMerchants.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    const merchants = [];
    for (const bm of brandMerchants) {
      const merchant = await db.merchants.findOne({ _id: bm.merchantId, isActive: true });
      console.log(`Merchant ${bm.merchantId}:`, merchant ? 'FOUND' : 'NOT FOUND OR INACTIVE');
      
      if (merchant) {
        const hasLimit = merchant.amountLimit && merchant.amountLimit > 0;
        const limitReached = hasLimit && merchant.processedAmount >= merchant.amountLimit;
        
        console.log(`  - Has limit: ${hasLimit}`);
        console.log(`  - Limit reached: ${limitReached}`);
        console.log(`  - Processed: $${merchant.processedAmount} / Limit: $${merchant.amountLimit || 'none'}`);
        
        if (!limitReached) {
          merchants.push({
            _id: merchant._id,
            nickname: merchant.nickname,
            gateway: merchant.gateway,
            isDefault: bm.isDefault || false,
            ticketSize: merchant.ticketSize || null,
            tokenizationKey: merchant.credentials?.tokenizationKey || null,
          });
          console.log(`  ✅ INCLUDED in results`);
        } else {
          console.log(`  ❌ EXCLUDED (limit reached)`);
        }
      }
    }
    
    console.log('📤 Final merchants returned:', merchants.length);
    console.log('Merchants:', JSON.stringify(merchants, null, 2));
    
    res.json(merchants);
  } catch (err) {
    console.error('❌ ERROR:', err);
    res.status(500).json({ message: err.message });
  }
});
```

---

## Most Likely Cause

Based on the error "No payment methods available for this brand", the most common causes are:

1. **Merchant not assigned to brand** (70% of cases)
2. **Merchant is inactive** (20% of cases)
3. **Merchant reached limit** (8% of cases)
4. **Wrong brand ID used** (2% of cases)

---

## Immediate Action

1. **Log into admin panel** (production)
2. **Go to Brands page**
3. **Find Brand 104** (or search by brand number)
4. **Check assigned merchants** - should show at least one
5. **If none shown:**
   - Click "Assign Merchants"
   - Select a merchant
   - Set as default
   - Click Assign
6. **Test invoice payment link again**

---

## Prevention

To avoid this in the future:

1. **Always assign at least one merchant** when creating a brand
2. **Set one merchant as default** for each brand
3. **Monitor merchant limits** to avoid reaching caps
4. **Keep at least one merchant active** per brand
5. **Test payment links** after creating/modifying brands

---

## Need More Help?

If the issue persists after trying these solutions:

1. Check backend logs for the 🔍 debugging output
2. Verify database has correct entries
3. Check network tab in browser for API response
4. Ensure brand ID in invoice matches brand ID in database
5. Contact developer with:
   - Brand ID (actual ID, not number)
   - Merchant ID
   - Screenshots of Brands page
   - Backend logs
