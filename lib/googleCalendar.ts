// Google Calendar URL generator
// Creates a link that opens Google Calendar with pre-filled event details

interface CalendarEvent {
  title: string
  description?: string
  location?: string
  startDate: Date
  endDate?: Date
  allDay?: boolean
}

export function generateGoogleCalendarUrl(event: CalendarEvent): string {
  const baseUrl = 'https://calendar.google.com/calendar/render'
  
  const params = new URLSearchParams()
  params.append('action', 'TEMPLATE')
  params.append('text', event.title)
  
  if (event.description) {
    params.append('details', event.description)
  }
  
  if (event.location) {
    params.append('location', event.location)
  }
  
  // Format dates for Google Calendar
  // All-day events use YYYYMMDD format
  // Timed events use YYYYMMDDTHHMMSS format (in UTC)
  if (event.allDay) {
    const startStr = formatDateForCalendar(event.startDate, true)
    const endDate = event.endDate || new Date(event.startDate.getTime() + 24 * 60 * 60 * 1000)
    const endStr = formatDateForCalendar(endDate, true)
    params.append('dates', `${startStr}/${endStr}`)
  } else {
    const startStr = formatDateForCalendar(event.startDate, false)
    const endDate = event.endDate || new Date(event.startDate.getTime() + 60 * 60 * 1000) // Default 1 hour
    const endStr = formatDateForCalendar(endDate, false)
    params.append('dates', `${startStr}/${endStr}`)
  }
  
  return `${baseUrl}?${params.toString()}`
}

function formatDateForCalendar(date: Date, allDay: boolean): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  
  if (allDay) {
    return `${year}${month}${day}`
  }
  
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = '00'
  
  return `${year}${month}${day}T${hours}${minutes}${seconds}`
}

// Helper to create a todo calendar event
export function createTodoCalendarEvent(
  todoText: string,
  locationName?: string,
  locationCity?: string,
  dueDate?: Date
): string {
  const event: CalendarEvent = {
    title: `TODO: ${todoText}`,
    description: `Fletcher APK Todo\n\n${todoText}`,
    location: locationName ? `${locationName}${locationCity ? `, ${locationCity}` : ''}` : undefined,
    startDate: dueDate || new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow by default
    allDay: true
  }
  
  return generateGoogleCalendarUrl(event)
}

// Helper to create a visit calendar event
export function createVisitCalendarEvent(
  locationName: string,
  locationCity?: string,
  locationAddress?: string,
  visitDate?: Date,
  notes?: string
): string {
  const event: CalendarEvent = {
    title: `Visit: ${locationName}`,
    description: `Geplande visit${notes ? `\n\nNotities:\n${notes}` : ''}`,
    location: locationAddress || (locationCity ? `${locationName}, ${locationCity}` : locationName),
    startDate: visitDate || new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow by default
    allDay: false
  }
  
  // Set a 1 hour meeting
  event.endDate = new Date(event.startDate.getTime() + 60 * 60 * 1000)
  
  return generateGoogleCalendarUrl(event)
}

// Helper to create a Fletcher APK calendar event
export function createFletcherApkCalendarEvent(
  locationName: string,
  locationCity?: string,
  visitDate?: Date
): string {
  const event: CalendarEvent = {
    title: `Fletcher APK: ${locationName}`,
    description: `Fletcher APK Checklist afspraak\n\nLocatie: ${locationName}${locationCity ? `, ${locationCity}` : ''}`,
    location: locationCity ? `${locationName}, ${locationCity}` : locationName,
    startDate: visitDate || new Date(Date.now() + 24 * 60 * 60 * 1000),
    allDay: false
  }
  
  // Set a 2 hour meeting for APK
  event.endDate = new Date(event.startDate.getTime() + 2 * 60 * 60 * 1000)
  
  return generateGoogleCalendarUrl(event)
}

// Helper to create a calendar event with all todos as a task list
export function createTodoListCalendarEvent(
  todos: { text: string; done: boolean }[],
  locationName: string,
  locationCity?: string,
  eventDate?: Date
): string {
  const openTodos = todos.filter(t => !t.done)
  
  // Build a checklist in the description
  const taskList = openTodos.map((todo, index) => `${index + 1}. [ ] ${todo.text}`).join('\n')
  
  const startDate = eventDate || new Date(Date.now() + 24 * 60 * 60 * 1000)
  
  const event: CalendarEvent = {
    title: `Vervolg APK: ${locationName}`,
    description: `Fletcher APK Vervolgacties\n\nLocatie: ${locationName}${locationCity ? `, ${locationCity}` : ''}\n\n` +
      `TAKENLIJST (${openTodos.length} items):\n` +
      `${'='.repeat(30)}\n` +
      taskList +
      `\n${'='.repeat(30)}\n\n` +
      `TIP: Klik rechts op dit event in Google Calendar en kies "Convert to task" om het als afvinkbare taak te gebruiken!`,
    location: locationCity ? `${locationName}, ${locationCity}` : locationName,
    startDate: startDate,
    allDay: false // Now uses specific time
  }
  
  // Set 1 hour duration
  event.endDate = new Date(startDate.getTime() + 60 * 60 * 1000)
  
  return generateGoogleCalendarUrl(event)
}
