require('dotenv').config();
const express = require('express');
const path = require('path');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse raw body for webhook verification
app.use('/webhooks/orders/create', express.raw({ type: 'application/json' }));

// Middleware to parse JSON for other routes
app.use(express.json());

// Serve the frontend files from the 'frontend' directory
app.use(express.static(path.join(__dirname, '../frontend')));

// Mount routers
app.use('/', authRoutes);
app.use('/api', apiRoutes);

// Add redirect route for /install (without .html)
app.get('/install', (req, res) => {
  const queryString = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  res.redirect('/install.html' + queryString);
});

// A route to serve the install page specifically
app.get('/install.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/install.html'));
});

// A catch-all to redirect to the main app page
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});