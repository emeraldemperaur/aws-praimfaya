import React, { useState, useEffect } from 'react';
import '../styles/datatable.scss';

export interface ColumnDef<T> {
  header: string;
  accessor: keyof T | string; 
  render?: (row: T) => React.ReactNode; 
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  darkMode?: boolean;
  selectable?: boolean;
  onSelectionChange?: (selectedRows: T[]) => void;
}

function DataTable<T>({ 
  columns, 
  data, 
  darkMode = false,
  selectable = false,
  onSelectionChange
}: DataTableProps<T>) {
  
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (onSelectionChange) {
      const selectedData = data.filter((_, index) => selectedIndices.has(index));
      onSelectionChange(selectedData);
    }
  }, [selectedIndices, data, onSelectionChange]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIndices(new Set(data.map((_, index) => index)));
    } else {
      setSelectedIndices(new Set());
    }
  };

  const handleRowSelect = (index: number, checked: boolean) => {
    const newSelection = new Set(selectedIndices);
    if (checked) {
      newSelection.add(index);
    } else {
      newSelection.delete(index);
    }
    setSelectedIndices(newSelection);
  };

  const isAllSelected = data.length > 0 && selectedIndices.size === data.length;
  const isSomeSelected = selectedIndices.size > 0 && selectedIndices.size < data.length;

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
                  checked={isAllSelected}
                  ref={input => {
                    if (input) input.indeterminate = isSomeSelected;
                  }}
                  onChange={handleSelectAll}
                  aria-label="Select all rows"
                />
              </th>
            )}

            {columns.map((col, index) => (
              <th key={index} scope="col">{col.header}</th>
            ))}
          </tr>
        </thead>

        <tbody className="table-body">
          {data.map((row, rowIndex) => {
            const isSelected = selectedIndices.has(rowIndex);
            
            return (
              <tr key={rowIndex} className={isSelected ? 'selected-row' : ''}>
                
                {selectable && (
                  <td className="checkbox-cell">
                    <input 
                      type="checkbox" 
                      className="tbl-checkbox"
                      checked={isSelected}
                      onChange={(e) => handleRowSelect(rowIndex, e.target.checked)}
                      aria-label={`Select row ${rowIndex + 1}`}
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
          })}
          
          {data.length === 0 && (
            <tr>
              <td colSpan={selectable ? columns.length + 1 : columns.length} className="empty-state">
                No data available.
              </td>
            </tr>
          )}
        </tbody>

      </table>
    </div>
  );
}

export default DataTable;