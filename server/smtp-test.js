// Standalone SMTP credential tester — run locally, does not touch the app or Supabase.
// Usage (PowerShell):
//   $env:SMTP_USER="you@gmail.com"; $env:SMTP_PASS="16-char-app-password"; node smtp-test.js
const nodemailer = require("nodemailer");

const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;

if (!user || !pass) {
  console.error("Set SMTP_USER and SMTP_PASS environment variables first.");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: { user, pass },
});

transporter.verify((error, success) => {
  if (error) {
    console.error("SMTP LOGIN FAILED:", error.message);
    process.exit(1);
  }
  console.log("SMTP LOGIN SUCCESS — credentials are valid.");
});
