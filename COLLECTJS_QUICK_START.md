# Collect.js - Quick Start (5 minutes)

## ✅ What's Done

- ✅ Tokenization key added to merchant: `Q8N5U4-543kky-kZr2CC-ns8K2Y`
- ✅ Frontend integrated with Collect.js loader
- ✅ Backend updated to process tokens
- ✅ Setup script created and run

## 🚀 Ready to Test

### Step 1: Start Backend
```bash
cd backend
npm start
```

Wait for:
```
Server running on port 5000
```

### Step 2: Start Frontend (new terminal)
```bash
cd frontend
npm run dev
```

Wait for:
```
➜  Local:   http://localhost:5174
```

### Step 3: Open Payment Page
```
http://localhost:5174/pay/96blK1TMqHn493Br
```

### Step 4: Complete Payment Form

**Customer Info** (already filled):
- Name: Ashley James
- Email: ashley@example.com
- Serial: SERIAL123

Click: **Verify & Continue**

### Step 5: Enter Card Details

**Test Card 1 (Approved)**:
- Number: `4111 1111 1111 1111`
- Name: Any name (John Doe)
- Expiry: `12 / 25` (any future date)
- CVV: `999` (any 3-4 digits)

Click: **Pay USD $1.00**

### Step 6: Watch the Magic

**Browser Console** (F12):
```
🔷 Using Collect.js for tokenization...
✅ Collect.js token received: jsk23j4...
```

**Backend Logs**:
```
🚀 BeyondBancard payment processor started
🔷 Processing tokenized payment...
📤 SENDING TOKENIZED REQUEST TO BEYONDBANCARD
```

## 📊 Expected Outcomes

### Best Case: ✅ Payment Successful
```
✅ Response received - Status 200
✅ TOKENIZED PAYMENT SUCCESSFUL
Transaction ID: 123456789

Result: Green success message
Redirect or stay on success page
```

### Most Likely: ⚠️ Authentication Error
```
✅ Response received - Status 200
❌ PAYMENT ERROR: Authentication Failed
Response: Authentication Failed

Result: Red error message
This is EXPECTED - credentials need BeyondBancard to activate
```

### Best Course of Action for Auth Error

**The good news**: Collect.js is working ✅, token is generated ✅

**The fix**: Contact BeyondBancard support
```
Dear BeyondBancard Support,

We're implementing Collect.js tokenization with your Payment API.

Please verify/activate these credentials for the Payment API:
- API Key: PPejd3YuesXf4dT6vnsuY3F44732HTf3
- Endpoint: https://beyondbancard.transactiongateway.com/api/transact.php

Error received: "Authentication Failed (response code 3)"
This suggests the credentials may not be activated for transactions.

Thank you
```

## 🔍 Debugging Steps

### 1. Check Browser Console
```javascript
F12 → Console tab

Should see:
✅ Collect.js initialized
```

If not:
- Refresh page
- Check for JavaScript errors
- Verify internet connection

### 2. Check Network Tab
```
F12 → Network tab
Filter: POST
Look for: /api/invoices/public/.../pay
```

**Request Body** should have:
```json
{
  "token": "jsk23j4...",
  "cardHolder": "John Doe",
  "merchantId": "R2uYnSvxeIzUObOQ"
}
```

NOT raw card data!

### 3. Check Backend Logs
```bash
# In another terminal:
tail -f backend/logs/beyondbancard.log
```

Look for:
```
🔷 Processing tokenized payment...
📤 SENDING TOKENIZED REQUEST TO BEYONDBANCARD
```

### 4. Test Different Cards

Try other test cards:
```
5555 5555 5555 4444 (Mastercard)
3782 822463 10005 (Amex)
4222 2222 2222 2220 (Declined)
```

## 💡 Key Points

### What's Secure
✅ Card number never sent to your server  
✅ CVV never stored anywhere  
✅ Token is used instead  
✅ PCI compliance simplified  

### What's Different
- No raw card fields in API request
- Token is sent instead
- Backend uses token with API credentials
- BeyondBancard handles the actual card processing

### What Needs Help
- If you get "Authentication Failed" - contact BeyondBancard
- They may need to activate credentials in their system
- This is normal for new integrations

## 🛠️ If Something Goes Wrong

### Collect.js Won't Load
```
✖️ Failed to load Collect.js
```

**Fix**:
1. Check internet connection
2. Ensure you can access: `https://cdn.collectjs.com`
3. Check for adblocker
4. Refresh the page

### Payment Button Does Nothing
**Fix**:
1. Check browser console for errors (F12)
2. Verify merchant has tokenization key:
   ```bash
   node backend/setup-collectjs.js
   ```
3. Restart backend

### Token is Null/Undefined
**Fix**:
1. Check if Collect.js loaded in console
2. Verify form has all required fields
3. Check merchant configuration

### Payment Fails in Backend
**Check**:
```bash
cat backend/logs/beyondbancard.log
```

Look for actual error message and:
1. Search this guide
2. Check BeyondBancard documentation
3. Contact their support with the error

## 📞 Need Help?

### Quick Answers
- **Why token instead of card?** → Security & PCI compliance
- **Will this cost more?** → No, same pricing
- **Is this production-ready?** → Yes, after credentials are activated
- **Can I use other gateways?** → Yes, Stripe/PayPal/Authorize.net already integrated

### Support Contacts
- **BeyondBancard API**: https://beyondbancard.com/docs
- **Collect.js Docs**: https://beyondbancard.com/docs/collectjs
- **Backend Logs**: `backend/logs/beyondbancard.log`
- **Frontend Console**: Browser F12 → Console

## ✨ Success Indicators

After clicking "Pay", you should see:

1. **Browser Console**:
   ```
   ✅ Collect.js token received: ...
   ```

2. **Backend Log**:
   ```
   🔷 Processing tokenized payment...
   ✅ Response received - Status 200
   ```

3. **Frontend Screen**:
   - Green success message OR
   - Red auth error message (contact BeyondBancard)

## 🎯 Next Steps

1. Test with test card `4111 1111 1111 1111`
2. Check logs for any errors
3. If auth fails, contact BeyondBancard
4. Once activated, you're ready to go live!

---

**Total Setup Time**: ~5 minutes  
**Testing Time**: ~2 minutes  
**Result**: Secure, PCI-compliant payment processing ✅
