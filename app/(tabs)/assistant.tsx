// ============================================================
// Fridge Chef — AI Beslenme Asistanı Ekranı
// ============================================================
// Özellikler:
//  • Sadece yiyecek/beslenme soruları (guardrail)
//  • Chat arayüzü (kullanıcı + AI mesaj baloncukları)
//  • "Bu tarifi yap →" butonu → recipe.tsx'e geçiş
//  • Alakasız sorulara nazik ret yanıtı
// ============================================================

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GoogleGenAI } from '@google/genai';
import { useRouter } from 'expo-router';
import { AppThemeColors, Radius, Shadow, Spacing, Typography } from '../../constants/Colors';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import ScreenBackground from '../../components/ScreenBackground';

// ── Tip Tanımları ─────────────────────────────────────────────
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  recipeHint?: string | null; // AI bir tarif öneriyorsa yemek adı
}

// ── AI İstemcisi ──────────────────────────────────────────────
const getAiClient = () => {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error('API Key yok');
  return new GoogleGenAI({ apiKey });
};

const getAssistantInstruction = (lang?: string) => {
  const langName = lang === 'en' ? 'İngilizce' : lang === 'de' ? 'Almanca' : 'Türkçe';
  
  const guardrailReplies: Record<string, string> = {
    en: "Sorry, I can only help with food and nutrition topics 🍽️ Do you have any other recipe or nutrition questions?",
    de: "Es tut mir leid, ich kann nur bei Themen rund um Ernährung und Essen helfen 🍽️ Haben Sie andere Fragen zu Rezepten oder Ernährung?",
    tr: "Üzgünüm, ben sadece yiyecek ve beslenme konularında yardımcı olabiliyorum 🍽️ Başka bir tarif veya beslenme sorun var mı?"
  };
  
  const guardrailReply = guardrailReplies[lang || 'tr'] || guardrailReplies.tr;

  return `Sen "Fridge Chef" uygulamasının AI beslenme asistanısın. Adın "Şef".

## KRİTİK KURAL 1 — Konu Kısıtlaması (Guardrail):
SADECE şu konularda yardımcı olabilirsin:
- Yiyecek, yemek, tarif, pişirme teknikleri
- Beslenme, kalori, protein/karbonhidrat/yağ
- Diyet, sağlıklı beslenme, öğün planlaması
- Malzeme kombinasyonları ve mutfak ipuçları

Yiyecek/beslenme dışı sorulara şunu yanıtla:
"${guardrailReply}"

## KRİTİK KURAL 2 — Tarif Önerisi:
Eğer bir tarif öneriyorsan (bir yemek adı bahsediyorsan), yanıtının SONUNA şu formatı ekle:
[TARIF_ONER: "Tam Tarif Adı"]

Örnek: Sana Fettuccine Alfredo öneririm. [TARIF_ONER: "Fettuccine Alfredo"]

## KRİTİK KURAL 3 — Dil: ${langName}, samimi ve sıcak bir dil kullan.
Kısa ve öz yanıtlar ver. Her yanıt max 150 kelime.`;
};

// ── Tarif Adını Parse Et ──────────────────────────────────────
const parseRecipeHint = (text: string): { cleanText: string; recipeName: string | null } => {
  const match = text.match(/\[TARIF_ONER:\s*"([^"]+)"\]/);
  if (match) {
    return {
      cleanText: text.replace(/\[TARIF_ONER:\s*"[^"]+"\]/, '').trim(),
      recipeName: match[1],
    };
  }
  return { cleanText: text, recipeName: null };
};

// ── Mesaj Baloncuğu ───────────────────────────────────────────
function MessageBubble({ msg, onMakeRecipe, colors }: { msg: ChatMessage; onMakeRecipe?: (name: string) => void; colors: AppThemeColors }) {
  const isUser = msg.role === 'user';
  const styles = getStyles(colors);
  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAI]}>
      {!isUser && (
        <View style={styles.aiAvatar}>
          <Text style={styles.aiAvatarText}>👨‍🍳</Text>
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{msg.text}</Text>
        {msg.recipeHint && onMakeRecipe && (
          <TouchableOpacity style={styles.makeRecipeBtn} onPress={() => onMakeRecipe(msg.recipeHint!)}>
            <Ionicons name="restaurant-outline" size={16} color={colors.primary} />
            <Text style={styles.makeRecipeBtnText}>"{msg.recipeHint}" tarifini oluştur →</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Ana Ekran ─────────────────────────────────────────────────
export default function AssistantScreen() {
  const { colors } = useTheme();
  const { userProfile } = useAuth();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '0',
      role: 'assistant',
      text: 'Merhaba! Ben Şef, senin AI beslenme asistanınım 👨‍🍳\n\nBeslenme, tarif ve yemek hakkında her türlü soruyu sorabilirsin. Sana en iyi seçenekleri önereceğim!',
      recipeHint: null,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length > 1) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: trimmed,
      recipeHint: null,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const ai = getAiClient();
      let history = messages.map((m) => ({
        role: m.role === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: m.text }],
      }));

      while (history.length > 0 && history[0].role === 'model') {
        history.shift();
      }

      history = history.slice(-10);
      if (history.length > 0 && history[0].role === 'model') {
        history.shift();
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [
          ...history,
          { role: 'user', parts: [{ text: trimmed }] },
        ],
        config: {
          systemInstruction: getAssistantInstruction(userProfile?.language),
          temperature: 0.8,
        },
      });

      const rawText = response.text ?? 'Üzgünüm, bir hata oluştu.';
      const { cleanText, recipeName } = parseRecipeHint(rawText);

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: cleanText,
        recipeHint: recipeName,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      console.error('[Assistant] AI hatası:', err);
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: 'Bağlantı hatası oluştu. Lütfen tekrar deneyin.',
        recipeHint: null,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleMakeRecipe = (recipeName: string) => {
    router.push({
      pathname: '/recipe' as any,
      params: { recipeName },
    });
  };

  const handleClearChat = () => {
    Alert.alert(
      'Sohbeti Temizle',
      'Tüm mesaj geçmişini silmek istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Temizle', 
          style: 'destructive',
          onPress: () => {
            setMessages([{
              id: Date.now().toString(),
              role: 'assistant',
              text: 'Merhaba! Ben Şef, senin AI beslenme asistanınım 👨‍🍳\n\nBeslenme, tarif ve yemek hakkında her türlü soruyu sorabilirsin. Sana en iyi seçenekleri önereceğim!',
              recipeHint: null,
            }]);
          }
        }
      ]
    );
  };

  const QUICK_QUESTIONS = [
    '🥗 Sağlıklı öğle yemeği önerir misin?',
    '💪 Protein açısından zengin tarif?',
    '⚡ 15 dakikada yapılabilecek yemek?',
    '🌙 Hafif akşam yemeği öner',
  ];

  return (
    <ScreenBackground>
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>👨‍🍳 AI Beslenme Asistanı</Text>
            <Text style={styles.headerSub}>Yiyecek ve beslenme hakkında her şeyi sor</Text>
          </View>
          {messages.length > 1 && (
            <TouchableOpacity onPress={handleClearChat} style={styles.clearBtn}>
              <Ionicons name="trash-outline" size={22} color="white" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <MessageBubble msg={item} onMakeRecipe={handleMakeRecipe} colors={colors} />
        )}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={loading ? (
          <View style={styles.typingRow}>
            <View style={styles.aiAvatar}>
              <Text style={styles.aiAvatarText}>👨‍🍳</Text>
            </View>
            <View style={styles.typingBubble}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.typingText}>Şef düşünüyor...</Text>
            </View>
          </View>
        ) : null}
      />

      {/* Hızlı Sorular (sadece ilk mesajda görünür) */}
      {messages.length <= 1 && (
        <View style={styles.quickRow}>
          {QUICK_QUESTIONS.map((q) => (
            <TouchableOpacity
              key={q}
              style={styles.quickChip}
              onPress={() => { setInput(q); }}
            >
              <Text style={styles.quickChipText}>{q}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Girdi Alanı */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Bir şey sor... (ör: kalori düşük tarif öner)"
          placeholderTextColor={colors.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={300}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!input.trim() || loading}
        >
          <Ionicons name="send" size={20} color="white" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const getStyles = (colors: AppThemeColors) => StyleSheet.create({
  root: { flex: 1 },
  // ── Header ────────────────────────────────────────────────
  header: {
    paddingTop: 60, paddingBottom: 20, paddingHorizontal: Spacing.xl,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: Typography['2xl'], fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: Typography.sm, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  clearBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: Radius.full },
  // ── Mesajlar ──────────────────────────────────────────────
  messageList: { padding: Spacing.base, gap: 16, paddingBottom: 8 },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  bubbleRowUser: { flexDirection: 'row-reverse' },
  bubbleRowAI: {},
  aiAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FFF4E6', justifyContent: 'center', alignItems: 'center',
    ...Shadow.sm,
  },
  aiAvatarText: { fontSize: 18 },
  bubble: {
    maxWidth: '78%', borderRadius: Radius.lg,
    padding: 14, gap: 8, ...Shadow.sm,
  },
  bubbleUser: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleAI: { backgroundColor: colors.surface, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: Typography.base, color: colors.textPrimary, lineHeight: 22 },
  bubbleTextUser: { color: '#fff' },
  makeRecipeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border,
  },
  makeRecipeBtnText: { fontSize: Typography.sm, color: colors.primary, fontWeight: '600', flex: 1 },
  // ── Typing ───────────────────────────────────────────────
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: Spacing.base },
  typingBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, borderRadius: Radius.lg, padding: 14, ...Shadow.sm,
  },
  typingText: { fontSize: Typography.sm, color: colors.textMuted },
  // ── Hızlı Sorular ────────────────────────────────────────
  quickRow: { flexWrap: 'wrap', flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
  quickChip: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: Radius.full,
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
  },
  quickChipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  // ── Girdi ────────────────────────────────────────────────
  inputRow: {
    flexDirection: 'row', gap: 10, padding: 12, paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: Radius.lg,
    padding: 12, fontSize: Typography.base, color: colors.textPrimary,
    maxHeight: 100, backgroundColor: colors.background,
  },
  sendBtn: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center', ...Shadow.sm,
  },
  sendBtnDisabled: { opacity: 0.4 },
});
