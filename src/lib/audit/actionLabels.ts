/**
 * Audit-action label map — turns backend action codes (e.g. "auth.first-login.complete")
 * into plain-English phrases for display.
 *
 * Two label styles are exposed:
 *   - phrase(): lowercase verb phrase ("signed in"), suitable for "<Actor> <phrase>"
 *     sentences in the audit log feed.
 *   - sentence(): standalone sentence-case label ("Signed in"), suitable for the
 *     Recent Activity card on the dashboard where each entry is its own line.
 *
 * Keep this list aligned with the action codes emitted by apps/api/src/**.
 */

const PHRASES: Record<string, string> = {
  // Auth
  'auth.login.success':              'signed in',
  'auth.login.failure':              'failed sign-in attempt',
  'auth.login.lockout':              'account locked after too many failed attempts',
  'auth.login.blocked-status':       'sign-in blocked (account inactive)',
  'auth.logout':                     'signed out',
  'auth.first-login.complete':       'completed first-time password setup',
  'auth.password.reset':             'reset their password',
  'auth.password.reset.requested':   'requested a password reset',
  'auth.password.reset.requested.noop': 'requested a password reset (no account found)',

  // Employees
  'employee.create':                 'created an employee',
  'employee.update':                 'updated an employee profile',
  'employee.invite.resend':          'resent an invitation email',
  'employee.salary.create':          'set an employee’s salary',
  'employee.salary.update':          'updated an employee’s salary',
  'employee.status.change':          'changed an employee’s status',
  'employee.reassign-manager':       'reassigned an employee’s manager',

  // Leave
  'leave.create':                    'submitted a leave request',
  'leave.approve':                   'approved a leave request',
  'leave.reject':                    'rejected a leave request',
  'leave.cancel':                    'cancelled a leave request',
  'leave.escalated':                 'escalated a stale leave request to Admin',
  'leave.carry-forward':             'rolled over leave balances for the new year',
  'leave.balance.adjust':            'adjusted a leave balance',
  'leave.encashment.request.create': 'submitted a leave encashment request',
  'leave.encashment.approve':        'approved a leave encashment',
  'leave.encashment.reject':         'rejected a leave encashment',
  'leave.encashment.cancel':         'cancelled a leave encashment',
  'leave.encashment.escalate':       'escalated a leave encashment',
  'leave.encashment.admin-finalise': 'finalised a leave encashment',
  'leave.encashment.payment.paid':   'marked a leave encashment as paid',
  'leave.encashment.payment.reverse':'reversed a leave encashment payment',

  // Attendance
  'attendance.check-in':             'checked in',
  'attendance.check-out':            'checked out',
  'attendance.check-out.undo':       'undid a check-out',
  'attendance.late-mark.deducted':   'auto-deducted a leave day for late check-ins',
  'attendance.midnight-generate.run':'generated daily attendance rows',
  'regularisation.create':           'requested an attendance regularisation',
  'regularisation.approve':          'approved a regularisation request',
  'regularisation.reject':           'rejected a regularisation request',

  // Payroll
  'payroll.run.create':              'initiated a payroll run',
  'payroll.run.finalise':            'finalised a payroll run',
  'payroll.run.reverse':             'reversed a finalised payroll run',
  'payslip.tax.update':              'updated tax on a payslip',

  // Performance
  'performance.cycle.create':        'started a new performance cycle',
  'performance.cycle.close':         'closed a performance cycle',
  'performance.review.self-rating':  'submitted a self-rating',
  'performance.review.manager-rating':'submitted a manager rating',
  'performance.review.manager-change':'changed the rater for a review',
  'performance.goal.create':         'added a performance goal',
  'performance.goal.propose':        'proposed a performance goal',
  'performance.goal.update':         'updated a performance goal',
  'performance.deadline-nudge-7d':   'sent a 7-day deadline reminder',
  'performance.deadline-nudge-1d':   'sent a 1-day deadline reminder',

  // Masters
  'masters.department.created':      'added a department',
  'masters.designation.created':     'added a designation',

  // Configuration
  'config.attendance.update':        'updated attendance settings',
  'config.encashment.update':        'updated encashment settings',
  'config.holidays.replace':         'updated the holiday calendar',
  'config.leave.update':             'updated leave settings',
  'config.leave-quota.update':       'updated a leave quota',
  'config.leave-type.update':        'updated a leave type',
  'config.tax.update':               'updated the tax reference rate',

  // System / housekeeping
  'notifications.archive-90d':       'archived notifications older than 90 days',
  'idempotency-key.cleanup':         'cleaned up expired idempotency keys',
  'password-reset-tokens.cleanup':   'cleaned up expired password-reset tokens',
};

/** Lowercase verb phrase — e.g. "signed in". Used inside a larger sentence. */
export function actionPhrase(action: string): string {
  const direct = PHRASES[action];
  if (direct) return direct;
  // Heuristic fallback: split "module.verb" → "verb on module" with dashes spaced.
  const parts = action.split('.');
  if (parts.length >= 2) {
    const verb = parts[parts.length - 1]!.replace(/-/g, ' ');
    const module = parts[0]!.replace(/-/g, ' ');
    return `${verb} on ${module}`;
  }
  return action.replace(/[._-]+/g, ' ');
}

/** Standalone sentence-case label — e.g. "Signed in". Used on its own line. */
export function actionSentence(action: string): string {
  const p = actionPhrase(action);
  return p.charAt(0).toUpperCase() + p.slice(1);
}

/** Friendly module label for the activity feed sub-line. */
export function moduleLabel(module: string): string {
  switch (module.toLowerCase()) {
    case 'auth':           return 'Sign-in';
    case 'employees':      return 'People';
    case 'leave':          return 'Leave';
    case 'attendance':     return 'Attendance';
    case 'regularisation': return 'Attendance';
    case 'payroll':        return 'Payroll';
    case 'performance':    return 'Reviews';
    case 'notifications':  return 'Notifications';
    case 'configuration':  return 'Settings';
    case 'masters':        return 'Settings';
    case 'system':         return 'System';
    default:               return module.charAt(0).toUpperCase() + module.slice(1);
  }
}
