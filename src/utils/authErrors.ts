/**
 * Centralized error handler for authentication and OTP operations.
 * Converts raw server errors, HTTP status codes, and Firebase exceptions
 * into clear, polite, and actionable messages that end users can easily understand.
 */

export interface AuthErrorInfo {
  friendlyMessage: string;
  isRateLimit: boolean;
  isUnregistered: boolean;
  isAlreadyExists: boolean;
  isTimeout: boolean;
  isInvalidOtp: boolean;
}

export function parseAuthError(err: any, role: string = 'individual', action: 'login' | 'register' | 'otp' | 'forgot' = 'login'): AuthErrorInfo {
  let rawMessage = '';
  const status = err?.response?.status;

  if (err && typeof err === 'object') {
    if (err.response?.data) {
      const data = err.response.data;
      rawMessage = typeof data.message === 'string' 
        ? data.message 
        : (Array.isArray(data.message) ? data.message[0] : (data.error || ''));
    }
    if (!rawMessage) {
      rawMessage = err.message || '';
    }
  } else if (typeof err === 'string') {
    rawMessage = err;
  }

  const lower = (rawMessage || '').toLowerCase();
  const code = (err?.code || '').toLowerCase();

  const isRateLimit = status === 429 || 
    lower.includes('too many') || 
    lower.includes('rate limit') || 
    lower.includes('too-many-requests') || 
    lower.includes('over_sms') ||
    lower.includes('slow down');

  const isUnregistered = status === 404 ||
    lower.includes('not found') ||
    lower.includes('not registered') ||
    lower.includes('no account') ||
    lower.includes('does not exist') ||
    lower.includes('user does not exist') ||
    lower.includes('coach not found') ||
    lower.includes('no coach found') ||
    lower.includes('no user found');

  const isAlreadyExists = status === 409 ||
    lower.includes('already exists') ||
    lower.includes('already registered') ||
    lower.includes('already in use') ||
    lower.includes('duplicate') ||
    lower.includes('email_exists') ||
    lower.includes('phone_exists');

  const isTimeout = code === 'econnaborted' || lower.includes('timeout') || lower.includes('etimedout');

  const isInvalidOtp = lower.includes('invalid otp') ||
    lower.includes('invalid verification code') ||
    lower.includes('invalid code') ||
    lower.includes('expired') ||
    lower.includes('incorrect otp') ||
    lower.includes('otp mismatch') ||
    lower.includes('code does not match') ||
    lower.includes('invalid-verification-code');

  let friendlyMessage = '';

  if (isRateLimit) {
    friendlyMessage = 'For your security, verification code requests are temporarily paused after multiple attempts. Please wait 1 to 2 minutes before requesting another code.';
  } else if (isUnregistered && action !== 'register') {
    friendlyMessage = role === 'coach'
      ? 'No coach account was found for this mobile number. Please register your coach account to get started.'
      : 'No account was found for this mobile number. Please create an account to get started with Arenova.';
  } else if (isAlreadyExists) {
    friendlyMessage = role === 'coach'
      ? 'A coach account with this phone number or email is already registered. Please log in instead.'
      : 'An account with this phone number or email is already registered. Please log in instead.';
  } else if (isInvalidOtp) {
    friendlyMessage = 'The verification code entered is incorrect or has expired. Please check your SMS and enter the 6-digit code again.';
  } else if (isTimeout) {
    friendlyMessage = 'The verification service took longer than expected. Please check if your SMS code arrived, or wait a moment before trying again.';
  } else if (lower.includes('network') || lower.includes('network-request-failed') || !err?.response && code) {
    friendlyMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
  } else if (lower.includes('invalid credential') || lower.includes('wrong-password') || lower.includes('incorrect password') || lower.includes('invalid email or password')) {
    friendlyMessage = 'Incorrect credentials. Please verify your email/phone and password, then try again.';
  } else if (lower.includes('password') && (lower.includes('weak') || lower.includes('short'))) {
    friendlyMessage = 'Password must be at least 6 characters long and include numbers and special characters.';
  } else if (lower.includes('invalid email') || lower.includes('valid email')) {
    friendlyMessage = 'Please enter a valid email address.';
  } else if (lower.includes('invalid phone') || lower.includes('valid phone') || lower.includes('10-digit')) {
    friendlyMessage = 'Please enter a valid 10-digit mobile number.';
  } else if (status === 401 || status === 403) {
    friendlyMessage = 'Access restricted. Please verify your account credentials or contact support.';
  } else if (rawMessage && !rawMessage.includes('AxiosError') && !rawMessage.includes('status code') && !rawMessage.includes('{') && rawMessage.length < 120) {
    let clean = rawMessage.replace(/^Firebase:\s*/i, '');
    clean = clean.replace(/^Error:\s*/i, '');
    clean = clean.replace(/\(auth\/[^)]+\)\.?/g, '');
    friendlyMessage = clean.trim();
  } else {
    friendlyMessage = 'Something went wrong while processing your request. Please try again in a moment.';
  }

  return {
    friendlyMessage,
    isRateLimit,
    isUnregistered,
    isAlreadyExists,
    isTimeout,
    isInvalidOtp,
  };
}

export function getFriendlyAuthErrorMessage(err: any, role: string = 'individual', action: 'login' | 'register' | 'otp' | 'forgot' = 'login'): string {
  return parseAuthError(err, role, action).friendlyMessage;
}
