require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON
app.use(express.json());

// Serve the frontend files from the 'frontend' directory
app.use(express.static(path.join(__dirname, '../frontend')));

// Simple test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is running!', timestamp: new Date() });
});

// Mock orders endpoint for testing
app.get('/api/orders', (req, res) => {
  const { shop } = req.query;
  
  if (!shop) {
    return res.status(400).json({ error: 'Missing shop parameter' });
  }
  
  // Return mock data for local testing
  const mockOrders = [
    {
      shopify_order_id: '1001',
      order_number: '#1001',
      created_at_shopify: new Date().toISOString(),
      financial_status: 'paid',
      total_price: '99.99',
      line_items: [
        {
          image_url: 'https://via.placeholder.com/60',
          title: 'Test Product 1',
          quantity: 2,
          price: '49.99'
        }
      ]
    },
    {
      shopify_order_id: '1002',
      order_number: '#1002',
      created_at_shopify: new Date().toISOString(),
      financial_status: 'pending',
      total_price: '149.99',
      line_items: [
        {
          image_url: 'https://via.placeholder.com/60',
          title: 'Test Product 2',
          quantity: 1,
          price: '149.99'
        }
      ]
    }
  ];
  
  res.json(mockOrders);
});

// Install route (mock for local testing)
app.get('/install', (req, res) => {
  const { shop } = req.query;
  if (!shop) {
    return res.status(400).send('Missing shop parameter');
  }
  
  // For local testing, redirect directly to main page with shop param
  res.redirect(`/?shop=${shop}`);
});

// Route to serve the install page specifically
app.get('/install.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/install.html'));
});

// A catch-all to redirect to the main app page
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Local development server running on http://localhost:${PORT}`);
  console.log(`📱 Install page: http://localhost:${PORT}/install.html`);
  console.log(`🔧 API test: http://localhost:${PORT}/api/test`);
  console.log('📝 Note: Using mock data for local development');
});
