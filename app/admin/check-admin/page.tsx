'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/components/AuthProvider'

export default function CheckAdminPage() {
  const { user, profile } = useAuth()
  const [dbProfile, setDbProfile] = useState<any>(null)

  useEffect(() => {
    const checkProfile = async () => {
      if (!user) return

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setDbProfile(data)
    }

    checkProfile()
  }, [user])

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Admin Status Check</h1>
      
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <h2 className="font-semibold mb-2">User Info:</h2>
          <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
            {JSON.stringify({ email: user?.email, id: user?.id }, null, 2)}
          </pre>
        </div>

        <div>
          <h2 className="font-semibold mb-2">Profile from Context:</h2>
          <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
            {JSON.stringify(profile, null, 2)}
          </pre>
          <p className="mt-2">
            Role: <span className="font-bold">{profile?.role || 'NOT SET'}</span>
          </p>
        </div>

        <div>
          <h2 className="font-semibold mb-2">Profile from Database:</h2>
          <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
            {JSON.stringify(dbProfile, null, 2)}
          </pre>
          {dbProfile && (
            <p className="mt-2">
              Role: <span className="font-bold">{dbProfile.role || 'NOT SET'}</span>
            </p>
          )}
        </div>

        {dbProfile && dbProfile.role !== 'admin' && dbProfile.role !== 'reichskanzlier' && dbProfile.role !== 'fletcher_admin' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
            <p className="font-semibold text-yellow-800">⚠️ You are not an admin!</p>
            <p className="text-sm text-yellow-700 mt-2">
              Run this SQL in Supabase to make yourself admin:
            </p>
            <pre className="bg-yellow-100 p-2 rounded mt-2 text-xs overflow-auto">
{`UPDATE profiles
SET role = 'admin'
WHERE id = '${user?.id}';`}
            </pre>
          </div>
        )}

        {(dbProfile?.role === 'admin' || dbProfile?.role === 'reichskanzlier' || dbProfile?.role === 'fletcher_admin') && (
          <div className="bg-green-50 border border-green-200 rounded p-4">
            <p className="font-semibold text-green-800">✓ You have admin access!</p>
            <p className="text-sm text-green-700 mt-2">
              Role: {dbProfile.role}. The Admin link should appear in the navigation. If not, try refreshing the page.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
