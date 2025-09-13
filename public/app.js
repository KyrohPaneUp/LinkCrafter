// Global variables
let guilds = [];
let messages = [];
let editModal;

// Initialize the app when DOM loads
document.addEventListener('DOMContentLoaded', function() {
    editModal = new bootstrap.Modal(document.getElementById('editModal'));
    
    // Load initial data
    checkBotStatus();
    loadChannels();
    loadMessages();
    
    // Set up form handlers
    document.getElementById('messageForm').addEventListener('submit', sendMessage);
    document.getElementById('guildSelect').addEventListener('change', updateChannelSelect);
    
    // Remove automatic refresh to prevent page reload issues
    // Users can manually refresh using the refresh button
});

// Check bot status
async function checkBotStatus() {
    try {
        const response = await fetch('/api/health', { credentials: 'include' });
        const data = await response.json();
        
        const statusElement = document.getElementById('status');
        const botStatusElement = document.getElementById('botStatus');
        
        if (data.botReady) {
            statusElement.textContent = 'Bot Online';
            statusElement.className = 'badge bg-success';
            
            botStatusElement.innerHTML = `
                <div class="d-flex align-items-center">
                    <div class="bg-success rounded-circle me-2" style="width: 8px; height: 8px;"></div>
                    <div>
                        <strong>Online</strong><br>
                        <small class="text-muted">${data.botTag}</small>
                    </div>
                </div>
            `;
        } else {
            statusElement.textContent = 'Bot Offline';
            statusElement.className = 'badge bg-danger';
            
            botStatusElement.innerHTML = `
                <div class="d-flex align-items-center">
                    <div class="bg-danger rounded-circle me-2" style="width: 8px; height: 8px;"></div>
                    <div>
                        <strong>Offline</strong><br>
                        <small class="text-muted">Discord token required</small>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error checking bot status:', error);
        document.getElementById('status').textContent = 'Connection Error';
        document.getElementById('status').className = 'badge bg-warning';
    }
}

// Load available channels
async function loadChannels() {
    try {
        const response = await fetch('/api/channels', { credentials: 'include' });
        guilds = await response.json();
        
        const guildSelect = document.getElementById('guildSelect');
        guildSelect.innerHTML = '<option value="">Select a server...</option>';
        
        guilds.forEach(guild => {
            const option = document.createElement('option');
            option.value = guild.id;
            option.textContent = guild.name;
            guildSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading channels:', error);
    }
}

// Update channel select when guild changes
function updateChannelSelect() {
    const guildId = document.getElementById('guildSelect').value;
    const channelSelect = document.getElementById('channelSelect');
    
    channelSelect.innerHTML = '<option value="">Select a channel...</option>';
    
    if (guildId) {
        const guild = guilds.find(g => g.id === guildId);
        if (guild) {
            guild.channels.forEach(channel => {
                const option = document.createElement('option');
                option.value = channel.id;
                option.textContent = `# ${channel.name}`;
                channelSelect.appendChild(option);
            });
        }
    }
}

// Send a message
async function sendMessage(event) {
    event.preventDefault();
    
    const channelId = document.getElementById('channelSelect').value;
    const title = document.getElementById('messageTitle').value;
    const content = document.getElementById('messageContent').value;
    const color = document.getElementById('embedColor').value;
    
    if (!channelId || !content.trim()) {
        showAlert('Please select a channel and enter message content', 'danger');
        return;
    }
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
    
    try {
        const response = await fetch('/api/send-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                channelId,
                content: content.trim(),
                title: title.trim() || null,
                color: title.trim() || color !== '#5865F2' ? color : null
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Message sent successfully!', 'success');
            document.getElementById('messageForm').reset();
            document.getElementById('embedColor').value = '#5865F2';
            loadMessages();
        } else {
            showAlert(result.error || 'Failed to send message', 'danger');
        }
    } catch (error) {
        console.error('Error sending message:', error);
        showAlert('Failed to send message', 'danger');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Message';
    }
}

// Load message history
async function loadMessages() {
    try {
        const response = await fetch('/api/messages', { credentials: 'include' });
        messages = await response.json();
        
        renderMessages();
    } catch (error) {
        console.error('Error loading messages:', error);
        document.getElementById('messagesContainer').innerHTML = 
            '<div class="alert alert-danger">Failed to load messages</div>';
    }
}

// Render messages in the UI
function renderMessages() {
    const container = document.getElementById('messagesContainer');
    
    if (messages.length === 0) {
        container.innerHTML = '<div class="text-center text-muted p-4">No messages sent yet</div>';
        return;
    }
    
    const sortedMessages = messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    container.innerHTML = sortedMessages.map(message => {
        const timestamp = new Date(message.timestamp).toLocaleString();
        const editedText = message.lastEdited ? 
            ` (edited ${new Date(message.lastEdited).toLocaleString()})` : '';
        
        return `
            <div class="message-item">
                <div class="message-header">
                    <div class="message-info">
                        <h6 class="mb-1">${message.title || 'Message'}</h6>
                        <div class="message-meta">
                            <span><strong>Server:</strong> ${message.guildName}</span>
                            <span><strong>Channel:</strong> # ${message.channelName}</span>
                            <span><strong>Sent:</strong> ${timestamp}${editedText}</span>
                        </div>
                    </div>
                    <div class="message-actions">
                        <button class="btn btn-outline-primary btn-sm" onclick="editMessage('${message.id}')">
                            Edit
                        </button>
                        <button class="btn btn-outline-danger btn-sm" onclick="deleteMessage('${message.id}')">
                            Delete
                        </button>
                    </div>
                </div>
                <div class="message-content ${message.isEmbed ? 'embed' : ''}" ${message.color ? `style="border-left-color: ${message.color};"` : ''}>
                    ${message.content}
                </div>
            </div>
        `;
    }).join('');
}

// Edit a message
function editMessage(messageId) {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    document.getElementById('editMessageId').value = messageId;
    document.getElementById('editTitle').value = message.title || '';
    document.getElementById('editContent').value = message.content;
    document.getElementById('editColor').value = message.color || '#5865F2';
    
    editModal.show();
}

// Save edited message
async function saveEdit() {
    const messageId = document.getElementById('editMessageId').value;
    const title = document.getElementById('editTitle').value;
    const content = document.getElementById('editContent').value;
    const color = document.getElementById('editColor').value;
    
    if (!content.trim()) {
        showAlert('Content cannot be empty', 'danger');
        return;
    }
    
    try {
        const response = await fetch(`/api/edit-message/${messageId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                content: content.trim(),
                title: title.trim() || null,
                color: title.trim() || color !== '#5865F2' ? color : null
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Message updated successfully!', 'success');
            editModal.hide();
            loadMessages();
        } else {
            showAlert(result.error || 'Failed to edit message', 'danger');
        }
    } catch (error) {
        console.error('Error editing message:', error);
        showAlert('Failed to edit message', 'danger');
    }
}

// Delete a message from history
async function deleteMessage(messageId) {
    if (!confirm('Are you sure you want to remove this message from history? This will not delete it from Discord.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/delete-message/${messageId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Message removed from history', 'success');
            loadMessages();
        } else {
            showAlert(result.error || 'Failed to delete message', 'danger');
        }
    } catch (error) {
        console.error('Error deleting message:', error);
        showAlert('Failed to delete message', 'danger');
    }
}

// Show alert messages
function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.querySelector('.container').insertBefore(alertDiv, document.querySelector('.container').firstChild);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}