const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const querystring = require('querystring');
const db = require('../db');

const router = express.Router();

const { SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SCOPES, HOST } = process.env;

// Route to start the installation process
router.get('/install', (req, res) => {
    const { shop } = req.query;
    if (!shop) {
        return res.status(400).send('Missing shop parameter');
    }

    const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${SCOPES}&redirect_uri=${HOST}/auth/callback`;
    res.redirect(installUrl);
});

// Route for the OAuth callback
router.get('/auth/callback', async (req, res) => {
    const { shop, hmac, code } = req.query;

    if (!shop || !hmac || !code) {
        return res.status(400).send('Required parameters missing');
    }

    // 1. HMAC Validation
    const map = { ...req.query };
    delete map['hmac'];
    const message = querystring.stringify(map);
    const generatedHmac = crypto.createHmac('sha256', SHOPIFY_API_SECRET).update(message).digest('hex');

    if (generatedHmac !== hmac) {
        return res.status(400).send('HMAC validation failed');
    }

    // 2. Exchange authorization code for an access token
    const accessTokenUrl = `https://${shop}/admin/oauth/access_token`;
    const accessTokenPayload = {
        client_id: SHOPIFY_API_KEY,
        client_secret: SHOPIFY_API_SECRET,
        code,
    };

    try {
        const response = await axios.post(accessTokenUrl, accessTokenPayload);
        const accessToken = response.data.access_token;

        // 3. Store the shop and access token
        await db.query(
            'INSERT INTO shops (shop_domain, access_token) VALUES ($1, $2) ON CONFLICT (shop_domain) DO UPDATE SET access_token = $2',
            [shop, accessToken]
        );
        
        console.log(`Successfully installed on ${shop}`);
        
        // 4. Register webhook for new orders
        await registerOrderCreationWebhook(shop, accessToken);

        // Redirect to the frontend app page
        res.redirect(`/?shop=${shop}`);

    } catch (error) {
        console.error('Error getting access token:', error.response ? error.response.data : error.message);
        res.status(500).send('Error getting access token');
    }
});

async function registerOrderCreationWebhook(shop, accessToken) {
    const webhookUrl = `${HOST}/webhooks/orders/create`;
    const webhookEndpoint = `https://${shop}/admin/api/2024-07/webhooks.json`;

    try {
        await axios.post(
            webhookEndpoint,
            {
                webhook: {
                    topic: 'orders/create',
                    address: webhookUrl,
                    format: 'json',
                },
            },
            {
                headers: { 'X-Shopify-Access-Token': accessToken },
            }
        );
        console.log(`Webhook for orders/create registered successfully for ${shop}`);
    } catch (error) {
        console.error('Error registering webhook:', error.response ? error.response.data : error.message);
    }
}

module.exports = router;