"""
COMPREHENSIVE COMPARISON: Celeste (astronomy-engine) vs Swiss Ephemeris
"""
import swisseph as swe
import subprocess
import json

swe.set_ephe_path()

PLANETS = {
    'sun': swe.SUN, 'moon': swe.MOON, 'mercury': swe.MERCURY,
    'venus': swe.VENUS, 'mars': swe.MARS, 'jupiter': swe.JUPITER,
    'saturn': swe.SATURN, 'uranus': swe.URANUS, 'neptune': swe.NEPTUNE,
    'pluto': swe.PLUTO,
}

ZODIAC = ['Bélier','Taureau','Gémeaux','Cancer','Lion','Vierge',
          'Balance','Scorpion','Sagittaire','Capricorne','Verseau','Poissons']

def format_lon(lon):
    sign = int(lon // 30)
    deg_in = lon % 30
    d = int(deg_in)
    m = int((deg_in - d) * 60)
    return f"{d}°{m:02d}' {ZODIAC[sign]}"

# Celeste results from test-astro.js (already computed)
CELESTE_RESULTS = {
    'Test 1': {
        'sun': 280.33, 'moon': 222.82, 'mercury': 271.83, 'venus': 241.52,
        'mars': 327.94, 'jupiter': 25.26, 'saturn': 40.40, 'uranus': 314.81,
        'neptune': 303.20, 'pluto': 251.46, 'asc': 329.32,
    },
    'Test 2': {
        'sun': 84.31, 'moon': 47.90, 'mercury': 93.57, 'venus': 38.58,
        'mars': 94.08, 'jupiter': 317.00, 'saturn': 232.93, 'uranus': 255.85,
        'neptune': 272.67, 'pluto': 212.33, 'asc': 296.03,
    },
    'Test 3': {
        'sun': 270.92, 'moon': 334.29, 'mercury': 274.26, 'venus': 283.45,
        'mars': 58.50, 'jupiter': 132.88, 'saturn': 294.75, 'uranus': 279.31,
        'neptune': 283.90, 'pluto': 229.44, 'asc': 237.45,
    },
}

TEST_CASES = [
    {'name': 'Test 1', 'y': 2000, 'm': 1, 'd': 1, 'h': 12.0, 'lat': 48.8566, 'lng': 2.3522},
    {'name': 'Test 2', 'y': 1985, 'm': 6, 'd': 15, 'h': 8.5, 'lat': 45.764, 'lng': 4.8357},
    {'name': 'Test 3', 'y': 1990, 'm': 12, 'd': 22, 'h': 23.0, 'lat': 40.7128, 'lng': -74.006},
]

all_passed = True
total = 0
passed = 0

for tc in TEST_CASES:
    name = tc['name']
    print(f"\n{'='*70}")
    print(f"  {name}")
    print(f"{'='*70}")
    print(f"  {'Planet':10s} | {'Celeste':>12s} | {'Swiss Ephem':>12s} | {'Δ':>8s} | {'Stat':>4s}")
    print(f"  {'-'*10}-+-{'-'*12}-+-{'-'*12}-+-{'-'*8}-+-{'-'*4}")
    
    jd = swe.julday(tc['y'], tc['m'], tc['d'], tc['h'])
    
    for pname, pid in PLANETS.items():
        data, _ = swe.calc_ut(jd, pid, swe.FLG_SWIEPH | swe.FLG_SPEED)
        se_lon = data[0]
        ce_lon = CELESTE_RESULTS[name][pname]
        
        diff = abs(se_lon - ce_lon)
        if diff > 180: diff = 360 - diff
        
        tolerance = 1.0 if pname == 'moon' else 0.5
        ok = diff <= tolerance
        status = '✅' if ok else '❌'
        
        total += 1
        if ok: passed += 1
        if not ok: all_passed = False
        
        print(f"  {pname:10s} | {ce_lon:>9.2f}°  | {se_lon:>9.2f}°  | {diff:>5.2f}° | {status}")
    
    # Ascendant comparison
    cusps, ascmc = swe.houses(jd, tc['lat'], tc['lng'], b'E')  # Equal house
    se_asc = ascmc[0]
    ce_asc = CELESTE_RESULTS[name]['asc']
    
    diff_asc = abs(se_asc - ce_asc)
    if diff_asc > 180: diff_asc = 360 - diff_asc
    
    ok = diff_asc <= 1.0
    status = '✅' if ok else '❌'
    total += 1
    if ok: passed += 1
    if not ok: all_passed = False
    
    print(f"  {'asc':10s} | {ce_asc:>9.2f}°  | {se_asc:>9.2f}°  | {diff_asc:>5.2f}° | {status}  ← {'OK' if ok else 'BUG!'}")

print(f"\n{'='*70}")
print(f"  RÉSULTAT: {passed}/{total} vérifications passées")
if all_passed:
    print(f"  ✅ TOUT EST CORRECT — astronomy-engine = Swiss Ephemeris")
else:
    print(f"  ❌ DES ERREURS ONT ÉTÉ DÉTECTÉES — voir ci-dessus")
print(f"{'='*70}")
