import { useState, useEffect } from 'react';
import Modal from './Modal';
import api from '../api/axios';

export default function VerificationModal({ isOpen, onClose, onVerified, action, actionLabel, skipVerify = false, targetId = null, targetName = null }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);

  // Reset state when modal opens/closes or action changes
  useEffect(() => {
    if (!isOpen) {
      setCode('');
      setError('');
      setCodeSent(false);
      setLoading(false);
      setSendingCode(false);
    }
  }, [isOpen]);

  // Debug: Log props when modal opens
  if (isOpen) {
    console.log('🔓 VerificationModal opened with props:', { action, actionLabel, targetId, targetName, skipVerify });
  }

  const handleGenerateCode = async () => {
    console.log('🎯 handleGenerateCode called with current props:', { action, targetId, targetName });
    
    if (!action) {
      console.error('❌ No action provided to generate code');
      setError('Action is required');
      return;
    }

    setSendingCode(true);
    setError('');
    try {
      console.log('🔑 Generating code with:', { action, targetId, targetName });
      const response = await api.post('/verification/generate', { action, targetId, targetName });
      console.log('✅ Code generated successfully:', response.data);
      setCodeSent(true);
    } catch (err) {
      console.error('❌ Generate code error:', err.response?.data);
      setError(err.response?.data?.message || 'Failed to send verification code');
    } finally {
      setSendingCode(false);
    }
  };

  const handleResendCode = async () => {
    setSendingCode(true);
    setError('');
    setCode('');
    try {
      console.log('🔄 Resending code with:', { action, targetId, targetName });
      await api.post('/verification/resend', { action, targetId, targetName });
      setCodeSent(true);
    } catch (err) {
      console.error('❌ Resend code error:', err.response?.data);
      setError(err.response?.data?.message || 'Failed to resend verification code');
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerify = async () => {
    if (!code.trim()) {
      setError('Please enter verification code');
      return;
    }

    // If skipVerify is true, pass code directly without verifying it first
    if (skipVerify) {
      onVerified(code.trim());
      handleClose();
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.post('/verification/verify', { code: code.trim(), action });
      if (response.data.success) {
        onVerified(code.trim());
        handleClose();
      } else {
        setError('Invalid verification code');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCode('');
    setError('');
    setCodeSent(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Verification Required">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          This action requires email verification. A 6-digit code will be sent to the admin email.
        </p>

        {!action ? (
          <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
            Error: No action specified. Please close and try again.
          </div>
        ) : !codeSent ? (
          <button
            onClick={() => {
              console.log('🎯 Button clicked, current action:', action);
              handleGenerateCode();
            }}
            disabled={sendingCode || !action}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {sendingCode ? 'Sending Code...' : 'Send Verification Code'}
          </button>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Verification Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter 6-digit code"
                maxLength={6}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleVerify}
                disabled={loading}
                className="flex-1 py-2 px-4 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
              >
                {loading ? 'Verifying...' : actionLabel || 'Verify & Continue'}
              </button>
              <button
                onClick={handleResendCode}
                disabled={sendingCode}
                className="py-2 px-4 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-400"
              >
                {sendingCode ? 'Sending...' : 'Resend'}
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center">
              Code expires in 10 minutes
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
