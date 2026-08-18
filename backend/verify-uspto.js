const db = require('./src/db');

async function verifyUSPTO() {
  try {
    console.log('\n=== USPTO Brand Verification ===\n');
    
    // Find USPTO brand
    const usptoBrand = await db.brands.findOne({ name: 'USPTO Office' });
    
    if (!usptoBrand) {
      console.log('❌ USPTO Office brand NOT FOUND');
      console.log('Run: node create-uspto-brand.js');
      return;
    }
    
    console.log('✅ USPTO Office Brand Found!');
    console.log('---');
    console.log('Brand ID:', usptoBrand._id);
    console.log('Name:', usptoBrand.name);
    console.log('Is Manual Payment:', usptoBrand.isManualPayment);
    console.log('Created At:', usptoBrand.createdAt);
    console.log('---\n');
    
    // Check for payment_requested invoices
    const paymentRequestedInvoices = await db.invoices.find({ 
      status: 'payment_requested' 
    });
    
    console.log(`📋 Payment Requested Invoices: ${paymentRequestedInvoices.length}`);
    
    if (paymentRequestedInvoices.length > 0) {
      console.log('\nPending Verifications:');
      paymentRequestedInvoices.forEach(inv => {
        console.log(`  - ${inv.invoiceNumber} (${inv.customerName})`);
        console.log(`    OTP Status: ${inv.otpStatus || 'pending'}`);
        console.log(`    Brand: ${inv.brand?.name || 'N/A'}`);
      });
    }
    
    // Check OTP codes
    const otpCodes = await db.otpCodes.find({});
    console.log(`\n🔐 Total OTP Codes Generated: ${otpCodes.length}`);
    
    if (otpCodes.length > 0) {
      const activeOTPs = otpCodes.filter(otp => !otp.used && new Date(otp.expiresAt) > new Date());
      const expiredOTPs = otpCodes.filter(otp => !otp.used && new Date(otp.expiresAt) <= new Date());
      const usedOTPs = otpCodes.filter(otp => otp.used);
      
      console.log(`  Active: ${activeOTPs.length}`);
      console.log(`  Expired: ${expiredOTPs.length}`);
      console.log(`  Used: ${usedOTPs.length}`);
    }
    
    console.log('\n=== Verification Complete ===\n');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
  
  process.exit(0);
}

verifyUSPTO();
