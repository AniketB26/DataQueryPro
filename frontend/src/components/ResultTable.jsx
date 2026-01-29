/**
 * Result Table Component
 * 
 * Displays query results in a formatted table with SQL syntax highlighting
 * and export options.
 */

import React, { useState } from 'react';
import { FiDownload, FiMaximize2, FiMinimize2, FiCopy, FiHeart } from 'react-icons/fi';
import { Highlight, themes } from 'prism-react-renderer';
import toast from 'react-hot-toast';

function ResultTable({ data, columns, rowCount, generatedQuery, onSaveFavorite }) {
  const [expanded, setExpanded] = useState(false);
  const [showQuery, setShowQuery] = useState(false);

  // Early return if no data or columns
  if (!data || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  if (!columns || !Array.isArray(columns) || columns.length === 0) {
    return null;
  }

  const displayRows = expanded ? data : data.slice(0, 10);

  const copyQuery = () => {
    navigator.clipboard.writeText(generatedQuery);
    toast.success('Query copied to clipboard');
  };

  const exportCSV = () => {
    if (!data || data.length === 0) return;

    // Create CSV content
    const headers = columns.join(',');
    const rows = data.map(row =>
      columns.map(col => {
        const value = row[col];
        // Escape quotes and wrap in quotes if contains comma
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      }).join(',')
    );

    const csv = [headers, ...rows].join('\n');

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query-results-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('Results exported as CSV');
  };

  return (
    <div className={`result-table-container ${expanded ? 'expanded' : ''}`}>
      {generatedQuery && (
        <div className="query-display-section">
          <div className="query-header">
            <button
              className="btn btn-ghost-small"
              onClick={() => setShowQuery(!showQuery)}
            >
              {showQuery ? '▼ Hide' : '▶ Show'} Generated Query
            </button>
            <div className="query-actions">
              <button
                className="btn btn-icon"
                onClick={copyQuery}
                title="Copy query"
              >
                <FiCopy />
              </button>
              {onSaveFavorite && (
                <button
                  className="btn btn-icon"
                  onClick={() => onSaveFavorite()}
                  title="Save as favorite"
                >
                  <FiHeart />
                </button>
              )}
            </div>
          </div>

          {showQuery && (
            <Highlight theme={themes.nightOwl} code={generatedQuery} language="sql">
              {({ className, style, tokens, getLineProps, getTokenProps }) => (
                <pre className={`${className} sql-highlight`} style={style}>
                  {tokens.map((line, i) => (
                    <div key={i} {...getLineProps({ line, key: i })}>
                      {line.map((token, key) => (
                        <span key={key} {...getTokenProps({ token, key })} />
                      ))}
                    </div>
                  ))}
                </pre>
              )}
            </Highlight>
          )}
        </div>
      )}

      <div className="result-table-header">
        <span className="result-count">
          Showing {displayRows.length} of {rowCount} rows
        </span>
        <div className="result-actions">
          {data.length > 10 && (
            <button
              className="btn btn-mini"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <FiMinimize2 /> : <FiMaximize2 />}
              {expanded ? 'Show less' : 'Show all'}
            </button>
          )}
          <button
            className="btn btn-mini"
            onClick={exportCSV}
            title="Export as CSV"
          >
            <FiDownload /> Export CSV
          </button>
        </div>
      </div>

      <div className="result-table-wrapper">
        <table className="result-table">
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th key={idx}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {columns.map((col, colIdx) => (
                  <td key={colIdx}>
                    {formatCellValue(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!expanded && data.length > 10 && (
        <div className="result-table-footer">
          <button
            className="btn btn-ghost"
            onClick={() => setExpanded(true)}
          >
            Show {data.length - 10} more rows
          </button>
        </div>
      )}
    </div>
  );
}

// Format cell values for display
function formatCellValue(value) {
  if (value === null || value === undefined) {
    return <span className="null-value">NULL</span>;
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  // Truncate long strings
  const strValue = String(value);
  if (strValue.length > 100) {
    return strValue.substring(0, 100) + '...';
  }

  return strValue;
}

export default ResultTable;
