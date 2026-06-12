const db = require('./src/db');

// Find the most recent invoice
db.invoices.find({}, { createdAt: -1 }, (err, invoices) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }
  
  if (invoices.length === 0) {
    console.log('No invoices found');
    process.exit(0);
  }
  
  const latest = invoices[0];
  console.log('\n=== LATEST INVOICE ===');
  console.log('Invoice Number:', latest.invoiceNumber);
  console.log('Total:', latest.total);
  console.log('Subtotal:', latest.subtotal);
  console.log('Items:', JSON.stringify(latest.items, null, 2));
  console.log('\n=== RAW DATABASE VALUES ===');
  console.log('Total (raw):', latest.total, 'Type:', typeof latest.total);
  console.log('Items[0].amount (raw):', latest.items?.[0]?.amount, 'Type:', typeof latest.items?.[0]?.amount);
  
  process.exit(0);
});
