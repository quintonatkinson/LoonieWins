import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import { useAuth } from '../contexts/AuthContext'

type Mode = 'login' | 'signup'

export default function AuthScreen() {
  const { signIn, signUp, needsEmailConfirm, pendingEmail, clearEmailConfirm } = useAuth()
  const [mode, setMode] = useState<Mode>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async () => {
    setError(null)
    if (!email.trim() || password.length < 6) {
      setError('Enter a valid email and a password of at least 6 characters.')
      return
    }
    setBusy(true)
    try {
      const result =
        mode === 'signup'
          ? await signUp(email, password, displayName || undefined)
          : await signIn(email, password)
      if (result.error) setError(result.error)
    } finally {
      setBusy(false)
    }
  }

  if (needsEmailConfirm) {
    return (
      <View style={{ flex: 1, backgroundColor: '#111827', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#39FF14', fontSize: 28, fontWeight: '800', textAlign: 'center' }}>
          Check your email
        </Text>
        <Text style={{ color: '#d1d5db', marginTop: 12, textAlign: 'center', lineHeight: 20 }}>
          We sent a confirmation link to {pendingEmail}. Open it, then come back and log in.
        </Text>
        <TouchableOpacity
          onPress={() => {
            clearEmailConfirm()
            setMode('login')
          }}
          style={{
            marginTop: 24,
            backgroundColor: '#39FF14',
            borderRadius: 12,
            paddingVertical: 14,
          }}
        >
          <Text style={{ color: '#111827', fontWeight: '700', textAlign: 'center' }}>Go to Log in</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#111827' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          padding: 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ color: '#39FF14', fontSize: 32, fontWeight: '800', textAlign: 'center' }}>
          LoonieWins
        </Text>
        <Text style={{ color: '#9ca3af', textAlign: 'center', marginTop: 4, marginBottom: 24 }}>
          Win More, Work Less
        </Text>

        <View
          style={{
            flexDirection: 'row',
            backgroundColor: '#1f2937',
            borderRadius: 12,
            padding: 4,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: '#4b5563',
          }}
        >
          {(['signup', 'login'] as Mode[]).map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => {
                setMode(m)
                setError(null)
              }}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 8,
                backgroundColor: mode === m ? '#39FF14' : 'transparent',
              }}
            >
              <Text
                style={{
                  textAlign: 'center',
                  fontWeight: '600',
                  color: mode === m ? '#111827' : '#9ca3af',
                }}
              >
                {m === 'signup' ? 'Create account' : 'Log in'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {mode === 'signup' && (
          <TextInput
            placeholder="Display name (optional)"
            placeholderTextColor="#6b7280"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            style={inputStyle}
          />
        )}
        <TextInput
          placeholder="Email"
          placeholderTextColor="#6b7280"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          style={inputStyle}
        />
        <TextInput
          placeholder="Password (min 6)"
          placeholderTextColor="#6b7280"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          style={inputStyle}
        />

        {error ? (
          <Text style={{ color: '#f87171', marginBottom: 12 }}>{error}</Text>
        ) : null}

        <TouchableOpacity
          onPress={() => void onSubmit()}
          disabled={busy}
          style={{
            backgroundColor: '#39FF14',
            borderRadius: 12,
            paddingVertical: 14,
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? (
            <ActivityIndicator color="#111827" />
          ) : (
            <Text style={{ color: '#111827', fontWeight: '700', textAlign: 'center' }}>
              {mode === 'signup' ? 'Create account' : 'Log in'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const inputStyle = {
  backgroundColor: '#1f2937',
  borderWidth: 1,
  borderColor: '#4b5563',
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 12,
  color: '#fff',
  marginBottom: 12,
} as const
