# Collect.js CDN Blocked? - Workaround Solutions

## If CDN is Completely Blocked

If you can't access `https://cdn.collectjs.com/v2.0/collectjs.min.js` at all (corporate firewall, etc.), here are workarounds:

---

## Option 1: Use Raw Card Data (Simpler, Less Secure)

### How It Works:
- Customer enters card details on form
- Backend sends card data directly to NMI (instead of tokenizing first)
- NMI processes the payment

### Pros:
- ✅ Works without CDN
- ✅ Simple implementation
- ✅ No external dependencies

### Cons:
- ❌ Less secure (card data on your servers briefly)
- ❌ Not PCI compliant without extra work

### To Implement:
The code already supports this! It's the fallback when Collect.js isn't available.

**Change in `PublicInvoice.jsx`** around line 263:

```javascript
// Current code sends raw card if Collect.js not available
// This already works as fallback!

// For other gateways or fallback, send raw card data
if (selectedMerchant.gateway !== 'beyondbancard') {
  // Use raw card data
  setPaying(true);
  // ... send cardNumber, expiryMonth, etc.
}
```

### Just Use This:
Don't wait for Collect.js. Go straight to raw card payment:
1. Fill in payment form
2. Click "Pay"
3. System sends card data to backend
4. Backend posts to NMI
5. Payment processes

**Try this now** - might work without CDN!

---

## Option 2: Whitelist CDN in Firewall

If you control your firewall:

### Whitelist This Domain:
```
Domain: cdn.collectjs.com
Protocol: HTTPS
Port: 443
```

### Steps:
1. Contact your network admin
2. Ask to whitelist `*.collectjs.com`
3. Ask to whitelist `secure.nmi.com`
4. Retry payment page

---

## Option 3: Download Collect.js Locally

### How It Works:
- Download Collect.js script
- Host it locally on your server
- Load from local instead of CDN

### Steps:

1. **Download the script** (from any internet connection):
   - Visit: https://cdn.collectjs.com/v2.0/collectjs.min.js
   - Save to: `frontend/public/collectjs.min.js`

2. **Update frontend code** in `PublicInvoice.jsx`:
```javascript
// Change from:
script.src = 'https://cdn.collectjs.com/v2.0/collectjs.min.js';

// To:
script.src = '/collectjs.min.js';  // Loads from public folder
```

3. **Restart frontend**: `npm run dev`

4. **Test**: Payment page should now load Collect.js locally

### Pros:
- ✅ No CDN dependency
- ✅ Faster loading
- ✅ Works offline

### Cons:
- ❌ Can't auto-update Collect.js
- ❌ Need to manage versions manually

---

## Option 4: Use Different Payment Gateway

If NMI/BeyondBancard with Collect.js won't work:

### Available Alternatives:
1. **Stripe** - Built-in tokens, no CDN needed
2. **PayPal** - Has own payment flow
3. **Authorize.net** - Traditional API

### Switch Gateway:
1. Create new merchant for different gateway
2. Assign to brand
3. Use that instead

---

## Option 5: Temporary Test Without Tokenization

### For Testing Only:

Change payment form to use raw card data:

In `PublicInvoice.jsx`, modify `handlePayment`:
```javascript
const handlePayment = async (e) => {
  e.preventDefault();
  
  // Skip Collect.js, send raw card data
  setPaying(true);
  
  const payload = {
    cardNumber: cardData.cardNumber.replace(/\s/g, ''),
    cardHolder: cardData.cardHolder,
    expiryMonth: cardData.expiryMonth,
    expiryYear: cardData.expiryYear,
    cvv: cardData.cvv,
    merchantId: selectedMerchant._id,
  };
  
  // Send to backend...
}
```

This sends card data directly (less secure but works without CDN).

---

## Recommended: Option 1 (Raw Card Data)

Since your code already supports raw card fallback:

1. **Just don't wait for Collect.js**
2. **Fill the form normally**
3. **Click Pay**
4. **System handles it**

The backend will:
- Accept card data
- Post to NMI API
- Process payment
- Return result

---

## Check Which Works

Try in order:
1. ✅ Raw card data (Option 1) - Simplest
2. ✅ Whitelist CDN (Option 2) - If you can
3. ✅ Local Collect.js (Option 3) - If you have access
4. ✅ Different gateway (Option 4) - If needed

---

## For Production

### Best Practice:
- Use Collect.js (Option 1 current) for PCI compliance
- Have CDN whitelist pre-approved
- Have fallback gateway configured
- Monitor CDN availability

### Security Note:
- Raw card data requires PCI DSS compliance
- Collect.js auto-handles PCI compliance
- Prefer tokenization when possible

---

## Summary

If CDN is blocked:
1. Try raw card payment (might already work!)
2. Whitelist `cdn.collectjs.com` in firewall
3. Download Collect.js locally
4. Use different payment gateway

**Try Option 1 first** - it's already implemented!

