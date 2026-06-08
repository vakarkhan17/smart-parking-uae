import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Linking, Keyboard, ImageBackground } from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import MapView, { Marker, Callout } from "react-native-maps";
const bannerImage = require("./assets/banner.png");

// UPDATE ONLY THESE TWO VALUES
const GOOGLE_API_KEY = "AIzaSyAgRl_gBYRuz6d4cXlQwvi5uwDSSgPTpv4";
const API_BASE_URL = "http://192.168.0.115:5000";

const EMIRATES = ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain"];
const DUBAI_CODES = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","X","Y","Z","AA","BB","CC"];
const AD_CODES = ["AD", ...Array.from({ length: 50 }, (_, i) => String(i + 1))];
const AD_COLORS = [{ name: "Red", value: "#CE1126" }, { name: "Green", value: "#009739" }, { name: "Blue", value: "#005EB8" }, { name: "Grey", value: "#6C757D" }, { name: "Black", value: "#111111" }];

function show(msg) { Alert.alert("Smart UAE Parking", String(msg || "")); }
function emiratePrefix(e) { if (e === "Ras Al Khaimah") return "RAK"; if (e === "Umm Al Quwain") return "UAQ"; return e; }
function plateDisplay(v) { if (!v) return ""; if (v.emirate === "Dubai" || v.emirate === "Abu Dhabi") return `${v.code || ""} ${v.number}`.trim(); return `${emiratePrefix(v.emirate)} ${v.number}`; }
async function api(path, method = "GET", body = null, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : null });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

function SearchBox({ value, onChangeText, onSearch }) {
  return (
    <View style={s.searchBox}>
      <TextInput
        style={s.searchInput}
        placeholder="Search area, mall, place..."
        placeholderTextColor="#777"
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="words"
        blurOnSubmit={false}
        onSubmitEditing={onSearch}
      />
      <TouchableOpacity
  style={s.searchBtn}
  onPress={() => {
    Keyboard.dismiss();
    onSearch();
  }}
>
        <Text style={s.searchBtnText}>Search</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function App() { return <SafeAreaProvider><Main /></SafeAreaProvider>; }

function Main() {
  const insets = useSafeAreaInsets();
  const [token, setToken] = useState(null), [user, setUser] = useState(null), [authLoading, setAuthLoading] = useState(true), [authScreen, setAuthScreen] = useState("login"), [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState(""), [email, setEmail] = useState(""), [password, setPassword] = useState(""), [verifyCode, setVerifyCode] = useState(""), [resetCode, setResetCode] = useState(""), [newPassword, setNewPassword] = useState("");
  const [screen, setScreen] = useState("home"), [search, setSearch] = useState(""), [area, setArea] = useState("Dubai, UAE"), [region, setRegion] = useState({ latitude: 25.2048, longitude: 55.2708, latitudeDelta: 0.06, longitudeDelta: 0.06 });
  const [mapType, setMapType] = useState("standard"), [parkings, setParkings] = useState([]), [selectedParking, setSelectedParking] = useState(null), [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState([]), [emirate, setEmirate] = useState("Dubai"), [plateCode, setPlateCode] = useState("A"), [plateColor, setPlateColor] = useState(AD_COLORS[0]), [plateNumber, setPlateNumber] = useState(""), [editingVehicle, setEditingVehicle] = useState(null);
  const [duration, setDuration] = useState("1"), [bookings, setBookings] = useState([]);
  const [rtaZones, setRtaZones] = useState([]);
  const [zoneSearch, setZoneSearch] = useState("");
  const [rtaLoading, setRtaLoading] = useState(false);
  const codes = useMemo(() => emirate === "Dubai" ? DUBAI_CODES : emirate === "Abu Dhabi" ? AD_CODES : [], [emirate]);

  useEffect(() => { loadSession(); }, []);
  useEffect(() => { if (token) { initLocation(); loadVehicles(); loadBookings(); loadRtaZones(); } }, [token]);
  useEffect(() => { if (emirate === "Dubai" && !DUBAI_CODES.includes(plateCode)) setPlateCode("A"); if (emirate === "Abu Dhabi" && !AD_CODES.includes(plateCode)) setPlateCode("AD"); if (emirate !== "Dubai" && emirate !== "Abu Dhabi") setPlateCode(""); }, [emirate]);

  async function loadSession() { const tk = await AsyncStorage.getItem("sp_token"); const usr = await AsyncStorage.getItem("sp_user"); if (tk && usr) { setToken(tk); setUser(JSON.parse(usr)); } setAuthLoading(false); }
  async function saveSession(data) { await AsyncStorage.setItem("sp_token", data.token); await AsyncStorage.setItem("sp_user", JSON.stringify(data.user)); setToken(data.token); setUser(data.user); }
  async function register() { try { setBusy(true); const d = await api("/api/auth/register", "POST", { fullName, email, password }); show(d.message); setAuthScreen("verify"); } catch (e) { show(e.message); } finally { setBusy(false); } }
  async function verify() { try { setBusy(true); const d = await api("/api/auth/verify-email", "POST", { email, code: verifyCode }); await saveSession(d); } catch (e) { show(e.message); } finally { setBusy(false); } }
  async function login() { try { setBusy(true); const d = await api("/api/auth/login", "POST", { email, password }); await saveSession(d); } catch (e) { if (String(e.message).toLowerCase().includes("verify")) setAuthScreen("verify"); show(e.message); } finally { setBusy(false); } }
  async function forgot() { try { setBusy(true); const d = await api("/api/auth/forgot-password", "POST", { email }); show(d.message); setAuthScreen("reset"); } catch (e) { show(e.message); } finally { setBusy(false); } }
  async function resetPassword() { try { setBusy(true); const d = await api("/api/auth/reset-password", "POST", { email, code: resetCode, newPassword }); show(d.message); setAuthScreen("login"); } catch (e) { show(e.message); } finally { setBusy(false); } }
  async function logout() { await AsyncStorage.multiRemove(["sp_token", "sp_user"]); setToken(null); setUser(null); setScreen("home"); }

  async function initLocation() { try { setLoading(true); const { status } = await Location.requestForegroundPermissionsAsync(); if (status !== "granted") { show("Location permission denied. Showing Dubai default parking."); await fetchParking(region.latitude, region.longitude); return; } const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }); const r = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 }; setRegion(r); setArea("Current Location"); await reverseGeocode(r.latitude, r.longitude); await fetchParking(r.latitude, r.longitude); } catch (e) { await fetchParking(region.latitude, region.longitude); } finally { setLoading(false); } }
  async function reverseGeocode(lat, lng) { if (GOOGLE_API_KEY.includes("PASTE")) return; try { const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=en&region=ae&key=${GOOGLE_API_KEY}`; const data = await (await fetch(url)).json(); if (data.status !== "OK") { console.log("Geocode error:", data.status, data.error_message); return; } setArea(data.results?.[0]?.formatted_address || "Current Location"); } catch (e) { console.log("reverseGeocode failed", e); } }
  async function searchArea() { const q = search.trim(); if (!q) return; if (GOOGLE_API_KEY.includes("PASTE")) return show("Add Google API key in App.js first."); try { setLoading(true); const lower = q.toLowerCase(); const finalQuery = lower.includes("uae") || lower.includes("dubai") || lower.includes("sharjah") || lower.includes("abu dhabi") ? q : `${q}, UAE`; const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(finalQuery)}&language=en&region=ae&key=${GOOGLE_API_KEY}`; const data = await (await fetch(url)).json(); if (data.status !== "OK") { const details = data.error_message ? `${data.status}: ${data.error_message}` : data.status; return show(`Area not found or Google API issue: ${details}`); } const loc = data.results?.[0]?.geometry?.location; if (!loc) return show("Area not found"); const r = { latitude: loc.lat, longitude: loc.lng, latitudeDelta: 0.045, longitudeDelta: 0.045 }; setRegion(r); setArea(data.results?.[0]?.formatted_address || q); await fetchParking(loc.lat, loc.lng); setScreen("map"); } catch (e) { show(`Search failed: ${e.message}`); } finally { setLoading(false); } }
  async function fetchParking(lat, lng) { try { setLoading(true); if (GOOGLE_API_KEY.includes("PASTE")) { const demo = [{ id: "1", name: "Dubai Mall Parking", address: "Downtown Dubai", lat: 25.1972, lng: 55.2744, rating: "4.5" }, { id: "2", name: "Business Bay Parking", address: "Business Bay", lat: 25.1856, lng: 55.2636, rating: "4.2" }, { id: "3", name: "Nearby Public Parking", address: "Demo parking", lat: lat + 0.006, lng: lng + 0.006, rating: "4.0" }]; setParkings(demo); setSelectedParking(demo[0]); return; } const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=5000&type=parking&language=en&region=ae&key=${GOOGLE_API_KEY}`; const data = await (await fetch(url)).json(); if (data.status !== "OK" && data.status !== "ZERO_RESULTS") { const details = data.error_message ? `${data.status}: ${data.error_message}` : data.status; return show(`Parking search issue: ${details}`); } const list = (data.results || []).map((p, i) => ({ id: p.place_id || String(i), name: p.name || "Parking", address: p.vicinity || "Address not available", lat: p.geometry.location.lat, lng: p.geometry.location.lng, rating: p.rating || "N/A" })); setParkings(list); setSelectedParking(list[0] || null); } catch (e) { show(`Could not load parking locations: ${e.message}`); } finally { setLoading(false); } }
  function navigateToParking(p) { if (p) Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`); }

  function getZoneField(row, names) {
    if (!row) return "";
    const keys = Object.keys(row);
    for (const name of names) {
      const exact = keys.find(k => k.toLowerCase() === name.toLowerCase());
      if (exact) return row[exact];
    }
    const fuzzy = keys.find(k => names.some(n => k.toLowerCase().includes(n.toLowerCase())));
    return fuzzy ? row[fuzzy] : "";
  }

  function normalizeRtaRows(payload) {
    const raw =
      payload?.data?.results ||
      payload?.data?.data ||
      payload?.data?.records ||
      payload?.results ||
      payload?.data ||
      [];

    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === "object") {
      const firstArray = Object.values(raw).find(v => Array.isArray(v));
      return firstArray || [];
    }
    return [];
  }

  async function loadRtaZones() {
    try {
      setRtaLoading(true);
      const data = await api("/api/dda/parking-spaces?page=1&pageSize=300");
      setRtaZones(normalizeRtaRows(data));
    } catch (e) {
      show(e.message || "Unable to load RTA parking zones");
    } finally {
      setRtaLoading(false);
    }
  }

  async function loadVehicles() { try { const d = await api("/api/vehicles", "GET", null, token); setVehicles((d.vehicles || []).map((v) => ({ id: String(v.id), backendId: v.id, emirate: v.emirate, code: v.plate_code || "", colorName: v.plate_color || "", colorValue: AD_COLORS.find((c) => c.name === v.plate_color)?.value || "", number: v.plate_number, default: v.is_default }))); } catch {} }
  async function loadBookings() { try { const d = await api("/api/bookings", "GET", null, token); setBookings((d.bookings || []).map((b) => ({ id: String(b.id), parkingName: b.parking_name, vehicle: `${b.emirate || ""} ${b.plate_code || ""} ${b.plate_number || ""}`.trim(), duration: b.duration_hours, amount: b.amount_aed, time: b.created_at }))); } catch {} }
  async function saveVehicle() { const number = plateNumber.trim().replace(/[^0-9]/g, ""); if (!number) return show("Enter plate number"); const payload = { emirate, plateCode, plateColor: emirate === "Abu Dhabi" ? plateColor.name : "", plateNumber: number, isDefault: vehicles.length === 0 }; try { if (editingVehicle) await api(`/api/vehicles/${editingVehicle.backendId || editingVehicle.id}`, "PUT", payload, token); else await api("/api/vehicles", "POST", payload, token); setPlateNumber(""); setEditingVehicle(null); setEmirate("Dubai"); setPlateCode("A"); await loadVehicles(); } catch (e) { show(e.message); } }
  function editVehicle(v) { setEditingVehicle(v); setEmirate(v.emirate); setPlateCode(v.code); setPlateNumber(v.number); setPlateColor(AD_COLORS.find((c) => c.name === v.colorName) || AD_COLORS[0]); }
  async function deleteVehicle(v) { try { await api(`/api/vehicles/${v.backendId || v.id}`, "DELETE", null, token); await loadVehicles(); } catch (e) { show(e.message); } }
  async function setDefaultVehicle(v) { try { await api(`/api/vehicles/${v.backendId || v.id}`, "PUT", { emirate: v.emirate, plateCode: v.code, plateColor: v.colorName, plateNumber: v.number, isDefault: true }, token); await loadVehicles(); } catch (e) { show(e.message); } }
  async function bookParking() { if (!selectedParking) return show("Select a parking first"); const v = vehicles.find((x) => x.default) || vehicles[0]; try { await api("/api/bookings", "POST", { parkingName: selectedParking.name, parkingAddress: selectedParking.address, vehicleId: v?.backendId || v?.id || null, durationHours: Number(duration), amountAed: Number(duration) * 5 }, token); show("Parking booking saved"); await loadBookings(); setScreen("bookings"); } catch (e) { show(e.message); } }

  function Auth() { return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.authWrap} keyboardShouldPersistTaps="handled"><View style={s.logo}><Text style={s.logoIcon}>P</Text><Text style={s.title}>Smart UAE Parking</Text><Text style={s.sub}>Login to continue</Text></View><View style={s.card}><Text style={s.h1}>{authScreen === "login" ? "Login" : authScreen === "register" ? "Register" : authScreen === "forgot" ? "Forgot Password" : authScreen === "reset" ? "Reset Password" : "Verify Email"}</Text>{authScreen === "register" && <TextInput style={s.input} placeholder="Full Name" value={fullName} onChangeText={setFullName} />}<TextInput style={s.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />{(authScreen === "login" || authScreen === "register") && <TextInput style={s.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />}{authScreen === "verify" && <TextInput style={s.input} placeholder="Verification Code" value={verifyCode} onChangeText={setVerifyCode} keyboardType="number-pad" maxLength={6} />}{authScreen === "reset" && <><TextInput style={s.input} placeholder="Reset Code" value={resetCode} onChangeText={setResetCode} keyboardType="number-pad" maxLength={6} /><TextInput style={s.input} placeholder="New Password" value={newPassword} onChangeText={setNewPassword} secureTextEntry /></>}<TouchableOpacity style={s.primary} disabled={busy} onPress={authScreen === "login" ? login : authScreen === "register" ? register : authScreen === "forgot" ? forgot : authScreen === "reset" ? resetPassword : verify}><Text style={s.primaryText}>{busy ? "Please wait..." : authScreen === "login" ? "Login" : authScreen === "register" ? "Create Account" : authScreen === "forgot" ? "Send Reset Code" : authScreen === "reset" ? "Reset Password" : "Verify"}</Text></TouchableOpacity>{authScreen === "login" && <TouchableOpacity onPress={() => setAuthScreen("forgot")}><Text style={s.link}>Forgot Password?</Text></TouchableOpacity>}{authScreen !== "login" && <TouchableOpacity onPress={() => setAuthScreen("login")}><Text style={s.link}>Back to Login</Text></TouchableOpacity>}{authScreen === "login" && <TouchableOpacity onPress={() => setAuthScreen("register")}><Text style={s.link}>Create new account</Text></TouchableOpacity>}</View></ScrollView></SafeAreaView>; }
  function Header() { return <View style={s.header}><View><Text style={s.titleSmall}>Smart UAE Parking</Text><Text style={s.headerSub} numberOfLines={1}>{area}</Text></View><TouchableOpacity style={s.refresh} onPress={initLocation}><Text style={s.refreshText}>R</Text></TouchableOpacity></View>; }
  function ParkingCard({ p }) { return <TouchableOpacity style={s.parkingCard} onPress={() => { setSelectedParking(p); setScreen("map"); }}><View style={s.pIcon}><Text style={{ fontSize: 22, fontWeight: "900" }}>P</Text></View><View style={{ flex: 1 }}><Text style={s.pName}>{p.name}</Text><Text style={s.pAddr}>{p.address}</Text><Text style={s.noLive}>Live availability not available</Text><Text style={s.pAddr}>Rating: {p.rating}</Text></View><TouchableOpacity style={s.goBtn} onPress={() => navigateToParking(p)}><Text style={s.goText}>Go</Text></TouchableOpacity></TouchableOpacity>; }
  function Home() { return <><Header /><ImageBackground source={bannerImage} style={s.banner} imageStyle={s.bannerImage} resizeMode="cover"><View style={s.bannerOverlay}><Text style={s.bannerTitle}>Smart Parking</Text><Text style={s.bannerSub}>Smarter UAE</Text></View></ImageBackground><ScrollView contentContainerStyle={[s.page, { paddingBottom: 115 + insets.bottom }]} keyboardShouldPersistTaps="handled"><SearchBox value={search} onChangeText={setSearch} onSearch={searchArea} /><View style={s.quick}><TouchableOpacity style={s.quickItem} onPress={() => setScreen("map")}><Text style={s.quickIcon}>Map</Text></TouchableOpacity><TouchableOpacity style={s.quickItem} onPress={() => setScreen("vehicles")}><Text style={s.quickIcon}>Cars</Text></TouchableOpacity><TouchableOpacity style={s.quickItem} onPress={() => setScreen("pay")}><Text style={s.quickIcon}>Pay</Text></TouchableOpacity><TouchableOpacity style={s.quickItem} onPress={() => setScreen("zones")}><Text style={s.quickIcon}>RTA</Text></TouchableOpacity></View><Text style={s.section}>Nearby Parking</Text>{loading && <ActivityIndicator />}{parkings.length === 0 && !loading ? <Text style={s.empty}>No parking found. Try search area.</Text> : null}{parkings.map((p) => <ParkingCard key={p.id} p={p} />)}</ScrollView></>; }
  function MapScreen() { return <View style={s.mapPage}><View style={s.mapTop}><SearchBox value={search} onChangeText={setSearch} onSearch={searchArea} /><View style={s.mapTypes}>{["standard", "satellite", "hybrid"].map((m) => <TouchableOpacity key={m} style={[s.typeChip, mapType === m && s.typeActive]} onPress={() => setMapType(m)}><Text style={[s.typeText, mapType === m && s.typeTextActive]}>{m}</Text></TouchableOpacity>)}</View></View><MapView
  style={s.map}
  region={region}
  onRegionChangeComplete={setRegion}
  showsUserLocation
  mapType={mapType}
  onPress={() => Keyboard.dismiss()}
>{parkings.map((p) => <Marker key={p.id} coordinate={{ latitude: p.lat, longitude: p.lng }} title={p.name} pinColor="#00732f" onPress={() => setSelectedParking(p)}><Callout><View style={{ width: 210 }}><Text style={{ fontWeight: "900" }}>{p.name}</Text><Text>{p.address}</Text><Text>Live availability not available</Text></View></Callout></Marker>)}</MapView>{selectedParking && <View style={[s.mapCard, { bottom: 95 + insets.bottom }]}><Text style={s.pName}>{selectedParking.name}</Text><Text style={s.pAddr}>{selectedParking.address}</Text><Text style={s.noLive}>Live availability not available</Text><View style={s.row}><TouchableOpacity style={s.primarySmall} onPress={() => navigateToParking(selectedParking)}><Text style={s.primaryText}>Navigate</Text></TouchableOpacity><TouchableOpacity style={s.secondarySmall} onPress={() => setScreen("pay")}><Text style={s.secondaryText}>Pay</Text></TouchableOpacity></View></View>}</View>; }
  function Plate({ v }) { const isAD = v.emirate === "Abu Dhabi"; return <View style={[s.plate, isAD && { borderColor: v.colorValue || "#111" }]}><View style={s.plateHead}><Text style={s.flag}>UAE</Text><Text style={s.plateEm}>{v.emirate}</Text>{v.default && <Text style={s.defaultBadge}>Default</Text>}</View><View style={s.plateBody}><Text style={[s.plateCode, isAD && { backgroundColor: v.colorValue || "#111" }]}>{v.emirate === "Dubai" || v.emirate === "Abu Dhabi" ? v.code : emiratePrefix(v.emirate)}</Text><Text style={s.plateNo}>{v.number}</Text></View></View>; }
  function Vehicles() { return <ScrollView contentContainerStyle={[s.page, { paddingBottom: 115 + insets.bottom }]} keyboardShouldPersistTaps="handled"><Text style={s.h1}>My Vehicles</Text>{vehicles.map((v) => <View key={v.id}><Plate v={v} /><View style={s.row}><TouchableOpacity style={s.small} onPress={() => editVehicle(v)}><Text style={s.smallText}>Edit</Text></TouchableOpacity><TouchableOpacity style={s.danger} onPress={() => deleteVehicle(v)}><Text style={s.smallText}>Delete</Text></TouchableOpacity>{!v.default && <TouchableOpacity style={s.dark} onPress={() => setDefaultVehicle(v)}><Text style={s.smallText}>Set Default</Text></TouchableOpacity>}</View></View>)}<View style={s.card}><Text style={s.h2}>{editingVehicle ? "Update Vehicle" : "Add Vehicle"}</Text><Text style={s.label}>Emirate</Text><ScrollView horizontal keyboardShouldPersistTaps="handled">{EMIRATES.map((x) => <TouchableOpacity key={x} style={[s.chip, emirate === x && s.chipA]} onPress={() => setEmirate(x)}><Text style={[s.chipT, emirate === x && s.chipTA]}>{x}</Text></TouchableOpacity>)}</ScrollView>{codes.length > 0 && <><Text style={s.label}>Plate Code</Text><ScrollView horizontal keyboardShouldPersistTaps="handled">{codes.map((x) => <TouchableOpacity key={x} style={[s.chip, plateCode === x && s.chipA]} onPress={() => setPlateCode(x)}><Text style={[s.chipT, plateCode === x && s.chipTA]}>{x}</Text></TouchableOpacity>)}</ScrollView></>}{emirate === "Abu Dhabi" && <><Text style={s.label}>Plate Color</Text><ScrollView horizontal keyboardShouldPersistTaps="handled">{AD_COLORS.map((c) => <TouchableOpacity key={c.name} style={[s.colorChip, { borderColor: c.value }, plateColor.name === c.name && { backgroundColor: c.value }]} onPress={() => setPlateColor(c)}><Text style={[s.chipT, plateColor.name === c.name && { color: "#fff" }]}>{c.name}</Text></TouchableOpacity>)}</ScrollView></>}<Text style={s.label}>Plate Number</Text><TextInput style={s.plateInput} placeholder="12345" placeholderTextColor="#7ca38d" value={plateNumber} onChangeText={setPlateNumber} keyboardType="number-pad" returnKeyType="done" blurOnSubmit={false} maxLength={6} /><TouchableOpacity style={s.primary} onPress={saveVehicle}><Text style={s.primaryText}>{editingVehicle ? "Update Vehicle" : "Add Vehicle"}</Text></TouchableOpacity></View></ScrollView>; }
  function Pay() { const v = vehicles.find((x) => x.default) || vehicles[0]; return <ScrollView contentContainerStyle={[s.page, { paddingBottom: 115 + insets.bottom }]}><Text style={s.h1}>Pay Parking</Text><View style={s.card}><Text style={s.pName}>{selectedParking?.name || "Select parking from map"}</Text><Text style={s.pAddr}>{selectedParking?.address}</Text></View><View style={s.card}><Text style={s.label}>Vehicle</Text><Text style={s.pName}>{v ? `${v.emirate} ${plateDisplay(v)}` : "No vehicle"}</Text></View><Text style={s.label}>Duration</Text><View style={s.row}>{["1", "2", "3", "4"].map((h) => <TouchableOpacity key={h} style={[s.hour, duration === h && s.hourA]} onPress={() => setDuration(h)}><Text style={[s.hourT, duration === h && s.hourTA]}>{h}h</Text></TouchableOpacity>)}</View><View style={s.card}><Text style={s.pName}>Amount: AED {Number(duration) * 5}</Text></View><TouchableOpacity style={s.primary} onPress={bookParking}><Text style={s.primaryText}>Book / Pay</Text></TouchableOpacity></ScrollView>; }
  function Bookings() { return <ScrollView contentContainerStyle={[s.page, { paddingBottom: 115 + insets.bottom }]}><Text style={s.h1}>Bookings</Text>{bookings.map((b) => <View key={b.id} style={s.card}><Text style={s.pName}>{b.parkingName}</Text><Text>{b.vehicle}</Text><Text>{b.duration}h - AED {b.amount}</Text><Text>{b.time}</Text></View>)}</ScrollView>; }
  function RtaZones() {
    const filtered = rtaZones.filter((row) => {
      const body = JSON.stringify(row).toLowerCase();
      return body.includes(zoneSearch.trim().toLowerCase());
    });

    return <ScrollView contentContainerStyle={[s.page, { paddingBottom: 115 + insets.bottom }]} keyboardShouldPersistTaps="handled">
      <Text style={s.h1}>RTA Parking Zones</Text>
      <Text style={s.sourceText}>Source: Digital Dubai / Roads and Transport Authority</Text>
      <Text style={s.noLive}>This shows official parking spaces per zone, not live free spaces.</Text>

      <View style={s.searchBox}>
        <TextInput
          style={s.searchInput}
          placeholder="Search zone, area, sector..."
          placeholderTextColor="#777"
          value={zoneSearch}
          onChangeText={setZoneSearch}
          autoCorrect={false}
          blurOnSubmit={false}
        />
        <TouchableOpacity style={s.searchBtn} onPress={loadRtaZones}>
          <Text style={s.searchBtnText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {rtaLoading && <ActivityIndicator />}

      {!rtaLoading && filtered.length === 0 ? <Text style={s.empty}>No RTA zone records found.</Text> : null}

      {filtered.map((row, index) => {
        const zone = getZoneField(row, ["zone", "parking_zone", "zone_code", "parking_code", "sector", "area"]) || `Zone Record ${index + 1}`;
        const spaces = getZoneField(row, ["number_of_parking_spaces", "parking_spaces", "spaces", "total_spaces", "no_of_spaces", "count", "parking_count"]) || "N/A";
        const areaName = getZoneField(row, ["area_name", "area", "community", "location", "sector_name", "zone_name"]) || "";

        return <View key={String(index)} style={s.zoneCard}>
          <View style={s.zoneTop}>
            <Text style={s.zoneTitle}>{String(zone)}</Text>
            <Text style={s.zoneSpaces}>{String(spaces)}</Text>
          </View>
          <Text style={s.zoneLabel}>Total parking spaces</Text>
          {areaName ? <Text style={s.pAddr}>{String(areaName)}</Text> : null}
          <Text style={s.sourceText}>Digital Dubai / RTA</Text>
        </View>;
      })}
    </ScrollView>;
  }
  function Profile() { return <ScrollView contentContainerStyle={[s.page, { paddingBottom: 115 + insets.bottom }]}><Text style={s.h1}>Profile</Text><View style={s.avatar}><Text style={s.avatarT}>{(user?.fullName || user?.full_name || "U").slice(0, 2).toUpperCase()}</Text></View><View style={s.card}><Text style={s.pName}>{user?.fullName || user?.full_name}</Text><Text>{user?.email}</Text></View><TouchableOpacity style={[s.primary, { backgroundColor: "#CE1126" }]} onPress={logout}><Text style={s.primaryText}>Logout</Text></TouchableOpacity></ScrollView>; }
  function Current() { if (screen === "map") return MapScreen(); if (screen === "vehicles") return Vehicles(); if (screen === "pay") return Pay(); if (screen === "zones") return RtaZones(); if (screen === "bookings") return Bookings(); if (screen === "profile") return Profile(); return Home(); }
  function Nav() { const items = [["home", "Home"], ["map", "Map"], ["vehicles", "Cars"], ["zones", "RTA"], ["bookings", "Bookings"], ["profile", "Profile"]]; return <View style={[s.nav, { bottom: Math.max(insets.bottom + 8, 16) }]}>{items.map(([k, label]) => <TouchableOpacity key={k} style={s.navItem} onPress={() => setScreen(k)}><Text style={[s.navText, screen === k && s.navActive]}>{label}</Text></TouchableOpacity>)}</View>; }
  if (authLoading) return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator /><Text>Loading...</Text></View></SafeAreaView>;
  if (!token) return Auth();
  return <SafeAreaView style={s.safe}>{Current()}<Nav /></SafeAreaView>;
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#f3f6f9"}, center:{flex:1,justifyContent:"center",alignItems:"center"}, authWrap:{flexGrow:1,padding:18,justifyContent:"center"}, logo:{alignItems:"center",marginBottom:20}, logoIcon:{fontSize:52,fontWeight:"900",color:"#00732f"}, title:{fontSize:30,fontWeight:"900",color:"#00732f",textAlign:"center"}, sub:{color:"#555",fontWeight:"700"}, card:{backgroundColor:"#fff",borderRadius:22,padding:16,marginBottom:14,elevation:3}, h1:{fontSize:26,fontWeight:"900",marginBottom:14,color:"#111"}, h2:{fontSize:20,fontWeight:"900",marginBottom:10}, input:{backgroundColor:"#fff",borderRadius:16,padding:15,marginVertical:8,fontSize:16,elevation:2,borderWidth:1,borderColor:"#e5e7eb"}, primary:{backgroundColor:"#00732f",borderRadius:16,padding:16,alignItems:"center",marginTop:10}, primaryText:{color:"#fff",fontWeight:"900"}, link:{color:"#00732f",fontWeight:"900",textAlign:"center",marginTop:14}, header:{padding:18,paddingTop:14,backgroundColor:"#fff",flexDirection:"row",justifyContent:"space-between",alignItems:"center",elevation:3}, titleSmall:{fontSize:22,fontWeight:"900",color:"#00732f"}, headerSub:{color:"#555",maxWidth:280}, refresh:{backgroundColor:"#00732f",height:42,width:42,borderRadius:21,alignItems:"center",justifyContent:"center"}, refreshText:{color:"#fff",fontSize:18,fontWeight:"900"}, page:{padding:16}, searchBox:{backgroundColor:"#fff",borderRadius:18,padding:8,flexDirection:"row",alignItems:"center",elevation:3,marginBottom:14,borderWidth:1,borderColor:"#e5e7eb"}, searchInput:{flex:1,padding:10,fontSize:16,color:"#111"}, searchBtn:{backgroundColor:"#00732f",paddingHorizontal:14,paddingVertical:12,borderRadius:14}, searchBtnText:{color:"#fff",fontWeight:"900"}, quick:{flexDirection:"row",backgroundColor:"#fff",borderRadius:22,padding:14,elevation:3,justifyContent:"space-around",marginBottom:16}, quickItem:{alignItems:"center"}, quickIcon:{fontSize:15,fontWeight:"900",color:"#00732f"}, section:{fontSize:21,fontWeight:"900",marginBottom:10}, parkingCard:{backgroundColor:"#fff",borderRadius:18,padding:12,marginBottom:12,flexDirection:"row",alignItems:"center",elevation:3}, pIcon:{height:58,width:58,borderRadius:16,backgroundColor:"#e5f7ec",alignItems:"center",justifyContent:"center",marginRight:12}, pName:{fontSize:16,fontWeight:"900",color:"#111"}, pAddr:{color:"#555",marginTop:3}, noLive:{color:"#CE1126",fontWeight:"800",marginTop:4}, goBtn:{backgroundColor:"#00732f",padding:12,borderRadius:14}, goText:{color:"#fff",fontWeight:"900"}, empty:{textAlign:"center",color:"#777",marginTop:20}, mapPage:{flex:1}, mapTop:{position:"absolute",top:10,left:12,right:12,zIndex:5}, map:{flex:1}, mapTypes:{flexDirection:"row",gap:8}, typeChip:{backgroundColor:"#fff",borderRadius:14,paddingHorizontal:12,paddingVertical:8,elevation:2}, typeActive:{backgroundColor:"#00732f"}, typeText:{fontWeight:"900"}, typeTextActive:{color:"#fff"}, mapCard:{position:"absolute",left:14,right:14,backgroundColor:"#fff",borderRadius:20,padding:14,elevation:6}, row:{flexDirection:"row",gap:10,flexWrap:"wrap",alignItems:"center"}, primarySmall:{backgroundColor:"#00732f",borderRadius:14,padding:12,flex:1,alignItems:"center"}, secondarySmall:{backgroundColor:"#e5f7ec",borderRadius:14,padding:12,flex:1,alignItems:"center"}, secondaryText:{color:"#00732f",fontWeight:"900"}, nav:{position:"absolute",left:12,right:12,backgroundColor:"#fff",borderRadius:24,padding:12,flexDirection:"row",justifyContent:"space-around",elevation:10}, navItem:{alignItems:"center",flex:1}, navText:{fontSize:11,color:"#444",fontWeight:"800"}, navActive:{color:"#00732f",fontWeight:"900"}, label:{fontWeight:"900",marginTop:8,marginBottom:8}, chip:{backgroundColor:"#eef3f8",borderRadius:16,paddingHorizontal:13,paddingVertical:10,marginRight:8,marginBottom:8}, chipA:{backgroundColor:"#00732f"}, chipT:{fontWeight:"800",color:"#333"}, chipTA:{color:"#fff"}, colorChip:{borderWidth:2,borderRadius:16,paddingHorizontal:13,paddingVertical:10,marginRight:8}, plateInput:{backgroundColor:"#fff",borderRadius:18,padding:18,marginVertical:10,fontSize:24,fontWeight:"900",color:"#111",borderWidth:3,borderColor:"#00732f",elevation:6,letterSpacing:2}, plate:{backgroundColor:"#fff",borderRadius:20,padding:12,marginBottom:8,elevation:4,borderWidth:2,borderColor:"#111"}, plateHead:{flexDirection:"row",alignItems:"center",borderBottomWidth:1,borderBottomColor:"#ddd",paddingBottom:8,marginBottom:8}, flag:{fontSize:15,fontWeight:"900",marginRight:8}, plateEm:{fontSize:18,fontWeight:"900",flex:1,textTransform:"uppercase"}, defaultBadge:{color:"#00732f",fontWeight:"900"}, plateBody:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"}, plateCode:{backgroundColor:"#111",color:"#fff",fontSize:24,fontWeight:"900",paddingHorizontal:14,paddingVertical:8,borderRadius:12,overflow:"hidden",minWidth:52,textAlign:"center"}, plateNo:{fontSize:31,fontWeight:"900",letterSpacing:2}, small:{backgroundColor:"#00732f",padding:10,borderRadius:12}, danger:{backgroundColor:"#CE1126",padding:10,borderRadius:12}, dark:{backgroundColor:"#102a43",padding:10,borderRadius:12}, smallText:{color:"#fff",fontWeight:"900"}, hour:{backgroundColor:"#fff",borderRadius:14,paddingVertical:12,paddingHorizontal:18,elevation:2}, hourA:{backgroundColor:"#00732f"}, hourT:{fontWeight:"900"}, hourTA:{color:"#fff"}, zoneCard:{backgroundColor:"#fff",borderRadius:18,padding:14,marginBottom:12,elevation:3,borderLeftWidth:5,borderLeftColor:"#00732f"}, zoneTop:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"}, zoneTitle:{fontSize:17,fontWeight:"900",color:"#111",flex:1,marginRight:10}, zoneSpaces:{fontSize:24,fontWeight:"900",color:"#00732f"}, zoneLabel:{color:"#555",fontWeight:"800",marginTop:4}, sourceText:{color:"#666",fontSize:12,fontWeight:"700",marginBottom:8}, avatar:{width:95,height:95,borderRadius:50,backgroundColor:"#00732f",alignSelf:"center",alignItems:"center",justifyContent:"center",marginBottom:18}, avatarT:{color:"#fff",fontSize:30,fontWeight:"900"},
banner:{height:190,margin:16,borderRadius:24,overflow:"hidden",elevation:4},
bannerImage:{borderRadius:24},
bannerOverlay:{flex:1,justifyContent:"flex-end",padding:18,backgroundColor:"rgba(0,0,0,0.15)"},
bannerTitle:{fontSize:28,fontWeight:"900",color:"#fff"},
bannerSub:{fontSize:18,fontWeight:"900",color:"#e8fff0"},
});
