# Overview

This is a Discord staff bot with a web-based administrative dashboard. The application provides a dual interface: a Discord bot for server interaction and a secure web dashboard for staff members to manage bot messages. Staff can send new messages, edit existing ones, and monitor bot status through a Bootstrap-powered frontend. The system includes session-based authentication and supports both regular text messages and Discord embeds.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Backend Architecture
The application uses a Node.js Express server that integrates with Discord.js to create a hybrid bot-web application. The server handles both Discord bot functionality and HTTP API endpoints for the web interface. Session-based authentication is implemented using express-session with bcrypt for password hashing. The architecture separates concerns between Discord operations and web API handling within a single application instance.

## Frontend Architecture
The frontend is a single-page application built with vanilla JavaScript and Bootstrap 5 for styling. It uses a simple HTML structure with separate pages for login and the main dashboard. The frontend communicates with the backend through REST API calls using the Fetch API, with automatic session management through cookies.

## Authentication System
Authentication uses a simple username/password system with session-based authorization. Passwords are hashed using bcrypt, and sessions are managed server-side with configurable security settings for production environments. The system supports environment variable configuration for production credentials.

## Message Management
The application stores and manages Discord messages through the Discord API, allowing staff to create, edit, and delete messages across multiple servers and channels. Message data includes support for both plain text and embedded content with titles, descriptions, and color customization.

## Security Features
The application implements several security measures including secure session cookies in production, CORS configuration, HTTP-only cookies, and environment-based security enforcement. Production deployments require specific environment variables for session secrets and staff credentials.

# External Dependencies

## Discord Integration
- **discord.js v14**: Primary Discord API library for bot functionality
- Requires Discord bot token for authentication
- Uses Gateway intents for message and guild access

## Web Framework
- **Express.js**: Web server framework for API endpoints and static file serving
- **express-session**: Session management middleware
- **cors**: Cross-origin request handling
- **body-parser**: Request body parsing middleware

## Security Libraries
- **bcrypt**: Password hashing and verification
- **express-session**: Secure session management with configurable options

## Frontend Libraries
- **Bootstrap 5**: CSS framework loaded via CDN
- Uses vanilla JavaScript without additional frontend frameworks

## Environment Requirements
- Node.js 18.0.0 or higher
- Environment variables for production: SESSION_SECRET, STAFF_USERNAME, STAFF_PASSWORD_HASH, DISCORD_BOT_TOKEN
- Optional development fallbacks for local testing