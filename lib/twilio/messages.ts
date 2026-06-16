const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL

export const SMS = {
  screenLink: (name: string, url: string, urgentShift?: string, companyName = 'Shiny Shell Carwash', statusUrl?: string) => {
    const shift = urgentShift ? ` We especially need help with ${urgentShift}.` : ''
    const status = statusUrl ? ` Track your status: ${statusUrl}` : ''
    return `Hi ${name}! Thanks for applying to ${companyName}.${shift} Click here to start your 3-minute phone screening (valid 24hrs): ${url}${status}`
  },

  screenReminder: (url: string, companyName = 'Shiny Shell') =>
    `Reminder: Your ${companyName} screening link expires soon. Tap here to complete it: ${url}`,

  pass: (scheduleUrl: string, companyName = 'Shiny Shell Carwash') =>
    `Thank you for your interest in ${companyName}! Please use the link below to schedule a follow-up interview with one of our managers: ${scheduleUrl}`,

  fail: (companyName = 'Shiny Shell Carwash') =>
    `Thank you for your application to ${companyName}. We appreciate your time and wish you all the best.`,

  interviewConfirmation: (dateStr: string, location: string, companyName = 'Shiny Shell') =>
    `Your ${companyName} interview is confirmed for ${dateStr} at ${location}. Reply R to reschedule.`,

  interviewReminder: (dateStr: string, companyName = 'Shiny Shell') =>
    `Reminder: Your ${companyName} interview is tomorrow at ${dateStr}. Reply R to reschedule.`,

  interviewReminderSameDay: (timeStr: string, companyName = 'Shiny Shell') =>
    `Reminder: Your ${companyName} interview is today at ${timeStr}. See you soon!`,

  interviewMeetLink: (meetLink: string, companyName = 'Shiny Shell') =>
    `Your ${companyName} interview starts in 5 minutes. Join the Google Meet here: ${meetLink}`,

  rescheduleLink: (url: string) =>
    `No problem! Here's a new link to pick a different interview time: ${url} (valid 48hrs)`,

  reengagePassedNoSchedule: (url: string, companyName = 'Shiny Shell') =>
    `Hi again! We still have openings at ${companyName}. Pick your interview time here: ${url}`,

  fullyStaffed: (companyName = 'Shiny Shell Carwash') =>
    `Thanks for your interest in ${companyName}! We're fully staffed right now but we'll reach out when a position opens up.`,

  talentPoolReengage: (url: string, companyName = 'Shiny Shell Carwash') =>
    `Hi! A position just opened at ${companyName}. Interested? Apply here: ${url}`,

  retentionCheckin: (name: string, companyName = 'Shiny Shell') =>
    `Hi, this is ${companyName} Hiring. Is ${name} still working with us? Reply YES or NO.`,

  slotShortage: (calendarUrl: string) =>
    `Heads up: you have fewer than 3 interview slots available this week. Add more here: ${calendarUrl}`,

  managerFitPrompt: (applicantName: string) =>
    `How did your interview with ${applicantName} go? Reply GOOD, OK, or NO.`,

  disconnectedDuringScreen: (url: string, companyName = 'Shiny Shell') =>
    `Looks like we got disconnected during your ${companyName} screening. Tap here to pick up where you left off: ${url}`,

  hired: (name: string, companyName = 'Shiny Shell Carwash') =>
    `Congratulations ${name}! We'd love to have you join the team at ${companyName}. We'll be in touch shortly with next steps.`,
}
