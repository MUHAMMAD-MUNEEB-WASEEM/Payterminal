# PayTerminal - Invoice & Payment Management Platform

Complete payment terminal solution for creating and managing invoices and payments for companies with user access control, dynamic merchants, brands, and real-time payment links.

## 🚀 Features

- **Multi-Brand Management** - Manage multiple brands with custom logos
- **Dynamic Merchant System** - Support for Stripe, PayPal, and Authorize.net
- **Amount Limits & Failover** - Set merchant limits with automatic failover
- **User Access Control** - Role-based permissions with admin approval
- **Invoice Management** - Create, track, and manage invoices
- **Real-Time Payment Links** - Secure payment pages with customer verification
- **Admin Notifications** - Real-time alerts for merchant limits
- **Test Mode** - Built-in test mode with dummy card support

## 🛠️ Tech Stack

- **Backend**: Node.js + Express + NeDB (embedded database)
- **Frontend**: React + Vite + Tailwind CSS
- **Payments**: Stripe, PayPal, Authorize.net (multi-gateway support)

## 📋 Prerequisites

- Node.js v18+
- No external database required (uses embedded NeDB)

## ⚡ Quick Start

### 1. Backend
```bash
cd backend
npm install
node server.js
```
Server runs on http://localhost:5000

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on http://localhost:5174

## 🔐 Default Credentials

**Admin Account:**
- Username: `admin`
- Password: `admin`

**Test Payment Cards:**
- Visa: `4242 4242 4242 4242`
- Mastercard: `5555 5555 5555 4444`
- Amex: `3782 822463 10005`
- Authorize.net: `4111 1111 1111 1111`
- Any future expiry date, any CVV

## 👥 User Roles

### Admin
- Manage brands (create, edit, delete, assign merchants)
- Manage merchants (create, edit, set limits, assign to brands)
- Manage users (approve, reject, assign brands)
- View all invoices
- Create invoices for any brand
- Receive merchant limit notifications

### Regular User
- Create invoices for assigned brands only
- View own invoices only
- Cannot manage brands, merchants, or users

## 🎯 Workflow

### Admin Setup
1. **Login as Admin** → http://localhost:5174/login
2. **Create Merchants** → Add payment gateways (Stripe, PayPal, Authorize.net)
3. **Set Merchant Limits** → Optional amount limits with auto-failover
4. **Create Brands** → Add company brands with logos
5. **Assign Merchants to Brands** → Link payment methods to brands
6. **Approve Users** → Review and approve user registrations
7. **Assign Brands to Users** → Give users access to specific brands

### User Workflow
1. **Sign Up** → Create account (pending approval)
2. **Wait for Approval** → Admin approves account
3. **Login** → Access dashboard
4. **Create Invoice** → Select brand, add items, enter customer details
5. **Copy Payment Link** → Share with customer
6. **Track Status** → Monitor payment status

### Customer Payment
1. **Open Payment Link** → Receive link from company
2. **Verify Identity** → Enter name, email, serial number
3. **Enter Card Details** → Secure payment form
4. **Complete Payment** → Auto-redirect after success

## 💰 Merchant Limit System

### How It Works
- Set amount limits for each merchant (e.g., $10,000)
- System tracks processed amounts in real-time
- When limit reached:
  - Admin receives notification
  - Merchant automatically skipped
  - Next merchant in priority order is used
- Admin can reset processed amounts anytime

### Example Scenario
```
Brand: Company A
Merchants:
  1. Stripe Main (Limit: $10,000) - Priority 1
  2. PayPal Backup (Limit: $5,000) - Priority 2
  3. Authorize Reserve (No limit) - Priority 3

Flow:
- Invoices 1-50 → Stripe Main ($10,000 total) ✓
- Invoice 51 → Stripe skipped → PayPal Backup ✓
- Admin notified: "Stripe Main reached limit"
- Invoices continue with PayPal until its limit
- Then automatically switches to Authorize Reserve
```

## 🧪 Test Mode

Currently in **test mode**:
- Accepts test cards without real charges
- No actual payment processing
- Instant approval for testing

### Test Cards by Gateway
- **Stripe**: 4242 4242 4242 4242
- **PayPal**: 5555 5555 5555 4444
- **Authorize.net**: 4111 1111 1111 1111

## 📁 Project Structure

```
├── backend/
│   ├── src/
│   │   ├── db.js              # NeDB database
│   │   ├── routes/            # API routes
│   │   │   ├── auth.js
│   │   │   ├── brands.js
│   │   │   ├── invoices.js
│   │   │   ├── merchants.js
│   │   │   ├── users.js
│   │   │   ├── userBrands.js
│   │   │   └── notifications.js
│   │   ├── middleware/        # Auth middleware
│   │   ├── models/            # Data models
│   │   └── utils/             # Payment gateways
│   │       ├── stripe.js
│   │       ├── paypal.js
│   │       └── authorize.js
│   ├── data/                  # Database files (auto-created)
│   ├── uploads/               # Brand logos
│   ├── server.js              # Express server
│   └── .env                   # Configuration
│
└── frontend/
    ├── src/
    │   ├── pages/             # React pages
    │   │   ├── Landing.jsx
    │   │   ├── Login.jsx
    │   │   ├── Dashboard.jsx
    │   │   ├── Brands.jsx
    │   │   ├── Merchants.jsx
    │   │   ├── Users.jsx
    │   │   ├── Invoices.jsx
    │   │   └── PublicInvoice.jsx
    │   ├── components/        # Reusable components
    │   │   ├── Layout.jsx
    │   │   ├── Modal.jsx
    │   │   └── InvoiceView.jsx
    │   ├── context/           # Auth context
    │   └── api/               # Axios config
    └── public/
```

## 🔧 Configuration

Edit `backend/.env`:

```env
PORT=5000
JWT_SECRET=your-secret-key
FRONTEND_URL=http://localhost:5174
```

## 📝 API Endpoints

### Public
- `GET /api/invoices/public/:id` - View invoice
- `POST /api/invoices/public/:id/verify` - Verify customer
- `POST /api/invoices/public/:id/pay` - Process payment
- `GET /api/merchants/brand/:brandId/public` - Get available merchants

### Authenticated
- `POST /api/auth/login` - Login
- `POST /api/auth/signup` - Register
- `GET /api/invoices` - List invoices (filtered by user)
- `POST /api/invoices` - Create invoice
- `GET /api/user-brands/my-brands` - Get user's assigned brands

### Admin Only
- `GET /api/brands` - List brands
- `POST /api/brands` - Create brand
- `GET /api/merchants` - List merchants
- `POST /api/merchants` - Create merchant
- `PATCH /api/merchants/:id` - Update merchant (including limits)
- `GET /api/users` - List users
- `PATCH /api/users/:id/status` - Approve/reject user
- `GET /api/notifications` - Get notifications
- `GET /api/notifications/unread-count` - Get unread count

## 🎨 UI Theme

- Primary: Blue (#2563EB)
- Success: Green
- Warning: Yellow
- Danger: Red
- Clean, professional design with real-time updates

## 📄 License

MIT

## 🤝 Support

For issues or questions, contact your development team.

