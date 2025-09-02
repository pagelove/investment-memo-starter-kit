// ABOUTME: Web component to display the last network request
// ABOUTME: Shows formatted details of the most recent HTTP request

class NetworkLastRequest extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.lastRequest = null;
    
    // Style for the component
    const style = document.createElement('style');
    style.textContent = `
      @import url('https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css');
      
      :host {
        display: block;
        margin: 8px 0;
      }
      
      pre {
        margin: 0;
        border-radius: 4px;
        background: #0d1117 !important;
      }
      
      code {
        font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace !important;
        font-size: 13px !important;
        padding: 16px !important;
      }
      
      .empty-state {
        color: #6a6a6a;
        font-style: italic;
        font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
        font-size: 13px;
        padding: 16px;
        background: #0d1117;
        border-radius: 4px;
      }
      
      .timestamp {
        color: #6a6a6a;
        font-size: 10px;
        margin-top: 8px;
        text-align: right;
        font-family: system-ui, -apple-system, sans-serif;
      }
    `;
    
    this.shadowRoot.appendChild(style);
    this.container = document.createElement('div');
    this.shadowRoot.appendChild(this.container);
    
    this.render();
    this.interceptRequests();
  }
  
  interceptRequests() {
    // Store original fetch
    const originalFetch = window.fetch;
    
    // Override fetch to capture requests
    window.fetch = async (...args) => {
      const [resource, config] = args;
      
      // Extract headers properly
      let headers = {};
      if (config?.headers) {
        // Handle Headers object
        if (config.headers instanceof Headers) {
          config.headers.forEach((value, key) => {
            headers[key] = value;
          });
        } 
        // Handle plain object
        else if (typeof config.headers === 'object') {
          headers = { ...config.headers };
        }
      }
      
      // Build full URL
      let fullUrl = resource.toString();
      if (resource instanceof Request) {
        fullUrl = resource.url;
      }
      
      // Capture request details
      const requestDetails = {
        method: config?.method || 'GET',
        url: fullUrl,
        headers: headers,
        body: config?.body,
        timestamp: new Date()
      };
      
      // Update the display
      this.lastRequest = requestDetails;
      this.render();
      
      // Call original fetch
      return originalFetch.apply(window, args);
    };
    
    // Also intercept XMLHttpRequest if needed
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    
    XMLHttpRequest.prototype.open = function(method, url) {
      this._requestDetails = {
        method,
        url,
        headers: {},
        timestamp: new Date()
      };
      return originalOpen.apply(this, arguments);
    };
    
    XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
      if (this._requestDetails) {
        this._requestDetails.headers[header] = value;
      }
      return originalSetRequestHeader.apply(this, arguments);
    };
    
    XMLHttpRequest.prototype.send = function(body) {
      if (this._requestDetails) {
        this._requestDetails.body = body;
        
        // Update the component
        const component = document.querySelector('network-last-request');
        if (component) {
          component.lastRequest = this._requestDetails;
          component.render();
        }
      }
      return originalSend.apply(this, arguments);
    };
  }
  
  formatBody(body) {
    if (!body) return null;
    
    // Always return the raw body as a string
    if (typeof body === 'string') {
      // Try to format as HTML if it looks like HTML
      if (body.trim().startsWith('<') && body.trim().endsWith('>')) {
        return this.formatHtml(body);
      }
      return body;
    }
    
    // If it's FormData, convert to readable format
    if (body instanceof FormData) {
      const entries = [];
      for (const [key, value] of body.entries()) {
        entries.push(`${key}: ${value}`);
      }
      return entries.join('\n');
    }
    
    // For other types, convert to string
    return body.toString();
  }
  
  formatHtml(html) {
    // Simple HTML formatter
    let formatted = '';
    let indent = 0;
    const lines = html
      .replace(/></g, '>\n<')  // Add newlines between tags
      .split('\n');
    
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      
      // Decrease indent for closing tags
      if (line.startsWith('</')) {
        indent = Math.max(0, indent - 1);
      }
      
      // Add the line with proper indentation
      formatted += '  '.repeat(indent) + line + '\n';
      
      // Increase indent for opening tags (not self-closing or closing tags)
      if (line.startsWith('<') && !line.startsWith('</') && !line.endsWith('/>')) {
        // Don't increase indent for tags that close on the same line
        if (!line.includes('</')) {
          indent++;
        }
      }
    }
    
    return formatted.trim();
  }
  
  render() {
    if (!this.lastRequest) {
      this.container.innerHTML = '<div class="empty-state">No requests captured yet</div>';
      return;
    }
    
    const { method, url, headers, body, timestamp } = this.lastRequest;
    
    // Format as HTTP message
    let httpMessage = `${method} ${url} HTTP/1.1`;
    
    // Add headers
    if (headers && Object.keys(headers).length > 0) {
      for (const [key, value] of Object.entries(headers)) {
        httpMessage += `\n${key}: ${value}`;
      }
    }
    
    // Add body if present
    const formattedBody = this.formatBody(body);
    if (formattedBody) {
      httpMessage += '\n\n' + formattedBody;
    }
    
    // Create pre and code elements for highlighting
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.className = 'language-http';
    code.textContent = httpMessage;
    pre.appendChild(code);
    
    // Apply syntax highlighting if hljs is available
    if (window.hljs) {
      window.hljs.highlightElement(code);
    }
    
    // Clear container and add highlighted code
    this.container.innerHTML = '';
    this.container.appendChild(pre);
    
    // Add timestamp
    const timestampDiv = document.createElement('div');
    timestampDiv.className = 'timestamp';
    timestampDiv.textContent = timestamp.toLocaleTimeString();
    this.container.appendChild(timestampDiv);
  }
}

// Register the custom element
customElements.define('network-last-request', NetworkLastRequest);

export default NetworkLastRequest;