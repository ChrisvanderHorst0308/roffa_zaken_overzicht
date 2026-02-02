export type UserRole = 'admin' | 'recruiter' | 'reichskanzlier' | 'fletcher_admin'

export interface Profile {
  id: string
  name: string
  nickname: string | null
  profile_picture_url: string | null
  role: UserRole
  active: boolean
  created_at: string
}

export interface Project {
  id: string
  name: string
  active: boolean
  created_at: string
}

export interface RecruiterProject {
  id: string
  recruiter_id: string
  project_id: string
}

export interface Location {
  id: string
  name: string
  city: string
  address: string | null
  website: string | null
  pos_system: string | null
  latitude: number | null
  longitude: number | null
  created_at: string
}

export type VisitStatus = 'visited' | 'interested' | 'demo_planned' | 'not_interested' | 'potential' | 'already_client'

export interface Visit {
  id: string
  recruiter_id: string
  project_id: string
  location_id: string
  pos_system: string
  spoken_to: string
  takeaway: boolean
  delivery: boolean
  takeaway_platforms: string | null
  delivery_platforms: string | null
  notes: string | null
  status: VisitStatus
  visit_date: string
  created_at: string
}

export interface VisitWithRelations extends Visit {
  location: Location
  project: Project
  recruiter: Profile
}

/* ============================================
   Fletcher APK v2 Types
   ============================================ */

export type FletcherApkRunStatus = 'draft' | 'submitted'

export interface FletcherApkRun {
  id: string
  location_id: string
  created_by: string
  status: FletcherApkRunStatus
  open_q1_knelpunten: string | null
  open_q2_meerwaarde: string | null
  errors: string | null
  meeting_notes: string | null
  section_notes: Record<string, string> | null
  created_at: string
  updated_at: string
}

export interface FletcherApkRunWithRelations extends FletcherApkRun {
  location: Location
  creator: Profile
  check_items?: FletcherApkCheckItem[]
  todos?: FletcherApkTodo[]
  apk_errors?: FletcherApkError[]
}

export interface FletcherApkCheckItem {
  id: string
  run_id: string
  item_key: string
  section: string
  label: string
  checked: boolean
  note: string | null
  updated_at: string
}

export interface FletcherApkTodo {
  id: string
  run_id: string
  text: string
  done: boolean
  created_at: string
  updated_at: string
}

export interface FletcherApkError {
  id: string
  run_id: string
  text: string
  resolved: boolean
  created_at: string
  updated_at: string
}

/* Checklist definition structure */
export interface FletcherChecklistSection {
  key: string
  title: string
  items: FletcherChecklistItem[]
}

export interface FletcherChecklistItem {
  key: string
  label: string
}
