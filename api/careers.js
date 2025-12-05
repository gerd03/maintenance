const { Resend } = require('resend');

// Version 2.0 - Updated email template with screening questions, skills, cover letter
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
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
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
      compensation,
      // New fields
      flexibleSchedule,
      workAuthorization,
      weekendAvailability,
      reliableTransportation,
      previousTermination,
      relevantSkills,
      coverLetter,
      coverLetterFileName,
      coverLetterFileType
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

    // Sanitize all inputs
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
      compensation: sanitizeHtml(compensation),
      // New fields
      flexibleSchedule: sanitizeHtml(flexibleSchedule),
      workAuthorization: sanitizeHtml(workAuthorization),
      weekendAvailability: sanitizeHtml(weekendAvailability),
      reliableTransportation: sanitizeHtml(reliableTransportation),
      previousTermination: sanitizeHtml(previousTermination),
      relevantSkills: sanitizeHtml(relevantSkills),
      coverLetterFileName: sanitizeHtml(coverLetterFileName)
    };

    if (!resend || !RESEND_API_KEY) {
      console.error('❌ Resend API key not configured');
      return res.status(500).json({
        success: false,
        error: 'Email service not configured. Please set RESEND_API_KEY environment variable.'
      });
    }

    console.log(`📧 Attempting to send career application from ${email} (${fullName})`);

    // Decode base64 file data for resume
    let attachmentContent = null;
    if (resume && resumeFileName) {
      // Remove data URL prefix (e.g., "data:application/pdf;base64,")
      const base64Data = resume.split(',')[1];
      attachmentContent = Buffer.from(base64Data, 'base64');
    }

    // Decode base64 file data for cover letter
    let coverLetterContent = null;
    if (coverLetter && coverLetterFileName) {
      const base64Data = coverLetter.split(',')[1];
      coverLetterContent = Buffer.from(base64Data, 'base64');
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
              New Job Application
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
              Screening Questions
            </h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #1a1a1a; width: 70%;">Willing to adjust work hours/schedule:</td>
                <td style="padding: 10px 0; color: ${sanitizedData.flexibleSchedule === 'Yes' ? '#22c55e' : '#ef4444'}; font-weight: bold;">${sanitizedData.flexibleSchedule || 'Not answered'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #1a1a1a;">Legally authorized to work:</td>
                <td style="padding: 10px 0; color: ${sanitizedData.workAuthorization === 'Yes' ? '#22c55e' : '#ef4444'}; font-weight: bold;">${sanitizedData.workAuthorization || 'Not answered'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #1a1a1a;">Willing to work weekends/holidays:</td>
                <td style="padding: 10px 0; color: ${sanitizedData.weekendAvailability === 'Yes' ? '#22c55e' : '#ef4444'}; font-weight: bold;">${sanitizedData.weekendAvailability || 'Not answered'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #1a1a1a;">Has reliable transportation:</td>
                <td style="padding: 10px 0; color: ${sanitizedData.reliableTransportation === 'Yes' ? '#22c55e' : '#ef4444'}; font-weight: bold;">${sanitizedData.reliableTransportation || 'Not answered'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #1a1a1a;">Previously terminated from a job:</td>
                <td style="padding: 10px 0; color: ${sanitizedData.previousTermination === 'No' ? '#22c55e' : '#ef4444'}; font-weight: bold;">${sanitizedData.previousTermination || 'Not answered'}</td>
              </tr>
            </table>

            <h3 style="color: #22c55e; border-bottom: 2px solid #22c55e; padding-bottom: 10px;">
              Experience & Skills
            </h3>
            <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <p style="margin: 0; color: #4b5563; white-space: pre-wrap; line-height: 1.6;">${sanitizedData.experience || 'Not provided'}</p>
            </div>

            <h3 style="color: #22c55e; border-bottom: 2px solid #22c55e; padding-bottom: 10px;">
              Relevant Skills
            </h3>
            <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <p style="margin: 0; color: #4b5563; white-space: pre-wrap; line-height: 1.6;">${sanitizedData.relevantSkills || 'Not provided'}</p>
            </div>

            <h3 style="color: #22c55e; border-bottom: 2px solid #22c55e; padding-bottom: 10px;">
              Why Hire This Candidate?
            </h3>
            <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <p style="margin: 0; color: #4b5563; white-space: pre-wrap; line-height: 1.6;">${sanitizedData.whyHireYou || 'Not provided'}</p>
            </div>

            <h3 style="color: #22c55e; border-bottom: 2px solid #22c55e; padding-bottom: 10px;">
              Attachments
            </h3>
            <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <p style="margin: 0; color: #1a1a1a; font-weight: bold;">Resume Attached:</p>
              <p style="margin: 5px 0 0 0; color: #4b5563;">${sanitizedData.resumeFileName || 'resume'}</p>
              ${sanitizedData.coverLetterFileName ? `
              <p style="margin: 15px 0 0 0; color: #1a1a1a; font-weight: bold;">Cover Letter Attached:</p>
              <p style="margin: 5px 0 0 0; color: #4b5563;">${sanitizedData.coverLetterFileName}</p>
              ` : ''}
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

SCREENING QUESTIONS
-------------------
Willing to adjust work hours/schedule: ${flexibleSchedule || 'Not answered'}
Legally authorized to work: ${workAuthorization || 'Not answered'}
Willing to work weekends/holidays: ${weekendAvailability || 'Not answered'}
Has reliable transportation: ${reliableTransportation || 'Not answered'}
Previously terminated from a job: ${previousTermination || 'Not answered'}

EXPERIENCE & SKILLS
-------------------
${experience || 'Not provided'}

RELEVANT SKILLS
---------------
${relevantSkills || 'Not provided'}

WHY HIRE THIS CANDIDATE?
------------------------
${whyHireYou || 'Not provided'}

---
This application was submitted through the AOAS Careers page.
Received on ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })} (PH Time)
      `,
    };

    // Add attachments
    emailOptions.attachments = [];

    if (attachmentContent && resumeFileName) {
      emailOptions.attachments.push({
        filename: resumeFileName,
        content: attachmentContent
      });
    }

    if (coverLetterContent && coverLetterFileName) {
      emailOptions.attachments.push({
        filename: coverLetterFileName,
        content: coverLetterContent
      });
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
};

