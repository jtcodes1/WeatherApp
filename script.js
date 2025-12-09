// @ts-nocheck
/*
    Weather Forecast Dashboard
    Author: Jos Thomas
    Spring 2023

    Description:
    Front-end weather dashboard using Open-Meteo and Chart.js.
*/


// API endpoints

// This API converts a city name into coordinates (latitude & longitude)
const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";

// This API provides current, hourly, and daily weather data
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";

// DOM Element references

// Input & button elements
const cityInput = document.getElementById("city-input");        // City text field
const searchBtn = document.getElementById("search-btn");        // Search button
const geoBtn = document.getElementById("geo-btn");              // GPS button
const unitBtn = document.getElementById("unit-btn");            // °F / °C toggle button
const statusMessage = document.getElementById("status-message");  // Status message under search

// Current weather display fields
const currentLocationEl = document.getElementById("current-location");
const currentDescriptionEl = document.getElementById("current-description");
const currentTempEl = document.getElementById("current-temp");
const currentFeelsEl = document.getElementById("current-feels");
const currentHumidityEl = document.getElementById("current-humidity");
const currentWindEl = document.getElementById("current-wind");
const weatherIconEl = document.getElementById("weather-icon");

// Global state variables

// Tracks whether temperatures are displayed in Fahrenheit or Celsius
let currentUnit = "F";

// Stores the most recently fetched weather data
// This allows us to redraw the charts when toggling units
let lastWeatherData = null;

// Stores the last city label so we can re-render the UI correctly
let lastLocationLabel = "";

// Chart.js instances (used so we can safely destroy and recreate charts)
let forecastChart = null;
let historyChart = null;

// EVENT listeners

// Runs when the user clicks the "Search" button
searchBtn.addEventListener("click", () => {
    const city = cityInput.value.trim(); // Remove extra spaces

    // Prevent empty searches
    if (city === "") {
        setStatus("Please enter a city.");
        return;
    }

    fetchWeatherByCity(city);
});

// Allows pressing Enter instead of clicking the button
cityInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        searchBtn.click();
    }
});

// Uses the browser's built-in geolocation API
geoBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
        setStatus("Geolocation is not supported.");
        return;
    }

    setStatus("Detecting your location...");

    navigator.geolocation.getCurrentPosition(
        position => {
            fetchWeatherByCoords(
                position.coords.latitude,
                position.coords.longitude,
                "Your Location"
            );
        },
        () => setStatus("Location permission denied.")
    );
});

// Toggles between Fahrenheit and Celsius
unitBtn.addEventListener("click", () => {
    // Switch the unit
    currentUnit = currentUnit === "F" ? "C" : "F";

    // Redraw everything using stored weather data
    if (lastWeatherData) {
        updateCurrentWeather(lastLocationLabel, lastWeatherData);
        updateForecastChart(lastWeatherData);
        updateHistoryChart(lastWeatherData);
    }

    setStatus(`Switched to °${currentUnit}`);
});

// Status message helper

// Updates the small message under the search bar
function setStatus(message) {
    statusMessage.textContent = message;
}

// Temperature conversion helpers

// Converts Celsius to Fahrenheit
function cToF(celsius) {
    return (celsius * 9) / 5 + 32;
}

// Formats temperature based on current unit selection
function formatTemp(tempC) {
    if (currentUnit === "F") {
        return Math.round(cToF(tempC)) + " °F";
    } else {
        return Math.round(tempC) + " °C";
    }
}

// Weathercode, icon, and LABEL MAPPING

// Converts Open-Meteo weather codes into icons + readable labels
function getWeatherIconAndLabel(code) {
    if (code === 0) return { icon: "☀️", label: "Clear Sky" };
    if (code <= 2) return { icon: "⛅", label: "Partly Cloudy" };
    if (code === 3) return { icon: "☁️", label: "Overcast" };
    if (code >= 45 && code <= 48) return { icon: "🌫", label: "Fog" };
    if (code >= 51 && code <= 57) return { icon: "🌦", label: "Drizzle" };
    if (code >= 61 && code <= 67) return { icon: "🌧", label: "Rain" };
    if (code >= 71 && code <= 77) return { icon: "❄️", label: "Snow" };
    if (code >= 80 && code <= 82) return { icon: "🌦", label: "Showers" };
    if (code >= 95) return { icon: "⛈", label: "Thunderstorm" };

    return { icon: "❓", label: "Unknown" };
}

// API helper functions

// Converts a city name into latitude & longitude using the geocoding API
async function getCoordsForCity(city) {
    const url = `${GEO_URL}?name=${encodeURIComponent(city)}&count=1`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data || !data.results || data.results.length === 0) {
        throw new Error("City not found.");
    }

    const result = data.results[0];

    // Start with just the city name
    let locationLabel = result.name || "Unknown City";

    // Only add state/region if it actually exists
    if (result.admin1 && result.admin1 !== "") {
        locationLabel += `, ${result.admin1}`;
    }

    // Only add country if it exists
    if (result.country && result.country !== "") {
        locationLabel += `, ${result.country}`;
    }

    return {
        name: locationLabel,
        lat: result.latitude,
        lon: result.longitude
    };
}

// Fetches weather data using latitude and longitude
async function getWeatherForCoords(lat, lon) {
    const url =
        `${WEATHER_URL}?latitude=${lat}` +
        `&longitude=${lon}` +
        `&current_weather=true` +
        `&hourly=temperature_2m` +
        `&daily=temperature_2m_min,temperature_2m_max` +
        `&timezone=auto`;

    const res = await fetch(url);
    return await res.json();
}

// Main data pipeline

// Runs when a city is searched
async function fetchWeatherByCity(city) {
    try {
        setStatus("Fetching weather data...");

        const coords = await getCoordsForCity(city);
        const data = await getWeatherForCoords(coords.lat, coords.lon);

        // Store for later unit toggling
        lastWeatherData = data;
        lastLocationLabel = coords.name;

        updateCurrentWeather(coords.name, data);
        updateForecastChart(data);
        updateHistoryChart(data);

        setStatus(`Showing weather for ${coords.name}`);
    } catch (err) {
        setStatus(err.message);
    }
}

// Runs when GPS location is used
async function fetchWeatherByCoords(lat, lon, label) {
    try {
        setStatus("Fetching weather data...");
        const data = await getWeatherForCoords(lat, lon);

        lastWeatherData = data;
        lastLocationLabel = label;

        updateCurrentWeather(label, data);
        updateForecastChart(data);
        updateHistoryChart(data);

        setStatus(`Showing weather for ${label}`);
    } catch {
        setStatus("Weather fetch failed.");
    }
}

// Current weather UI update

function updateCurrentWeather(label, data) {
    const tempC = data.current_weather.temperature;
    const wind = data.current_weather.windspeed;
    const weatherCode = data.current_weather.weathercode;

    const condition = getWeatherIconAndLabel(weatherCode);

    currentLocationEl.textContent = label;
    currentDescriptionEl.textContent = condition.label;
    weatherIconEl.textContent = condition.icon;

    currentTempEl.textContent = formatTemp(tempC);
    currentFeelsEl.textContent = formatTemp(tempC);

    // Free API doesn't provide humidity
    currentHumidityEl.textContent = "Live";
    currentWindEl.textContent = `${wind} m/s`;

    unitBtn.textContent = currentUnit === "F" ? "°F → °C" : "°C → °F";
}

// 24 hour forecast chart
// This chart shows the temperature for the next 24 hours

function updateForecastChart(data) {
    // Get the drawing context from the canvas

    const ctx = document.getElementById("forecastChart").getContext("2d");
    
    // Get the next 24 temperature values (in Celsius from the API)
    const tempsC = data.hourly.temperature_2m.slice(0, 24);
    
    // Convert to Fahrenheit if needed
     const temps = currentUnit === "F" ? tempsC.map(cToF) : tempsC;
    
    // Convert timestamps into readable hour labels
    const labels = data.hourly.time.slice(0, 24).map(t => {
        const d = new Date(t);
        return d.getHours() + ":00";
    });
    
    // If a chart already exists, destroy it before creating a new one
    if (forecastChart) forecastChart.destroy();
    
    // Create the new 24-hour line chart
    forecastChart = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: `Temperature (°${currentUnit})`,
                data: temps
            }]
        },
        options: {
            responsive: true,           // Allows chart to resize automatically
            maintainAspectRatio: true,  // Keeps consistent proportions
            animation: false            // Disables animation for performance 
        }
    });
}


// Multi-day temperature trends chart

function updateHistoryChart(data) {
    // Get the drawing context from the canvas
    const ctx = document.getElementById("historyChart").getContext("2d");

    // Convert the upcoming dates into readable weekday labels
    const labels = data.daily.time.slice(0, 7).map(t => {
        const d = new Date(t);
        return d.toLocaleDateString(undefined, { weekday: "short" });
    });
     
    // Extract the daily min and max temps   
    let minTemps = data.daily.temperature_2m_min.slice(0, 7);
    let maxTemps = data.daily.temperature_2m_max.slice(0, 7);
    
    // Convert to Fahrenheit if needed
    if (currentUnit === "F") {
        minTemps = minTemps.map(cToF);
        maxTemps = maxTemps.map(cToF);
    }

    // Destroy any existing bar chart before creating a new one
    if (historyChart) historyChart.destroy();
    
    // Create the multi-day bar chart
    historyChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [
                { label: `Min (°${currentUnit})`, data: minTemps },
                { label: `Max (°${currentUnit})`, data: maxTemps }
            ]
        },
        options: {
            responsive: true,           // Automatically resizes on screen changes
            maintainAspectRatio: true,  // Keeps the chart from stretching weirdly
            animation: false            // Disables animation for smoother updates
        }
        }
    });
}


// Initial page state

// Set correct default label for the unit toggle button
unitBtn.textContent = "°F → °C";

// Initial status message before a city is searched
setStatus("Enter a city or use your location to begin. Default unit: °F");
