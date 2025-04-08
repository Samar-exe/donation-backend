import { OAuth2Client } from 'google-auth-library';

// Initialize the Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Verify the ID token
const verifyIdToken = async (idToken) => {
  try {
    console.log('Verifying ID token with client ID:', process.env.GOOGLE_CLIENT_ID);
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    console.log('Token verified successfully for:', payload.email);
    return payload;
  } catch (error) {
    console.error('Error verifying ID token:', error);
    throw error;
  }
};

export {
  googleClient,
  verifyIdToken
}; 