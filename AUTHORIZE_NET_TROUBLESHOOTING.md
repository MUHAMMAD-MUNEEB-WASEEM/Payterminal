# Authorize.net Authentication Error - Troubleshooting Guide

## Error Message
```
"User authentication failed due to invalid authentication values."
```

## Common Causes & Solutions

### 1. **Wrong API Credentials**
The most common cause - your API Login ID or Transaction Key is incorrect.

**Solution:**
1. Log into https://account.authorize.net/
2. Go to **Account** → **Settings** → **API Credentials and Keys**
3. Verify your API Login ID (it should look like: `87fSG8mf`)
4. If Transaction Key is hidden, click **Regenerate Transaction Key**
5. Copy the NEW Transaction Key immediately (you can't view it again)
6. Update in PayTerminal:
   - Go to Merchants page
   - Edit your Authorize.net merchant
   - Enter the correct API Login ID and Transaction Key
   - Save

### 2. **Using Sandbox Credentials in Live Mode (or vice versa)**
Sandbox and Production accounts have different credentials.

**Solution:**
- **For Testing**: Set Mode to `sandbox` and use sandbox credentials
- **For Production**: Set Mode to `live` and use production credentials

**Check your account type:**
- Sandbox URL: https://sandbox.authorize.net/
- Production URL: https://account.authorize.net/

### 3. **Whitespace or Copy-Paste Issues**
Extra spaces or hidden characters in credentials.

**Solution:**
1. When copying credentials, ensure no extra spaces
2. Trim any whitespace before/after
3. Don't include quotes or brackets

**Example:**
```
❌ Wrong: " 87fSG8mf "
❌ Wrong: "87fSG8mf"
✅ Correct: 87fSG8mf
```

### 4. **Account Not Activated**
Your Authorize.net account might not be fully activated.

**Solution:**
1. Check your email for activation instructions
2. Complete account verification
3. Ensure account is in "Active" status
4. For production, ensure you've completed merchant setup

### 5. **IP Restrictions**
Some accounts have IP whitelist restrictions.

**Solution:**
1. Log into Authorize.net
2. Go to **Account** → **Settings** → **Security Settings**
3. Check if IP restrictions are enabled
4. Add your server's IP address to whitelist
5. Or disable IP restrictions for testing

### 6. **Expired or Revoked Credentials**
Transaction keys can expire or be revoked.

**Solution:**
1. Generate a new Transaction Key
2. Update in PayTerminal immediately
3. Old keys become invalid once new one is generated

## Testing Steps

### Step 1: Verify Credentials Format
```javascript
API Login ID: Should be 8-10 characters (letters/numbers)
Transaction Key: Should be 16 characters (letters/numbers)
```

### Step 2: Test in Sandbox Mode First
1. Create merchant with Mode: `sandbox`
2. Use sandbox credentials
3. Test with card: `4007000000027`
4. Should process successfully

### Step 3: Check Backend Logs
Look for these log messages in your backend console:
```
Authorize.net Payment Request: {
  mode: 'live',
  amount: 100,
  hasApiLoginId: true,
  hasTransactionKey: true
}
```

If `hasApiLoginId` or `hasTransactionKey` is `false`, credentials aren't being passed correctly.

### Step 4: Verify Merchant Configuration
In PayTerminal admin:
1. Go to Merchants page
2. Find your Authorize.net merchant
3. Click Edit
4. Verify:
   - API Login ID is filled
   - Transaction Key is filled (shows as password dots)
   - Mode is correct (sandbox or live)

## Quick Fix Checklist

- [ ] Logged into correct Authorize.net account (sandbox vs production)
- [ ] Copied API Login ID exactly (no spaces)
- [ ] Generated NEW Transaction Key
- [ ] Copied Transaction Key immediately (can't view again)
- [ ] Updated credentials in PayTerminal merchant
- [ ] Set correct Mode (sandbox or live)
- [ ] Saved merchant configuration
- [ ] Tested with appropriate test card
- [ ] Checked backend console for errors

## Test Cards by Mode

### Sandbox Mode
Use these Authorize.net test cards:
- **Visa**: `4007000000027`
- **Mastercard**: `5424000000000015`
- **Amex**: `370000000000002`
- **Discover**: `6011000000000012`

### Live Mode
Use real credit cards (will charge actual money!)

## Still Not Working?

### Check Account Status
1. Log into Authorize.net
2. Look for any alerts or warnings
3. Verify account is "Active"
4. Check if there are any pending actions

### Contact Authorize.net Support
If credentials are definitely correct:
1. Call: 1-877-447-3938
2. Email: merchant@authorize.net
3. Provide:
   - Your API Login ID (safe to share)
   - Error message
   - When it started happening
   - **DO NOT share Transaction Key**

### Use Test Mode Instead
For development/testing, use PayTerminal's built-in test mode:
1. Set Mode to `sandbox`
2. Leave credentials empty or use dummy values
3. Use test cards: `4242 4242 4242 4242`
4. System will simulate successful payments

## Security Reminder

⚠️ **NEVER share your Transaction Key publicly!**
- Don't post in chat/forums
- Don't commit to git
- Don't email unencrypted
- Regenerate if accidentally exposed

## Updated Code

I've updated the Authorize.net integration to:
- ✅ Add detailed logging
- ✅ Support both sandbox and live modes
- ✅ Set correct API endpoint based on mode
- ✅ Better error messages
- ✅ More test cards supported

Restart your backend server to use the updated code:
```bash
cd backend
# Stop current server (Ctrl+C)
node server.js
```

## Next Steps

1. **Regenerate your credentials** (since they were exposed)
2. **Update in PayTerminal** with new credentials
3. **Test in sandbox mode first**
4. **Check backend logs** for detailed error info
5. **Contact Authorize.net** if still failing

The authentication error should be resolved once you have the correct credentials entered!
