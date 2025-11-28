const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Get and validate API key
const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim();

if (!RESEND_API_KEY) {
  console.error('❌ ERROR: RESEND_API_KEY is not set in .env file!');
  console.error('Please add RESEND_API_KEY=your_api_key to your .env file');
  process.exit(1);
}

// Initialize Resend with API key
const resend = new Resend(RESEND_API_KEY);

console.log('✅ Resend API initialized successfully');
console.log(`✅ API Key loaded: ${RESEND_API_KEY.substring(0, 10)}...${RESEND_API_KEY.substring(RESEND_API_KEY.length - 4)}`);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files

// Contact form endpoint
app.post('/api/contact', async (req, res) => {
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

    const sanitizedName = sanitizeHtml(name);
    const sanitizedEmail = sanitizeHtml(email);
    const sanitizedMessage = sanitizeHtml(message);

    console.log(`📧 Attempting to send email from ${email} (${name})`);

    // Send email using Resend
    const { data, error } = await resend.emails.send({
      from: 'AOAS WEB Receive Mail <onboarding@resend.dev>', // Note: For production, verify your domain in Resend dashboard
      to: ['alejandro@attainmentofficeadserv.org'],
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

app.listen(PORT, () => {
  console.log(`\n🚀 Server is running on http://localhost:${PORT}`);
  console.log(`✅ Resend API Key is configured`);
  console.log(`📧 Contact form endpoint: http://localhost:${PORT}/api/contact`);
  console.log(`\nReady to receive contact form submissions!\n`);
});

