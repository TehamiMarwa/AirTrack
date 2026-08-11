import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "../../src/services/firebase";

export default function DeviceScreen() {
  const { id, campaign } = useLocalSearchParams();
  const [data, setData] = useState<any>(null);
  const [meta, setMeta] = useState<any>(null);
  const isCampaignActive = (timestamp?: string) => {
  if (!timestamp) return false;

  const last = new Date(timestamp).getTime();
  if (isNaN(last)) return false;

  const diff = (Date.now() - last) / 1000;

  return diff < 180;
};
  if (!id || !campaign) {
  return (
    <View style={styles.container}>
      <Text style={{ color: "white" }}>Loading...</Text>
    </View>
  );
}

 useEffect(() => {

  const currentRef = ref(db, `devices/${id}/campaigns/${campaign}/current`);

  const unsub1 = onValue(currentRef, (snapshot) => {
    if (snapshot.exists()) setData(snapshot.val());
  });

  const metaRef = ref(db, `devices/${id}/campaigns/${campaign}/meta`);

  const unsubMeta = onValue(metaRef, (snap) => {
    if (snap.exists()) setMeta(snap.val());
  });

  return () => {
    unsub1();
    unsubMeta();
  };

}, [id, campaign]);

  if (!data) {
    return (
      <View style={styles.container}>
        <Text style={{ color: "white" }}>Loading...</Text>
      </View>
    );
  }

  const getStatus = (value: number, type: "pm" | "nox") => {
    if (type === "pm") {
      if (value < 12) return { label: "Good", color: "#1DB954" };
      if (value < 35) return { label: "Moderate", color: "#FFC107" };
      return { label: "Bad", color: "#E53935" };
    } else {
      if (value < 50) return { label: "Good", color: "#1DB954" };
      if (value < 150) return { label: "Moderate", color: "#FFC107" };
      return { label: "Critical", color: "#E53935" };
    }
  };

  const pm25Status = getStatus(data.pm25, "pm");
  const pm10Status = getStatus(data.pm10, "pm");
  const noxStatus = getStatus(data.noxIndex, "nox");

  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.deviceName}>
          {meta?.name || campaign}
        </Text>
        <View style={styles.onlineRow}>
          <View
  style={[
    styles.onlineDot,
    {
      backgroundColor: isCampaignActive(data?.timestamp)
        ? "#1DB954"
        : "#E53935",
    },
  ]}
/>

<Text style={styles.onlineText}>
  {isCampaignActive(data?.timestamp) ? "Measuring" : "Inactive"}
</Text>
        </View>
      </View>
      {!isCampaignActive(data?.timestamp) && (
  <Text style={{
    color: "#E53935",
    marginTop: 10,
    textAlign: "center"
  }}>
    Showing last data
  </Text>
)}

      {/* METRIC CARDS */}
      <View style={styles.card}>
        <Text style={styles.metricTitle}>PM2.5</Text>
        <Text style={styles.metricValue}>{data.pm25}</Text>
        <Text style={styles.unit}>µg/m³</Text>
        <Text style={[styles.status, { color: pm25Status.color }]}>
          {pm25Status.label}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.metricTitle}>PM10</Text>
        <Text style={styles.metricValue}>{data.pm10}</Text>
        <Text style={styles.unit}>µg/m³</Text>
        <Text style={[styles.status, { color: pm10Status.color }]}>
          {pm10Status.label}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.metricTitle}>NOx Index</Text>
        <Text style={styles.metricValue}>{data.noxIndex}</Text>
        <Text style={styles.unit}>Index</Text>
        <Text style={[styles.status, { color: noxStatus.color }]}>
          {noxStatus.label}
        </Text>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#071B2E",
    padding: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
    marginTop: 30,
  },
  deviceName: {
    color: "white",
    fontSize: 22,
    fontWeight: "600",
  },
  onlineRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#1DB954",
    marginRight: 6,
  },
  onlineText: {
    color: "#A0AEC0",
  },
  card: {
    backgroundColor: "#0E2A45",
    borderRadius: 16,
    padding: 20,
    marginBottom: 18,
    alignItems: "center",
  },
  metricTitle: {
    color: "#A0AEC0",
    fontSize: 16,
  },
  metricValue: {
    color: "white",
    fontSize: 40,
    fontWeight: "600",
    marginVertical: 6,
  },
  unit: {
    color: "#A0AEC0",
    fontSize: 14,
  },
  status: {
    marginTop: 8,
    fontWeight: "600",
  },
});
