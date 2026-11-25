const HOUSEKEEPING_VIEWER = 'HOUSEKEEPING_VIEWER'

const FINANCE_DEPARTMENT_ROLES = [
  'FINANCE',
  'FINANCE_ADMIN',
  'FINANCE_STAFF',
  'FINANCE_OFFICER',
  'OFFICER',
  'DEPARTMENT_HEAD',
  'HEAD',
  'FINANCE_HEAD',
]

function accessRole(accountRole, requestedRole = accountRole) {
  if (requestedRole === accountRole) return accountRole
  if (accountRole === 'SUPER_ADMIN' && (requestedRole === 'ADMIN' || !requestedRole)) return 'SUPER_ADMIN'
  if (accountRole === 'TECHNICIAN' && requestedRole === 'ENGINEERING') return 'TECHNICIAN'
  if (FINANCE_DEPARTMENT_ROLES.includes(accountRole) && (requestedRole === 'FINANCE' || !requestedRole)) {
    return accountRole
  }
  if (accountRole === 'ADMIN' && ['FRONT_OFFICE', 'HOUSEKEEPING', 'FINANCE', 'HR', 'SALES_MARKETING', 'ENGINEERING'].includes(requestedRole)) {
    return requestedRole
  }
  if (accountRole === 'FRONT_OFFICE' && ['HOUSEKEEPING', HOUSEKEEPING_VIEWER].includes(requestedRole)) {
    return HOUSEKEEPING_VIEWER
  }
  return null
}
module.exports = { accessRole, HOUSEKEEPING_VIEWER }
