import { onValue, ref } from "firebase/database";
import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../../src/services/firebase";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { set } from "firebase/database";
import { Platform, Linking } from "react-native";
import * as IntentLauncher from "expo-intent-launcher";

const openWifiSettings = async () => {
  if (Platform.OS === "android") {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.WIFI_SETTINGS
    );
  } else {
    Linking.openURL("App-Prefs:root=WIFI");
  }
};

export default function HomeScreen() {
  const [devices, setDevices] = useState<any[]>([]);
  const [username, setUsername] = useState("");
  const [now, setNow] = useState(Date.now());
const isCampaignActive = (timestamp?: string) => {
    if (!timestamp) return false;

    const last = new Date(timestamp).getTime();
    if (isNaN(last)) return false;

    const diff = (Date.now() - last) / 1000;

    return diff < 180;
  };
   const anyActive = devices.some(d =>
  isCampaignActive(d.current?.timestamp)
);

  useEffect(() => {
  const interval = setInterval(() => {
    setNow(Date.now()); // 🔥 solo refresca tiempo
  }, 5000);

  return () => clearInterval(interval);
}, []);
  const router = useRouter();


  useEffect(() => {

  const unsubscribeAuth = auth.onAuthStateChanged((user) => {
    console.log("🔥 AUTH STATE:", user?.uid, user?.email);

    if (!user) {
  console.log("❌ NO USER LOGGED IN");

  setUsername("");
  setDevices([]);

  router.replace("/login");

  return;
}
 console.log("✅ USER LOGGED IN:", user.uid);

    // 🔥 USERNAME
    const userRef = ref(db, `users/${user.uid}/name`);

    const unsubscribeUser = onValue(userRef, (snapshot) => {
      if (snapshot.exists()) {
        setUsername(snapshot.val());
      } else {
        setUsername("No name"); // fallback
      }
    });

    // 🔥 DEVICES
const userDevicesRef = ref(db, `users/${user.uid}/devices`);

const unsubscribeDevices = onValue(userDevicesRef, (snapshot) => {

  if (!snapshot.exists()) {
    setDevices([]);
    return;
  }

  const deviceIds = Object.keys(snapshot.val());

  const deviceListeners: (() => void)[] = [];

  deviceIds.forEach((deviceId) => {

    // 🔥 STATUS LISTENER
    const statusRef = ref(db, `devices/${deviceId}/status`);

    let deviceStatus: any = null;

    const unsubscribeStatus = onValue(statusRef, (statusSnap) => {
      if (statusSnap.exists()) {
        deviceStatus = statusSnap.val();
      }
    });

    // 🔥 CAMPAIGNS LISTENER
    const campaignsRef = ref(db, `devices/${deviceId}/campaigns`);

    const unsubscribeDevice = onValue(campaignsRef, (snap) => {

      if (!snap.exists()) return;

      const campaigns = snap.val();

      const list = Object.keys(campaigns).map((campaignId) => ({
  id: campaignId,
  deviceId: deviceId,
  status: deviceStatus || {},

  current: campaigns[campaignId]?.current || null,
  meta: campaigns[campaignId]?.meta || null,
}));

      setDevices(prev => {
  const others = prev.filter(d => d.deviceId !== deviceId);
  return [...others, ...list];
});
    });

    // 🔥 IMPORTANTE: añadir ambos
    deviceListeners.push(unsubscribeStatus);
    deviceListeners.push(unsubscribeDevice);
  });

  // 🔥 CLEANUP
  return () => {
    deviceListeners.forEach(unsub => unsub());
  };

});

    // 🔥 LIMPIEZA CORRECTA
    return () => {
      unsubscribeUser();
      unsubscribeDevices();
    };

  });

  return () => unsubscribeAuth();

}, []);

const getLocation = async () => {
  const { status } = await Location.requestForegroundPermissionsAsync();

  if (status !== "granted") {
    console.log("GPS denied");
    return null;
  }

  const loc = await Location.getCurrentPositionAsync({
  accuracy: Location.Accuracy.High,
});

  return {
  lat: loc.coords.latitude,
  lng: loc.coords.longitude,
  accuracy: loc.coords.accuracy,
};
};
  return (
    
    <View style={[styles.container, { paddingBottom: 120 }]}>
      {/* HEADER */}
      <View style={styles.headerBlock}>
        <View style={styles.headerRow}>
          <Image
            source={
  anyActive
    ? require("../../assets/images/logo_2.png")
    : require("../../assets/images/logo_1.png")
}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.user}>{username || "Loading..."}</Text>
      </View>

      {/* DEVICES SECTION */}
      <Text style={styles.sectionTitle}>Your Locations</Text>

      {devices?.map((device) => (
    <TouchableOpacity
      key={device.id}
      style={styles.deviceCard}
      onPress={() =>
    router.push({
      pathname: "/device/[id]" as any,
      params: {
       id: device.deviceId,
       campaign: device.id
      },
    })
  }
>
   <View style={styles.deviceHeader}>
  <Text style={styles.deviceName}>
    {device.meta?.name}
  </Text>

  <View
    style={
      isCampaignActive(device.current?.timestamp)
        ? styles.greenDot
        : styles.redDot
    }
  />
</View>

<Text style={styles.deviceMeta}>
  {isCampaignActive(device.current?.timestamp)
    ? "Measuring now"
    : "Inactive"}
</Text>

  </TouchableOpacity>
))}


      <View
  style={{
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
  }}
>
   {/* ADD DEVICE */}
  <TouchableOpacity
    style={styles.addButton}
    onPress={() => router.push("/add-device")}
  >
    <Text style={styles.addButtonText}>Add Device</Text>
  </TouchableOpacity>
   
    {/* Change WiFi */}
 <TouchableOpacity
  style={[styles.addButton, { marginTop: 8, backgroundColor: "#17A84B" }]}
  onPress={async () => {
    await set(
      ref(db, "devices/ESP32_001/commands/reset_wifi"),
      true
    );

    await openWifiSettings();
  }}
>
  <Text style={styles.addButtonText}>Change Device WiFi</Text>
</TouchableOpacity>

  {/* SAVE GPS */}
<TouchableOpacity
  style={[styles.addButton, { marginTop: 8 }]}
  onPress={async () => {
    Alert.alert(
    "TEST GPS",
    "El botón Save GPS Point funciona"
  );

  console.log("🔥 SAVE GPS CLICK");
  try {

    const outdoorDevice = devices.find(
      (d) =>
        d.deviceId === "ESP32_001" &&
        d.id === "outdoor"
    );

    console.log("🌍 outdoorDevice:", outdoorDevice);

    if (!outdoorDevice) {
      Alert.alert(
        "Error",
        "No se encontró la campaña outdoor."
      );
      return;
    }

    if (!outdoorDevice.current) {
      Alert.alert(
        "Error",
        "No hay datos actuales del sensor outdoor."
      );
      return;
    }

    const current = outdoorDevice.current;

    console.log("📊 CURRENT:", current);

    const location = await getLocation();

    if (!location) {
      Alert.alert(
        "Error",
        "No se pudo obtener la ubicación GPS."
      );
      return;
    }

    console.log("📍 LOCATION:", location);

    const date = new Date()
      .toISOString()
      .split("T")[0];

    const timestamp = Date.now();

    const path =
      `devices/ESP32_001/campaigns/outdoor/` +
      `history/heatmap/${date}/${timestamp}`;

    console.log("🔥 FIREBASE PATH:", path);

    await set(
      ref(db, path),
      {
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy ?? null,

        pm25: current.pm25 ?? null,
        pm10: current.pm10 ?? null,
        noxIndex: current.noxIndex ?? null,
        srawNox: current.srawNox ?? null,

        sensorTimestamp:
          current.timestamp ?? null,

        timestamp:
          new Date().toISOString(),
      }
    );

    console.log(
      "✅ GPS POINT GUARDADO"
    );

    Alert.alert(
      "Guardado",
      "GPS Point guardado correctamente."
    );

  } catch (error) {
    console.log(
      "❌ ERROR GUARDANDO GPS:",
      error
    );

    Alert.alert(
      "Error",
      "No se pudo guardar el GPS Point."
    );
  }
}}
>
  <Text style={styles.addButtonText}>
    Save GPS Point
  </Text>
</TouchableOpacity>
</View>
    </View>
    
    
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#071B2E",
    paddingHorizontal: 20,
    paddingTop: 70,
  },

  headerBlock: {
    marginBottom: 35,
  },

  headerRow: {
    flexDirection: "column-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 50,
  },

  logo: {
    width: 190,
    height: 70,
    marginBottom: 20,
  },

  title: {
    fontSize: 28,
    color: "white",
    fontWeight: "600",
  },

  user: {
    color: "#A0AEC0",
    fontSize: 18,
    marginTop: 4,
    marginBottom: 30,
  },

  sectionTitle: {
    color: "#8FA3B0",
    marginBottom: 10,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  cloudContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 50,
  },

  cloudText: {
    color: "#A0AEC0",
    marginLeft: 6,
    fontSize: 12,
  },

  deviceCard: {
    backgroundColor: "#0E2A45",
    padding: 10,
    borderRadius: 14,
    marginBottom: 5,
  },

  deviceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  deviceName: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },

  deviceLocation: {
    color: "#A0AEC0",
    marginTop: 6,
  },

  deviceMeta: {
    color: "#6B8BA4",
    marginTop: 5,
    fontSize: 12,
  },

  addButton: {
    marginTop: 30,
    backgroundColor: "#17A84B",
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
  },

  addButtonText: {
    color: "white",
    fontWeight: "600",
  },

  greenDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#1DB954",
  },

  redDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#E53935",
  },
});
