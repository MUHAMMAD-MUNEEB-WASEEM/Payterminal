# How to Fill the Merchant Form - NMI/BeyondBancard

## Quick Visual Guide

When you click **Edit** on the "Test Beyond" merchant in the Merchants page, you'll see this updated form:

---

## Form Fields Explained

### 1. Nickname ✅
```
Label: Nickname
Current Value: Test Beyond
What to Put: Keep as is (or change to your preference)
Example: "My NMI Payment Account"
```

### 2. Gateway ✅
```
Label: Gateway
Current Value: BeyondBancard (dropdown - disabled when editing)
What to Put: BeyondBancard (already selected)
Action: Cannot change when editing
```

### 3. Amount Limit (USD) - Optional
```
Label: Amount Limit (USD) (optional)
Current Value: 20000
What to Put: 20000 (or your limit)
Example: 50000 for $50,000 limit
Leave Empty: For unlimited processing
```

### 4. ⭐ Security Key (API Key) - **IMPORTANT**
```
Label: Security Key (API Key)
Type: Password (masked)
What to Put: PPejd3YuesXf4dT6vnsuY3F44732HTf3
Description: Your NMI private API key
Location: Found in your NMI merchant portal under Security Keys → Private

This is your BACKEND authentication key
✅ Should be: PPejd3YuesXf4dT6vnsuY3F44732HTf3
❌ Should NOT be: The tokenization key
```

### 5. ⭐ Tokenization Key (Public) - **IMPORTANT**
```
Label: Tokenization Key (Public)
Type: Text (visible)
What to Put: Q8N5U4-543kky-kZr2CC-ns8K2Y
Description: Your NMI public tokenization key for Collect.js
Location: Found in your NMI merchant portal under Security Keys → Tokenization

This is your FRONTEND key (safe to expose)
✅ Should be: Q8N5U4-543kky-kZr2CC-ns8K2Y
❌ Should NOT be: The security key
```

### 6. Mode
```
Label: Mode
Options: 
  - Sandbox (Test) ← Use this for testing
  - Live (Production) ← Use only in production
What to Put: Sandbox (Test)
```

---

## Visual Representation of the Form

```
┌─────────────────────────────────────────┐
│         EDIT MERCHANT FORM              │
├─────────────────────────────────────────┤
│                                         │
│  Nickname                               │
│  [Test Beyond                        ]  │
│                                         │
│  Gateway                                │
│  [BeyondBancard                 ▼]  │
│                                         │
│  Amount Limit (USD) (optional)          │
│  [20000                             ]  │
│  Leave empty for no limit               │
│                                         │
│  ⓘ NMI Integration:                    │
│    BeyondBancard is powered by NMI.    │
│                                         │
│  Security Key (API Key)                 │
│  [••••••••••••••••••••••••••••••••] │
│  Your NMI private API key               │
│                                         │
│  Tokenization Key (Public)              │
│  [Q8N5U4-543kky-kZr2CC-ns8K2Y     ]  │
│  Your NMI public tokenization key       │
│                                         │
│  Mode                                   │
│  [Sandbox (Test)                ▼]  │
│                                         │
│  Where to find credentials:             │
│  • Go to merchant.nmi.com              │
│  • Security Settings → API Keys        │
│  • Copy Private/Security Key           │
│  • Copy Public/Tokenization Key        │
│                                         │
│  [Cancel]  [Update]                     │
│                                         │
└─────────────────────────────────────────┘
```

---

## Step-by-Step Instructions

### Step 1: Go to Merchants Page
- Click on "Merchants" in the admin sidebar
- You should see "Test Beyond" merchant card

### Step 2: Click Edit
- On the "Test Beyond" card, click the "Edit" button
- The merchant form will open in a modal

### Step 3: Review/Update Fields

#### Field 1: Nickname
- Current: "Test Beyond"
- **Action**: Keep as is ✅

#### Field 2: Gateway
- Current: "BeyondBancard"
- **Action**: Cannot edit (disabled) ✅

#### Field 3: Amount Limit (Optional)
- Current: "20000"
- **Action**: Keep as is ✅

#### Field 4: Security Key (THE IMPORTANT ONE!)
- **Current**: Empty or old value
- **Action**: Enter: `PPejd3YuesXf4dT6vnsuY3F44732HTf3`
- **Why**: This is your backend authentication key for NMI
- **Keep**: Secure - this is a private key

#### Field 5: Tokenization Key (THE OTHER IMPORTANT ONE!)
- **Current**: Empty or old value
- **Action**: Enter: `Q8N5U4-543kky-kZr2CC-ns8K2Y`
- **Why**: This is for Collect.js tokenization on the frontend
- **Safe**: This is a public key - okay to expose

#### Field 6: Mode
- **Current**: "Sandbox (Test)" or "Live"
- **Action**: Select "Sandbox (Test)" ✅

### Step 4: Save
- Click "Update" button
- You should see: "Merchant updated successfully" ✅

---

## Which Key Goes Where?

### Security Key (Backend)
```
Location: backend/src/utils/nmi-payment.js
Used By: Your payment processor
Access: Server-side only
Value: PPejd3YuesXf4dT6vnsuY3F44732HTf3
Role: Authenticates API requests to NMI
```

### Tokenization Key (Frontend)
```
Location: frontend/src/pages/PublicInvoice.jsx
Used By: Collect.js script
Access: Browser/Public (safe)
Value: Q8N5U4-543kky-kZr2CC-ns8K2Y
Role: Tokenizes card data securely
```

---

## Example - What a Completed Form Looks Like

```
Nickname:              Test Beyond
Gateway:               BeyondBancard
Amount Limit:          20000
Security Key:          PPejd3YuesXf4dT6vnsuY3F44732HTf3
Tokenization Key:      Q8N5U4-543kky-kZr2CC-ns8K2Y
Mode:                  Sandbox (Test)
```

---

## Common Mistakes & How to Avoid Them

### ❌ Mistake 1: Putting Tokenization Key in Security Key Field
```
Wrong:
  Security Key: Q8N5U4-543kky-kZr2CC-ns8K2Y
  Tokenization Key: PPejd3YuesXf4dT6vnsuY3F44732HTf3

Correct:
  Security Key: PPejd3YuesXf4dT6vnsuY3F44732HTf3
  Tokenization Key: Q8N5U4-543kky-kZr2CC-ns8K2Y
```

### ❌ Mistake 2: Leaving One Field Empty
```
Wrong:
  Security Key: PPejd3YuesXf4dT6vnsuY3F44732HTf3
  Tokenization Key: [empty]

Correct:
  Both fields must be filled!
```

### ❌ Mistake 3: Using Wrong Values
```
Wrong:
  Security Key: v4_merchant_N6eGFG7GwJBg5z7D6... (V4 API key)
  Tokenization Key: checkout_public_... (Checkout key)

Correct:
  Security Key: PPejd3YuesXf4dT6vnsuY3F44732HTf3
  Tokenization Key: Q8N5U4-543kky-kZr2CC-ns8K2Y
```

---

## After Saving - What to Test

### 1. Payment Page Works
```
Go to: http://localhost:5174/pay/96blK1TMqHn493Br
Expected: Payment form loads with Collect.js
```

### 2. Test Card Works
```
Card: 4111 1111 1111 1111
Expiry: 12/25
CVV: 999
Expected: Success page
```

### 3. Check Logs
```
Command: cd backend && tail -f logs/nmi-payment.log
Expected: Payment flow logged with success
```

---

## Reference - Credential Locations

### In Your System
| Key | Value | Storage |
|-----|-------|---------|
| Security Key | PPejd3Ye... | Merchant form (database) |
| Tokenization Key | Q8N5U4-5... | Merchant form (database) |

### In NMI Merchant Portal
| Type | Location | Purpose |
|------|----------|---------|
| Security Key | Security Keys → Private | Backend API auth |
| Tokenization Key | Security Keys → Tokenization | Collect.js frontend |

---

## Next Steps

1. **Open Merchant Edit**: Click Edit on "Test Beyond"
2. **Enter Security Key**: `PPejd3YuesXf4dT6vnsuY3F44732HTf3`
3. **Enter Tokenization Key**: `Q8N5U4-543kky-kZr2CC-ns8K2Y`
4. **Select Mode**: "Sandbox (Test)"
5. **Click Update**: Save the form
6. **Test Payment**: Go to `http://localhost:5174/pay/96blK1TMqHn493Br`
7. **Verify Success**: See success page or error message

---

## Still Confused?

- **Security Key** = Private (backend) = `PPejd3Ye...`
- **Tokenization Key** = Public (frontend) = `Q8N5U4-5...`

That's it! Just remember: Private key for backend, Public key for frontend.

