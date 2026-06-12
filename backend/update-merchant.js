const Datastore = require('nedb');
const path = require('path');

// Initialize the merchants database
const merchantsDb = new Datastore({
  filename: path.join(__dirname, 'data', 'merchants.db'),
  autoload: true
});

const merchantId = 'R2uYnSvxeIzUObOQ';
const newCredentials = {
  apiKey: 'PPejd3YuesXf4dT6vnsuY3F44732HTf3',
  apiSecret: 'v4_merchant_N6eGFG7GwJBg5z7D6cj2aZCcmtau9hew'
};

// Update the merchant
merchantsDb.update(
  { _id: merchantId },
  { $set: { credentials: newCredentials, updatedAt: new Date().toISOString() } },
  { upsert: false },
  (err, numReplaced) => {
    if (err) {
      console.error('Error updating merchant:', err);
      process.exit(1);
    }

    if (numReplaced === 0) {
      console.error(`Merchant with ID ${merchantId} not found`);
      process.exit(1);
    }

    console.log(`✓ Merchant updated successfully (${numReplaced} record modified)`);

    // Retrieve and display the updated merchant
    merchantsDb.findOne({ _id: merchantId }, (err, merchant) => {
      if (err) {
        console.error('Error retrieving merchant:', err);
        process.exit(1);
      }

      console.log('\n=== Updated Merchant Details ===');
      console.log(JSON.stringify(merchant, null, 2));
      process.exit(0);
    });
  }
);
