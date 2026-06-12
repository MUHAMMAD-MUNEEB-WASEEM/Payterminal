# Collect.js Failed to Load - Troubleshooting

## The Error
"Payment system failed to load. Please refresh."

## What This Means
The Collect.js script from the CDN couldn't be downloaded. This is a **network issue**, not a code issue.

### Common Causes:
1. ❌ No internet connection
2. ❌ Firewall blocking CDN (https://cdn.collectjs.com)
3. ❌ Proxy/Corporate network issues
4. ❌ CDN temporarily down
5. ❌ Browser cache corruption

---

## Step 1: Check Browser Console (F12)

Press `F12` to open Developer Tools and look at the **Console** tab.

You should see detailed logs like:
```
📦 Starting Collect.js load...
Selected merchant: {gateway: "beyondbancard", ...}
Has tokenizationKey: true
📦 Collect.js script loaded successfully
🔷 Initializing Collect.js...
Using tokenization key: Q8N5U4-5...
✅ Collect.js initialized successfully
```

### If You See:
```
❌ Failed to load Collect.js script
❌ Script error event: ...
```
→ **Network issue - see Step 2**

---

## Step 2: Check Network Tab (F12)

In Developer Tools, click **Network** tab and reload page.

Look for: `collectjs.min.js`

### If Status is:
- ❌ **404** or **Failed** → Script URL is wrong or CDN is down
- ❌ **BLOCKED** → Firewall/VPN is blocking it
- ❌ **No entry** → Script never tried to load

### What Should Happen:
```
collectjs.min.js     Status: 200     Size: ~50KB
```

---

## Step 3: Try These Fixes

### Fix 1: Hard Refresh Browser
```
Windows/Linux: Ctrl + Shift + R
Mac: Cmd + Shift + R
```

This clears cache and reloads everything fresh.

### Fix 2: Check Internet Connection
```
Open any website to verify internet works:
- https://google.com
- https://cdn.collectjs.com (should show Collect.js site)
```

### Fix 3: Disable VPN/Proxy Temporarily
If using VPN or corporate proxy:
- Temporarily disable it
- Try payment page again
- If it works, whitelist `cdn.collectjs.com`

### Fix 4: Try Different Browser
If it only fails in one browser:
- Try Chrome, Firefox, Safari, Edge
- If it works in another, it's a browser cache issue

### Fix 5: Clear Browser Cache
1. Press `Ctrl + Shift + Delete` (Windows) or `Cmd + Shift + Delete` (Mac)
2. Select "All time"
3. Check "Cookies and other site data"
4. Click "Clear data"
5. Reload payment page

### Fix 6: Try From Different Network
If possible:
- Mobile hotspot
- Different WiFi
- Different location
This helps identify if it's a network issue.

---

## Step 4: Verify CDN is Accessible

In browser console, paste:
```javascript
fetch('https://cdn.collectjs.com/v2.0/collectjs.min.js')
  .then(r => console.log('✅ CDN accessible, status:', r.status))
  .catch(e => console.log('❌ CDN not accessible:', e.message))
```

**Expected**: `✅ CDN accessible, status: 200`  
**Error**: `❌ CDN not accessible` → Network/Firewall issue

---

## Step 5: Check If Merchant Has Tokenization Key

In browser console, open **Network** tab and filter for `merchants`.

Look for request to: `/merchants/brand/*/public`

Check the response. Should include:
```json
{
  "_id": "...",
  "nickname": "Test Beyond",
  "gateway": "beyondbancard",
  "tokenizationKey": "Q8N5U4-543kky-kZr2CC-ns8K2Y"
}
```

If `tokenizationKey` is **null** or **missing**:
1. Go to Merchants admin page
2. Click Edit on "Test Beyond"
3. Enter tokenization key: `Q8N5U4-543kky-kZr2CC-ns8K2Y`
4. Click Update
5. Refresh payment page

---

## Diagnostic Command

Check if backend is returning tokenization key:

```bash
# From backend directory
curl -X GET "http://localhost:5000/api/merchants/brand/YOUR_BRAND_ID/public"
```

Should show:
```json
[
  {
    "_id": "...",
    "tokenizationKey": "Q8N5U4-543kky-kZr2CC-ns8K2Y"
  }
]
```

---

## If Still Not Working

### Contact NMI Support With:
1. Your location/timezone
2. ISP/Network info
3. Whether CDN is accessible (from Step 4)
4. Browser console errors (from Step 1)
5. Network tab details (from Step 2)

### Try Alternative CDN (Backup):
```
Primary: https://cdn.collectjs.com/v2.0/collectjs.min.js
Backup: https://secure.nmi.com/collectjs/collectjs.min.js
```

---

## Expected Timeline

| Step | Time |
|------|------|
| Hard refresh | 5 sec |
| Check console | 1 min |
| Check network | 2 min |
| Check CDN access | 2 min |
| Clear cache | 5 min |
| **Total** | **~15 min** |

---

## What's Next

### If It Works After Fix:
1. Enter test card: `4111 1111 1111 1111`
2. Expiry: `12/25`
3. CVV: `999`
4. Click Pay

### If Still Failing:
1. Document all steps you tried
2. Check browser console output
3. Note exact error message
4. Provide this info to support

---

## Quick Checklist

- [ ] Hard refreshed browser (Ctrl+Shift+R)
- [ ] Checked browser console (F12 → Console)
- [ ] Checked network tab (F12 → Network)
- [ ] Verified internet connection
- [ ] Tried different browser
- [ ] Cleared browser cache
- [ ] Checked if VPN/proxy is blocking CDN
- [ ] Verified merchant has tokenizationKey

✅ Try these in order. Most issues resolve at step 1-3.

