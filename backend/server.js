require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./src/db');

const app = express();

// Allow all origins for now (can restrict later if needed)
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'PayTerminal API is running',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      users: '/api/users',
      brands: '/api/brands',
      invoices: '/api/invoices',
      merchants: '/api/merchants',
      userBrands: '/api/user-brands',
      notifications: '/api/notifications'
    }
  });
});

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/users', require('./src/routes/users'));
app.use('/api/brands', require('./src/routes/brands'));
app.use('/api/invoices', require('./src/routes/invoices'));
app.use('/api/merchants', require('./src/routes/merchants'));
app.use('/api/user-brands', require('./src/routes/userBrands'));
app.use('/api/notifications', require('./src/routes/notifications'));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

async function start() {
  // Seed admin user on first run
  const existing = await db.users.findOne({ username: 'admin' });
  if (!existing) {
    const hashed = await bcrypt.hash('admin', 10);
    await db.users.insert({
      username: 'admin',
      email: 'admin@uspto.com',
      password: hashed,
      role: 'admin',
      status: 'approved',
      createdAt: new Date().toISOString(),
    });
    console.log('✅ Admin user created: admin / admin');
  }

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log('📦 Using embedded NeDB (no MongoDB required)');
  });
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
