'use client';

import React from 'react';
import EmptyState from './EmptyState';
import { TableSkeleton } from './LoadingSkeleton';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface ColumnDef<T> {
  header: string;
  accessorKey?: keyof T | string;
  cell?: (item: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
  width?: string;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  emptyActionHref?: string;
  onRowClick?: (item: T) => void;
  // Pagination
  page?: number;
  totalPages?: number;
  totalRecords?: number;
  onPageChange?: (page: number) => void;
  className?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  isLoading = false,
  emptyTitle = 'No records found',
  emptyDescription = 'There are currently no items matching your criteria in the database.',
  emptyActionLabel,
  emptyActionHref,
  onRowClick,
  page,
  totalPages,
  totalRecords,
  onPageChange,
  className = '',
}: DataTableProps<T>) {
  if (isLoading) {
    return <TableSkeleton rows={6} cols={columns.length} />;
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={emptyActionLabel}
        actionHref={emptyActionHref}
        className={className}
      />
    );
  }

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col ${className}`}>
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <tr>
              {columns.map((col, idx) => {
                const alignClass =
                  col.align === 'right'
                    ? 'text-right'
                    : col.align === 'center'
                    ? 'text-center'
                    : 'text-left';
                return (
                  <th
                    key={idx}
                    className={`px-4 py-3.5 ${alignClass} ${col.className || ''}`}
                    style={{ width: col.width }}
                  >
                    {col.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                onClick={() => onRowClick && onRowClick(row)}
                className={`transition ${
                  onRowClick ? 'cursor-pointer hover:bg-sky-50/40' : 'hover:bg-slate-50/50'
                }`}
              >
                {columns.map((col, colIdx) => {
                  const alignClass =
                    col.align === 'right'
                      ? 'text-right font-mono'
                      : col.align === 'center'
                      ? 'text-center'
                      : 'text-left';

                  const cellContent = col.cell
                    ? col.cell(row)
                    : col.accessorKey
                    ? row[col.accessorKey as string]
                    : null;

                  return (
                    <td key={colIdx} className={`px-4 py-3.5 text-slate-700 ${alignClass} ${col.className || ''}`}>
                      {cellContent}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {(totalPages !== undefined && totalPages > 1 && onPageChange && page !== undefined) && (
        <div className="p-3.5 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            {totalRecords !== undefined ? (
              <span>
                Showing <strong className="font-semibold text-slate-700">{data.length}</strong> of{' '}
                <strong className="font-semibold text-slate-700">{totalRecords}</strong> records
              </span>
            ) : (
              <span>
                Page <strong className="font-semibold text-slate-700">{page}</strong> of{' '}
                <strong className="font-semibold text-slate-700">{totalPages}</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Previous
            </button>
            <span className="px-3 py-1 font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;
