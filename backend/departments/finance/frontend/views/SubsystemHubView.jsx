import { useState, useEffect, useCallback } from 'react'
import { financeApi } from '../financeApi.js'
import { usePagination } from '../utils/usePagination.js'
import Pagination from '../components/Pagination.jsx'

export default function SubsystemHubView({ user, showToast, autoSyncTick = 0 }) {
  const isChecker = ['DEPARTMENT_HEAD', 'HEAD', 'FINANCE_HEAD', 'FINANCE_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(
    user?.role?.toUpperCase()
  )

  const [activeTab, setActiveTab] = useState('dtr')
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [deptFilter, setDeptFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')

  // Tab Data States
  const [dtrList, setDtrList] = useState([])
  const [payrollList, setPayrollList] = useState([])
  const [budgetList, setBudgetList] = useState([])
  const [guestPaymentsList, setGuestPaymentsList] = useState([])
  const [damagesList, setDamagesList] = useState([])

  // Budget Decision State
  const [selectedBudgetReq, setSelectedBudgetReq] = useState(null)
  const [decisionNotes, setDecisionNotes] = useState('')
  const [decisionAmount, setDecisionAmount] = useState('')
  const [submittingDecision, setSubmittingDecision] = useState(false)

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [sumRes, dtrRes, budgetRes, payRes, prRes, dmgRes] = await Promise.all([
        financeApi.subsystemSummary().catch(() => ({})),
        financeApi.subsystemDtr({ department: deptFilter !== 'All' ? deptFilter : '', search: searchTerm }).catch(() => ({ data: [] })),
        financeApi.subsystemBudgetRequests({ department: deptFilter !== 'All' ? deptFilter : '', status: statusFilter !== 'All' ? statusFilter : '', search: searchTerm }).catch(() => ({ data: [] })),
        financeApi.subsystemGuestPayments({ search: searchTerm }).catch(() => ({ data: [] })),
        financeApi.subsystemPayroll({ department: deptFilter !== 'All' ? deptFilter : '', status: statusFilter !== 'All' ? statusFilter : '', search: searchTerm }).catch(() => ({ data: [] })),
        financeApi.subsystemDamages({ search: searchTerm }).catch(() => ({ data: [] }))
      ])

      setSummary(sumRes.data || sumRes || null)
      setDtrList(dtrRes.data || dtrRes || [])
      setBudgetList(budgetRes.data || budgetRes || [])
      setGuestPaymentsList(payRes.data || payRes || [])
      setPayrollList(prRes.data || prRes || [])
      setDamagesList(dmgRes.data || dmgRes || [])
    } catch (err) {
      if (!silent) {
        console.error('Failed to load cross-subsystem data:', err)
        showToast?.('Error loading cross-subsystem data.')
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [deptFilter, statusFilter, searchTerm, showToast])

  useEffect(() => {
    loadData(false)
  }, [loadData])

  useEffect(() => {
    if (autoSyncTick > 0) {
      loadData(true)
    }
  }, [autoSyncTick, loadData])

  async function handleBudgetDecision(id, decision) {
    if (!isChecker) {
      showToast?.('Only Department Heads or Finance Admins can decide budget requests.')
      return
    }
    setSubmittingDecision(true)
    try {
      const res = await financeApi.decideBudgetRequest(id, {
        decision,
        approvedAmount: decisionAmount ? Number(decisionAmount) : undefined,
        notes: decisionNotes,
      })
      showToast?.(`Budget request ${res.data?.requestCode || id} marked as ${decision}.`)
      setSelectedBudgetReq(null)
      setDecisionNotes('')
      setDecisionAmount('')
      loadData()
    } catch (err) {
      console.error('Failed to update budget decision:', err)
      showToast?.(err.message || 'Error updating budget decision.')
    } finally {
      setSubmittingDecision(false)
    }
  }

  const dtrPage = usePagination(dtrList, 10, `${deptFilter}|${searchTerm}`)
  const payrollPage = usePagination(payrollList, 10, `${deptFilter}|${statusFilter}|${searchTerm}`)
  const budgetPage = usePagination(budgetList, 10, `${deptFilter}|${statusFilter}|${searchTerm}`)
  const guestPaymentsPage = usePagination(guestPaymentsList, 10, searchTerm)
  const damagesPage = usePagination(damagesList, 10, searchTerm)

  const departments = [
    'All',
    'Front Office',
    'Housekeeping',
    'Engineering & Maintenance',
    'Finance & Accounting',
    'Sales & Marketing',
    'Human Resources',
  ]

  return (
    <div className="subsystem-hub-view">
      {/* Top Header & Overview */}
      <div className="view-header" style={{ marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 6px 0', color: '#1e293b' }}>
            Cross-Subsystem Operational &amp; Financial Hub
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
            Consolidated live telemetry across Front Office, Housekeeping, Engineering, Sales, and HR. Monitored by Finance operations.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="button button-secondary"
            onClick={loadData}
            style={{ fontSize: '13px', minHeight: '36px', padding: '0 14px' }}
          >
            ↻ Refresh Subsystem Data
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="metric-strip subhub-metric-strip" style={{ marginBottom: '24px' }}>
        {/* Card 1: DTR & Night Diff */}
        <div className="card" style={{ padding: '16px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Staff Duty &amp; Night Diff
          </span>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#0f172a', margin: '8px 0 4px 0' }}>
            {summary?.dtr?.totalNightDiffHours || '0'} <span style={{ fontSize: '14px', fontWeight: 500, color: '#64748b' }}>ND hrs</span>
          </div>
          <div style={{ fontSize: '12.5px', color: '#475569' }}>
            <strong>{summary?.dtr?.activeStaffOnDuty || 0}</strong> staff on duty • {summary?.dtr?.totalRegularHours || 0} regular hrs
          </div>
        </div>

        {/* Card 2: Consolidated Payroll */}
        <div className="card" style={{ padding: '16px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            All-Subsystem Payroll
          </span>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#0f172a', margin: '8px 0 4px 0' }}>
            ₱{Number(summary?.payroll?.totalPayrollPayable || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '12.5px', color: '#475569' }}>
            <strong>{summary?.payroll?.totalPayrollStaff || 0}</strong> staff across 6 hotel departments
          </div>
        </div>

        {/* Card 3: Department Budget Requests */}
        <div className="card" style={{ padding: '16px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Dept Budget Requests
          </span>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#0f172a', margin: '8px 0 4px 0' }}>
            ₱{Number(summary?.budget?.totalRequestedBudget || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '12.5px', color: '#475569' }}>
            <span style={{ color: '#d97706', fontWeight: 600 }}>{summary?.budget?.pendingBudgetReviews || 0} pending review</span> • ₱{Number(summary?.budget?.totalApprovedBudget || 0).toLocaleString('en-PH')} approved
          </div>
        </div>

        {/* Card 4: Front Office Guest Collections */}
        <div className="card" style={{ padding: '16px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Front Office Collections
          </span>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#059669', margin: '8px 0 4px 0' }}>
            ₱{Number(summary?.payments?.totalGuestCollections || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '12.5px', color: '#475569' }}>
            <strong>{summary?.payments?.totalPaymentTransactions || 0}</strong> folio payments recorded
          </div>
        </div>

        {/* Card 5: Room Damage Findings */}
        <div className="card" style={{ padding: '16px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Damage &amp; Incident Billing
          </span>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#dc2626', margin: '8px 0 4px 0' }}>
            ₱{Number(summary?.damages?.totalDamageCost || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '12.5px', color: '#475569' }}>
            <strong>{summary?.damages?.totalDamageIncidents || 0}</strong> HK findings • {summary?.damages?.pendingDamageBillings || 0} pending folio billing
          </div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="filter-tabs" role="tablist" style={{ marginBottom: '16px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '8px' }}>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'dtr'}
          className={activeTab === 'dtr' ? 'active' : ''}
          onClick={() => setActiveTab('dtr')}
          style={{ fontSize: '13.5px', padding: '10px 16px', fontWeight: activeTab === 'dtr' ? 600 : 500 }}
        >
          ⏰ Staff DTR &amp; Night Diff ({dtrList.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'payroll'}
          className={activeTab === 'payroll' ? 'active' : ''}
          onClick={() => setActiveTab('payroll')}
          style={{ fontSize: '13.5px', padding: '10px 16px', fontWeight: activeTab === 'payroll' ? 600 : 500 }}
        >
          👥 All-Subsystem Payroll ({payrollList.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'budget'}
          className={activeTab === 'budget' ? 'active' : ''}
          onClick={() => setActiveTab('budget')}
          style={{ fontSize: '13.5px', padding: '10px 16px', fontWeight: activeTab === 'budget' ? 600 : 500 }}
        >
          📑 Department Budget Requests ({budgetList.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'guestPayments'}
          className={activeTab === 'guestPayments' ? 'active' : ''}
          onClick={() => setActiveTab('guestPayments')}
          style={{ fontSize: '13.5px', padding: '10px 16px', fontWeight: activeTab === 'guestPayments' ? 600 : 500 }}
        >
          💳 Front Office Guest Payments ({guestPaymentsList.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'damages'}
          className={activeTab === 'damages' ? 'active' : ''}
          onClick={() => setActiveTab('damages')}
          style={{ fontSize: '13.5px', padding: '10px 16px', fontWeight: activeTab === 'damages' ? 600 : 500 }}
        >
          🛠️ Room Damage &amp; Folio Charges ({damagesList.length})
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="subhub-filter-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginBottom: '16px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <div style={{ flex: '1 1 240px', minWidth: '180px' }}>
          <input
            type="text"
            className="input"
            placeholder="Search employee, folio, item, code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', fontSize: '13px', padding: '8px 12px' }}
          />
        </div>

        {(activeTab === 'dtr' || activeTab === 'payroll' || activeTab === 'budget') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: '1 1 auto' }}>
            <label style={{ fontSize: '12.5px', fontWeight: 500, color: '#475569', whiteSpace: 'nowrap' }}>Department:</label>
            <select
              className="select"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              style={{ fontSize: '13px', padding: '6px 10px', minWidth: '160px', flex: '1 1 auto' }}
            >
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        )}

        {activeTab === 'budget' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: '1 1 auto' }}>
            <label style={{ fontSize: '12.5px', fontWeight: 500, color: '#475569', whiteSpace: 'nowrap' }}>Status:</label>
            <select
              className="select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ fontSize: '13px', padding: '6px 10px', minWidth: '130px', flex: '1 1 auto' }}
            >
              <option value="All">All Statuses</option>
              <option value="PENDING_REVIEW">Pending Review</option>
              <option value="APPROVED">Approved</option>
              <option value="DISBURSED">Disbursed</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
          Loading live cross-subsystem telemetry...
        </div>
      ) : (
        <>
          {/* TAB 1: DTR & NIGHT DIFFERENTIALS */}
          {activeTab === 'dtr' && (
            <div className="table-responsive card" style={{ padding: 0, overflowX: 'auto' }}>
              <div style={{ padding: '12px 16px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: '760px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  Daily Time Records (DTR) &amp; Night Differential Ingestion (PH DOLE 10% ND Rule)
                </span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Showing {dtrList.length} shift attendance records
                </span>
              </div>
              <table className="table" style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px' }}>Employee</th>
                    <th style={{ padding: '10px 14px' }}>Department &amp; Role</th>
                    <th style={{ padding: '10px 14px' }}>Duty Date &amp; Shift</th>
                    <th style={{ padding: '10px 14px' }}>Time In / Out</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Reg Hrs</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>OT Hrs</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', background: '#fef3c7', color: '#92400e' }}>Night Diff Hrs</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', background: '#fef3c7', color: '#92400e' }}>ND Premium (₱)</th>
                    <th style={{ padding: '10px 14px' }}>Duty Status</th>
                    <th style={{ padding: '10px 14px' }}>Duty Post / Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {dtrList.length === 0 ? (
                    <tr>
                      <td colSpan="10" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                        No DTR records found matching filter.
                      </td>
                    </tr>
                  ) : (
                    dtrPage.rows.map((row) => (
                      <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <strong style={{ color: '#0f172a' }}>{row.employeeName}</strong>
                          <div style={{ fontSize: '11.5px', color: '#64748b' }}>{row.employeeId}</div>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div>{row.department}</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{row.roleTitle}</div>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div>{new Date(row.dutyDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                          <div style={{ fontSize: '11.5px', color: '#475569', fontWeight: 500 }}>{row.shiftName}</div>
                        </td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '12.5px' }}>
                          {row.timeIn?.slice(0, 5)} - {row.timeOut?.slice(0, 5)}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>{Number(row.regularHours).toFixed(1)}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: Number(row.overtimeHours) > 0 ? '#b45309' : '#64748b', fontWeight: Number(row.overtimeHours) > 0 ? 600 : 400 }}>
                          {Number(row.overtimeHours).toFixed(1)}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', background: Number(row.nightDiffHours) > 0 ? '#fffbeb' : 'transparent', fontWeight: Number(row.nightDiffHours) > 0 ? 700 : 400, color: Number(row.nightDiffHours) > 0 ? '#b45309' : '#94a3b8' }}>
                          {Number(row.nightDiffHours).toFixed(1)} hrs
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', background: Number(row.nightDiffHours) > 0 ? '#fffbeb' : 'transparent', fontWeight: 600, color: Number(row.nightDiffHours) > 0 ? '#b45309' : '#94a3b8' }}>
                          ₱{Number(row.nightDiffPay || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span
                            className="badge"
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              background: row.dutyStatus === 'OVERTIME' ? '#fef3c7' : row.dutyStatus === 'COMPLETED' ? '#dcfce7' : '#e0e7ff',
                              color: row.dutyStatus === 'OVERTIME' ? '#92400e' : row.dutyStatus === 'COMPLETED' ? '#166534' : '#3730a3',
                            }}
                          >
                            {row.dutyStatus}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', minWidth: '220px' }}>
                          <div style={{ fontWeight: 500, color: '#334155' }}>{row.dutyPost}</div>
                          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }} title={row.notes}>
                            {row.notes}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <Pagination {...dtrPage.paginationProps} itemLabel="attendance records" />
            </div>
          )}

          {/* TAB 2: ALL-SUBSYSTEM PAYROLL */}
          {activeTab === 'payroll' && (
            <div className="table-responsive card" style={{ padding: 0, overflowX: 'auto' }}>
              <div style={{ padding: '12px 16px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: '780px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  Cross-Subsystem Consolidated Payroll Matrix (Statutory SSS, PhilHealth, Pag-IBIG, W/Tax)
                </span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Showing {payrollList.length} payroll calculations
                </span>
              </div>
              <table className="table" style={{ width: '100%', minWidth: '780px', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px' }}>Payroll Code</th>
                    <th style={{ padding: '10px 14px' }}>Employee &amp; Dept</th>
                    <th style={{ padding: '10px 14px' }}>Role</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Reg / OT Hrs</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Basic Pay</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>OT Pay</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Gross Pay</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', color: '#b91c1c' }}>Deductions</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', background: '#ecfdf5', color: '#047857' }}>Net Payable</th>
                    <th style={{ padding: '10px 14px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollList.length === 0 ? (
                    <tr>
                      <td colSpan="10" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                        No payroll records found.
                      </td>
                    </tr>
                  ) : (
                    payrollPage.rows.map((p) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '12px', fontWeight: 600, color: '#0369a1' }}>
                          {p.payrollCode}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <strong style={{ color: '#0f172a' }}>{p.employeeName}</strong>
                          <div style={{ fontSize: '11.5px', color: '#64748b' }}>{p.department} ({p.employeeId})</div>
                        </td>
                        <td style={{ padding: '10px 14px', color: '#475569' }}>{p.roleTitle}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          {Number(p.regularHours).toFixed(0)}h / {Number(p.overtimeHours).toFixed(0)}h
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          ₱{Number(p.basicPay).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          ₱{Number(p.overtimePay).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>
                          ₱{Number(p.grossPay).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: '#b91c1c' }}>
                          -₱{Number(p.totalDeductions).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                            SSS:{p.sssDeduction} • PH:{p.philhealthDeduction} • HDMF:{p.pagibigDeduction}
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', background: '#ecfdf5', fontWeight: 700, color: '#047857' }}>
                          ₱{Number(p.netPayable).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span
                            className="badge"
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              background: p.status === 'DISBURSED' ? '#dcfce7' : p.status === 'APPROVED' ? '#dbeafe' : '#fef3c7',
                              color: p.status === 'DISBURSED' ? '#166534' : p.status === 'APPROVED' ? '#1e40af' : '#92400e',
                            }}
                          >
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <Pagination {...payrollPage.paginationProps} itemLabel="payroll records" />
            </div>
          )}

          {/* TAB 3: DEPARTMENT BUDGET REQUESTS */}
          {activeTab === 'budget' && (
            <div className="table-responsive card" style={{ padding: 0, overflowX: 'auto' }}>
              <div style={{ padding: '12px 16px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: '780px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  Subsystem Capital &amp; Operational Budget Requests (CapEx / OpEx / Equipment / Supplies)
                </span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  {budgetList.filter((b) => b.status === 'PENDING_REVIEW').length} pending Department Head approval
                </span>
              </div>
              <table className="table" style={{ width: '100%', minWidth: '780px', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px' }}>Request Code</th>
                    <th style={{ padding: '10px 14px' }}>Department</th>
                    <th style={{ padding: '10px 14px' }}>Category &amp; Priority</th>
                    <th style={{ padding: '10px 14px' }}>Title &amp; Justification</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Requested</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Approved</th>
                    <th style={{ padding: '10px 14px' }}>Status</th>
                    <th style={{ padding: '10px 14px' }}>Requested By</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {budgetList.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                        No budget requests found matching filter.
                      </td>
                    </tr>
                  ) : (
                    budgetPage.rows.map((req) => (
                      <tr key={req.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600, color: '#0284c7' }}>
                          {req.requestCode}
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{req.fiscalPeriod}</div>
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 500, color: '#1e293b' }}>
                          {req.department}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontSize: '11.5px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, color: '#475569' }}>
                            {req.category}
                          </span>
                          <div style={{ marginTop: '3px' }}>
                            <span
                              style={{
                                fontSize: '10.5px',
                                padding: '1px 5px',
                                borderRadius: '3px',
                                fontWeight: 700,
                                background: req.priority === 'CRITICAL' ? '#fee2e2' : req.priority === 'HIGH' ? '#fef3c7' : '#e0e7ff',
                                color: req.priority === 'CRITICAL' ? '#b91c1c' : req.priority === 'HIGH' ? '#b45309' : '#3730a3',
                              }}
                            >
                              {req.priority}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px', minWidth: '240px' }}>
                          <strong style={{ color: '#0f172a' }}>{req.title}</strong>
                          <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>{req.purpose}</div>
                          {req.justification && (
                            <div style={{ fontSize: '11.5px', color: '#64748b', fontStyle: 'italic', marginTop: '4px' }}>
                              Justification: {req.justification}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>
                          ₱{Number(req.requestedAmount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: Number(req.approvedAmount) > 0 ? '#059669' : '#94a3b8', fontWeight: 600 }}>
                          ₱{Number(req.approvedAmount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span
                            className="badge"
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              background: req.status === 'DISBURSED' ? '#dcfce7' : req.status === 'APPROVED' ? '#dbeafe' : req.status === 'PENDING_REVIEW' ? '#fef3c7' : '#fee2e2',
                              color: req.status === 'DISBURSED' ? '#166534' : req.status === 'APPROVED' ? '#1e40af' : req.status === 'PENDING_REVIEW' ? '#92400e' : '#991b1b',
                            }}
                          >
                            {req.status === 'PENDING_REVIEW' ? 'Pending Review' : req.status}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: '12px' }}>
                          <div>{req.requestedBy}</div>
                          <div style={{ color: '#94a3b8', fontSize: '11px' }}>
                            {new Date(req.requestedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          {isChecker && req.status === 'PENDING_REVIEW' ? (
                            <button
                              type="button"
                              className="button button-primary"
                              style={{ fontSize: '12px', padding: '4px 10px', minHeight: '28px' }}
                              onClick={() => {
                                setSelectedBudgetReq(req)
                                setDecisionAmount(req.requestedAmount)
                              }}
                            >
                              Review &amp; Decide
                            </button>
                          ) : isChecker && req.status === 'APPROVED' ? (
                            <button
                              type="button"
                              className="button button-secondary"
                              style={{ fontSize: '11.5px', padding: '3px 8px', minHeight: '26px' }}
                              onClick={() => handleBudgetDecision(req.id, 'DISBURSED')}
                            >
                              Disburse Funds
                            </button>
                          ) : (
                            <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <Pagination {...budgetPage.paginationProps} itemLabel="budget requests" />
            </div>
          )}

          {/* TAB 4: FRONT OFFICE GUEST PAYMENTS */}
          {activeTab === 'guestPayments' && (
            <div className="table-responsive card" style={{ padding: 0, overflowX: 'auto' }}>
              <div style={{ padding: '12px 16px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: '780px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  Front Office Guest Folio Settlements &amp; Direct Counter Payments
                </span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Showing {guestPaymentsList.length} guest payments
                </span>
              </div>
              <table className="table" style={{ width: '100%', minWidth: '780px', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px' }}>Payment ID / Ref</th>
                    <th style={{ padding: '10px 14px' }}>Guest Name</th>
                    <th style={{ padding: '10px 14px' }}>Room &amp; Reservation</th>
                    <th style={{ padding: '10px 14px' }}>Folio Invoice #</th>
                    <th style={{ padding: '10px 14px' }}>Payment Method</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Amount Paid</th>
                    <th style={{ padding: '10px 14px' }}>Folio Status</th>
                    <th style={{ padding: '10px 14px' }}>Date &amp; Time</th>
                  </tr>
                </thead>
                <tbody>
                  {guestPaymentsList.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                        No guest payments found matching query.
                      </td>
                    </tr>
                  ) : (
                    guestPaymentsPage.rows.map((pmt) => (
                      <tr key={pmt.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                            PMT-#{pmt.id}
                          </span>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{pmt.reference}</div>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <strong style={{ color: '#0f172a' }}>{pmt.guestName || 'Walk-in Guest'}</strong>
                          {pmt.guestEmail && <div style={{ fontSize: '11.5px', color: '#64748b' }}>{pmt.guestEmail}</div>}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          {pmt.roomNumber ? (
                            <span style={{ fontWeight: 600, color: '#0f172a' }}>Room {pmt.roomNumber}</span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>N/A</span>
                          )}
                          {pmt.reservationCode && (
                            <div style={{ fontSize: '11px', color: '#0284c7', fontFamily: 'monospace' }}>
                              {pmt.reservationCode}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#0369a1', fontWeight: 500 }}>
                          {pmt.invoiceNumber}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span
                            className="badge"
                            style={{
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              background: pmt.paymentMethod === 'CARD' ? '#dbeafe' : pmt.paymentMethod === 'CASH' ? '#dcfce7' : '#f3e8ff',
                              color: pmt.paymentMethod === 'CARD' ? '#1e40af' : pmt.paymentMethod === 'CASH' ? '#166534' : '#6b21a8',
                            }}
                          >
                            {pmt.paymentMethod}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                          ₱{Number(pmt.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span
                            className="badge"
                            style={{
                              padding: '2px 6px',
                              borderRadius: '3px',
                              fontSize: '11px',
                              fontWeight: 600,
                              background: pmt.invoiceStatus === 'PAID' ? '#dcfce7' : '#fef3c7',
                              color: pmt.invoiceStatus === 'PAID' ? '#166534' : '#92400e',
                            }}
                          >
                            {pmt.invoiceStatus}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: '12px', color: '#64748b' }}>
                          {new Date(pmt.paidAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <Pagination {...guestPaymentsPage.paginationProps} itemLabel="guest payments" />
            </div>
          )}

          {/* TAB 5: ROOM DAMAGE CHARGES & INCIDENTS */}
          {activeTab === 'damages' && (
            <div className="table-responsive card" style={{ padding: 0, overflowX: 'auto' }}>
              <div style={{ padding: '12px 16px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: '780px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  Housekeeping Incident Findings &amp; Guest Folio Restitution Charges
                </span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Showing {damagesList.length} incident findings
                </span>
              </div>
              <table className="table" style={{ width: '100%', minWidth: '780px', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px' }}>Incident Code</th>
                    <th style={{ padding: '10px 14px' }}>Room # &amp; Guest</th>
                    <th style={{ padding: '10px 14px' }}>Reservation Ref</th>
                    <th style={{ padding: '10px 14px' }}>Damaged Item &amp; Details</th>
                    <th style={{ padding: '10px 14px' }}>Category</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Estimated Cost</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Billed Amount</th>
                    <th style={{ padding: '10px 14px' }}>Billing Status</th>
                    <th style={{ padding: '10px 14px' }}>Reported By</th>
                  </tr>
                </thead>
                <tbody>
                  {damagesList.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                        No damage records found.
                      </td>
                    </tr>
                  ) : (
                    damagesPage.rows.map((dmg) => (
                      <tr key={dmg.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600, color: '#dc2626' }}>
                          {dmg.incidentCode}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <strong style={{ color: '#0f172a' }}>Room {dmg.roomNumber}</strong>
                          <div style={{ fontSize: '12px', color: '#475569' }}>{dmg.guestName}</div>
                        </td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '12px', color: '#0284c7' }}>
                          {dmg.reservationCode || '—'}
                        </td>
                        <td style={{ padding: '10px 14px', minWidth: '240px' }}>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>{dmg.damagedItem}</div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{dmg.description}</div>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontSize: '11px', background: '#fee2e2', color: '#991b1b', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            {dmg.damageCategory}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>
                          ₱{Number(dmg.estimatedCost).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: Number(dmg.billedAmount) > 0 ? '#059669' : '#94a3b8' }}>
                          ₱{Number(dmg.billedAmount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span
                            className="badge"
                            style={{
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              background: dmg.billingStatus === 'BILLED_TO_FOLIO' ? '#dcfce7' : '#fef3c7',
                              color: dmg.billingStatus === 'BILLED_TO_FOLIO' ? '#166534' : '#92400e',
                            }}
                          >
                            {dmg.billingStatus}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: '12px', color: '#64748b' }}>
                          <div>{dmg.reportedBy}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {new Date(dmg.reportedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <Pagination {...damagesPage.paginationProps} itemLabel="damage records" />
            </div>
          )}
        </>
      )}

      {/* Department Head Budget Approval Modal */}
      {selectedBudgetReq && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '14px' }}>
          <div className="modal-card" style={{ background: '#fff', borderRadius: '12px', maxWidth: '520px', width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 600, color: '#0f172a' }}>
              Review Subsystem Budget Request
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
              Maker-Checker Department Head sign-off for inter-department capital and operational requests.
            </p>

            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#64748b' }}>Request Code:</span>
                <strong>{selectedBudgetReq.requestCode}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#64748b' }}>Department:</span>
                <strong>{selectedBudgetReq.department}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#64748b' }}>Title:</span>
                <span>{selectedBudgetReq.title}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Requested Amount:</span>
                <strong style={{ color: '#059669', fontSize: '15px' }}>
                  ₱{Number(selectedBudgetReq.requestedAmount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </strong>
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Approved Amount (₱):
              </label>
              <input
                type="number"
                className="input"
                value={decisionAmount}
                onChange={(e) => setDecisionAmount(e.target.value)}
                style={{ width: '100%', fontSize: '13.5px', padding: '8px 12px' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Review Notes / Sign-off Justification:
              </label>
              <textarea
                className="input"
                rows="3"
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder="Enter justification for approval or rejection..."
                style={{ width: '100%', fontSize: '13px', padding: '8px 12px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setSelectedBudgetReq(null)}
                disabled={submittingDecision}
                style={{ fontSize: '13px', padding: '8px 14px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button"
                style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', fontSize: '13px', padding: '8px 14px' }}
                onClick={() => handleBudgetDecision(selectedBudgetReq.id, 'REJECTED')}
                disabled={submittingDecision}
              >
                Reject Request
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={() => handleBudgetDecision(selectedBudgetReq.id, 'APPROVED')}
                disabled={submittingDecision}
                style={{ fontSize: '13px', padding: '8px 16px' }}
              >
                {submittingDecision ? 'Approving...' : 'Approve Budget'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
