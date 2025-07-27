const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const db = require('../db');

const router = express.Router();

// Helper function to extract numeric ID from Shopify GraphQL Global ID (GID)
function extractShopifyId(gid) {
    if (!gid) return null;

    // Extract the trailing number from any gid string
    const match = gid.toString().match(/\d+$/);
    return match ? match[0] : null;
}

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
        res.status(500).json({ error: error.message, stack: error.stack });
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
    
    // TODO: For debugging, try fetching ALL orders first, then add date filter back
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    // const dateQuery = `created_at:>=${sixtyDaysAgo.toISOString()}`;
    
    // 🐛 DEBUG: Uncomment the line below to fetch ALL orders (for testing)
    const dateQuery = ''; // This will fetch all orders, not just last 60 days
    
    console.log("🔍 Debug info:");
    console.log("   Shop:", shop);
    console.log("   Access token exists:", !!accessToken);
    console.log("   Date filter:", dateQuery || 'NO DATE FILTER (fetching all orders)');

    const graphqlQuery = dateQuery ? {
        // Query WITH date filter
        query: `
        query orders($query: String) {
          orders(first: 100, sortKey: CREATED_AT, reverse: true, query: $query) {
            edges {
              node {
                id
                legacyResourceId
                name
                createdAt
                displayFinancialStatus
                totalPriceSet {
                  shopMoney {
                    amount
                  }
                }
                lineItems(first: 20) {
                  edges {
                    node {
                      id
                      title
                      quantity
                      variant {
                        id
                        price
                        image { 
                          url 
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }`,
        variables: { query: dateQuery },
    } : {
        // Query WITHOUT date filter (no $query variable needed)
        query: `
        query orders {
          orders(first: 100, sortKey: CREATED_AT, reverse: true) {
            edges {
              node {
                id
                legacyResourceId
                name
                createdAt
                displayFinancialStatus
                totalPriceSet {
                  shopMoney {
                    amount
                  }
                }
                lineItems(first: 20) {
                  edges {
                    node {
                      id
                      title
                      quantity
                      variant {
                        id
                        price
                        image { 
                          url 
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }`,
        variables: {},
    };

    try {
        const response = await axios.post(
            `https://${shop}/admin/api/2024-07/graphql.json`,
            graphqlQuery,
            { headers: { 'X-Shopify-Access-Token': accessToken } }
        );

        console.log("🔍 Shopify API Response:", JSON.stringify(response.data, null, 2));
        
        // Check if response has errors
        if (response.data.errors) {
            console.error("❌ Shopify GraphQL errors:", response.data.errors);
            throw new Error(`Shopify GraphQL errors: ${JSON.stringify(response.data.errors)}`);
        }
        
        // Check if response.data.data exists
        if (!response.data.data) {
            console.error("❌ No data in Shopify response:", response.data);
            throw new Error("No data returned from Shopify API");
        }
        
        // Check if orders exist in response
        if (!response.data.data.orders) {
            console.error("❌ No orders field in Shopify response:", response.data.data);
            throw new Error("No orders field in Shopify API response");
        }
        
        const orders = response.data.data.orders.edges || [];
        console.log("📊 Orders received from Shopify:", orders.length);
        
        if (orders.length === 0) {
            console.log("⚠️  No orders found in Shopify for this shop. Possible reasons:");
            console.log("   - No orders exist in the date range (last 60 days)");
            console.log("   - Shop has no orders at all");
            console.log("   - Access token doesn't have proper permissions");
            console.log("🗓️  Date filter applied:", dateQuery);
        }
        
        for (const orderEdge of orders) {
            await saveOrderData(shop, orderEdge.node, true);
        }
        console.log(`✅ Fetched and stored ${orders.length} orders for ${shop}`);
    } catch(error) {
        console.error("Failed to fetch orders from Shopify:", error.response ? error.response.data.errors : error.message);
        throw error;
    }
}

// Helper function to save order data to the database
async function saveOrderData(shop, orderData, fromGraphql = false) {
    const order = {
        shop: shop,
        order_id: fromGraphql ? extractShopifyId(orderData.legacyResourceId || orderData.id) : orderData.id,
        status: fromGraphql ? orderData.displayFinancialStatus : orderData.financial_status,
        created_at: fromGraphql ? orderData.createdAt : orderData.created_at,
    };
    
    const lineItems = fromGraphql ? orderData.lineItems.edges.map(e => e.node) : orderData.line_items;

    console.log(`💾 Saving order: ${order.order_id} with ${lineItems.length} items`);

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
        const lineItemId = fromGraphql ? extractShopifyId(item.id) : item.id;
        const title = fromGraphql ? item.title : (item.title || 'Product Item');
        const price = fromGraphql ? (item.variant?.price || '0.00') : (item.price || '0.00');

        console.log(`💾 Saving line item: ${title} (qty: ${item.quantity}, id: ${lineItemId})`);
        console.log("✅ Final lineItemId inserted:", lineItemId, typeof lineItemId);

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
