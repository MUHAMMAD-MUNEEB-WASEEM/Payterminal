// Test script to verify Authorize.net credentials
const ApiContracts = require('authorizenet').APIContracts;
const ApiControllers = require('authorizenet').APIControllers;
const SDKConstants = require('authorizenet').Constants;

// Replace these with your actual credentials
const API_LOGIN_ID = '87fSG8mfTransKey';  // Your API Login ID
const TRANSACTION_KEY = '4e26c8Vwf62KGw24';  // Your Transaction Key
const MODE = 'sandbox'; // or 'live'

console.log('Testing Authorize.net Credentials...');
console.log('API Login ID:', API_LOGIN_ID);
console.log('Transaction Key:', TRANSACTION_KEY.substring(0, 4) + '****');
console.log('Mode:', MODE);
console.log('---');

const merchantAuthenticationType = new ApiContracts.MerchantAuthenticationType();
merchantAuthenticationType.setName(API_LOGIN_ID);
merchantAuthenticationType.setTransactionKey(TRANSACTION_KEY);

const creditCard = new ApiContracts.CreditCardType();
creditCard.setCardNumber('4007000000027'); // Authorize.net test card
creditCard.setExpirationDate('2025-12');
creditCard.setCardCode('123');

const paymentType = new ApiContracts.PaymentType();
paymentType.setCreditCard(creditCard);

const transactionRequestType = new ApiContracts.TransactionRequestType();
transactionRequestType.setTransactionType(ApiContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION);
transactionRequestType.setPayment(paymentType);
transactionRequestType.setAmount(1.00);

const createRequest = new ApiContracts.CreateTransactionRequest();
createRequest.setMerchantAuthentication(merchantAuthenticationType);
createRequest.setTransactionRequest(transactionRequestType);

const ctrl = new ApiControllers.CreateTransactionController(createRequest.getJSON());

// Set endpoint
if (MODE === 'live') {
  ctrl.setEnvironment(SDKConstants.endpoint.production);
  console.log('Using PRODUCTION endpoint');
} else {
  ctrl.setEnvironment(SDKConstants.endpoint.sandbox);
  console.log('Using SANDBOX endpoint');
}

ctrl.execute(() => {
  const apiResponse = ctrl.getResponse();
  const response = new ApiContracts.CreateTransactionResponse(apiResponse);

  console.log('\n=== RESPONSE ===');
  console.log('Result Code:', response.getMessages().getResultCode());
  
  if (response.getMessages().getResultCode() === ApiContracts.MessageTypeEnum.OK) {
    console.log('✅ SUCCESS! Authentication is working!');
    const transResponse = response.getTransactionResponse();
    if (transResponse && transResponse.getMessages()) {
      console.log('Transaction ID:', transResponse.getTransId());
      console.log('Message:', transResponse.getMessages().getMessage()[0].getDescription());
    } else if (transResponse && transResponse.getErrors()) {
      console.log('⚠️ Transaction Error:', transResponse.getErrors().getError()[0].getErrorText());
    }
  } else {
    console.log('❌ FAILED! Authentication error');
    const messages = response.getMessages().getMessage();
    console.log('Error Code:', messages[0].getCode());
    console.log('Error Message:', messages[0].getText());
    
    console.log('\n=== TROUBLESHOOTING ===');
    if (messages[0].getCode() === 'E00007') {
      console.log('This means your API Login ID or Transaction Key is incorrect.');
      console.log('Please verify:');
      console.log('1. You copied the credentials correctly (no extra spaces)');
      console.log('2. You are using the right account (sandbox vs production)');
      console.log('3. The Transaction Key was not regenerated after you copied it');
    }
  }
});
