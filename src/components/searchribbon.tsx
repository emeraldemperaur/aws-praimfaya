import React from 'react';

export interface FilterOption {
  label: string;
  value: string;
}

interface SearchRibbonProps {
  darkMode: boolean;
  recordCount: number;
  recordLabel?: string; 
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedFilter: string;
  onFilterChange: (value: string) => void;
  filterOptions: FilterOption[];
}

const SearchRibbon: React.FC<SearchRibbonProps> = ({
  darkMode,
  recordCount,
  recordLabel = 'Records',
  searchTerm,
  onSearchChange,
  selectedFilter,
  onFilterChange,
  filterOptions,
}) => {
  const bgColor = darkMode ? '#1b1c1d' : '#ffffff';
  const borderColor = darkMode ? '#333333' : '#e0e0e0';
  const textColor = darkMode ? '#ffffff' : '#0B0B45';
  const mutedText = darkMode ? '#a9a9a9' : '#666666';
  const focusBorder = darkMode ? '#5a5a5a' : '#0B0B45';

  return (
    <>
      <style>
        {`
          .search-ribbon-container {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1rem 3rem;
            background-color: ${bgColor};
            border-bottom: 1px solid ${borderColor};
            color: ${textColor};
            transition: background-color 0.3s ease, border-color 0.3s ease;
            flex-wrap: wrap;
            gap: 1rem;
          }

          .search-filter-group {
            display: flex;
            align-items: center;
            border: 1px solid ${borderColor};
            border-radius: 6px;
            background-color: ${darkMode ? '#242526' : '#f9f9f9'};
            overflow: hidden;
            transition: border-color 0.2s ease;
          }

          .search-filter-group:focus-within {
            border-color: ${focusBorder};
          }

          .search-input-wrapper {
            display: flex;
            align-items: center;
            padding-left: 12px;
          }

          .search-icon {
            width: 18px;
            height: 18px;
            fill: ${mutedText};
            margin-right: 8px;
          }

          .ribbon-search-input {
            border: none;
            background: transparent;
            color: ${textColor};
            padding: 10px 8px 10px 0;
            font-size: 0.95rem;
            outline: none;
            width: 250px;
            font-family: 'Bodoni Moda Variable';
          }

          .ribbon-search-input::placeholder {
            color: ${mutedText};
          }

          .filter-divider {
            width: 1px;
            height: 24px;
            background-color: ${borderColor};
          }

          .ribbon-dropdown {
            border: none;
            background: transparent;
            color: ${textColor};
            padding: 10px 16px;
            font-size: 0.95rem;
            outline: none;
            cursor: pointer;
            appearance: none;
            /* Custom Material Arrow */
            background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22${darkMode ? '%23a9a9a9' : '%23666666'}%22%3E%3Cpath%20d%3D%22M7%2010l5%205%205-5z%22%2F%3E%3C%2Fsvg%3E");
            background-repeat: no-repeat;
            background-position: right 8px center;
            padding-right: 32px;
            font-family: "Bodoni Moda Variable", serif;
          }

          .ribbon-dropdown option {
            background-color: ${bgColor};
            color: ${textColor};
          }

          .record-count {
            font-size: 1.2rem;
            font-weight: 500;
            color: ${mutedText};
            font-family: "Bodoni Moda Variable", serif;
          }

          /* Mobile responsiveness */
          @media (max-width: 600px) {
            .search-ribbon-container {
              padding: 1rem 1.2rem;
              flex-direction: column;
              align-items: flex-start;
            }
            .search-filter-group {
              width: 100%;
            }
            .ribbon-search-input {
              width: 100%;
              flex: 1;
            }
          }
        `}
      </style>

      <div className="search-ribbon-container">
        <div className="search-filter-group">
          <div className="search-input-wrapper">
            <svg
              className="search-icon"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
            >
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </svg>
            <input
              type="text"
              className="ribbon-search-input"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Search records"
            />
          </div>

          <div className="filter-divider" />

          <select
            className="ribbon-dropdown"
            value={selectedFilter}
            onChange={(e) => onFilterChange(e.target.value)}
            aria-label="Search filter category"
          >
            {filterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="record-count">
          <a style={{fontSize: '33px'}}>{recordCount} </a> <a>{recordCount === 1 ? recordLabel.replace(/s$/, '') : recordLabel} Found</a>
        </div>
      </div>
    </>
  );
};

export default SearchRibbon;