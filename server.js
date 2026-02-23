const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { Resend } = require('resend');
const { handleContactSubmission } = require('./lib/contact-handler');
const { appendJsonLine, readJsonLines, buildMetricsFromRecords, sanitizeText } = require('./lib/inquiry-utils');
const {
  STATUS_OPTIONS,
  createTokenForUser,
  authenticateUser,
  resolveUserFromRequest,
  assertAuthenticated,
  assertAdmin,
  getDashboardSnapshot,
  listSections,
  createSection,
  updateSection,
  deleteSection,
  listParticipants,
  createParticipant,
  updateParticipant,
  deleteParticipant,
  listAccounts,
  createSubAccount,
  updateSubAccount,
  deleteSubAccount,
} = require('./lib/admin-crm');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Get and validate API key
const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim();

if (!RESEND_API_KEY) {
  console.warn('RESEND_API_KEY is not set. Inquiry emails will be delayed until configured.');
}

// Initialize Resend with API key (only if available)
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

if (RESEND_API_KEY) {
  console.log('✅ Resend API initialized successfully');
  console.log(`✅ API Key loaded: ${RESEND_API_KEY.substring(0, 10)}...${RESEND_API_KEY.substring(RESEND_API_KEY.length - 4)}`);
} else {
  console.warn('RESEND_API_KEY not set - email functionality will not work');
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    res.status(400).json({
      success: false,
      error: 'Invalid JSON payload.',
    });
    return;
  }
  next(err);
});

// Serve static files (only for local development, Vercel handles this)
if (process.env.VERCEL !== '1' && !process.env.VERCEL_ENV) {
  app.use(express.static('.'));

  // Local clean URL support (e.g., /services, /privacy, /services/payroll)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      next();
      return;
    }

    if (req.path === '/') {
      next();
      return;
    }

    const cleanPath = req.path.replace(/^\/+|\/+$/g, '');
    const directHtml = path.join(__dirname, `${cleanPath}.html`);
    const nestedIndex = path.join(__dirname, cleanPath, 'index.html');

    if (fs.existsSync(directHtml)) {
      res.sendFile(directHtml);
      return;
    }

    if (fs.existsSync(nestedIndex)) {
      res.sendFile(nestedIndex);
      return;
    }

    next();
  });
}

// Contact form + chat lead endpoint
function getRemoteIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '';
}

function sendAdminError(res, error) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  res.status(status).json({
    success: false,
    error: error?.message || 'Unexpected admin endpoint error.',
  });
}

function toPublicUser(user) {
  return {
    username: user.username,
    displayName: user.displayName || user.username,
    role: user.role,
  };
}

function getEntityIdFromRequest(req) {
  return sanitizeText(req.params?.id || req.body?.id || req.query?.id || '', 120);
}

async function requireAuthenticatedUser(req, res) {
  try {
    const user = await resolveUserFromRequest(req);
    assertAuthenticated(user);
    return user;
  } catch (error) {
    sendAdminError(res, error);
    return null;
  }
}

async function requireAdminUser(req, res) {
  try {
    const user = await resolveUserFromRequest(req);
    assertAuthenticated(user);
    assertAdmin(user);
    return user;
  } catch (error) {
    sendAdminError(res, error);
    return null;
  }
}

app.post('/api/contact', async (req, res) => {
  try {
    const result = await handleContactSubmission(req.body, {
      remoteIp: getRemoteIp(req),
      userAgent: req.headers['user-agent'] || '',
      path: req.path || '/',
    });

    res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Contact endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Unexpected server error while handling inquiry.',
    });
  }
});

// Analytics event ingestion endpoint
app.post('/api/events', async (req, res) => {
  try {
    const eventName = sanitizeText(req.body?.eventName || req.body?.event || '', 80).toLowerCase();
    if (!eventName) {
      res.status(400).json({
        success: false,
        error: 'eventName is required.',
      });
      return;
    }

    const properties = req.body?.properties && typeof req.body.properties === 'object'
      ? req.body.properties
      : {};

    const stored = await appendJsonLine('events.jsonl', {
      timestamp: new Date().toISOString(),
      eventName,
      properties,
      sourcePage: sanitizeText(req.body?.sourcePage || '', 300),
      pageUrl: sanitizeText(req.body?.pageUrl || '', 2000),
      sessionId: sanitizeText(req.body?.sessionId || '', 120),
      userAgent: sanitizeText(req.headers['user-agent'] || '', 300),
      ip: sanitizeText(getRemoteIp(req), 120),
    });

    res.json({
      success: true,
      stored: stored !== false,
    });
  } catch (error) {
    console.error('Events endpoint error:', error);
    // Fail-open for analytics ingestion to avoid frontend 500 noise.
    res.status(200).json({
      success: false,
      stored: false,
      dropped: true,
    });
  }
});

// Inquiry + analytics metrics endpoint
app.get('/api/metrics', async (req, res) => {
  try {
    const [inquiries, events] = await Promise.all([
      readJsonLines('inquiries.jsonl'),
      readJsonLines('events.jsonl'),
    ]);

    const metrics = buildMetricsFromRecords(inquiries, events);
    res.json({
      success: true,
      metrics,
    });
  } catch (error) {
    console.error('Metrics endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load metrics.',
    });
  }
});

// Careers form endpoint
app.post('/api/careers', async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      workingHours,
      availability,
      experience,
      yearsExperience,
      resume,
      resumeFileName,
      resumeFileType,
      whyHireYou,
      compensation
    } = req.body;

    // Validate required fields
    if (!fullName || !email || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Full name, email, and phone number are required fields.'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid email address.'
      });
    }

    // Sanitize inputs to prevent XSS
    const sanitizeHtml = (str) => {
      if (!str) return '';
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    const sanitizedData = {
      fullName: sanitizeHtml(fullName),
      email: sanitizeHtml(email),
      phone: sanitizeHtml(phone),
      workingHours: sanitizeHtml(workingHours),
      availability: sanitizeHtml(availability),
      experience: sanitizeHtml(experience),
      yearsExperience: sanitizeHtml(yearsExperience),
      resumeFileName: sanitizeHtml(resumeFileName),
      whyHireYou: sanitizeHtml(whyHireYou),
      compensation: sanitizeHtml(compensation)
    };

    if (!resend || !RESEND_API_KEY) {
      console.error('❌ Resend API key not configured');
      return res.status(500).json({
        success: false,
        error: 'Email service not configured. Please set RESEND_API_KEY environment variable.'
      });
    }

    console.log(`📧 Attempting to send career application from ${email} (${fullName})`);

    // Decode base64 file data
    let attachmentContent = null;
    if (resume && resumeFileName) {
      // Remove data URL prefix (e.g., "data:application/pdf;base64,")
      const base64Data = resume.split(',')[1];
      attachmentContent = Buffer.from(base64Data, 'base64');
    }

    // Prepare email options
    const emailOptions = {
      from: 'APPLICATION FORM <noreply@attainmentofficeadserv.org>',
      to: ['support@attainmentofficeadserv.org'],
      subject: `New Job Application from ${sanitizedData.fullName}`,


      html: `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; background: #f9fafb;">
          <div style="background: linear-gradient(135deg, #5B9DD9 0%, #3A7AB0 100%); padding: 30px; border-radius: 12px 12px 0 0;">
            <h2 style="color: #ffffff; margin: 0; font-size: 28px; text-align: center;">
              New Career Application
            </h2>
          </div>
          <div style="background: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h3 style="color: #22c55e; border-bottom: 2px solid #22c55e; padding-bottom: 10px; margin-top: 0;">
              Contact Information
            </h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #1a1a1a; width: 180px;">Full Name:</td>
                <td style="padding: 10px 0; color: #4b5563;">${sanitizedData.fullName}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #1a1a1a;">Email:</td>
                <td style="padding: 10px 0; color: #4b5563;">${sanitizedData.email}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #1a1a1a;">Phone Number:</td>
                <td style="padding: 10px 0; color: #4b5563;">${sanitizedData.phone}</td>
              </tr>
            </table>

            <h3 style="color: #22c55e; border-bottom: 2px solid #22c55e; padding-bottom: 10px;">
              Work Preferences
            </h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #1a1a1a; width: 180px;">Preferred Working Hours:</td>
                <td style="padding: 10px 0; color: #4b5563;">${sanitizedData.workingHours || 'Not specified'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #1a1a1a;">Availability:</td>
                <td style="padding: 10px 0; color: #4b5563;">${sanitizedData.availability || 'Not specified'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #1a1a1a;">Years of Experience:</td>
                <td style="padding: 10px 0; color: #4b5563;">${sanitizedData.yearsExperience || 'Not specified'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #1a1a1a;">Expected Compensation:</td>
                <td style="padding: 10px 0; color: #4b5563;">${sanitizedData.compensation || 'Not specified'}</td>
              </tr>
            </table>

            <h3 style="color: #22c55e; border-bottom: 2px solid #22c55e; padding-bottom: 10px;">
              Experience & Skills
            </h3>
            <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <p style="margin: 0; color: #4b5563; white-space: pre-wrap; line-height: 1.6;">${sanitizedData.experience || 'Not provided'}</p>
            </div>

            <h3 style="color: #22c55e; border-bottom: 2px solid #22c55e; padding-bottom: 10px;">
              Why Hire This Candidate?
            </h3>
            <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <p style="margin: 0; color: #4b5563; white-space: pre-wrap; line-height: 1.6;">${sanitizedData.whyHireYou || 'Not provided'}</p>
            </div>

            <h3 style="color: #22c55e; border-bottom: 2px solid #22c55e; padding-bottom: 10px;">
              Resume & Portfolio
            </h3>
            <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <p style="margin: 0; color: #1a1a1a; font-weight: bold;">Resume Attached:</p>
              <p style="margin: 5px 0 0 0; color: #4b5563;">${sanitizedData.resumeFileName || 'resume'}</p>
            </div>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="color: #6b7280; font-size: 14px; margin: 0;">
                This application was submitted through the AOAS Careers page.
              </p>
              <p style="color: #6b7280; font-size: 12px; margin: 10px 0 0 0;">
                Received on ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })} (PH Time)
              </p>
            </div>
          </div>
        </div>
      `,
      text: `
New Career Application

CONTACT INFORMATION
-------------------
Full Name: ${fullName}
Email: ${email}
Phone Number: ${phone}

WORK PREFERENCES
----------------
Preferred Working Hours: ${workingHours || 'Not specified'}
Availability: ${availability || 'Not specified'}
Years of Experience: ${yearsExperience || 'Not specified'}
Expected Compensation: ${compensation || 'Not specified'}

EXPERIENCE & SKILLS
-------------------
${experience || 'Not provided'}

WHY HIRE THIS CANDIDATE?
------------------------
${whyHireYou || 'Not provided'}

RESUME & PORTFOLIO
------------------
---
This application was submitted through the AOAS Careers page.
Received on ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })} (PH Time)
      `,
    };

    // Add attachment if available
    if (attachmentContent && resumeFileName) {
      emailOptions.attachments = [{
        filename: resumeFileName,
        content: attachmentContent
      }];
    }

    // Send email using Resend
    const { data, error } = await resend.emails.send(emailOptions);

    if (error) {
      console.error('❌ Resend API error:', JSON.stringify(error, null, 2));
      console.error('Error details:', error.message || error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to send email. Please check your Resend API key and try again.'
      });
    }

    if (data && data.id) {
      console.log(`✅ Career application email sent successfully! Email ID: ${data.id}`);
    } else {
      console.log('⚠️ Email sent but no ID returned from Resend');
    }

    res.json({
      success: true,
      message: 'Thank you for your application! We will review your submission and get back to you soon.',
      emailId: data?.id
    });

  } catch (error) {
    console.error('❌ Server error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'An unexpected error occurred. Please try again later.'
    });
  }
});

// Admin CRM authentication
app.post('/api/admin/login', async (req, res) => {
  try {
    const username = sanitizeText(req.body?.username || '', 60).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!username || !password) {
      res.status(400).json({
        success: false,
        error: 'Username and password are required.',
      });
      return;
    }

    const user = await authenticateUser(username, password);
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid username or password.',
      });
      return;
    }

    const token = createTokenForUser(user);
    res.json({
      success: true,
      token,
      user: toPublicUser(user),
      expiresInSeconds: 12 * 60 * 60,
    });
  } catch (error) {
    sendAdminError(res, error);
  }
});

app.get('/api/admin/me', async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    res.json({
      success: true,
      user: toPublicUser(user),
    });
  } catch (error) {
    sendAdminError(res, error);
  }
});

app.get('/api/admin/dashboard', async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const snapshot = await getDashboardSnapshot();
    res.json({
      success: true,
      user: toPublicUser(user),
      statusOptions: STATUS_OPTIONS,
      ...snapshot,
    });
  } catch (error) {
    sendAdminError(res, error);
  }
});

// Admin CRM: sections
app.get('/api/admin/sections', async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const sections = await listSections();
    res.json({
      success: true,
      sections,
    });
  } catch (error) {
    sendAdminError(res, error);
  }
});

app.post('/api/admin/sections', async (req, res) => {
  try {
    const user = await requireAdminUser(req, res);
    if (!user) {
      return;
    }

    const section = await createSection(req.body || {}, user);
    res.status(201).json({
      success: true,
      section,
    });
  } catch (error) {
    sendAdminError(res, error);
  }
});

app.put(['/api/admin/sections/:id', '/api/admin/sections'], async (req, res) => {
  try {
    const user = await requireAdminUser(req, res);
    if (!user) {
      return;
    }

    const sectionId = getEntityIdFromRequest(req);
    if (!sectionId) {
      res.status(400).json({
        success: false,
        error: 'section id is required.',
      });
      return;
    }

    const section = await updateSection(sectionId, req.body || {});
    res.json({
      success: true,
      section,
    });
  } catch (error) {
    sendAdminError(res, error);
  }
});

app.delete(['/api/admin/sections/:id', '/api/admin/sections'], async (req, res) => {
  try {
    const user = await requireAdminUser(req, res);
    if (!user) {
      return;
    }

    const sectionId = getEntityIdFromRequest(req);
    if (!sectionId) {
      res.status(400).json({
        success: false,
        error: 'section id is required.',
      });
      return;
    }

    await deleteSection(sectionId);
    res.json({
      success: true,
    });
  } catch (error) {
    sendAdminError(res, error);
  }
});

// Admin CRM: participants
app.get('/api/admin/participants', async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const search = sanitizeText(req.query?.search || '', 120).toLowerCase();
    const sectionFilter = sanitizeText(req.query?.section || '', 80).toLowerCase();
    const statusFilter = sanitizeText(req.query?.status || '', 40).toLowerCase();
    let participants = await listParticipants();

    if (sectionFilter) {
      participants = participants.filter((participant) => Array.isArray(participant.sections) && participant.sections.includes(sectionFilter));
    }

    if (statusFilter) {
      participants = participants.filter((participant) => (participant.status || '').toLowerCase() === statusFilter);
    }

    if (search) {
      participants = participants.filter((participant) => {
        const haystack = [
          participant.fullName,
          participant.email,
          participant.contactNumber,
          participant.address,
          participant.gender,
          participant.notes,
          ...(Array.isArray(participant.skills) ? participant.skills : []),
          ...(Array.isArray(participant.sections) ? participant.sections : []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return haystack.includes(search);
      });
    }

    res.json({
      success: true,
      participants,
    });
  } catch (error) {
    sendAdminError(res, error);
  }
});

app.post('/api/admin/participants', async (req, res) => {
  try {
    const user = await requireAdminUser(req, res);
    if (!user) {
      return;
    }

    const participant = await createParticipant(req.body || {}, user);
    res.status(201).json({
      success: true,
      participant,
    });
  } catch (error) {
    sendAdminError(res, error);
  }
});

app.put(['/api/admin/participants/:id', '/api/admin/participants'], async (req, res) => {
  try {
    const user = await requireAdminUser(req, res);
    if (!user) {
      return;
    }

    const participantId = getEntityIdFromRequest(req);
    if (!participantId) {
      res.status(400).json({
        success: false,
        error: 'participant id is required.',
      });
      return;
    }

    const participant = await updateParticipant(participantId, req.body || {}, user);
    res.json({
      success: true,
      participant,
    });
  } catch (error) {
    sendAdminError(res, error);
  }
});

app.delete(['/api/admin/participants/:id', '/api/admin/participants'], async (req, res) => {
  try {
    const user = await requireAdminUser(req, res);
    if (!user) {
      return;
    }

    const participantId = getEntityIdFromRequest(req);
    if (!participantId) {
      res.status(400).json({
        success: false,
        error: 'participant id is required.',
      });
      return;
    }

    await deleteParticipant(participantId);
    res.json({
      success: true,
    });
  } catch (error) {
    sendAdminError(res, error);
  }
});

// Admin CRM: sub-accounts
app.get('/api/admin/accounts', async (req, res) => {
  try {
    const user = await requireAdminUser(req, res);
    if (!user) {
      return;
    }

    const accounts = await listAccounts();
    res.json({
      success: true,
      systemAdmin: {
        id: 'hardcoded-admin',
        username: 'admin',
        displayName: 'System Admin',
        role: 'admin',
        isActive: true,
      },
      accounts,
    });
  } catch (error) {
    sendAdminError(res, error);
  }
});

app.post('/api/admin/accounts', async (req, res) => {
  try {
    const user = await requireAdminUser(req, res);
    if (!user) {
      return;
    }

    const account = await createSubAccount(req.body || {}, user);
    res.status(201).json({
      success: true,
      account,
    });
  } catch (error) {
    sendAdminError(res, error);
  }
});

app.put(['/api/admin/accounts/:id', '/api/admin/accounts'], async (req, res) => {
  try {
    const user = await requireAdminUser(req, res);
    if (!user) {
      return;
    }

    const accountId = getEntityIdFromRequest(req);
    if (!accountId) {
      res.status(400).json({
        success: false,
        error: 'account id is required.',
      });
      return;
    }

    const account = await updateSubAccount(accountId, req.body || {});
    res.json({
      success: true,
      account,
    });
  } catch (error) {
    sendAdminError(res, error);
  }
});

app.delete(['/api/admin/accounts/:id', '/api/admin/accounts'], async (req, res) => {
  try {
    const user = await requireAdminUser(req, res);
    if (!user) {
      return;
    }

    const accountId = getEntityIdFromRequest(req);
    if (!accountId) {
      res.status(400).json({
        success: false,
        error: 'account id is required.',
      });
      return;
    }

    await deleteSubAccount(accountId);
    res.json({
      success: true,
    });
  } catch (error) {
    sendAdminError(res, error);
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is running',
    resendConfigured: !!RESEND_API_KEY,
    apiKeyLength: RESEND_API_KEY ? RESEND_API_KEY.length : 0
  });
});

// Export for Vercel serverless functions
// For Vercel, we need to export the app directly
module.exports = app;

// Only listen if not on Vercel (for local development)
if (process.env.VERCEL !== '1' && !process.env.VERCEL_ENV) {
  app.listen(PORT, () => {
    console.log(`\n🚀 Server is running on http://localhost:${PORT}`);
    console.log(`✅ Resend API Key is configured`);
    console.log(`📧 Contact form endpoint: http://localhost:${PORT}/api/contact`);
    console.log(`\nReady to receive contact form submissions!\n`);
  });
}

