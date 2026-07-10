# Phone and Email Field Fix for BeyondBancard/NMI Payments

## Issue
BeyondBancard (NMI Gateway) was returning sequential errors:
1. First: `Payment error - The phone field is required REFID:92399344`
2. Then: `Payment error - The email field is required REFID:92410267`

This was happening because the NMI payment gateway requires both phone and email fields, but they weren't being sent.

## Root Cause
The system uses two utilities for BeyondBancard:
1. `backend/src/utils/beyondbancard.js` - For NMI Gateway API
2. **`backend/src/utils/nmi-payment.js`** - **The actual one being used**

The invoice route calls **`nmi-payment.js`**, not `beyondbancard.js`, so updates needed to be made to the correct file.

## Solution
Added phone number field support to the payment flow:

### Frontend Changes (`frontend/src/pages/PublicInvoice.jsx`)

1. **Added phone to card data state**:
   ```javascript
   const [cardData, setCardData] = useState({
     // ... other fields
     phone: '',
   });
   ```

2. **Added phone input field in billing form**:
   - Added a phone number field after the Country field
   - Made it **required** for BeyondBancard payments
   - Made it optional for other payment gateways
   - Shows helpful text: "Required for BeyondBancard payments"

3. **Included phone in payment payload**:
   - Phone is now sent to backend in both payment methods (raw card and BeyondBancard-specific)

### Backend Changes

#### Invoice Route (`backend/src/routes/invoices.js`)
1. **Added phone to request extraction**:
   ```javascript
   const { 
     // ... other fields
     phone
   } = req.body;
   ```

2. **Included phone AND email in payment data**:
   ```javascript
   const paymentData = {
     // ... other fields
     email: invoice.customerEmail, // From verified invoice
     phone: phone || '',
   };
   ```

#### NMI Payment Utility (`backend/src/utils/nmi-payment.js`) - **THE ACTUAL FILE USED**
1. **Added phone, email, and billing details to tokenized payment request**:
   ```javascript
   const paymentRequest = {
     // ... other fields
     first_name: paymentData.firstName || ...,
     last_name: paymentData.lastName || ...,
     email: paymentData.email || '',
     address1: paymentData.addressLine1 || '',
     address2: paymentData.addressLine2 || '',
     city: paymentData.city || '',
     state: paymentData.state || '',
     zip: paymentData.postalCode || '',
     country: paymentData.countryCode || 'US',
     phone: paymentData.phone || '',
   };
   ```

2. **Added phone, email, and billing details to raw card payment request**:
   - Same fields as above for non-tokenized payments

## Testing
1. Navigate to any invoice payment page
2. Verify customer details
3. Fill out the billing information form
4. **Enter a phone number** in the Phone Number field (required for BeyondBancard)
5. Fill out card details
6. Submit payment

The payment should now process successfully with BeyondBancard without the phone field error.

## Notes
- Phone number is **required only for BeyondBancard** payments (conditional validation)
- Phone number is **optional** for other payment gateways (Stripe, PayPal, Authorize.net)
- The field shows different label text based on the selected merchant:
  - BeyondBancard: "Phone Number *" (with helper text)
  - Others: "Phone Number (Optional)"

## Impact
✅ BeyondBancard/NMI payments now work without phone or email field errors
✅ Other payment gateways continue to work as before
✅ Phone number is properly validated and sent to the NMI API
✅ Email is automatically taken from the verified invoice customer email
✅ All billing address fields are properly sent to NMI
✅ NMI gateway now receives all required fields: phone, email, address, city, state, zip, country
