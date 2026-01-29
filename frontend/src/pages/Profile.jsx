/**
 * Profile Page Component
 * 
 * User profile with activity history and settings.
 * Allows users to update their name and change password.
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import {
  FiUser, FiMail, FiCalendar, FiClock, FiDatabase,
  FiLogOut, FiActivity, FiSettings, FiChevronRight,
  FiHome, FiBook, FiBriefcase, FiEdit2, FiShield,
  FiX, FiCheck, FiLock, FiEye, FiEyeOff
} from 'react-icons/fi';
import toast from 'react-hot-toast';

function Profile() {
  const { user, logout } = useAuth();
  const { showError } = useNotification();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  // Modal states
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  // Edit name form state
  const [newFullName, setNewFullName] = useState(user?.fullName || '');
  const [nameLoading, setNameLoading] = useState(false);

  // Change password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Update newFullName when user changes
  useEffect(() => {
    if (user?.fullName) {
      setNewFullName(user.fullName);
    }
  }, [user]);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Handle name update
  const handleUpdateName = async (e) => {
    e.preventDefault();

    if (!newFullName.trim()) {
      showError('Please enter a valid name');
      return;
    }

    setNameLoading(true);
    try {
      const response = await authAPI.updateProfile({ fullName: newFullName.trim() });

      // Update local storage and reload user data
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const updatedUser = { ...currentUser, fullName: response.data.user.fullName };
      localStorage.setItem('user', JSON.stringify(updatedUser));

      toast.success('Name updated successfully!');
      setShowEditNameModal(false);

      // Refresh the page to get updated user data
      window.location.reload();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to update name');
    } finally {
      setNameLoading(false);
    }
  };

  // Handle password change
  const handleChangePassword = async (e) => {
    e.preventDefault();

    // Validate passwords
    if (!currentPassword) {
      showError('Please enter your current password');
      return;
    }

    if (newPassword.length < 6) {
      showError('New password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      showError('New passwords do not match');
      return;
    }

    setPasswordLoading(true);
    try {
      await authAPI.changePassword({ currentPassword, newPassword });

      toast.success('Password changed successfully!');
      setShowChangePasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Check if user is Google OAuth user
  const isGoogleUser = user?.authProvider === 'google';

  const stats = [
    { label: 'Queries Made', value: '0', icon: FiDatabase },
    { label: 'Connections', value: '0', icon: FiActivity },
    { label: 'Sessions', value: '1', icon: FiClock },
  ];

  return (
    <div className="profile-page">
      {/* Navigation */}
      <nav className="app-nav">
        <div className="nav-container">
          <Link to="/" className="nav-logo">
            <FiDatabase className="logo-icon" />
            <span>DataQuery Pro</span>
          </Link>
          <div className="nav-links">
            <Link to="/" className="nav-link">
              <FiHome /> Home
            </Link>
            <Link to="/work" className="nav-link">
              <FiBriefcase /> Work
            </Link>
            <Link to="/tutorial" className="nav-link">
              <FiBook /> Tutorial
            </Link>
            <Link to="/profile" className="nav-link active">
              <FiUser /> Profile
            </Link>
          </div>
        </div>
      </nav>

      <div className="profile-container">
        {/* Profile Header */}
        <div className="profile-header">
          <div className="profile-avatar">
            {user?.profilePicture ? (
              <img src={user.profilePicture} alt={user.fullName} />
            ) : (
              <FiUser />
            )}
          </div>
          <div className="profile-info">
            <h1>{user?.fullName || user?.username || 'User'}</h1>
            <p className="profile-email">{user?.email}</p>
            <p className="profile-username">@{user?.username}</p>
          </div>
          <button className="btn btn-danger" onClick={handleLogout}>
            <FiLogOut /> Logout
          </button>
        </div>

        {/* Profile Tabs */}
        <div className="profile-tabs">
          <button
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <FiUser /> Overview
          </button>
          <button
            className={`tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
            onClick={() => setActiveTab('activity')}
          >
            <FiActivity /> Activity
          </button>
          <button
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <FiSettings /> Settings
          </button>
        </div>

        {/* Tab Content */}
        <div className="profile-content">
          {activeTab === 'overview' && (
            <div className="overview-tab">
              {/* Stats Cards */}
              <div className="stats-grid">
                {stats.map((stat, index) => (
                  <div key={index} className="stat-card">
                    <stat.icon className="stat-icon" />
                    <div className="stat-info">
                      <span className="stat-value">{stat.value}</span>
                      <span className="stat-label">{stat.label}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Account Details */}
              <div className="details-card">
                <h3>Account Details</h3>
                <div className="details-grid">
                  <div className="detail-item">
                    <FiUser className="detail-icon" />
                    <div>
                      <span className="detail-label">Full Name</span>
                      <span className="detail-value">{user?.fullName || 'Not set'}</span>
                    </div>
                  </div>
                  <div className="detail-item">
                    <FiMail className="detail-icon" />
                    <div>
                      <span className="detail-label">Email</span>
                      <span className="detail-value">{user?.email}</span>
                    </div>
                  </div>
                  <div className="detail-item">
                    <FiCalendar className="detail-icon" />
                    <div>
                      <span className="detail-label">Member Since</span>
                      <span className="detail-value">{formatDate(user?.createdAt)}</span>
                    </div>
                  </div>
                  <div className="detail-item">
                    <FiClock className="detail-icon" />
                    <div>
                      <span className="detail-label">Last Login</span>
                      <span className="detail-value">{formatDate(user?.lastLogin)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="quick-actions">
                <h3>Quick Actions</h3>
                <div className="actions-grid">
                  <Link to="/work" className="action-card">
                    <FiBriefcase />
                    <span>Start Working</span>
                    <FiChevronRight />
                  </Link>
                  <Link to="/tutorial" className="action-card">
                    <FiBook />
                    <span>View Tutorials</span>
                    <FiChevronRight />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="activity-tab">
              <div className="activity-card">
                <h3>Recent Activity</h3>
                <div className="activity-list">
                  <div className="activity-item">
                    <div className="activity-icon login">
                      <FiShield />
                    </div>
                    <div className="activity-details">
                      <span className="activity-title">Logged in</span>
                      <span className="activity-time">{formatDate(user?.lastLogin)}</span>
                    </div>
                  </div>
                  <div className="activity-item">
                    <div className="activity-icon signup">
                      <FiUser />
                    </div>
                    <div className="activity-details">
                      <span className="activity-title">Account created</span>
                      <span className="activity-time">{formatDate(user?.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <p className="activity-note">
                  More detailed activity tracking coming soon!
                </p>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="settings-tab">
              <div className="settings-card">
                <h3>Account Settings</h3>
                <div className="settings-list">
                  {/* Edit Profile */}
                  <div className="settings-item">
                    <div className="settings-info">
                      <FiEdit2 />
                      <div>
                        <span className="settings-title">Edit Profile</span>
                        <span className="settings-desc">Update your name and details</span>
                      </div>
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => setShowEditNameModal(true)}
                    >
                      Edit
                    </button>
                  </div>

                  {/* Change Password */}
                  <div className="settings-item">
                    <div className="settings-info">
                      <FiShield />
                      <div>
                        <span className="settings-title">Change Password</span>
                        <span className="settings-desc">
                          {isGoogleUser
                            ? 'Not available for Google accounts'
                            : 'Update your password'}
                        </span>
                      </div>
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => setShowChangePasswordModal(true)}
                      disabled={isGoogleUser}
                    >
                      {isGoogleUser ? 'N/A' : 'Change'}
                    </button>
                  </div>

                  {/* Logout */}
                  <div className="settings-item danger">
                    <div className="settings-info">
                      <FiLogOut />
                      <div>
                        <span className="settings-title">Logout</span>
                        <span className="settings-desc">Sign out of your account</span>
                      </div>
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={handleLogout}>Logout</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Name Modal */}
      {showEditNameModal && (
        <div className="modal-overlay" onClick={() => setShowEditNameModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Profile</h3>
              <button
                className="modal-close"
                onClick={() => setShowEditNameModal(false)}
                aria-label="Close modal"
              >
                <FiX />
              </button>
            </div>
            <form onSubmit={handleUpdateName}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="fullName">
                    <FiUser /> Full Name
                  </label>
                  <input
                    type="text"
                    id="fullName"
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    placeholder="Enter your full name"
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowEditNameModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={nameLoading}
                >
                  {nameLoading ? (
                    <span className="spinner-small"></span>
                  ) : (
                    <>
                      <FiCheck /> Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <div className="modal-overlay" onClick={() => setShowChangePasswordModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Change Password</h3>
              <button
                className="modal-close"
                onClick={() => setShowChangePasswordModal(false)}
                aria-label="Close modal"
              >
                <FiX />
              </button>
            </div>
            <form onSubmit={handleChangePassword}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="currentPassword">
                    <FiLock /> Current Password
                  </label>
                  <div className="password-input-wrapper">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      id="currentPassword"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      autoFocus
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="newPassword">
                    <FiLock /> New Password
                  </label>
                  <div className="password-input-wrapper">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      id="newPassword"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password (min 6 characters)"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="confirmNewPassword">
                    <FiLock /> Confirm New Password
                  </label>
                  <input
                    type="password"
                    id="confirmNewPassword"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowChangePasswordModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={passwordLoading}
                >
                  {passwordLoading ? (
                    <span className="spinner-small"></span>
                  ) : (
                    <>
                      <FiCheck /> Change Password
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;
