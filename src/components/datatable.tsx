import React, { useState, useEffect, useMemo } from 'react';
import '../styles/datatable.scss';

export interface ColumnDef<T> {
  header: string;
  accessor: keyof T | string; 
  render?: (row: T) => React.ReactNode; 
  sortable?: boolean; 
}

type SortDirection = 'asc' | 'desc';
export interface SortConfig<T> {
  key: keyof T | string;
  direction: SortDirection;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  darkMode?: boolean;
  selectable?: boolean;
  isLoading?: boolean;
  onSelectionChange?: (selectedRows: T[]) => void;
  initialSort?: SortConfig<T> | null;
  // --- NEW PAGINATION PROPS ---
  pagination?: boolean;
  defaultPageSize?: number;
  pageSizeOptions?: number[];
}

function DataTable<T>({ 
  columns, 
  data, 
  darkMode = false,
  selectable = false,
  isLoading = false,
  onSelectionChange,
  initialSort = null,
  pagination = false,
  defaultPageSize = 10,
  pageSizeOptions = [5, 10, 25, 50]
}: DataTableProps<T>) {
  
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [sortConfig, setSortConfig] = useState<SortConfig<T> | null>(initialSort);
  
  // --- PAGINATION STATE ---
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const sortedData = useMemo(() => {
    let sortableItems = [...data];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof T];
        const bValue = b[sortConfig.key as keyof T];

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'asc' 
            ? aValue.localeCompare(bValue) 
            : bValue.localeCompare(aValue);
        }
        
        if (aValue < bValue) { return sortConfig.direction === 'asc' ? -1 : 1; }
        if (aValue > bValue) { return sortConfig.direction === 'asc' ? 1 : -1; }
        return 0;
      });
    }
    return sortableItems;
  }, [data, sortConfig]);

  // --- PAGINATION LOGIC ---
  const totalRecords = sortedData.length;
  const totalPages = Math.ceil(totalRecords / pageSize);
  
  // Reset to page 1 if data shrinks significantly (prevents viewing empty out-of-bounds pages)
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalRecords, totalPages, currentPage]);

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalRecords);
  
  // Only slice the data if pagination is enabled
  const displayData = pagination ? sortedData.slice(startIndex, endIndex) : sortedData;

  const requestSort = (key: keyof T | string) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  useEffect(() => {
    if (onSelectionChange) {
      const selectedRecords = sortedData.filter((_, index) => selectedIndices.has(index));
      onSelectionChange(selectedRecords);
    }
  }, [selectedIndices, sortedData, onSelectionChange]);

  // --- UPDATED SELECTION LOGIC (Scoping selection to currently visible page) ---
  const visibleIndices = displayData.map((_, i) => pagination ? startIndex + i : i);
  const isAllVisibleSelected = visibleIndices.length > 0 && visibleIndices.every(i => selectedIndices.has(i));
  const isSomeVisibleSelected = visibleIndices.some(i => selectedIndices.has(i)) && !isAllVisibleSelected;

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSelection = new Set(selectedIndices);
    if (e.target.checked) {
      visibleIndices.forEach(i => newSelection.add(i));
    } else {
      visibleIndices.forEach(i => newSelection.delete(i));
    }
    setSelectedIndices(newSelection);
  };

  const handleRowSelect = (actualIndex: number, checked: boolean) => {
    const newSelection = new Set(selectedIndices);
    if (checked) {
      newSelection.add(actualIndex);
    } else {
      newSelection.delete(actualIndex);
    }
    setSelectedIndices(newSelection);
  };
  
  const colSpanCount = selectable ? columns.length + 1 : columns.length;

  return (
    <div className={`table-responsive-wrapper ${darkMode ? 'dark-mode' : ''}`}>
      <table className="custom-data-table">
        
        <thead className="table-header">
          <tr>
            {selectable && (
              <th scope="col" className="checkbox-cell">
                <input 
                  type="checkbox" 
                  className="tbl-checkbox"
                  checked={isAllVisibleSelected}
                  ref={input => {
                    if (input) input.indeterminate = isSomeVisibleSelected;
                  }}
                  onChange={handleSelectAll}
                  aria-label="Select all rows"
                  disabled={isLoading || data.length === 0}
                />
              </th>
            )}

            {columns.map((col, index) => (
              <th 
                key={index} 
                scope="col"
                onClick={() => col.sortable ? requestSort(col.accessor) : null}
                style={{ cursor: col.sortable ? 'pointer' : 'default', userSelect: 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {col.header}
                  {col.sortable && sortConfig?.key === col.accessor && (
                    <i className={`fa-solid fa-sort-${sortConfig.direction === 'asc' ? 'up' : 'down'}`} style={{ opacity: 0.7, fontSize: '0.75rem' }}></i>
                  )}
                  {col.sortable && sortConfig?.key !== col.accessor && (
                    <i className="fa-solid fa-sort" style={{ opacity: 0.2, fontSize: '0.75rem' }}></i>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="table-body">
          {isLoading ? (
            <tr>
              <td colSpan={colSpanCount} className="empty-state">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
                  <i className="fa-solid fa-circle-notch fa-spin"></i>
                  Loading...
                </span>
              </td>
            </tr>
          ) : displayData.length === 0 ? (
            <tr>
              <td colSpan={colSpanCount} className="empty-state">
                No data available.
              </td>
            </tr>
          ) : (
            displayData.map((row, index) => {
              // Calculate the actual index in the master array to keep selections accurate
              const actualIndex = pagination ? startIndex + index : index;
              const isSelected = selectedIndices.has(actualIndex);
              
              return (
                <tr key={actualIndex} className={isSelected ? 'selected-row' : ''}>
                  
                  {selectable && (
                    <td className="checkbox-cell">
                      <input 
                        type="checkbox" 
                        className="tbl-checkbox"
                        checked={isSelected}
                        onChange={(e) => handleRowSelect(actualIndex, e.target.checked)}
                        aria-label={`Select row ${actualIndex + 1}`}
                      />
                    </td>
                  )}

                  {columns.map((col, colIndex) => (
                    <td key={colIndex}>
                      {col.render 
                        ? col.render(row) 
                        : (row[col.accessor as keyof T] as React.ReactNode)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>

      </table>

      {/* --- MATERIAL DESIGN PAGINATION FOOTER --- */}
      {pagination && !isLoading && totalRecords > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          padding: '0.75rem 1rem',
          borderTop: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
          backgroundColor: darkMode ? '#1f2937' : '#ffffff', // Match your table base
          color: darkMode ? '#9ca3af' : '#6b7280',
          fontSize: '0.875rem',
          gap: '2rem'
        }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'Bodoni Moda Variable, serif' }}>
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1); // Reset to page 1 on resize
              }}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: darkMode ? '#e5e7eb' : '#111827',
                cursor: 'pointer',
                outline: 'none',
                fontFamily: 'inherit',
                fontSize: '0.875rem'
              }}
            >
              {pageSizeOptions.map(size => (
                <option key={size} value={size} style={{ color: '#111827' }}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          <div style={{ fontFamily: 'Bodoni Moda Variable, serif' }}>
            {startIndex + 1}-{endIndex} of {totalRecords}
          </div>

          <div style={{ display: 'flex', gap: '1.25rem' }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: darkMode ? '#e5e7eb' : '#111827',
                cursor: currentPage === 1 ? 'default' : 'pointer',
                opacity: currentPage === 1 ? 0.3 : 1,
                display: 'flex',
                alignItems: 'center'
              }}
              title="Previous Page"
            >
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: darkMode ? '#e5e7eb' : '#111827',
                cursor: currentPage === totalPages ? 'default' : 'pointer',
                opacity: currentPage === totalPages ? 0.3 : 1,
                display: 'flex',
                alignItems: 'center'
              }}
              title="Next Page"
            >
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default DataTable;