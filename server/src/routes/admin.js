const express = require('express');
const multer = require('multer');
const { Resend } = require('resend');
const { db } = require('../services/supabase');
const { uploadImage } = require('../services/cloudinary');
const { verifyToken, cityScope } = require('../middleware/auth');

const router = express.Router();
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Multer for resolve photo upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Invalid file type.'));
  }
});

const STATUS_LABELS = {
  pending: '⏳ Pending',
  assigned: '👤 Assigned',
  in_progress: '🔧 In Progress',
  resolved: '✅ Resolved',
  invalid: '❌ Invalid'
};

async function sendStatusEmail(issue, newStatus) {
  if (!issue.citizen_id || !resend) return;
  try {
    const citizen = await db.getCitizenById(issue.citizen_id);
    if (!citizen?.email) return;
    const statusLabel = STATUS_LABELS[newStatus] || newStatus;
    const trackUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/track/${issue.ticket_id}`;
    await resend.emails.send({
      from: 'CivicPulse <noreply@civpulse.in>',
      to: citizen.email,
      subject: `${statusLabel} — Your issue ${issue.ticket_id} has been updated`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #4f46e5; margin-bottom: 4px;">CivicPulse</h2>
          <p style="color: #64748b; font-size: 14px; margin-top: 0;">Status Update Notification</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p>Hi <strong>${citizen.name}</strong>,</p>
          <p>Your reported issue has been updated:</p>
          <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 20px 0;">
            <div style="font-size: 13px; color: #64748b; margin-bottom: 4px;">Ticket ID</div>
            <div style="font-size: 20px; font-weight: 800; color: #4f46e5;">${issue.ticket_id}</div>
            <div style="font-size: 13px; color: #64748b; margin-top: 16px; margin-bottom: 4px;">New Status</div>
            <div style="font-size: 18px; font-weight: 700; color: #1e293b;">${statusLabel}</div>
            ${issue.category ? `
              <div style="font-size: 13px; color: #64748b; margin-top: 16px; margin-bottom: 4px;">Category</div>
              <div style="font-size: 14px; color: #1e293b;">${issue.category.replace('_', ' ')}</div>
            ` : ''}
            ${newStatus === 'resolved' ? `
              <div style="margin-top: 16px; padding: 12px; background: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;">
                <p style="margin: 0; color: #166534; font-size: 13px;">🎉 The issue has been fixed! Please visit the location and verify the work, then confirm on CivicPulse.</p>
              </div>
            ` : ''}
          </div>
          <a href="${trackUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
            ${newStatus === 'resolved' ? 'Verify & React →' : 'Track Your Issue →'}
          </a>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">You received this because you reported an issue on CivicPulse.</p>
        </div>
      `
    });
    console.log(`[EMAIL] Status update sent to ${citizen.email} for ${issue.ticket_id}`);
  } catch (err) {
    console.error('[EMAIL] Failed to send status update:', err.message);
  }
}

const stripCitizenInfo = (issue) => {
  if (!issue) return issue;
  const { citizen_id, ...safe } = issue;
  return safe;
};

// Apply auth + city scoping
router.use(verifyToken);
router.use(cityScope);

/** GET /api/admin/issues */
router.get('/issues', async (req, res) => {
  try {
    const filters = {
      status: req.query.status || null,
      category: req.categoryFilter || req.query.category || null,
      city: req.cityFilter || req.query.city || null,
      ward: req.query.ward || null,
      from_date: req.query.from_date || null,
      to_date: req.query.to_date || null,
      limit: parseInt(req.query.limit) || 100,
      offset: parseInt(req.query.offset) || 0
    };
    Object.keys(filters).forEach(key => { if (filters[key] === null) delete filters[key]; });
    const issues = await db.getIssues(filters);
    const safeIssues = issues.map(stripCitizenInfo);
    res.json({ success: true, count: safeIssues.length, issues: safeIssues });
  } catch (error) {
    console.error('Error fetching admin issues:', error);
    res.status(500).json({ error: 'Failed to fetch issues.' });
  }
});

/** GET /api/admin/issues/:id */
router.get('/issues/:id', async (req, res) => {
  try {
    const issues = await db.getIssues({});
    const issue = issues.find(i => i.id === req.params.id);
    if (!issue) return res.status(404).json({ error: 'Issue not found.' });
    if (req.cityFilter && issue.city !== req.cityFilter) {
      return res.status(403).json({ error: 'Access denied. This issue is not in your city.' });
    }
    res.json({ success: true, issue: stripCitizenInfo(issue) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch issue.' });
  }
});

/** PATCH /api/admin/issues/:id — Update status (non-resolved) or admin notes */
router.patch('/issues/:id', async (req, res) => {
  try {
    if (req.admin.role === 'super_admin') {
      return res.status(403).json({ error: 'Super admin is observer-only.' });
    }

    const { status, admin_notes } = req.body;
    const validStatuses = ['pending', 'assigned', 'in_progress', 'invalid'];

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: status === 'resolved'
          ? 'Use POST /api/admin/issues/:id/resolve with a photo to mark as resolved.'
          : `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const issues = await db.getIssues({});
    const existingIssue = issues.find(i => i.id === req.params.id);
    if (!existingIssue) return res.status(404).json({ error: 'Issue not found.' });
    if (req.cityFilter && existingIssue.city !== req.cityFilter) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const updates = {};
    if (status) updates.status = status;
    if (admin_notes !== undefined) updates.admin_notes = admin_notes;

    const updated = await db.updateIssue(req.params.id, updates);
    if (!updated) return res.status(404).json({ error: 'Issue not found.' });

    if (status && status !== existingIssue.status) {
      sendStatusEmail(existingIssue, status);
    }

    res.json({ success: true, issue: stripCitizenInfo(updated) });
  } catch (error) {
    console.error('Error updating issue:', error);
    res.status(500).json({ error: 'Failed to update issue.' });
  }
});

/**
 * POST /api/admin/issues/:id/resolve
 * Requires a "resolved_photo" file upload. Marks issue as resolved.
 */
router.post('/issues/:id/resolve', upload.single('resolved_photo'), async (req, res) => {
  try {
    if (req.admin.role === 'super_admin') {
      return res.status(403).json({ error: 'Super admin is observer-only.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'A "resolved_photo" showing the fix is required to mark an issue as resolved.' });
    }

    const issues = await db.getIssues({});
    const existingIssue = issues.find(i => i.id === req.params.id);
    if (!existingIssue) return res.status(404).json({ error: 'Issue not found.' });
    if (req.cityFilter && existingIssue.city !== req.cityFilter) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    if (existingIssue.status === 'resolved') {
      return res.status(400).json({ error: 'Issue is already resolved.' });
    }

    // Upload the resolution photo
    const resolvedPhotoUrl = await uploadImage(req.file.buffer, req.file.originalname);

    // If this is a re-resolve after a dispute, clear citizen_reaction so the
    // citizen gets a fresh chance to confirm or dispute the new resolution.
    const wasDisputed = existingIssue.status === 'disputed';

    const updated = await db.updateIssue(req.params.id, {
      status: 'resolved',
      resolved_photo_url: resolvedPhotoUrl,
      admin_notes: req.body.admin_notes || existingIssue.admin_notes || null,
      ...(wasDisputed && { citizen_reaction: null })
    });

    if (!updated) return res.status(404).json({ error: 'Issue not found.' });

    // Notify citizen
    sendStatusEmail(existingIssue, 'resolved');

    res.json({ success: true, issue: stripCitizenInfo(updated) });
  } catch (error) {
    console.error('Error resolving issue:', error);
    res.status(500).json({ error: 'Failed to resolve issue.' });
  }
});

/** POST /api/admin/issues/:id/invalid */
router.post('/issues/:id/invalid', async (req, res) => {
  try {
    if (req.admin.role === 'super_admin') {
      return res.status(403).json({ error: 'Super admin is observer-only.' });
    }
    const updated = await db.updateIssue(req.params.id, {
      status: 'invalid',
      admin_notes: req.body.reason || 'Marked as invalid by admin'
    });
    if (!updated) return res.status(404).json({ error: 'Issue not found.' });
    res.json({ success: true, issue: stripCitizenInfo(updated) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark issue as invalid.' });
  }
});

/** GET /api/admin/analytics */
router.get('/analytics', async (req, res) => {
  try {
    const analytics = await db.getAnalytics(req.cityFilter);
    res.json({ success: true, ...analytics });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics.' });
  }
});

/** POST /api/admin/ping — Super admin pings a city admin */
router.post('/ping', async (req, res) => {
  try {
    if (req.admin.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only super admin can ping city admins.' });
    }
    const { issue_id, message } = req.body;
    if (!issue_id) return res.status(400).json({ error: 'issue_id is required.' });

    const issues = await db.getIssues({});
    const issue = issues.find(i => i.id === issue_id);
    if (!issue) return res.status(404).json({ error: 'Issue not found.' });

    const allAdmins = await db.getAdminsByCity(issue.city, issue.category);
    if (!allAdmins || allAdmins.length === 0) {
      return res.status(404).json({ error: `No admin found for ${issue.category || 'this category'} in ${issue.city}.` });
    }
    if (!resend) return res.status(500).json({ error: 'Email service not configured.' });

    const trackUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/admin/dashboard`;
    const pingMessage = message || 'This issue requires your immediate attention.';

    for (const cityAdmin of allAdmins) {
      await resend.emails.send({
        from: 'CivicPulse <noreply@civpulse.in>',
        to: cityAdmin.email,
        subject: `🔔 Action Required — ${issue.ticket_id} in ${issue.city}`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #4f46e5; margin-bottom: 4px;">CivicPulse</h2>
            <p style="color: #64748b; font-size: 14px; margin-top: 0;">Super Admin Notification</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p>Hi <strong>${cityAdmin.name}</strong>,</p>
            <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 12px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0; font-weight: 600; color: #92400e;">📢 ${pingMessage}</p>
            </div>
            <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 20px 0;">
              <div style="font-size: 13px; color: #64748b;">Ticket ID</div>
              <div style="font-size: 20px; font-weight: 800; color: #4f46e5;">${issue.ticket_id}</div>
              <div style="font-size: 13px; color: #64748b; margin-top: 12px;">Category</div>
              <div style="font-size: 14px; text-transform: capitalize;">${(issue.category || '').replace('_', ' ')}</div>
              <div style="font-size: 13px; color: #64748b; margin-top: 12px;">Status</div>
              <div style="font-size: 14px; font-weight: 600; text-transform: capitalize;">${(issue.status || '').replace('_', ' ')}</div>
            </div>
            <a href="${trackUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Open Dashboard →</a>
          </div>
        `
      });
    }
    res.json({ success: true, message: `Pinged ${allAdmins.length} admin(s) for ${issue.city}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to ping city admin.' });
  }
});

module.exports = router;