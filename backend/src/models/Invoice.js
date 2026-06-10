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
  // status: string ("pending", "paid", "failed", "verified")
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
};

  // status: string ("pending", "paid", "failed", "verified")
  // refundAmount: number (0 or amount if refunded)
  // chargebackAmount: number (0 or amount if chargebacked)
  // paymentOrderRef: string or null