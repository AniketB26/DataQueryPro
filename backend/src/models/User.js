/**
 * User Model
 * 
 * MongoDB schema for user accounts with authentication
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        },
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            minlength: 3,
            maxlength: 30
        },
        password: {
            type: String,
            // Password required only for local auth (not OAuth users)
            required: function () {
                return this.authProvider === 'local';
            },
            minlength: 6,
            select: false // Don't return password by default
        },
        fullName: {
            type: String,
            trim: true
        },
        // Google OAuth fields
        googleId: {
            type: String,
            unique: true,
            sparse: true // Allows null values while maintaining uniqueness
        },
        authProvider: {
            type: String,
            enum: ['local', 'google'],
            default: 'local'
        },
        isActive: {
            type: Boolean,
            default: true
        },
        lastLogin: {
            type: Date
        },
        profilePicture: {
            type: String // URL to profile picture
        }
    },
    {
        timestamps: true // Creates createdAt and updatedAt fields
    }
);

// Hash password before saving
userSchema.pre('save', async function () {
    // Only hash if password is modified or new AND user has a password
    if (!this.isModified('password') || !this.password) return;

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare passwords
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Method to get public user data (without sensitive info)
userSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
