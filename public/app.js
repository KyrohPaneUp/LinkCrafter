// Global variables
let guilds = [];
let messages = [];
let editModal;

// Initialize the app when DOM loads
function initApp() {
    console.log("DOM loaded, initializing app...");
    editModal = new bootstrap.Modal(document.getElementById("editModal"));

    // Check bot status immediately and retry if needed
    checkBotStatus();
    setTimeout(checkBotStatus, 1000); // Retry after 1 second

    // Load data that requires authentication
    loadChannels();
    loadMessages();
    
    toggleEmbedFields();

    // Set up form handlers
    document
        .getElementById("messageForm")
        .addEventListener("submit", sendMessage);
    document
        .getElementById("guildSelect")
        .addEventListener("change", updateChannelSelect);

    setTimeout(adjustPingsHeight, 100);
    displayPings();

    window.addEventListener('resize', adjustPingsHeight);
    // Remove automatic refresh to prevent page reload issues
    // Users can manually refresh using the refresh button
};

const pingMap = new Map([
    ['@everyone', '@everyone'],
    ['@here', '@here'],
    ['Notified', '<@&714610825557442621>'],
    ['Maps', '<@&987654321098765432>'],
    ['Completions', '<@&1352800315358838794>'],
    ['Map Submitter', '<@&1146164496776315031>'],
    ['XVI', '<@&605773184138084363>'],
    ['Economy Breaker', '<@&684809300618772600>'],
    ['Millionaire', '<@&686657305684475964>']
]);

function adjustPingsHeight() {
    const messageContainer = document.getElementById('messageContainer');
    const botStatusCard = document.getElementById('botStatusCard');
    const pingsCard = document.querySelector('.col-md-4 .card:last-child');

    if (messageContainer && botStatusCard && pingsCard) {
        const messageHeight = messageContainer.offsetHeight;
        pingsCard.style.height = (messageHeight - botStatusCard.offsetHeight - 16) + 'px';
    }
}

setTimeout(adjustPingsHeight, 100);

const observer = new MutationObserver(adjustPingsHeight);
observer.observe(messageContainer, { 
    childList: true, 
    subtree: true, 
    attributes: true 
});

window.addEventListener('resize', adjustPingsHeight);
window.addEventListener('load', adjustPingsHeight);


function displayPings() {
    const pingsList = document.getElementById('pingsList');

    if (pingMap.size === 0) {
        pingsList.innerHTML = '<div class="text-center text-muted py-3">No pings available</div>';
        return;
    }

    let html = '';
    pingMap.forEach((value, key) => {
        html += `
            <div class="d-flex justify-content-between align-items-center mb-2 p-2 border rounded ping-item">
                <div class="fw-medium text-truncate me-2" title="${key}">${key}</div>
                <button class="btn btn-sm btn-outline-primary flex-shrink-0" onclick="handlePingClick('${key}')">
                    Insert
                </button>
            </div>
        `;
    });

    pingsList.innerHTML = html;
}

function handlePingClick(key) {
    const value = pingMap.get(key);
    console.log(`Ping clicked: ${key} = ${value}`);

    const messageContent = document.getElementById('messageContent');
    if (messageContent) {
        messageContent.value += ` ${value}`;
        messageContent.focus();
    }
}

function refreshPings() {
    const pingsList = document.getElementById('pingsList');
    pingsList.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm me-2" role="status"></div>Refreshing...</div>';

    setTimeout(() => {
        displayPings();
    }, 500);
}

function onMessageContainerChange() {
    setTimeout(adjustPingsHeight, 50);
}

// Check bot status
async function checkBotStatus() {
    console.log("checkBotStatus called");
    try {
        const response = await fetch("/api/health", { credentials: "include" });
        const data = await response.json();
        console.log("Health API response:", data);

        const statusElement = document.getElementById("status");
        const botStatusElement = document.getElementById("botStatus");
        console.log("Status element:", statusElement);
        console.log("Bot status element:", botStatusElement);

        if (data.botReady) {
            if (statusElement) {
                statusElement.textContent = "Bot Online";
                statusElement.className = "badge bg-success";
            }

            if (botStatusElement) {
                botStatusElement.innerHTML = `
                    <div class="d-flex align-items-center">
                        <div class="bg-success rounded-circle me-2" style="width: 8px; height: 8px;"></div>
                        <div>
                            <strong>Online</strong><br>
                            <small class="text-muted">${data.botTag}</small>
                        </div>
                    </div>
                `;
            }
        } else {
            if (statusElement) {
                statusElement.textContent = "Bot Offline";
                statusElement.className = "badge bg-danger";
            }

            if (botStatusElement) {
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
        }
    } catch (error) {
        console.error("Error checking bot status:", error);
        const statusElement = document.getElementById("status");
        if (statusElement) {
            statusElement.textContent = "Connection Error";
            statusElement.className = "badge bg-warning";
        }
    }
}

// Load available channels
async function loadChannels() {
    console.log("loadChannels called");
    try {
        const response = await fetch("/api/channels", {
            credentials: "include",
        });
        console.log("Channels API response status:", response.status);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        guilds = await response.json();
        console.log("Guilds data received:", guilds);

        const guildSelect = document.getElementById("guildSelect");
        console.log("Guild select element:", guildSelect);
        guildSelect.innerHTML = '<option value="">Select a server...</option>';

        guilds.forEach((guild) => {
            console.log("Adding guild:", guild.name);
            const option = document.createElement("option");
            option.value = guild.id;
            option.textContent = guild.name;
            guildSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Error loading channels:", error);
        const guildSelect = document.getElementById("guildSelect");
        if (error.message.includes("401")) {
            guildSelect.innerHTML =
                '<option value="">Please login first</option>';
        } else {
            guildSelect.innerHTML =
                '<option value="">Error loading servers</option>';
        }
    }
}

// Update channel select when guild changes
function updateChannelSelect() {
    const guildId = document.getElementById("guildSelect").value;
    const channelSelect = document.getElementById("channelSelect");
    console.log("updateChannelSelect called with guildId:", guildId);

    channelSelect.innerHTML = '<option value="">Select a channel...</option>';

    if (guildId) {
        const guild = guilds.find((g) => g.id === guildId);
        console.log("Found guild:", guild);
        if (guild) {
            guild.channels.forEach((channel) => {
                console.log("Adding channel:", channel.name);
                const option = document.createElement("option");
                option.value = channel.id;
                option.textContent = `# ${channel.name}`;
                channelSelect.appendChild(option);
            });
        }
    }
}

// Refresh both servers and channels
async function refreshServersAndChannels() {
    console.log("Refreshing servers and channels...");

    // Save the currently selected server
    const currentGuildId = document.getElementById("guildSelect").value;
    console.log("Current selected guild:", currentGuildId);

    // Load the servers
    await loadChannels();

    // Re-select the previously selected server if it exists
    if (currentGuildId) {
        const guildSelect = document.getElementById("guildSelect");
        guildSelect.value = currentGuildId;
        console.log("Re-selected guild:", currentGuildId);
    }

    // Update channels for the selected server
    updateChannelSelect();
}

// Toggle embed fields visibility
function toggleEmbedFields() {
    const useEmbed = document.getElementById('useEmbed').checked;
    const embedFields = document.getElementById('embedFields');
    
    if (useEmbed) {
        embedFields.style.display = 'block';
    } else {
        embedFields.style.display = 'none';
    }
}

// Send a message
async function sendMessage(event) {
    console.log("sendMessage called");
    
    // Prevent default form submission if event exists
    if (event && event.preventDefault) {
        event.preventDefault();
    }

    const channelId = document.getElementById("channelSelect").value;
    const content = document.getElementById("messageContent").value;
    const useEmbed = document.getElementById("useEmbed").checked;
    const title = useEmbed ? document.getElementById("messageTitle").value : "";
    const color = useEmbed ? document.getElementById("embedColor").value : "#5865F2";

    if (!channelId || !content.trim()) {
        showAlert(
            "Please select a channel and enter message content",
            "danger",
        );
        return;
    }

    // Find the submit button
    const submitBtn = document.querySelector('#messageForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending...";
    }
    try {
        const response = await fetch("/api/send-message", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
                channelId,
                content: content.trim(),
                useEmbed: useEmbed,
                title: useEmbed && title.trim() ? title.trim() : null,
                color: useEmbed && color !== "#5865F2" ? color : null,
            }),
        });

        const result = await response.json();

        console.log("Send message result:", result);
        if (result.success) {
            showAlert("Message sent successfully!", "success");
            document.getElementById("messageForm").reset();
            document.getElementById("embedColor").value = "#5865F2";
            loadMessages();
        } else {
            showAlert(result.error || "Failed to send message", "danger");
        }
    } catch (error) {
        console.error("Error sending message:", error);
        showAlert("Failed to send message", "danger");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Send Message";
        }
    }
    toggleEmbedFields();
}

// Load message history
async function loadMessages() {
    try {
        const response = await fetch("/api/messages", {
            credentials: "include",
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        messages = await response.json();
        renderMessages();
    } catch (error) {
        console.error("Error loading messages:", error);
        const container = document.getElementById("messagesContainer");
        if (container) {
            if (error.message.includes("401")) {
                container.innerHTML =
                    '<div class="alert alert-warning">Please login to view message history</div>';
            } else {
                container.innerHTML =
                    '<div class="alert alert-danger">Failed to load messages</div>';
            }
        }
    }
}

// Render messages in the UI
function renderMessages() {
    const container = document.getElementById("messagesContainer");

    if (messages.length === 0) {
        container.innerHTML =
            '<div class="text-center text-muted p-4">No messages sent yet</div>';
        return;
    }

    const sortedMessages = messages.sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
    );

    container.innerHTML = sortedMessages
        .map((message) => {
            const timestamp = new Date(message.timestamp).toLocaleString();
            const editedText = message.lastEdited
                ? ` (edited ${new Date(message.lastEdited).toLocaleString()})`
                : "";

            return `
            <div class="message-item">
                <div class="message-header">
                    <div class="message-info">
                        <h6 class="mb-1">${message.title || "Message"}</h6>
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
                <div class="message-content ${message.isEmbed ? "embed" : ""}" ${message.color ? `style="border-left-color: ${message.color};"` : ""}>
                    ${message.content}
                </div>
            </div>
        `;
        })
        .join("");
}

// Edit a message
function editMessage(messageId) {
    const message = messages.find((m) => m.id === messageId);
    if (!message) return;

    document.getElementById("editMessageId").value = messageId;
    document.getElementById("editContent").value = message.content;

    const editEmbedFields = document.getElementById("editEmbedFields");

    if (message.isEmbed) {
        document.getElementById("editTitle").value = message.title || "";
        document.getElementById("editColor").value = message.color || "#5865F2";
        editEmbedFields.style.display = 'block';
    } else {
        console.log("disabling embed fields")
        editEmbedFields.style.display = 'none';
    }

    editModal.show();
}


// Save edited message
async function saveEdit() {
    const messageId = document.getElementById("editMessageId").value;
    const content = document.getElementById("editContent").value.trim();

    if (!content) {
        showAlert("Content cannot be empty", "danger");
        return;
    }

    // Finde Nachricht, um zu prüfen, ob Embed oder nicht
    const message = messages.find((m) => m.id === messageId);
    if (!message) {
        showAlert("Message not found", "danger");
        return;
    }

    let body = { content };

    if (message.isEmbed) {
        // Nur dann Title/Color anhängen
        body.title = document.getElementById("editTitle").value.trim() || null;
        body.color = document.getElementById("editColor").value;
    }

    try {
        const response = await fetch(`/api/edit-message/${messageId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(body),
        });

        const result = await response.json();

        if (result.success) {
            showAlert("Message updated successfully!", "success");
            editModal.hide();
            loadMessages();
        } else {
            showAlert(result.error || "Failed to edit message", "danger");
        }
    } catch (error) {
        console.error("Error editing message:", error);
        showAlert("Failed to edit message", "danger");
    }
}


// Delete a message from history
async function deleteMessage(messageId) {
    if (
        !confirm(
            "Are you sure you want to remove this message from history? This will not delete it from Discord.",
        )
    ) {
        return;
    }

    try {
        const response = await fetch(`/api/delete-message/${messageId}`, {
            method: "DELETE",
            credentials: "include",
        });

        const result = await response.json();

        if (result.success) {
            showAlert("Message removed from history", "success");
            loadMessages();
        } else {
            showAlert(result.error || "Failed to delete message", "danger");
        }
    } catch (error) {
        console.error("Error deleting message:", error);
        showAlert("Failed to delete message", "danger");
    }
}

// Show alert messages
function showAlert(message, type) {
    const alertDiv = document.createElement("div");
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    document
        .querySelector(".container")
        .insertBefore(
            alertDiv,
            document.querySelector(".container").firstChild,
        );

    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}
