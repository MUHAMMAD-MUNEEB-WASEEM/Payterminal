// Get the base API URL based on current environment
export function getApiBaseUrl() {
  // Check if we're in production (Vercel)
  if (window.location.hostname.includes('vercel.app') || window.location.hostname.includes('payterminalportal.com')) {
    return 'https://payterminal.onrender.com';
  }
  
  // Local development
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  }
  
  // Fallback
  return 'https://payterminal.onrender.com';
}

// Get full image URL
export function getImageUrl(path) {
  if (!path) return null;
  return `${getApiBaseUrl()}${path}`;
}
