'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Location, FletcherApkRunWithRelations, FletcherApkError, FletcherApkTodo } from '@/types'
import { getTotalChecklistItems } from '@/lib/fletcherChecklist'
import toast from 'react-hot-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
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
  Clock,
  AlertTriangle,
  ListTodo,
  TrendingUp,
  Target,
  Zap,
  ArrowRight,
  RefreshCw,
  BarChart3,
  PieChart as PieChartIcon
} from 'lucide-react'
import FletcherApkModal from '@/components/FletcherApkModal'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts'

interface ErrorWithRun extends FletcherApkError {
  run?: FletcherApkRunWithRelations
}

interface TodoWithRun extends FletcherApkTodo {
  run?: FletcherApkRunWithRelations
}

export default function FletcherPage() {
  const [apkRuns, setApkRuns] = useState<FletcherApkRunWithRelations[]>([])
  const [allErrors, setAllErrors] = useState<ErrorWithRun[]>([])
  const [allTodos, setAllTodos] = useState<TodoWithRun[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [checkCounts, setCheckCounts] = useState<Record<string, { checked: number; total: number }>>({})
  const [activeTab, setActiveTab] = useState<'overview' | 'runs' | 'todos' | 'errors' | 'stats'>('overview')
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

          // Load all errors
          const { data: errorsData } = await supabase
            .from('fletcher_apk_errors')
            .select('*')
            .in('run_id', runIds)
            .eq('resolved', false)
            .order('created_at', { ascending: false })

          if (errorsData && runsData) {
            const errorsWithRuns = errorsData.map(err => ({
              ...err,
              run: runsData.find(r => r.id === err.run_id)
            }))
            setAllErrors(errorsWithRuns)
          }

          // Load all todos
          const { data: todosData } = await supabase
            .from('fletcher_apk_todos')
            .select('*')
            .in('run_id', runIds)
            .eq('completed', false)
            .order('created_at', { ascending: false })

          if (todosData && runsData) {
            const todosWithRuns = todosData.map(todo => ({
              ...todo,
              run: runsData.find(r => r.id === todo.run_id)
            }))
            setAllTodos(todosWithRuns)
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

  const toggleTodoComplete = async (todoId: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from('fletcher_apk_todos')
        .update({ completed })
        .eq('id', todoId)

      if (error) throw error

      // Remove from list if completed
      if (completed) {
        setAllTodos(prev => prev.filter(t => t.id !== todoId))
        toast.success('Todo afgerond!')
      }
    } catch (error: any) {
      toast.error('Kon todo niet updaten')
    }
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

  // Calculate stats
  const completedRuns = apkRuns.filter(r => r.status === 'submitted' || r.status === 'completed')
  const inProgressRuns = apkRuns.filter(r => r.status === 'draft' || r.status === 'in_progress')
  const avgCompletion = apkRuns.length > 0 
    ? Math.round(apkRuns.reduce((acc, run) => acc + getCompletionPercentage(run.id), 0) / apkRuns.length)
    : 0

  const stats = {
    total: apkRuns.length,
    completed: completedRuns.length,
    inProgress: inProgressRuns.length,
    openTodos: allTodos.length,
    openErrors: allErrors.length,
    avgCompletion,
    thisWeek: apkRuns.filter(r => {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return new Date(r.created_at) >= weekAgo
    }).length,
    completionRate: apkRuns.length > 0 ? Math.round((completedRuns.length / apkRuns.length) * 100) : 0,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin" />
          Loading Fletcher APK data...
        </div>
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
            Fletcher Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Totaaloverzicht Fletcher QR Ordering APK
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => setIsModalOpen(true)} className="bg-orange-600 hover:bg-orange-700" size="lg">
            <Plus className="mr-2 h-5 w-5" />
            Start APK
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b pb-2 overflow-x-auto">
        {[
          { id: 'overview', label: 'Overzicht', icon: TrendingUp },
          { id: 'stats', label: 'Statistieken', icon: BarChart3 },
          { id: 'runs', label: `APK Runs (${stats.total})`, icon: ClipboardCheck },
          { id: 'todos', label: `To-Dos (${stats.openTodos})`, icon: ListTodo },
          { id: 'errors', label: `Errors (${stats.openErrors})`, icon: AlertTriangle },
        ].map(tab => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab(tab.id as any)}
            className={activeTab === tab.id ? 'bg-orange-600 hover:bg-orange-700' : ''}
          >
            <tab.icon className="h-4 w-4 mr-2" />
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Main Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-orange-800">Totaal APK Runs</CardTitle>
                <ClipboardCheck className="h-5 w-5 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-900">{stats.total}</div>
                <p className="text-xs text-orange-700 mt-1">{stats.thisWeek} deze week</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-green-800">Afgerond</CardTitle>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-900">{stats.completed}</div>
                <p className="text-xs text-green-700 mt-1">{stats.completionRate}% completion rate</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-yellow-800">In Progress</CardTitle>
                <Clock className="h-5 w-5 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-yellow-900">{stats.inProgress}</div>
                <p className="text-xs text-yellow-700 mt-1">{stats.avgCompletion}% gem. voortgang</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-blue-800">Open Items</CardTitle>
                <Target className="h-5 w-5 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-900">{stats.openTodos + stats.openErrors}</div>
                <p className="text-xs text-blue-700 mt-1">{stats.openTodos} to-dos, {stats.openErrors} errors</p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions & Recent Activity */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Open To-Dos */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <ListTodo className="h-5 w-5 text-blue-600" />
                    Open To-Dos
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('todos')}>
                    Bekijk alle <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {allTodos.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p>Geen openstaande to-dos!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {allTodos.slice(0, 5).map(todo => (
                      <div
                        key={todo.id}
                        className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <Checkbox
                          checked={todo.completed}
                          onCheckedChange={(checked) => toggleTodoComplete(todo.id, !!checked)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{todo.text}</p>
                          <p 
                            className="text-xs text-muted-foreground flex items-center gap-1 mt-1 cursor-pointer hover:text-orange-600"
                            onClick={() => router.push(`/fletcher/${todo.run_id}`)}
                          >
                            <Building2 className="h-3 w-3" />
                            {todo.run?.location?.name}
                          </p>
                        </div>
                      </div>
                    ))}
                    {allTodos.length > 5 && (
                      <p className="text-xs text-center text-muted-foreground">
                        +{allTodos.length - 5} meer to-dos
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Open Errors */}
            <Card className={allErrors.length > 0 ? 'border-red-200' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className={`h-5 w-5 ${allErrors.length > 0 ? 'text-red-600' : 'text-muted-foreground'}`} />
                    Open Errors
                  </CardTitle>
                  {allErrors.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setActiveTab('errors')}>
                      Bekijk alle <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {allErrors.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p>Geen openstaande errors!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {allErrors.slice(0, 5).map(err => (
                      <div
                        key={err.id}
                        className="p-3 rounded-lg border border-red-100 bg-red-50/50 cursor-pointer hover:bg-red-100/50 transition-colors"
                        onClick={() => router.push(`/fletcher/${err.run_id}`)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Building2 className="h-3 w-3 text-red-600" />
                          <span className="text-xs font-medium text-red-800">{err.run?.location?.name}</span>
                        </div>
                        <p className="text-sm text-red-700 line-clamp-2">{err.text}</p>
                      </div>
                    ))}
                    {allErrors.length > 5 && (
                      <p className="text-xs text-center text-muted-foreground">
                        +{allErrors.length - 5} meer errors
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent APK Runs */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-orange-600" />
                  Recente APK Runs
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab('runs')}>
                  Bekijk alle <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {apkRuns.slice(0, 5).map(run => {
                  const completion = getCompletionPercentage(run.id)
                  return (
                    <div
                      key={run.id}
                      className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/fletcher/${run.id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-orange-600" />
                          <span className="font-medium truncate">{run.location?.name}</span>
                          <Badge variant={run.status === 'submitted' || run.status === 'completed' ? 'success' : 'warning'} className="ml-auto">
                            {run.status === 'submitted' || run.status === 'completed' ? 'Afgerond' : 'In Progress'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(run.created_at).toLocaleDateString('nl-NL')}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {run.creator?.nickname || run.creator?.name}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={completion} className="w-20 h-2" />
                        <span className="text-sm font-medium w-12 text-right">{completion}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Runs Tab */}
      {activeTab === 'runs' && (
        <Card>
          <CardHeader>
            <CardTitle>Alle APK Runs</CardTitle>
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
                        Geen APK runs gevonden
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
                            <Badge variant={run.status === 'submitted' || run.status === 'completed' ? 'success' : 'warning'}>
                              {run.status === 'submitted' || run.status === 'completed' ? 'Afgerond' : 'In Progress'}
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
                  Geen APK runs gevonden
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
                          <Badge variant={run.status === 'submitted' || run.status === 'completed' ? 'success' : 'warning'}>
                            {run.status === 'submitted' || run.status === 'completed' ? 'Afgerond' : 'In Progress'}
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
      )}

      {/* Todos Tab */}
      {activeTab === 'todos' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-blue-600" />
              Alle Open To-Dos ({allTodos.length})
            </CardTitle>
            <CardDescription>
              Alle openstaande to-dos uit APK runs
            </CardDescription>
          </CardHeader>
          <CardContent>
            {allTodos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
                <p className="text-lg font-medium">Geen openstaande to-dos!</p>
                <p className="text-sm">Alle taken zijn afgerond.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {allTodos.map(todo => (
                  <div
                    key={todo.id}
                    className="flex items-start gap-3 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={todo.completed}
                      onCheckedChange={(checked) => toggleTodoComplete(todo.id, !!checked)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{todo.text}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span 
                          className="flex items-center gap-1 cursor-pointer hover:text-orange-600"
                          onClick={() => router.push(`/fletcher/${todo.run_id}`)}
                        >
                          <Building2 className="h-3 w-3" />
                          {todo.run?.location?.name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(todo.created_at).toLocaleDateString('nl-NL')}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/fletcher/${todo.run_id}`)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Errors Tab */}
      {activeTab === 'errors' && (
        <Card className={allErrors.length > 0 ? 'border-red-200' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className={`h-5 w-5 ${allErrors.length > 0 ? 'text-red-600' : 'text-muted-foreground'}`} />
              Alle Open Errors ({allErrors.length})
            </CardTitle>
            <CardDescription>
              Alle openstaande errors uit APK runs
            </CardDescription>
          </CardHeader>
          <CardContent>
            {allErrors.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
                <p className="text-lg font-medium">Geen openstaande errors!</p>
                <p className="text-sm">Alles werkt zoals het hoort.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {allErrors.map(err => (
                  <div
                    key={err.id}
                    className="p-4 border border-red-100 rounded-lg bg-red-50/50 cursor-pointer hover:bg-red-100/50 transition-colors"
                    onClick={() => router.push(`/fletcher/${err.run_id}`)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-red-600" />
                        <span className="font-medium">{err.run?.location?.name}</span>
                        <span className="text-sm text-muted-foreground">({err.run?.location?.city})</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(err.created_at).toLocaleDateString('nl-NL', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-red-800">{err.text}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stats Tab */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          {/* Stats Header */}
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-orange-600" />
            <h2 className="text-2xl font-bold">Fletcher Statistieken</h2>
          </div>

          {/* Charts Row 1 */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Status Distribution Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5 text-orange-600" />
                  Status Verdeling
                </CardTitle>
                <CardDescription>APK runs per status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Afgerond', value: stats.completed, color: '#22c55e' },
                          { name: 'In Progress', value: stats.inProgress, color: '#eab308' },
                        ].filter(d => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {[
                          { name: 'Afgerond', value: stats.completed, color: '#22c55e' },
                          { name: 'In Progress', value: stats.inProgress, color: '#eab308' },
                        ].filter(d => d.value > 0).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Completion Rate by Location */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-600" />
                  Voortgang per Locatie
                </CardTitle>
                <CardDescription>Completion percentage per APK run</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={apkRuns.slice(0, 10).map(run => ({
                        name: run.location?.name?.substring(0, 15) + (run.location?.name && run.location.name.length > 15 ? '...' : '') || 'Unknown',
                        completion: getCompletionPercentage(run.id),
                        fullName: run.location?.name
                      }))}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 100]} unit="%" />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                      <Tooltip 
                        formatter={(value: number) => [`${value}%`, 'Voortgang']}
                        labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                      />
                      <Bar dataKey="completion" fill="#f97316" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 2 */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Locations by City */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-green-600" />
                  APK Runs per Stad
                </CardTitle>
                <CardDescription>Aantal runs per stad</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={(() => {
                        const cityCount: Record<string, number> = {}
                        apkRuns.forEach(run => {
                          const city = run.location?.city || 'Onbekend'
                          cityCount[city] = (cityCount[city] || 0) + 1
                        })
                        return Object.entries(cityCount)
                          .map(([city, count]) => ({ city, count }))
                          .sort((a, b) => b.count - a.count)
                          .slice(0, 10)
                      })()}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="city" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={80} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#22c55e" name="Aantal" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Issues Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  Open Items Overzicht
                </CardTitle>
                <CardDescription>To-dos en errors per locatie</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={(() => {
                        const locationData: Record<string, { todos: number; errors: number; name: string }> = {}
                        allTodos.forEach(todo => {
                          const name = todo.run?.location?.name || 'Onbekend'
                          if (!locationData[name]) locationData[name] = { todos: 0, errors: 0, name }
                          locationData[name].todos++
                        })
                        allErrors.forEach(err => {
                          const name = err.run?.location?.name || 'Onbekend'
                          if (!locationData[name]) locationData[name] = { todos: 0, errors: 0, name }
                          locationData[name].errors++
                        })
                        return Object.values(locationData)
                          .sort((a, b) => (b.todos + b.errors) - (a.todos + a.errors))
                          .slice(0, 8)
                          .map(d => ({
                            ...d,
                            name: d.name.substring(0, 12) + (d.name.length > 12 ? '...' : '')
                          }))
                      })()}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="todos" fill="#3b82f6" name="To-Dos" stackId="a" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="errors" fill="#ef4444" name="Errors" stackId="a" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 3 */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-purple-600" />
                  APK Runs Timeline
                </CardTitle>
                <CardDescription>Aantal runs over tijd (laatste 30 dagen)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={(() => {
                        const last30Days: Record<string, number> = {}
                        const today = new Date()
                        for (let i = 29; i >= 0; i--) {
                          const date = new Date(today)
                          date.setDate(date.getDate() - i)
                          const key = date.toISOString().split('T')[0]
                          last30Days[key] = 0
                        }
                        apkRuns.forEach(run => {
                          const date = new Date(run.created_at).toISOString().split('T')[0]
                          if (last30Days[date] !== undefined) {
                            last30Days[date]++
                          }
                        })
                        return Object.entries(last30Days).map(([date, count]) => ({
                          date: new Date(date).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit' }),
                          runs: count
                        }))
                      })()}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="runs" stroke="#9333ea" strokeWidth={2} dot={{ fill: '#9333ea' }} name="APK Runs" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Summary Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-orange-600" />
                  Samenvatting
                </CardTitle>
                <CardDescription>Belangrijkste metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
                    <div>
                      <p className="text-sm text-orange-700">Totaal APK Runs</p>
                      <p className="text-3xl font-bold text-orange-900">{stats.total}</p>
                    </div>
                    <ClipboardCheck className="h-10 w-10 text-orange-600" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-700">Completion Rate</p>
                      <p className="text-2xl font-bold text-green-900">{stats.completionRate}%</p>
                    </div>
                    <div className="p-4 bg-yellow-50 rounded-lg">
                      <p className="text-sm text-yellow-700">Gem. Voortgang</p>
                      <p className="text-2xl font-bold text-yellow-900">{stats.avgCompletion}%</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-700">Open To-Dos</p>
                      <p className="text-2xl font-bold text-blue-900">{stats.openTodos}</p>
                    </div>
                    <div className="p-4 bg-red-50 rounded-lg">
                      <p className="text-sm text-red-700">Open Errors</p>
                      <p className="text-2xl font-bold text-red-900">{stats.openErrors}</p>
                    </div>
                  </div>

                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm text-purple-700">Unieke Locaties</p>
                    <p className="text-2xl font-bold text-purple-900">
                      {new Set(apkRuns.map(r => r.location_id)).size}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Location Details Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-orange-600" />
                Alle Locaties Overzicht
              </CardTitle>
              <CardDescription>Gedetailleerde status per locatie</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Locatie</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Stad</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Voortgang</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">To-Dos</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Errors</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Datum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apkRuns.map(run => {
                      const completion = getCompletionPercentage(run.id)
                      const runTodos = allTodos.filter(t => t.run_id === run.id).length
                      const runErrors = allErrors.filter(e => e.run_id === run.id).length
                      return (
                        <tr
                          key={run.id}
                          className="border-b hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => router.push(`/fletcher/${run.id}`)}
                        >
                          <td className="p-4 align-middle font-medium">{run.location?.name}</td>
                          <td className="p-4 align-middle text-muted-foreground">{run.location?.city}</td>
                          <td className="p-4 align-middle">
                            <Badge variant={run.status === 'submitted' || run.status === 'completed' ? 'success' : 'warning'}>
                              {run.status === 'submitted' || run.status === 'completed' ? 'Afgerond' : 'In Progress'}
                            </Badge>
                          </td>
                          <td className="p-4 align-middle">
                            <div className="flex items-center gap-2">
                              <Progress value={completion} className="w-20 h-2" />
                              <span className="text-sm font-medium">{completion}%</span>
                            </div>
                          </td>
                          <td className="p-4 align-middle">
                            {runTodos > 0 ? (
                              <Badge variant="outline" className="border-blue-300 text-blue-700">{runTodos}</Badge>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </td>
                          <td className="p-4 align-middle">
                            {runErrors > 0 ? (
                              <Badge variant="outline" className="border-red-300 text-red-700">{runErrors}</Badge>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </td>
                          <td className="p-4 align-middle text-sm text-muted-foreground">
                            {new Date(run.created_at).toLocaleDateString('nl-NL')}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
