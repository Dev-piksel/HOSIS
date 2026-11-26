import { useState, useEffect, useCallback } from 'react'
import { financeApi } from '../financeApi.js'

function formatPHP(val) {
  return '₱' + Number(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDateTime(val) {
  if (!val) return '—'
  return new Date(val).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function MethodBadge({ method, reference }) {
  const m = (method || '').replace(/_/g, ' ')
  const isEwallet = /gcash|maya|e-wallet|ewallet/i.test(m) || /gcash|maya/i.test(reference || '')
  const c =
    /cash/i.test(m) ? { bg: '#f0fdf4', color: '#16a34a' } :
    /card/i.test(m) ? { bg: '#eff6ff', color: '#1d4ed8' } :
    isEwallet ? { bg: '#faf5ff', color: '#7c3aed' } :
    /transfer|bank/i.test(m) ? { bg: '#fff7ed', color: '#c2410c' } :
    { bg: '#f1f5f9', color: '#475569' }
  const label = m === 'OTHER' && /gcash/i.test(reference || '') ? 'OTHER (GCASH)' :
                m === 'OTHER' && /maya/i.test(reference || '') ? 'OTHER (MAYA)' :
                m === 'OTHER' ? 'OTHER PAYMENTS' : (m || '—')
  return (
    <span style={{ padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color }}>
      {label}
    </span>
  )
}

function StatusBadge({ status }) {
  const s = (status || '').replace(/_/g, ' ')
  const c =
    /paid|completed/i.test(s) ? { bg: '#dcfce7', color: '#15803d' } :
    /part/i.test(s) ? { bg: '#fff7ed', color: '#c2410c' } :
    /void/i.test(s) ? { bg: '#fee2e2', color: '#dc2626' } :
    { bg: '#f1f5f9', color: '#475569' }
  return <span style={{ padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color }}>{s}</span>
}

// ─── Finance Payments Tab ────────────────────────────────────────────────────
function FinancePaymentsTab({ user, showToast, autoSyncTick }) {
  const [payments, setPayments] = useState([])
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [method, setMethod] = useState('All')

  // Record Payment Form
  const [showForm, setShowForm] = useState(false)
  const [selInvId, setSelInvId] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('CASH')
  const [payRef, setPayRef] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [pRes, iRes] = await Promise.all([
        financeApi.payments(search, method !== 'All' ? method : '', ''),
        financeApi.invoices('', 'ISSUED', ''),
      ])
      setPayments(pRes.data || pRes || [])
      setInvoices((iRes.data || iRes || []).filter(i => i.balanceDue > 0))
    } finally {
      setLoading(false)
    }
  }, [search, method])

  useEffect(() => { load(true) }, [autoSyncTick, load])

  const selectedInv = invoices.find(i => String(i.id) === String(selInvId))

  async function handleRecord(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await financeApi.createPayment({
        invoiceId: Number(selInvId),
        amount: Number(payAmount),
        paymentMethod: payMethod,
        reference: payRef || undefined,
        notes: payNotes || undefined,
      })
      showToast('✅ Payment recorded.')
      setShowForm(false); setSelInvId(''); setPayAmount(''); setPayRef(''); setPayNotes('')
      load()
    } catch (err) {
      showToast('⚠️ ' + (err.message || 'Failed to record payment.'))
    } finally {
      setSubmitting(false)
    }
  }

  const total = payments.reduce((s, p) => s + Number(p.amount || 0), 0)
  const methods = ['All', 'CASH', 'CARD', 'GCASH', 'MAYA', 'BANK_TRANSFER', 'CHECK']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Finance Payment Ledger</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{payments.length} payment{payments.length !== 1 ? 's' : ''} · Total collected: <strong>{formatPHP(total)}</strong></div>
        </div>
        <button className="button button-primary" onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          Record Payment
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input className="search-box" placeholder="Search guest, invoice, reference…" value={search}
          onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} style={{ flex: '1 1 200px' }} />
        <select className="select-filter" value={method} onChange={e => setMethod(e.target.value)}>
          {methods.map(m => <option key={m}>{m}</option>)}
        </select>
      </div>

      <div className="surface data-surface" style={{ overflow: 'auto' }}>
        {loading ? <p style={{ padding: 20, color: '#64748b' }}>Loading…</p> : (
          payments.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>💳</div>
              <p style={{ margin: 0 }}>No finance payments found</p>
            </div>
          ) : (
            <table className="full-table">
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Invoice</th>
                  <th>Guest / Client</th>
                  <th>Room</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Reference</th>
                  <th>Date & Time</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id}>
                    <td><code style={{ fontSize: 11 }}>{p.receiptCode || `#${p.id}`}</code></td>
                    <td><code style={{ fontSize: 11 }}>{p.invoiceCode || '—'}</code></td>
                    <td>{p.guestName || '—'}</td>
                    <td>{p.roomNumber || '—'}</td>
                    <td><MethodBadge method={p.paymentMethod} reference={p.reference} /></td>
                    <td style={{ fontWeight: 700, color: '#16a34a' }}>{formatPHP(p.amount)}</td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>{p.reference || '—'}</td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>{formatDateTime(p.paidAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>

      {/* Record Payment Modal */}
      {showForm && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}
        >
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Record Payment</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#64748b' }}>✕</button>
            </div>
            <form onSubmit={handleRecord} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Invoice *</label>
                <select className="select-filter" style={{ width: '100%' }} value={selInvId} required
                  onChange={e => { setSelInvId(e.target.value); const inv = invoices.find(i => String(i.id) === e.target.value); setPayAmount(inv ? String(inv.balanceDue) : '') }}>
                  <option value="">— Select invoice —</option>
                  {invoices.map(i => (
                    <option key={i.id} value={i.id}>{i.invoiceCode || `INV-${i.id}`} · {i.guestName} · Balance: {formatPHP(i.balanceDue)}</option>
                  ))}
                </select>
                {selectedInv && (
                  <div style={{ marginTop: 6, padding: '8px 12px', background: '#f0fdf4', borderRadius: 6, fontSize: 12, color: '#15803d' }}>
                    Balance due: <strong>{formatPHP(selectedInv.balanceDue)}</strong> · Room {selectedInv.roomNumber || 'N/A'}
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Amount (₱) *</label>
                  <input className="search-box" style={{ width: '100%' }} type="number" min="0.01" step="0.01"
                    value={payAmount} required onChange={e => setPayAmount(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Method *</label>
                  <select className="select-filter" style={{ width: '100%' }} value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                    <option value="CASH">CASH (Cash Only)</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Reference / Receipt No.</label>
                <input className="search-box" style={{ width: '100%' }} value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="e.g. transaction ID, check no." />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Notes</label>
                <input className="search-box" style={{ width: '100%' }} value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="Optional notes" />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" className="button button-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="button button-primary" disabled={submitting}>{submitting ? 'Recording…' : 'Record Payment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Front Office / Guest Payments Tab ───────────────────────────────────────
function GuestPaymentsTab({ autoSyncTick }) {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [method, setMethod] = useState('All')

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await financeApi.subsystemGuestPayments({ search: search.trim(), method: method !== 'All' ? method : '' })
      setPayments(res.data || res || [])
    } finally {
      setLoading(false)
    }
  }, [search, method])

  useEffect(() => { load(true) }, [autoSyncTick, load])

  const total = payments.reduce((s, p) => s + Number(p.amount || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Front Office Guest Payments</div>
        <div style={{ fontSize: 12, color: '#64748b' }}>{payments.length} record{payments.length !== 1 ? 's' : ''} · Total: <strong>{formatPHP(total)}</strong></div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input className="search-box" placeholder="Search guest name, room, invoice…" value={search}
          onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} style={{ flex: '1 1 200px' }} />
        <select className="select-filter" value={method} onChange={e => setMethod(e.target.value)}>
          <option value="All">All</option>
          <option value="CASH">CASH</option>
          <option value="CARD">CARD</option>
          <option value="BANK_TRANSFER">BANK_TRANSFER</option>
          <option value="OTHER">OTHER PAYMENTS (GCash, Maya)</option>
          <option value="CHECK">CHECK</option>
        </select>
        <button className="button button-secondary" onClick={() => load()}>Refresh</button>
      </div>

      <div className="surface data-surface" style={{ overflow: 'auto' }}>
        {loading ? <p style={{ padding: 20, color: '#64748b' }}>Loading…</p> : (
          payments.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🧾</div>
              <p style={{ margin: 0 }}>No guest payments found</p>
            </div>
          ) : (
            <table className="full-table">
              <thead>
                <tr>
                  <th>Guest Name</th>
                  <th>Room</th>
                  <th>Reservation</th>
                  <th>Invoice</th>
                  <th>Inv. Status</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Reference</th>
                  <th>Date & Time</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.guestName || '—'}</td>
                    <td>{p.roomNumber || '—'}</td>
                    <td><code style={{ fontSize: 11 }}>{p.reservationCode || '—'}</code></td>
                    <td><code style={{ fontSize: 11 }}>{p.invoiceNumber || '—'}</code></td>
                    <td><StatusBadge status={p.invoiceStatus} /></td>
                    <td><MethodBadge method={p.paymentMethod} reference={p.reference} /></td>
                    <td style={{ fontWeight: 700, color: '#16a34a' }}>{formatPHP(p.amount)}</td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>{p.reference || '—'}</td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>{formatDateTime(p.paidAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  )
}

// ─── Main Unified Component ──────────────────────────────────────────────────
export default function UnifiedPaymentsView({ user, showToast, autoSyncTick = 0 }) {
  const [activeTab, setActiveTab] = useState('finance')

  const tabs = [
    { id: 'finance', label: '💳 Finance Payments' },
    { id: 'guest', label: '🧾 Front Office / Guest Payments' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Payments</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
          All payment records in one place — Finance invoices and Front Office guest collections.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e2e8f0', paddingBottom: 0 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '8px 20px',
              borderRadius: '8px 8px 0 0',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeTab === t.id ? 700 : 500,
              background: activeTab === t.id ? '#fff' : 'transparent',
              color: activeTab === t.id ? '#1e40af' : '#64748b',
              borderBottom: activeTab === t.id ? '2px solid #1e40af' : '2px solid transparent',
              marginBottom: -2,
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'finance' && <FinancePaymentsTab user={user} showToast={showToast} autoSyncTick={autoSyncTick} />}
      {activeTab === 'guest' && <GuestPaymentsTab autoSyncTick={autoSyncTick} />}
    </div>
  )
}
