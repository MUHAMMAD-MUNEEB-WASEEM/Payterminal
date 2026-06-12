# Quick Merchant Setup - 2 Minutes

## The Two Keys You Need

### 🔐 Security Key (Backend)
```
Where to Put: Security Key (API Key) field
Value: PPejd3YuesXf4dT6vnsuY3F44732HTf3
What It Is: Private key for backend authentication
Where From: NMI Merchant Portal → Security Keys → Private
```

### 🔑 Tokenization Key (Frontend)
```
Where to Put: Tokenization Key (Public) field
Value: Q8N5U4-543kky-kZr2CC-ns8K2Y
What It Is: Public key for Collect.js
Where From: NMI Merchant Portal → Security Keys → Tokenization
```

---

## Quick Copy-Paste

```
Security Key:      PPejd3YuesXf4dT6vnsuY3F44732HTf3
Tokenization Key:  Q8N5U4-543kky-kZr2CC-ns8K2Y
Mode:              Sandbox (Test)
```

---

## Form Fields (In Order)

1. **Nickname**: Test Beyond ✅ (already set)
2. **Gateway**: BeyondBancard ✅ (already set)
3. **Amount Limit**: 20000 ✅ (already set)
4. **Security Key**: ← **PASTE HERE** `PPejd3YuesXf4dT6vnsuY3F44732HTf3`
5. **Tokenization Key**: ← **PASTE HERE** `Q8N5U4-543kky-kZr2CC-ns8K2Y`
6. **Mode**: Sandbox (Test) ✅ (select this)
7. **Click**: Update button

---

## Quick Test After Setup

```
URL: http://localhost:5174/pay/96blK1TMqHn493Br
Card: 4111 1111 1111 1111
Expiry: 12/25
CVV: 999
Click: Pay USD $100.00
Expected: Success page ✅
```

---

## That's It!

Two keys. Two fields. Done! 🎉

