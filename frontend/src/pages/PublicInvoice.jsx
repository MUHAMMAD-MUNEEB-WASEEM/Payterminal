import { useEffect, useState } from 'react';
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
  
  // Create API instance with correct base URL
  const api = axios.create({ baseURL: `${getApiBaseUrl()}/api` });const [selectedMerchant, setSelectedMerchant] = useState(null);
  
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
  });
  const [paying, setPaying] = useState(false);

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
    
    setPaying(true);
    try {
      const payload = {
        cardNumber: cardData.cardNumber.replace(/\s/g, ''),
        cardHolder: cardData.cardHolder,
        expiryMonth: cardData.expiryMonth,
        expiryYear: cardData.expiryYear,
        cvv: cardData.cvv,
        merchantId: selectedMerchant._id,
      };
      const res = await api.post(`/invoices/public/${invoiceId}/pay`, payload);
      
      console.log('Payment response:', res.data);
      
      if (res.data.status === 'paid') {
        toast.success('Payment successful!');
        
        console.log('Redirect check:', {
          redirectUrl: res.data.redirectUrl,
          enableRedirect: res.data.enableRedirect,
          shouldRedirect: res.data.redirectUrl && res.data.enableRedirect
        });
        
        // Check if we should redirect to brand URL
        if (res.data.redirectUrl && res.data.enableRedirect === true) {
          console.log('Redirecting to:', res.data.redirectUrl);
          setTimeout(() => {
            window.location.href = res.data.redirectUrl;
          }, 2000);
        } else {
          // Stay on success page
          console.log('No redirect - showing success page');
          setTimeout(() => {
            setStep('success');
          }, 1000);
        }
      } else if (res.data.redirect3DS) {
        window.location.href = res.data.redirect3DS;
      } else {
        toast.error('Payment failed. Please try again.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment failed');
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

            {/* Card Payment Form - Always show with first merchant */}
            {selectedMerchant ? (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Lock size={18} className="text-gray-400" />
                  <h3 className="font-semibold text-gray-900">Card Details</h3>
                </div>

                <form onSubmit={handlePayment} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name on Card</label>
                    <input
                      type="text"
                      required
                      value={cardData.cardHolder}
                      onChange={(e) => handleCardChange('cardHolder', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="John Doe"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Card Number</label>
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">Expiration Date</label>
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">CVV</label>
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

                  <button
                    type="submit"
                    disabled={paying}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Lock size={18} />
                    {paying ? 'Processing...' : `Pay USD $${invoice.total?.toFixed(2)}`}
                  </button>

                  <p className="text-xs text-gray-500 text-center">
                    Your payment is secure and encrypted
                  </p>
                </form>
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
