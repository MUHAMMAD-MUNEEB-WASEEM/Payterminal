// Test to verify invoice amount handling
// If you entered $5, this should show as $5, not $500

const testCases = [
  { input: "5", expected: 5, description: "String '5' should become number 5" },
  { input: 5, expected: 5, description: "Number 5 should stay 5" },
  { input: "500", expected: 500, description: "String '500' should become number 500" },
];

testCases.forEach(test => {
  const result = Number(test.input);
  const pass = result === test.expected;
  console.log(`${pass ? '✅' : '❌'} ${test.description}: ${result}`);
});

// If you see something showing as $500 when you entered $5,
// it means the amount is being stored as 500 in the database
// This could happen if:
// 1. Amount was multiplied by 100 on input (but we didn't see that code)
// 2. Amount field is reading a different value
// 3. Form is sending amount * 100

console.log('\n📝 Check: When you add an invoice item with amount 5,');
console.log('   what value appears in the form field before submitting?');
console.log('   Then check the database to confirm what was stored.');
