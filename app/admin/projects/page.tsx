'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Project, Profile, RecruiterProject } from '@/types'
import toast from 'react-hot-toast'

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [recruiters, setRecruiters] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [assignments, setAssignments] = useState<Record<string, string[]>>({})
  const [newProjectName, setNewProjectName] = useState('')
  const router = useRouter()

  useEffect(() => {
    checkAdminAndLoad()
  }, [])

  const checkAdminAndLoad = async () => {
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

      if (!profile || (profile.role !== 'admin' && profile.role !== 'reichskanzlier')) {
        router.push('/dashboard')
        return
      }

      await Promise.all([loadProjects(), loadRecruiters(), loadAssignments()])
    } catch (error: any) {
      toast.error(error.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const loadProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('name')
    
    if (error) throw error
    setProjects(data || [])
  }

  const loadRecruiters = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'recruiter')
      .order('name')
    
    if (error) throw error
    setRecruiters(data || [])
  }

  const loadAssignments = async () => {
    const { data, error } = await supabase
      .from('recruiter_projects')
      .select('*')
    
    if (error) throw error

    const assignmentsMap: Record<string, string[]> = {}
    ;(data || []).forEach((assignment: RecruiterProject) => {
      if (!assignmentsMap[assignment.project_id]) {
        assignmentsMap[assignment.project_id] = []
      }
      assignmentsMap[assignment.project_id].push(assignment.recruiter_id)
    })
    setAssignments(assignmentsMap)
  }

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      toast.error('Project name is required')
      return
    }

    try {
      const { error } = await supabase
        .from('projects')
        .insert({ name: newProjectName.trim(), active: true })

      if (error) throw error

      toast.success('Project created')
      setNewProjectName('')
      setShowModal(false)
      await loadProjects()
    } catch (error: any) {
      toast.error(error.message || 'Failed to create project')
    }
  }

  const handleUpdateProject = async (project: Project) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ name: project.name, active: project.active })
        .eq('id', project.id)

      if (error) throw error

      toast.success('Project updated')
      setEditingProject(null)
      await loadProjects()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update project')
    }
  }

  const handleToggleAssignment = async (projectId: string, recruiterId: string) => {
    const currentAssignments = assignments[projectId] || []
    const isAssigned = currentAssignments.includes(recruiterId)

    try {
      if (isAssigned) {
        const { error } = await supabase
          .from('recruiter_projects')
          .delete()
          .eq('project_id', projectId)
          .eq('recruiter_id', recruiterId)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('recruiter_projects')
          .insert({ project_id: projectId, recruiter_id: recruiterId })

        if (error) throw error
      }

      await loadAssignments()
      toast.success(isAssigned ? 'Assignment removed' : 'Assignment added')
    } catch (error: any) {
      toast.error(error.message || 'Failed to update assignment')
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
        <button
          onClick={() => {
            setEditingProject(null)
            setNewProjectName('')
            setShowModal(true)
          }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          New Project
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {projects.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="mb-4">No projects yet. Create your first project to get started.</p>
            <button
              onClick={() => {
                setEditingProject(null)
                setNewProjectName('')
                setShowModal(true)
              }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Create First Project
            </button>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned Recruiters</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {projects.map(project => (
              <tr key={project.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingProject?.id === project.id ? (
                    <input
                      type="text"
                      value={editingProject.name}
                      onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                      className="px-2 py-1 border border-gray-300 rounded"
                      onBlur={() => handleUpdateProject(editingProject)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleUpdateProject(editingProject)
                        }
                      }}
                      autoFocus
                    />
                  ) : (
                    <span className="text-sm font-medium text-gray-900">{project.name}</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingProject?.id === project.id ? (
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editingProject.active}
                        onChange={(e) => setEditingProject({ ...editingProject, active: e.target.checked })}
                        className="rounded border-gray-300"
                      />
                      <span className="ml-2 text-sm text-gray-700">Active</span>
                    </label>
                  ) : (
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      project.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {project.active ? 'Active' : 'Inactive'}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-2">
                    {recruiters.map(recruiter => {
                      const isAssigned = assignments[project.id]?.includes(recruiter.id) || false
                      return (
                        <button
                          key={recruiter.id}
                          onClick={() => handleToggleAssignment(project.id, recruiter.id)}
                          className={`px-2 py-1 text-xs rounded ${
                            isAssigned
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {recruiter.name} {isAssigned ? '✓' : '+'}
                        </button>
                      )
                    })}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => setEditingProject(project)}
                    className="text-indigo-600 hover:text-indigo-900 mr-4"
                  >
                    Edit
                  </button>
                </td>
              </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowModal(false)
              setNewProjectName('')
            }
          }}
        >
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h2 className="text-xl font-bold mb-4">New Project</h2>
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Enter project name"
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateProject()
                } else if (e.key === 'Escape') {
                  setShowModal(false)
                  setNewProjectName('')
                }
              }}
              autoFocus
            />
            <div className="flex space-x-4">
              <button
                onClick={handleCreateProject}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowModal(false)
                  setNewProjectName('')
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
