const db = require('./src/db');

async function createUSPTOBrand() {
  try {
    console.log('Creating USPTO Office brand...');
    
    // Check if it already exists
    const existing = await db.brands.findOne({ name: 'USPTO Office' });
    
    if (existing) {
      console.log('USPTO Office brand already exists!');
      console.log('Brand ID:', existing._id);
      console.log('Is Manual Payment:', existing.isManualPayment);
      
      // Update to ensure isManualPayment is true
      await db.brands.update(
        { _id: existing._id },
        { $set: { isManualPayment: true, updatedAt: new Date().toISOString() } }
      );
      console.log('✅ Updated existing brand with isManualPayment: true');
      return;
    }
    
    // Create new USPTO Office brand
    const newBrand = await db.brands.insert({
      name: 'USPTO Office',
      brandNo: null,
      logo: null,
      isManualPayment: true,
      createdBy: null, // System created
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    console.log('✅ USPTO Office brand created successfully!');
    console.log('Brand ID:', newBrand._id);
    console.log('Name:', newBrand.name);
    console.log('Is Manual Payment:', newBrand.isManualPayment);
    
  } catch (err) {
    console.error('❌ Error creating USPTO brand:', err);
  }
  
  process.exit(0);
}

createUSPTOBrand();
