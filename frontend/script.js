document.addEventListener('DOMContentLoaded', () => {
    const orderList = document.getElementById('order-list');
    const loader = document.getElementById('loader');
    const errorMessage = document.getElementById('error-message');
    const modal = document.getElementById('order-modal');
    const modalBody = document.getElementById('modal-body');
    const closeButton = document.querySelector('.close-button');

    let ordersData = [];

    // Get shop parameter from URL
    const urlParams = new URLSearchParams(window.location.search);
    const shop = urlParams.get('shop');

    if (!shop) {
        errorMessage.textContent = 'Shop parameter is missing. Please install the app correctly.';
        errorMessage.style.display = 'block';
        loader.style.display = 'none';
        return;
    }

    // Fetch orders from the backend
    async function fetchOrders() {
        try {
            const response = await fetch(`/api/orders?shop=${shop}`);
            if (!response.ok) {
                throw new Error('Failed to fetch orders from the server.');
            }
            ordersData = await response.json();
            displayOrders(ordersData);
        } catch (error) {
            console.error('Error fetching orders:', error);
            errorMessage.textContent = error.message;
            errorMessage.style.display = 'block';
        } finally {
            loader.style.display = 'none';
        }
    }

    // Display orders in the table
    function displayOrders(orders) {
        orderList.innerHTML = '';
        if (orders.length === 0) {
            orderList.innerHTML = '<tr><td colspan="4" style="text-align:center;">No orders found in the last 60 days.</td></tr>';
            return;
        }

        orders.forEach(order => {
            const row = document.createElement('tr');
            row.dataset.orderId = order.shopify_order_id; // Store ID for click event

            const paymentStatusClass = getStatusClass(order.financial_status);

            row.innerHTML = `
                <td>${order.order_number}</td>
                <td>${new Date(order.created_at_shopify).toLocaleDateString()}</td>
                <td><span class="${paymentStatusClass}">${order.financial_status}</span></td>
                <td>$${parseFloat(order.total_price).toFixed(2)}</td>
            `;

            row.addEventListener('click', () => showOrderDetails(order.shopify_order_id));
            orderList.appendChild(row);
        });
    }

    // Show modal with details for a specific order
    function showOrderDetails(orderId) {
        const order = ordersData.find(o => o.shopify_order_id === orderId);
        if (!order) return;

        let itemsHtml = '<h3>Line Items</h3>';
        if (order.line_items && order.line_items.length > 0) {
            itemsHtml += order.line_items.map(item => `
                <div class="line-item">
                    <img src="${item.image_url || 'https://via.placeholder.com/60'}" alt="${item.title}">
                    <div class="item-details">
                        <strong>${item.title}</strong><br>
                        <span>Quantity: ${item.quantity}</span>
                    </div>
                    <div class="item-price">
                        $${parseFloat(item.price).toFixed(2)}
                    </div>
                </div>
            `).join('');
        } else {
            itemsHtml += '<p>No items found for this order.</p>';
        }
        
        modalBody.innerHTML = `
            <p><strong>Order Number:</strong> ${order.order_number}</p>
            <p><strong>Date:</strong> ${new Date(order.created_at_shopify).toLocaleString()}</p>
            <p><strong>Total Price:</strong> $${parseFloat(order.total_price).toFixed(2)}</p>
            ${itemsHtml}
        `;
        modal.style.display = 'block';
    }

    function getStatusClass(status) {
        if (!status) return '';
        const lowerStatus = status.toLowerCase();
        if (lowerStatus.includes('paid')) return 'status-paid';
        if (lowerStatus.includes('pending')) return 'status-pending';
        if (lowerStatus.includes('refunded')) return 'status-refunded';
        return '';
    }

    // Modal close functionality
    closeButton.onclick = () => {
        modal.style.display = 'none';
    };
    window.onclick = (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    };

    fetchOrders();
});