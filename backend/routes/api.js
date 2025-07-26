const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const db = require('../db');

const router = express.Router();

// GET /orders - List all orders from the database
router.get('/orders', async (req, res) => {
    const { shop } = req.query;
    if (!shop) {
        return res.status(400).send('Missing shop parameter');
    }

    try {
        // First, sync data from Shopify
        await fetchAndStoreOrders(shop);

        // Then, retrieve all orders for the shop from our DB
        const ordersResult = await db.query('SELECT * FROM orders WHERE shop = $1 ORDER BY created_at DESC', [shop]);
        const orders = ordersResult.rows;

        // For each order, get its fulfilment items and images
        for (const order of orders) {
            const itemsResult = await db.query('SELECT * FROM fulfilment_items WHERE order_id = $1', [order.order_id]);
            order.fulfilment_items = itemsResult.rows;
            
            // Get images for each fulfilment item
            for (const item of order.fulfilment_items) {
                const imagesResult = await db.query('SELECT * FROM images WHERE return_item_id = $1', [item.id]);
                item.images = imagesResult.rows;
            }
        }

        // NORMALIZE: Transform backend data to match frontend expectations
        const normalizedOrders = orders.map(order => {
            // Calculate total price from fulfilment items
            const totalPrice = order.fulfilment_items.reduce((sum, item) => {
                return sum + (parseFloat(item.qty || 1) * 50.00); // Temporary calculation
            }, 0);

            return {
                shopify_order_id: order.order_id,
                order_number: order.order_id,
                created_at_shopify: order.created_at,
                financial_status: order.status || 'unknown',
                total_price: totalPrice.toFixed(2),
                line_items: order.fulfilment_items.map(item => ({
                    image_url: item.image_url || 'https://via.placeholder.com/60',
                    title: item.reason || 'Product Item', // Using reason field as title temporarily
                    quantity: item.qty || 1,
                    price: '50.00' // Temporary - should be calculated/stored properly
                }))
            };
        });

        res.json(normalizedOrders);
    } catch (error) {
        console.error('Error fetching orders from DB:', error);
        res.status(500).send('Error fetching orders');
    }
});

// Webhook for new order creation
router.post('/webhooks/orders/create', async (req, res) => {
    const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
    const shop = req.get('X-Shopify-Shop-Domain');
    
    const hash = crypto.createHmac('sha256', process.env.SHOPIFY_API_SECRET).update(req.body, 'utf8').digest('base64');

    if (hash === hmacHeader) {
        console.log(`Webhook verified for ${shop}`);
        try {
            const orderData = JSON.parse(req.body.toString());
            await saveOrderData(shop, orderData);
            res.sendStatus(200);
        } catch (error) {
            console.error('Error processing webhook:', error);
            res.sendStatus(500);
        }
    } else {
        console.warn('Webhook validation failed');
        res.sendStatus(401);
    }
});

// Helper function to fetch and store orders from Shopify
async function fetchAndStoreOrders(shop) {
    const shopData = await db.query('SELECT access_token FROM shops WHERE shop_domain = $1', [shop]);
    if (shopData.rows.length === 0) {
        throw new Error(`No access token found for shop: ${shop}`);
    }
    const accessToken = shopData.rows[0].access_token;
    
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const dateQuery = `created_at:>=${sixtyDaysAgo.toISOString()}`;

    const graphqlQuery = {
        query: `
        query orders($query: String) {
          orders(first: 100, sortKey: CREATED_AT, reverse: true, query: $query) {
            edges {
              node {
                legacyResourceId
                name
                createdAt
                displayFinancialStatus
                lineItems(first: 20) {
                  edges {
                    node {
                      legacyResourceId
                      quantity
                      variant {
                        image { url }
                      }
                    }
                  }
                }
              }
            }
          }
        }`,
        variables: { query: dateQuery },
    };

    try {
        const response = await axios.post(
            `https://${shop}/admin/api/2024-07/graphql.json`,
            graphqlQuery,
            { headers: { 'X-Shopify-Access-Token': accessToken } }
        );

        const orders = response.data.data.orders.edges;
        for (const orderEdge of orders) {
            await saveOrderData(shop, orderEdge.node, true);
        }
        console.log(`Fetched and stored ${orders.length} orders for ${shop}`);
    } catch(error) {
        console.error("Failed to fetch orders from Shopify:", error.response ? error.response.data.errors : error.message);
        throw error;
    }
}

// Helper function to save order data to the database
async function saveOrderData(shop, orderData, fromGraphql = false) {
    const order = {
        shop: shop,
        order_id: fromGraphql ? orderData.legacyResourceId : orderData.id,
        status: fromGraphql ? orderData.displayFinancialStatus : orderData.financial_status,
        created_at: fromGraphql ? orderData.createdAt : orderData.created_at,
    };
    
    const lineItems = fromGraphql ? orderData.lineItems.edges.map(e => e.node) : orderData.line_items;

    // Insert into 'orders' table
    await db.query(
        `INSERT INTO orders (shop, order_id, status, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (order_id) DO UPDATE SET status = EXCLUDED.status`,
        [order.shop, order.order_id, order.status, order.created_at]
    );

    // Save line items as 'fulfilment_items' with more detailed data
    for (const item of lineItems) {
        const imageUrl = fromGraphql ? item.variant?.image?.url : (item.image ? item.image.src : null);
        const lineItemId = fromGraphql ? item.legacyResourceId : item.id;
        const title = item.title || 'Product Item';
        const price = fromGraphql ? (item.variant?.price || '0.00') : (item.price || '0.00');

        const fiResult = await db.query(
            `INSERT INTO fulfilment_items (order_id, line_item_id, qty, reason, image_url)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (line_item_id) DO UPDATE SET
               order_id = EXCLUDED.order_id,
               qty = EXCLUDED.qty,
               reason = EXCLUDED.reason,
               image_url = EXCLUDED.image_url
             RETURNING id`,
             [order.order_id, lineItemId, item.quantity, title, imageUrl] // Store title as reason temporarily
        );
        
        // Save images to 'images' table
        if (imageUrl && fiResult.rows.length > 0) {
            const returnItemId = fiResult.rows[0].id;
            await db.query(
                `INSERT INTO images (image_url, return_item_id)
                 VALUES ($1, $2)
                 ON CONFLICT (image_url) DO NOTHING`,
                [imageUrl, returnItemId]
            );
        }
    }
}

module.exports = router;