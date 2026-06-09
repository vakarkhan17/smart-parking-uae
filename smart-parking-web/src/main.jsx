import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const API_BASE_URL = "https://smart-parking-uae.onrender.com";
const GOOGLE_MAPS_API_KEY = "AIzaSyAgRl_gBYRuz6d4cXlQwvi5uwDSSgPTpv4";

function loadGoogleMaps() {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) return resolve(window.google.maps);
    if (document.getElementById("google-maps-js")) {
      const timer = setInterval(() => {
        if (window.google?.maps) { clearInterval(timer); resolve(window.google.maps); }
      }, 300);
      return;
    }
    const script = document.createElement("script");
    script.id = "google-maps-js";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google.maps);
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
}

async function api(path, method = "GET", body = null, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : null });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

function App() {
  const [token, setToken] = useState(localStorage.getItem("sp_token") || "");
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem("sp_user") || "null"); } catch { return null; } });
  const [authMode, setAuthMode] = useState("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [search, setSearch] = useState("Dubai Marina");
  const [mapType, setMapType] = useState("roadmap");
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [parkingList, setParkingList] = useState([]);
  const [selected, setSelected] = useState(null);

  const [zones, setZones] = useState([]);
  const [zoneSearch, setZoneSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const filteredZones = useMemo(() => {
    const q = zoneSearch.trim().toLowerCase();
    if (!q) return zones;
    return zones.filter((z) => JSON.stringify(z).toLowerCase().includes(q));
  }, [zones, zoneSearch]);

  useEffect(() => {
    if (!token) return;
    initMap();
    loadRtaZones();
  }, [token]);

  useEffect(() => { if (map) map.setMapTypeId(mapType); }, [mapType, map]);

  function saveSession(data) {
    localStorage.setItem("sp_token", data.token);
    localStorage.setItem("sp_user", JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  }

  async function register() {
    try {
      setBusy(true); setMessage("");
      const data = await api("/api/auth/register", "POST", { fullName, email, password });
      setMessage(data.message || "Registered. Check your email if verification is enabled.");
      setAuthMode("login");
    } catch (e) { setMessage(e.message); } finally { setBusy(false); }
  }

  async function login() {
    try {
      setBusy(true); setMessage("");
      const data = await api("/api/auth/login", "POST", { email, password });
      saveSession(data);
    } catch (e) { setMessage(e.message); } finally { setBusy(false); }
  }

  function logout() {
    localStorage.removeItem("sp_token");
    localStorage.removeItem("sp_user");
    setToken(""); setUser(null);
  }

  async function initMap() {
    try {
      if (GOOGLE_MAPS_API_KEY.includes("PASTE")) {
        setMessage("Add your Google Maps JavaScript API key in src/main.jsx");
        return;
      }
      const maps = await loadGoogleMaps();
      const m = new maps.Map(document.getElementById("map"), {
        center: { lat: 25.2048, lng: 55.2708 },
        zoom: 13,
        mapTypeId: mapType,
        streetViewControl: false,
        fullscreenControl: true,
        mapTypeControl: false,
      });
      setMap(m);
      await searchParking("Dubai Marina", m);
    } catch (e) { setMessage(e.message); }
  }

  function clearMarkers() {
    markers.forEach((marker) => marker.setMap(null));
    setMarkers([]);
  }

  async function searchParking(query = search, activeMap = map) {
    try {
      if (!activeMap) return;
      setBusy(true); setMessage("");
      const maps = await loadGoogleMaps();
      const geocoder = new maps.Geocoder();

      geocoder.geocode({ address: `${query}, UAE`, region: "AE" }, (geoResults, geoStatus) => {
        if (geoStatus !== "OK" || !geoResults?.[0]) {
          setMessage(`Area not found: ${geoStatus}`);
          setBusy(false);
          return;
        }
        const location = geoResults[0].geometry.location;
        activeMap.setCenter(location);
        activeMap.setZoom(14);

        const service = new maps.places.PlacesService(activeMap);
        service.nearbySearch({ location, radius: 5000, type: "parking" }, (results, status) => {
          clearMarkers();
          if (status !== maps.places.PlacesServiceStatus.OK && status !== maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            setMessage(`Parking search issue: ${status}`);
            setBusy(false);
            return;
          }

          const list = (results || []).map((p) => ({
            id: p.place_id,
            name: p.name,
            address: p.vicinity || "Address not available",
            rating: p.rating || "N/A",
            lat: p.geometry.location.lat(),
            lng: p.geometry.location.lng(),
          }));

          const newMarkers = list.map((p) => {
            const marker = new maps.Marker({ map: activeMap, position: { lat: p.lat, lng: p.lng }, title: p.name });
            marker.addListener("click", () => { setSelected(p); activeMap.panTo({ lat: p.lat, lng: p.lng }); });
            return marker;
          });

          setMarkers(newMarkers);
          setParkingList(list);
          setSelected(list[0] || null);
          setBusy(false);
        });
      });
    } catch (e) { setMessage(e.message); setBusy(false); }
  }

  async function loadRtaZones() {
    try {
      const data = await api("/api/dda/parking-spaces?page=1&pageSize=300");
      const rows = data?.data?.results || data?.data?.data || data?.data?.records || data?.data || [];
      setZones(Array.isArray(rows) ? rows : []);
    } catch (e) { setMessage(e.message); }
  }

  function getField(row, names) {
    const keys = Object.keys(row || {});
    for (const name of names) {
      const exact = keys.find((k) => k.toLowerCase() === name.toLowerCase());
      if (exact) return row[exact];
    }
    const fuzzy = keys.find((k) => names.some((n) => k.toLowerCase().includes(n.toLowerCase())));
    return fuzzy ? row[fuzzy] : "";
  }

  if (!token) {
    return <div className="auth-page">
      <div className="auth-hero"><img src="/assets/banner.png" alt="Smart Parking UAE" /></div>
      <div className="auth-card">
        <h1>Smart UAE Parking</h1>
       
        {message && <div className="message">{message}</div>}
        {authMode === "register" && <input placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />}
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button disabled={busy} onClick={authMode === "login" ? login : register}>{busy ? "Please wait..." : authMode === "login" ? "Login" : "Create account"}</button>
        <button className="link" onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}>{authMode === "login" ? "Create new account" : "Back to login"}</button>
      </div>
    </div>;
  }

  return <main>
    <header className="topbar">
      <div><h1>Smart UAE Parking</h1><p>Google parking search + official Digital Dubai/RTA zone capacity</p></div>
      <div className="userbox"><span>{user?.fullName || user?.full_name || user?.email}</span><button onClick={logout}>Logout</button></div>
    </header>

    {message && <div className="message wide">{message}</div>}

    <section className="hero"><img src="/assets/banner.png" alt="Smart Parking banner" /></section>

    <section className="search-panel">
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search area, mall, place..." />
      <button onClick={() => searchParking(search)}>{busy ? "Searching..." : "Search Parking"}</button>
      <button onClick={() => setMapType("roadmap")}>Standard</button>
      <button onClick={() => setMapType("satellite")}>Satellite</button>
      <button onClick={() => setMapType("hybrid")}>Hybrid</button>
    </section>

    <section className="content-grid">
      <div className="map-card">
        <div id="map"></div>
        {selected && <div className="selected-card">
          <h3>{selected.name}</h3><p>{selected.address}</p>
          <p className="red">Live availability not available from Google Places.</p>
          <a target="_blank" href={`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lng}`}>Navigate</a>
        </div>}
      </div>

      <div className="list-card">
        <h2>Nearby Parking</h2>
        {parkingList.length === 0 ? <p>No parking found yet.</p> : null}
        {parkingList.map((p) => <button className="parking-row" key={p.id} onClick={() => setSelected(p)}>
          <b>{p.name}</b><span>{p.address}</span><small>Rating: {p.rating}</small>
        </button>)}
      </div>
    </section>

    <section className="zones">
      <div className="section-title"><div><h2>RTA Parking Zones</h2><p>Source: Digital Dubai / Roads and Transport Authority</p></div><button onClick={loadRtaZones}>Refresh</button></div>
      <input value={zoneSearch} onChange={(e) => setZoneSearch(e.target.value)} placeholder="Search zone, area, sector..." />
      <div className="zone-grid">
        {filteredZones.map((row, index) => {
          const zone = getField(row, ["zone", "parking_zone", "zone_code", "parking_code", "sector", "area"]) || `Zone ${index + 1}`;
          const spaces = getField(row, ["number_of_parking_spaces", "parking_spaces", "spaces", "total_spaces", "no_of_spaces", "count", "parking_count"]) || "N/A";
          const areaName = getField(row, ["area_name", "area", "community", "location", "sector_name", "zone_name"]) || "";
          return <div className="zone-card" key={index}><strong>{String(zone)}</strong><span>{String(spaces)}</span><small>Total parking spaces</small>{areaName ? <p>{String(areaName)}</p> : null}</div>;
        })}
      </div>
    </section>
  </main>;
}

createRoot(document.getElementById("root")).render(<App />);
