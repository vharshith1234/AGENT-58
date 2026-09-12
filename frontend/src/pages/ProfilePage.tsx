import { useEffect, useRef, useState } from 'react'
import { PageHeader, refreshShellSession } from '../components/DashboardShell'
import { resolvePhotoUrl } from '../components/PersonAvatar'
import { api, apiDelete, apiUpload } from '../lib/api'
import { authService } from '../lib/auth'
import { ROLE_CONFIGS, type AppRole } from '../lib/roles'

type ProfileMe = {
  name: string
  email: string
  photoUrl?: string | null
  designation?: string | null
  departmentName?: string | null
  employeeId?: string | null
  facultyCode?: string | null
  facultyId?: string | null
  phone?: string | null
  qualification?: string | null
  specialization?: string | null
  joiningDate?: string | null
  employmentType?: string | null
  researchInterests?: string | null
  academicExperience?: string | null
  education?: string | null
  officialProfileUrl?: string | null
  dataSource?: string | null
  additionalDepartments?: Array<{ name: string; code: string }>
  administrativeRoles?: Array<{ role: string; scope?: string | null }>
  role: string
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function ProfilePage({ role }: { role: AppRole }) {
  const session = authService.getSession()
  const [profile, setProfile] = useState<ProfileMe | null>(null)
  const [name, setName] = useState(session?.user.name || '')
  const [phone, setPhone] = useState('')
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function applyProfile(me: ProfileMe) {
    setProfile(me)
    setName(me.name)
    setPhone(me.phone || '')
    authService.patchSessionUser({
      name: me.name,
      photoUrl: me.photoUrl,
    })
    refreshShellSession()
  }

  useEffect(() => {
    void (async () => {
      try {
        const me = await api<ProfileMe>('/auth/me')
        applyProfile(me)
      } catch {
        if (session) {
          setProfile({
            name: session.user.name,
            email: session.user.email,
            photoUrl: session.user.photoUrl,
            designation: ROLE_CONFIGS[role].label,
            role: session.user.role,
          })
        }
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      const updated = await api<ProfileMe>('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || undefined }),
      })
      applyProfile(updated)
      setEditing(false)
      setMessage('Profile saved.')
    } catch (err: any) {
      setMessage(err.message || 'Could not save profile')
    } finally {
      setBusy(false)
    }
  }

  async function onPhotoSelected(file: File | null) {
    if (!file) return
    setBusy(true)
    setMessage(null)
    try {
      const fd = new FormData()
      fd.append('photo', file)
      const updated = await apiUpload<ProfileMe>('/auth/me/photo', fd)
      applyProfile(updated)
      setMessage('Profile photo updated.')
    } catch (err: any) {
      setMessage(err.message || 'Photo upload failed')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function removePhoto() {
    setBusy(true)
    setMessage(null)
    try {
      const updated = await apiDelete<ProfileMe>('/auth/me/photo')
      applyProfile(updated)
      setMessage('Profile photo removed.')
    } catch (err: any) {
      setMessage(err.message || 'Could not remove photo')
    } finally {
      setBusy(false)
    }
  }

  if (!session || !profile) {
    return (
      <>
        <PageHeader title="My Profile" />
        <p className="empty-state">Loading profile…</p>
      </>
    )
  }

  const photoSrc = resolvePhotoUrl(profile.photoUrl)
  const designation = profile.designation || ROLE_CONFIGS[role].label

  return (
    <>
      <PageHeader title="My Profile" subtitle="Your account details. Role and department cannot be changed here." />
      {message && <div className="alert-banner">{message}</div>}

      <section className="profile-hero-card">
        <div className="profile-avatar-edit">
          {photoSrc ? (
            <img className="profile-avatar-circle" src={photoSrc} alt={profile.name} />
          ) : (
            <div className="profile-avatar-circle profile-avatar-fallback" aria-label={profile.name}>
              {initials(profile.name)}
            </div>
          )}
          <button
            type="button"
            className="profile-edit-badge"
            aria-label="Change profile photo"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <i className="fa-solid fa-pen" aria-hidden />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => void onPhotoSelected(e.target.files?.[0] || null)}
          />
        </div>

        <div className="profile-hero-meta">
          {editing ? (
            <form className="profile-name-edit" onSubmit={(e) => void save(e)}>
              <input
                className="dash-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                autoFocus
              />
              {profile.facultyId ? (
                <input
                  className="dash-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone"
                />
              ) : null}
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  Save
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setName(profile.name)
                    setPhone(profile.phone || '')
                    setEditing(false)
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <h2 className="profile-hero-name">
              {profile.name}
              <button
                type="button"
                className="profile-name-edit-btn"
                aria-label="Edit profile"
                onClick={() => setEditing(true)}
              >
                <i className="fa-solid fa-pen" aria-hidden />
              </button>
            </h2>
          )}
          <p>{designation}</p>
          <p>{profile.email}</p>
          {photoSrc ? (
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void removePhoto()}>
              Remove photo
            </button>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Account</h2>
        </div>
        <dl className="profile-detail-grid">
          <div>
            <dt>Role</dt>
            <dd>{profile.role}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{profile.email}</dd>
          </div>
          <div>
            <dt>Employee ID</dt>
            <dd>{profile.employeeId || '—'}</dd>
          </div>
          <div>
            <dt>Faculty ID</dt>
            <dd>{profile.facultyCode || '—'}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{profile.phone || '—'}</dd>
          </div>
          <div>
            <dt>Department</dt>
            <dd>{profile.departmentName || '—'}</dd>
          </div>
          <div>
            <dt>Designation</dt>
            <dd>{designation}</dd>
          </div>
          <div>
            <dt>Qualification</dt>
            <dd>{profile.qualification || '—'}</dd>
          </div>
          <div>
            <dt>Specialization</dt>
            <dd>{profile.specialization || '—'}</dd>
          </div>
          <div>
            <dt>Joining Date</dt>
            <dd>{profile.joiningDate ? new Date(profile.joiningDate).toLocaleDateString() : '—'}</dd>
          </div>
          <div>
            <dt>Employment Type</dt>
            <dd>{profile.employmentType || '—'}</dd>
          </div>
          <div>
            <dt>Additional Departments</dt>
            <dd>
              {(profile.additionalDepartments || []).length
                ? profile.additionalDepartments.map((d) => `${d.code} ${d.name}`).join(', ')
                : '—'}
            </dd>
          </div>
          <div>
            <dt>Administrative Roles</dt>
            <dd>
              {(profile.administrativeRoles || []).length
                ? profile.administrativeRoles
                    .map((r) => `${r.role}${r.scope ? ` — ${r.scope}` : ''}`)
                    .join('; ')
                : '—'}
            </dd>
          </div>
          <div>
            <dt>Research Interests</dt>
            <dd>{profile.researchInterests || '—'}</dd>
          </div>
          <div>
            <dt>Academic Experience</dt>
            <dd>{profile.academicExperience || '—'}</dd>
          </div>
          <div>
            <dt>Education</dt>
            <dd>{profile.education || '—'}</dd>
          </div>
          <div>
            <dt>Official Vignan Profile</dt>
            <dd>
              {profile.officialProfileUrl ? (
                <a href={profile.officialProfileUrl} target="_blank" rel="noreferrer">
                  Open directory
                </a>
              ) : (
                '—'
              )}
            </dd>
          </div>
        </dl>
      </section>
    </>
  )
}
