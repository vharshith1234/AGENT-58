import { useRef, useState } from 'react'
import {
  DashboardShell,
  Panel,
  Stat,
  sectionId,
  useApiData,
  refreshShellSession,
} from '../components/DashboardShell'
import { PersonAvatar, StatusPill } from '../components/PersonAvatar'
import { api, apiBlob, apiUpload } from '../lib/api'
import { authService } from '../lib/auth'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function FacultyDashboard() {
  const session = authService.getSession()
  const me = useApiData(() => api<any>('/faculty/me/workload'))
  const corrections = useApiData(() => api<any[]>('/faculty/me/corrections'))
  const [category, setCategory] = useState('Teaching hours')
  const [description, setDescription] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const b = me.data?.breakdown
  const faculty = me.data?.faculty
  const photoUrl = faculty?.photoUrl ?? session?.user.photoUrl

  async function verify() {
    try {
      await api('/faculty/me/verify', {
        method: 'POST',
        body: JSON.stringify({ note: 'Verified by faculty' }),
      })
      setMessage('Workload verified.')
      await me.reload()
    } catch (e: any) {
      setMessage(e.message || 'Verify failed')
    }
  }

  async function downloadPdf() {
    try {
      const blob = await apiBlob('/faculty/me/statement.pdf')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'workload-statement.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setMessage(e.message || 'PDF download failed')
    }
  }

  async function submitCorrection(e: React.FormEvent) {
    e.preventDefault()
    try {
      await api('/faculty/me/corrections', {
        method: 'POST',
        body: JSON.stringify({
          issueCategory: category,
          description,
          targetRole: 'HOD',
        }),
      })
      setDescription('')
      setMessage('Correction submitted.')
      await corrections.reload()
    } catch (err: any) {
      setMessage(err.message || 'Submit failed')
    }
  }

  async function onPhotoSelected(file: File | null) {
    if (!file) return
    setPhotoBusy(true)
    try {
      const fd = new FormData()
      fd.append('photo', file)
      const updated = await apiUpload<{ photoUrl: string }>('/faculty/me/photo', fd)
      authService.patchSessionUser({ photoUrl: updated.photoUrl })
      refreshShellSession()
      setMessage('Profile photo updated.')
      await me.reload()
    } catch (err: any) {
      setMessage(err.message || 'Photo upload failed')
    } finally {
      setPhotoBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function removePhoto() {
    setPhotoBusy(true)
    try {
      await api('/faculty/me/photo', { method: 'DELETE' })
      authService.patchSessionUser({ photoUrl: null })
      refreshShellSession()
      setMessage('Profile photo removed.')
      await me.reload()
    } catch (err: any) {
      setMessage(err.message || 'Could not remove photo')
    } finally {
      setPhotoBusy(false)
    }
  }

  return (
    <DashboardShell role="FACULTY">
      {message && <div className="alert-banner">{message}</div>}

      <div className="stat-grid" id={sectionId('My Workload')}>
        <Stat label="Total Workload" value={b ? b.total.toFixed(2) : '—'} />
        <Stat label="Status" value={b?.status ?? '—'} />
        <Stat label="Norm Band" value={b ? `${b.normMin}–${b.normMax}` : '—'} />
        <Stat label="Expected" value={b?.normExpected ?? '—'} />
      </div>

      <Panel title="My profile photo" id={sectionId('My Profile')}>
        <div className="profile-photo-editor">
          <PersonAvatar
            name={faculty?.name || session?.user.name || 'Faculty'}
            email={faculty?.email || session?.user.email}
            photoUrl={photoUrl}
            size="lg"
          />
          <div className="profile-photo-actions">
            <p>
              Upload a clear photo of yourself. JPG, PNG, or WebP — max 3 MB.
              Cartoon placeholders are no longer used.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={photoBusy}
                onClick={() => fileRef.current?.click()}
              >
                {photoUrl ? 'Change photo' : 'Add photo'}
              </button>
              {photoUrl ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={photoBusy}
                  onClick={() => void removePhoto()}
                >
                  Remove
                </button>
              ) : null}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => void onPhotoSelected(e.target.files?.[0] || null)}
            />
          </div>
        </div>
      </Panel>

      <Panel
        title="My workload statement"
        id={sectionId('Workload Statement')}
        action={
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            <button type="button" className="btn btn-primary" onClick={() => void verify()}>
              Verify
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => void downloadPdf()}>
              PDF statement
            </button>
          </div>
        }
      >
        {faculty && (
          <div className="person-cell" style={{ marginBottom: '1rem' }}>
            <PersonAvatar
              name={faculty.name}
              email={faculty.email || session?.user.email}
              photoUrl={photoUrl}
              size="lg"
            />
            <div className="person-meta">
              <strong>
                {faculty.name} · {faculty.facultyCode}
              </strong>
              <span>
                {faculty.designation} · {faculty.department?.name}
              </span>
            </div>
          </div>
        )}
        {me.loading && <p className="empty-state">Loading…</p>}
        {me.error && (
          <p className="empty-state" style={{ color: '#b91c1c' }}>
            {me.error}
          </p>
        )}
        {b && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Component</th>
                <th>Weighted hours</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Teaching{b.provisionalTeaching ? ' (provisional)' : ''}</td>
                <td>{b.teachingWeighted.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Projects</td>
                <td>{b.projectsWeighted.toFixed(2)}</td>
              </tr>
              <tr>
                <td>PhD</td>
                <td>{b.phdWeighted.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Committees</td>
                <td>{b.committeeWeighted.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Research</td>
                <td>{b.researchWeighted.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Admin</td>
                <td>{b.adminWeighted.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </Panel>

      <div className="grid-2">
        <Panel title="My courses" id={sectionId('My Courses')}>
          {(me.data?.allocations || []).length === 0 && (
            <p className="empty-state">No course allocations yet.</p>
          )}
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.875rem' }}>
            {(me.data?.allocations || []).map((a: any) => (
              <li key={a.id} style={{ marginBottom: '0.35rem' }}>
                <strong>{a.course?.code}</strong> {a.course?.name} · {a.hours}h
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="My projects" id={sectionId('My Projects')}>
          {(me.data?.projects || []).length === 0 && (
            <p className="empty-state">No projects assigned.</p>
          )}
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.875rem' }}>
            {(me.data?.projects || []).map((p: any) => (
              <li key={p.id} style={{ marginBottom: '0.35rem' }}>
                <strong>{p.title}</strong> · {p.level} · {p.studentCount} students
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="My timetable" id={sectionId('My Timetable')}>
        {(me.data?.timetable || []).length === 0 && (
          <p className="empty-state">No timetable slots yet.</p>
        )}
        {(me.data?.timetable || []).length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Time</th>
                <th>Course</th>
                <th>Room</th>
              </tr>
            </thead>
            <tbody>
              {(me.data?.timetable || []).map((t: any) => (
                <tr key={t.id}>
                  <td>{DAYS[t.dayOfWeek] ?? t.dayOfWeek}</td>
                  <td>
                    {t.startTime}–{t.endTime}
                  </td>
                  <td>
                    {t.course?.code} {t.course?.name}
                  </td>
                  <td>{t.room || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <div className="grid-2" id={sectionId('Corrections')}>
        <Panel title="Request correction">
          <form
            style={{ display: 'grid', gap: '0.75rem' }}
            onSubmit={(e) => void submitCorrection(e)}
          >
            <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>
              Category
              <select
                className="field-control"
                style={{ width: '100%', marginTop: '0.35rem' }}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option>Teaching hours</option>
                <option>Project credit</option>
                <option>Admin role</option>
                <option>Other</option>
              </select>
            </label>
            <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>
              Description
              <textarea
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{
                  width: '100%',
                  marginTop: '0.35rem',
                  border: '1px solid #d5dee8',
                  borderRadius: '0.7rem',
                  padding: '0.75rem',
                }}
              />
            </label>
            <button type="submit" className="btn btn-primary" style={{ justifySelf: 'start' }}>
              Submit
            </button>
          </form>
        </Panel>

        <Panel title="My corrections">
          {(corrections.data || []).length === 0 && (
            <p className="empty-state">No requests yet.</p>
          )}
          <div style={{ display: 'grid', gap: '0.65rem' }}>
            {(corrections.data || []).map((c) => (
              <div
                key={c.id}
                style={{
                  border: '1px solid #d5dee8',
                  borderRadius: '0.75rem',
                  padding: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <StatusPill status={c.status} />
                  <strong style={{ fontSize: '0.85rem' }}>{c.issueCategory}</strong>
                </div>
                <p className="empty-state" style={{ marginTop: '0.35rem' }}>
                  {c.description}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </DashboardShell>
  )
}
