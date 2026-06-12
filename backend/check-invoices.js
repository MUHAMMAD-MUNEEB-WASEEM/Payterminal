const db = require('./src/db');

async function checkInvoices() {
  try {
    console.log('Checking invoices in database...\n');
    
    const invoices = await db.invoices.find({});
    
    if (invoices.length === 0) {
      console.log('❌ No invoices found in database!');
      console.log('\nYou need to:');
      console.log('1. Log in to http://localhost:3000');
      console.log('2. Create an invoice in Dashboard or Invoices page');
      console.log('3. Get the invoice ID from the list');
      console.log('4. Use that ID in the payment URL');
      return;
    }
    
    console.log(`✅ Found ${invoices.length} invoice(s):\n`);
    
    invoices.forEach((inv, i) => {
      console.log(`${i + 1}. Invoice: ${inv.invoiceNumber}`);
      console.log(`   ID: ${inv._id}`);
      console.log(`   Amount: $${inv.total}`);
      console.log(`   Status: ${inv.status}`);
      console.log(`   Customer: ${inv.customerName}`);
      console.log(`   Payment URL: http://localhost:5173/pay/${inv._id}`);
      console.log('');
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

checkInvoices();
