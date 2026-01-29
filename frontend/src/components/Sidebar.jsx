/**
 * Sidebar Component
 * 
 * Shows connected database info and schema explorer.
 */

import React, { useState } from 'react';
import { 
  FiDatabase, FiTable, FiColumns, FiChevronDown, 
  FiChevronRight, FiHash, FiType, FiCalendar, FiToggleLeft
} from 'react-icons/fi';

function Sidebar({ isOpen, onClose, schema, dbType }) {
  const [expandedTables, setExpandedTables] = useState(new Set());

  const toggleTable = (tableName) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName);
    } else {
      newExpanded.add(tableName);
    }
    setExpandedTables(newExpanded);
  };

  const expandAll = () => {
    const allTables = schema?.tables?.map(t => t.name) || 
                      schema?.collections?.map(c => c.name) || [];
    setExpandedTables(new Set(allTables));
  };

  const collapseAll = () => {
    setExpandedTables(new Set());
  };

  // Get icon for column type
  const getTypeIcon = (type) => {
    const typeLower = (type || '').toLowerCase();
    if (typeLower.includes('int') || typeLower.includes('number') || typeLower.includes('decimal')) {
      return <FiHash className="type-icon number" />;
    }
    if (typeLower.includes('date') || typeLower.includes('time')) {
      return <FiCalendar className="type-icon date" />;
    }
    if (typeLower.includes('bool')) {
      return <FiToggleLeft className="type-icon boolean" />;
    }
    return <FiType className="type-icon string" />;
  };

  // Get tables/collections from schema
  const getTablesOrCollections = () => {
    if (!schema) return [];
    return schema.tables || schema.collections || [];
  };

  const tables = getTablesOrCollections();

  return (
    <aside className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-content">
        {/* Database Info */}
        <div className="sidebar-section">
          <h3 className="sidebar-title">
            <FiDatabase /> Connected Database
          </h3>
          <div className="db-info">
            <div className="db-info-row">
              <span className="label">Type:</span>
              <span className="value">{dbType?.toUpperCase()}</span>
            </div>
            <div className="db-info-row">
              <span className="label">Name:</span>
              <span className="value">{schema?.database || schema?.fileName || 'Unknown'}</span>
            </div>
            <div className="db-info-row">
              <span className="label">Tables:</span>
              <span className="value">{tables.length}</span>
            </div>
          </div>
        </div>

        {/* Schema Explorer */}
        <div className="sidebar-section schema-section">
          <div className="schema-header">
            <h3 className="sidebar-title">
              <FiTable /> Schema Explorer
            </h3>
            <div className="schema-actions">
              <button 
                className="btn-mini" 
                onClick={expandAll}
                title="Expand all"
              >
                Expand
              </button>
              <button 
                className="btn-mini" 
                onClick={collapseAll}
                title="Collapse all"
              >
                Collapse
              </button>
            </div>
          </div>

          <div className="schema-tree">
            {tables.length === 0 ? (
              <p className="no-tables">No tables found</p>
            ) : (
              tables.map((table) => (
                <div key={table.name} className="schema-table">
                  <button 
                    className="table-header"
                    onClick={() => toggleTable(table.name)}
                  >
                    {expandedTables.has(table.name) ? (
                      <FiChevronDown className="chevron" />
                    ) : (
                      <FiChevronRight className="chevron" />
                    )}
                    <FiTable className="table-icon" />
                    <span className="table-name">{table.name}</span>
                    <span className="column-count">
                      {(table.columns || table.fields || []).length}
                    </span>
                  </button>
                  
                  {expandedTables.has(table.name) && (
                    <div className="table-columns">
                      {(table.columns || table.fields || []).map((column, idx) => (
                        <div key={idx} className="column-item">
                          {getTypeIcon(column.type || column.types?.join(' | '))}
                          <span className="column-name">
                            {column.name}
                          </span>
                          <span className="column-type">
                            {column.type || column.types?.join(' | ') || 'unknown'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Tips */}
        <div className="sidebar-section tips-section">
          <h3 className="sidebar-title">💡 Tips</h3>
          <ul className="tips-list">
            <li>Ask questions in plain English</li>
            <li>Reference table and column names</li>
            <li>Use follow-up questions for refinement</li>
            <li>Export results with the download button</li>
          </ul>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
