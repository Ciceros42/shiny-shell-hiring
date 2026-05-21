// Re-export from the real implementation so Task 11's booking route
// doesn't need updating when Task 12 is complete.
export { createInterviewEvent } from '@/lib/google-calendar/sync'
