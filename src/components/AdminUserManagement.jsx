import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'
import {
  createUserRequest,
  deleteUserRequest,
  listUsersRequest,
  resetUserPasswordRequest,
  updateUserRequest,
} from '../auth/authApi.js'
import { getSessionToken } from '../auth/sessionStore.js'
import AdminBilling from './AdminBilling.jsx'
import './AdminUserManagement.css'

const EMPTY_FORM = {
  email: '',
  username: '',
  password: '',
  confirmPassword: '',
  role: 'stylist',
  demo: false,
}

export default function AdminUserManagement() {
  const { user, logout, changePassword } = useAuth()
  const [tab, setTab] = useState('users')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editForm, setEditForm] = useState(null)
  const [resetPassword, setResetPassword] = useState({
    newPassword: '',
    confirmPassword: '',
  })
  const [saving, setSaving] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await listUsersRequest(getSessionToken())
      setUsers(result.users || [])
    } catch (err) {
      setError(err.message || 'Unable to load users.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  function openEdit(entry) {
    setShowAdd(false)
    setMessage('')
    setError('')
    setResetPassword({ newPassword: '', confirmPassword: '' })
    setEditForm({
      id: entry.id,
      email: entry.email || '',
      username: entry.username || '',
      role: entry.role || 'stylist',
      status: entry.status === 'disabled' ? 'disabled' : 'active',
      demo: Boolean(entry.demo),
      salonAccess: Boolean(entry.salonAccess),
    })
  }

  function closeEdit() {
    setEditForm(null)
    setResetPassword({ newPassword: '', confirmPassword: '' })
  }

  async function handleCreate(event) {
    event.preventDefault()
    setMessage('')
    setError('')
    if (form.password !== form.confirmPassword) {
      setError('Password confirmation does not match.')
      return
    }
    setSaving(true)
    try {
      await createUserRequest(
        {
          email: form.email.trim(),
          username: (form.username || form.email).trim(),
          password: form.password,
          confirmPassword: form.confirmPassword,
          role: form.role,
          demo: Boolean(form.demo),
        },
        getSessionToken(),
      )
      setForm(EMPTY_FORM)
      setShowAdd(false)
      setMessage('User created.')
      await loadUsers()
    } catch (err) {
      setError(err.message || 'Unable to create user.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveEdit(event) {
    event.preventDefault()
    if (!editForm?.id) return
    setMessage('')
    setError('')
    setSaving(true)
    try {
      const result = await updateUserRequest(
        editForm.id,
        {
          email: editForm.email.trim(),
          username: editForm.username.trim(),
          role: editForm.role,
          status: editForm.status,
          demo: Boolean(editForm.demo),
          salonAccess: Boolean(editForm.salonAccess) || Boolean(editForm.demo),
        },
        getSessionToken(),
      )
      setMessage(
        result.stripeEmailSynced
          ? `Updated ${result.user.username}. Stripe billing email synchronized.`
          : `Updated ${result.user.username}.`,
      )
      closeEdit()
      await loadUsers()
    } catch (err) {
      setError(err.message || 'Unable to update user.')
    } finally {
      setSaving(false)
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault()
    if (!editForm?.id) return
    setMessage('')
    setError('')
    if (resetPassword.newPassword !== resetPassword.confirmPassword) {
      setError('Password confirmation does not match.')
      return
    }
    setSaving(true)
    try {
      const result = await resetUserPasswordRequest(
        editForm.id,
        resetPassword,
        getSessionToken(),
      )
      setResetPassword({ newPassword: '', confirmPassword: '' })
      setMessage(result.message || `Temporary password set for ${editForm.username}.`)
      await loadUsers()
    } catch (err) {
      setError(err.message || 'Unable to reset password.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(target) {
    if (!window.confirm(`Delete user “${target.username}”? This cannot be undone.`)) {
      return
    }
    setMessage('')
    setError('')
    try {
      await deleteUserRequest(target.id, getSessionToken())
      if (editForm?.id === target.id) closeEdit()
      setMessage(`Deleted ${target.username}.`)
      await loadUsers()
    } catch (err) {
      setError(err.message || 'Unable to delete user.')
    }
  }

  async function handlePasswordChange(event) {
    event.preventDefault()
    setMessage('')
    setError('')
    setSaving(true)
    try {
      await changePassword(passwordForm)
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
      setMessage('Password updated.')
    } catch (err) {
      setError(err.message || 'Unable to change password.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-users">
      <header className="admin-users__header">
        <div>
          <h1 className="admin-users__title">Simple Salon Administration</h1>
          <p className="admin-users__subtitle">
            {tab === 'billing' ? 'Manage subscriptions' : 'Manage user accounts'}
          </p>
        </div>
        <button type="button" className="admin-users__signout" onClick={logout}>
          Sign out
        </button>
      </header>

      <div className="admin-users__tabs" role="tablist" aria-label="Admin sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'users'}
          className={`admin-users__tab${tab === 'users' ? ' is-active' : ''}`}
          onClick={() => setTab('users')}
        >
          Users
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'billing'}
          className={`admin-users__tab${tab === 'billing' ? ' is-active' : ''}`}
          onClick={() => setTab('billing')}
        >
          Billing
        </button>
      </div>

      {tab === 'billing' ? <AdminBilling /> : null}

      {tab === 'users' && message ? (
        <p className="admin-users__message">{message}</p>
      ) : null}
      {tab === 'users' && error ? (
        <p className="admin-users__error">{error}</p>
      ) : null}

      {tab === 'users' ? (
        <>
          <div className="admin-users__toolbar">
            <button
              type="button"
              className="admin-users__add"
              onClick={() => {
                closeEdit()
                setShowAdd((value) => !value)
              }}
            >
              <Plus size={18} strokeWidth={2.25} aria-hidden="true" />
              Add User
            </button>
          </div>

          {showAdd ? (
            <form className="admin-users__form" onSubmit={handleCreate}>
              <label>
                <span>Email</span>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => {
                    const email = e.target.value
                    setForm((prev) => ({
                      ...prev,
                      email,
                      username: prev.username || email,
                    }))
                  }}
                />
              </label>
              <label>
                <span>Username</span>
                <input
                  type="text"
                  required
                  value={form.username}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, username: e.target.value }))
                  }
                />
              </label>
              <label>
                <span>Password</span>
                <input
                  type="password"
                  required
                  minLength={5}
                  value={form.password}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, password: e.target.value }))
                  }
                />
              </label>
              <label>
                <span>Confirm Password</span>
                <input
                  type="password"
                  required
                  minLength={5}
                  value={form.confirmPassword}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                  }
                />
              </label>
              <label>
                <span>Role</span>
                <select
                  value={form.role}
                  onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                >
                  <option value="stylist">Stylist</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              {form.role === 'stylist' ? (
                <label className="admin-users__checkbox">
                  <input
                    type="checkbox"
                    checked={Boolean(form.demo)}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, demo: e.target.checked }))
                    }
                  />
                  <span>Demo account (isolated sample data)</span>
                </label>
              ) : null}
              <button type="submit" disabled={saving}>
                {saving ? 'Creating…' : 'Create user'}
              </button>
            </form>
          ) : null}

          {editForm ? (
            <div className="admin-users__edit-panel">
              <h2 className="admin-users__edit-title">Edit user</h2>
              <form className="admin-users__form" onSubmit={handleSaveEdit}>
                <label>
                  <span>Username</span>
                  <input
                    type="text"
                    required
                    minLength={2}
                    value={editForm.username}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, username: e.target.value }))
                    }
                  />
                </label>
                <label>
                  <span>Email address</span>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, email: e.target.value }))
                    }
                  />
                </label>
                <label>
                  <span>Role</span>
                  <select
                    value={editForm.role}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, role: e.target.value }))
                    }
                  >
                    <option value="stylist">Stylist</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <label>
                  <span>Account status</span>
                  <select
                    value={editForm.status}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, status: e.target.value }))
                    }
                  >
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </label>
                {editForm.role === 'stylist' ? (
                  <>
                    <label className="admin-users__checkbox">
                      <input
                        type="checkbox"
                        checked={Boolean(editForm.demo)}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            demo: e.target.checked,
                            salonAccess: e.target.checked
                              ? true
                              : prev.salonAccess,
                          }))
                        }
                      />
                      <span>Demo account (isolated sample data)</span>
                    </label>
                    <label className="admin-users__checkbox">
                      <input
                        type="checkbox"
                        checked={Boolean(editForm.salonAccess)}
                        disabled={Boolean(editForm.demo)}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            salonAccess: e.target.checked,
                          }))
                        }
                      />
                      <span>Salon data access</span>
                    </label>
                  </>
                ) : null}
                <div className="admin-users__edit-actions">
                  <button type="submit" disabled={saving}>
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    className="admin-users__cancel"
                    onClick={closeEdit}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </div>
              </form>

              <form className="admin-users__form admin-users__reset" onSubmit={handleResetPassword}>
                <h3 className="admin-users__reset-title">Reset password</h3>
                <p className="admin-users__reset-help">
                  Sets a temporary password. Existing sessions are revoked and the user
                  must change it on next login.
                </p>
                <label>
                  <span>New temporary password</span>
                  <input
                    type="password"
                    required
                    minLength={5}
                    autoComplete="new-password"
                    value={resetPassword.newPassword}
                    onChange={(e) =>
                      setResetPassword((prev) => ({
                        ...prev,
                        newPassword: e.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Confirm password</span>
                  <input
                    type="password"
                    required
                    minLength={5}
                    autoComplete="new-password"
                    value={resetPassword.confirmPassword}
                    onChange={(e) =>
                      setResetPassword((prev) => ({
                        ...prev,
                        confirmPassword: e.target.value,
                      }))
                    }
                  />
                </label>
                <button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Reset Password'}
                </button>
              </form>
            </div>
          ) : null}

          <section className="admin-users__list" aria-label="Users">
            {loading ? <p className="admin-users__empty">Loading users…</p> : null}
            {!loading && users.length === 0 ? (
              <p className="admin-users__empty">No users found.</p>
            ) : null}
            <ul>
              {users.map((entry) => (
                <li key={entry.id} className="admin-users__row">
                  <div>
                    <p className="admin-users__name">{entry.username}</p>
                    <p className="admin-users__meta">
                      {entry.email} · {entry.role}
                      {entry.demo ? ' · demo' : ''} · {entry.status}
                    </p>
                  </div>
                  <div className="admin-users__row-actions">
                    <button
                      type="button"
                      className="admin-users__edit"
                      onClick={() => openEdit(entry)}
                      aria-label={`Edit ${entry.username}`}
                    >
                      <Pencil size={18} strokeWidth={2.25} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="admin-users__delete"
                      onClick={() => handleDelete(entry)}
                      disabled={entry.id === user?.id}
                      aria-label={`Delete ${entry.username}`}
                    >
                      <Trash2 size={18} strokeWidth={2.25} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="admin-users__password">
            <h2>Change your password</h2>
            <form onSubmit={handlePasswordChange}>
              <label>
                <span>Current password</span>
                <input
                  type="password"
                  required
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({
                      ...prev,
                      currentPassword: e.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>New password</span>
                <input
                  type="password"
                  required
                  minLength={5}
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))
                  }
                />
              </label>
              <label>
                <span>Confirm password</span>
                <input
                  type="password"
                  required
                  minLength={5}
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({
                      ...prev,
                      confirmPassword: e.target.value,
                    }))
                  }
                />
              </label>
              <button type="submit" disabled={saving}>
                Update password
              </button>
            </form>
          </section>
        </>
      ) : null}
    </div>
  )
}
