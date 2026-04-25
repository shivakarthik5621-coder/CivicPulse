const { db } = require('./supabase');
const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

async function sendOverdueAlert(issue, admins) {
  if (!resend || !admins.length) return;

  for (const admin of admins) {
    try {
      await resend.emails.send({
        from: 'CivicPulse <noreply@civpulse.in>',
        to: admin.email,
        subject: `⚠️ OVERDUE — Issue ${issue.ticket_id} Deadline Passed`,
        html: `
          <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #ef4444; margin-bottom: 4px;">⚠️ Action Required — Deadline Passed</h2>
            <p style="color: #64748b; font-size: 14px; margin-top: 0;">CivicPulse Deadline Alert</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />

            <p>Hi <strong>${admin.name}</strong>,</p>
            <p>The following civic issue has <strong style="color:#ef4444;">exceeded its 6-day resolution deadline</strong> and remains unresolved:</p>

            <div style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 12px; padding: 20px; margin: 20px 0;">
              <div style="font-size: 13px; color: #991b1b; margin-bottom: 4px;">Ticket ID</div>
              <div style="font-size: 22px; font-weight: 800; color: #dc2626;">${issue.ticket_id}</div>

              <div style="font-size: 13px; color: #991b1b; margin-top: 16px; margin-bottom: 4px;">Category</div>
              <div style="font-size: 14px; font-weight: 600; color: #1e293b; text-transform: capitalize;">${(issue.category || '').replace(/_/g, ' ')}</div>

              <div style="font-size: 13px; color: #991b1b; margin-top: 16px; margin-bottom: 4px;">Current Status</div>
              <div style="font-size: 14px; font-weight: 600; color: #f59e0b; text-transform: capitalize;">${(issue.status || '').replace(/_/g, ' ')}</div>

              <div style="font-size: 13px; color: #991b1b; margin-top: 16px; margin-bottom: 4px;">Location</div>
              <div style="font-size: 14px; color: #1e293b;">${issue.city || '—'}, ${issue.ward || '—'}</div>

              <div style="font-size: 13px; color: #991b1b; margin-top: 16px; margin-bottom: 4px;">Deadline Was</div>
              <div style="font-size: 14px; font-weight: 600; color: #dc2626;">
                ${new Date(issue.deadline_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            <a href="${CLIENT_URL}/admin/dashboard" style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
              Resolve This Issue Now →
            </a>

            <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">
              This is an automated alert from CivicPulse. Please resolve the issue immediately or escalate it.
            </p>
          </div>
        `
      });
      console.log(`[DEADLINE] Alert sent to ${admin.email} for ${issue.ticket_id}`);
    } catch (err) {
      console.error(`[DEADLINE] Failed to alert ${admin.email}:`, err.message);
    }
  }
}

async function checkDeadlines() {
  try {
    const overdueIssues = await db.getOverdueIssues();
    if (overdueIssues.length === 0) return;

    console.log(`[DEADLINE] Found ${overdueIssues.length} overdue issue(s)`);

    for (const issue of overdueIssues) {
      // Find responsible city admins
      const admins = issue.city
        ? await db.getAdminsByCity(issue.city, issue.category)
        : [];

      await sendOverdueAlert(issue, admins);
      await db.markDeadlineAlertSent(issue.id);
    }
  } catch (err) {
    console.error('[DEADLINE] Checker error:', err.message);
  }
}

// Run every hour
function startDeadlineChecker() {
  console.log('🕐 Deadline checker started (checks every hour)');
  checkDeadlines(); // run once on startup
  setInterval(checkDeadlines, 60 * 60 * 1000);
}

module.exports = { startDeadlineChecker, checkDeadlines };
