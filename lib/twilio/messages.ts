const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL

export const SMS = {
  screenLink: (name: string, url: string, urgentShift?: string) => {
    const shift = urgentShift ? ` We especially need help with ${urgentShift}.` : ''
    return `Hi ${name}! Thanks for applying to Shiny Shell Carwash.${shift} Click here to start your 3-minute phone screening (valid 24hrs): ${url}`
  },

  screenReminder: (url: string) =>
    `Reminder: Your Shiny Shell screening link expires soon. Tap here to complete it: ${url}`,

  pass: (scheduleUrl: string) =>
    `Thank you for your interest in Shiny Shell Carwash! Please use the link below to schedule a follow-up interview with one of our managers: ${scheduleUrl}`,

  fail: () =>
    `Thank you for your application to Shiny Shell Carwash. We appreciate your time and wish you all the best.`,

  interviewConfirmation: (dateStr: string, location: string) =>
    `Your Shiny Shell interview is confirmed for ${dateStr} at ${location}. Reply R to reschedule.`,

  interviewReminder: (dateStr: string) =>
    `Reminder: Your Shiny Shell interview is tomorrow at ${dateStr}. Reply R to reschedule.`,

  interviewReminderSameDay: (timeStr: string) =>
    `Reminder: Your Shiny Shell interview is today at ${timeStr}. See you soon!`,

  rescheduleLink: (url: string) =>
    `No problem! Here's a new link to pick a different interview time: ${url} (valid 48hrs)`,

  reengagePassedNoSchedule: (url: string) =>
    `Hi again! We still have openings at Shiny Shell. Pick your interview time here: ${url}`,

  fullyStaffed: () =>
    `Thanks for your interest in Shiny Shell Carwash! We're fully staffed right now but we'll reach out when a position opens up.`,

  talentPoolReengage: (url: string) =>
    `Hi! A position just opened at Shiny Shell Carwash. Interested? Apply here: ${url}`,

  retentionCheckin: (name: string) =>
    `Hi, this is Shiny Shell Hiring. Is ${name} still working with us? Reply YES or NO.`,

  slotShortage: (calendarUrl: string) =>
    `Heads up: you have fewer than 3 interview slots available this week. Add more here: ${calendarUrl}`,

  managerFitPrompt: (applicantName: string) =>
    `How did your interview with ${applicantName} go? Reply GOOD, OK, or NO.`,

  disconnectedDuringScreen: (url: string) =>
    `Looks like we got disconnected during your Shiny Shell screening. Tap here to pick up where you left off: ${url}`,
}
