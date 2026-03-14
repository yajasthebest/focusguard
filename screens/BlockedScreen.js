import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  SafeAreaView, Animated, StatusBar,
} from "react-native";
import { sendMessage } from "../services/ai";
import { getCalendarEvents, getTodos, getStoredToken } from "../services/calendar";
import { addUsageMinutes } from "../services/storage";

export default function BlockedScreen({ route, navigation }) {
  const { appName, packageName, usedMinutes, limitMinutes } = route.params;

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState(null);
  const [googleToken, setGoogleToken] = useState(null);
  const [decision, setDecision] = useState(null);
  const [grantedMinutes, setGrantedMinutes] = useState(null);
  const [initializing, setInitializing] = useState(true);

  const scrollRef = useRef(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const remaining = limitMinutes - usedMinutes;
  const percent = Math.round((usedMinutes / limitMinutes) * 100);

  useEffect(() => { initialize(); }, []);
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  const initialize = async () => {
    const token = await getStoredToken();
    setGoogleToken(token);

    const [events, todos] = await Promise.all([
      getCalendarEvents(token),
      getTodos(token),
    ]);

    const ctx = { appName, usedMinutes, limitMinutes, calendarEvents: events, todos };
    setContext(ctx);

    // Fire opening message
    setLoading(true);
    try {
      const opening = await sendMessage(
        [{ role: "user", content: `I want to open ${appName}` }],
        ctx,
        token
      );
      setMessages([
        { role: "user", content: `I want to open ${appName}` },
        { role: "assistant", content: opening.message },
      ]);
      if (opening.accessGranted === true) grantAccess(opening.grantedMinutes);
      if (opening.accessGranted === false) denyAccess();
    } catch (e) {
      setMessages([{ role: "assistant", content: `⚠️ ${e.message}` }]);
    }
    setLoading(false);
    setInitializing(false);
  };

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const grantAccess = (mins) => {
    setDecision("granted");
    setGrantedMinutes(mins || remaining);
  };

  const denyAccess = () => {
    setDecision("denied");
    shake();
  };

  const send = async () => {
    if (!input.trim() || loading || decision) return;
    const text = input.trim();
    setInput("");
    setLoading(true);

    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);

    try {
      const res = await sendMessage(
        newMessages.map(m => ({ role: m.role, content: m.content })),
        context,
        googleToken
      );
      setMessages(prev => [...prev, { role: "assistant", content: res.message }]);
      if (res.accessGranted === true) grantAccess(res.grantedMinutes);
      else if (res.accessGranted === false) denyAccess();
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: `⚠️ ${e.message}` }]);
    }
    setLoading(false);
  };

  if (initializing) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.initWrap}>
          <ActivityIndicator color="#7c3aed" size="large" />
          <Text style={s.initText}>Checking your schedule...</Text>
          <Text style={s.initSub}>Looking at calendar and todos</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Header */}
      <Animated.View style={[s.header, { transform: [{ translateX: shakeAnim }] }]}>
        <View style={s.appIcon}><Text style={s.appIconText}>{appName[0]}</Text></View>
        <View style={s.headerInfo}>
          <Text style={s.appName}>{appName}</Text>
          <Text style={s.usageLine}>{usedMinutes}m used · {remaining}m left · {percent}% of {limitMinutes}m</Text>
          <View style={s.barTrack}>
            <View style={[s.barFill, {
              width: `${Math.min(percent, 100)}%`,
              backgroundColor: percent > 80 ? "#ef4444" : percent > 50 ? "#f0a500" : "#7c3aed",
            }]} />
          </View>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.closeBtn}>
          <Text style={s.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Schedule chips */}
      {context?.calendarEvents?.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ maxHeight: 38, flexGrow: 0 }}
          contentContainerStyle={{ paddingHorizontal: 14, gap: 6, alignItems: "center" }}>
          {context.calendarEvents.slice(0, 3).map((e, i) => (
            <View key={i} style={[s.chip, e.isToday && s.chipUrgent]}>
              <Text style={s.chipText}>📅 {e.title}{e.isToday ? ` @ ${e.time}` : ""}</Text>
            </View>
          ))}
          {context.todos?.filter(t => !t.completed).slice(0, 2).map((t, i) => (
            <View key={`t${i}`} style={s.chipTodo}>
              <Text style={s.chipText}>📌 {t.title}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Chat */}
      <ScrollView ref={scrollRef} style={s.msgs} contentContainerStyle={{ padding: 14, gap: 10 }}>
        {messages.map((m, i) => (
          <View key={i} style={{ flexDirection: "row", justifyContent: m.role === "user" ? "flex-end" : "flex-start", gap: 8, alignItems: "flex-end" }}>
            {m.role === "assistant" && <View style={s.aiAvi}><Text>🛡️</Text></View>}
            <View style={[s.bubble, m.role === "user" ? s.userBubble : s.aiBubble]}>
              <Text style={s.bubbleText}>{m.content}</Text>
            </View>
          </View>
        ))}
        {loading && (
          <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
            <View style={s.aiAvi}><Text>🛡️</Text></View>
            <View style={s.aiBubble}><ActivityIndicator color="#7c3aed" size="small" /></View>
          </View>
        )}
      </ScrollView>

      {/* Decision */}
      {decision === "granted" && (
        <View style={s.grantedBox}>
          <Text style={{ fontSize: 32 }}>✅</Text>
          <Text style={s.decisionTitle}>Access Granted</Text>
          <Text style={s.decisionSub}>You have {grantedMinutes} minutes. Make it count.</Text>
          <TouchableOpacity style={s.openBtn} onPress={() => navigation.goBack()}>
            <Text style={s.openBtnText}>Open {appName}</Text>
          </TouchableOpacity>
        </View>
      )}

      {decision === "denied" && (
        <View style={s.deniedBox}>
          <Text style={{ fontSize: 32 }}>🔒</Text>
          <Text style={s.decisionTitle}>Access Denied</Text>
          <Text style={s.decisionSub}>Back to work.</Text>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Text style={s.backBtnText}>← Go Back</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input */}
      {!decision && (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={s.inputRow}>
            <TextInput
              style={s.input}
              placeholder="Make your case..."
              placeholderTextColor="#333"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={send}
              returnKeyType="send"
            />
            <TouchableOpacity style={[s.sendBtn, { opacity: loading ? 0.5 : 1 }]} onPress={send} disabled={loading}>
              <Text style={s.sendText}>→</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080808" },
  initWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  initText: { color: "white", fontFamily: "monospace", fontSize: 14, fontWeight: "700" },
  initSub: { color: "#444", fontFamily: "monospace", fontSize: 12 },
  header: { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: "#151515", gap: 10 },
  appIcon: { width: 42, height: 42, borderRadius: 10, backgroundColor: "#1a1a2e", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#7c3aed44" },
  appIconText: { color: "#7c3aed", fontWeight: "700", fontSize: 18 },
  headerInfo: { flex: 1 },
  appName: { color: "white", fontWeight: "700", fontFamily: "monospace", fontSize: 14 },
  usageLine: { color: "#444", fontFamily: "monospace", fontSize: 11, marginTop: 2, marginBottom: 4 },
  barTrack: { height: 3, backgroundColor: "#1a1a1a", borderRadius: 2 },
  barFill: { height: "100%", borderRadius: 2 },
  closeBtn: { padding: 6 },
  closeBtnText: { color: "#333", fontSize: 16 },
  chip: { backgroundColor: "#1a1a2e", borderWidth: 1, borderColor: "#7c3aed22", borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  chipUrgent: { backgroundColor: "#1a0a0a", borderColor: "#ef444433" },
  chipTodo: { backgroundColor: "#1a1500", borderWidth: 1, borderColor: "#f0a50022", borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  chipText: { color: "rgba(255,255,255,0.5)", fontSize: 10, fontFamily: "monospace" },
  msgs: { flex: 1 },
  aiAvi: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#1a1a2e", borderWidth: 1, borderColor: "#7c3aed33", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12 },
  bubble: { maxWidth: "78%", padding: 12, borderRadius: 16, borderWidth: 1 },
  aiBubble: { backgroundColor: "#111", borderColor: "#7c3aed22", borderBottomLeftRadius: 4 },
  userBubble: { backgroundColor: "#1a1a2e", borderColor: "#7c3aed44", borderBottomRightRadius: 4 },
  bubbleText: { color: "rgba(255,255,255,0.85)", fontFamily: "monospace", fontSize: 13, lineHeight: 19 },
  grantedBox: { padding: 20, alignItems: "center", gap: 6, borderTopWidth: 1, borderTopColor: "#1a3a1a", backgroundColor: "#081208" },
  deniedBox: { padding: 20, alignItems: "center", gap: 6, borderTopWidth: 1, borderTopColor: "#3a1a1a", backgroundColor: "#120808" },
  decisionTitle: { color: "white", fontWeight: "700", fontFamily: "monospace", fontSize: 15 },
  decisionSub: { color: "#555", fontFamily: "monospace", fontSize: 12 },
  openBtn: { marginTop: 6, paddingVertical: 11, paddingHorizontal: 28, backgroundColor: "#14532d", borderRadius: 10, borderWidth: 1, borderColor: "#22c55e33" },
  openBtnText: { color: "#22c55e", fontWeight: "700", fontFamily: "monospace" },
  backBtn: { marginTop: 6, paddingVertical: 11, paddingHorizontal: 28, backgroundColor: "#1a0808", borderRadius: 10, borderWidth: 1, borderColor: "#ef444433" },
  backBtnText: { color: "#ef4444", fontFamily: "monospace", fontWeight: "700" },
  inputRow: { flexDirection: "row", gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: "#111", backgroundColor: "#0d0d0d" },
  input: { flex: 1, backgroundColor: "#111", borderWidth: 1, borderColor: "#7c3aed33", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: "white", fontFamily: "monospace", fontSize: 13 },
  sendBtn: { width: 44, height: 44, backgroundColor: "#7c3aed", borderRadius: 10, alignItems: "center", justifyContent: "center" },
  sendText: { color: "white", fontSize: 18, fontWeight: "700" },
});
