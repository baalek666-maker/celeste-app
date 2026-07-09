"""
SWISS EPHEMERIS REFERENCE CALCULATION
Computes true positions for the same 3 test cases using Swiss Ephemeris,
the exact same engine astro.com uses.
"""
import swisseph as swe

# Set ephemeris path (use built-in data)
swe.set_ephe_path()

# Planet constants in Swiss Ephemeris
PLANETS = {
    'sun': swe.SUN,
    'moon': swe.MOON,
    'mercury': swe.MERCURY,
    'venus': swe.VENUS,
    'mars': swe.MARS,
    'jupiter': swe.JUPITER,
    'saturn': swe.SATURN,
    'uranus': swe.URANUS,
    'neptune': swe.NEPTUNE,
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

TEST_CASES = [
    {
        'label': 'Test 1: 1er Janvier 2000, 13:00 CET (12:00 UT), Paris',
        'year': 2000, 'month': 1, 'day': 1,
        'hour': 12.0,  # UT
        'lat': 48.8566, 'lng': 2.3522,
    },
    {
        'label': 'Test 2: 15 Juin 1985, 10:30 CEST (08:30 UT), Lyon',
        'year': 1985, 'month': 6, 'day': 15,
        'hour': 8.5,  # UT
        'lat': 45.764, 'lng': 4.8357,
    },
    {
        'label': 'Test 3: 22 Décembre 1990, 18:00 EST (23:00 UT), New York',
        'year': 1990, 'month': 12, 'day': 22,
        'hour': 23.0,  # UT
        'lat': 40.7128, 'lng': -74.006,
    },
]

for tc in TEST_CASES:
    print(f"\n{'='*60}")
    print(tc['label'])
    print(f"  UT: {tc['year']}-{tc['month']:02d}-{tc['day']:02d} {tc['hour']:05.2f}h")
    print(f"  Location: lat={tc['lat']}, lng={tc['lng']}")
    print(f"{'='*60}")
    
    # Calculate Julian Day
    jd = swe.julday(tc['year'], tc['month'], tc['day'], tc['hour'])
    
    for name, pid in PLANETS.items():
        # pyswisseph returns ((lon, lat, dist, lon_speed, lat_speed, dist_speed), status)
        flags = swe.FLG_SWIEPH | swe.FLG_SPEED
        data, status = swe.calc_ut(jd, pid, flags)
        lon = data[0]
        speed = data[3]
        retrograde = speed < 0
        
        ret_str = ' ℞' if retrograde else ''
        print(f"  {name:8s} {format_lon(lon):20s} ({lon:8.4f}°){ret_str}")
    
    # Ascendant
    # swe.houses returns (cusps, ascmc) where ascmc[0] = Ascendant
    cusps, ascmc = swe.houses(jd, tc['lat'], tc['lng'], b'W')  # Whole sign
    asc = ascmc[0]
    print(f"  {'asc':8s} {format_lon(asc):20s} ({asc:8.4f}°)")
    print()

print("\n✅ Swiss Ephemeris reference computed successfully.")
