# Immediate Fix - 2 Minutes

## The Problem
Collect.js script can't load from CDN.

## Quick Fixes (Try In Order)

### Fix 1: Hard Refresh (30 seconds) ⭐ TRY THIS FIRST
```
Windows/Linux: Ctrl + Shift + R
Mac: Cmd + Shift + R
```

Then reload payment page.

### Fix 2: Check Browser Console (1 minute)
1. Press `F12`
2. Click **Console** tab
3. Look for errors mentioning:
   - `collectjs`
   - `cdn.collectjs.com`
   - `Failed to load`

**Note down any errors** - this helps diagnose.

### Fix 3: Check Network Tab (1 minute)
1. Press `F12`
2. Click **Network** tab
3. Reload payment page
4. Look for `collectjs.min.js` in the list
5. Check its **Status column**:
   - ✅ `200` = Good
   - ❌ `Failed` or `Blocked` = Network issue
   - ❌ `404` = File not found

### Fix 4: Verify CDN Accessibility (1 minute)
In browser console, paste and run:
```javascript
fetch('https://cdn.collectjs.com/v2.0/collectjs.min.js')
  .then(r => console.log('Status:', r.status))
  .catch(e => console.log('Error:', e.message))
```

**Expected**: `Status: 200`  
**If error**: Your network can't reach CDN

### Fix 5: Check If Using VPN/Proxy
- If using VPN: Try disabling it
- If on corporate network: May need to whitelist `cdn.collectjs.com`
- Try different WiFi if available

### Fix 6: Clear Cache
1. `Ctrl + Shift + Delete` (Windows) or `Cmd + Shift + Delete` (Mac)
2. Select "All time"
3. Click "Clear data"
4. Reload payment page

---

## Most Likely Cause: Internet/Network Access

The CDN is blocked by:
- VPN/Proxy
- Corporate firewall
- Poor internet connection
- Browser issue

---

## After You Fix It

1. Go to: `http://localhost:5174/pay/glDbwf1kJ7ETlOYd`
2. Expected: Payment form loads with Collect.js
3. Try payment with test card: `4111 1111 1111 1111`

---

## Detailed Help
See: `COLLECTJS_LOAD_FAILED_FIX.md`

