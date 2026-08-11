import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image } from "react-native";
import { useState, useEffect } from "react";
import { useRouter } from "expo-router";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "firebase/auth";

import { ref, set } from "firebase/database";
import { auth, db } from "../src/services/firebase";
import { Alert } from "react-native";

export default function LoginScreen() {

  const [isRegister, setIsRegister] = useState(false);

  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
  if (!error) return;

  const timer = setTimeout(() => {
    setError("");
  }, 3000);

  return () => clearTimeout(timer);
}, [error]);

  const handleAuth = async () => {

  try {

    setError(""); // 🔥 limpiar error

    if (!email || !password) {
      setError("Fill all fields");
      return;
    }

    if (isRegister) {

      if (name.length < 3) {
        setError("Name too short");
        return;
      }

      const result = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      const uid = result.user.uid;

      await set(ref(db, `users/${uid}`), {
        name: name,
        email: email.trim(),
        devices: {}
      });

    } else {

      await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

    }

    router.replace("/(tabs)");

  } catch (error: any) {

    if (isRegister) {

      if (error.code === "auth/email-already-in-use") {
        setError("This email is already registered");
        return;
      }

      if (error.code === "auth/invalid-email") {
        setError("Invalid email format");
        return;
      }

      if (error.code === "auth/weak-password") {
        setError("Password must be at least 6 characters");
        return;
      }

    } else {

      if (error.code === "auth/invalid-credential") {
        setError("Incorrect email or password");
        return;
      }

      if (error.code === "auth/user-not-found") {
        setError("No account found");
        return;
      }

      if (error.code === "auth/wrong-password") {
        setError("Wrong password");
        return;
      }

    }

    setError("Something went wrong");

  }
};




  return (
    <View style={styles.container}>

      <Image
  source={require("../assets/images/logo.png")}
  style={styles.logo}
  resizeMode="contain"
/>
      {isRegister && (
  <TextInput
    style={styles.input}
    placeholder="Full Name"
    placeholderTextColor="#999"
    value={name}
    onChangeText={setName}
  />
)}

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#999"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#999"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error !== "" && (
  <View style={styles.errorBox}>
    <Text style={styles.errorText}>{error}</Text>
  </View>
)}

      <TouchableOpacity style={styles.button} onPress={handleAuth}>
        <Text style={styles.buttonText}>
  {isRegister ? "Register" : "Login"}
</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setIsRegister(!isRegister)}>
  <Text style={{ color: "#3DDCFF", marginTop: 15, textAlign: "center" }}>
    {isRegister
      ? "Already have an account? Login"
      : "Don't have an account? Register"}
  </Text>
</TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#071B2E",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  title: {
    color: "white",
    fontSize: 26,
    marginBottom: 30,
    textAlign: "center",
  },
  logo: {
  width: 180,
  height: 120,
  alignSelf: "center",
  marginBottom: 50,
},
  input: {
    backgroundColor: "#0E2A45",
    padding: 15,
    borderRadius: 10,
    color: "white",
    marginBottom: 15,
  },
  button: {
    backgroundColor: "#1DB954",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontWeight: "600",
  },
  errorBox: {
  backgroundColor: "#2A1B1B",
  borderLeftWidth: 4,
  borderLeftColor: "#FF4C4C",
  padding: 10,
  borderRadius: 8,
  marginBottom: 15,
},

errorText: {
  color: "#FF6B6B",
  fontSize: 14,
},
});
