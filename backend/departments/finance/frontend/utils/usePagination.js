import { useState, useMemo } from 'react'

/**
 * Client-side pagination hook for tabular and list datasets.
 * Automatically clamps page numbers and resets to page 1 when resetKey (filters/search) changes.
 *
 * @param {Array} rows - Full filtered array of records
 * @param {number} defaultPageSize - Number of records per page (default: 10)
 * @param {string|number} resetKey - Any dependency string (e.g. `${search}|${filter}`) that triggers a reset to page 1
 */
export function usePagination(rows = [], defaultPageSize = 10, resetKey = '') {
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [state, setState] = useState({ key: resetKey, page: 1 })

  // If resetKey changed since last render, reset to page 1
  const currentPage = state.key === resetKey ? state.page : 1
  const total = rows.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(1, currentPage), pageCount)

  const firstIndex = (page - 1) * pageSize
  const lastIndex = Math.min(firstIndex + pageSize, total)

  const paginatedRows = useMemo(() => {
    return rows.slice(firstIndex, firstIndex + pageSize)
  }, [rows, firstIndex, pageSize])

  const setPage = (nextPage) => {
    const target = typeof nextPage === 'function' ? nextPage(page) : nextPage
    const bounded = Math.min(Math.max(1, target), pageCount)
    setState({ key: resetKey, page: bounded })
  }

  const handlePageSizeChange = (newSize) => {
    setPageSize(Number(newSize))
    setState({ key: resetKey, page: 1 })
  }

  return {
    rows: paginatedRows,
    page,
    pageSize,
    total,
    pageCount,
    firstIndex: total > 0 ? firstIndex + 1 : 0,
    lastIndex,
    setPage,
    setPageSize: handlePageSizeChange,
    paginationProps: {
      page,
      pageSize,
      total,
      pageCount,
      firstIndex: total > 0 ? firstIndex + 1 : 0,
      lastIndex,
      onPageChange: setPage,
      onPageSizeChange: handlePageSizeChange,
    },
  }
}
