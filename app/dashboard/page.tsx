'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { VisitWithRelations, Project, VisitStatus } from '@/types'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Calendar, MapPin, Briefcase, TrendingUp, FileText } from 'lucide-react'

export default function DashboardPage() {
  const [visits, setVisits] = useState<VisitWithRelations[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [isAdmin, setIsAdmin] = useState(false)
  const router = useRouter()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      const userIsAdmin = profile?.role === 'admin' || profile?.role === 'reichskanzlier' || profile?.role === 'fletcher_admin'
      setIsAdmin(userIsAdmin)

      if (userIsAdmin) {
        const { data: visitsData, error: visitsError } = await supabase
          .from('visits')
          .select(`
            *,
            location:locations(*),
            project:projects(*),
            recruiter:profiles(*)
          `)
          .order('visit_date', { ascending: false })

        if (visitsError) throw visitsError
        setVisits(visitsData || [])

        const { data: projectsData, error: projectsError } = await supabase
          .from('projects')
          .select('*')
          .eq('active', true)
          .order('name')

        if (projectsError) throw projectsError
        setProjects(projectsData || [])
      } else {
        // First get assigned projects
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from('recruiter_projects')
          .select(`
            project_id,
            project:projects(*)
          `)
          .eq('recruiter_id', user.id)

        if (assignmentsError) throw assignmentsError

        const assignedProjects = (assignmentsData || [])
          .map((assignment: any) => assignment.project)
          .filter((p: Project) => p && p.active)
          .sort((a: Project, b: Project) => a.name.localeCompare(b.name))

        setProjects(assignedProjects)

        // Get project IDs for filtering visits
        const projectIds = (assignmentsData || []).map((a: any) => a.project_id)

        if (projectIds.length > 0) {
          // Fetch ALL visits for assigned projects (not just own visits)
          const { data: visitsData, error: visitsError } = await supabase
            .from('visits')
            .select(`
              *,
              location:locations(*),
              project:projects(*),
              recruiter:profiles(id, name, nickname)
            `)
            .in('project_id', projectIds)
            .order('visit_date', { ascending: false })

          if (visitsError) throw visitsError
          setVisits(visitsData || [])
        } else {
          setVisits([])
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const filteredVisits = visits.filter(visit => {
    const matchesSearch = 
      visit.location.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      visit.location.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      visit.notes?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesProject = selectedProject === 'all' || visit.project_id === selectedProject
    const matchesStatus = selectedStatus === 'all' || visit.status === selectedStatus

    return matchesSearch && matchesProject && matchesStatus
  })

  const stats = {
    totalVisits: visits.length,
    interested: visits.filter(v => v.status === 'interested').length,
    demoPlanned: visits.filter(v => v.status === 'demo_planned').length,
    notInterested: visits.filter(v => v.status === 'not_interested').length,
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'interested':
        return 'success'
      case 'potential':
        return 'warning'
      case 'demo_planned':
        return 'info'
      case 'already_client':
        return 'outline'
      case 'not_interested':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Overview of your visits and projects
          </p>
        </div>
        <div className="flex gap-3">
          <Button asChild variant="outline" className="bg-green-50 hover:bg-green-100 border-green-200 text-green-700">
            <Link href="/onboarding">
              Start onboarding
            </Link>
          </Button>
          <Button asChild>
            <Link href="/visits/new">
              <Plus className="mr-2 h-4 w-4" />
              New Visit
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Visits</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalVisits}</div>
            <p className="text-xs text-muted-foreground">All time visits</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Interested</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.interested}</div>
            <p className="text-xs text-muted-foreground">Potential leads</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Demo Planned</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.demoPlanned}</div>
            <p className="text-xs text-muted-foreground">Scheduled demos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Not Interested</CardTitle>
            <TrendingUp className="h-4 w-4 text-red-600 rotate-180" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.notInterested}</div>
            <p className="text-xs text-muted-foreground">Declined</p>
          </CardContent>
        </Card>
      </div>

      {/* Projects */}
      {projects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{isAdmin ? 'All Projects' : 'My Projects'}</CardTitle>
            <CardDescription>Projects you&apos;re working on</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map(project => (
                <Card
                  key={project.id}
                  className="hover:shadow-md transition-shadow cursor-pointer border-2 hover:border-primary/50"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                      <Badge variant={project.active ? 'success' : 'secondary'}>
                        {project.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Briefcase className="h-4 w-4" />
                      <span>{visits.filter(v => v.project_id === project.id).length} visit(s)</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {projects.length === 0 && !isAdmin && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <p className="text-yellow-800">
              You are not assigned to any projects yet. Contact an admin to get assigned to a project.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Visits */}
      <Card>
        <CardHeader>
          <CardTitle>Visits</CardTitle>
          <CardDescription>Manage and track your visits</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search locations..."
                className="pl-10"
              />
            </div>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="all">All Projects</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="all">All Statuses</option>
              <option value="visited">Visited</option>
              <option value="interested">Interested</option>
              <option value="potential">Potential</option>
              <option value="demo_planned">Demo Planned</option>
              <option value="already_client">Already Client</option>
              <option value="not_interested">Not Interested</option>
            </select>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Date</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Location</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Recruiter</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Project</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">POS System</th>
                </tr>
              </thead>
              <tbody>
                {filteredVisits.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="h-24 text-center text-muted-foreground">
                      No visits found
                    </td>
                  </tr>
                ) : (
                  filteredVisits.map(visit => (
                    <tr
                      key={visit.id}
                      className="border-b hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/visits/${visit.id}`)}
                    >
                      <td className="p-4 align-middle">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{new Date(visit.visit_date).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td className="p-4 align-middle">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{visit.location.name}, {visit.location.city}</span>
                        </div>
                      </td>
                      <td className="p-4 align-middle">
                        <span className="text-sm">{visit.recruiter?.nickname || visit.recruiter?.name || 'Unknown'}</span>
                      </td>
                      <td className="p-4 align-middle">
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{visit.project.name}</span>
                        </div>
                      </td>
                      <td className="p-4 align-middle">
                        <Badge variant={getStatusBadgeVariant(visit.status)}>
                          {visit.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="p-4 align-middle text-sm">{visit.pos_system}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-4">
            {filteredVisits.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No visits found
              </div>
            ) : (
              filteredVisits.map(visit => (
                <Card
                  key={visit.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => router.push(`/visits/${visit.id}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-base">{visit.location.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {visit.location.city}
                        </CardDescription>
                      </div>
                      <Badge variant={getStatusBadgeVariant(visit.status)}>
                        {visit.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {new Date(visit.visit_date).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Briefcase className="h-4 w-4" />
                        {visit.project.name}
                      </div>
                      <div className="text-muted-foreground">
                        By: {visit.recruiter?.nickname || visit.recruiter?.name || 'Unknown'}
                      </div>
                      <div className="text-muted-foreground">
                        POS: {visit.pos_system}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
