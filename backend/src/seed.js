const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const existing = await User.findOne({ username: 'admin' });
  if (!existing) {
    const admin = new User({
      username: 'admin',
      email: 'admin@uspto.com',
      password: 'admin',
      role: 'admin',
      status: 'approved',
    });
    await admin.save();
    console.log('Admin user created: admin / admin');
  } else {
    console.log('Admin already exists');
  }

  await mongoose.disconnect();
}

seed().catch(console.error);
