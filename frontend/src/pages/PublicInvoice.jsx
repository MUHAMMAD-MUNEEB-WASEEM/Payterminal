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
  const [step, setStep] = useState('verify'); // 'verify' | 'payment' | 'success'
  const [merchants, setMerchants] = useState([]);
  const collectJsRef = useRef(null);
  
  // Create API instance with correct base URL
  const api = axios.create({ baseURL: `${getApiBaseUrl()}/api` });
  
  const [selectedMerchant, setSelectedMerchant] = useState(null);
  
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
  });
  const [paying, setPaying] = useState(false);
  const [collectJsReady, setCollectJsReady] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const paypalRef = useRef(null);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const res = await api.get(`/invoices/public/${invoiceId}`);
        setInvoice(res.data);
        
        // If already verified, skip to payment
        if (res.data.customerVerified) {
          setStep('payment');
          // Fetch merchants using public endpoint
          const merchantsRes = await api.get(`/merchants/brand/${res.data.brandId}/public`);
          const availableMerchants = merchantsRes.data.filter(m => m.isActive !== false);
          setMerchants(availableMerchants);
          
          // Always select first merchant (default or first in list)
          const defaultMerchant = availableMerchants.find(m => m.isDefault);
          setSelectedMerchant(defaultMerchant || availableMerchants[0] || null);
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
          // Get PayPal merchant for this brand to extract client ID
          const merchantsRes = await api.get(`/merchants/brand/${invoice.brandId}/public`);
          const paypalMerchant = merchantsRes.data.find(m => m.gateway === 'paypal' && m.isActive);
          
          if (!paypalMerchant) {
            toast.error('PayPal payment method not available');
            return;
          }
          
          // Extract client ID from merchant credentials
          const clientId = paypalMerchant.credentials?.clientId;
          const mode = paypalMerchant.credentials?.mode || 'sandbox';
          
          if (!clientId) {
            console.error('PayPal client ID not configured');
            toast.error('PayPal configuration error');
            return;
          }
          
          console.log('Loading PayPal SDK with client ID:', clientId.substring(0, 10) + '...');
          console.log('Mode:', mode);
          
          const script = document.createElement('script');
          script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
          script.async = true;
          script.onload = () => {
            console.log('PayPal SDK loaded successfully');
            setPaypalLoaded(true);
          };
          script.onerror = () => {
            console.error('Failed to load PayPal SDK');
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
          console.error('Error loading PayPal SDK:', err);
          toast.error('Failed to initialize PayPal');
        }
      }
    };
    
    loadPayPalSDK();
  }, [invoice?.usePayPalDirect, invoice?.brandId, paypalLoaded]);

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
        const availableMerchants = res.data.merchants || [];
        setMerchants(availableMerchants);
        
        // Always select first merchant (default or first in list)
        const defaultMerchant = availableMerchants.find(m => m.isDefault);
        setSelectedMerchant(defaultMerchant || availableMerchants[0] || null);
        
        // Refresh invoice data to get updated customer info
        const invoiceRes = await api.get(`/invoices/public/${invoiceId}`);
        setInvoice(invoiceRes.data);
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
    setCardData({ ...cardData, [field]: formatted });
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!selectedMerchant) {
      return toast.error('Please select a payment method');
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

            {/* Payment Method Selection */}
            {selectedMerchant ? (
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
            ) : (
              /* No merchants available */
              <div className="bg-white rounded-lg shadow-sm p-6 text-center">
                <AlertCircle size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">No payment methods available for this brand</p>
              </div>
            )}
          </>
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
