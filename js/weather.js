/* ============================================================
   Mars Jarvis — weather.js
   Uses Open-Meteo (open-meteo.com) — free, no API key required.
   Location comes from the browser's Geolocation API.
   ============================================================ */

const JarvisWeather = (() => {

  const CODE_DE = {
    0: 'klarer Himmel', 1: 'überwiegend klar', 2: 'teilweise bewölkt', 3: 'bedeckt',
    45: 'neblig', 48: 'gefrierender Nebel',
    51: 'leichter Nieselregen', 53: 'mäßiger Nieselregen', 55: 'starker Nieselregen',
    61: 'leichter Regen', 63: 'mäßiger Regen', 65: 'starker Regen',
    71: 'leichter Schneefall', 73: 'mäßiger Schneefall', 75: 'starker Schneefall',
    80: 'Regenschauer', 81: 'kräftige Regenschauer', 82: 'heftige Regenschauer',
    95: 'Gewitter', 96: 'Gewitter mit Hagel', 99: 'schweres Gewitter mit Hagel'
  };

  function getPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Standortzugriff wird von diesem Browser nicht unterstützt.'));
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => reject(new Error('Standortzugriff wurde nicht erlaubt.')),
        { timeout: 8000 }
      );
    });
  }

  async function getCurrent() {
    const { lat, lon } = await getPosition();
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Wetterdaten konnten nicht geladen werden.');
    const data = await res.json();

    const nowTemp = Math.round(data.current.temperature_2m);
    const code = data.current.weather_code;
    const desc = CODE_DE[code] || 'wechselhaft';
    const max = Math.round(data.daily.temperature_2m_max[0]);
    const min = Math.round(data.daily.temperature_2m_min[0]);

    return {
      text: `Aktuell ${nowTemp} Grad, ${desc}. Heute liegt die Höchsttemperatur bei ${max} Grad, das Minimum bei ${min} Grad.`,
      nowTemp, desc, max, min
    };
  }

  return { getCurrent };
})();
