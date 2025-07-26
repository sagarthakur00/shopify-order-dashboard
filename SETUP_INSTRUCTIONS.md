# Shopify Order Dashboard Setup Instructions

## Important: Environment Variables Required

Your app needs proper Shopify app credentials to work. Follow these steps:

### 1. Create a Shopify App

1. Go to your Shopify Partners account: https://partners.shopify.com
2. Create a new app or use an existing one
3. Get your **API Key** and **API Secret** from the app settings

### 2. Configure Environment Variables in Render

In your Render dashboard (https://dashboard.render.com), go to your service settings and add these environment variables:

```
SHOPIFY_API_KEY=your_actual_api_key_here
SHOPIFY_API_SECRET=your_actual_api_secret_here
HOST=https://shopify-order-dashboard-1.onrender.com
SCOPES=read_orders
DATABASE_URL=postgresql://shopify_user:VEzEPoH4x74SyoXfFQVezz43zKAVc4b4@dpg-d22een7gi27c73esge5g-a/shopify_orders_xtz6
```

### 3. Configure Shopify App URLs

In your Shopify app settings, set:
- **App URL**: `https://shopify-order-dashboard-1.onrender.com/install.html`
- **Allowed redirection URL(s)**: `https://shopify-order-dashboard-1.onrender.com/callback`

### 4. Install the App

1. Visit: `https://shopify-order-dashboard-1.onrender.com/install.html`
2. Enter your shop domain (e.g., `your-shop.myshopify.com`)
3. Click "Install App"
4. Authorize the app in Shopify
5. You'll be redirected back to view your orders

## Current Status

❌ **Missing Shopify App Credentials** - You need to set the environment variables above
✅ Database connected
✅ App deployed to Render

## Troubleshooting

If you see "Shop parameter is missing", it means:
1. You haven't set up the Shopify app credentials
2. You're accessing the app directly instead of going through the installation flow
3. The OAuth callback isn't working properly

Always start by visiting the install page: `/install.html`
