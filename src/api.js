const API_BASE = import.meta.env.VITE_API_BASE || '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      /* ignore */
    }
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }

  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

export async function getHealth() {
  return request('/health');
}

export async function createSession(payload) {
  return request('/sessions', { method: 'POST', body: JSON.stringify(payload) });
}

export async function endSession(sessionId) {
  return request(`/sessions/${sessionId}`, { method: 'PATCH' });
}

export async function createTask(payload) {
  return request('/tasks', { method: 'POST', body: JSON.stringify(payload) });
}

export async function completeTask(taskId, payload) {
  return request(`/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function createAttempt(payload) {
  return request('/attempts', { method: 'POST', body: JSON.stringify(payload) });
}

export async function submitQuestionnaire(payload) {
  return request('/questionnaires', { method: 'POST', body: JSON.stringify(payload) });
}
