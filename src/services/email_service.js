const nodemailer = require('nodemailer')

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.SMTP_FROM)
}

function createTransporter() {
  if (!smtpConfigured()) return null
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === '1',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  })
}

async function sendSuperAdminOtp(email, otp) {
  const transporter = createTransporter()
  if (!transporter) {
    if (process.env.NODE_ENV === 'production') {
      throw { status: 503, message: 'Email service is not configured. Please contact the system administrator.' }
    }
    console.log(`[OTP] Super admin email ${email} -> OTP ${otp}`)
    return { delivered: false }
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: 'Shmeta Super Admin Password Reset Code',
    text: `Your Shmeta password reset code is ${otp}. It expires in 5 minutes.`,
    html: `<p>Your Shmeta password reset code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:6px">${otp}</p><p>This code expires in 5 minutes.</p>`,
  })

  return { delivered: true }
}

module.exports = { sendSuperAdminOtp, smtpConfigured }
