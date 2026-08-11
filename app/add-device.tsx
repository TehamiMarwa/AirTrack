import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { auth, db } from "../src/services/firebase";
import { ref, get, set, update } from "firebase/database";

export default function AddDeviceScreen() {

  const router = useRouter();
  const [deviceId, setDeviceId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAddDevice = async () => {

  setError("");
  setSuccess("");

  if (!deviceId) {
    setError("Please enter a device ID.");
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    setError("User not authenticated.");
    return;
  }

  setLoading(true);

  try {

    const deviceRef = ref(db, `devices/${deviceId}`);
    const snapshot = await get(deviceRef);

    if (!snapshot.exists()) {
      setError("Device not found.");
      setLoading(false);
      return;
    }

    const deviceData = snapshot.val();

    // 🔥 CHECK OWNER
if (deviceData.owner) {

  if (deviceData.owner === user.uid) {
    setError("You already added this device.");
    setLoading(false);
    return;
  }

  if (deviceData.owner !== user.uid) {
    setError("This device is already registered to another user.");
    setLoading(false);
    return;
  }

}


    await update(deviceRef, {
      owner: user.uid
    });

    await set(ref(db, `users/${user.uid}/devices/${deviceId}`), true);

    setSuccess("Device added successfully!");
    setDeviceId("");

  } catch (err) {
    setError("Something went wrong.");
  }

  setLoading(false);
};



  return (
    <View style={styles.container}>

      <Text style={styles.title}>Add Device</Text>

      <TextInput
        style={styles.input}
        placeholder="Enter Device ID (e.g. ESP32_001)"
        placeholderTextColor="#999"
        value={deviceId}
        onChangeText={setDeviceId}
        
      />
      {error !== "" && (
  <Text style={styles.errorText}>{error}</Text>
)}

{success ? (
  <Text style={styles.successText}>{success}</Text>
) : null}


      <TouchableOpacity
  style={[styles.button, loading && { opacity: 0.6 }]}
  onPress={handleAddDevice}
  disabled={loading}
>
  <Text style={styles.buttonText}>
    {loading ? "Adding..." : "Add Device"}
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
    fontSize: 22,
    marginBottom: 20,
    textAlign: "center",
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
  errorText: {
  color: "#E53935",
  marginBottom: 10,
},

successText: {
  color: "#1DB954",
  marginBottom: 10,
},

});
