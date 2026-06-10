// Migration script to add redirectUrl and enableRedirect fields to existing brands
const db = require('./src/db');

async function migrate() {
  try {
    console.log('Starting brand migration...');
    
    // Find all brands
    const brands = await db.brands.find({});
    console.log(`Found ${brands.length} brands`);
    
    let updated = 0;
    
    for (const brand of brands) {
      // Check if brand needs migration
      if (brand.redirectUrl === undefined || brand.enableRedirect === undefined) {
        console.log(`Migrating brand: ${brand.name} (${brand._id})`);
        
        await db.brands.update(
          { _id: brand._id },
          {
            $set: {
              redirectUrl: brand.redirectUrl || null,
              enableRedirect: brand.enableRedirect || false,
              updatedAt: new Date().toISOString()
            }
          }
        );
        updated++;
      }
    }
    
    console.log(`✅ Migration complete! Updated ${updated} brands`);
    
    // Verify
    const updated_brands = await db.brands.find({});
    console.log('Updated brands:');
    updated_brands.forEach(b => {
      console.log(`  - ${b.name}: redirectUrl=${b.redirectUrl}, enableRedirect=${b.enableRedirect}`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
