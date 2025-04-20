import crypto from 'crypto';
import User from '../models/User.js';

// Generate a unique referral code for a user
const generateReferralCode = async (userId) => {
  // Create a base code using the user ID and a random string
  const baseCode = userId.toString().substring(0, 6) + 
                  crypto.randomBytes(3).toString('hex');
  
  // Convert to a more user-friendly format (letters and numbers)
  const code = baseCode.replace(/[^a-zA-Z0-9]/g, '')
                      .toUpperCase()
                      .substring(0, 8);
  
  // Check if code already exists
  const existingUser = await User.findOne({ referralCode: code });
  if (existingUser) {
    // Recursively try again if code exists
    return generateReferralCode(userId);
  }
  
  return code;
};

// @desc    Get current user's referral info
// @route   GET /api/referral
// @access  Private
export const getReferralInfo = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    // Generate a referral code if user doesn't have one
    if (!user.referralCode) {
      user.referralCode = await generateReferralCode(user._id);
      await user.save();
    }
    
    res.status(200).json({
      referralCode: user.referralCode,
      referralCount: user.referralCount,
      sawabPoints: user.sawabPoints
    });
  } catch (error) {
    console.error('Error getting referral info:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Apply referral code and award points
// @route   POST /api/referral/apply
// @access  Private
export const applyReferralCode = async (req, res) => {
  try {
    const { referralCode } = req.body;
    
    // Check if code exists
    const referrer = await User.findOne({ referralCode });
    
    if (!referrer) {
      return res.status(404).json({ message: 'Invalid referral code' });
    }
    
    // Check if user is trying to refer themselves
    if (referrer._id.toString() === req.user.id) {
      return res.status(400).json({ message: 'You cannot refer yourself' });
    }
    
    // Check if user has already been referred
    const currentUser = await User.findById(req.user.id);
    if (currentUser.referredBy) {
      return res.status(400).json({ message: 'You have already used a referral code' });
    }
    
    // Update referrer's points and count
    referrer.sawabPoints += 5; // Referrer gets 5 points when someone uses their code
    referrer.referralCount += 1;
    await referrer.save();
    
    // Update current user's referral info
    currentUser.referredBy = referrer._id;
    currentUser.sawabPoints += 2; // User gets 2 points for using a referral code
    await currentUser.save();
    
    res.status(200).json({
      message: 'Referral code applied successfully',
      sawabPoints: currentUser.sawabPoints
    });
  } catch (error) {
    console.error('Error applying referral code:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Award points for sharing referral link
// @route   POST /api/referral/share
// @access  Private
export const shareReferralLink = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    // Award points for sharing
    user.sawabPoints += 2;
    await user.save();
    
    res.status(200).json({
      message: 'Points awarded for sharing',
      sawabPoints: user.sawabPoints
    });
  } catch (error) {
    console.error('Error awarding points for sharing:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get user's sawab points
// @route   GET /api/referral/points
// @access  Private
export const getSawabPoints = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    res.status(200).json({
      sawabPoints: user.sawabPoints
    });
  } catch (error) {
    console.error('Error getting sawab points:', error);
    res.status(500).json({ message: 'Server error' });
  }
}; 