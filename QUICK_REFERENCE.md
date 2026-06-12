# Quick Reference Card - NMI Payment Integration

## 🎯 TEST NOW
```
URL: http://localhost:5174/pay/96blK1TMqHn493Br
Card: 4111 1111 1111 1111
Expiry: 12/25
CVV: 999
Amount: $100.00
```

---

## 📊 WHAT YOU'LL SEE

### ✅ Success
```
Payment Successful!
Your payment of USD $100.00 has been processed successfully.
Transaction ID: [ID]
```

### ❌ Failure
```
Payment failed
[Error message]
Try again with different card
```

---

## 🔍 MONITOR LOGS
```bash
cd backend
tail -f logs/nmi-payment.log
```

---

## ✅ SUCCESS INDICATORS
- ✅ Green success page in browser
- ✅ "✅ PAYMENT SUCCESSFUL" in logs
- ✅ Transaction ID present
- ✅ Invoice status changes to "paid"

---

## 🚨 QUICK FIXES

| Issue | Fix |
|-------|-----|
| Setup not applied | `node backend/setup-nmi-credentials.js` |
| Collect.js not loading | Refresh browser (Ctrl+R) |
| Network error | Check internet connection |
| Card declined | Use `4111 1111 1111 1111` instead |

---

## 📞 KEY CONTACTS
- **NMI**: support@nmi.com
- **Logs**: `backend/logs/nmi-payment.log`
- **Config**: `backend/setup-nmi-credentials.js`

---

## 🔐 CREDENTIALS
| Key | Value | Use |
|-----|-------|-----|
| Security Key | `PPejd3Ye...` | Backend |
| Token Key | `Q8N5U4-...` | Frontend |
| Endpoint | `secure.nmi.com` | API |

---

## 📚 DOCUMENTATION
- `READY_TO_TEST.md` - Start here
- `ACTION_PLAN_NMI_TESTING.md` - Detailed steps
- `NMI_TESTING_GUIDE.md` - Troubleshooting

---

## ⏱️ EXPECTED TIME
- Page Load: 1-2 sec
- Collect.js: 1-2 sec
- Payment: 2-5 sec
- **Total**: 5-10 seconds

---

**Status**: ✅ READY TO TEST

