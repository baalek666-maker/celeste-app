/**
 * VERIFICATION V2 — Après fix de l'ascendant
 * Compare les résultats de Celeste vs Swiss Ephemeris
 */
import {
  AstroTime,
  Body,
  GeoVector,
  SiderealTime,
  EclipticGeoMoon,
  Rotation_EQJ_ECL,
  RotateVector,
} from 'astronomy-engine';

function geoEclipticLongitude(planet, time) {
  if (planet === 'moon') {
    const ecl = EclipticGeoMoon(time);
    return ((ecl.lon % 360) + 360) % 360;
  }
  const bodyMap = {
    sun: Body.Sun, moon: Body.Moon, mercury: Body.Mercury, venus: Body.Venus,
    mars: Body.Mars, jupiter: Body.Jupiter, saturn: Body.Saturn,
    uranus: Body.Uranus, neptune: Body.Neptune, pluto: Body.Pluto,
  };
  const body = bodyMap[planet];
  if (!body) return 0;
  const gv = GeoVector(body, time, true);
  const rot = Rotation_EQJ_ECL();
  const ev = RotateVector(rot, gv);
  let lon = Math.atan2(ev.y, ev.x) * (180 / Math.PI);
  return ((lon % 360) + 360) % 360;
}

// FIXED ascendant calculation
function ascendantDegree(time, latitude, longitude) {
  const gst = SiderealTime(time); // hours (0-24)
  const gstDeg = gst * 15; // convert hours → degrees (1h = 15°)
  const lst = ((gstDeg + longitude) % 360 + 360) % 360;
  const eps = 23.4393 * (Math.PI / 180);
  const latRad = latitude * (Math.PI / 180);
  const lstRad = lst * (Math.PI / 180);
  let asc = Math.atan2(
    -Math.cos(lstRad),
    Math.sin(lstRad) * Math.cos(eps) + Math.tan(latRad) * Math.sin(eps),
  ) * (180 / Math.PI);
  asc = ((asc + 180) % 360 + 360) % 360; // FIXED: +180° flip
  return asc;
}

const ZODIAC_FR = ['Bélier','Taureau','Gémeaux','Cancer','Lion','Vierge','Balance','Scorpion','Sagittaire','Capricorne','Verseau','Poissons'];

function formatDeg(lon) {
  const s = Math.floor(lon / 30);
  const d = lon % 30;
  return `${Math.floor(d)}°${Math.floor((d - Math.floor(d)) * 60).toString().padStart(2,'0')}' ${ZODIAC_FR[s]}`;
}

// Test cases (UT values)
const TEST_CASES = [
  { name: 'Test 1: 01/01/2000 12:00 UT, Paris', date: '2000-01-01T12:00:00Z', lat: 48.8566, lng: 2.3522,
    se_ref: { sun:280.37, moon:223.32, mercury:271.89, venus:241.57, mars:327.96, jupiter:25.25, saturn:40.40, uranus:314.81, neptune:303.19, pluto:251.45, asc:26.77 } },
  { name: 'Test 2: 15/06/1985 08:30 UT, Lyon', date: '1985-06-15T08:30:00Z', lat: 45.764, lng: 4.8357,
    se_ref: { sun:84.18, moon:48.90, mercury:93.53, venus:38.46, mars:93.93, jupiter:316.79, saturn:232.72, uranus:255.64, neptune:272.47, pluto:212.12, asc:139.45 } },
  { name: 'Test 3: 22/12/1990 23:00 UT, New York', date: '1990-12-22T23:00:00Z', lat: 40.7128, lng: -74.006,
    se_ref: { sun:270.84, moon:334.82, mercury:274.08, venus:283.38, mars:58.37, jupiter:132.75, saturn:294.63, uranus:279.19, neptune:283.78, pluto:229.31, asc:110.72 } },
];

let allPassed = true;
let total = 0, passed = 0;

for (const tc of TEST_CASES) {
  const time = new AstroTime(new Date(tc.date));
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  ${tc.name}`);
  console.log(`${'='.repeat(70)}`);
  
  const planets = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto'];
  
  for (const p of planets) {
    const lon = geoEclipticLongitude(p, time);
    const ref = tc.se_ref[p];
    let diff = Math.abs(lon - ref);
    if (diff > 180) diff = 360 - diff;
    const tol = p === 'moon' ? 1.0 : 0.5;
    const ok = diff <= tol;
    total++; if (ok) passed++; if (!ok) allPassed = false;
    console.log(`  ${ok?'✅':'❌'} ${p.padEnd(8)} Celeste=${formatDeg(lon)} (${lon.toFixed(2)}°) | Swiss=${ref.toFixed(2)}° | Δ=${diff.toFixed(2)}°`);
  }
  
  // Ascendant with FIX
  const asc = ascendantDegree(time, tc.lat, tc.lng);
  const refAsc = tc.se_ref.asc;
  let diffAsc = Math.abs(asc - refAsc);
  if (diffAsc > 180) diffAsc = 360 - diffAsc;
  const okAsc = diffAsc <= 1.0;
  total++; if (okAsc) passed++; if (!okAsc) allPassed = false;
  console.log(`  ${okAsc?'✅':'❌'} asc      Celeste=${formatDeg(asc)} (${asc.toFixed(2)}°) | Swiss=${refAsc.toFixed(2)}° | Δ=${diffAsc.toFixed(2)}°`);
}

console.log(`\n${'='.repeat(70)}`);
console.log(`  RÉSULTAT FINAL: ${passed}/${total}`);
console.log(allPassed ? '  ✅ TOUT CORRECT — astronomy-engine = Swiss Ephemeris' : '  ❌ ERREURS RESTANTES');
console.log(`${'='.repeat(70)}`);
