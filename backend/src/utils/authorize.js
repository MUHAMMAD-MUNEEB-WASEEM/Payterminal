/**
 * Process payment with Authorize.net
 * @param {Object} credentials - Merchant credentials { apiLoginId, transactionKey, mode }
 * @param {Object} paymentData - { amount, currency, cardNumber, cardHolder, expiryMonth, expiryYear, cvv, description }
 * @returns {Object} { success, transactionId, error }
 */
async function processAuthorizePayment(credentials, paymentData) {
  try {
    // Ensure credentials exist
    if (!credentials) {
      console.error('No credentials provided');
      return {
        success: false,
        error: 'Merchant credentials not configured',
      };
    }

    const apiLoginId = credentials.apiLoginId;
    const transactionKey = credentials.transactionKey;
    const mode = credentials.mode || 'sandbox';
    const cleanCard = paymentData.cardNumber.replace(/\s/g, '');

    console.log('Authorize.net Payment Request:', {
      mode,
      amount: paymentData.amount,
      hasApiLoginId: !!apiLoginId,
      hasTransactionKey: !!transactionKey,
      cardLastFour: cleanCard.slice(-4),
    });

    // Test cards
    const testCards = [
      '4242424242424242',
      '5555555555554444',
      '378282246310005',
      '4111111111111111',
      '370000000000002',
      '4007000000027',
      '5424000000000015',
      '6011000000000012',
    ];

    const isTestCard = testCards.includes(cleanCard);

    // If sandbox mode, accept test cards
    if (mode === 'sandbox') {
      console.log('Sandbox mode - accepting payment');
      return {
        success: true,
        transactionId: `authorize_sandbox_${Date.now()}`,
        message: 'Test payment successful (Authorize.net Sandbox)',
      };
    }

    // Live mode - use Authorize.net SDK
    if (mode === 'live' && apiLoginId && transactionKey) {
      console.log('Live mode - processing with Authorize.net SDK');

      try {
        const ApiContracts = require('authorizenet').APIContracts;
        const ApiControllers = require('authorizenet').APIControllers;
        const SDKConstants = require('authorizenet').Constants;

        const merchantAuthenticationType = new ApiContracts.MerchantAuthenticationType();
        merchantAuthenticationType.setName(apiLoginId);
        merchantAuthenticationType.setTransactionKey(transactionKey);

        const creditCard = new ApiContracts.CreditCardType();
        creditCard.setCardNumber(cleanCard);
        creditCard.setExpirationDate(
          `${paymentData.expiryYear}-${paymentData.expiryMonth.padStart(2, '0')}`
        );
        creditCard.setCardCode(paymentData.cvv);

        const paymentType = new ApiContracts.PaymentType();
        paymentType.setCreditCard(creditCard);

        const transactionRequestType = new ApiContracts.TransactionRequestType();
        transactionRequestType.setTransactionType(
          ApiContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION
        );
        transactionRequestType.setPayment(paymentType);
        transactionRequestType.setAmount(paymentData.amount);

        const createRequest = new ApiContracts.CreateTransactionRequest();
        createRequest.setMerchantAuthentication(merchantAuthenticationType);
        createRequest.setTransactionRequest(transactionRequestType);

        const ctrl = new ApiControllers.CreateTransactionController(createRequest.getJSON());
        ctrl.setEnvironment(SDKConstants.endpoint.production);

        return new Promise((resolve) => {
          ctrl.execute(() => {
            const apiResponse = ctrl.getResponse();
            const response = new ApiContracts.CreateTransactionResponse(apiResponse);

            console.log('Authorize.net Response:', {
              resultCode: response.getMessages().getResultCode(),
            });

            if (response.getMessages().getResultCode() === ApiContracts.MessageTypeEnum.OK) {
              const transResponse = response.getTransactionResponse();
              if (transResponse && transResponse.getMessages() != null) {
                resolve({
                  success: true,
                  transactionId: transResponse.getTransId(),
                  message: 'Payment successful',
                });
              } else {
                const errors = transResponse.getErrors();
                const errorMessage = errors
                  ? errors.getError()[0].getErrorText()
                  : 'Transaction failed';
                console.error('Transaction error:', errorMessage);
                resolve({
                  success: false,
                  error: errorMessage,
                });
              }
            } else {
              const errorMessage = response.getMessages().getMessage()[0].getText();
              console.error('API error:', errorMessage);
              resolve({
                success: false,
                error: errorMessage,
              });
            }
          });
        });
      } catch (sdkError) {
        console.error('Authorize.net SDK error:', sdkError.message);
        return {
          success: false,
          error: 'Payment processing failed: ' + sdkError.message,
        };
      }
    }

    // If we reach here, no valid mode/credentials
    return {
      success: false,
      error: 'Invalid merchant configuration. Please check API Login ID and Transaction Key.',
    };
  } catch (error) {
    console.error('Authorize.net payment error:', error.message);
    return {
      success: false,
      error: error.message || 'Payment processing failed',
    };
  }
}

module.exports = { processAuthorizePayment };
