'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Profile, Visit } from '@/types'
import toast from 'react-hot-toast'

interface LeaderboardEntry {
  recruiter: Profile
  totalVisits: number
  interestedCount: number
  demoPlannedCount: number
  notInterestedCount: number
  lastVisitDate: string | null
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'visits' | 'interested' | 'demo_planned'>('visits')
  const router = useRouter()

  useEffect(() => {
    loadLeaderboard()
  }, [sortBy])

  const loadLeaderboard = async () => {
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

      const isAdmin = profile?.role === 'admin' || profile?.role === 'reichskanzlier'

      if (!isAdmin) {
        toast.error('Access denied. Admin only.')
        router.push('/dashboard')
        return
      }

      const { data: allVisits, error: visitsError } = await supabase
        .from('visits')
        .select(`
          *,
          recruiter:profiles(*)
        `)
        .order('visit_date', { ascending: false })

      if (visitsError) throw visitsError

      const { data: allRecruiters, error: recruitersError } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['recruiter', 'admin', 'reichskanzlier'])
        .eq('active', true)
        .order('name')

      if (recruitersError) throw recruitersError

      const leaderboardMap: Record<string, LeaderboardEntry> = {}

      allRecruiters?.forEach(recruiter => {
        leaderboardMap[recruiter.id] = {
          recruiter,
          totalVisits: 0,
          interestedCount: 0,
          demoPlannedCount: 0,
          notInterestedCount: 0,
          lastVisitDate: null,
        }
      })

      allVisits?.forEach((visit: any) => {
        const entry = leaderboardMap[visit.recruiter_id]
        if (entry) {
          entry.totalVisits++
          if (visit.status === 'interested') entry.interestedCount++
          if (visit.status === 'demo_planned') entry.demoPlannedCount++
          if (visit.status === 'not_interested') entry.notInterestedCount++
          
          if (!entry.lastVisitDate || new Date(visit.visit_date) > new Date(entry.lastVisitDate)) {
            entry.lastVisitDate = visit.visit_date
          }
        }
      })

      let sorted = Object.values(leaderboardMap)

      if (sortBy === 'visits') {
        sorted = sorted.sort((a, b) => b.totalVisits - a.totalVisits)
      } else if (sortBy === 'interested') {
        sorted = sorted.sort((a, b) => b.interestedCount - a.interestedCount)
      } else if (sortBy === 'demo_planned') {
        sorted = sorted.sort((a, b) => b.demoPlannedCount - a.demoPlannedCount)
      }

      setLeaderboard(sorted)
    } catch (error: any) {
      toast.error(error.message || 'Failed to load leaderboard')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Leaderboard</h1>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'visits' | 'interested' | 'demo_planned')}
            className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="visits">Total Visits</option>
            <option value="interested">Interested</option>
            <option value="demo_planned">Demo Planned</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Recruiter
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Visits
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Interested
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Demo Planned
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Not Interested
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Visit
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {leaderboard.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    No data available
                  </td>
                </tr>
              ) : (
                leaderboard.map((entry, index) => (
                  <tr
                    key={entry.recruiter.id}
                    className={`hover:bg-gray-50 ${
                      index === 0 ? 'bg-yellow-50' : index === 1 ? 'bg-gray-50' : index === 2 ? 'bg-orange-50' : ''
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {index === 0 && <span className="text-2xl mr-2">🥇</span>}
                        {index === 1 && <span className="text-2xl mr-2">🥈</span>}
                        {index === 2 && <span className="text-2xl mr-2">🥉</span>}
                        <span className="text-lg font-bold text-gray-900">#{index + 1}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        {entry.recruiter.profile_picture_url ? (
                          <img
                            src={entry.recruiter.profile_picture_url}
                            alt={entry.recruiter.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm text-gray-600 font-medium">
                              {entry.recruiter.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900">{entry.recruiter.name}</div>
                          <div className="text-sm text-gray-500">
                            {entry.recruiter.nickname ? `${entry.recruiter.nickname} - ${entry.recruiter.role}` : entry.recruiter.role}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-lg font-semibold text-gray-900">{entry.totalVisits}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        {entry.interestedCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {entry.demoPlannedCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                        {entry.notInterestedCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {entry.lastVisitDate
                        ? new Date(entry.lastVisitDate).toLocaleDateString()
                        : 'No visits yet'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-4 p-4">
          {leaderboard.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No data available
            </div>
          ) : (
            leaderboard.map((entry, index) => (
              <div
                key={entry.recruiter.id}
                className={`border rounded-lg p-4 ${
                  index === 0 ? 'bg-yellow-50 border-yellow-200' : 
                  index === 1 ? 'bg-gray-50 border-gray-200' : 
                  index === 2 ? 'bg-orange-50 border-orange-200' : 
                  'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3 flex-1">
                    <div className="flex items-center">
                      {index === 0 && <span className="text-2xl mr-2">🥇</span>}
                      {index === 1 && <span className="text-2xl mr-2">🥈</span>}
                      {index === 2 && <span className="text-2xl mr-2">🥉</span>}
                      <span className="text-lg font-bold text-gray-900">#{index + 1}</span>
                    </div>
                    {entry.recruiter.profile_picture_url ? (
                      <img
                        src={entry.recruiter.profile_picture_url}
                        alt={entry.recruiter.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center">
                        <span className="text-base text-gray-600 font-medium">
                          {entry.recruiter.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-semibold text-gray-900 truncate">
                        {entry.recruiter.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {entry.recruiter.nickname ? `${entry.recruiter.nickname} - ${entry.recruiter.role}` : entry.recruiter.role}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="bg-white rounded p-2">
                    <div className="text-xs text-gray-500">Total Visits</div>
                    <div className="text-lg font-bold text-gray-900">{entry.totalVisits}</div>
                  </div>
                  <div className="bg-white rounded p-2">
                    <div className="text-xs text-gray-500">Interested</div>
                    <div className="text-lg font-bold text-green-800">{entry.interestedCount}</div>
                  </div>
                  <div className="bg-white rounded p-2">
                    <div className="text-xs text-gray-500">Demo Planned</div>
                    <div className="text-lg font-bold text-blue-800">{entry.demoPlannedCount}</div>
                  </div>
                  <div className="bg-white rounded p-2">
                    <div className="text-xs text-gray-500">Not Interested</div>
                    <div className="text-lg font-bold text-red-800">{entry.notInterestedCount}</div>
                  </div>
                </div>
                {entry.lastVisitDate && (
                  <div className="mt-3 text-xs text-gray-500">
                    Last visit: {new Date(entry.lastVisitDate).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
