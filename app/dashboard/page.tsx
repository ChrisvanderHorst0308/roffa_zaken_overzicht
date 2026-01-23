'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { VisitWithRelations, Project, VisitStatus } from '@/types'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function DashboardPage() {
  const [visits, setVisits] = useState<VisitWithRelations[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
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

      if (profile?.role === 'admin' || profile?.role === 'reichskanzlier') {
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
          .order('name')

        if (projectsError) throw projectsError
        setProjects(projectsData || [])
      } else {
        const { data: visitsData, error: visitsError } = await supabase
          .from('visits')
          .select(`
            *,
            location:locations(*),
            project:projects(*)
          `)
          .eq('recruiter_id', user.id)
          .order('visit_date', { ascending: false })

        if (visitsError) throw visitsError
        setVisits(visitsData || [])

        const { data: projectsData, error: projectsError } = await supabase
          .from('projects')
          .select(`
            *,
            recruiter_projects!inner(recruiter_id)
          `)
          .eq('recruiter_projects.recruiter_id', user.id)
          .order('name')

        if (projectsError) throw projectsError
        setProjects(projectsData || [])
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

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <Link
          href="/visits/new"
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          New Visit
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search locations..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project
            </label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Projects</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="visited">Visited</option>
              <option value="interested">Interested</option>
              <option value="demo_planned">Demo Planned</option>
              <option value="not_interested">Not Interested</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Project
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  POS System
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredVisits.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    No visits found
                  </td>
                </tr>
              ) : (
                filteredVisits.map(visit => (
                  <tr
                    key={visit.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/visits/${visit.id}`)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(visit.visit_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {visit.location.name}, {visit.location.city}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {visit.project.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        visit.status === 'interested' ? 'bg-green-100 text-green-800' :
                        visit.status === 'demo_planned' ? 'bg-blue-100 text-blue-800' :
                        visit.status === 'not_interested' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {visit.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {visit.pos_system}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
