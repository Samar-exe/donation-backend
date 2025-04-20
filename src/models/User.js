import mongoose from 'mongoose';

const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: function() {
        // Password is not required if googleId is present
        return !this.googleId;
      }
    },
    profilePicture: {
      type: String,
      default: '',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    googleId: {
      type: String,
      sparse: true, // Allows multiple null values but unique non-null values
    },
    sawabPoints: {
      type: Number,
      default: 0,
    },
    referralCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      sparse: true,
    },
    referralCount: {
      type: Number,
      default: 0,
    },
    verificationToken: String,
    verificationTokenExpiry: Date,
    resetPasswordToken: String,
    resetPasswordExpiry: Date,
    loginAttempts: {
      type: Number,
      default: 0,
    },
    accountLocked: {
      type: Boolean,
      default: false,
    },
    lastLogin: Date,
  },
  {
    timestamps: true,
  }
);

// Pre-save middleware to validate that either password or OAuth ID exists
userSchema.pre('save', function(next) {
  // If this is a new user being created (not an update)
  if (this.isNew) {
    // User must have either a password or a social login ID
    if (!this.password && !this.googleId) {
      return next(new Error('User must have either a password or a social login method'));
    }
  }
  next();
});

// Don't return password in queries by default
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.verificationToken;
  delete user.verificationTokenExpiry;
  delete user.resetPasswordToken;
  delete user.resetPasswordExpiry;
  delete user.loginAttempts;
  return user;
};

const User = mongoose.model('User', userSchema);

export default User; 