'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Profile } from '@/types'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function AdminPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkAdmin()
  }, [])

  const checkAdmin = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!profileData || (profileData.role !== 'admin' && profileData.role !== 'reichskanzlier' && profileData.role !== 'fletcher_admin')) {
        toast.error('Access denied. Admin only.')
        router.push('/dashboard')
        return
      }

      setProfile(profileData)
    } catch (error: any) {
      toast.error(error.message || 'Failed to verify access')
      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Admin Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Link
          href="/admin/projects"
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Projects</h2>
          <p className="text-gray-600">Manage projects and assignments</p>
        </Link>

        <Link
          href="/admin/recruiters"
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Recruiters</h2>
          <p className="text-gray-600">Manage recruiters and roles</p>
        </Link>

        <Link
          href="/admin/visits"
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <h2 className="text-xl font-semibold text-gray-900 mb-2">All Visits</h2>
          <p className="text-gray-600">View and manage all visits</p>
        </Link>
      </div>
    </div>
  )
}
