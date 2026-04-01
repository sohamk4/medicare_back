const axios = require('axios');
require('dotenv').config();

const CASHFREE_CONFIG = {
  baseURL: process.env.CASHFREE_BASE_URL,
  headers: {
    'x-client-id': process.env.CASHFREE_APP_ID,
    'x-client-secret': process.env.CASHFREE_SECRET_KEY,
    'x-api-version': '2022-09-01',
    'Content-Type': 'application/json'
  }
};

class PaymentService {
    constructor() {
      this.client = axios.create(CASHFREE_CONFIG);
    }
  
    // Create order in Cashfree
    async createOrder(orderData) {
      try {
        const response = await this.client.post('/pg/orders', orderData);
        
        // The response already contains payment_session_id, no need for additional call
        const orderResponse = response.data;
                  
        return {
          ...orderResponse,
          payment_session: orderResponse.payment_session_id
        };
      } catch (error) {
        console.error('Cashfree order creation error:', error.response?.data);
        throw new Error(`Payment gateway error: ${error.response?.data?.message || error.message}`);
      }
    }

    async createOrderUrl(orderData) {
      try {
        const response = await this.client.post('/pg/orders',orderData);
        
        return {
          cf_order_id: response.data.cf_order_id,
          payment_session_id: response.data.payment_session_id,
          payment_link: response.data.payment_link,
          order_id: response.data.order_id,
          order_status: response.data.order_status
        };
      } catch (error) {
        console.error('Cashfree order creation error:', error.response?.data);
        throw new Error(`Payment gateway error: ${error.response?.data?.message || error.message}`);
      }
    }

    // Get order status
    async getOrderStatus(orderId) {
      try {
        const response = await this.client.get(`/pg/orders/${orderId}`);
        return response.data;
      } catch (error) {
        console.error('Cashfree order status error:', error.response?.data);
        throw new Error(`Failed to fetch order status: ${error.message}`);
      }
    }
  
  
}  

module.exports = new PaymentService();