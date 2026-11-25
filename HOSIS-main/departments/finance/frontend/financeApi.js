import { request } from '../../../frontend/src/services/api.js'

function get(path, filters = {}) {
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value != null && value !== ''))
  return request('/finance/latest/' + path + (query.size ? '?' + query : ''))
}

function send(method, path, body = {}) {
  return request('/finance/latest/' + path, { method, body: JSON.stringify(body) })
}

export const financeApi = {
  dashboard: () => get('dashboard'),
  invoices: (search, status, invoiceType) => get('invoices', { search, status, invoiceType }),
  invoice: (id) => get('invoices/' + id),
  createInvoice: (body) => send('POST', 'invoices', body),
  updateInvoice: async (id, body) => {
    if (body.status === 'VOID') return send('POST', 'invoices/' + id + '/void')
    const invoice = await get('invoices/' + id)
    return send('PATCH', 'invoices/' + id, {
      guestName: invoice.guestName, guestEmail: invoice.guestEmail,
      dueDate: invoice.dueDate, notes: invoice.notes, ...body,
    })
  },
  payments: (search, method, date) => get('payments', { search, method, date }),
  createPayment: (body) => send('POST', 'payments', body),
  expenses: (status, department) => get('expenses', { status, department }),
  createExpense: (body) => send('POST', 'expenses', body),
  settleExpense: (id, reference) => send('POST', 'expenses/' + id + '/settle', { reference }),
  approveExpense: (id) => send('PATCH', 'expenses/' + id + '/approve'),
  payroll: (department, status, search) => get('payroll', { department, status, search }),
  createPayroll: (body) => send('POST', 'payroll', body),
  disbursePayroll: (id) => send('PATCH', 'payroll/' + id + '/disburse'),
  revenue: (period, date) => get('revenue', { period, date }),
  reports: (reportType, period, date) => get('reports', { reportType, period, date }),
  signReport: (body) => send('POST', 'reports/sign-off', body),
  audit: (search, eventType) => get('audit', { search, eventType }),
  exportData: (entity, format, period, filters) => get('export', { entity, format, period, ...filters }),
  exportDataUrl: (entity = 'invoices', format = 'csv', period = 'all') =>
    `/api/v1/finance/export?entity=${encodeURIComponent(entity)}&format=${encodeURIComponent(format)}&period=${encodeURIComponent(period)}`,
  dispatchSubsystems: (body) => send('POST', 'subsystems/dispatch', body),
  hkDamages: (status) => get('integrations/housekeeping/damages', { status }),
  billHkDamage: (body) => send('POST', 'integrations/housekeeping/damages/bill', body),
  maintenanceRecords: (status) => get('integrations/maintenance/records', { status }),
  createMaintenanceExpense: (body) => send('POST', 'integrations/maintenance/expenses', body),
  salesRecords: (status) => get('integrations/sales/records', { status }),
  syncSalesInvoice: (body) => send('POST', 'integrations/sales/sync-invoice', body),
  cityLedgerAging: () => get('integrations/city-ledger/aging'),
  hrTimesheets: (periodStart, periodEnd) => get('integrations/hr/timesheets', { periodStart, periodEnd }),
  getStatutoryRates: () => get('statutory-rates'),
  statutoryRates: () => get('statutory-rates'),
  nightAuditHistory: (limit) => get('night-audit', { limit }),
  runNightAudit: (body) => send('POST', 'night-audit/run', body),
  leaveRequests: (filters) => get('leave-requests', filters),
  createLeaveRequest: (body) => send('POST', 'leave-requests', body),
  updateLeaveRequestStatus: (id, body) => send('PATCH', 'leave-requests/' + id + '/status', body),
  leaveSummary: () => get('leave-requests/summary'),
  customerPayments: () => request('/finance/customer-payments'),
  payrollRoster: () => request('/finance/payroll-roster'),
  housekeepingFindings: () => request('/housekeeping/integrations/finance/charge-findings'),
  decideHousekeepingFinding: (id, decision) => request('/housekeeping/integrations/finance/charge-findings/' + id, {
    method: 'PATCH', body: JSON.stringify(decision),
  }),
  // Cross-Subsystem Integration Hub
  subsystemSummary: () => get('subsystem-hub/summary'),
  subsystemDtr: (filters) => get('subsystem-hub/dtr', filters),
  subsystemBudgetRequests: (filters) => get('subsystem-hub/budget-requests', filters),
  decideBudgetRequest: (id, body) => send('PATCH', 'subsystem-hub/budget-requests/' + id + '/decision', body),
  subsystemGuestPayments: (filters) => get('subsystem-hub/guest-payments', filters),
  subsystemPayroll: (filters) => get('subsystem-hub/payroll', filters),
  subsystemDamages: (filters) => get('subsystem-hub/damages', filters),
}
