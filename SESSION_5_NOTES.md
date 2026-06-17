# Session 5 - Vercel Build Error Fix & Local Environment Setup

## Issue Fixed
**Vercel Build Error**: `[builtin:vite-transform] Error: Unexpected token`

### Root Cause
Line 390 in `frontend/src/pages/Merchants.jsx` contained `>=` operator inside JSX text:
```jsx
<p>Invoices >= this amount cannot be created...</p>
```

Vite's JSX parser was interpreting `>` as the start of a JSX element tag, causing a syntax error.

### Solution Applied
Changed the text to use descriptive language instead of the operator:
```jsx
<p>Maximum amount for a single invoice. Invoices greater than or equal to this amount cannot be created. Leave empty for no limit.</p>
```

This avoids any special characters that could confuse the JSX parser.

### Files Changed
- `frontend/src/pages/Merchants.jsx` (line 390)

### Commit
- Commit hash: `e48728a` - "fix: Escape > operator in JSX text to fix Vite build error"

## Local Environment Status
✅ Both servers running successfully:
- **Backend**: http://localhost:5000 (Node.js + Express)
- **Frontend**: http://localhost:5173 (Vite Dev Server)

## Testing the Fix
The fix is now deployed. Vercel should rebuild successfully on the next deployment.

To verify locally:
1. Frontend runs on http://localhost:5173
2. Navigate to Merchants page
3. Confirm help text displays without errors
4. Create/edit merchants to test ticket size feature

## Important Notes
- The `>=` operator was the culprit - similar patterns elsewhere in the codebase were already wrapped in curly braces or avoided
- The fix uses human-readable text instead of operators in JSX text content
- Backend and frontend are now running and ready for testing

## Next Steps
1. Test the Merchants page UI locally
2. Verify ticket size feature works correctly
3. Test payment processing with NMI (should now use correct dollar amounts)
4. Verify Vercel build passes on next deploy
