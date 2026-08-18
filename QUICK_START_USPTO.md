# USPTO Office Feature - Quick Start Guide

## ✅ System Status

**Backend**: Running on http://localhost:5000  
**Frontend**: Running on http://localhost:5173  
**USPTO Brand**: Created successfully (ID: `HLOQllpg3GJJ35Td`)

---

## 🚀 How to Test (Step by Step)

### Step 1: Create USPTO Invoice (As Admin)

1. Open browser: http://localhost:5173
2. Login as admin
3. Go to **Invoices** page
4. Click **"New Invoice"**
5. Select **"USPTO Office"** from brand dropdown
6. Add invoice items and customer details:
   - Customer Name: John Doe
   - Customer Email: your-email@example.com
   - Customer Serial Number: 12345
7. Click **"Create Invoice"**
8. Click the green link icon to **copy payment link**

### Step 2: Fill Payment Form (As Customer)

1. Open **new browser** or **incognito window**
2. Paste the payment link
3. **Verify** your details:
   - Name: John Doe
   - Email: your-email@example.com
   - Serial Number: 12345
4. Click **"Verify & Continue"**
5. Fill USPTO payment form:
   - **Last 4 SSN**: 1234
   - **Date of Birth**: 01/01/1990
   - **Name on Card**: John Doe
   - **Card Number**: 4111 1111 1111 1111
   - **Expiry**: 12/2025
   - **CVV**: 123
6. Click **"Submit Payment Request"**
7. You'll see: **"Processing your payment..."**
   - Screen will automatically update when OTP is sent
   - Keep this window open!

### Step 3: Send OTP (As Admin)

1. **Switch back to admin window**
2. Refresh the Invoices page
3. Find the invoice with **"Payment Requested"** badge (blue color)
4. Click the **Email OTP button** (envelope icon 📧)
5. Enter custom note (optional): "Please verify your payment"
6. Click **"Send OTP"**
7. **Important**: Note the OTP code shown in the toast notification
   - Example: "OTP Code (DEV): 123456"
   - This only appears in development mode

### Step 4: Enter OTP (As Customer)

1. **Switch to customer window**
2. Screen automatically updates to show OTP input
3. You'll see:
   - "OTP sent to your email"
   - Admin's custom note
   - 6-digit input field
4. Enter the **OTP code** from step 3
5. Click **"Proceed with Payment"**
6. See **success screen**: "Payment Successful!"

### Step 5: Verify Complete (As Admin)

1. **Switch back to admin window**
2. Refresh Invoices page
3. Invoice status is now **"paid"** (green badge ✅)

---

## 🎯 Key UI Elements

### Customer Side
- **Blue info box**: "Manual Verification Required"
- **Loading screen**: With spinning animation
- **OTP input**: Large 6-digit field with auto-focus
- **Yellow note box**: Admin's custom message

### Admin Side
- **Blue badge**: "Payment Requested" status
- **Email OTP button**: Blue envelope icon
- **SMS OTP button**: Purple message icon
- **OTP Modal**: With textarea for custom note

---

## 🔍 What Happens Behind the Scenes

1. **Payment Request**:
   - Status: `pending` → `payment_requested`
   - Card number masked: `************1111`
   - CVV replaced with: `***`
   - SSN and DOB stored

2. **OTP Generation**:
   - 6-digit random code (100000-999999)
   - 10-minute expiration
   - Stored in `otp_codes.db`
   - Email sent with code

3. **Customer Polling**:
   - Checks status every 3 seconds
   - Detects OTP sent
   - Switches screen automatically

4. **OTP Verification**:
   - Validates code exists
   - Checks not expired
   - Marks as used
   - Updates invoice to `paid`

---

## 📧 Email Example

```
Subject: USPTO Payment Verification Code

Dear John Doe,

Your USPTO payment verification code is: 123456

This code will expire in 10 minutes.

Note from admin: Please verify your payment

If you did not request this code, please ignore this email.

---
Invoice #INV-XXXXXXXX
```

---

## 🛠️ Troubleshooting

### Customer doesn't see OTP screen
- Check polling is working (every 3 seconds)
- Verify admin sent OTP
- Check browser console for errors

### Admin doesn't see OTP buttons
- Verify user is logged in as admin
- Check invoice status is `payment_requested`
- Verify brand is USPTO Office

### OTP code doesn't work
- Check code is correct (6 digits)
- Verify not expired (10 minutes)
- Ensure not already used
- Try generating new OTP

### Server not running
```bash
# Backend
cd backend
node server.js

# Frontend
cd frontend
npm run dev
```

---

## 📝 Test Credentials

### Admin User
- Username: `superadmin`
- Password: `abcd1234`

### Test Card Numbers
- Visa: `4111 1111 1111 1111`
- Mastercard: `5555 5555 5555 4444`
- Any future expiry date
- Any CVV (won't be stored)

### Test SSN
- Last 4: `1234` or any 4 digits

---

## 🔐 Security Notes

- ✅ CVV never stored
- ✅ Card numbers masked
- ✅ OTP expires in 10 minutes
- ✅ One-time use only
- ✅ Only last 4 SSN digits

---

## 📊 Database Tables Used

1. **brands.db** - USPTO Office brand
2. **invoices.db** - Invoice with payment_requested status
3. **otp_codes.db** - OTP verification codes
4. **users.db** - Admin users

---

## 🎬 Demo Video Script

1. Show admin creating USPTO invoice
2. Show customer payment form with special fields
3. Show loading screen
4. Show admin sending OTP
5. Show OTP code in toast
6. Show customer OTP input screen
7. Show payment success
8. Show invoice marked as paid

---

## ✨ Features Implemented

- ✅ USPTO brand with manual payment flag
- ✅ SSN Last 4 and DOB fields
- ✅ Card data collection (not processed)
- ✅ Payment request submission
- ✅ Real-time status polling
- ✅ Admin OTP buttons (Email & SMS)
- ✅ Custom admin notes
- ✅ OTP email delivery
- ✅ OTP verification flow
- ✅ Security measures

---

**Ready to test!** Follow the steps above and everything should work smoothly. 🚀
