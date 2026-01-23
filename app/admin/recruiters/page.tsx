'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Profile, UserRole } from '@/types'
import toast from 'react-hot-toast'

export default function AdminRecruitersPage() {
  const [recruiters, setRecruiters] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
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

      await loadRecruiters()
    } catch (error: any) {
      toast.error(error.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const loadRecruiters = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('name')
    
    if (error) throw error
    setRecruiters(data || [])
  }

  const handleUpdateRole = async (recruiterId: string, newRole: UserRole) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', recruiterId)

      if (error) throw error

      toast.success('Role updated')
      await loadRecruiters()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update role')
    }
  }

  const handleToggleActive = async (recruiter: Profile) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ active: !recruiter.active })
        .eq('id', recruiter.id)

      if (error) throw error

      toast.success(`Recruiter ${!recruiter.active ? 'activated' : 'deactivated'}`)
      await loadRecruiters()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update status')
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Recruiters</h1>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {recruiters.map(recruiter => (
              <tr key={recruiter.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {recruiter.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <select
                    value={recruiter.role}
                    onChange={(e) => handleUpdateRole(recruiter.id, e.target.value as UserRole)}
                    className="text-sm border border-gray-300 rounded px-2 py-1"
                  >
                    <option value="recruiter">Recruiter</option>
                    <option value="admin">Admin</option>
                    <option value="reichskanzlier">Reichskanzlier</option>
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    recruiter.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {recruiter.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(recruiter.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => handleToggleActive(recruiter)}
                    className={`${
                      recruiter.active
                        ? 'text-red-600 hover:text-red-900'
                        : 'text-green-600 hover:text-green-900'
                    }`}
                  >
                    {recruiter.active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
