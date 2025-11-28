const { Resend } = require('resend');

// Get and validate API key from environment variable
const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim();

// Initialize Resend with API key (only if available)
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

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

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  try {
    const { name, email, message } = req.body;

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name and email are required fields.' 
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

    const sanitizedName = sanitizeHtml(name);
    const sanitizedEmail = sanitizeHtml(email);
    const sanitizedMessage = sanitizeHtml(message);

    if (!resend || !RESEND_API_KEY) {
      console.error('❌ Resend API key not configured');
      return res.status(500).json({ 
        success: false, 
        error: 'Email service not configured. Please set RESEND_API_KEY environment variable.' 
      });
    }

    console.log(`📧 Attempting to send email from ${email} (${name})`);

    // Send email using Resend
    const { data, error } = await resend.emails.send({
      from: 'AOAS WEB Receive Mail <onboarding@resend.dev>',
      to: ['alejandro@attainmentofficeadserv.org', 'support@attainmentofficeadserv.org'],
      subject: `New Contact Form Submission from ${sanitizedName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #22c55e; border-bottom: 2px solid #22c55e; padding-bottom: 10px;">
            New Contact Form Submission
          </h2>
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-top: 20px;">
            <p style="margin: 10px 0;"><strong>Name:</strong> ${sanitizedName}</p>
            <p style="margin: 10px 0;"><strong>Email:</strong> ${sanitizedEmail}</p>
            ${sanitizedMessage ? `<p style="margin: 10px 0;"><strong>Message:</strong></p><p style="margin: 10px 0; padding: 10px; background-color: white; border-radius: 4px; white-space: pre-wrap;">${sanitizedMessage}</p>` : ''}
          </div>
          <p style="margin-top: 20px; color: #6b7280; font-size: 12px;">
            This email was sent from the AOAS WEB contact form.
          </p>
        </div>
      `,
      text: `
New Contact Form Submission

Name: ${name}
Email: ${email}
${message ? `Message: ${message}` : ''}

This email was sent from the AOAS WEB contact form.
      `,
    });

    if (error) {
      console.error('❌ Resend API error:', JSON.stringify(error, null, 2));
      console.error('Error details:', error.message || error);
      return res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to send email. Please check your Resend API key and try again.' 
      });
    }

    if (data && data.id) {
      console.log(`✅ Email sent successfully! Email ID: ${data.id}`);
    } else {
      console.log('⚠️ Email sent but no ID returned from Resend');
    }

    res.json({ 
      success: true, 
      message: 'Thank you for your message! We will get back to you within 24-48 hours.',
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
};

