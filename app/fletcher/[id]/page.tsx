'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { FletcherApkRunWithRelations, FletcherApkCheckItem, FletcherApkTodo, FletcherApkError } from '@/types'
import { FLETCHER_CHECKLIST, getTotalChecklistItems } from '@/lib/fletcherChecklist'
import toast from 'react-hot-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  User,
  Building2,
  ClipboardCheck,
  FileText,
  CheckSquare,
  Plus,
  Trash2,
  Save,
  MessageSquare,
  X,
  AlertTriangle
} from 'lucide-react'

export default function FletcherApkDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [run, setRun] = useState<FletcherApkRunWithRelations | null>(null)
  const [checkItems, setCheckItems] = useState<FletcherApkCheckItem[]>([])
  const [todos, setTodos] = useState<FletcherApkTodo[]>([])
  const [apkErrors, setApkErrors] = useState<FletcherApkError[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Open questions state
  const [q1, setQ1] = useState('')
  const [q2, setQ2] = useState('')
  
  // Meeting notes state
  const [meetingNotes, setMeetingNotes] = useState('')
  const [showMeetingNotes, setShowMeetingNotes] = useState(false)
  
  // New todo state
  const [newTodoText, setNewTodoText] = useState('')
  
  // New error state
  const [newErrorText, setNewErrorText] = useState('')

  const totalItems = getTotalChecklistItems()

  useEffect(() => {
    if (params.id) {
      loadData()
    }
  }, [params.id])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Check access
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!profile || (profile.role !== 'admin' && profile.role !== 'fletcher_admin')) {
        toast.error('Access denied')
        router.push('/dashboard')
        return
      }

      // Load run
      const { data: runData, error: runError } = await supabase
        .from('fletcher_apk_runs')
        .select(`
          *,
          location:locations(*),
          creator:profiles(id, name, nickname)
        `)
        .eq('id', params.id)
        .single()

      if (runError) throw runError
      setRun(runData)
      setQ1(runData.open_q1_knelpunten || '')
      setQ2(runData.open_q2_meerwaarde || '')
      setMeetingNotes(runData.meeting_notes || '')

      // Load check items
      const { data: itemsData } = await supabase
        .from('fletcher_apk_check_items')
        .select('*')
        .eq('run_id', params.id)

      setCheckItems(itemsData || [])

      // Load todos
      const { data: todosData } = await supabase
        .from('fletcher_apk_todos')
        .select('*')
        .eq('run_id', params.id)
        .order('created_at', { ascending: true })

      setTodos(todosData || [])

      // Load errors
      const { data: errorsData } = await supabase
        .from('fletcher_apk_errors')
        .select('*')
        .eq('run_id', params.id)
        .order('created_at', { ascending: false })

      setApkErrors(errorsData || [])

    } catch (error: any) {
      toast.error(error.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  // Toggle check item
  const toggleCheckItem = async (itemKey: string, currentChecked: boolean) => {
    const item = checkItems.find(i => i.item_key === itemKey)
    if (!item) return

    // Optimistic update
    setCheckItems(prev => prev.map(i => 
      i.item_key === itemKey ? { ...i, checked: !currentChecked } : i
    ))

    const { error } = await supabase
      .from('fletcher_apk_check_items')
      .update({ checked: !currentChecked })
      .eq('id', item.id)

    if (error) {
      // Revert on error
      setCheckItems(prev => prev.map(i => 
        i.item_key === itemKey ? { ...i, checked: currentChecked } : i
      ))
      toast.error('Failed to save')
    }
  }

  // Save all (open questions + meeting notes)
  const saveAll = async () => {
    if (!run) return
    setSaving(true)
    const { error } = await supabase
      .from('fletcher_apk_runs')
      .update({
        open_q1_knelpunten: q1,
        open_q2_meerwaarde: q2,
        meeting_notes: meetingNotes,
      })
      .eq('id', run.id)

    if (error) {
      toast.error('Opslaan mislukt')
    } else {
      toast.success('Alles opgeslagen!')
    }
    setSaving(false)
  }

  // Add new error
  const addError = async () => {
    if (!run || !newErrorText.trim()) return
    
    const { data, error } = await supabase
      .from('fletcher_apk_errors')
      .insert({
        run_id: run.id,
        text: newErrorText.trim(),
      })
      .select()
      .single()

    if (error) {
      toast.error('Error toevoegen mislukt')
    } else {
      setApkErrors([data, ...apkErrors])
      setNewErrorText('')
      toast.success('Error toegevoegd')
    }
  }

  // Toggle error resolved
  const toggleErrorResolved = async (errorId: string, currentResolved: boolean) => {
    // Optimistic update
    setApkErrors(apkErrors.map(e => 
      e.id === errorId ? { ...e, resolved: !currentResolved } : e
    ))

    const { error } = await supabase
      .from('fletcher_apk_errors')
      .update({ resolved: !currentResolved })
      .eq('id', errorId)

    if (error) {
      // Revert on error
      setApkErrors(apkErrors.map(e => 
        e.id === errorId ? { ...e, resolved: currentResolved } : e
      ))
      toast.error('Update mislukt')
    }
  }

  // Delete error
  const deleteError = async (errorId: string) => {
    const errorToDelete = apkErrors.find(e => e.id === errorId)
    
    // Optimistic update
    setApkErrors(apkErrors.filter(e => e.id !== errorId))

    const { error } = await supabase
      .from('fletcher_apk_errors')
      .delete()
      .eq('id', errorId)

    if (error) {
      // Revert on error
      if (errorToDelete) {
        setApkErrors([...apkErrors])
      }
      toast.error('Verwijderen mislukt')
    }
  }

  // Save open questions
  const saveOpenQuestions = async () => {
    if (!run) return
    setSaving(true)
    const { error } = await supabase
      .from('fletcher_apk_runs')
      .update({
        open_q1_knelpunten: q1,
        open_q2_meerwaarde: q2,
      })
      .eq('id', run.id)

    if (error) {
      toast.error('Failed to save')
    } else {
      toast.success('Opgeslagen')
    }
    setSaving(false)
  }

  // Save meeting notes
  const saveMeetingNotes = async () => {
    if (!run) return
    setSaving(true)
    const { error } = await supabase
      .from('fletcher_apk_runs')
      .update({ meeting_notes: meetingNotes })
      .eq('id', run.id)

    if (error) {
      toast.error('Failed to save')
    } else {
      toast.success('Meeting notes opgeslagen')
      setShowMeetingNotes(false)
    }
    setSaving(false)
  }

  // Add todo
  const addTodo = async () => {
    if (!run || !newTodoText.trim()) return
    
    const { data, error } = await supabase
      .from('fletcher_apk_todos')
      .insert({
        run_id: run.id,
        text: newTodoText.trim(),
        done: false,
      })
      .select()
      .single()

    if (error) {
      toast.error('Failed to add todo')
    } else {
      setTodos(prev => [...prev, data])
      setNewTodoText('')
    }
  }

  // Toggle todo
  const toggleTodo = async (todoId: string, currentDone: boolean) => {
    setTodos(prev => prev.map(t => 
      t.id === todoId ? { ...t, done: !currentDone } : t
    ))

    const { error } = await supabase
      .from('fletcher_apk_todos')
      .update({ done: !currentDone })
      .eq('id', todoId)

    if (error) {
      setTodos(prev => prev.map(t => 
        t.id === todoId ? { ...t, done: currentDone } : t
      ))
      toast.error('Failed to update todo')
    }
  }

  // Delete todo
  const deleteTodo = async (todoId: string) => {
    const { error } = await supabase
      .from('fletcher_apk_todos')
      .delete()
      .eq('id', todoId)

    if (error) {
      toast.error('Failed to delete todo')
    } else {
      setTodos(prev => prev.filter(t => t.id !== todoId))
    }
  }

  // Mark as submitted
  const markAsSubmitted = async () => {
    if (!run) return
    const { error } = await supabase
      .from('fletcher_apk_runs')
      .update({ status: 'submitted' })
      .eq('id', run.id)

    if (error) {
      toast.error('Failed to update status')
    } else {
      setRun(prev => prev ? { ...prev, status: 'submitted' } : null)
      toast.success('APK afgerond!')
    }
  }

  // Get check status for an item
  const getCheckStatus = (itemKey: string): boolean => {
    const item = checkItems.find(i => i.item_key === itemKey)
    return item?.checked || false
  }

  // Calculate completion
  const checkedCount = checkItems.filter(i => i.checked).length
  const completionPercent = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading APK data...</div>
      </div>
    )
  }

  if (!run) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-muted-foreground">APK run not found</p>
        <Button variant="outline" onClick={() => router.push('/fletcher')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Terug naar dashboard
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/fletcher')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-orange-600" />
            Fletcher APK Check
          </h1>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              {run.location?.name}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {run.location?.city}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button 
            onClick={saveAll} 
            disabled={saving}
            size="lg"
            className="bg-orange-600 hover:bg-orange-700"
          >
            <Save className="h-5 w-5 mr-2" />
            {saving ? 'Opslaan...' : 'Alles Opslaan'}
          </Button>
          <Button variant="outline" onClick={() => setShowMeetingNotes(true)}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Meeting Notes
          </Button>
          {run.status === 'draft' && (
            <Button onClick={markAsSubmitted} className="bg-green-600 hover:bg-green-700">
              <CheckSquare className="h-4 w-4 mr-2" />
              Afronden
            </Button>
          )}
        </div>
      </div>

      {/* Progress & Info */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Voortgang</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Progress value={completionPercent} className="flex-1" />
              <span className="text-lg font-bold">{completionPercent}%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {checkedCount} van {totalItems} items afgevinkt
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={run.status === 'submitted' ? 'success' : 'warning'} className="text-base">
              {run.status === 'submitted' ? 'Afgerond' : 'In Progress'}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Details</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4" />
              {run.creator?.nickname || run.creator?.name}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground mt-1">
              <Calendar className="h-4 w-4" />
              {new Date(run.created_at).toLocaleDateString('nl-NL', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Checklist Sections */}
      {FLETCHER_CHECKLIST.map(section => (
        <Card key={section.key}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-orange-600" />
              {section.title}
            </CardTitle>
            <CardDescription>
              {section.items.filter(item => getCheckStatus(item.key)).length} / {section.items.length} items afgevinkt
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {section.items.map(item => (
                <div
                  key={item.key}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => toggleCheckItem(item.key, getCheckStatus(item.key))}
                >
                  <Checkbox
                    checked={getCheckStatus(item.key)}
                    onCheckedChange={() => toggleCheckItem(item.key, getCheckStatus(item.key))}
                    className="mt-0.5"
                  />
                  <span className={getCheckStatus(item.key) ? 'text-muted-foreground line-through' : ''}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Open Questions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Open Vragen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              Wat waren de belangrijkste knelpunten afgelopen jaar?
            </label>
            <textarea
              value={q1}
              onChange={(e) => setQ1(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Beschrijf de knelpunten..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              Waar zien jullie de meerwaarde van QR-codes voor komend jaar?
            </label>
            <textarea
              value={q2}
              onChange={(e) => setQ2(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Beschrijf de meerwaarde..."
            />
          </div>
          <Button onClick={saveOpenQuestions} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Opslaan...' : 'Antwoorden Opslaan'}
          </Button>
        </CardContent>
      </Card>

      {/* Errors */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Errors / Problemen
          </CardTitle>
          <CardDescription>
            {apkErrors.filter(e => !e.resolved).length} openstaand, {apkErrors.filter(e => e.resolved).length} opgelost
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Add new error */}
          <div className="flex gap-2 mb-4">
            <Input
              type="text"
              value={newErrorText}
              onChange={(e) => setNewErrorText(e.target.value)}
              placeholder="Nieuwe error toevoegen..."
              className="border-red-200 focus:ring-red-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addError()
                }
              }}
            />
            <Button 
              onClick={addError} 
              variant="outline" 
              className="border-red-200 text-red-600 hover:bg-red-50"
              disabled={!newErrorText.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Error list */}
          {apkErrors.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nog geen errors gemeld
            </p>
          ) : (
            <div className="space-y-2">
              {apkErrors.map(err => (
                <div
                  key={err.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    err.resolved 
                      ? 'bg-green-50/50 border-green-200' 
                      : 'bg-red-50/50 border-red-200'
                  }`}
                >
                  <Checkbox
                    checked={err.resolved}
                    onCheckedChange={() => toggleErrorResolved(err.id, err.resolved)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${err.resolved ? 'line-through text-muted-foreground' : ''}`}>
                      {err.text}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(err.created_at).toLocaleDateString('nl-NL', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteError(err.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* To Do&apos;s */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-green-600" />
            To Do&apos;s
          </CardTitle>
          <CardDescription>
            {todos.filter(t => t.done).length} van {todos.length} afgerond
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Add new todo */}
          <div className="flex gap-2 mb-4">
            <Input
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              placeholder="Nieuw to-do item..."
              onKeyDown={(e) => e.key === 'Enter' && addTodo()}
            />
            <Button onClick={addTodo} disabled={!newTodoText.trim()}>
              <Plus className="h-4 w-4 mr-1" />
              Toevoegen
            </Button>
          </div>

          {/* Todo list */}
          {todos.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Nog geen to-do items. Voeg er een toe hierboven.
            </p>
          ) : (
            <div className="space-y-2">
              {todos.map(todo => (
                <div
                  key={todo.id}
                  className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg"
                >
                  <Checkbox
                    checked={todo.done}
                    onCheckedChange={() => toggleTodo(todo.id, todo.done)}
                  />
                  <span className={`flex-1 ${todo.done ? 'text-muted-foreground line-through' : ''}`}>
                    {todo.text}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => deleteTodo(todo.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Floating Save Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <Button 
          onClick={saveAll} 
          disabled={saving}
          size="lg"
          className="bg-orange-600 hover:bg-orange-700 shadow-lg h-14 px-6 text-lg"
        >
          <Save className="h-6 w-6 mr-2" />
          {saving ? 'Opslaan...' : 'Alles Opslaan'}
        </Button>
      </div>

      {/* Meeting Notes Modal */}
      {showMeetingNotes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowMeetingNotes(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-orange-600" />
                Meeting Notes
              </h2>
              <button onClick={() => setShowMeetingNotes(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              <textarea
                value={meetingNotes}
                onChange={(e) => setMeetingNotes(e.target.value)}
                rows={12}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="Notities van de meeting..."
              />
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <Button variant="outline" onClick={() => setShowMeetingNotes(false)}>
                Annuleren
              </Button>
              <Button onClick={saveMeetingNotes} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Opslaan...' : 'Opslaan'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
