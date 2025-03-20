// server.js
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import nodemailer from "nodemailer";

// SMTP Creds
const SMTP_HOST = "email-smtp.eu-north-1.amazonaws.com"; #change to your region
const SMTP_PORT = 587;
const SMTP_USER = "user"; # Example ATRPOTRXCTVBYERW
const SMTP_PASS = "password"; # Eample SDFGRWERERGRTFHGRFJHFGJFGHFDGFASDFWETERTG
const EMAIL_FROM = "your_verified_email@domain.com";

// Configure Nodemailer
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // true for port 465, false for others
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
  debug: true,
  logger: true,
});

// Create an MCP server instance
const server = new McpServer({
  name: "EmailSender",
  version: "1.0.0",
});

// Define the send_email tool callback
const sendEmailCallback = async ({ to, subject, text }) => {
  try {
    console.log(`📨 Sending email to: ${to}`);

    // Define email options
    const mailOptions = {
      from: EMAIL_FROM,
      to,
      subject,
      text,
    };

    // Send the email using Nodemailer
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully:", info.response);

    return {
      content: [
        {
          type: "text",
          text: `✅ Email successfully sent to ${to}`,
        },
      ],
    };
  } catch (error) {
    console.error("❌ Email failed:", error);
    return {
      content: [
        {
          type: "text",
          text: `❌ Failed to send email: ${error.message}`,
        },
      ],
    };
  }
};

// Register the MCP tool "send_email" with input validation
server.tool(
  "send_email",
  {
    to: z.string().email(),
    subject: z.string(),
    text: z.string(),
  },
  sendEmailCallback
);

// Start the MCP server using stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("📨 MCP Email Sender running on stdio");
}

main().catch((error) => {
  console.error("🚨 Fatal error:", error);
  process.exit(1);
});
