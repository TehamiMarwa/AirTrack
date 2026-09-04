import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert
} from "react-native";

import { useState, useEffect } from "react";
import { LineChart } from "react-native-chart-kit";
import { ref, get } from "firebase/database";
import { db } from "../../src/services/firebase";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as DocumentPicker from "expo-document-picker";

import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useLocalSearchParams } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";

const screenWidth = Dimensions.get("window").width;


type SensorLocation = {
  name: string;
  pm25: number;
  lat: number;
  lng: number;
};
type RoutePoint = {
  latitude: number;
  longitude: number;
  pm25: number;
};
type AppChartData = {
  labels: string[];
  datasets: {
    data: number[];
    color?: (opacity?: number) => string;
  }[];
};

export default function HistoryScreen() {
  useEffect(() => {
  ScreenOrientation.unlockAsync(); // 🔥 permite rotar

  return () => {
    ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.PORTRAIT
    ); // 🔥 vuelve a vertical al salir
  };
}, []);
const [isLandscape, setIsLandscape] = useState(false);
useEffect(() => {
  const sub = ScreenOrientation.addOrientationChangeListener((event) => {
    const orientation = event.orientationInfo.orientation;

    if (
      orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
      orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT
    ) {
      setIsLandscape(true);
    } else {
      setIsLandscape(false);
    }
  });

  return () => {
    ScreenOrientation.removeOrientationChangeListener(sub);
  };
}, []);
  const { id, campaign } = useLocalSearchParams();
  const [deviceId, setDeviceId] = useState(id || "ESP32_001");
  const [selectedCampaign, setSelectedCampaign] = useState(campaign || "garage_severo_ochoa");
// 🔥 Nuevo estado para almacenar los dispositivos de Firebase
const [devicesList, setDevicesList] = useState<{ id: string; name: string }[]>([]);

  const [locations, setLocations] = useState<SensorLocation[]>([]);
  const [locationType, setLocationType] = useState("home");

  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);

  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());

  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const [showFromTime, setShowFromTime] = useState(false);
  const [showToTime, setShowToTime] = useState(false);

  // 🔥 1. DIVIDIMOS EL ESTADO EN DOS GRÁFICOS
  const [pmChartData, setPmChartData] = useState<AppChartData>({
    labels: ["..."],
    datasets: [{ data: [0] }]
  });

  const [noxChartData, setNoxChartData] = useState<AppChartData>({
    labels: ["..."],
    datasets: [{ data: [0] }]
  });

  /* ---------------- DOWNLOAD REAL ---------------- */

  const downloadCSV = async () => {
    let csv = "DateTime,PM2.5,PM10,NOxIndex,srawNox\n";
    const start = new Date(fromDate.getTime());
    const end = new Date(toDate.getTime());

    while (start <= end) {
      const datePath = start.toLocaleDateString("en-CA");
      const snap = await get(
        ref(db, `devices/${deviceId}/campaigns/${selectedCampaign}/history/raw/${datePath}`)
      );

      if (snap.exists()) {
        const data = snap.val();
        const keys = Object.keys(data).sort((a, b) => Number(a) - Number(b));

        keys.forEach((key) => {
          const point = data[key];
          const date = new Date(Number(key) * 1000);

          if (date < fromDate || date > toDate) return;

          const label = date.toLocaleString();
          csv += `${label},${point.pm25 ?? 0},${point.pm10 ?? 0},${point.noxIndex ?? 0},${point.srawNox ?? 0}\n`;
        });
      }
      start.setDate(start.getDate() + 1);
    }

    const fileUri = FileSystem.documentDirectory + "report.csv";

    await FileSystem.writeAsStringAsync(fileUri, csv);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri);
    }

    Alert.alert("Saved 📁", fileUri);


    Alert.alert("Downloaded 📥", `File saved in:\n${fileUri}`);
  };

  const downloadPDF = async () => {
    let rows = "";
    const start = new Date(fromDate.getTime());
    const end = new Date(toDate.getTime());

    while (start <= end) {
      const datePath = start.toLocaleDateString("en-CA");
      const snap = await get(
        ref(db, `devices/${deviceId}/campaigns/${selectedCampaign}/history/raw/${datePath}`)
      );

      if (snap.exists()) {
        const data = snap.val();
        const keys = Object.keys(data).sort((a, b) => Number(a) - Number(b));

        keys.forEach((key) => {
          const point = data[key];
          const date = new Date(Number(key) * 1000);

          if (date < fromDate || date > toDate) return;

          rows += `
            <tr>
              <td>${date.toLocaleString()}</td>
              <td>${point.pm25 || 0}</td>
              <td>${point.pm10 || 0}</td>
              <td>${point.noxIndex || 0}</td>
              <td>${point.srawNox ?? 0}</td>
            </tr>
          `;
        });
      }
      start.setDate(start.getDate() + 1);
    }

    const html = `
  <html>
    <body>
      <h2>Air Quality Report</h2>
      <p>${selectedCampaign}</p>

      <table border="1" style="border-collapse: collapse; width: 100%;">
        <tr>
          <th>DateTime</th>
          <th>PM2.5 (µg/m³)</th>
          <th>PM10 (µg/m³)</th>
          <th>NOx Index</th>
          <th>srawNox</th>
        </tr>

        ${rows}

      </table>
    </body>
  </html>
`;

    const { uri } = await Print.printToFileAsync({ html });
    Alert.alert("PDF Ready 📄", uri);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri);
    }


  };

  /* ---------------- MAP DATA ---------------- */

  useEffect(() => {
    loadDevices();
  }, []);

  // 🔥 Nueva función para leer los dispositivos dinámicamente
const loadDevices = async () => {
  try {
    const snapshot = await get(ref(db, `devices/${deviceId}/campaigns`));

if (!snapshot.exists()) return;

const data = snapshot.val();

const list = Object.keys(data).map((campaignId) => ({
  id: campaignId,
  name: data[campaignId].meta?.name || campaignId
}));

setDevicesList(list);

    // Opcional: Si quieres que por defecto se seleccione el primer dispositivo de la lista real:
    //if (list.length > 0) {
    //  setSelectedCampaign(list[0].id);
   // }
  } catch (error) {
    console.error("Error al cargar los dispositivos:", error);
  }
};

  const loadRoute = async () => {
    const start = new Date(fromDate.getTime());
    const end = new Date(toDate.getTime());
    const points: RoutePoint[] = [];

    while (start <= end) {
      const datePath = start.toLocaleDateString("en-CA");
      const snap = await get(
        ref(db, `devices/${deviceId}/campaigns/${selectedCampaign}/history/gps/${datePath}`)
      );

      if (snap.exists()) {
        const data = snap.val();
        const keys = Object.keys(data).sort((a, b) => Number(a) - Number(b));

        keys.forEach((key) => {
          const p = data[key];

          if (!p.lat || !p.lng) return;

          const date = new Date(Number(key) * 1000);
          if (date < fromDate || date > toDate) return;

          points.push({
            latitude: p.lat,
            longitude: p.lng,
            pm25: p.pm25
          });
        });
      }
      start.setDate(start.getDate() + 1);
    }
    setRoutePoints(points);
  };

  

  /* ---------------- GRAPH ---------------- */

  useEffect(() => {
    generateGraph();
  }, [deviceId, selectedCampaign, fromDate, toDate]);

  const generateGraph = async () => {
    const start = new Date(fromDate.getTime());
    const end = new Date(toDate.getTime());

    const labels: string[] = [];
    const pm25Values: number[] = [];
    const pm10Values: number[] = [];
    const noxValues: number[] = [];

    const sameDay =
      start.toLocaleDateString("en-CA") === end.toLocaleDateString("en-CA");

    while (start <= end) {
      const datePath = start.toLocaleDateString("en-CA");
      const snap = await get(
        ref(db, `devices/${deviceId}/campaigns/${selectedCampaign}/history/raw/${datePath}`)
      );

      if (snap.exists()) {
        const data = snap.val();
        const keys = Object.keys(data).sort((a, b) => Number(a) - Number(b));

        if (sameDay) {
          keys.forEach((key) => {
            const point = data[key];
            const pointDateTime = new Date(Number(key) * 1000);

            if (pointDateTime < fromDate || pointDateTime > toDate) {
              return;
            }

            const label = pointDateTime.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false
            });

            labels.push(label);
            pm25Values.push(point.pm25 || 0);
            pm10Values.push(point.pm10 || 0);
            noxValues.push(point.noxIndex || 0);
          });
        } else {
          let sum25 = 0;
          let sum10 = 0;
          let sumNox = 0;
          let count = 0;

          keys.forEach((key) => {
            const point = data[key];
            sum25 += point.pm25 || 0;
            sum10 += point.pm10 || 0;
            sumNox += point.noxIndex || 0;
            count++;
          });

          if (count > 0) {
            const label = new Date(datePath).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "2-digit"
            });
            labels.push(label);
            pm25Values.push(sum25 / count);
            pm10Values.push(sum10 / count);
            noxValues.push(sumNox / count);
          }
        }
      }
      start.setDate(start.getDate() + 1);
    }

    // 🔥 2. ACTUALIZAMOS AMBOS ESTADOS
    if (pm25Values.length === 0 || labels.length === 0) {
      const emptyData = { labels: ["No data"], datasets: [{ data: [0] }] };
      setPmChartData(emptyData);
      setNoxChartData(emptyData);
      Alert.alert("No data", "No measurements in selected interval");
      return;
    }

    const maxPoints = 6;
    const step = Math.max(1, Math.ceil(labels.length / maxPoints));

    const filteredLabels = labels.filter((_, i) => i % step === 0);

    // Gráfico de Partículas (PM)
    setPmChartData({
      labels: filteredLabels,
      datasets: [
        {
          data: pm25Values.filter((_, i) => i % step === 0),
          color: () => "#00E5FF", // PM2.5 Cyan
        },
        {
          data: pm10Values.filter((_, i) => i % step === 0),
          color: () => "#FFC857", // PM10 Amarillo
        }
      ]
    });

    // Gráfico de Óxidos de Nitrógeno (NOx)
    setNoxChartData({
      labels: filteredLabels,
      datasets: [
        {
          data: noxValues.filter((_, i) => i % step === 0),
          color: () => "#FF4C4C", // NOx Rojo
        }
      ]
    });
  };

  /* ---------------- COLORS ---------------- */

  function getAirColor(pm25: number) {
    if (pm25 <= 12) return "#4CAF50";
    if (pm25 <= 35) return "#FFC857";
    return "#FF4C4C";
  }

  /* ---------------- CONFIG ---------------- */

  const chartConfig = {
    backgroundColor: "#071B2E",
    backgroundGradientFrom: "#071B2E",
    backgroundGradientTo: "#071B2E",
    decimalPlaces: 1,
    color: () => "#00E5FF",
    labelColor: () => "#8FA3B0",
    propsForDots: {
      r: "3",
      strokeWidth: 1,
      stroke: "#00E5FF"
    },
    propsForBackgroundLines: {
      strokeDasharray: "4"
    },
    formatYLabel: (y: string) => {
      const v = Number(y);
      return v.toFixed(1);
    }
  };

  /* ---------------- UI ---------------- */

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Customize your search</Text>

      {/* DEVICE */}
      <View style={styles.deviceBox}>
        <Text style={styles.intervalTitle}>Select location</Text>

        {/* Si la lista aún está vacía, mostramos un texto de carga */}
        {devicesList.length === 0 && (
          <Text style={{ color: "#8FA3B0", marginLeft: 5, marginBottom: 10 }}>Loading devices...</Text>
        )}

        {/* Mapeamos la lista dinámica de Firebase */}
        {devicesList.map((device) => (
          <TouchableOpacity
            key={device.id}
            style={selectedCampaign === device.id ? styles.metricActive : styles.metricBtn}
            onPress={() => setSelectedCampaign(device.id)}
          >
            <Text style={styles.metricText}>
             {device.name || device.id}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* DATE (Esta parte se queda exactamente igual) */}
      <View style={styles.intervalBox}>
        <Text style={styles.intervalTitle}>Date interval</Text>

        {/* FROM */}
        <View style={styles.row}>
          <Text style={styles.label}>From</Text>
          <TouchableOpacity
            style={styles.dateBtn}
            onPress={() => setShowFromPicker(true)}
          >
            <Text style={styles.dateText}>{fromDate.toLocaleDateString()}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dateBtn}
            onPress={() => setShowFromTime(true)}
          >
            <Text style={styles.dateText}>
              {fromDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </TouchableOpacity>
        </View>

        {/* TO */}
        <View style={styles.row}>
          <Text style={styles.label}>To</Text>
          <TouchableOpacity
            style={styles.dateBtn}
            onPress={() => setShowToPicker(true)}
          >
            <Text style={styles.dateText}>{toDate.toLocaleDateString()}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dateBtn}
            onPress={() => setShowToTime(true)}
          >
            <Text style={styles.dateText}>
              {toDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* PICKERS */}
      {showFromTime && (
        <DateTimePicker
          value={fromDate}
          mode="time"
          is24Hour={true}
          onChange={(event, selectedTime) => {
            setShowFromTime(false);
            if (selectedTime) {
              const newDate = new Date(fromDate);
              newDate.setHours(selectedTime.getHours());
              newDate.setMinutes(selectedTime.getMinutes());
              setFromDate(newDate);
            }
          }}
        />
      )}
      {showToTime && (
        <DateTimePicker
          value={toDate}
          mode="time"
          is24Hour={true}
          onChange={(event, selectedTime) => {
            setShowToTime(false);
            if (selectedTime) {
              const newDate = new Date(toDate);
              newDate.setHours(selectedTime.getHours());
              newDate.setMinutes(selectedTime.getMinutes());
              setToDate(newDate);
            }
          }}
        />
      )}
      {showFromPicker && (
        <DateTimePicker
          value={fromDate}
          mode="date"
          onChange={(event, selectedDate) => {
            setShowFromPicker(false);
            if (selectedDate) {
              const newDate = new Date(fromDate);
              newDate.setFullYear(selectedDate.getFullYear());
              newDate.setMonth(selectedDate.getMonth());
              newDate.setDate(selectedDate.getDate());
              setFromDate(newDate);
            }
          }}
        />
      )}
      {showToPicker && (
        <DateTimePicker
          value={toDate}
          mode="date"
          onChange={(event, selectedDate) => {
            setShowToPicker(false);
            if (selectedDate) {
              const newDate = new Date(toDate);
              newDate.setFullYear(selectedDate.getFullYear());
              newDate.setMonth(selectedDate.getMonth());
              newDate.setDate(selectedDate.getDate());
              setToDate(newDate);
            }
          }}
        />
      )}

      {/* 🔥 3. RENDERIZAMOS DOS GRÁFICOS */}
      
      {/* --- GRÁFICO PMs --- */}
      <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 10, marginBottom: 5 }}>
       <Text style={{ color: "#00E5FF", marginRight: 15 }}>PM2.5 (µg/m³)</Text>
       <Text style={{ color: "#FFC857" }}>PM10 (µg/m³)</Text>
      </View>

      <LineChart
        data={pmChartData}
        width={screenWidth - 40}
        height={220}
        fromZero={true}
        segments={4}
        withDots={true}
        withShadow={false}
        //yAxisSuffix=" µg/m³"
        chartConfig={chartConfig}
        bezier
        style={styles.chart}
      />
      <Text style={styles.xAxisLabel}>Time (Particulates)</Text>

      {/* --- GRÁFICO NOx --- */}
      <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 15, marginBottom: 5 }}>
        <Text style={{ color: "#FF4C4C" }}>NOx Index</Text>
      </View>

      <LineChart
        data={noxChartData}
        width={screenWidth - 40}
        height={220}
        fromZero={true}
        segments={4}
        withDots={true}
        withShadow={false}
        yAxisSuffix="" // Normalmente el NOx lo lees como índice o PPM, así que quito el µg/m³
        chartConfig={{
          ...chartConfig,
          color: () => "#FF4C4C", // Ajustamos el color base para que coincida
        }}
        bezier
        style={styles.chart}
      />
      <Text style={styles.xAxisLabel}>Time (NOx Index)</Text>


      <View style={styles.exportBox}>
        <Text style={styles.exportTitle}>Export session</Text>
        <Text style={styles.exportSubtitle}>
          {selectedCampaign} – {fromDate.toLocaleDateString()}
        </Text>
        <TouchableOpacity onPress={downloadCSV}>
          <Text style={styles.exportBtn}>[ Download CSV 📥 ]</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={downloadPDF}>
          <Text style={styles.exportBtn}>[ Download PDF 📄 ]</Text>
        </TouchableOpacity>
        
      </View>
      
    </ScrollView>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#071B2E", padding: 20 },
  title: { color: "#c6e7f3", fontSize: 30, textAlign: "center", marginTop: 30, marginBottom: 20 },
  deviceBox: { borderWidth: 1, borderColor: "#444", padding: 15, marginBottom: 20 },
  intervalBox: { borderWidth: 1, borderColor: "#444", padding: 15, marginBottom: 20 },
  intervalTitle: { color: "white", marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  label: { color: "white", marginRight: 10 },
  dateBtn: { backgroundColor: "#1B3448", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginLeft: 10 },
  dateText: { color: "white" },
  generateBtn: { backgroundColor: "#17A84B", padding: 12, alignItems: "center", borderRadius: 8, marginBottom: 20 },
  generateText: { color: "white", fontWeight: "bold" },
  metricSelector: { flexDirection: "row", justifyContent: "center", marginBottom: 20 },
  metricBtn: { backgroundColor: "#555", padding: 10, margin: 5, borderRadius: 6 },
  metricActive: { backgroundColor: "#17A84B", padding: 10, margin: 5, borderRadius: 6 },
  metricText: { color: "white" },
  chart: { borderRadius: 16 },
  exportBox: { borderWidth: 1, borderColor: "#555", padding: 15, marginBottom: 40, marginTop: 10 },
  exportTitle: { color: "white", fontSize: 16, marginBottom: 10 },
  exportSubtitle: { color: "#8FA3B0", marginBottom: 15 },
  exportBtn: { color: "#3DDCFF", marginBottom: 10 },
  xAxisLabel: { color: "#8FA3B0", textAlign: "center", marginTop: 5, marginBottom: 20 },
  mapBox: { borderWidth: 1, borderColor: "#444", padding: 15, marginBottom: 40, borderRadius: 12 },
  mapTitle: { color: "white", fontSize: 18, marginBottom: 10 },
  mapRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  mapText: { color: "white" },
  dot: { width: 14, height: 14, borderRadius: 7 }
});