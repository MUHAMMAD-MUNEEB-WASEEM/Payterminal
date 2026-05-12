require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./src/db');

const app = express();

app.use(cors({
  origin: (origin, callback) => {
    // Allow any localhost origin or no origin (e.g. curl)
    if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
