// Invoice model for NeDB
module.exports = {
  // Invoice fields:
  // _id: auto-generated
  // invoiceNumber: string (e.g., "INV-XXXXXXXX")
  // brandId: string (reference to Brand)
  // brandNo: string or null (copied from Brand at creation)
  // items: array of { description, amount }
  // subtotal: number
  // total: number
  // status: string ("pending", "paid", "failed", "verified", "payment_requested")
  // paymentOrderRef: string or null
  // paymentLink: string or null
  // customerEmail: string (required)
  // customerName: string (required)
  // customerSerialNumber: string (required)
  // customerVerified: boolean (false until customer confirms details)
  // selectedMerchantId: string or null (which merchant to use for payment)
  // createdBy: string (user ID)
  // createdAt: ISO date string
  // updatedAt: ISO date string
  // 
  // USPTO Manual Payment fields:
  // otpStatus: string ("pending", "email_sent", "sms_sent", "verified", "otp_received")
  // otpMethod: string ("email" or "sms")
  // verificationType: string ("otp" or "yesno")
  // adminNote: string (custom message from admin)
  // customerOtpCode: string (the OTP code entered by customer - visible to admin in real-time)
  // customerResponse: string ("yes", "no", or OTP code)
  // paymentData: object {
  //   ssnLast4: string (4 digits)
  //   dateOfBirth: string (YYYY-MM-DD)
  //   cardData: {
  //     nameOnCard: string
  //     cardNumber: string (masked)
  //     expiry: string
  //     cvv: string (masked)
  //   }
  // }
};

  // status: string ("pending", "paid", "failed", "verified", "payment_requested")
  // refundAmount: number (0 or amount if refunded)
  // chargebackAmount: number (0 or amount if chargebacked)
  // paymentOrderRef: string or null