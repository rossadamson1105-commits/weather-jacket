const codeInfo = {
  0: ["Clear", "☀"], 1: ["Mostly clear", "☀"], 2: ["Partly cloudy", "◐"], 3: ["Cloudy", "☁"],
  45: ["Fog", "≋"], 48: ["Icy fog", "≋"], 51: ["Drizzle", "☂"], 53: ["Drizzle", "☂"], 55: ["Heavy drizzle", "☂"],
  56: ["Freezing drizzle", "❄"], 57: ["Freezing drizzle", "❄"], 61: ["Light rain", "☂"], 63: ["Rain", "☂"], 65: ["Heavy rain", "☂"],
  66: ["Freezing rain", "❄"], 67: ["Freezing rain", "❄"], 71: ["Light snow", "❄"], 73: ["Snow", "❄"], 75: ["Heavy snow", "❄"],
  77: ["Snow grains", "❄"], 80: ["Showers", "☂"], 81: ["Showers", "☂"], 82: ["Heavy showers", "☂"], 85: ["Snow showers", "❄"],
  86: ["Snow showers", "❄"], 95: ["Thunderstorm", "ϟ"], 96: ["Thunderstorm", "ϟ"], 99: ["Thunderstorm", "ϟ"],
};
const rainCodes = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
const sources = [
  { name: "ECMWF IFS", provider: "European Centre", model: "ecmwf_ifs025" },
  { name: "UK Met Office", provider: "United Kingdom", model: "ukmo_global_deterministic_10km" },
  { name: "DWD ICON", provider: "Germany", model: "icon_seamless" },
  { name: "NOAA GFS", provider: "United States", model: "gfs_seamless" },
  { name: "Météo-France", provider: "France", model: "meteofrance_seamless" },
];
let unit = "celsius";
let forecastData;
let locationLabel = "Glasgow, Scotland";

const $ = (selector) => document.querySelector(selector);
const toDisplayTemp = (fahrenheit) => Math.round(unit === "fahrenheit" ? fahrenheit : (fahrenheit - 32) * 5 / 9);
const displayTemp = (fahrenheit) => `${toDisplayTemp(fahrenheit)}°`;
const weatherCode = (code) => codeInfo[code] || ["Variable", "☁"];

function jacketAdvice(feelsLike, code, wind, rainChance) {
  const wet = rainCodes.has(code) || rainChance >= 40;
  let title = "Light jacket";
  let reason = "A handy layer for cooler air and the walk home.";
  if (feelsLike >= 75) [title, reason] = ["No jacket needed", "A light layer is enough for cooler indoor spaces."];
  else if (feelsLike >= 64) [title, reason] = ["Light windbreaker", "A breathable shell will take the edge off the breeze."];
  else if (feelsLike >= 52) [title, reason] = ["Light jacket", "An easy layer for Glasgow's changeable air."];
  else if (feelsLike >= 40) [title, reason] = ["Warm everyday coat", "Choose a lined layer to keep the chill off."];
  else [title, reason] = ["Insulated winter coat", "Bundle up with a warm layer underneath."];
  const tags = [];
  if (wet) {
    title = feelsLike < 40 ? "Waterproof winter coat" : "Waterproof jacket";
    reason = "Rain is likely. Choose a water-resistant layer with a hood.";
    tags.push("RAIN READY");
  }
  if (wind >= 18) {
    reason = wet ? "Rain and strong wind call for a snug waterproof shell." : "Strong wind will cut through light layers; choose a windproof coat.";
    tags.push("WINDPROOF");
  }
  if (code >= 71 && code <= 86) tags.push("SNOW READY");
  if (!tags.length) tags.push(feelsLike < 52 ? "WARM LAYER" : "EASY LAYER");
  return { title, reason, tags };
}

function renderSources(results) {
  const list = $("#source-list");
  list.replaceChildren(...results.map(({ source, temperature, error }) => {
    const row = document.createElement("div");
    row.className = "source-row";
    const label = document.createElement("span");
    label.innerHTML = `<strong>${source.name}</strong><small>${source.provider}</small>`;
    const value = document.createElement("span");
    value.className = error ? "source-unavailable" : "source-value";
    value.textContent = error ? "Unavailable" : displayTemp(temperature);
    row.append(label, value);
    return row;
  }));
}

async function loadSources(latitude, longitude) {
  const results = await Promise.all(sources.map(async (source) => {
    try {
      const params = new URLSearchParams({
        latitude, longitude, hourly: "temperature_2m", forecast_hours: "2", temperature_unit: "fahrenheit",
        timezone: "auto", models: source.model,
      });
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
      if (!response.ok) throw new Error("Unavailable");
      const data = await response.json();
      const temperatures = data.hourly.temperature_2m;
      return { source, temperature: temperatures[0] };
    } catch {
      return { source, error: true };
    }
  }));
  renderSources(results);
}

function renderForecast(data) {
  forecastData = data;
  const current = data.weather.current;
  const daily = data.weather.daily;
  const hourly = data.weather.hourly;
  const rainChance = Math.max(...hourly.precipitation_probability.slice(0, 6));
  const [description, symbol] = weatherCode(current.weather_code);
  const recommendation = jacketAdvice(current.apparent_temperature, current.weather_code, current.wind_speed_10m, rainChance);

  $("#city-name").textContent = data.location;
  $("#description").textContent = description;
  $("#weather-icon").textContent = current.is_day ? symbol : ([0, 1].includes(current.weather_code) ? "☾" : symbol);
  $("#temperature").textContent = displayTemp(current.temperature_2m);
  $("#feels-like").textContent = displayTemp(current.apparent_temperature);
  $("#high").textContent = displayTemp(daily.temperature_2m_max[0]);
  $("#low").textContent = displayTemp(daily.temperature_2m_min[0]);
  $("#wind").textContent = `${Math.round(current.wind_speed_10m)} mph`;
  $("#rain").textContent = `${rainChance}%`;
  $("#humidity").textContent = `${current.relative_humidity_2m}%`;
  $("#jacket-title").textContent = recommendation.title;
  $("#jacket-reason").textContent = recommendation.reason;
  $("#jacket-tags").replaceChildren(...recommendation.tags.map((tag) => {
    const chip = document.createElement("span");
    chip.className = "tag";
    chip.textContent = tag;
    return chip;
  }));

  const times = hourly.time.map((time, index) => ({ time, index })).filter(({ time }) => time >= current.time).slice(0, 6);
  $("#hourly").replaceChildren(...times.map(({ time, index }, position) => {
    const hour = document.createElement("div");
    hour.className = "hour";
    const timestamp = new Date(time);
    const label = position === 0 ? "Now" : new Intl.DateTimeFormat(undefined, { hour: "numeric", timeZone: data.weather.timezone }).format(timestamp);
    const icon = weatherCode(hourly.weather_code[index])[1];
    hour.innerHTML = `<span>${label}</span><b aria-hidden="true">${icon}</b><strong>${displayTemp(hourly.temperature_2m[index])}</strong>`;
    return hour;
  }));
  $("#week-forecast").replaceChildren(...daily.time.map((date, index) => {
    const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
    const label = index === 0 ? "Today" : index === 1 ? "Tomorrow" : weekday;
    const condition = weatherCode(daily.weather_code[index]);
    const rain = daily.precipitation_probability_max[index];
    const card = document.createElement("div");
    card.className = "day-card";
    card.innerHTML = `<span class="day-name">${label}</span><span class="day-icon" aria-hidden="true">${condition[1]}</span><span class="day-condition">${condition[0]}</span><strong>${displayTemp(daily.temperature_2m_max[index])}</strong><span class="day-low">${displayTemp(daily.temperature_2m_min[index])}</span><span class="day-rain">Rain ${rain ?? 0}%</span>`;
    return card;
  }));
  $("#date-label").textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", timeZone: data.weather.timezone }).format(new Date(current.time));
  $("#dashboard").hidden = false;
  $("#status").hidden = true;
}

async function loadWeather(latitude, longitude, location) {
  $("#status").hidden = false;
  $("#status").textContent = `Finding the forecast for ${location}...`;
  $("#dashboard").hidden = true;
  const params = new URLSearchParams({
    latitude, longitude,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m",
    hourly: "temperature_2m,precipitation_probability,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    temperature_unit: "fahrenheit", wind_speed_unit: "mph", timezone: "auto", forecast_days: "7",
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!response.ok) throw new Error("Weather data is temporarily unavailable.");
  const weather = await response.json();
  renderForecast({ weather, location });
  loadSources(latitude, longitude);
}

async function searchCity(city) {
  $("#status").hidden = false;
  $("#status").textContent = `Searching for ${city}...`;
  const params = new URLSearchParams({ name: city, count: "1", language: "en", format: "json" });
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
  if (!response.ok) throw new Error("City search is temporarily unavailable.");
  const result = await response.json();
  if (!result.results?.length) throw new Error(`Couldn't find "${city}". Try another city.`);
  const place = result.results[0];
  const location = [place.name, place.admin1, place.country_code].filter(Boolean).join(", ");
  await loadWeather(place.latitude, place.longitude, location);
}

$("#search-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try { await searchCity($("#city-input").value.trim()); }
  catch (error) { $("#status").hidden = false; $("#status").textContent = error.message; }
});

$("#locate").addEventListener("click", () => {
  if (!navigator.geolocation) { $("#status").hidden = false; $("#status").textContent = "Location isn't available. Search for a city instead."; return; }
  navigator.geolocation.getCurrentPosition(({ coords }) => {
    loadWeather(coords.latitude, coords.longitude, "Your location").catch((error) => { $("#status").hidden = false; $("#status").textContent = error.message; });
  }, () => { $("#status").hidden = false; $("#status").textContent = "Couldn't access your location. Search for a city instead."; }, { timeout: 10000 });
});

document.querySelectorAll("[data-unit]").forEach((button) => button.addEventListener("click", () => {
  unit = button.dataset.unit;
  document.querySelectorAll("[data-unit]").forEach((other) => {
    const active = other === button;
    other.classList.toggle("active", active);
    other.setAttribute("aria-pressed", String(active));
  });
  if (forecastData) {
    renderForecast(forecastData);
    loadSources(forecastData.weather.latitude, forecastData.weather.longitude);
  }
}));

searchCity("Glasgow").catch((error) => { $("#status").textContent = error.message; });