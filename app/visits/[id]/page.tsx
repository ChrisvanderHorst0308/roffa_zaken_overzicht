'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { VisitWithRelations } from '@/types'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { CalendarPlus, Calendar } from 'lucide-react'
import { createVisitCalendarEvent } from '@/lib/googleCalendar'

export default function VisitDetailPage() {
  const params = useParams()
  const router = useRouter()
  const visitId = params.id as string
  const [visit, setVisit] = useState<VisitWithRelations | null>(null)
  const [otherVisits, setOtherVisits] = useState<VisitWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [showNextVisit, setShowNextVisit] = useState(false)
  const [nextVisitDate, setNextVisitDate] = useState('')
  const [nextVisitTime, setNextVisitTime] = useState('10:00')
  const [nextVisitNotes, setNextVisitNotes] = useState('')

  useEffect(() => {
    if (visitId) {
      loadVisit()
    }
  }, [visitId])

  const loadVisit = async () => {
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

      const isAdmin = profile?.role === 'admin' || profile?.role === 'reichskanzlier' || profile?.role === 'fletcher_admin'

      const { data: visitData, error: visitError } = await supabase
        .from('visits')
        .select(`
          *,
          location:locations(*),
          project:projects(*),
          recruiter:profiles(*)
        `)
        .eq('id', visitId)
        .single()

      if (visitError) throw visitError

      if (!isAdmin && visitData.recruiter_id !== user.id) {
        toast.error('You do not have permission to view this visit')
        router.push('/dashboard')
        return
      }

      setVisit(visitData)

      const { data: otherVisitsData, error: otherVisitsError } = await supabase
        .from('visits')
        .select(`
          *,
          location:locations(*),
          project:projects(*),
          recruiter:profiles(*)
        `)
        .eq('location_id', visitData.location_id)
        .neq('id', visitId)
        .order('visit_date', { ascending: false })
        .limit(10)

      if (otherVisitsError) throw otherVisitsError
      setOtherVisits(otherVisitsData || [])
    } catch (error: any) {
      toast.error(error.message || 'Failed to load visit')
      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!visit) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 mb-4">Visit not found</p>
        <Link href="/dashboard" className="text-indigo-600 hover:text-indigo-800">
          Back to Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-indigo-600 hover:text-indigo-800 mb-2 inline-block"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Visit Details</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowNextVisit(!showNextVisit)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            <CalendarPlus className="h-4 w-4" />
            Plan Next Visit
          </button>
          <Link
            href={`/visits/${visitId}/edit`}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-center"
          >
            Edit Visit
          </Link>
        </div>
      </div>

      {/* Plan Next Visit Section */}
      {showNextVisit && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-green-900 mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Plan Next Visit to {visit.location.name}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Datum
              </label>
              <input
                type="date"
                value={nextVisitDate}
                onChange={(e) => setNextVisitDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tijd
              </label>
              <input
                type="time"
                value={nextVisitTime}
                onChange={(e) => setNextVisitTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notities (optioneel)
              </label>
              <textarea
                value={nextVisitNotes}
                onChange={(e) => setNextVisitNotes(e.target.value)}
                placeholder="Wat wil je bespreken bij de volgende visit?"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                rows={2}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => {
                if (!nextVisitDate) {
                  toast.error('Selecteer een datum')
                  return
                }
                const [year, month, day] = nextVisitDate.split('-').map(Number)
                const [hours, minutes] = nextVisitTime.split(':').map(Number)
                const visitDateTime = new Date(year, month - 1, day, hours, minutes)
                
                const url = createVisitCalendarEvent(
                  visit.location.name,
                  visit.location.city || undefined,
                  visit.location.address || undefined,
                  visitDateTime,
                  nextVisitNotes || undefined
                )
                window.open(url, '_blank')
                toast.success('Opening Google Calendar...')
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <CalendarPlus className="h-4 w-4" />
              Toevoegen aan Google Calendar
            </button>
            <button
              onClick={() => setShowNextVisit(false)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Annuleren
            </button>
          </div>
        </div>
      )}

      {otherVisits.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-yellow-900 mb-4">
            Other Visits to {visit.location.name}
          </h2>
          <div className="space-y-3">
            {otherVisits.map(otherVisit => (
              <div
                key={otherVisit.id}
                className="bg-white rounded-md p-4 border border-yellow-200"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium text-gray-900">
                      {otherVisit.recruiter.name} - {otherVisit.project.name}
                    </p>
                    <p className="text-sm text-gray-600">
                      {new Date(otherVisit.visit_date).toLocaleDateString()} • {otherVisit.status.replace('_', ' ')}
                    </p>
                  </div>
                </div>
                {otherVisit.notes && (
                  <div className="mt-2">
                    <p className="text-sm font-medium text-gray-700">Notes:</p>
                    <p className="text-sm text-gray-600 mt-1">{otherVisit.notes}</p>
                  </div>
                )}
                {otherVisit.spoken_to && (
                  <p className="text-sm text-gray-600 mt-1">
                    Spoken to: {otherVisit.spoken_to}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-4 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Location</h3>
            <p className="text-lg font-semibold text-gray-900">
              {visit.location.name}
            </p>
            <p className="text-sm text-gray-600">
              {visit.location.city}
              {visit.location.address && ` • ${visit.location.address}`}
            </p>
            {visit.location.website && (
              <a
                href={visit.location.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-indigo-600 hover:text-indigo-800 mt-1 inline-block"
              >
                {visit.location.website}
              </a>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Project</h3>
            <p className="text-lg font-semibold text-gray-900">{visit.project.name}</p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Visit Date</h3>
            <p className="text-lg font-semibold text-gray-900">
              {new Date(visit.visit_date).toLocaleDateString()}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Status</h3>
            <span className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${
              visit.status === 'interested' ? 'bg-green-100 text-green-800' :
              visit.status === 'demo_planned' ? 'bg-blue-100 text-blue-800' :
              visit.status === 'not_interested' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {visit.status.replace('_', ' ')}
            </span>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">POS System</h3>
            <p className="text-lg font-semibold text-gray-900">{visit.pos_system}</p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Spoken To</h3>
            <p className="text-lg font-semibold text-gray-900">{visit.spoken_to}</p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Services</h3>
            <div className="flex gap-2 mt-1">
              {visit.takeaway && (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded">
                  Takeaway
                </span>
              )}
              {visit.delivery && (
                <span className="px-2 py-1 bg-green-100 text-green-800 text-sm rounded">
                  Delivery
                </span>
              )}
            </div>
            {visit.takeaway && visit.takeaway_platforms && (
              <p className="text-sm text-gray-600 mt-2">
                Takeaway: {visit.takeaway_platforms}
              </p>
            )}
            {visit.delivery && visit.delivery_platforms && (
              <p className="text-sm text-gray-600 mt-2">
                Delivery: {visit.delivery_platforms}
              </p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Recruiter</h3>
            <p className="text-lg font-semibold text-gray-900">
              {visit.recruiter?.name || 'Unknown'}
            </p>
          </div>
        </div>

        {visit.notes && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Notes</h3>
            <div className="bg-gray-50 rounded-md p-4">
              <p className="text-gray-900 whitespace-pre-wrap">{visit.notes}</p>
            </div>
          </div>
        )}

        <div className="pt-4 border-t">
          <p className="text-xs text-gray-500">
            Created: {new Date(visit.created_at).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  )
}
