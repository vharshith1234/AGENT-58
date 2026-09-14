import { useEffect, useRef, useState } from 'react'
import { PageHeader, refreshShellSession } from '../components/DashboardShell'
import { resolvePhotoUrl, StatusPill } from '../components/PersonAvatar'
import { api, apiDelete, apiUpload } from '../lib/api'
import { authService } from '../lib/auth'
import { ROLE_CONFIGS, type AppRole } from '../lib/roles'

type ProfileExtras = {
  researchInterestsList?: string[]
  teachingEngagements?: string[]
  academicExperienceList?: Array<{ org: string; from: string; to: string }>
  educationList?: Array<{ degree: string; year: string }>
}

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
  profileExtras?: ProfileExtras | null
  officialProfileUrl?: string | null
  dataSource?: string | null
  additionalDepartments?: Array<{ name: string; code: string }>
  administrativeRoles?: Array<{ role: string; scope?: string | null }>
  role: string
}

type WorkloadBrief = {
  total?: number
  status?: string
  teachingWeighted?: number
  projectsWeighted?: number
  researchWeighted?: number
  adminWeighted?: number
  normMin?: number
  normExpected?: number
  normMax?: number
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function ChipList({ items }: { items: string[] }) {
  if (!items.length) return <p className="empty-state">—</p>
  return (
    <ul className="profile-chip-list">
      {items.map((item) => (
        <li key={item} className="profile-chip">
          {item}
        </li>
      ))}
    </ul>
  )
}

function TimelineList({
  rows,
}: {
  rows: Array<{ title: string; meta: string }>
}) {
  if (!rows.length) return <p className="empty-state">—</p>
  return (
    <ul className="profile-timeline">
      {rows.map((row) => (
        <li key={`${row.title}-${row.meta}`}>
          <strong>{row.title}</strong>
          <span>{row.meta}</span>
        </li>
      ))}
    </ul>
  )
}

export function ProfilePage({ role }: { role: AppRole }) {
  const session = authService.getSession()
  const [profile, setProfile] = useState<ProfileMe | null>(null)
  const [workload, setWorkload] = useState<WorkloadBrief | null>(null)
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    designation: '',
    departmentName: '',
    specialization: '',
    qualification: '',
    employeeId: '',
    facultyCode: '',
    employmentType: '',
    joiningDate: '',
    researchInterests: '',
    teachingEngagements: '',
    academicExperience: '',
    education: '',
    officialProfileUrl: '',
  })
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function profileToForm(me: ProfileMe) {
    const extras = me.profileExtras || {}
    const research =
      extras.researchInterestsList?.join('\n') || me.researchInterests || ''
    const teaching = (extras.teachingEngagements || []).join('\n')
    const experience =
      extras.academicExperienceList
        ?.map((e) =>
          e.from || e.to ? `${e.org} (${e.from}${e.to ? ` – ${e.to}` : ''})` : e.org,
        )
        .join('\n') ||
      me.academicExperience ||
      ''
    const education =
      extras.educationList
        ?.map((e) => (e.year ? `${e.degree} (${e.year})` : e.degree))
        .join('\n') ||
      me.education ||
      ''
    return {
      name: me.name || '',
      email: me.email || '',
      phone: me.phone || '',
      designation: me.designation || '',
      departmentName: me.departmentName || '',
      specialization: me.specialization || '',
      qualification: me.qualification || '',
      employeeId: me.employeeId || '',
      facultyCode: me.facultyCode || '',
      employmentType: me.employmentType || '',
      joiningDate: me.joiningDate ? String(me.joiningDate).slice(0, 10) : '',
      researchInterests: research,
      teachingEngagements: teaching,
      academicExperience: experience,
      education,
      officialProfileUrl: me.officialProfileUrl || '',
    }
  }

  function applyProfile(me: ProfileMe) {
    setProfile(me)
    setForm(profileToForm(me))
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
      if (role === 'FACULTY' || role === 'HOD') {
        try {
          const wl = await api<any>('/faculty/me/workload')
          const snap = wl?.breakdown || wl?.latestSnapshot || wl?.snapshot || wl
          setWorkload({
            total: snap?.total,
            status: snap?.status,
            teachingWeighted: snap?.teachingWeighted,
            projectsWeighted: snap?.projectsWeighted,
            researchWeighted: snap?.researchWeighted,
            adminWeighted: snap?.adminWeighted,
            normMin: snap?.normMin,
            normExpected: snap?.normExpected,
            normMax: snap?.normMax,
          })
        } catch {
          setWorkload(null)
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
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          designation: form.designation.trim() || undefined,
          departmentName: form.departmentName.trim() || undefined,
          specialization: form.specialization.trim() || undefined,
          qualification: form.qualification.trim() || undefined,
          employeeId: form.employeeId.trim() || undefined,
          facultyCode: form.facultyCode.trim() || undefined,
          employmentType: form.employmentType.trim() || undefined,
          joiningDate: form.joiningDate.trim() || undefined,
          researchInterests: form.researchInterests,
          teachingEngagements: form.teachingEngagements,
          academicExperience: form.academicExperience,
          education: form.education,
          officialProfileUrl: form.officialProfileUrl.trim() || undefined,
          profileExtras: {
            teachingEngagements: form.teachingEngagements
              .split(/\n|;|·/)
              .map((s) => s.trim())
              .filter(Boolean),
          },
        }),
      })
      applyProfile(updated)
      setEditing(false)
      setMessage('Profile saved successfully.')
    } catch (err: any) {
      setMessage(err.message || 'Could not save profile')
    } finally {
      setBusy(false)
    }
  }

  function cancelEdit() {
    if (!profile) return
    setForm(profileToForm(profile))
    setEditing(false)
  }

  function patchForm(partial: Partial<typeof form>) {
    setForm((f) => ({ ...f, ...partial }))
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
  const extras = profile.profileExtras || {}
  const research =
    extras.researchInterestsList ||
    (profile.researchInterests
      ? profile.researchInterests.split(/\n|;|·/).map((s) => s.trim()).filter(Boolean)
      : [])
  const teaching = extras.teachingEngagements || []
  const experience =
    extras.academicExperienceList?.map((e) => ({
      title: e.org,
      meta: `${e.from} – ${e.to}`,
    })) ||
    (profile.academicExperience
      ? profile.academicExperience.split('\n').filter(Boolean).map((line) => ({
          title: line,
          meta: '',
        }))
      : [])
  const education =
    extras.educationList?.map((e) => ({ title: e.degree, meta: e.year })) ||
    (profile.education
      ? profile.education.split('\n').filter(Boolean).map((line) => ({
          title: line,
          meta: '',
        }))
      : [])

  return (
    <>
      <PageHeader
        title="My Profile"
        subtitle="Official profile details and editable contact information."
        action={
          <button type="button" className="btn btn-primary" onClick={() => setEditing(true)}>
            Edit Profile
          </button>
        }
      />
      {message && <div className="alert-banner">{message}</div>}

      <section className="profile-hero-card profile-hero-rich">
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
            <i className="fa-solid fa-camera" aria-hidden />
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
          <h2 className="profile-hero-name">{profile.name}</h2>
          <p className="profile-hero-title">{designation}</p>
          <p className="profile-hero-dept">
            {profile.departmentName || '—'}
            {profile.specialization ? ` · ${profile.specialization}` : ''}
          </p>
          <div className="profile-hero-contacts">
            <span>
              <i className="fa-solid fa-envelope" aria-hidden /> {profile.email}
            </span>
            {profile.phone ? (
              <span>
                <i className="fa-solid fa-phone" aria-hidden /> {profile.phone}
              </span>
            ) : null}
          </div>
          <div className="profile-hero-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              Change photo
            </button>
            {photoSrc ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy}
                onClick={() => void removePhoto()}
              >
                Remove photo
              </button>
            ) : null}
          </div>
        </div>

        {workload?.status ? (
          <div className="profile-workload-badge">
            <span className="profile-workload-label">Current workload</span>
            <strong>{workload.total ?? '—'}</strong>
            <StatusPill status={workload.status} />
            <span className="profile-workload-norm">
              Norm {workload.normMin}–{workload.normMax} (exp. {workload.normExpected})
            </span>
          </div>
        ) : null}
      </section>

      {workload?.status ? (
        <div className="profile-load-grid">
          <article className="profile-load-card">
            <span>Teaching</span>
            <strong>{workload.teachingWeighted ?? 0}</strong>
          </article>
          <article className="profile-load-card">
            <span>Projects</span>
            <strong>{workload.projectsWeighted ?? 0}</strong>
          </article>
          <article className="profile-load-card">
            <span>Research</span>
            <strong>{workload.researchWeighted ?? 0}</strong>
          </article>
          <article className="profile-load-card">
            <span>Admin</span>
            <strong>{workload.adminWeighted ?? 0}</strong>
          </article>
        </div>
      ) : null}

      <div className="profile-section-grid">
        <section className="panel profile-section-card">
          <div className="panel-head">
            <h2>Research Interests</h2>
          </div>
          <ChipList items={research} />
        </section>

        <section className="panel profile-section-card">
          <div className="panel-head">
            <h2>Teaching Engagements</h2>
          </div>
          <ChipList items={teaching} />
        </section>

        <section className="panel profile-section-card">
          <div className="panel-head">
            <h2>Academic Experience</h2>
          </div>
          <TimelineList rows={experience} />
        </section>

        <section className="panel profile-section-card">
          <div className="panel-head">
            <h2>Education</h2>
          </div>
          <TimelineList rows={education} />
        </section>
      </div>

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
            <dt>Employee ID</dt>
            <dd>{profile.employeeId || '—'}</dd>
          </div>
          <div>
            <dt>Faculty ID</dt>
            <dd>{profile.facultyCode || '—'}</dd>
          </div>
          <div>
            <dt>Qualification</dt>
            <dd>{profile.qualification || '—'}</dd>
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
            <dt>Official directory</dt>
            <dd>
              {profile.officialProfileUrl ? (
                <a href={profile.officialProfileUrl} target="_blank" rel="noreferrer">
                  View on vignan.ac.in
                </a>
              ) : (
                '—'
              )}
            </dd>
          </div>
        </dl>
      </section>

      {editing ? (
        <div
          className="profile-modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) cancelEdit()
          }}
        >
          <div
            className="profile-modal profile-modal-wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-profile-title"
          >
            <h3 id="edit-profile-title">Edit Profile</h3>
            <form className="profile-edit-form" onSubmit={(e) => void save(e)}>
              <div className="profile-edit-grid">
                <label className="field-label">
                  <span>Full name</span>
                  <input
                    className="dash-input"
                    value={form.name}
                    onChange={(e) => patchForm({ name: e.target.value })}
                    required
                    minLength={2}
                    autoFocus
                  />
                </label>
                <label className="field-label">
                  <span>Email</span>
                  <input
                    className="dash-input"
                    type="email"
                    value={form.email}
                    onChange={(e) => patchForm({ email: e.target.value })}
                    required
                  />
                </label>
                <label className="field-label">
                  <span>Phone / contact</span>
                  <input
                    className="dash-input"
                    value={form.phone}
                    onChange={(e) => patchForm({ phone: e.target.value })}
                  />
                </label>
                <label className="field-label">
                  <span>Designation</span>
                  <input
                    className="dash-input"
                    value={form.designation}
                    onChange={(e) => patchForm({ designation: e.target.value })}
                  />
                </label>
                <label className="field-label">
                  <span>Department</span>
                  <input
                    className="dash-input"
                    value={form.departmentName}
                    onChange={(e) => patchForm({ departmentName: e.target.value })}
                  />
                </label>
                <label className="field-label">
                  <span>Specialization</span>
                  <input
                    className="dash-input"
                    value={form.specialization}
                    onChange={(e) => patchForm({ specialization: e.target.value })}
                  />
                </label>
                <label className="field-label">
                  <span>Qualification</span>
                  <input
                    className="dash-input"
                    value={form.qualification}
                    onChange={(e) => patchForm({ qualification: e.target.value })}
                  />
                </label>
                <label className="field-label">
                  <span>Employee ID</span>
                  <input
                    className="dash-input"
                    value={form.employeeId}
                    onChange={(e) => patchForm({ employeeId: e.target.value })}
                  />
                </label>
                <label className="field-label">
                  <span>Faculty ID</span>
                  <input
                    className="dash-input"
                    value={form.facultyCode}
                    onChange={(e) => patchForm({ facultyCode: e.target.value })}
                  />
                </label>
                <label className="field-label">
                  <span>Employment type</span>
                  <input
                    className="dash-input"
                    value={form.employmentType}
                    onChange={(e) => patchForm({ employmentType: e.target.value })}
                  />
                </label>
                <label className="field-label">
                  <span>Joining date</span>
                  <input
                    className="dash-input"
                    type="date"
                    value={form.joiningDate}
                    onChange={(e) => patchForm({ joiningDate: e.target.value })}
                  />
                </label>
                <label className="field-label">
                  <span>Official profile URL</span>
                  <input
                    className="dash-input"
                    value={form.officialProfileUrl}
                    onChange={(e) => patchForm({ officialProfileUrl: e.target.value })}
                    placeholder="https://vignan.ac.in/..."
                  />
                </label>
              </div>

              <label className="field-label">
                <span>Research interests (one per line)</span>
                <textarea
                  className="dash-input profile-edit-textarea"
                  value={form.researchInterests}
                  onChange={(e) => patchForm({ researchInterests: e.target.value })}
                  rows={3}
                />
              </label>
              <label className="field-label">
                <span>Teaching engagements (one per line)</span>
                <textarea
                  className="dash-input profile-edit-textarea"
                  value={form.teachingEngagements}
                  onChange={(e) => patchForm({ teachingEngagements: e.target.value })}
                  rows={3}
                />
              </label>
              <label className="field-label">
                <span>Academic experience (one per line)</span>
                <textarea
                  className="dash-input profile-edit-textarea"
                  value={form.academicExperience}
                  onChange={(e) => patchForm({ academicExperience: e.target.value })}
                  rows={3}
                />
              </label>
              <label className="field-label">
                <span>Education (one per line)</span>
                <textarea
                  className="dash-input profile-edit-textarea"
                  value={form.education}
                  onChange={(e) => patchForm({ education: e.target.value })}
                  rows={3}
                />
              </label>

              <div className="profile-modal-actions">
                <button type="button" className="btn btn-secondary" onClick={cancelEdit} disabled={busy}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
