/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/ui/DataTable/DataTable.tsx
"use client";

import React, { useState, useMemo, ReactNode, ChangeEvent, useEffect } from 'react';
import styles from './DataTable.module.css';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import SkeletonLoader from '../SkeletonLoader/SkeletonLoader';
import { ChevronUp, ChevronDown, Search, X } from 'lucide-react'; // Lucide icons

export interface ColumnDefinition<T> {
  key: Extract<keyof T, string> | (string & {}); // Allow string keys for custom accessors
  header: ReactNode;
  render?: (item: T, rowIndex: number) => ReactNode;
  className?: string;
  headerClassName?: string;
  width?: string;
  sortable?: boolean; // Is this column sortable?
  accessor?: (item: T) => any; // For sorting/filtering non-primitive or custom values
  filterable?: boolean; // Can this column be filtered via global search?
  filterKey?: Extract<keyof T, string> | ((item: T) => string); // Specific key or function for filtering
}

interface DataTableProps<T> {
  columns: ColumnDefinition<T>[];
  data: T[];
  isLoading?: boolean;
  error?: string | null;
  emptyStateMessage?: string;
  className?: string;
  onRowClick?: (item: T, rowIndex: number) => void;
  rowKey: (item: T, rowIndex: number) => string | number; // Now mandatory for stable keys
  skeletonRowCount?: number;
  // Pagination
  pagination?: boolean;
  itemsPerPage?: number;
  // Filtering
  showGlobalFilter?: boolean;
  globalFilterPlaceholder?: string;
  // Sorting
  initialSortKey?: Extract<keyof T, string> | (string & {});
  initialSortDirection?: 'asc' | 'desc';
  onSortChange?: (sortKey: Extract<keyof T, string> | (string & {}), sortDirection: 'asc' | 'desc' | null) => void; // For server-side sorting
  isServerSide?: boolean; // If true, sorting/filtering/pagination are handled by parent
}

const DEFAULT_ITEMS_PER_PAGE = 10;

function DataTable<T extends object>({
  columns,
  data,
  isLoading = false,
  error = null,
  emptyStateMessage = "No data available.",
  className = '',
  onRowClick,
  rowKey,
  skeletonRowCount = 5,
  pagination = false,
  itemsPerPage = DEFAULT_ITEMS_PER_PAGE,
  showGlobalFilter = false,
  globalFilterPlaceholder = "Search...",
  initialSortKey,
  initialSortDirection,
  onSortChange, // If provided, sorting is server-side
  isServerSide = false,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [globalFilter, setGlobalFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{
    key: ColumnDefinition<T>['key'] | null;
    direction: 'asc' | 'desc' | null;
  }>({ key: initialSortKey || null, direction: initialSortDirection || null });

  // Effect to reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [globalFilter]);

  // Memoized and processed data (sorting, filtering, pagination for client-side)
  const processedData = useMemo(() => {
    if (isServerSide) return data; // Server handles processing

    let sortableItems = [...data];

    // Client-side Filtering
    if (globalFilter) {
      const filterTextLower = globalFilter.toLowerCase();
      sortableItems = sortableItems.filter(item => {
        return columns.some(column => {
          if (!column.filterable) return false;
          
          let valueToFilter: any;
          if (column.filterKey) {
            if (typeof column.filterKey === 'function') {
              valueToFilter = column.filterKey(item);
            } else {
              valueToFilter = item[column.filterKey as keyof T];
            }
          } else if (column.accessor) {
            valueToFilter = column.accessor(item);
          } else {
            valueToFilter = item[column.key as keyof T];
          }
          return String(valueToFilter).toLowerCase().includes(filterTextLower);
        });
      });
    }

    // Client-side Sorting
    if (sortConfig.key && sortConfig.direction) {
      const columnToSort = columns.find(c => c.key === sortConfig.key);
      if (columnToSort?.sortable) {
        sortableItems.sort((a, b) => {
          const valA = columnToSort.accessor ? columnToSort.accessor(a) : a[sortConfig.key! as keyof T];
          const valB = columnToSort.accessor ? columnToSort.accessor(b) : b[sortConfig.key! as keyof T];

          if (valA === null || valA === undefined) return sortConfig.direction === 'asc' ? -1 : 1;
          if (valB === null || valB === undefined) return sortConfig.direction === 'asc' ? 1 : -1;
          
          if (typeof valA === 'number' && typeof valB === 'number') {
            return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
          }
          if (typeof valA === 'string' && typeof valB === 'string') {
            return sortConfig.direction === 'asc'
              ? valA.localeCompare(valB)
              : valB.localeCompare(valA);
          }
          // Fallback for other types or mixed types (basic comparison)
          if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
          if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        });
      }
    }
    return sortableItems;
  }, [data, globalFilter, sortConfig, columns, isServerSide]);

  // Pagination Logic (client-side)
  const totalItems = processedData.length;
  const totalPages = pagination ? Math.ceil(totalItems / itemsPerPage) : 1;
  const paginatedData = useMemo(() => {
    if (!pagination || isServerSide) return processedData;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return processedData.slice(startIndex, startIndex + itemsPerPage);
  }, [processedData, currentPage, itemsPerPage, pagination, isServerSide]);


  const handleSort = (key: ColumnDefinition<T>['key']) => {
    if (isServerSide && onSortChange) {
        let newDirection: 'asc' | 'desc' | null = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            newDirection = 'desc';
        } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
            newDirection = null; // Or back to 'asc' if you prefer cycle
        }
        setSortConfig({ key, direction: newDirection });
        onSortChange(key, newDirection);
    } else if (!isServerSide) {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    }
  };

  const handleFilterChange = (e: ChangeEvent<HTMLInputElement>) => {
    setGlobalFilter(e.target.value);
    // If server-side filtering, you'd call a prop function here
  };

  const renderPagination = () => {
    if (!pagination || totalPages <= 1 || isServerSide) return null;

    const pageNumbers = [];
    // Logic for displaying page numbers (e.g., with ellipses for many pages)
    // Simple version for now:
    for (let i = 1; i <= totalPages; i++) {
      pageNumbers.push(i);
    }

    return (
      <div className={styles.paginationControls}>
        <button
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className={styles.paginationButton}
        >
          Previous
        </button>
        {pageNumbers.map(num => (
          <button
            key={num}
            onClick={() => setCurrentPage(num)}
            disabled={currentPage === num}
            className={`${styles.paginationButton} ${currentPage === num ? styles.activePage : ''}`}
          >
            {num}
          </button>
        ))}
        <button
          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
          className={styles.paginationButton}
        >
          Next
        </button>
        <span className={styles.paginationInfo}>
          Page {currentPage} of {totalPages} ({totalItems} items)
        </span>
      </div>
    );
  };

  return (
    <div className={`${styles.dataTableWrapper} ${className}`}>
      {showGlobalFilter && !isServerSide && (
        <div className={styles.globalFilterContainer}>
          <Search size={18} className={styles.filterIcon} />
          <input
            type="text"
            value={globalFilter}
            onChange={handleFilterChange}
            placeholder={globalFilterPlaceholder}
            className={styles.globalFilterInput}
          />
          {globalFilter && (
            <button onClick={() => setGlobalFilter('')} className={styles.clearFilterButton} aria-label="Clear filter">
              <X size={16} />
            </button>
          )}
        </div>
      )}
      <div className={styles.dataTableContainer}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={`${styles.th} ${col.headerClassName || ''} ${col.className || ''} ${col.sortable || (isServerSide && onSortChange) ? styles.sortableHeader : ''}`}
                  style={{ width: col.width }}
                  onClick={col.sortable || (isServerSide && onSortChange) ? () => handleSort(col.key) : undefined}
                  tabIndex={col.sortable || (isServerSide && onSortChange) ? 0 : undefined}
                  onKeyDown={col.sortable || (isServerSide && onSortChange) ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleSort(col.key); } : undefined}
                  aria-sort={sortConfig.key === col.key ? (sortConfig.direction === 'asc' ? 'ascending' : sortConfig.direction === 'desc' ? 'descending' : 'none') : 'none'}
                >
                  {col.header}
                  {sortConfig.key === col.key && sortConfig.direction === 'asc' && <ChevronUp size={16} className={styles.sortIcon} />}
                  {sortConfig.key === col.key && sortConfig.direction === 'desc' && <ChevronDown size={16} className={styles.sortIcon} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && paginatedData.length === 0 && (
              Array.from({ length: Math.min(itemsPerPage, skeletonRowCount) }).map((_, rowIndex) => (
                <tr key={`skeleton-${rowIndex}`} className={styles.tr}>
                  {columns.map((col, colIndex) => (
                    <td key={`skeleton-${rowIndex}-${colIndex}`} className={`${styles.td} ${col.className || ''}`}>
                      <SkeletonLoader type="text" height="20px" />
                    </td>
                  ))}
                </tr>
              ))
            )}
            {!isLoading && error && (
              <tr>
                <td colSpan={columns.length} className={`${styles.td} ${styles.errorState}`}>
                  Error: {error}
                </td>
              </tr>
            )}
            {!isLoading && !error && paginatedData.length === 0 && (
              <tr>
                <td colSpan={columns.length} className={`${styles.td} ${styles.emptyState}`}>
                  {globalFilter ? "No results found for your search." : emptyStateMessage}
                </td>
              </tr>
            )}
            {!isLoading && !error && paginatedData.map((item, rowIndex) => (
              <tr
                key={rowKey(item, rowIndex)}
                className={`${styles.tr} ${onRowClick ? styles.clickableRow : ''}`}
                onClick={onRowClick ? () => onRowClick(item, rowIndex) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onRowClick(item, rowIndex); } : undefined}
              >
                {columns.map((col, colIndex) => (
                  <td key={`${String(rowKey(item,rowIndex))}-${String(col.key)}-${colIndex}`} className={`${styles.td} ${col.className || ''}`}>
                    {col.render
                      ? col.render(item, rowIndex)
                      : String((item as any)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isLoading && paginatedData.length > 0 && (
        <div className={styles.loadingMoreSpinner}>
          <LoadingSpinner size={24} />
        </div>
      )}
      {renderPagination()}
    </div>
  );
}

export default DataTable;