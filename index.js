const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcrypt');
const fs = require('fs').promises;
const path = require('path');

// Initialize Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

// Initialize Express app
const app = express();

// Enforce production security requirements
if (process.env.NODE_ENV === 'production') {
    if (!process.env.SESSION_SECRET) {
        console.error('❌ Production requires SESSION_SECRET environment variable');
        process.exit(1);
    }
    if (!process.env.STAFF_USERNAME || !process.env.STAFF_PASSWORD_HASH) {
        console.error('❌ Production requires STAFF_USERNAME and STAFF_PASSWORD_HASH environment variables');
        process.exit(1);
    }
    // Trust proxy for secure cookies behind load balancers
    app.set('trust proxy', 1);
}

if (!process.env.SESSION_SECRET) {
    console.warn('⚠️  SESSION_SECRET not set. Using temporary secret for development.');
}

// Configure session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-session-secret-' + Date.now(),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Configure CORS securely - allow Replit domains
const allowedOrigins = [
    'http://localhost:5000',
    `https://${process.env.REPLIT_DEV_DOMAIN}`,
    `http://${process.env.REPLIT_DEV_DOMAIN}`
].filter(Boolean);

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

app.use(bodyParser.json());

// Handle trailing slash with internal rewrite (no redirect to avoid loops)
app.use((req, res, next) => {
    if (req.url.endsWith('.html/')) {
        req.url = req.url.slice(0, -1); // internal rewrite, prevents ping-pong
    }
    next();
});

// Serve static files normally - auth protection is handled by API endpoints
app.use(express.static('public'));

// Default staff credentials - use environment variables for production
async function getStaffUsers() {
    if (process.env.STAFF_USERNAME && process.env.STAFF_PASSWORD_HASH) {
        return {
            [process.env.STAFF_USERNAME]: process.env.STAFF_PASSWORD_HASH
        };
    }
    
    // Development default - hash for "staff123"
    const defaultHash = await bcrypt.hash('staff123', 10);
    return {
        'staff': defaultHash
    };
}

let STAFF_USERS = {};

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (req.session && req.session.authenticated) {
        return next();
    } else {
        return res.status(401).json({ error: 'Authentication required' });
    }
};

// Message storage file
const MESSAGES_FILE = 'messages.json';

// Load messages from storage
async function loadMessages() {
    try {
        const data = await fs.readFile(MESSAGES_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

// Save messages to storage
async function saveMessages(messages) {
    await fs.writeFile(MESSAGES_FILE, JSON.stringify(messages, null, 2));
}

// Initialize staff users
(async () => {
    STAFF_USERS = await getStaffUsers();
    console.log('🔐 Staff authentication initialized');
})();

// Discord bot ready event
client.once('ready', () => {
    console.log(`✅ Discord bot logged in as ${client.user.tag}`);
});

// Root route is now handled by static middleware above

// Authentication endpoints
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }
    
    // Ensure staff users are loaded
    if (Object.keys(STAFF_USERS).length === 0) {
        STAFF_USERS = await getStaffUsers();
    }
    
    const hashedPassword = STAFF_USERS[username];
    if (!hashedPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    try {
        const validPassword = await bcrypt.compare(password, hashedPassword);
        if (validPassword) {
            req.session.authenticated = true;
            req.session.username = username;
            res.json({ success: true, username });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ success: true });
    });
});

app.get('/api/auth-status', (req, res) => {
    res.json({ 
        authenticated: !!(req.session && req.session.authenticated),
        username: req.session?.username || null
    });
});

// API endpoint to get all guilds and channels
app.get('/api/channels', requireAuth, async (req, res) => {
    try {
        if (!client.user) {
            return res.status(503).json({ error: 'Bot not ready' });
        }

        const guilds = client.guilds.cache.map(guild => ({
            id: guild.id,
            name: guild.name,
            channels: guild.channels.cache
                .filter(channel => channel.type === 0) // Text channels only
                .map(channel => ({
                    id: channel.id,
                    name: channel.name
                }))
        }));

        res.json(guilds);
    } catch (error) {
        console.error('Error fetching channels:', error);
        res.status(500).json({ error: 'Failed to fetch channels' });
    }
});

// API endpoint to send a message
app.post('/api/send-message', requireAuth, async (req, res) => {
    try {
        const { channelId, content, useEmbed, title, color } = req.body;

        if (!channelId || !content) {
            return res.status(400).json({ error: 'Channel ID and content are required' });
        }

        const channel = client.channels.cache.get(channelId);
        if (!channel) {
            return res.status(404).json({ error: 'Channel not found' });
        }

        let message;
        if (useEmbed) {
            const embed = new EmbedBuilder()
                .setDescription(content);
            
            if (title) embed.setTitle(title);
            if (color) embed.setColor(color);

            message = await channel.send({ embeds: [embed] });
        } else {
            message = await channel.send(content);
        }

        // Store message info
        const messages = await loadMessages();
        const messageData = {
            id: message.id,
            channelId: channel.id,
            channelName: channel.name,
            guildId: channel.guild.id,
            guildName: channel.guild.name,
            content,
            title: useEmbed && title ? title : null,
            color: useEmbed && color ? color : null,
            timestamp: new Date().toISOString(),
            isEmbed: useEmbed
        };

        messages.push(messageData);
        await saveMessages(messages);

        res.json({ success: true, messageId: message.id, messageData });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// API endpoint to get all sent messages
app.get('/api/messages', requireAuth, async (req, res) => {
    try {
        const messages = await loadMessages();
        res.json(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// API endpoint to edit a message
app.put('/api/edit-message/:messageId', requireAuth, async (req, res) => {
    try {
        const { messageId } = req.params;
        const { content, title, color } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'Content is required' });
        }

        // Find message in storage
        const messages = await loadMessages();
        const messageIndex = messages.findIndex(msg => msg.id === messageId);
        
        if (messageIndex === -1) {
            return res.status(404).json({ error: 'Message not found in storage' });
        }

        const storedMessage = messages[messageIndex];
        
        // Get the Discord channel and message
        const channel = client.channels.cache.get(storedMessage.channelId);
        if (!channel) {
            return res.status(404).json({ error: 'Channel not found' });
        }

        const discordMessage = await channel.messages.fetch(messageId);
        if (!discordMessage) {
            return res.status(404).json({ error: 'Discord message not found' });
        }

        // Edit the message
        if (storedMessage.isEmbed || title || color) {
            const embed = new EmbedBuilder()
                .setDescription(content);
            
            if (title) embed.setTitle(title);
            if (color) embed.setColor(color);

            await discordMessage.edit({ embeds: [embed] });
        } else {
            await discordMessage.edit(content);
        }

        // Update stored message
        messages[messageIndex] = {
            ...storedMessage,
            content,
            title: title || storedMessage.title,
            color: color || storedMessage.color,
            lastEdited: new Date().toISOString(),
            isEmbed: !!(title || color || storedMessage.isEmbed)
        };
        
        await saveMessages(messages);

        res.json({ success: true, messageData: messages[messageIndex] });
    } catch (error) {
        console.error('Error editing message:', error);
        res.status(500).json({ error: 'Failed to edit message' });
    }
});

// API endpoint to delete a message from storage
app.delete('/api/delete-message/:messageId', requireAuth, async (req, res) => {
    try {
        const { messageId } = req.params;
        
        const messages = await loadMessages();
        const filteredMessages = messages.filter(msg => msg.id !== messageId);
        
        if (messages.length === filteredMessages.length) {
            return res.status(404).json({ error: 'Message not found' });
        }
        
        await saveMessages(filteredMessages);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ error: 'Failed to delete message' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        botReady: !!client.user,
        botTag: client.user?.tag || 'Not logged in'
    });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web server running on port ${PORT}`);
});

// Login to Discord (requires DISCORD_BOT_TOKEN environment variable)
if (process.env.DISCORD_BOT_TOKEN) {
    client.login(process.env.DISCORD_BOT_TOKEN).catch(error => {
        console.error('❌ Failed to login to Discord:', error.message);
        console.log('💡 Please set your DISCORD_BOT_TOKEN environment variable');
    });
} else {
    console.log('⚠️  DISCORD_BOT_TOKEN not found. Please add your bot token to continue.');
    console.log('💡 The web interface will still work, but Discord functionality will be limited.');
}