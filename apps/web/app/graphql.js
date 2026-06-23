const GRAPHQL_URL = typeof window !== 'undefined'
  ? (window.location.origin.includes('localhost') ? 'http://localhost:4000/' : '/graphql')
  : 'http://localhost:4000/';

export async function queryGraphQL(query, variables = {}) {
  let token = null;
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('admin_token');
  }

  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });

    const json = await response.json();
    if (json.errors) {
      const errorMsg = json.errors[0].message || 'GraphQL Error';
      const errorCode = json.errors[0].extensions?.code;
      
      if (errorCode === 'UNAUTHORIZED' || errorMsg.includes('Authentication is required')) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_user');
          window.location.href = '/admin/login';
        }
      }
      throw new Error(errorMsg);
    }

    return json.data;
  } catch (error) {
    console.error('GraphQL Fetch Error:', error);
    throw error;
  }
}
