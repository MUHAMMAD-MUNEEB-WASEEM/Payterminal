# ✅ NMI Setup - The Right Way

You discovered the issue: **BeyondBancard is powered by NMI**, and we should use **NMI's security_key method** instead of the API Key/Secret combo.

## Why This Works

- ✅ NMI's native method (more reliable)
- ✅ Simpler format (security_key only)
- ✅ Works with Collect.js tokens
- ✅ Better error handling

## Setup (1 command)

```bash
cd backend && node setup-nmi-credentials.js
```

**What it does**:
- Updates merchant to use NMI method
- Sets security_key: `PPejd3YuesXf4dT6vnsuY3F44732HTf3`
- Uses NMI endpoint: `secure.nmi.com`
- Ready for testing

## Then Test

1. Go to: `http://localhost:5174/pay/96blK1TMqHn493Br`
2. Test card: `4111 1111 1111 1111`
3. Expected: ✅ Success or ⚠️ clear error

## Expected Results

| Result | Meaning |
|--------|---------|
| ✅ Green success | Payment approved by NMI |
| ⚠️ Red error | NMI rejected (check logs) |
| ❌ Network error | NMI unreachable |

---

**Run the setup command now!** 🚀
