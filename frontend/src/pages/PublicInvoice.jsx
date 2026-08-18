import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Lock, CheckCircle, AlertCircle, CreditCard } from 'lucide-react';
import { getImageUrl, getApiBaseUrl } from '../utils/api';

export default function PublicInvoice() {
  const { invoiceId } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState('verify'); // 'verify' | 'payment' | 'success' | 'otp-waiting' | 'otp-input'
  const [merchants, setMerchants] = useState([]);
  const collectJsRef = useRef(null);
  
  // Create API instance with correct base URL
  const api = axios.create({ baseURL: `${getApiBaseUrl()}/api` });
  
  const [selectedMerchant, setSelectedMerchant] = useState(null);
  
  // USPTO Manual Payment states
  const [isUSPTOBrand, setIsUSPTOBrand] = useState(false);
  const [otpStatus, setOtpStatus] = useState('pending'); // 'pending' | 'email_sent' | 'sms_sent' | 'verified'
  const [otpCode, setOtpCode] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [otpMethod, setOtpMethod] = useState(null);
  const [verifyingOTP, setVerifyingOTP] = useState(false);
  
  // Verification form
  const [verifyData, setVerifyData] = useState({
    customerName: '',
    customerEmail: '',
    customerSerialNumber: '',
  });
  const [verifying, setVerifying] = useState(false);

  // Payment form
  const [cardData, setCardData] = useState({
    cardNumber: '',
    cardHolder: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    firstName: '',
    lastName: '',
    companyName: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    countryCode: 'US',
    phone: '',
    // USPTO-specific fields
    ssnLast4: '',
    dateOfBirth: '',
  });
  const [paying, setPaying] = useState(false);
  const [collectJsReady, setCollectJsReady] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const paypalRef = useRef(null);
  const [stripeLoaded, setStripeLoaded] = useState(false);
  const [stripeInstance, setStripeInstance] = useState(null);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const res = await api.get(`/invoices/public/${invoiceId}`);
        setInvoice(res.data);
        
        // Check if it's USPTO brand (manual payment)
        const isUSPTO = res.data.brand?.isManualPayment === true;
        setIsUSPTOBrand(isUSPTO);
        console.log('Is USPTO Brand:', isUSPTO, 'Brand:', res.data.brand?.name);
        
        // If already verified, skip to payment
        if (res.data.customerVerified) {
          setStep('payment');
          
          // For USPTO, no merchants needed
          if (!isUSPTO) {
            // Fetch merchants using public endpoint
            const merchantsRes = await api.get(`/merchants/brand/${res.data.brandId}/public`);
            const availableMerchants = merchantsRes.data.filter(m => m.isActive !== false);
            setMerchants(availableMerchants);
            
            // Always select first merchant (default or first in list)
            const defaultMerchant = availableMerchants.find(m => m.isDefault);
            setSelectedMerchant(defaultMerchant || availableMerchants[0] || null);
          }
        }
      } catch (err) {
        toast.error('Invoice not found');
      } finally {
        setLoading(false);
      }
    };
    fetchInvoice();
  }, [invoiceId]);

  // Load PayPal SDK if invoice has PayPal Direct enabled
  useEffect(() => {
    const loadPayPalSDK = async () => {
      if (invoice?.usePayPalDirect && !paypalLoaded) {
        try {
          console.log('🔍 Starting PayPal SDK load...');
          console.log('Invoice brand ID:', invoice.brandId);
          console.log('usePayPalDirect:', invoice.usePayPalDirect);
          
          // Get PayPal merchant for this brand to extract client ID
          const merchantsRes = await api.get(`/merchants/brand/${invoice.brandId}/public`);
          console.log('📦 Merchants response:', merchantsRes.data);
          
          const paypalMerchants = merchantsRes.data.filter(m => m.gateway === 'paypal');
          console.log('🅿️  PayPal merchants found:', paypalMerchants);
          
          const paypalMerchant = merchantsRes.data.find(m => m.gateway === 'paypal');
          console.log('✓ Selected PayPal merchant:', paypalMerchant);
          
          if (!paypalMerchant) {
            console.error('❌ No PayPal merchant found');
            console.log('Available merchants:', merchantsRes.data);
            toast.error('PayPal payment method not available');
            return;
          }
          
          // Extract client ID from merchant credentials
          console.log('🔑 Merchant credentials:', paypalMerchant.credentials);
          const clientId = paypalMerchant.credentials?.clientId;
          const mode = paypalMerchant.credentials?.mode || 'sandbox';
          
          if (!clientId) {
            console.error('❌ PayPal client ID not configured');
            console.log('Credentials object:', paypalMerchant.credentials);
            toast.error('PayPal configuration error - missing client ID');
            return;
          }
          
          console.log('✅ Loading PayPal SDK with client ID:', clientId.substring(0, 10) + '...');
          console.log('Mode:', mode);
          
          const script = document.createElement('script');
          script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
          script.async = true;
          script.onload = () => {
            console.log('✅ PayPal SDK loaded successfully');
            setPaypalLoaded(true);
          };
          script.onerror = () => {
            console.error('❌ Failed to load PayPal SDK from CDN');
            toast.error('Failed to load PayPal payment system');
          };
          document.body.appendChild(script);

          return () => {
            // Cleanup script if component unmounts
            if (document.body.contains(script)) {
              document.body.removeChild(script);
            }
          };
        } catch (err) {
          console.error('❌ Error loading PayPal SDK:', err);
          console.error('Error details:', err.response?.data || err.message);
          toast.error('Failed to initialize PayPal: ' + (err.response?.data?.message || err.message));
        }
      }
    };
    
    loadPayPalSDK();
  }, [invoice?.usePayPalDirect, invoice?.brandId, paypalLoaded]);

  // Poll for USPTO OTP status when in waiting mode
  useEffect(() => {
    if (step === 'otp-waiting' && isUSPTOBrand) {
      console.log('Starting OTP status polling...');
      
      const checkOTPStatus = async () => {
        try {
          const res = await api.get(`/invoices/public/${invoiceId}/payment-status`);
          console.log('OTP Status:', res.data);
          
          setOtpStatus(res.data.otpStatus || 'pending');
          setOtpMethod(res.data.otpMethod || null);
          setAdminNote(res.data.adminNote || '');
          
          // If OTP was sent, move to input screen
          if (res.data.otpStatus === 'email_sent' || res.data.otpStatus === 'sms_sent') {
            console.log('OTP sent, showing input screen');
            setStep('otp-input');
          }
          
          // If already paid, go to success
          if (res.data.status === 'paid') {
            console.log('Payment already completed');
            setStep('success');
          }
        } catch (err) {
          console.error('Error checking OTP status:', err);
        }
      };
      
      // Check immediately
      checkOTPStatus();
      
      // Poll every 3 seconds
      const interval = setInterval(checkOTPStatus, 3000);
      
      return () => clearInterval(interval);
    }
  }, [step, isUSPTOBrand, invoiceId]);

  // Poll for payment completion when customer marked (for admin action result)
  useEffect(() => {
    if (step === 'customer-marked' && isUSPTOBrand) {
      console.log('Polling for admin action...');
      
      const checkPaymentStatus = async () => {
        try {
          const res = await api.get(`/invoices/public/${invoiceId}/payment-status`);
          console.log('Payment Status:', res.data);
          
          // If admin marked as paid, show success and redirect
          if (res.data.status === 'paid') {
            console.log('Payment marked as paid by admin');
            setStep('success');
            
            // Show success message for 3 seconds then redirect to USPTO
            toast.success('Payment approved! Redirecting to USPTO...');
            setTimeout(() => {
              console.log('Redirecting to USPTO website...');
              window.location.href = 'https://tsdr.uspto.gov/';
            }, 3000);
          }
          
          // If admin marked as failed, show error
          if (res.data.status === 'failed') {
            console.log('Payment marked as failed by admin');
            toast.error('Payment was not accepted. Please contact support.');
          }
        } catch (err) {
          console.error('Error checking payment status:', err);
        }
      };
      
      // Check immediately
      checkPaymentStatus();
      
      // Poll every 5 seconds
      const interval = setInterval(checkPaymentStatus, 5000);
      
      return () => clearInterval(interval);
    }
  }, [step, isUSPTOBrand, invoiceId]);

  // Load Stripe.js SDK if Stripe merchant is selected
  useEffect(() => {
    const loadStripeSDK = async () => {
      if (selectedMerchant?.gateway === 'stripe' && !stripeLoaded) {
        try {
          console.log('💳 Loading Stripe.js SDK...');
          
          // Load Stripe.js from CDN
          const script = document.createElement('script');
          script.src = 'https://js.stripe.com/v3/';
          script.async = true;
          script.onload = () => {
            console.log('✅ Stripe.js SDK loaded');
            
            // Get publishable key from merchant credentials
            const publishableKey = selectedMerchant.credentials?.publishableKey;
            
            if (publishableKey && window.Stripe) {
              const stripe = window.Stripe(publishableKey);
              setStripeInstance(stripe);
              setStripeLoaded(true);
              console.log('✅ Stripe instance created with publishable key');
            } else {
              console.error('❌ Stripe publishable key not found');
            }
          };
          script.onerror = () => {
            console.error('❌ Failed to load Stripe.js SDK');
          };
          document.head.appendChild(script);
          
          return () => {
            if (document.head.contains(script)) {
              document.head.removeChild(script);
            }
          };
        } catch (err) {
          console.error('❌ Error loading Stripe.js:', err);
        }
      }
    };
    
    loadStripeSDK();
  }, [selectedMerchant?.gateway, selectedMerchant?.credentials, stripeLoaded]);

  // Render PayPal Buttons after SDK loads
  useEffect(() => {
    if (paypalLoaded && window.paypal && paypalRef.current && invoice?.usePayPalDirect) {
      console.log('Rendering PayPal Buttons...');
      
      // Clear any existing buttons
      paypalRef.current.innerHTML = '';
      
      try {
        window.paypal.Buttons({
          style: {
            layout: 'vertical',
            color: 'blue',
            shape: 'rect',
            label: 'paypal'
          },
          createOrder: (data, actions) => {
            console.log('Creating PayPal order for amount:', invoice.total);
            return actions.order.create({
              purchase_units: [{
                reference_id: invoice.invoiceNumber,
                description: `Invoice ${invoice.invoiceNumber} - ${invoice.brand?.name || 'Payment'}`,
                custom_id: invoice.invoiceNumber,
                amount: {
                  currency_code: 'USD',
                  value: invoice.total.toFixed(2)
                }
              }]
            });
          },
          onApprove: async (data, actions) => {
            console.log('Payment approved, capturing order...');
            setPaying(true);
            
            try {
              // Capture the order on PayPal's side
              const order = await actions.order.capture();
              console.log('PayPal order captured:', order);
              
              // Notify backend to mark invoice as paid
              const res = await api.post(`/invoices/public/${invoiceId}/paypal-complete`, {
                orderId: order.id,
                payerId: order.payer.payer_id,
                captureId: order.purchase_units[0].payments.captures[0].id,
                payerEmail: order.payer.email_address,
                payerName: order.payer.name
              });
              
              console.log('Backend response:', res.data);
              
              if (res.data.status === 'paid') {
                toast.success('Payment successful!');
                
                // Check for redirect
                if (res.data.redirectUrl && res.data.enableRedirect === true) {
                  console.log('Redirecting to:', res.data.redirectUrl);
                  setTimeout(() => {
                    window.location.href = res.data.redirectUrl;
                  }, 2000);
                } else {
                  setTimeout(() => {
                    setStep('success');
                  }, 1000);
                }
              } else {
                toast.error(res.data.message || 'Payment verification failed');
              }
            } catch (err) {
              console.error('Error completing PayPal payment:', err);
              toast.error(err.response?.data?.message || 'Payment completion failed');
            } finally {
              setPaying(false);
            }
          },
          onError: (err) => {
            console.error('PayPal error:', err);
            toast.error('PayPal payment error');
            setPaying(false);
          },
          onCancel: (data) => {
            console.log('Payment cancelled by user');
            toast.info('Payment cancelled');
          }
        }).render(paypalRef.current);
        
        console.log('PayPal Buttons rendered successfully');
      } catch (err) {
        console.error('Error rendering PayPal Buttons:', err);
        toast.error('Failed to initialize PayPal buttons');
      }
    }
  }, [paypalLoaded, invoice, invoiceId]);

  // Note: Collect.js loading removed - using raw card data instead
  // This avoids CDN dependency issues

  const handleCollectJsResponse = (response) => {
    console.log('📥 Collect.js Response:', response);
    
    if (response.token) {
      console.log('✅ Collect.js token received:', response.token.substring(0, 20) + '...');
      console.log('📊 Card info:', {
        last4: response.card?.number?.slice(-4),
        type: response.card?.type,
        exp: response.card?.exp
      });
      // Token is ready, proceed with payment
      handlePaymentWithToken(response.token);
    } else if (response.error) {
      console.error('❌ Collect.js error:', response.error);
      setPaying(false);
      toast.error('Card tokenization failed: ' + response.error);
    } else {
      console.error('❌ Collect.js unexpected response:', response);
      setPaying(false);
      toast.error('Card tokenization failed: Unexpected response from payment system');
    }
  };

  const handlePaymentWithToken = async (token) => {
    if (!selectedMerchant) {
      return toast.error('Please select a payment method');
    }
    
    setPaying(true);
    setPaymentError(null);
    try {
      const payload = {
        token: token, // Send token instead of raw card data
        cardHolder: cardData.cardHolder,
        merchantId: selectedMerchant._id,
      };
      
      console.log('=== PAYMENT REQUEST (WITH TOKEN) ===');
      console.log('Merchant:', selectedMerchant.nickname, `(${selectedMerchant.gateway})`);
      console.log('Cardholder:', payload.cardHolder);
      console.log('Amount:', invoice.total);
      console.log('Token:', token);
      
      const res = await api.post(`/invoices/public/${invoiceId}/pay`, payload);
      
      console.log('=== PAYMENT RESPONSE ===');
      console.log('Status:', res.data.status);
      console.log('Message:', res.data.message);
      
      if (res.data.status === 'paid') {
        toast.success('Payment successful!');
        
        if (res.data.redirectUrl && res.data.enableRedirect === true) {
          console.log('✅ Redirecting to:', res.data.redirectUrl);
          setTimeout(() => {
            window.location.href = res.data.redirectUrl;
          }, 2000);
        } else {
          setTimeout(() => {
            setStep('success');
          }, 1000);
        }
      } else if (res.data.redirect3DS) {
        window.location.href = res.data.redirect3DS;
      } else {
        const errorMsg = res.data.message || 'Payment failed. Please try again.';
        setPaymentError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (err) {
      console.error('=== PAYMENT ERROR ===');
      console.error('Error:', err);
      console.error('Response:', err.response?.data);
      const errorMsg = err.response?.data?.message || 'Payment failed';
      setPaymentError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setPaying(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setVerifying(true);
    try {
      const res = await api.post(`/invoices/public/${invoiceId}/verify`, verifyData);
      if (res.data.verified) {
        toast.success('Verification successful!');
        
        // Check if USPTO brand (manual payment)
        const invoiceRes = await api.get(`/invoices/public/${invoiceId}`);
        setInvoice(invoiceRes.data);
        
        const isUSPTO = invoiceRes.data.brand?.isManualPayment === true;
        setIsUSPTOBrand(isUSPTO);
        
        if (!isUSPTO) {
          // Regular payment: Get merchants
          const availableMerchants = res.data.merchants || [];
          setMerchants(availableMerchants);
          
          // Always select first merchant (default or first in list)
          const defaultMerchant = availableMerchants.find(m => m.isDefault);
          setSelectedMerchant(defaultMerchant || availableMerchants[0] || null);
        }
        // For USPTO, no merchants needed
        
        setStep('payment');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleCardChange = (field, value) => {
    let formatted = value;
    if (field === 'cardNumber') {
      formatted = value.replace(/\s/g, '').replace(/(\d{4})/g, '$1 ').trim();
    }
    if (field === 'expiryMonth' || field === 'expiryYear') {
      formatted = value.replace(/\D/g, '');
    }
    if (field === 'cvv') {
      formatted = value.replace(/\D/g, '').substring(0, 4);
    }
    if (field === 'ssnLast4') {
      // Only allow 4 digits
      formatted = value.replace(/\D/g, '').substring(0, 4);
    }
    setCardData({ ...cardData, [field]: formatted });
  };

  // Handle USPTO manual payment submission
  const handleUSPTOPayment = async (e) => {
    e.preventDefault();
    console.log('\n========== USPTO PAYMENT SUBMISSION ==========');
    
    // Validate USPTO-specific fields
    if (!cardData.ssnLast4 || cardData.ssnLast4.length !== 4) {
      return toast.error('Please enter last 4 digits of SSN');
    }
    
    if (!cardData.dateOfBirth) {
      return toast.error('Please enter date of birth');
    }
    
    setPaying(true);
    setPaymentError(null);
    
    try {
      const payload = {
        ssnLast4: cardData.ssnLast4,
        dateOfBirth: cardData.dateOfBirth,
        cardData: {
          nameOnCard: cardData.cardHolder,
          cardNumber: cardData.cardNumber.replace(/\s/g, ''),
          expiry: `${cardData.expiryMonth}/${cardData.expiryYear}`,
          cvv: cardData.cvv
        }
      };
      
      console.log('Submitting USPTO payment request...');
      
      const res = await api.post(`/invoices/public/${invoiceId}/submit-payment-request`, payload);
      
      console.log('USPTO payment request submitted:', res.data);
      
      if (res.data.success) {
        toast.success('Payment request submitted! Please wait for verification.');
        setStep('otp-waiting'); // Move to waiting screen
      }
    } catch (err) {
      console.error('USPTO payment submission error:', err);
      const errorMsg = err.response?.data?.message || 'Failed to submit payment request';
      setPaymentError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setPaying(false);
    }
  };

  // Handle OTP submission (no validation, just mark as customer verified)
  const handleOTPSubmit = async (e) => {
    e.preventDefault();
    
    if (!otpCode || otpCode.length !== 6) {
      return toast.error('Please enter a 6-digit code');
    }
    
    setVerifyingOTP(true);
    
    try {
      console.log('Submitting customer OTP mark...');
      const res = await api.post(`/invoices/public/${invoiceId}/customer-mark-otp`, {
        code: otpCode
      });
      
      if (res.data.success) {
        toast.success('Payment marked by customer');
        setStep('customer-marked');
      }
    } catch (err) {
      console.error('OTP submit error:', err);
      const errorMsg = err.response?.data?.message || 'Failed to submit';
      toast.error(errorMsg);
    } finally {
      setVerifyingOTP(false);
    }
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!selectedMerchant) {
      return toast.error('Please select a payment method');
    }
    
    // For Stripe: Tokenize card with Stripe.js first
    if (selectedMerchant.gateway === 'stripe') {
      console.log('💳 Processing Stripe payment with Stripe.js tokenization...');
      
      if (!stripeInstance || !stripeLoaded) {
        return toast.error('Stripe payment system not ready. Please wait...');
      }
      
      setPaying(true);
      setPaymentError(null);
      
      try {
        // Create card token using Stripe.js
        console.log('🔐 Creating Stripe token...');
        const { token, error } = await stripeInstance.createToken('card', {
          number: cardData.cardNumber.replace(/\s/g, ''),
          exp_month: cardData.expiryMonth,
          exp_year: cardData.expiryYear,
          cvc: cardData.cvv,
          name: cardData.cardHolder,
          address_line1: cardData.addressLine1,
          address_line2: cardData.addressLine2,
          address_city: cardData.city,
          address_state: cardData.state,
          address_zip: cardData.postalCode,
          address_country: cardData.countryCode,
        });
        
        if (error) {
          console.error('❌ Stripe tokenization error:', error);
          setPaymentError(error.message);
          toast.error('Card validation failed: ' + error.message);
          setPaying(false);
          return;
        }
        
        console.log('✅ Stripe token created:', token.id);
        
        // Send token to backend instead of raw card data
        const payload = {
          stripeToken: token.id,
          cardHolder: cardData.cardHolder,
          merchantId: selectedMerchant._id,
          firstName: cardData.firstName,
          lastName: cardData.lastName,
          companyName: cardData.companyName,
          addressLine1: cardData.addressLine1,
          addressLine2: cardData.addressLine2,
          city: cardData.city,
          state: cardData.state,
          postalCode: cardData.postalCode,
          countryCode: cardData.countryCode,
          phone: cardData.phone,
        };
        
        console.log('📤 Sending payment request with Stripe token');
        
        const res = await api.post(`/invoices/public/${invoiceId}/pay`, payload);
        
        console.log('=== PAYMENT RESPONSE ===');
        console.log('Status:', res.data.status);
        console.log('Message:', res.data.message);
        
        if (res.data.status === 'paid') {
          toast.success('Payment successful!');
          
          if (res.data.redirectUrl && res.data.enableRedirect === true) {
            console.log('✅ Redirecting to:', res.data.redirectUrl);
            setTimeout(() => {
              window.location.href = res.data.redirectUrl;
            }, 2000);
          } else {
            setTimeout(() => {
              setStep('success');
            }, 1000);
          }
        } else if (res.data.redirect3DS) {
          window.location.href = res.data.redirect3DS;
        } else {
          const errorMsg = res.data.message || 'Payment failed. Please try again.';
          setPaymentError(errorMsg);
          toast.error(errorMsg);
        }
      } catch (err) {
        console.error('=== PAYMENT ERROR ===');
        console.error('Error:', err);
        console.error('Response:', err.response?.data);
        const errorMsg = err.response?.data?.message || 'Payment failed';
        setPaymentError(errorMsg);
        toast.error(errorMsg);
      } finally {
        setPaying(false);
      }
      return;
    }
    
    // For BeyondBancard: Skip Collect.js, use raw card data
    // This works without needing the CDN
    if (selectedMerchant.gateway === 'beyondbancard') {
      console.log('🔷 Processing BeyondBancard payment with raw card data...');
      setPaying(true);
      setPaymentError(null);
      
      try {
        const payload = {
          cardNumber: cardData.cardNumber.replace(/\s/g, ''),
          cardHolder: cardData.cardHolder,
          expiryMonth: cardData.expiryMonth,
          expiryYear: cardData.expiryYear,
          cvv: cardData.cvv,
          merchantId: selectedMerchant._id,
          firstName: cardData.firstName,
          lastName: cardData.lastName,
          companyName: cardData.companyName,
          addressLine1: cardData.addressLine1,
          addressLine2: cardData.addressLine2,
          city: cardData.city,
          state: cardData.state,
          postalCode: cardData.postalCode,
          countryCode: cardData.countryCode,
          phone: cardData.phone,
        };
        
        console.log('=== PAYMENT REQUEST (RAW CARD) ===');
        console.log('Merchant:', selectedMerchant.nickname, `(${selectedMerchant.gateway})`);
        console.log('Cardholder:', payload.cardHolder);
        console.log('Amount:', invoice.total);
        console.log('Card last 4:', payload.cardNumber.slice(-4));
        
        const res = await api.post(`/invoices/public/${invoiceId}/pay`, payload);
        
        console.log('=== PAYMENT RESPONSE ===');
        console.log('Status:', res.data.status);
        console.log('Message:', res.data.message);
        
        if (res.data.status === 'paid') {
          toast.success('Payment successful!');
          
          if (res.data.redirectUrl && res.data.enableRedirect === true) {
            console.log('✅ Redirecting to:', res.data.redirectUrl);
            setTimeout(() => {
              window.location.href = res.data.redirectUrl;
            }, 2000);
          } else {
            setTimeout(() => {
              setStep('success');
            }, 1000);
          }
        } else if (res.data.redirect3DS) {
          window.location.href = res.data.redirect3DS;
        } else {
          const errorMsg = res.data.message || 'Payment failed. Please try again.';
          setPaymentError(errorMsg);
          toast.error(errorMsg);
        }
      } catch (err) {
        console.error('=== PAYMENT ERROR ===');
        console.error('Error:', err);
        console.error('Response:', err.response?.data);
        const errorMsg = err.response?.data?.message || 'Payment failed';
        setPaymentError(errorMsg);
        toast.error(errorMsg);
      } finally {
        setPaying(false);
      }
      return;
    }
    
    // For other gateways, send raw card data
    setPaying(true);
    setPaymentError(null);
    try {
      const payload = {
        cardNumber: cardData.cardNumber.replace(/\s/g, ''),
        cardHolder: cardData.cardHolder,
        expiryMonth: cardData.expiryMonth,
        expiryYear: cardData.expiryYear,
        cvv: cardData.cvv,
        merchantId: selectedMerchant._id,
        firstName: cardData.firstName,
        lastName: cardData.lastName,
        companyName: cardData.companyName,
        addressLine1: cardData.addressLine1,
        addressLine2: cardData.addressLine2,
        city: cardData.city,
        state: cardData.state,
        postalCode: cardData.postalCode,
        countryCode: cardData.countryCode,
        phone: cardData.phone,
      };
      
      console.log('=== PAYMENT REQUEST ===');
      console.log('Merchant:', selectedMerchant.nickname, `(${selectedMerchant.gateway})`);
      console.log('Card last 4:', payload.cardNumber.slice(-4));
      console.log('Cardholder:', payload.cardHolder);
      console.log('Expiry:', `${payload.expiryMonth}/${payload.expiryYear}`);
      console.log('Amount:', invoice.total);
      
      const res = await api.post(`/invoices/public/${invoiceId}/pay`, payload);
      
      console.log('=== PAYMENT RESPONSE ===');
      console.log('Status:', res.data.status);
      console.log('Message:', res.data.message);
      console.log('Transaction ID:', res.data.transactionId);
      console.log('Redirect URL:', res.data.redirectUrl);
      console.log('Enable Redirect:', res.data.enableRedirect);
      console.log('Full response:', res.data);
      
      if (res.data.status === 'paid') {
        toast.success('Payment successful!');
        
        console.log('=== REDIRECT CHECK ===');
        console.log('Redirect URL exists:', !!res.data.redirectUrl);
        console.log('Enable Redirect:', res.data.enableRedirect === true);
        console.log('Should redirect:', res.data.redirectUrl && res.data.enableRedirect === true);
        
        // Check if we should redirect to brand URL
        if (res.data.redirectUrl && res.data.enableRedirect === true) {
          console.log('✅ Redirecting to:', res.data.redirectUrl);
          setTimeout(() => {
            window.location.href = res.data.redirectUrl;
          }, 2000);
        } else {
          // Stay on success page
          console.log('❌ No redirect - showing success page');
          console.log('  Reason: ' + (!res.data.redirectUrl ? 'No redirectUrl' : 'enableRedirect not true'));
          setTimeout(() => {
            setStep('success');
          }, 1000);
        }
      } else if (res.data.redirect3DS) {
        window.location.href = res.data.redirect3DS;
      } else {
        const errorMsg = res.data.message || 'Payment failed. Please try again.';
        setPaymentError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (err) {
      console.error('=== PAYMENT ERROR ===');
      console.error('Error:', err);
      console.error('Response:', err.response?.data);
      const errorMsg = err.response?.data?.message || 'Payment failed';
      setPaymentError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setPaying(false);
    }
  };

  const getGatewayIcon = (gateway) => {
    const icons = {
      stripe: '💳',
      paypal: '🅿️',
      authorize: '🔐',
      beyondbancard: '🏦'
    };
    return icons[gateway] || '💰';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md">
          <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
          <p className="text-gray-500">Invoice not found</p>
        </div>
      </div>
    );
  }

  if (invoice.status === 'paid') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md">
          <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Complete</h2>
          <p className="text-gray-600">This invoice has already been paid.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 text-center">
          {invoice.brand?.logo ? (
            <img 
              src={getImageUrl(invoice.brand.logo)} 
              alt={invoice.brand.name}
              className="h-20 mx-auto mb-3 object-contain"
            />
          ) : (
            <h1 className="text-3xl font-bold text-blue-900 mb-3">{invoice.brand?.name || 'USPTO'}</h1>
          )}
          <p className="text-gray-600 text-lg">
            Office # {invoice.brandNo || 'N/A'}
          </p>
        </div>

        {/* Verification Step */}
        {step === 'verify' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Verify Your Information</h2>
              <p className="text-gray-600 text-sm">Please confirm your details to proceed with payment</p>
            </div>

            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={verifyData.customerName}
                  onChange={(e) => setVerifyData({ ...verifyData, customerName: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={verifyData.customerEmail}
                  onChange={(e) => setVerifyData({ ...verifyData, customerEmail: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number</label>
                <input
                  type="text"
                  required
                  value={verifyData.customerSerialNumber}
                  onChange={(e) => setVerifyData({ ...verifyData, customerSerialNumber: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your serial number"
                />
              </div>

              <button
                type="submit"
                disabled={verifying}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-3 rounded-lg font-medium transition-colors"
              >
                {verifying ? 'Verifying...' : 'Verify & Continue'}
              </button>
            </form>
          </div>
        )}

        {/* Payment Step */}
        {step === 'payment' && (
          <>
            {/* Customer Details */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Customer Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Name:</span>
                  <span className="font-medium">{invoice.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Email:</span>
                  <span className="font-medium">{invoice.customerEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Serial Number:</span>
                  <span className="font-medium">{invoice.customerSerialNumber}</span>
                </div>
              </div>
            </div>

            {/* Invoice Details */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-900">Invoice Details</h3>
                <span className="text-sm font-mono text-blue-600">{invoice.invoiceNumber}</span>
              </div>
              
              <div className="space-y-2 mb-4">
                {invoice.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-gray-700">{item.description}</span>
                    <span className="font-medium">USD ${Number(item.amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              
              <div className="border-t pt-3 flex justify-between items-center">
                <span className="font-semibold text-gray-900">Total Amount</span>
                <span className="text-2xl font-bold text-blue-600">USD ${invoice.total?.toFixed(2)}</span>
              </div>
            </div>

            {/* USPTO MANUAL PAYMENT FORM */}
            {isUSPTOBrand ? (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Lock size={18} className="text-gray-400" />
                  <h3 className="font-semibold text-gray-900">Payment Information</h3>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-yellow-800">
                    <strong>Manual Verification Required:</strong> After submitting your payment information, 
                    you will receive a verification code to complete your payment.
                  </p>
                </div>

                <form onSubmit={handleUSPTOPayment} className="space-y-4">
                  {/* USPTO Specific Fields */}
                  <div className="border-b pb-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Personal Information</h4>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Last 4 Digits of SSN *</label>
                        <input
                          type="text"
                          required
                          maxLength="4"
                          value={cardData.ssnLast4}
                          onChange={(e) => handleCardChange('ssnLast4', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="1234"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
                        <input
                          type="date"
                          required
                          value={cardData.dateOfBirth}
                          onChange={(e) => setCardData({ ...cardData, dateOfBirth: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card Details Section (for USPTO - collected but not processed) */}
                  <div className="border-b pb-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Payment Card Details</h4>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name on Card *</label>
                      <input
                        type="text"
                        required
                        value={cardData.cardHolder}
                        onChange={(e) => setCardData({ ...cardData, cardHolder: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="John Doe"
                      />
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Card Number *</label>
                      <input
                        type="text"
                        required
                        maxLength="19"
                        value={cardData.cardNumber}
                        onChange={(e) => handleCardChange('cardNumber', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="1234 5678 9012 3456"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Month *</label>
                        <input
                          type="text"
                          required
                          maxLength="2"
                          value={cardData.expiryMonth}
                          onChange={(e) => handleCardChange('expiryMonth', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="12"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Year *</label>
                        <input
                          type="text"
                          required
                          maxLength="4"
                          value={cardData.expiryYear}
                          onChange={(e) => handleCardChange('expiryYear', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="2025"
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">CVV *</label>
                      <input
                        type="text"
                        required
                        maxLength="4"
                        value={cardData.cvv}
                        onChange={(e) => handleCardChange('cvv', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="123"
                      />
                    </div>
                  </div>

                  {paymentError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-sm text-red-800">{paymentError}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={paying}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {paying ? (
                      <>
                        <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Lock size={18} />
                        Submit Payment Request
                      </>
                    )}
                  </button>
                </form>
              </div>
            ) : (
              /* REGULAR PAYMENT METHOD (NON-USPTO) */
              <div className="bg-white rounded-lg shadow-sm p-6">
                {invoice?.usePayPalDirect ? (
                  // PayPal Direct Checkout
                  <div>
                    <div className="flex items-center gap-2 mb-6">
                      <span className="text-2xl">🅿️</span>
                      <div>
                        <h3 className="font-semibold text-gray-900">PayPal Checkout</h3>
                        <p className="text-sm text-gray-600">Pay securely with your PayPal account</p>
                      </div>
                    </div>

                    {/* Brand Information */}
                    {invoice?.brand && (
                      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 mb-6 border border-blue-200">
                        <div className="flex items-center gap-3">
                          {invoice.brand.logoUrl ? (
                            <img 
                              src={getImageUrl(invoice.brand.logoUrl)} 
                              alt={invoice.brand.name}
                              className="w-12 h-12 object-contain rounded-lg bg-white p-1"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                              {invoice.brand.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{invoice.brand.name}</h4>
                            <p className="text-sm text-gray-600">Secure payment powered by PayPal</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PayPal Button Container */}
                    <div className="space-y-4">
                      {paying && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                          <div className="flex items-center gap-2">
                            <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                            <span className="text-sm font-medium text-blue-900">Processing your payment...</span>
                          </div>
                        </div>
                      )}
                      
                      <div className="bg-gray-50 rounded-lg p-4 border-2 border-dashed border-gray-200">
                        <div className="text-center py-8">
                          <div className="text-4xl mb-2">🅿️</div>
                          <h4 className="font-semibold text-gray-900 mb-2">PayPal Button</h4>
                          <p className="text-sm text-gray-600 mb-4">
                            Click the PayPal button below to complete your payment securely
                          </p>
                          
                          {/* PayPal SDK Button will be rendered here */}
                          <div id="paypal-button-container" ref={paypalRef} className="min-h-[50px]">
                            {!paypalLoaded && (
                              <div className="flex items-center justify-center py-4">
                                <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mr-2"></div>
                                <span className="text-sm text-gray-600">Loading PayPal...</span>
                              </div>
                            )}
                          </div>
                          
                          <p className="text-xs text-gray-500 mt-4">
                            You'll be redirected to PayPal to complete the payment securely.
                            <br />No card details need to be entered on this page.
                          </p>
                        </div>
                      </div>

                      {/* Alternative payment note */}
                      <div className="text-center">
                        <p className="text-xs text-gray-500">
                          Having trouble? Contact support for alternative payment methods.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Regular Card Payment Form
                  <div>
                <div className="flex items-center gap-2 mb-4">
                  <Lock size={18} className="text-gray-400" />
                  <h3 className="font-semibold text-gray-900">Card Details</h3>
                </div>

                <form onSubmit={handlePayment} className="space-y-4">
                  {/* Billing Information Section */}
                  <div className="border-b pb-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Billing Information</h4>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                        <input
                          type="text"
                          required
                          value={cardData.firstName}
                          onChange={(e) => setCardData({ ...cardData, firstName: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="John"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                        <input
                          type="text"
                          required
                          value={cardData.lastName}
                          onChange={(e) => setCardData({ ...cardData, lastName: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Doe"
                        />
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Company Name (Optional)</label>
                      <input
                        type="text"
                        value={cardData.companyName}
                        onChange={(e) => setCardData({ ...cardData, companyName: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Company Inc."
                      />
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1 *</label>
                      <input
                        type="text"
                        required
                        value={cardData.addressLine1}
                        onChange={(e) => setCardData({ ...cardData, addressLine1: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="123 Main Street"
                      />
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2 (Optional)</label>
                      <input
                        type="text"
                        value={cardData.addressLine2}
                        onChange={(e) => setCardData({ ...cardData, addressLine2: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Apt 4B"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                        <input
                          type="text"
                          required
                          value={cardData.city}
                          onChange={(e) => setCardData({ ...cardData, city: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="New York"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                        <input
                          type="text"
                          required
                          value={cardData.state}
                          onChange={(e) => setCardData({ ...cardData, state: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="NY"
                          maxLength="2"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code *</label>
                        <input
                          type="text"
                          required
                          value={cardData.postalCode}
                          onChange={(e) => setCardData({ ...cardData, postalCode: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="10001"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Country *</label>
                        <select
                          required
                          value={cardData.countryCode}
                          onChange={(e) => setCardData({ ...cardData, countryCode: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="US">United States</option>
                          <option value="CA">Canada</option>
                          <option value="GB">United Kingdom</option>
                          <option value="AU">Australia</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone Number {selectedMerchant?.gateway === 'beyondbancard' ? '*' : '(Optional)'}
                      </label>
                      <input
                        type="tel"
                        required={selectedMerchant?.gateway === 'beyondbancard'}
                        value={cardData.phone}
                        onChange={(e) => setCardData({ ...cardData, phone: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                  </div>

                  {/* Card Details Section */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Card Details</h4>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name on Card *</label>
                      <input
                        type="text"
                        required
                        value={cardData.cardHolder}
                        onChange={(e) => handleCardChange('cardHolder', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="John Doe"
                      />
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Card Number *</label>
                      <input
                        type="text"
                        required
                        value={cardData.cardNumber}
                        onChange={(e) => handleCardChange('cardNumber', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="1234 5678 9012 3456"
                        maxLength="19"
                      />
                      <div className="flex gap-4 mt-3">
                        <img src="https://cdn.worldvectorlogo.com/logos/visa-4.svg" alt="Visa" className="h-8 w-auto" />
                        <img src="https://cdn.worldvectorlogo.com/logos/mastercard-6.svg" alt="Mastercard" className="h-8 w-auto" />
                        <img src="https://cdn.worldvectorlogo.com/logos/american-express-3.svg" alt="Amex" className="h-8 w-auto" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Expiration Date *</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            required
                            value={cardData.expiryMonth}
                            onChange={(e) => handleCardChange('expiryMonth', e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="MM"
                            maxLength="2"
                          />
                          <input
                            type="text"
                            required
                            value={cardData.expiryYear}
                            onChange={(e) => handleCardChange('expiryYear', e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="YYYY"
                            maxLength="4"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">CVV *</label>
                        <input
                          type="text"
                          required
                          value={cardData.cvv}
                          onChange={(e) => handleCardChange('cvv', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="123"
                          maxLength="4"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={paying}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Lock size={18} />
                    {paying ? 'Processing...' : `Pay USD $${invoice.total?.toFixed(2)}`}
                  </button>

                  {paymentError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                      <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-900">Payment Failed</p>
                        <p className="text-sm text-red-700 mt-1">{paymentError}</p>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-gray-500 text-center">
                    Your payment is secure and encrypted
                  </p>
                </form>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* OTP Waiting Screen (USPTO) */}
        {step === 'otp-waiting' && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="flex flex-col items-center justify-center">
              <div className="animate-spin w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full mb-6"></div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Processing Your Payment</h2>
              <p className="text-gray-600 mb-4 max-w-md">
                We are processing your payment request. You may need to verify with an OTP to confirm additional information.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                <p className="text-sm text-blue-800">
                  <strong>Please wait...</strong> An administrator will review your request and send you a verification code shortly.
                </p>
              </div>
              <div className="mt-6 text-sm text-gray-500">
                <p>This page will automatically update when the verification code is sent.</p>
              </div>
            </div>
          </div>
        )}

        {/* OTP Input Screen (USPTO) - Customer enters any code, no validation */}
        {step === 'otp-input' && (
          <div className="bg-white rounded-lg shadow-sm p-8">
            <div className="max-w-md mx-auto">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock size={32} className="text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Verification Required</h2>
                <p className="text-gray-600">
                  OTP sent to your <strong>{otpMethod === 'email' ? 'email' : 'text message'}</strong>
                </p>
              </div>

              {adminNote && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-blue-800 font-medium mb-1">Message from Administrator:</p>
                  <p className="text-sm text-blue-900">{adminNote}</p>
                </div>
              )}

              <form onSubmit={handleOTPSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                    Enter 6-Digit Verification Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength="6"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-2xl font-mono tracking-widest"
                    placeholder="000000"
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Enter any 6-digit code to proceed
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={verifyingOTP || otpCode.length !== 6}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {verifyingOTP ? (
                    <>
                      <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={18} />
                      Proceed with Payment
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-500">
                  Please enter the verification code to continue.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Payment Marked by Customer Screen */}
        {step === 'customer-marked' && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Marked by Customer</h2>
            <p className="text-gray-600 mb-6">
              Your payment information has been submitted and marked for verification.
            </p>
            <div className="bg-blue-50 rounded-lg p-6 mb-6">
              <p className="text-sm text-blue-800 font-medium mb-2">What's Next?</p>
              <p className="text-sm text-blue-900">
                The administrator will review your payment and update the status shortly.
                You will receive an email confirmation once the payment is processed.
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-600">
                Invoice: <strong>{invoice.invoiceNumber}</strong>
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Amount: <strong>USD ${invoice.total?.toFixed(2)}</strong>
              </p>
            </div>
          </div>
        )}

        {/* Success Step */}
        {step === 'success' && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
            <p className="text-gray-600 mb-6">
              Your payment of <span className="font-bold text-green-600">USD ${invoice.total?.toFixed(2)}</span> has been processed successfully.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600 mb-1">Transaction Details</p>
              <p className="font-mono text-sm text-gray-900">{invoice.invoiceNumber}</p>
            </div>
            <p className="text-sm text-gray-500">
              A confirmation email has been sent to {invoice.customerEmail}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
