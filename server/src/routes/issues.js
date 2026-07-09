const express = require('express');
const multer = require('multer');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');
const { db } = require('../services/supabase');
const { uploadImage } = require('../services/cloudinary');
const { classifyImage } = require('../services/classifier');
const { generateTicketId } = require('../utils/ticketId');
const { submitLimiter } = require('../middleware/rateLimit');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// Configure multer for file uploads (in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and HEIC images are allowed.'));
    }
  }
});

/**
 * POST /api/issues — Submit a new civic issue
 * Body (multipart): photo (file), latitude, longitude, description, category (optional override)
 */
router.post('/', submitLimiter, upload.single('photo'), async (req, res) => {
  try {
    const { latitude, longitude, description, category: citizenCategory } = req.body;

    // Validate required fields
    if (!req.file) {
      return res.status(400).json({ error: 'Photo is required.' });
    }
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Location (latitude and longitude) is required.' });
    }

    // Extract citizen_id from JWT — login required
    let citizenId = null;
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Login required to report an issue.' });
    }
    try {
      const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
      if (decoded.type !== 'citizen') {
        return res.status(401).json({ error: 'Citizen login required.' });
      }
      citizenId = decoded.id;
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token. Please login again.' });
    }

    // 1. Upload photo to Cloudinary (or get base64 URL)
    const photoUrl = await uploadImage(req.file.buffer, req.file.originalname);

    // 2. Classify photo using AI service
    const classification = await classifyImage(photoUrl);

    // 3. Reverse geocode to get city and ward
    let city = req.body.city || 'Unknown';
    let ward = req.body.ward || 'Unknown';
    try {
      const geoResponse = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
        { headers: { 'User-Agent': 'CivicPulse/1.0 (contact: nikkisai7379@gmail.com)' }, timeout: 5000 }
      );
      console.log('Nominatim raw response:', JSON.stringify(geoResponse.data));
      if (geoResponse.data && geoResponse.data.address) {
        const addr = geoResponse.data.address;
        city = addr.city || addr.town || addr.village || addr.municipality ||
               addr.county || addr.state_district || city;
        ward = addr.suburb || addr.neighbourhood || addr.quarter || addr.road || ward;
      } else if (geoResponse.data && geoResponse.data.error) {
        console.warn('Nominatim returned an error payload:', geoResponse.data.error);
      }
    } catch (geoErr) {
      console.warn('Reverse geocoding failed, using provided city/ward:',
        geoErr.response ? `HTTP ${geoErr.response.status}` : geoErr.message);
    }

    // 4. Generate ticket ID
    const ticketId = generateTicketId();

    // 5. Use citizen's override category if provided, otherwise use AI
    const finalCategory = citizenCategory || classification.category;

    // 6. Save to database
    const issue = await db.createIssue({
      ticket_id: ticketId,
      photo_url: photoUrl,
      category: finalCategory,
      ai_category: classification.category,
      ai_confidence: classification.confidence,
      description: description || null,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      city,
      ward,
      status: 'pending',
      citizen_id: citizenId
    });

    // 7. Send confirmation email
    if (citizenId && resend) {
      try {
        const citizen = await db.getCitizenById(citizenId);
        if (citizen?.email) {
          const trackUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/track/${ticketId}`;
          await resend.emails.send({
            from: 'CivicPulse <noreply@civpulse.in>',
            to: citizen.email,
            subject: `Report Submitted — ${ticketId}`,
            html: `
              <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
                <h2 style="color: #4f46e5; margin-bottom: 4px;">CivicPulse</h2>
                <p style="color: #64748b; font-size: 14px; margin-top: 0;">Report Confirmation</p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                
                <p>Hi <strong>${citizen.name}</strong>,</p>
                <p>Your civic issue has been submitted successfully! Here are the details:</p>
                
                <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 20px 0;">
                  <div style="font-size: 13px; color: #64748b; margin-bottom: 4px;">Ticket ID</div>
                  <div style="font-size: 24px; font-weight: 800; color: #4f46e5; letter-spacing: 0.03em;">${ticketId}</div>
                  
                  <div style="font-size: 13px; color: #64748b; margin-top: 16px; margin-bottom: 4px;">Category</div>
                  <div style="font-size: 14px; font-weight: 600; color: #1e293b;">${(finalCategory || 'auto-detected').replace('_', ' ')}</div>
                  
                  <div style="font-size: 13px; color: #64748b; margin-top: 16px; margin-bottom: 4px;">Status</div>
                  <div style="font-size: 14px; font-weight: 600; color: #f59e0b;">⏳ Pending</div>
                  
                  <div style="font-size: 13px; color: #64748b; margin-top: 16px; margin-bottom: 4px;">Location</div>
                  <div style="font-size: 14px; color: #1e293b;">${city || 'Auto-detected'}</div>
                </div>
                
                <a href="${trackUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
                  Track Your Issue →
                </a>
                
                <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">
                  Save your ticket ID to track the resolution progress.
                </p>
              </div>
            `
          });
          console.log(`[EMAIL] Confirmation sent to ${citizen.email} for ${ticketId}`);
        }
      } catch (emailErr) {
        console.error('[EMAIL] Confirmation failed:', emailErr.message);
      }
    }

    res.status(201).json({
      success: true,
      ticket_id: issue.ticket_id,
      status: issue.status,
      category: issue.category,
      ai_category: issue.ai_category,
      ai_confidence: issue.ai_confidence,
      requires_review: classification.requires_review,
      city,
      ward
    });
  } catch (error) {
    console.error('Error creating issue:', error);
    res.status(500).json({ error: 'Failed to submit issue. Please try again.' });
  }
});

/**
 * GET /api/issues/:ticketId — Fetch issue by ticket ID (public)
 */
router.get('/:ticketId', async (req, res) => {
  try {
    const issue = await db.getIssueByTicketId(req.params.ticketId);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found. Please check your ticket ID.' });
    }

    // Return public-safe fields only (no admin_notes)
    res.json({
      ticket_id: issue.ticket_id,
      photo_url: issue.photo_url,
      category: issue.category,
      ai_category: issue.ai_category,
      ai_confidence: issue.ai_confidence,
      description: issue.description,
      latitude: issue.latitude,
      longitude: issue.longitude,
      city: issue.city,
      ward: issue.ward,
      status: issue.status,
      created_at: issue.created_at,
      updated_at: issue.updated_at,
      resolved_at: issue.resolved_at,
      resolved_photo_url: issue.resolved_photo_url || null,
      deadline_at: issue.deadline_at || null,
      citizen_reaction: issue.citizen_reaction || null
    });
  } catch (error) {
    console.error('Error fetching issue:', error);
    res.status(500).json({ error: 'Failed to fetch issue.' });
  }
});

/**
 * GET /api/issues — Public analytics
 * Actually handled at /api/analytics but kept here as alias
 */

module.exports = router;

/**
 * POST /api/issues/:ticketId/react — Citizen reacts to a resolved issue
 * Body: { reaction: 'confirmed' | 'disputed' | 'no_change' }
 * Auth: citizen JWT required
 */
router.post('/:ticketId/react', async (req, res) => {
  try {
    const { reaction } = req.body;
    const validReactions = ['confirmed', 'disputed', 'no_change'];
    if (!reaction || !validReactions.includes(reaction)) {
      return res.status(400).json({ error: `Reaction must be one of: ${validReactions.join(', ')}` });
    }

    // Verify citizen JWT
    let citizenId = null;
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Login required to react.' });
    }
    try {
      const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
      if (decoded.type !== 'citizen') return res.status(401).json({ error: 'Citizen login required.' });
      citizenId = decoded.id;
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }

    const issue = await db.getIssueByTicketId(req.params.ticketId);
    if (!issue) return res.status(404).json({ error: 'Issue not found.' });
    if (issue.status !== 'resolved') {
      return res.status(400).json({ error: 'You can only react to resolved issues.' });
    }
    if (issue.citizen_id !== citizenId) {
      return res.status(403).json({ error: 'Only the original reporter can react to this issue.' });
    }
    // Block re-reacting only if the citizen already gave a *final* reaction
    // ('confirmed' or 'no_change'). A previous 'disputed' reaction is not final —
    // the admin may have re-resolved the issue, and the citizen deserves another chance.
    const finalReactions = ['confirmed', 'no_change'];
    if (finalReactions.includes(issue.citizen_reaction)) {
      return res.status(400).json({ error: 'You have already reacted to this issue.' });
    }

    // Build the update payload
    const updatePayload = { citizen_reaction: reaction };

    // If disputed — re-open the issue and escalate to super admins
    if (reaction === 'disputed') {
      updatePayload.status = 'disputed';
      updatePayload.resolved_at = null;
    }

    await db.updateIssue(issue.id, updatePayload);

    // ── Escalation emails (only on dispute) ──────────────────────────────────
    if (reaction === 'disputed' && resend) {
      const dashboardUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/admin/dashboard`;
      const trackUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/track/${issue.ticket_id}`;

      // 1. Notify all super admins
      try {
        const superAdmins = await db.getSuperAdmins();
        for (const sa of superAdmins) {
          await resend.emails.send({
            from: 'CivicPulse <noreply@civpulse.in>',
            to: sa.email,
            subject: `🚨 DISPUTE ESCALATION — ${issue.ticket_id} citizen says still broken`,
            html: `
              <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;">
                <h2 style="color:#dc2626;margin-bottom:4px;">🚨 Dispute Escalated to You</h2>
                <p style="color:#64748b;font-size:14px;margin-top:0;">CivicPulse — Super Admin Alert</p>
                <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />

                <p>Hi <strong>${sa.name}</strong>,</p>
                <p>A citizen has <strong style="color:#dc2626;">disputed the resolution</strong> of a civic issue,
                   claiming the problem still exists. The issue has been automatically <strong>re-opened</strong>
                   and requires your attention.</p>

                <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:12px;padding:20px;margin:20px 0;">
                  <div style="font-size:13px;color:#991b1b;margin-bottom:4px;">Ticket ID</div>
                  <div style="font-size:22px;font-weight:800;color:#dc2626;">${issue.ticket_id}</div>

                  <div style="font-size:13px;color:#991b1b;margin-top:16px;margin-bottom:4px;">Category</div>
                  <div style="font-size:14px;font-weight:600;color:#1e293b;text-transform:capitalize;">
                    ${(issue.category || '').replace(/_/g, ' ')}
                  </div>

                  <div style="font-size:13px;color:#991b1b;margin-top:16px;margin-bottom:4px;">Location</div>
                  <div style="font-size:14px;color:#1e293b;">${issue.city || '—'}, ${issue.ward || '—'}</div>

                  <div style="font-size:13px;color:#991b1b;margin-top:16px;margin-bottom:4px;">New Status</div>
                  <div style="font-size:14px;font-weight:700;color:#dc2626;">⚠️ Disputed — Re-opened</div>

                  ${issue.description ? `
                  <div style="font-size:13px;color:#991b1b;margin-top:16px;margin-bottom:4px;">Citizen's Description</div>
                  <div style="font-size:13px;color:#1e293b;">${issue.description}</div>` : ''}
                </div>

                ${issue.photo_url ? `
                <div style="margin-bottom:16px;">
                  <div style="font-size:12px;color:#64748b;margin-bottom:6px;">📷 Original photo</div>
                  <img src="${issue.photo_url}" alt="Original issue" style="width:100%;border-radius:8px;max-height:200px;object-fit:cover;" />
                </div>` : ''}

                ${issue.resolved_photo_url ? `
                <div style="margin-bottom:20px;">
                  <div style="font-size:12px;color:#64748b;margin-bottom:6px;">✅ Photo submitted as proof of resolution</div>
                  <img src="${issue.resolved_photo_url}" alt="Claimed resolution" style="width:100%;border-radius:8px;max-height:200px;object-fit:cover;" />
                </div>` : ''}

                <div style="display:flex;gap:12px;flex-wrap:wrap;">
                  <a href="${dashboardUrl}" style="display:inline-block;background:#dc2626;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin-right:8px;">
                    Open Admin Dashboard →
                  </a>
                  <a href="${trackUrl}" style="display:inline-block;background:#f1f5f9;color:#1e293b;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
                    View Issue →
                  </a>
                </div>

                <p style="color:#94a3b8;font-size:12px;margin-top:32px;">
                  This is an automated escalation from CivicPulse. Please re-investigate and update the status.
                </p>
              </div>
            `
          });
          console.log(`[DISPUTE] Escalation email sent to super admin ${sa.email} for ${issue.ticket_id}`);
        }
      } catch (emailErr) {
        console.error('[DISPUTE] Failed to email super admins:', emailErr.message);
      }

      // 3. Notify the city admin(s) responsible for this issue's city + category
      try {
        const cityAdmins = await db.getAdminsByCity(issue.city, issue.category);
        for (const ca of cityAdmins) {
          await resend.emails.send({
            from: 'CivicPulse <noreply@civpulse.in>',
            to: ca.email,
            subject: `⚠️ DISPUTED — ${issue.ticket_id} you resolved has been challenged`,
            html: `
              <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;">
                <h2 style="color:#f97316;margin-bottom:4px;">⚠️ Resolution Disputed</h2>
                <p style="color:#64748b;font-size:14px;margin-top:0;">CivicPulse — City Admin Notice</p>
                <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />

                <p>Hi <strong>${ca.name}</strong>,</p>
                <p>A citizen has disputed the resolution you submitted for the following issue,
                   claiming the problem still exists. The issue has been <strong>re-opened</strong>
                   and escalated to senior authorities.</p>

                <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:20px;margin:20px 0;">
                  <div style="font-size:13px;color:#9a3412;margin-bottom:4px;">Ticket ID</div>
                  <div style="font-size:22px;font-weight:800;color:#ea580c;">${issue.ticket_id}</div>

                  <div style="font-size:13px;color:#9a3412;margin-top:16px;margin-bottom:4px;">Category</div>
                  <div style="font-size:14px;font-weight:600;color:#1e293b;text-transform:capitalize;">
                    ${(issue.category || '').replace(/_/g, ' ')}
                  </div>

                  <div style="font-size:13px;color:#9a3412;margin-top:16px;margin-bottom:4px;">Location</div>
                  <div style="font-size:14px;color:#1e293b;">${issue.city || '—'}, ${issue.ward || '—'}</div>

                  <div style="font-size:13px;color:#9a3412;margin-top:16px;margin-bottom:4px;">Action Required</div>
                  <div style="font-size:14px;font-weight:700;color:#ea580c;">Please revisit the site and re-resolve with fresh photo evidence.</div>
                </div>

                ${issue.resolved_photo_url ? `
                <div style="margin-bottom:20px;">
                  <div style="font-size:12px;color:#64748b;margin-bottom:6px;">Your submitted resolution photo</div>
                  <img src="${issue.resolved_photo_url}" alt="Resolution photo" style="width:100%;border-radius:8px;max-height:200px;object-fit:cover;" />
                </div>` : ''}

                <a href="${dashboardUrl}" style="display:inline-block;background:#ea580c;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
                  Go to Dashboard →
                </a>

                <p style="color:#94a3b8;font-size:12px;margin-top:32px;">
                  This issue has been escalated to super admins as well. Please act promptly.
                </p>
              </div>
            `
          });
          console.log(`[DISPUTE] City admin notified: ${ca.email} for ${issue.ticket_id}`);
        }
      } catch (emailErr) {
        console.error('[DISPUTE] Failed to email city admin:', emailErr.message);
      }

      // 4. Confirm escalation to the citizen
      try {
        const citizen = await db.getCitizenById(citizenId);
        if (citizen?.email) {
          await resend.emails.send({
            from: 'CivicPulse <noreply@civpulse.in>',
            to: citizen.email,
            subject: `Your dispute for ${issue.ticket_id} has been escalated`,
            html: `
              <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
                <h2 style="color:#4f46e5;margin-bottom:4px;">CivicPulse</h2>
                <p style="color:#64748b;font-size:14px;margin-top:0;">Dispute Confirmation</p>
                <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />

                <p>Hi <strong>${citizen.name}</strong>,</p>
                <p>Thank you for letting us know. We've recorded your dispute and the issue has been
                   <strong>re-opened and escalated to senior authorities</strong> for review.</p>

                <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:12px;padding:20px;margin:20px 0;">
                  <div style="font-size:13px;color:#991b1b;margin-bottom:4px;">Ticket ID</div>
                  <div style="font-size:22px;font-weight:800;color:#dc2626;">${issue.ticket_id}</div>

                  <div style="font-size:13px;color:#991b1b;margin-top:16px;margin-bottom:4px;">Status</div>
                  <div style="font-size:14px;font-weight:700;color:#dc2626;">⚠️ Under Review — Escalated</div>
                </div>

                <p style="font-size:14px;color:#64748b;">
                  Senior municipal authorities have been notified and will re-investigate. You can continue
                  to track progress using your ticket ID.
                </p>

                <a href="${trackUrl}" style="display:inline-block;background:#4f46e5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
                  Track Issue →
                </a>

                <p style="color:#94a3b8;font-size:12px;margin-top:32px;">
                  You received this because you disputed a resolution on CivicPulse.
                </p>
              </div>
            `
          });
          console.log(`[DISPUTE] Confirmation email sent to citizen ${citizen.email} for ${issue.ticket_id}`);
        }
      } catch (emailErr) {
        console.error('[DISPUTE] Failed to email citizen:', emailErr.message);
      }
    }

    res.json({ success: true, reaction, ticket_id: issue.ticket_id, escalated: reaction === 'disputed' });
  } catch (error) {
    console.error('Error saving reaction:', error);
    res.status(500).json({ error: 'Failed to save reaction.' });
  }
});
