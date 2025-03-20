This guide explains how to set up a Flowise environment with an MCP server that sends emails via AWS SES. It covers installing Docker and Node.js, setting up your project directories, configuring Flowise with Docker Compose, and running the MCP server automatically using PM2. This guide is fully replicable on any Ubuntu system.

## 1. Install Docker and Docker Compose

### a. Install Docker’s Dependencies and Official GPG Key

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

### b. Add the Docker Repository to Apt Sources

```bash
echo   "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu   $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" |   sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
```

### c. Install Docker Engine, CLI, and Compose Plugin

```bash
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### d. Add Your User to the Docker Group

```bash
sudo usermod -aG docker $USER
```

_Log out and log back in (or run `newgrp docker`) for the changes to take effect._

## 2. Install Node.js and npm

### a. Install Prerequisites

```bash
sudo apt install -y build-essential
```

### b. Install Node.js (LTS, e.g., Node 18)

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

### c. Verify Installation

```bash
node -v
npm -v
```

## 3. Set Up the Project Directory Structure

Create a main project directory with subdirectories for Flowise data and your MCP server:

```bash
mkdir -p ~/flowise/flowise_data
mkdir -p ~/flowise/mcp-server
cd ~/flowise
```

## 4. Create Configuration Files

### a. Flowise Environment File (.env)

Create a file `~/flowise/.env`:

```bash
nano ~/flowise/.env
```

Add the following (adjust as needed):

```env
# Add any credentials you intend to use now or later
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
```

### b. MCP Server Files

Navigate to the MCP server folder:

```bash
cd ~/flowise/mcp-server
```

#### i. Initialize a New Node.js Project and edit `package.json`

```bash
npm init -y
rm package.json
nano package.json
```

Paste the provided `package.json` content.

```json
{
  "name": "mcp-server",
  "version": "1.0.0",
  "type": "module",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.7.0",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "nano": "^10.1.4",
    "nodemailer": "^6.10.0",
    "zod": "^3.24.2"
  }
}
```

#### ii. Create `server.js`

```bash
nano server.js
```

Paste the provided `server.js` content.

'''bash
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
'''

## 5. Create Docker Compose File for Flowise & Opensearch

In the main project directory (`~/flowise`), create or update `docker-compose.yaml`:

```bash
nano ~/flowise/docker-compose.yaml
```

Paste the provided `docker-compose.yaml` content.

```bash
services:
  opensearch:
    image: opensearchproject/opensearch:latest
    container_name: opensearch
    environment:
      - discovery.type=single-node
      - plugins.ml_commons.only_run_on_ml_node=false
      - OPENSEARCH_INITIAL_ADMIN_PASSWORD=your_password
      - DISABLE_SECURITY_PLUGIN=true
      - OPENSEARCH_JAVA_OPTS=-Xms2g -Xmx2g
    ports:
      - "9200:9200"
      - "9600:9600"
    networks:
      - flowise-net

  flowise:
    image: flowiseai/flowise:latest
    container_name: flowise
    env_file: .env
    environment:
      - DEBUG=flowise:*
      - LOG_LEVEL=debug
      - FLOWISE_USERNAME=admin
      - FLOWISE_PASSWORD=your_password
    volumes:
      - "./flowise_data:/root/.flowise"
      - "./mcp-server:/mnt/mcp-server"
    ports:
      - "3000:3000"
    networks:
      - flowise-net

networks:
  flowise-net:
    driver: bridge
```

## 6. Deploy Docker Stack

From the main project directory:

```bash
cd ~/flowise
docker compose up -d
```

### Verify the Volume Mount

```bash
docker exec -it flowise sh
ls /mnt/mcp-server
exit
```
You should see server.js inside. If not, check your paths and edit docker-compose if required.

## 7. Set Up PM2 to Run the MCP Server Automatically

Since you’re running the MCP server outside of Docker, use PM2 to manage it.

### a. Install PM2 Globally

```bash
sudo npm install -g pm2
```

### b. Start the MCP Server with PM2

```bash
cd ~/flowise/mcp-server
pm2 start server.js --name mcp-email
```

### c. Configure PM2 for Auto-Start on Reboot

```bash
pm2 startup
# Execute the SUDO command provided by PM2
pm2 save
pm2 restart mcp-email
```

## 8. Configure Flowise Custom MPC Tool Node

Inside Flowise, set up the custom MPC tool node with this command:

```json
{
  "command": "node",
  "args": ["/mnt/mcp-server/server.js"]
}
```

---

### Summary

This guide provides a step-by-step walkthrough for setting up a Flowise environment integrated with an MCP server that sends emails via AWS SES. It covers:

- Installing Docker (with Docker Compose) and Node.js on an Ubuntu system.
- Organizing project directories and creating essential configuration files.
- Initializing a Node.js project for the MCP server.
- Deploying the Docker stack and verifying volume mounts.
- Configuring PM2 to automatically manage and restart the MCP server.

This setup is fully replicable on any Ubuntu system, with clear instructions on adjusting credentials and environment variables prior to production deployment.
