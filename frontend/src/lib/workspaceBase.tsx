import { createContext, useContext, type ReactNode } from 'react'

/** Frontend route base for shared HR workspace pages (`/hr`, `/hod`, `/dean`, `/principal`). API paths stay `/hr/...`. */
const WorkspaceBaseContext = createContext('/hr')

export function WorkspaceBaseProvider({
  base,
  children,
}: {
  base: string
  children: ReactNode
}) {
  return <WorkspaceBaseContext.Provider value={base}>{children}</WorkspaceBaseContext.Provider>
}

export function useWorkspaceBase() {
  return useContext(WorkspaceBaseContext)
}

/** HOD / Dean / Principal share HR pages in monitor (view-only) mode. */
export function useIsMonitorWorkspace() {
  return useWorkspaceBase() !== '/hr'
}
