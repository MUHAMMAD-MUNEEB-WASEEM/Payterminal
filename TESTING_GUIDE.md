# USPTO Payment Terminal - Testing Guide

## 🎯 Complete Implementation

All 8 steps are now complete! The system supports multiple payment gateways with full admin control.

## 🧪 Test Mode

The system is currently in **TEST MODE**. All payment gateways accept test cards without requiring actual API credentials.

### Test Cards (All Gateways)

Use these test cards for successful payments:

- **Visa**: `4242 4242 4242 4242`
- **Mastercard**: `5555 5555 5555 4444`
- **American Express**: `3782 8224 6310 005`
- **Generic Test**: `4111 1111 1111 1111`

**Card Details:**
- **Name**: Any name
- **Expiry**: Any future date (e.g., 12/2025)
- **CVV**: Any 3-4 digits (e.g., 123)

## 🚀 How to Test

### 1. Start the Application

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### 2. Login as Admin

- URL: http://localhost:5174/login
- Click "Admin Login"
- Username: `admin`
- Password: `admin`

### 3. Set Up Payment Merchants

1. Go to **Merchants** page
2. Click "Add Merchant"
3. Create merchants:
   - **Stripe Test**
     - Nickname: "Main Stripe"
     - Gateway: Stripe
     - (Credentials optional in test mode)
   
   - **PayPal Test**
     - Nickname: "PayPal Business"
     - Gateway: PayPal
     - (Credentials optional in test mode)
   
   - **Authorize.net Test**
     - Nickname: "Authorize Gateway"
     - Gateway: Authorize
     - (Credentials optional in test mode)

### 4. Create a Brand

1. Go to **Brands** page
2. Click "Add Brand"
3. Fill in:
   - Brand Name: "Test Brand"
   - Brand No: "1001" (optional)
   - Upload a logo
4. Click the **credit card icon** on the brand
5. Assign all 3 merchants to the brand

### 5. Create a User (Optional)

1. Go to **Users** page
2. Sign up a new user or use existing
3. Approve the user
4. Click the **building icon** to assign brands to the user

### 6. Create an Invoice

1. Go to **Invoices** page
2. Click "New Invoice"
3. Fill in:
   - **Brand**: Select your brand
   - **Customer Name**: John Doe
   - **Customer Email**: john@example.com
   - **Customer Serial Number**: SN-123456
   - **Items**: Add description and amounts
4. Click "Create Invoice"

### 7. Test Payment Flow

1. Click the **link icon** on the invoice to copy payment link
2. Open the link in a new browser/incognito window
3. **Verification Step**:
   - Enter the exact customer details:
     - Name: John Doe
     - Email: john@example.com
     - Serial Number: SN-123456
   - Click "Verify & Continue"

4. **Payment Step**:
   - Review customer and invoice details
   - Select a payment gateway (Stripe/PayPal/Authorize.net)
   - Enter card details:
     - Name: Any name
     - Card: `4242 4242 4242 4242`
     - Expiry: `12/2025`
     - CVV: `123`
   - Click "Pay"

5. **Success**:
   - You'll see "Payment successful!"
   - Auto-redirects to uspto.gov after 2 seconds
   - Invoice status updates to "Paid"

## 📊 Features Implemented

### Admin Features
✅ Merchant Management (Stripe, PayPal, Authorize.net)
✅ Brand Management with logos
✅ Assign merchants to brands
✅ User Management with approval workflow
✅ Assign brands to users
✅ Full invoice management
✅ View all invoices and payments

### User Features
✅ Create invoices for assigned brands only
✅ View own invoices
✅ Copy payment links
✅ Customer details required (name, email, serial number)

### Customer Features
✅ Verify identity before payment
✅ View invoice details
✅ Select payment gateway
✅ Secure card payment
✅ Auto-redirect after success

## 🔐 Security Features

- Customer verification required
- Encrypted payment processing
- Test mode for safe testing
- Admin-only merchant configuration
- Role-based access control
- Brand-user assignments

## 🎨 Payment Gateways

### Stripe
- Icon: 💳
- Test cards accepted
- Production ready (add credentials)

### PayPal
- Icon: 🅿️
- Test cards accepted
- Production ready (add credentials)

### Authorize.net
- Icon: 🔐
- Test cards accepted
- Production ready (add credentials)

## 🔄 Switching to Production

To enable production payments:

1. **Get Real Credentials**:
   - Stripe: https://dashboard.stripe.com/apikeys
   - PayPal: https://developer.paypal.com/
   - Authorize.net: https://account.authorize.net/

2. **Update Merchant Credentials**:
   - Go to Merchants page
   - Edit each merchant
   - Add production credentials
   - Save

3. **Update .env** (optional):
   ```env
   PAYMENT_MODE=production
   ```

4. **Test with Real Cards**:
   - Use actual credit cards
   - Small amounts first
   - Monitor transactions in gateway dashboards

## 📝 Database Structure

### Collections
- `users` - User accounts
- `brands` - Brand information
- `merchants` - Payment gateway configs
- `brandMerchants` - Brand-merchant relationships
- `userBrands` - User-brand assignments
- `invoices` - Invoice records

### Invoice Statuses
- `pending` - Awaiting payment
- `paid` - Payment successful
- `failed` - Payment failed
- `verified` - Customer verified (internal)

## 🐛 Troubleshooting

### Payment Fails
- Ensure you're using a test card: `4242 4242 4242 4242`
- Check merchant is active
- Verify merchant is assigned to brand

### Verification Fails
- Enter exact details from invoice
- Check spelling and spacing
- Email must match exactly

### Can't See Brands (User)
- Admin must assign brands to user
- Check user status is "approved"
- Refresh the page

### Merchant Not Showing
- Check merchant is active
- Verify merchant is assigned to brand
- Ensure brand has merchants

## 📞 Support

For issues or questions:
1. Check this testing guide
2. Review implementation docs
3. Check browser console for errors
4. Verify backend logs

## 🎉 Success!

You now have a fully functional multi-gateway payment terminal with:
- 3 payment gateways
- Admin control panel
- User management
- Brand management
- Customer verification
- Secure payments
- Test mode for safe testing

Happy testing! 🚀
