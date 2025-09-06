// Razorpay configuration and utility functions
export const RAZORPAY_KEY_ID = "rzp_live_HJl9NwyBSY9rwV";
export const RAZORPAY_KEY_SECRET = "1FlerafMmqHMw466ccsDxrhp";

// For testing, we'll use test mode
export const RAZORPAY_TEST_KEY_ID = "rzp_test_1DP5mmOlF5G5ag";

// Load Razorpay script dynamically
export const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      console.log('Razorpay script already loaded');
      resolve(true);
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      console.log('Razorpay script loaded successfully');
      resolve(true);
    };
    script.onerror = (error) => {
      console.error('Failed to load Razorpay script:', error);
      resolve(false);
    };
    document.head.appendChild(script);
  });
};

// Declare Razorpay type for TypeScript
declare global {
  interface Window {
    Razorpay: any;
  }
}

// Verify Razorpay payment signature
export const verifyRazorpayPayment = (razorpayResponse: any, secret: string): boolean => {
  const crypto = require('crypto');
  const body = razorpayResponse.razorpay_order_id + "|" + razorpayResponse.razorpay_payment_id;
  const expectedSignature = crypto.createHmac('sha256', secret).update(body.toString()).digest('hex');
  return expectedSignature === razorpayResponse.razorpay_signature;
};

// Initialize Razorpay payment (normal integration)
export const initializeRazorpayPayment = async (
  amount: number,
  onSuccess: (paymentId: string, orderId: string) => void,
  onError: (error: string) => void
) => {
  const scriptLoaded = await loadRazorpayScript();
  
  if (!scriptLoaded) {
    onError('Failed to load Razorpay script');
    return;
  }

  try {
    const options = {
      key: RAZORPAY_KEY_ID,
      amount: amount * 100, // Convert to paise
      currency: 'INR',
      name: 'Tambola Tron',
      description: 'Wallet Top-up',
      image: '/placeholder.svg', // Add your logo if available
      order_id: '', // Not needed for normal integration
      handler: function (response: any) {
        console.log('Payment successful:', response);
        onSuccess(response.razorpay_payment_id, response.razorpay_order_id || 'normal_payment');
      },
      prefill: {
        name: localStorage.getItem('userName') || 'User',
        email: 'user@example.com',
        contact: '9999999999'
      },
      notes: {
        description: 'Wallet top-up',
        user_id: localStorage.getItem('userId') || 'unknown',
        timestamp: new Date().toISOString()
      },
      theme: {
        color: '#3B82F6'
      },
      modal: {
        ondismiss: function() {
          console.log('Payment cancelled by user');
          onError('Payment cancelled by user');
        }
      },
      timeout: 300, // 5 minutes
      retry: {
        enabled: true,
        max_count: 3
      }
    };

    console.log('Initializing Razorpay with options:', options);
    const razorpay = new window.Razorpay(options);
    console.log('Razorpay instance created, opening payment modal...');
    razorpay.open();
  } catch (error: any) {
    console.error('Razorpay initialization error:', error);
    onError(`Failed to initialize payment: ${error.message || 'Unknown error'}`);
  }
};

// Simple payment verification (for normal Razorpay)
export const verifyPayment = (response: any): boolean => {
  // For normal Razorpay integration, we trust the response
  // In production, you should verify the signature on your backend
  return response && response.razorpay_payment_id;
};
