import axios from 'axios';

export const getAuthHeaders = () => {
  const glific_session = localStorage.getItem('glific_session');
  if (glific_session) {
    try {
      const token = JSON.parse(glific_session).access_token;
      return { Authorization: token };
    } catch (error) {
      console.error('Failed to parse glific_session:', error);
      return {};
    }
  }
  return {};
};

// Helper function to check if URL contains flow-editor
const isFlowEditorRequest = (url: string | URL): boolean => {
  const urlString = typeof url === 'string' ? url : url.toString();
  return urlString.includes('/flow-editor');
};

// configure defaults on the main axios instance
axios.defaults.headers.post['Content-Type'] = 'application/javascript';
axios.defaults.responseType = 'json';
axios.defaults.timeout = 30000;

// Configure the DEFAULT axios instance
axios.interceptors.request.use(
  config => {
    // Only add auth headers for */flow-editor* requests
    if (config.url && isFlowEditorRequest(config.url)) {
      const authHeaders = getAuthHeaders();
      config.headers = {
        ...config.headers,
        ...authHeaders
      };
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Intercept fetch requests globally (for requests that might use fetch)
const originalFetch = window.fetch;
window.fetch = function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // Only add auth headers if this is a flow-editor request
  if (typeof input == 'string' && isFlowEditorRequest(input)) {
    const authHeaders = getAuthHeaders();

    // Merge headers
    const headers = {
      ...authHeaders,
      ...(init?.headers || {})
    };

    const modifiedInit = {
      ...init,
      headers
    };

    return originalFetch(input, modifiedInit);
  }

  // For all other requests, use original fetch without modification
  return originalFetch(input, init);
};
