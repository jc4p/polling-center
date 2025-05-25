const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787/api';

export async function apiCall(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  const response = await fetch(url, {
    ...defaultOptions,
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Helper to make authenticated API calls
export async function authenticatedApiCall(endpoint, authHeaders, options = {}) {
  return apiCall(endpoint, {
    ...options,
    headers: {
      ...authHeaders,
      ...options.headers,
    },
  });
}

// API methods for polls
export const pollsApi = {
  // Get all polls for home page
  getPolls: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiCall(`/polls${query ? `?${query}` : ''}`);
  },

  // Get specific poll details
  getPoll: async (id) => {
    return apiCall(`/polls/${id}`);
  },

  // Create new poll
  createPoll: async (data, authHeaders) => {
    return authenticatedApiCall('/polls', authHeaders, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Submit vote
  vote: async (pollId, data, authHeaders) => {
    return authenticatedApiCall(`/polls/${pollId}/vote`, authHeaders, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Get poll results
  getResults: async (pollId) => {
    return apiCall(`/polls/${pollId}/results`);
  },

  // Add reaction
  react: async (pollId, data, authHeaders) => {
    return authenticatedApiCall(`/polls/${pollId}/react`, authHeaders, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// API methods for votes
export const votesApi = {
  // Get votes list
  getVotes: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiCall(`/votes${query ? `?${query}` : ''}`);
  },

  // Get vote status
  getVoteStatus: async (voteId) => {
    return apiCall(`/votes/${voteId}/status`);
  },

  // Get vote by transaction hash
  getVoteByTransaction: async (txHash) => {
    return apiCall(`/votes/${txHash}`);
  },
};