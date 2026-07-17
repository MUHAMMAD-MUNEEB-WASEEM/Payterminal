# Merchant Credential Edit Toggle Feature

## 🎯 Feature Overview
Added a toggle switch in the Edit Merchant modal to prevent accidental editing of API credentials. By default, all credential fields are disabled (read-only) when editing an existing merchant. Admin users must explicitly enable credential editing by toggling the switch.

---

## ✅ Implementation

### Changes Made

**File**: `frontend/src/pages/Merchants.jsx`

1. **Added State Variable**:
```javascript
const [enableCredentialEdit, setEnableCredentialEdit] = useState(false);
```

2. **Reset Toggle on Modal Open**:
```javascript
const handleEdit = (merchant) => {
  setEditingMerchant(merchant);
  setFormData({
    nickname: merchant.nickname,
    gateway: merchant.gateway,
    credentials: merchant.credentials?.configured ? {} : merchant.credentials || {},
    amountLimit: merchant.amountLimit || '',
    ticketSize: merchant.ticketSize || ''
  });
  setEnableCredentialEdit(false); // Reset to disabled
  setShowModal(true);
};
```

3. **Added Toggle UI** (shown only when editing):
```jsx
{editingMerchant && (
  <div className="border-t border-b border-gray-200 py-4">
    <label className="flex items-center justify-between cursor-pointer">
      <div>
        <span className="text-sm font-medium text-gray-700">Enable Credential Editing</span>
        <p className="text-xs text-gray-500 mt-1">Toggle on to modify API keys and credentials</p>
      </div>
      <div className="relative">
        <input
          type="checkbox"
          checked={enableCredentialEdit}
          onChange={(e) => setEnableCredentialEdit(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
      </div>
    </label>
  </div>
)}
```

4. **Added Disabled State to All Credential Fields**:

All credential input fields for all gateways (Stripe, PayPal, Authorize.net, BeyondBancard/NMI) now include:
```javascript
disabled={editingMerchant && !enableCredentialEdit}
className="... disabled:bg-gray-100 disabled:cursor-not-allowed"
```

---

## 🎨 UI Behavior

### When Creating New Merchant
- Toggle is **NOT shown**
- All credential fields are **enabled** (editable)
- User can enter credentials normally

### When Editing Existing Merchant

**By Default**:
- Toggle is **visible** and **OFF** (gray)
- All credential fields are **disabled** (gray background, cursor-not-allowed)
- User can still edit: nickname, gateway (dropdown), amount limit, ticket size
- User **cannot** edit: API keys, secrets, tokens, mode

**When Toggle is ON**:
- Toggle turns **blue**
- All credential fields become **enabled** (white background, editable)
- User can now modify API keys and credentials

---

## 📋 Fields Affected by Toggle

### Stripe
- ✅ Secret Key (disabled when toggle off)
- ✅ Publishable Key (disabled when toggle off)

### PayPal
- ✅ Client ID (disabled when toggle off)
- ✅ Client Secret (disabled when toggle off)
- ✅ Mode (disabled when toggle off)

### Authorize.net
- ✅ API Login ID (disabled when toggle off)
- ✅ Transaction Key (disabled when toggle off)
- ✅ Mode (disabled when toggle off)

### BeyondBancard/NMI
- ✅ Security Key (disabled when toggle off)
- ✅ Tokenization Key (disabled when toggle off)
- ✅ Mode (disabled when toggle off)

---

## 🧪 Testing Instructions

### Test 1: Create New Merchant
1. Click "Add Merchant"
2. **Expected**: NO toggle visible
3. Fill in nickname, select gateway
4. **Expected**: All credential fields are editable
5. Enter credentials
6. Click "Create"
7. **Expected**: Merchant created successfully

### Test 2: Edit Merchant - Credentials Disabled
1. Click "Edit" on any existing merchant
2. **Expected**: Toggle visible and OFF (gray)
3. **Expected**: All credential fields are grayed out (disabled)
4. Try clicking on credential fields
5. **Expected**: Cannot type (cursor shows not-allowed)
6. Edit nickname or amount limit
7. **Expected**: These fields work normally
8. Click "Update"
9. **Expected**: Changes saved, credentials unchanged

### Test 3: Edit Merchant - Enable Credentials
1. Click "Edit" on any existing merchant
2. Toggle is OFF by default
3. Click the toggle switch
4. **Expected**: Toggle turns blue (ON state)
5. **Expected**: All credential fields become white (enabled)
6. Modify any credential (e.g., Secret Key)
7. Click "Update"
8. **Expected**: Merchant updated with new credentials

### Test 4: Toggle Reset on Reopen
1. Edit a merchant
2. Turn toggle ON
3. Close modal without saving
4. Edit the same merchant again
5. **Expected**: Toggle is OFF again (reset)

---

## 💡 Benefits

1. **Prevents Accidental Changes**: Credentials are protected by default
2. **Clear Intent**: Admin must explicitly enable editing
3. **Visual Feedback**: Gray background clearly shows disabled state
4. **Maintains Workflow**: Non-credential fields remain editable
5. **Security**: Reduces risk of accidentally modifying production keys

---

## 🎯 Use Cases

### Safe Scenario
Admin wants to update merchant's amount limit:
1. Open edit modal
2. Update amount limit field
3. Save changes
4. ✅ Credentials remain unchanged (toggle was off)

### Intentional Credential Update
Admin needs to update expired API key:
1. Open edit modal
2. Enable toggle switch
3. Update API key
4. Save changes
5. ✅ Credentials updated successfully

---

## 📊 Current Status

- **Status**: ✅ Complete and ready for testing
- **File Modified**: `frontend/src/pages/Merchants.jsx`
- **Backend Changes**: None required
- **Testing**: Ready for admin user testing

---

## 🔄 Frontend Server Status

To see the changes, ensure:
- Frontend server is running (Terminal 8)
- Browser cache is cleared
- Navigate to http://localhost:5173

If changes don't appear, clear browser cache completely:
1. `Ctrl + Shift + Delete`
2. Select "All time"
3. Clear all data
4. Restart browser

---

**Feature Complete! Test by editing any merchant and observing the toggle behavior.** 🎉
