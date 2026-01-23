export type UserRole = 'admin' | 'recruiter' | 'reichskanzlier'

export interface Profile {
  id: string
  name: string
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
  created_at: string
}

export type VisitStatus = 'visited' | 'interested' | 'demo_planned' | 'not_interested'

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
