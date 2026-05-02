import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import type { Account } from '../../api/types'
import { useAppStore } from '../../store/appStore'
import './AccountDropdown.css'

export function AccountDropdown() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { selectedAccountId, setSelectedAccountId } = useAppStore()

  useEffect(() => {
    api.getAccounts()
      .then(setAccounts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="account-dropdown account-dropdown--loading">Loading accounts…</div>
  if (error) return <div className="account-dropdown account-dropdown--error">{error}</div>

  return (
    <div className="account-dropdown">
      <label className="account-dropdown__label" htmlFor="account-select">Account</label>
      <select
        id="account-select"
        className="account-dropdown__select"
        value={selectedAccountId ?? ''}
        onChange={(e) => setSelectedAccountId(Number(e.target.value))}
      >
        <option value="" disabled>Select account…</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>
    </div>
  )
}
