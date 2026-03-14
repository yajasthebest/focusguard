import { GoogleSignin } from "@react-native-google-signin/google-signin";
import AsyncStorage from "@react-native-async-storage/async-storage";

// One Google sign-in gives us:
// 1. Access to Calendar + Tasks (to show the AI your schedule)
// 2. An OAuth token that proves to our backend the user is legit
//    (backend uses THIS to verify, then calls Gemini with its own key)

export function initGoogle() {
  GoogleSignin.configure({
    // Get this from console.cloud.google.com
    // Enable: Google Calendar API, Tasks API
    // Create OAuth 2.0 credentials → Android → package: com.focusguard
    webClientId: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
    scopes: [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/tasks.readonly",
    ],
  });
}

export async function signIn() {
  await GoogleSignin.hasPlayServices();
  const userInfo = await GoogleSignin.signIn();
  const { accessToken } = await GoogleSignin.getTokens();
  await AsyncStorage.setItem("googleToken", accessToken);
  await AsyncStorage.setItem("googleUser", JSON.stringify({
    name: userInfo.user.name,
    email: userInfo.user.email,
    photo: userInfo.user.photo,
  }));
  return { token: accessToken, user: userInfo.user };
}

export async function signOut() {
  await GoogleSignin.signOut();
  await AsyncStorage.removeItem("googleToken");
  await AsyncStorage.removeItem("googleUser");
}

export async function getStoredToken() {
  return await AsyncStorage.getItem("googleToken");
}

export async function getStoredUser() {
  const data = await AsyncStorage.getItem("googleUser");
  return data ? JSON.parse(data) : null;
}

export async function refreshToken() {
  try {
    await GoogleSignin.signInSilently();
    const { accessToken } = await GoogleSignin.getTokens();
    await AsyncStorage.setItem("googleToken", accessToken);
    return accessToken;
  } catch {
    return null;
  }
}

export async function getCalendarEvents(token) {
  if (!token) return [];
  try {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59);

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `timeMin=${now.toISOString()}&timeMax=${tomorrow.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=8`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    return (data.items || []).map(e => {
      const start = new Date(e.start?.dateTime || e.start?.date);
      return {
        title: e.summary || "Untitled",
        time: e.start?.dateTime ? start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "All day",
        isToday: start.toDateString() === now.toDateString(),
      };
    });
  } catch { return []; }
}

export async function getTodos(token) {
  if (!token) return [];
  try {
    const res = await fetch(
      "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks?showCompleted=false&maxResults=8",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    return (data.items || []).map(t => ({
      title: t.title || "Untitled",
      completed: t.status === "completed",
      dueDate: t.due ? new Date(t.due).toLocaleDateString() : null,
    }));
  } catch { return []; }
}
