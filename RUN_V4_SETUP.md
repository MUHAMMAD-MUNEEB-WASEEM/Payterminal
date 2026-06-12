# Quick: Update V4 Credentials

## One-Command Setup

### Run this in your terminal:

```bash
cd backend && node setup-v4-credentials.js
```

## What This Does

✅ Updates merchant with V4 API credentials
✅ Sets mode to sandbox (test mode)
✅ Ready to test immediately

## Then Test

1. Go to: `http://localhost:5174/pay/96blK1TMqHn493Br`
2. Use test card: `4111 1111 1111 1111`
3. Check if payment succeeds

## Expected Results

### Success ✅
```
Status: paid
Message: Payment successful!
```

### Still Fails ❌
```
Status: failed
Message: Authentication failed - Invalid API Key or Secret
```

If still fails, V4 credentials also need BeyondBancard activation. See `V4_CREDENTIALS_TESTING.md` for next steps.

---

**Run the command above now!**
