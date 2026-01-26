'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Location, FletcherApkRunWithRelations } from '@/types'
import { getTotalChecklistItems } from '@/lib/fletcherChecklist'
import toast from 'react-hot-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { 
  Calendar, 
  MapPin, 
  Search,
  Plus,
  Building2,
  User,
  ClipboardCheck,
  Eye,
  CheckCircle2,
  Clock
} from 'lucide-react'
import FletcherApkModal from '@/components/FletcherApkModal'

export default function FletcherPage() {
  const [apkRuns, setApkRuns] = useState<FletcherApkRunWithRelations[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [checkCounts, setCheckCounts] = useState<Record<string, { checked: number; total: number }>>({})
  const router = useRouter()

  const totalChecklistItems = getTotalChecklistItems()

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

      // Check if user has access (admin or fletcher_admin only)
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!profile || (profile.role !== 'admin' && profile.role !== 'fletcher_admin')) {
        toast.error('Access denied. Fletcher Admin only.')
        router.push('/dashboard')
        return
      }

      // Load APK runs
      const { data: runsData, error: runsError } = await supabase
        .from('fletcher_apk_runs')
        .select(`
          *,
          location:locations(*),
          creator:profiles(id, name, nickname)
        `)
        .order('created_at', { ascending: false })

      if (runsError) {
        console.error('Error loading APK runs:', runsError)
        // Table might not exist yet
      } else {
        setApkRuns(runsData || [])

        // Load check counts for each run
        if (runsData && runsData.length > 0) {
          const runIds = runsData.map(r => r.id)
          const { data: checksData } = await supabase
            .from('fletcher_apk_check_items')
            .select('run_id, checked')
            .in('run_id', runIds)

          if (checksData) {
            const counts: Record<string, { checked: number; total: number }> = {}
            checksData.forEach(item => {
              if (!counts[item.run_id]) {
                counts[item.run_id] = { checked: 0, total: 0 }
              }
              counts[item.run_id].total++
              if (item.checked) {
                counts[item.run_id].checked++
              }
            })
            setCheckCounts(counts)
          }
        }
      }

      // Load all locations for the form
      const { data: locationsData, error: locationsError } = await supabase
        .from('locations')
        .select('*')
        .order('name')

      if (locationsError) throw locationsError
      setLocations(locationsData || [])

    } catch (error: any) {
      toast.error(error.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleApkCreated = (runId: string) => {
    setIsModalOpen(false)
    toast.success('Fletcher APK gestart!')
    router.push(`/fletcher/${runId}`)
  }

  const filteredRuns = apkRuns.filter(run => {
    const matchesSearch = 
      run.location?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      run.location?.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      run.creator?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  const getCompletionPercentage = (runId: string): number => {
    const counts = checkCounts[runId]
    if (!counts || counts.total === 0) return 0
    return Math.round((counts.checked / counts.total) * 100)
  }

  // Stats
  const stats = {
    total: apkRuns.length,
    draft: apkRuns.filter(r => r.status === 'draft').length,
    submitted: apkRuns.filter(r => r.status === 'submitted').length,
    thisWeek: apkRuns.filter(r => {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return new Date(r.created_at) >= weekAgo
    }).length,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading Fletcher APK data...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardCheck className="h-8 w-8 text-orange-600" />
            Fletcher APK
          </h1>
          <p className="text-muted-foreground mt-1">
            Fletcher QR Ordering APK Checklist
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="bg-orange-600 hover:bg-orange-700" size="lg">
          <Plus className="mr-2 h-5 w-5" />
          Start Fletcher APK
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totaal APK Runs</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.draft}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Afgerond</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.submitted}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deze Week</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.thisWeek}</div>
          </CardContent>
        </Card>
      </div>

      {/* APK Runs List */}
      <Card>
        <CardHeader>
          <CardTitle>APK Runs</CardTitle>
          <CardDescription>
            {filteredRuns.length} run(s) gevonden
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Zoek op locatie of gebruiker..."
                className="pl-10"
              />
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Datum</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Locatie</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Gemaakt door</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Voortgang</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Acties</th>
                </tr>
              </thead>
              <tbody>
                {filteredRuns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="h-24 text-center text-muted-foreground">
                      Nog geen APK runs. Klik op &quot;Start Fletcher APK&quot; om te beginnen.
                    </td>
                  </tr>
                ) : (
                  filteredRuns.map(run => {
                    const completion = getCompletionPercentage(run.id)
                    const counts = checkCounts[run.id] || { checked: 0, total: totalChecklistItems }
                    return (
                      <tr
                        key={run.id}
                        className="border-b hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/fletcher/${run.id}`)}
                      >
                        <td className="p-4 align-middle">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {new Date(run.created_at).toLocaleDateString('nl-NL', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 align-middle">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <span className="text-sm font-medium">{run.location?.name}</span>
                              <span className="text-sm text-muted-foreground ml-1">({run.location?.city})</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 align-middle">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{run.creator?.nickname || run.creator?.name || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="p-4 align-middle">
                          <div className="flex items-center gap-3">
                            <Progress value={completion} className="w-20 h-2" />
                            <span className="text-sm font-medium">{completion}%</span>
                            <span className="text-xs text-muted-foreground">
                              ({counts.checked}/{counts.total})
                            </span>
                          </div>
                        </td>
                        <td className="p-4 align-middle">
                          <Badge variant={run.status === 'submitted' ? 'success' : 'warning'}>
                            {run.status === 'submitted' ? 'Afgerond' : 'In Progress'}
                          </Badge>
                        </td>
                        <td className="p-4 align-middle">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/fletcher/${run.id}`)
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Bekijk
                          </Button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {filteredRuns.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nog geen APK runs. Klik op &quot;Start Fletcher APK&quot; om te beginnen.
              </div>
            ) : (
              filteredRuns.map(run => {
                const completion = getCompletionPercentage(run.id)
                const counts = checkCounts[run.id] || { checked: 0, total: totalChecklistItems }
                return (
                  <Card
                    key={run.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => router.push(`/fletcher/${run.id}`)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-orange-600" />
                            {run.location?.name}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" />
                            {run.location?.city}
                          </CardDescription>
                        </div>
                        <Badge variant={run.status === 'submitted' ? 'success' : 'warning'}>
                          {run.status === 'submitted' ? 'Afgerond' : 'In Progress'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Voortgang:</span>
                          <span className="font-medium">{completion}% ({counts.checked}/{counts.total})</span>
                        </div>
                        <Progress value={completion} className="h-2" />
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(run.created_at).toLocaleDateString('nl-NL')}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {run.creator?.nickname || run.creator?.name}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* APK Modal */}
      <FletcherApkModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleApkCreated}
        locations={locations}
      />
    </div>
  )
}
