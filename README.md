# Shopify Order Dashboard

A full-stack web application for managing Shopify orders with PostgreSQL database integration and OAuth authentication.

## 🚀 Recent Updates

- ✅ **Fixed GraphQL ID Parsing**: Properly extracts numeric IDs from Shopify GIDs (`gid://shopify/LineItem/123` → `123`)
- ✅ **Added /install Route**: Fixed 404 errors by adding proper install route handling
- ✅ **OAuth Flow Improvements**: Enhanced error handling and debugging logs
- ✅ **Database Compatibility**: Resolved PostgreSQL BIGINT insertion issues
- ✅ **Production Ready**: Deployed to Render with proper environment configuration

## 🛠️ Features

- **Shopify OAuth Integration**: Secure app installation and authorization
- **GraphQL API**: Efficient data fetching from Shopify
- **PostgreSQL Database**: Persistent storage for orders and shop data
- **Real-time Webhooks**: Automatic order synchronization
- **Responsive Frontend**: Clean UI for order management
- **ngrok Support**: Easy local development with tunnel support

## 📋 Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- PostgreSQL database
- Shopify Partner account
- ngrok (for local development)

### 1. Clone Repository
```bash
git clone https://github.com/sagarthakur00/shopify-order-dashboard.git
cd shopify-order-dashboard
```

### 2. Install Dependencies
```bash
cd backend
npm install
```

### 3. Environment Configuration
Copy the example environment file:
```bash
cp .env.example .env
```

Update `.env` with your credentials:
```env
SHOPIFY_API_KEY=your_shopify_api_key_here
SHOPIFY_API_SECRET=your_shopify_api_secret_here
HOST=https://your-ngrok-url.ngrok-free.app
SCOPES=read_orders,read_products
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
PORT=3000
```

### 4. Database Setup
Make sure PostgreSQL is running and create your database:
```bash
createdb your_database_name
```

### 5. Start Development Server
```bash
# Terminal 1: Start ngrok tunnel
ngrok http 3000

# Terminal 2: Start the app server
npm start
```

### 6. Install Shopify App
Visit: `https://your-ngrok-url.ngrok-free.app/install?shop=your-shop.myshopify.com`

## 🔧 API Endpoints

- `GET /install` - Start Shopify OAuth installation
- `GET /callback` - OAuth callback handler
- `GET /api/orders` - Fetch and sync orders from Shopify
- `POST /webhooks/orders/create` - Webhook for new orders

## 🐛 Troubleshooting

### Common Issues:

1. **GraphQL ID Errors**: Fixed with regex-based ID extraction
2. **404 on /install**: Resolved with proper route mounting
3. **Database Connection**: Check PostgreSQL credentials and connection
4. **ngrok Tunnel**: Ensure tunnel is active and URL matches .env
5. **OAuth Errors**: Verify API credentials and redirect URIs

## 🌐 Deployment

Deployed on Render: [https://shopify-order-dashboard-1.onrender.com](https://shopify-order-dashboard-1.onrender.com)

## 📝 Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **Frontend**: HTML, CSS, JavaScript
- **APIs**: Shopify GraphQL API
- **Deployment**: Render
- **Development**: ngrok, nodemon
