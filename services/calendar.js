import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';

WebBrowser.maybeCompleteAuthSession();

const CLIENT_ID = '283887490054-oqfufknt05v68pmpcndsehrgnuide5nv.apps.googleusercontent.com';
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/tasks.readonly',
  'profile',
  'email',
];

export function useGoogleAuth() {
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: CLIENT_ID,
      scopes: SCOPES,
      redirectUri: AuthSession.makeRedirectUri({ useProxy: true }),
    },
    { authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth' }
  );
  return { request, response, promptAsync };
}

export async function handleAuthResponse(response) {
  if (response?.type === 'success') {
    const { access_token } = response.params;
    await AsyncStorage.setItem('googleToken', access_token);
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const user = await userRes.json();
    await AsyncStorage.setItem('googleUser', JSON.stringify(user));
    return { token: access_token, user };
  }
  return null;
}

export async function signOut() {
  await AsyncStorage.removeItem('googleToken');
  await AsyncStorage.removeItem('googleUser');
}

export async function getStoredToken() {
  return await AsyncStorage.getItem('googleToken');
}

export async function getStoredUser() {
  const data = await AsyncStorage.getItem('googleUser');
  return data ? JSON.parse(data) : null;
}

export async function getCalendarEvents(token) {
  if (!token || token === 'demo') return getDummyEvents();
  try {
    const now = new Date().toISOString();
    const end = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&timeMax=${end}&singleEvents=true&orderBy=startTime&maxResults=10`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    if (!res.ok) return getDummyEvents();
    return (data.items || []).map(e => {
      const start = e.start?.dateTime || e.start?.date;
      const eventDate = new Date(start);
      const isToday = eventDate.toDateString() === new Date().toDateString();
      return {
        title: e.summary || 'Untitled',
        time: eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isToday,
      };
    });
  } catch {
    return getDummyEvents();
  }
}

export async function getTodos(token) {
  if (!token || token === 'demo') return getDummyTodos();
  try {
    const res = await fetch(
      'https://tasks.googleapis.com/tasks/v1/lists/@default/tasks?showCompleted=false&maxResults=10',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    if (!res.ok) return getDummyTodos();
    return (data.items || []).map(t => ({
      title: t.title || 'Untitled',
      completed: t.status === 'completed',
      dueDate: t.due ? new Date(t.due).toLocaleDateString() : null,
    }));
  } catch {
    return getDummyTodos();
  }
}

function getDummyEvents() {
  return [
    { title: 'Study Session', time: '3:00 PM', isToday: true },
    { title: 'Exam Tomorrow', time: '9:00 AM', isToday: false },
  ];
}

function getDummyTodos() {
  return [
    { title: 'Finish assignment', completed: false, dueDate: 'Today' },
    { title: 'Review notes', completed: false, dueDate: 'Today' },
  ];
}
