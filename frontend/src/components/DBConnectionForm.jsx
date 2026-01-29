/**
 * Database Connection Form Component
 * 
 * Dynamic form that shows appropriate fields based on database type.
 */

import React, { useState } from 'react';
import { FiArrowLeft, FiUpload, FiDatabase, FiLink } from 'react-icons/fi';

function DBConnectionForm({ dbType, onConnect, onCancel, loading }) {
  const [formData, setFormData] = useState({
    host: 'localhost',
    port: getDefaultPort(dbType.id),
    database: '',
    username: '',
    password: '',
    connectionString: '',
    sheetName: '',
  });
  const [file, setFile] = useState(null);
  const [useConnectionString, setUseConnectionString] = useState(false);
  const [useSSL, setUseSSL] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      // Set database name from filename
      const fileName = selectedFile.name.replace(/\.[^/.]+$/, '');
      setFormData(prev => ({ ...prev, database: fileName }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    let config = {};

    if (dbType.category === 'file') {
      config = {
        filePath: file?.name,
        sheetName: formData.sheetName || undefined,
      };
      onConnect(config, file);
    } else if (dbType.id === 'mongodb' && useConnectionString) {
      config = {
        connectionString: formData.connectionString,
        database: formData.database,
      };
      onConnect(config);
    } else if (dbType.id === 'sqlite') {
      config = {
        database: formData.database,
      };
      onConnect(config);
    } else {
      config = {
        host: formData.host,
        port: parseInt(formData.port, 10),
        database: formData.database,
        username: formData.username,
        password: formData.password,
        useSSL: useSSL, // Add SSL flag for cloud databases
      };
      if (dbType.id === 'mongodb') {
        config.connectionString = undefined;
      }
      onConnect(config);
    }
  };

  // Render different form fields based on database type
  const renderFormFields = () => {
    // File-based (Excel/CSV)
    if (dbType.category === 'file') {
      return (
        <>
          <div className="form-group">
            <label htmlFor="file">
              <FiUpload /> Upload File
            </label>
            <div className="file-upload">
              <input
                type="file"
                id="file"
                accept={dbType.id === 'excel' ? '.xlsx,.xls' : '.csv'}
                onChange={handleFileChange}
                required
              />
              <div className="file-upload-label">
                {file ? (
                  <span className="file-name">{file.name}</span>
                ) : (
                  <span>Choose a {dbType.id.toUpperCase()} file</span>
                )}
              </div>
            </div>
          </div>

          {dbType.id === 'excel' && (
            <div className="form-group">
              <label htmlFor="sheetName">Sheet Name (optional)</label>
              <input
                type="text"
                id="sheetName"
                name="sheetName"
                value={formData.sheetName}
                onChange={handleChange}
                placeholder="Leave empty for first sheet"
              />
            </div>
          )}
        </>
      );
    }

    // SQLite
    if (dbType.id === 'sqlite') {
      return (
        <div className="form-group">
          <label htmlFor="database">
            <FiDatabase /> Database File Path
          </label>
          <input
            type="text"
            id="database"
            name="database"
            value={formData.database}
            onChange={handleChange}
            placeholder="/path/to/database.db"
            required
          />
        </div>
      );
    }

    // MongoDB
    if (dbType.id === 'mongodb') {
      return (
        <>
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={useConnectionString}
                onChange={(e) => setUseConnectionString(e.target.checked)}
              />
              Use connection string
            </label>
          </div>

          {useConnectionString ? (
            <div className="form-group">
              <label htmlFor="connectionString">
                <FiLink /> Connection String
              </label>
              <input
                type="text"
                id="connectionString"
                name="connectionString"
                value={formData.connectionString}
                onChange={handleChange}
                placeholder="mongodb://username:password@host:port"
                required
              />
            </div>
          ) : (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="host">Host</label>
                  <input
                    type="text"
                    id="host"
                    name="host"
                    value={formData.host}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="port">Port</label>
                  <input
                    type="number"
                    id="port"
                    name="port"
                    value={formData.port}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="username">Username</label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    placeholder="Optional"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Optional"
                  />
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <label htmlFor="database">
              <FiDatabase /> Database Name
            </label>
            <input
              type="text"
              id="database"
              name="database"
              value={formData.database}
              onChange={handleChange}
              placeholder="Enter database name"
              required
            />
          </div>
        </>
      );
    }

    // MySQL / PostgreSQL
    return (
      <>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="host">Host</label>
            <input
              type="text"
              id="host"
              name="host"
              value={formData.host}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="port">Port</label>
            <input
              type="number"
              id="port"
              name="port"
              value={formData.port}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="database">
            <FiDatabase /> Database Name
          </label>
          <input
            type="text"
            id="database"
            name="database"
            value={formData.database}
            onChange={handleChange}
            placeholder="Enter database name"
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter password"
            />
          </div>
        </div>

        {/* SSL Toggle for cloud databases */}
        <div className="form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={useSSL}
              onChange={(e) => setUseSSL(e.target.checked)}
            />
            Use SSL connection (required for most cloud databases)
          </label>
        </div>
      </>
    );
  };

  return (
    <div className="db-connection-form">
      <button className="btn btn-ghost back-btn" onClick={onCancel}>
        <FiArrowLeft /> Back
      </button>

      <div className="form-header">
        <dbType.icon className="form-icon" style={{ color: dbType.color }} />
        <h2>Connect to {dbType.name}</h2>
        <p>{dbType.description}</p>
      </div>

      <form onSubmit={handleSubmit}>
        {renderFormFields()}

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-small"></span>
                Connecting...
              </>
            ) : (
              'Connect'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// Helper function to get default port for database type
function getDefaultPort(dbType) {
  switch (dbType) {
    case 'mysql': return 3306;
    case 'postgresql': return 5432;
    case 'mongodb': return 27017;
    default: return '';
  }
}

export default DBConnectionForm;
