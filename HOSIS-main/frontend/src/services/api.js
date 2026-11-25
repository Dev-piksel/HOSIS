const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'
const TOKEN_KEY = 'hosis.accessToken'
const USER_KEY = 'hosis.user'
const SIGNED_OUT_KEY = 'hosis.tabSignedOut'

function storedToken() {
  const tab = window.sessionStorage
  const token = tab.getItem(TOKEN_KEY)
  if (token || tab.getItem(SIGNED_OUT_KEY)) return token
  const remembered = window.localStorage.getItem(TOKEN_KEY)
  if (remembered) {
    tab.setItem(TOKEN_KEY, remembered)
    const user = window.localStorage.getItem(USER_KEY)
    if (user) tab.setItem(USER_KEY, user)
  }
  return remembered
}

function saveSession(session, remember) {
  const tab = window.sessionStorage
  tab.removeItem(SIGNED_OUT_KEY)
  tab.setItem(TOKEN_KEY, session.token)
  tab.setItem(USER_KEY, JSON.stringify(session.user))
  if (remember) {
    window.localStorage.setItem(TOKEN_KEY, session.token)
    window.localStorage.setItem(USER_KEY, JSON.stringify(session.user))
  }
}

function clearSession() {
  const token = storedToken()
  if (token && window.localStorage.getItem(TOKEN_KEY) === token) {
    window.localStorage.removeItem(TOKEN_KEY)
    window.localStorage.removeItem(USER_KEY)
  }
  window.sessionStorage.removeItem(TOKEN_KEY)
  window.sessionStorage.removeItem(USER_KEY)
  window.sessionStorage.setItem(SIGNED_OUT_KEY, '1')
}

function savedUser() {
  storedToken()
  const rawUser = window.sessionStorage.getItem(USER_KEY)
  if (!rawUser) return null
  try {
    return JSON.parse(rawUser)
  } catch {
    clearSession()
    return null
  }
}

export class ApiError extends Error {
  constructor(message, status, code) { super(message); this.name='ApiError'; this.status=status; this.code=code }
}

export async function request(path, { responseType, ...options } = {}) {
  const headers = new Headers(options.headers || {})
  if (options.body !== undefined) headers.set('Content-Type', 'application/json')
  const accessToken = storedToken()
  if (accessToken && path !== '/auth/login') headers.set('Authorization', `Bearer ${accessToken}`)

  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
  } catch {
    throw new Error('Can’t reach the HOSIS API. Check that the backend is running and try again.')
  }

  if (response.status === 401 && path !== '/auth/login' && accessToken && storedToken() === accessToken) {
    clearSession()
    window.dispatchEvent(new Event('hosis:unauthorized'))
  }
  if (response.status === 204) return null
  if (response.ok && responseType === 'blob') return response.blob()

  let body
  try {
    body = await response.json()
  } catch {
    throw new Error(`The HOSIS API returned an invalid response (${response.status}).`)
  }

  if (!response.ok) {
    throw new ApiError(body?.error?.message || `Request failed (${response.status}).`,response.status,body?.error?.code)
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError('The API returned an invalid response.', response.status, 'INVALID_RESPONSE')
  return Object.hasOwn(body, 'data') ? body.data : body
}

function json(method, value) {
  return { method, body: JSON.stringify(value) }
}

export const authApi = {
  login: (username, password, role, remember) => request('/auth/login', json('POST', { username, password, role, remember })),
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  saveSession,
  clearSession,
  getToken: storedToken,
  isRemembered: () => Boolean(storedToken() && storedToken() === window.localStorage.getItem(TOKEN_KEY)),
  getSavedUser: savedUser,
}

export const departmentLeaveApi = {
  myLeave: () => request('/hr/department-leave'),
  fileLeave: (body) => request('/hr/department-leave', json('POST', body)),
}

export const hrApi = {
  request: (path, options) => request(`/hr${path}`, options),
}

export const frontOfficeApi = {
  notifications: () => request('/housekeeping/notifications?unread=1'),
  acknowledge: (id) => request(`/housekeeping/notifications/${id}/read`,{method:'PATCH'}),
  dashboard: () => request('/front-office/dashboard'),
  myLeave: () => request('/front-office/staff/leave'),
  fileLeave: (body) => request('/front-office/staff/leave', json('POST', body)),
  accountReport: (period, date, filters = {}) => request(`/front-office/reports/account?${new URLSearchParams({ period, date, ...filters })}`),
  activityReport: (period, date, filters = {}) => request(`/front-office/reports/activity?${new URLSearchParams({ period, date, ...filters })}`),
  stayActivity: (date) => request(`/front-office/reports/stay-activity?date=${encodeURIComponent(date)}`),
  guests: (search = '') => request(`/front-office/guests${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  createGuest: (guest) => request('/front-office/guests', json('POST', guest)),
  updateGuest: (id, fields) => request(`/front-office/guests/${id}`, json('PATCH', fields)),
  deleteGuest: (id) => request(`/front-office/guests/${id}`, { method: 'DELETE' }),
  reservations: (search = '') => request(`/front-office/reservations${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  createReservation: (reservation) => request('/front-office/reservations', json('POST', reservation)),
  updateReservation: (id, fields) => request(`/front-office/reservations/${id}`, json('PATCH', fields)),
  cancelReservation: (id) => request(`/front-office/reservations/${id}`, { method: 'DELETE' }),
  checkIn: (id) => request(`/front-office/reservations/${id}/check-in`, { method: 'POST' }),
  moveStay: (id, roomId) => request(`/front-office/reservations/${id}/move-room`, json('POST', { roomId })),
  lostItems: (id) => request(`/front-office/reservations/${id}/lost-items`),
  lostAndFound: (filters) => request(`/housekeeping/front-office/lost-found?${new URLSearchParams(filters)}`),
  stayFolio: (id) => request(`/front-office/reservations/${id}/folio`),
  extendStay: (id, checkOut) => request(`/front-office/reservations/${id}/extend`, json('POST', { checkOut })),
  checkOut: (id) => request(`/front-office/reservations/${id}/check-out`, { method: 'POST' }),
  stayPromotions: (checkIn, checkOut) => request(`/front-office/reservations/promotions?${new URLSearchParams({ checkIn, checkOut })}`),
  invoicePromotions: (reservationId) => request(`/front-office/invoices/promotions?${new URLSearchParams({ reservationId })}`),
  availableRooms: (checkIn, checkOut) => request(`/front-office/rooms/availability?${new URLSearchParams({ checkIn, checkOut })}`),
  reportRoomIssue: (id, issue) => request(`/front-office/rooms/${id}/maintenance-requests`, json('POST', issue)),
  rooms: (search = '') => request(`/front-office/rooms${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  room: (id) => request(`/front-office/rooms/${id}`),
  releaseRoom: (id) => request(`/front-office/rooms/${id}/status`, json('PATCH', { status: 'AVAILABLE' })),
  requests: (search = '') => request(`/front-office/guest-requests${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  createRequest: (guestRequest) => request('/front-office/guest-requests', json('POST', guestRequest)),
  updateRequest: (id, fields) => request(`/front-office/guest-requests/${id}`, json('PATCH', fields)),
  invoices: (search = '') => request(`/front-office/invoices${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  invoice: (id) => request(`/front-office/invoices/${id}`),
  createInvoice: (invoice) => request('/front-office/invoices', json('POST', invoice)),
  updateInvoice: (id, fields) => request(`/front-office/invoices/${id}`, json('PATCH', fields)),
  payments: (invoiceId) => request(`/front-office/invoices/${invoiceId}/payments`),
  createPayment: (invoiceId, payment) => request(`/front-office/invoices/${invoiceId}/payments`, json('POST', payment)),
  payment: (id) => request(`/front-office/payments/${id}`),
  updatePayment: (id, fields) => request(`/front-office/payments/${id}`, json('PATCH', fields)),
  housekeepingFindings: () => request('/housekeeping/integrations/front-office/charge-findings'),
  reviewHousekeepingFinding: (id, decision, notes) => request(`/housekeeping/integrations/front-office/charge-findings/${id}`, json('PATCH', { decision, notes })),
}

export const adminApi = {
  dashboard: () => request('/admin/dashboard'),
  staff: () => request('/admin/staff'),
  createStaff: (staff) => request('/admin/staff', json('POST', staff)),
  updateStaff: (id, fields) => request(`/admin/staff/${id}`, json('PATCH', fields)),
  deleteStaff: (id) => request(`/admin/staff/${id}`, { method: 'DELETE' }),
  unlockStaff: (id) => request(`/admin/staff/${id}/unlock`, { method: 'POST' }),
  reportCatalog: () => request('/admin/reports'),
  engineeringArchives: () => request('/engineering/reports/archive'),
  engineeringArchiveFile: (id) => request(`/engineering/reports/archive/${encodeURIComponent(id)}/download`, { responseType: 'blob' }),
  exportReports: (filters) => request(`/admin/reports/export?${new URLSearchParams(filters)}`),
  audit: (filters) => request(`/admin/audit?${new URLSearchParams(filters)}`),
  activity: (limit = 50) => request(`/admin/activity?limit=${limit}`),
  settings: () => request('/admin/settings'),
  updateSettings: (settings) => request('/admin/settings', json('PUT', settings)),
}

export const departmentApi = {
  sales: () => request('/sales-marketing/overview'),
  addSalesRecord: (kind, details) => request('/sales-marketing/records/' + kind, json('POST', details)),
  updateSalesStatus: (kind, id, status) => request('/sales-marketing/records/' + kind + '/' + encodeURIComponent(id), json('PATCH', { status })),
  deleteSalesRecord: (kind, id) => request('/sales-marketing/records/' + kind + '/' + encodeURIComponent(id), { method: 'DELETE' }),
  finance: () => request('/finance/overview'),
  settleSharedInvoice: (id, payment) => request(`/finance/shared-invoices/${id}/payments`, json('POST', payment)),
}

export const financeApi = {
  dashboard: () => request('/finance/dashboard'),
  invoices: (search = '', status = '', invoiceType = '') =>
    request(`/finance/invoices?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&invoiceType=${encodeURIComponent(invoiceType)}`),
  invoice: (id) => request(`/finance/invoices/${id}`),
  createInvoice: (invoice) => request('/finance/invoices', json('POST', invoice)),
  updateInvoice: (id, fields) => request(`/finance/invoices/${id}`, json('PATCH', fields)),
  payments: (search = '', method = '', date = '') =>
    request(`/finance/payments?search=${encodeURIComponent(search)}&method=${encodeURIComponent(method)}&date=${encodeURIComponent(date)}`),
  createPayment: (payment) => request('/finance/payments', json('POST', payment)),
  expenses: (status = '', department = '') =>
    request(`/finance/expenses?status=${encodeURIComponent(status)}&department=${encodeURIComponent(department)}`),
  createExpense: (expense) => request('/finance/expenses', json('POST', expense)),
  approveExpense: (id) => request(`/finance/expenses/${id}/approve`, { method: 'PATCH' }),
  settleExpense: (id, reference) => request(`/finance/expenses/${id}/settle`, json('POST', { reference })),
  revenue: (period = 'all', date = '') =>
    request(`/finance/revenue?period=${encodeURIComponent(period)}&date=${encodeURIComponent(date)}`),
  payroll: (department = '', status = '', search = '') =>
    request(`/finance/payroll?department=${encodeURIComponent(department)}&status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`),
  createPayroll: (payrollData) => request('/finance/payroll', json('POST', payrollData)),
  disbursePayroll: (id) => request(`/finance/payroll/${id}/disburse`, { method: 'PATCH' }),
  audit: (search = '', eventType = '') =>
    request(`/finance/audit?search=${encodeURIComponent(search)}&eventType=${encodeURIComponent(eventType)}`),
  reports: (reportType = '', period = 'daily', date = '') =>
    request(`/finance/reports?reportType=${encodeURIComponent(reportType)}&period=${encodeURIComponent(period)}&date=${encodeURIComponent(date)}`),
  signReport: (body) => request('/finance/reports/sign-off', json('POST', body)),
  exportDataUrl: (entity = 'invoices', format = 'csv', period = 'all') =>
    `/api/v1/finance/export?entity=${encodeURIComponent(entity)}&format=${encodeURIComponent(format)}&period=${encodeURIComponent(period)}`,
  exportData: (entity = 'invoices', format = 'csv', period = 'all') =>
    request(`/finance/export?entity=${encodeURIComponent(entity)}&format=${encodeURIComponent(format)}&period=${encodeURIComponent(period)}`),
  dispatchSubsystems: (payload) =>
    request('/finance/subsystems/dispatch', json('POST', payload)),

  // Subsystem Integrations
  hkDamages: (status = '') =>
    request(`/finance/integrations/housekeeping/damages?status=${encodeURIComponent(status)}`),
  billHkDamage: (payload) =>
    request('/finance/integrations/housekeeping/damages/bill', json('POST', payload)),
  maintenanceRecords: (status = '') =>
    request(`/finance/integrations/maintenance/records?status=${encodeURIComponent(status)}`),
  createMaintenanceExpense: (payload) =>
    request('/finance/integrations/maintenance/expenses', json('POST', payload)),
  salesRecords: (status = '') =>
    request(`/finance/integrations/sales/records?status=${encodeURIComponent(status)}`),
  syncSalesInvoice: (payload) =>
    request('/finance/integrations/sales/sync-invoice', json('POST', payload)),
  cityLedgerAging: () =>
    request('/finance/integrations/city-ledger/aging'),
  hrTimesheets: (periodStart = '', periodEnd = '') =>
    request(`/finance/integrations/hr/timesheets?periodStart=${encodeURIComponent(periodStart)}&periodEnd=${encodeURIComponent(periodEnd)}`),
  statutoryRates: () =>
    request('/finance/statutory-rates'),
  getStatutoryRates: () =>
    request('/finance/statutory-rates'),
  nightAuditHistory: (limit = 15) =>
    request(`/finance/night-audit?limit=${limit}`),
  runNightAudit: (auditDate = '') =>
    request('/finance/night-audit/run', json('POST', { auditDate })),

  // Staff Leave Requests & Entitlement Management
  leaveRequests: (params = {}) => {
    const q = new URLSearchParams()
    if (params.status && params.status !== 'All') q.set('status', params.status)
    if (params.department && params.department !== 'All') q.set('department', params.department)
    if (params.leaveType && params.leaveType !== 'All') q.set('leaveType', params.leaveType)
    if (params.search) q.set('search', params.search)
    if (params.period && params.period !== 'all') q.set('period', params.period)
    const qs = q.toString()
    return request(`/finance/leave-requests${qs ? `?${qs}` : ''}`)
  },
  createLeaveRequest: (payload) =>
    request('/finance/leave-requests', json('POST', payload)),
  updateLeaveRequestStatus: (id, payload) =>
    request(`/finance/leave-requests/${id}/status`, json('PATCH', payload)),
  leaveSummary: () =>
    request('/finance/leave-requests/summary'),
  customerPayments: () => request('/finance/customer-payments'),
  payrollRoster: () => request('/finance/payroll-roster'),
  housekeepingFindings: () => request('/housekeeping/integrations/finance/charge-findings'),
  decideHousekeepingFinding: (id, decision) => request('/housekeeping/integrations/finance/charge-findings/' + id, {
    method: 'PATCH', body: JSON.stringify(decision),
  }),
}
