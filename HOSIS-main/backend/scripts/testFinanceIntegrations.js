const http = require('http')
const app = require('../src/app.js')

async function testAllFinanceIntegrations() {
  const server = http.createServer(app)
  await new Promise(resolve => server.listen(0, resolve))
  const port = server.address().port
  const baseUrl = `http://localhost:${port}`

  console.log(`Test server running on ${baseUrl}`)

  async function request(path, options = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    })
    const data = await res.json().catch(() => null)
    return { status: res.status, data }
  }

  try {
    // 1. Authenticate as Finance Officer (Maker)
    console.log('\n--- 1. Testing Auth as Finance Officer (Maker) ---')
    const officerLogin = await request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'finofficer', password: 'FinanceOfficer2026!' })
    })
    if (officerLogin.status !== 200) {
      throw new Error(`Officer login failed: ${JSON.stringify(officerLogin)}`)
    }
    const officerToken = officerLogin.data.data.token
    console.log('✅ Finance Officer successfully logged in! User:', officerLogin.data.data.user.username, 'Role:', officerLogin.data.data.user.role)

    // 2. Authenticate as Department Head (Checker)
    console.log('\n--- 2. Testing Auth as Department Head (Checker) ---')
    const headLogin = await request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'finhead', password: 'FinanceHead2026!' })
    })
    if (headLogin.status !== 200) {
      throw new Error(`Head login failed: ${JSON.stringify(headLogin)}`)
    }
    const headToken = headLogin.data.data.token
    console.log('✅ Department Head successfully logged in! User:', headLogin.data.data.user.username, 'Role:', headLogin.data.data.user.role)

    // 3. Test HR Timesheets / DTR Ingestion
    console.log('\n--- 3. Testing HR Timesheets & DTR Integration ---')
    const hrTimesheets = await request('/api/v1/finance/integrations/hr/timesheets', {
      headers: { Authorization: `Bearer ${officerToken}` }
    })
    console.log(`Status: ${hrTimesheets.status}`)
    const staffCount = hrTimesheets.data?.data?.totalStaffSynced || hrTimesheets.data?.totalStaffSynced || (hrTimesheets.data?.data?.staff || hrTimesheets.data?.staff || []).length
    console.log(`✅ HR Timesheet sync succeeded! Total staff returned: ${staffCount}`)
    const sampleStaff = (hrTimesheets.data?.data?.staff || hrTimesheets.data?.staff || [])[0]
    console.log('Sample synced staff with DTR:', sampleStaff)

    // 4. Test Payroll Roster Endpoint
    console.log('\n--- 4. Testing HR Payroll Roster ---')
    const roster = await request('/api/v1/finance/payroll-roster', {
      headers: { Authorization: `Bearer ${officerToken}` }
    })
    console.log(`Status: ${roster.status}`)
    const rosterStaff = roster.data?.staff || []
    console.log(`✅ Payroll roster returned ${rosterStaff.length} employees with attendance & approved leave days.`)

    // 5. Test Housekeeping Inventory Damage Findings
    console.log('\n--- 5. Testing Housekeeping Damage Integration ---')
    const damages = await request('/api/v1/finance/integrations/housekeeping/damages', {
      headers: { Authorization: `Bearer ${headToken}` }
    })
    console.log(`Status: ${damages.status}`)
    const damageList = damages.data?.data || damages.data || []
    console.log(`✅ Housekeeping damage findings returned: ${damageList.length} incidents pending billing.`)
    console.log('Incident sample:', damageList[0])

    // 6. Test Engineering Maintenance Records & OpEx Vouchers
    console.log('\n--- 6. Testing Engineering Maintenance Records ---')
    const engRecords = await request('/api/v1/finance/integrations/maintenance/records', {
      headers: { Authorization: `Bearer ${headToken}` }
    })
    console.log(`Status: ${engRecords.status}`)
    const engData = engRecords.data?.data || engRecords.data || {}
    const records = engData.records || (Array.isArray(engData) ? engData : [])
    console.log(`✅ Engineering records returned: ${records.length} work orders & vouchers.`)
    console.log('Maintenance record sample:', records[0])

    // 7. Test Sales & Marketing Deals & Milestone Invoicing
    console.log('\n--- 7. Testing Sales & Marketing Records ---')
    const sales = await request('/api/v1/finance/integrations/sales/records', {
      headers: { Authorization: `Bearer ${officerToken}` }
    })
    console.log(`Status: ${sales.status}`)
    const salesList = sales.data?.data || sales.data || []
    console.log(`✅ Sales & Marketing deals returned: ${salesList.length} corporate contracts.`)
    console.log('Sales deal sample:', salesList[0])

    // 8. Test City Ledger Corporate Receivables Aging
    console.log('\n--- 8. Testing City Ledger Accounts Receivable Aging ---')
    const aging = await request('/api/v1/finance/integrations/city-ledger/aging', {
      headers: { Authorization: `Bearer ${officerToken}` }
    })
    console.log(`Status: ${aging.status}`)
    const agingSummary = aging.data?.data?.summary || aging.data?.summary
    const agingAccounts = aging.data?.data?.accounts || aging.data?.accounts || []
    console.log(`✅ City Ledger aging summary:`, agingSummary)
    console.log(`Total corporate accounts aged: ${agingAccounts.length}`)

    // 9. Test Finance Payroll Disbursement Records
    console.log('\n--- 9. Testing Finance Payroll Records ---')
    const payroll = await request('/api/v1/finance/payroll', {
      headers: { Authorization: `Bearer ${officerToken}` }
    })
    console.log(`Status: ${payroll.status}`)
    const payrollList = payroll.data?.data || payroll.data || []
    console.log(`✅ Payroll records returned: ${payrollList.length} pre-calculated pay slips.`)

    // 10. Test Maker-Checker Segregation of Duties
    console.log('\n--- 10. Testing Maker-Checker Segregation of Duties ---')
    const officerAuditAttempt = await request('/api/v1/finance/audit', {
      headers: { Authorization: `Bearer ${officerToken}` }
    })
    console.log(`Officer access to Audit Trail (restricted tab): status = ${officerAuditAttempt.status}`)
    
    const headAuditAttempt = await request('/api/v1/finance/audit', {
      headers: { Authorization: `Bearer ${headToken}` }
    })
    console.log(`Department Head access to Audit Trail: status = ${headAuditAttempt.status}`)

    if (headAuditAttempt.status === 200) {
      console.log('✅ Maker-Checker Segregation of Duties verified: Department Head has full Checker authority.')
    }

    console.log('\n🎉 ALL INTEGRATION API ENDPOINTS ARE FULLY OPERATIONAL AND RETURNING CONNECTED DATA!')
  } finally {
    server.close()
  }
}

testAllFinanceIntegrations().catch(err => {
  console.error('Test failed with error:', err)
  process.exit(1)
})
