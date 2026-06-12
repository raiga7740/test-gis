document.addEventListener("DOMContentLoaded", function () {
  const mapDiv = document.getElementById("map");

  if (!mapDiv) {
    console.error("Div map tidak ditemukan.");
    return;
  }

  const defaultCenter = L.latLng(-6.2088, 106.8456);

  const map = L.map("map").setView(defaultCenter, 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map);

  L.control.scale({
    metric: true,
    imperial: false,
  }).addTo(map);

  let markers = [];
  let waypoints = [];
  let currentRoute = null;

  function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  function formatDistance(km) {
    if (km < 1) {
      return `${(km * 1000).toFixed(0)} meter`;
    }

    return `${km.toFixed(1)} km`;
  }

  function formatTime(distanceKm, durationMin) {
    if (typeof durationMin === "number" && !isNaN(durationMin)) {
      if (durationMin < 60) {
        return `${durationMin} menit`;
      }

      const jam = Math.floor(durationMin / 60);
      const sisa = durationMin % 60;

      return sisa > 0 ? `${jam} jam ${sisa} menit` : `${jam} jam`;
    }

    const menit = Math.round((distanceKm / 30) * 60);

    if (menit < 60) {
      return `${menit} menit`;
    }

    const jam = Math.floor(menit / 60);
    const sisa = menit % 60;

    return sisa > 0 ? `${jam} jam ${sisa} menit` : `${jam} jam`;
  }

  async function getRoute(start, end) {
    const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.code === "Ok" && data.routes && data.routes.length > 0) {
        const route = data.routes[0];

        return {
          success: true,
          distanceKm: route.distance / 1000,
          durationMin: Math.round(route.duration / 60),
          geometry: route.geometry,
        };
      }

      return { success: false };
    } catch (error) {
      console.log("API error:", error);
      return { success: false };
    }
  }

  function drawRoute(geojson) {
    if (currentRoute) {
      map.removeLayer(currentRoute);
    }

    currentRoute = L.geoJSON(geojson, {
      style: {
        color: "#2563eb",
        weight: 5,
        opacity: 0.85,
      },
    }).addTo(map);

    map.fitBounds(currentRoute.getBounds(), {
      padding: [30, 30],
    });
  }

  function drawStraightLine(point1, point2) {
    if (currentRoute) {
      map.removeLayer(currentRoute);
    }

    currentRoute = L.polyline([point1, point2], {
      color: "#111827",
      weight: 4,
      opacity: 0.8,
      dashArray: "8, 8",
    }).addTo(map);

    map.fitBounds(currentRoute.getBounds(), {
      padding: [30, 30],
    });
  }

  function updateResult(start, end, distanceKm, method, durationMin) {
    const resultDiv = document.getElementById("resultContent");
    const pointsDiv = document.getElementById("pointsList");

    const waktu = formatTime(distanceKm, durationMin);
    const jarak = formatDistance(distanceKm);

    const methodText =
      method === "api" ? "Rute jalan" : "Garis lurus";

    resultDiv.innerHTML = `
      <div class="distance-box">${jarak}</div>
      <div class="time-box">${waktu}</div>
      <p class="status">${methodText}</p>
    `;

    pointsDiv.innerHTML = `
      <div class="point-item">
        <div class="point-label">TITIK AWAL</div>
        <div class="point-coord">${start.lat.toFixed(5)}, ${start.lng.toFixed(5)}</div>
      </div>

      <div class="point-item">
        <div class="point-label">TITIK TUJUAN</div>
        <div class="point-coord">${end.lat.toFixed(5)}, ${end.lng.toFixed(5)}</div>
      </div>
    `;
  }

  function resetResultUI() {
    document.getElementById("resultContent").innerHTML = `
      <p class="status">Klik dua titik di peta</p>
    `;

    document.getElementById("pointsList").innerHTML = `
      <div class="empty-point">
        Belum ada titik yang dipilih.
      </div>
    `;
  }

  async function calculate() {
    if (waypoints.length < 2) {
      return;
    }

    const start = waypoints[0];
    const end = waypoints[1];

    document.getElementById("resultContent").innerHTML = `
      <p class="status">
        <span class="loading"></span>
        Menghitung rute...
      </p>
    `;

    const api = await getRoute(start, end);

    if (api.success) {
      updateResult(start, end, api.distanceKm, "api", api.durationMin);
      drawRoute(api.geometry);
    } else {
      const straightDistance = haversineDistance(
        start.lat,
        start.lng,
        end.lat,
        end.lng
      );

      updateResult(start, end, straightDistance, "haversine");
      drawStraightLine(start, end);
    }

    if (markers[0]) {
      markers[0]
        .bindPopup(`
          <b>Titik Awal</b><br>
          ${start.lat.toFixed(5)}, ${start.lng.toFixed(5)}
        `)
        .openPopup();
    }

    if (markers[1]) {
      markers[1].bindPopup(`
        <b>Titik Tujuan</b><br>
        ${end.lat.toFixed(5)}, ${end.lng.toFixed(5)}
      `);
    }
  }

  function resetAll() {
    markers.forEach(function (marker) {
      map.removeLayer(marker);
    });

    markers = [];
    waypoints = [];

    if (currentRoute) {
      map.removeLayer(currentRoute);
    }

    currentRoute = null;

    resetResultUI();

    map.setView(defaultCenter, 13);
  }

  async function addPoint(latlng) {
    if (waypoints.length >= 2) {
      resetAll();
    }

    const marker = L.marker(latlng, {
      draggable: true,
    }).addTo(map);

    marker.on("dragend", async function () {
      const newPosition = marker.getLatLng();
      const index = markers.indexOf(marker);

      if (index !== -1) {
        waypoints[index] = newPosition;
      }

      if (waypoints.length === 2) {
        await calculate();
      }
    });

    markers.push(marker);
    waypoints.push(latlng);

    if (waypoints.length === 2) {
      await calculate();
    } else {
      document.getElementById("pointsList").innerHTML = `
        <div class="point-item">
          <div class="point-label">TITIK AWAL</div>
          <div class="point-coord">${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}</div>
        </div>

        <div class="empty-point">
          Klik titik kedua sebagai tujuan.
        </div>
      `;

      document.getElementById("resultContent").innerHTML = `
        <p class="status">Klik titik kedua</p>
      `;

      marker
        .bindPopup(`
          <b>Titik Awal</b><br>
          Klik titik lain untuk tujuan
        `)
        .openPopup();
    }
  }

  function addExample() {
    resetAll();

    const point1 = L.latLng(-6.1754, 106.8272);
    const point2 = L.latLng(-6.2088, 106.8456);

    addPoint(point1);

    setTimeout(function () {
      addPoint(point2);
    }, 300);
  }

  map.on("click", function (event) {
    addPoint(event.latlng);
  });

  document.getElementById("resetBtn").addEventListener("click", resetAll);
  document.getElementById("exampleBtn").addEventListener("click", addExample);
});