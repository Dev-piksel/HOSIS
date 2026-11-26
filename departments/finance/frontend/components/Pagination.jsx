import React from 'react'

function getPageNumbers(current, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  if (current <= 4) {
    return [1, 2, 3, 4, 5, '...', totalPages]
  }

  if (current >= totalPages - 3) {
    return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  }

  return [1, '...', current - 1, current, current + 1, '...', totalPages]
}

export default function Pagination({
  page = 1,
  pageSize = 10,
  total = 0,
  pageCount = 1,
  firstIndex = 0,
  lastIndex = 0,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'records',
  showPageSize = true,
  alwaysShow = false,
  pageSizeOptions = [5, 10, 20, 50],
}) {
  if (!alwaysShow && total <= Math.min(...pageSizeOptions) && total <= pageSize) {
    return null
  }

  const safePageCount = Math.max(1, pageCount || Math.ceil(total / pageSize))
  const safeCurrentPage = Math.min(Math.max(1, page), safePageCount)
  const pages = getPageNumbers(safeCurrentPage, safePageCount)

  return (
    <nav className="fin-pagination" aria-label={`${itemLabel} pagination`}>
      <div className="fin-pagination-info">
        <span>
          Showing <strong>{firstIndex}</strong>–<strong>{lastIndex}</strong> of <strong>{total}</strong> {itemLabel}
        </span>
        {showPageSize && onPageSizeChange && (
          <div className="fin-pagination-size-wrap">
            <label htmlFor="fin-page-size-select" className="fin-pagination-size-label">Per page:</label>
            <select
              id="fin-page-size-select"
              className="fin-pagination-size-select"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {pageSizeOptions.map((sz) => (
                <option key={sz} value={sz}>{sz}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="fin-pagination-controls" role="group" aria-label="Page navigation">
        <button
          type="button"
          className="fin-pagination-btn fin-pagination-prev"
          disabled={safeCurrentPage <= 1}
          onClick={() => onPageChange && onPageChange(safeCurrentPage - 1)}
          aria-label="Previous page"
          title="Go to previous page"
        >
          ‹ Prev
        </button>

        {pages.map((item, idx) => {
          if (item === '...') {
            return (
              <span key={`gap-${idx}`} className="fin-pagination-ellipsis" aria-hidden="true">
                …
              </span>
            )
          }

          const isCurrent = item === safeCurrentPage
          return (
            <button
              type="button"
              key={`page-${item}`}
              className={`fin-pagination-btn fin-pagination-num ${isCurrent ? 'active' : ''}`}
              aria-current={isCurrent ? 'page' : undefined}
              onClick={() => onPageChange && onPageChange(item)}
              title={`Page ${item}`}
            >
              {item}
            </button>
          )
        })}

        <button
          type="button"
          className="fin-pagination-btn fin-pagination-next"
          disabled={safeCurrentPage >= safePageCount}
          onClick={() => onPageChange && onPageChange(safeCurrentPage + 1)}
          aria-label="Next page"
          title="Go to next page"
        >
          Next ›
        </button>
      </div>
    </nav>
  )
}
