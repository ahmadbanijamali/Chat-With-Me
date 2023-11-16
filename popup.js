// popup.js

// Function to update the chat container with a new message
function updateChat(message, isUser = true) {
  const chatContainer = document.getElementById('chat-container');
  const className = isUser ? 'user-message' : 'bot-message';
  const prefix = isUser ? 'You' : 'Bot';
  chatContainer.innerHTML += `<div class="${className}">${prefix}: ${message}</div>`;
}

// Function to save the current chat session
function saveChatSession() {
  const chatContainer = document.getElementById('chat-container');
  const chatHtml = chatContainer.innerHTML;
  chrome.storage.sync.get(['chatSessions'], function(result) {
    let chatSessions = result.chatSessions || [];
    // Append the new session to the array
    chatSessions.push(chatHtml);
    chrome.storage.sync.set({ 'chatSessions': chatSessions });
  });
}

// Function to load chat sessions and display them in a list
function loadChatSessions() {
  chrome.storage.sync.get(['chatSessions'], function(result) {
    let chatSessions = result.chatSessions || [];
    const sessionsList = document.getElementById('sessions-list');
    sessionsList.innerHTML = ''; // Clear any existing list items
    chatSessions.forEach((sessionHtml, index) => {
      const sessionItem = document.createElement('li');
      // Extract the first few words as the title
      const title = extractTitle(sessionHtml);
      sessionItem.textContent = title || `Chat ${index + 1}`;
      sessionItem.addEventListener('click', function() {
        document.getElementById('chat-container').innerHTML = sessionHtml;
      });
      sessionsList.appendChild(sessionItem);
    });
  });
}

// Function to extract the title from chat content
function extractTitle(chatHtml) {
  // Create a temporary element to parse the HTML
  const tempElement = document.createElement('div');
  tempElement.innerHTML = chatHtml;

  // Find the first user message (question)
  const userMessage = tempElement.querySelector('.user-message');

  // Use the first user message as the title without adding "You:"
  const title = userMessage ? userMessage.textContent.trim() : 'Untitled';

  return title;
}


// Function to start a new chat session
function startNewChat() {
  document.getElementById('chat-container').innerHTML = ''; // Clear chat container
  document.getElementById('message-input').value = ''; // Clear input field
  saveChatSession(); // Save the empty chat session to start fresh
  loadChatSessions(); // Reload the sessions list to include the new chat
}

// Function to clear all chat sessions
function clearChatHistory() {
  // Confirm with the user before clearing the chat history
  if (confirm('Are you sure you want to clear all chat history?')) {
    // Clear the chatSessions from storage
    chrome.storage.sync.set({ 'chatSessions': [] }, function() {
      console.log('Chat history cleared.');
      // Update the sessions list on the popup
      loadChatSessions();
    });
  }
}

// Function to get the OpenAI API key from storage
function getApiKey(callback) {
  chrome.storage.sync.get(['openaiApiKey'], function(result) {
    const apiKey = result.openaiApiKey;
    callback(apiKey);
  });
}

// Function to set the OpenAI API key in storage
function setApiKey(apiKey) {
  chrome.storage.sync.set({ 'openaiApiKey': apiKey });
}

// Function to send a message to the chatbot
function sendMessage() {
  // Get the user's message
  const userInput = document.getElementById('message-input');
  const message = userInput.value;

  // Update the chat container with the user's message
  updateChat(message);

  // Clear the input field
  userInput.value = '';

  // Get the OpenAI API key
  getApiKey(function(apiKey) {
    // Make a request to the OpenAI API
    fetch('https://api.openai.com/v1/engines/davinci/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        prompt: message,
        max_tokens: 150,
        temperature: 0.5, // Ensure this is a number, not a string
        stop: ["EndOfMessage"] // Stop sequence to indicate the end of a response
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      // Check if the response has the expected structure
      if (data.choices && data.choices.length > 0 && data.choices[0].text) {
        // Handle the response from OpenAI
        updateChat(data.choices[0].text.trim(), false);
        // Save the chat session
        saveChatSession();
      } else {
        // Log the full response object as a JSON string to see the error details
        console.error('Invalid response from OpenAI:', JSON.stringify(data, null, 2));
      }
    })
    .catch(error => {
      // Log the full error object if there's an error in the fetch operation
      console.error('Error:', error);
    });
  });
}

// Ensure the DOM is fully loaded before adding event listeners
document.addEventListener('DOMContentLoaded', function () {

  // Add event listener for the New Chat button
  document.getElementById('new-chat-button').addEventListener('click', startNewChat);

  // Load and display chat sessions
  loadChatSessions();

  // Add event listener to the button
  document.getElementById('send-button').addEventListener('click', sendMessage);

  // Add event listener for the Clear Chat History button
  document.getElementById('clear-history-button').addEventListener('click', clearChatHistory);

  // Add event listener for the Enter key press on the message input
  document.getElementById('message-input').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
      event.preventDefault(); // Prevent the default action to avoid form submission
      sendMessage();
    }
  });

  // Example of using the getApiKey function
  getApiKey(function(apiKey) {
    if (!apiKey) {
      // If the API key is not in storage, prompt the user to enter it
      apiKey = prompt('Please enter your OpenAI API key:');
      setApiKey(apiKey);
    }
    // Now you can use the apiKey to make requests to OpenAI
    console.log('Using API key:', apiKey);
  });
});

// Save the chat session when the popup window is closed
window.onunload = saveChatSession;