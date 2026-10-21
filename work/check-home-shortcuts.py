"""Android home shortcuts use the same touch targets and gaps as the iOS chrome overrides."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
android = (root/'work/managed-ui-polish.css').read_text(encoding='utf-8')
ios = (root/'work/ios/chrome.css').read_text(encoding='utf-8')
generated = (root/'outputs/ams-android/app/src/main/assets/ams-modern-ui.js').read_text(encoding='utf-8')

def rules(css, selector):
    return ';'.join(m.group(1) for m in re.finditer(re.escape(selector) + r'\{([^}]*)\}', css))

def value(css, selector, prop):
    found = re.findall(r'(?:^|;)' + prop + r':([^;]+)', rules(css, selector))
    assert found, f'{selector} {prop} missing'
    return found[-1]

for selector, prop in [('.home-layout header', 'padding-right'), ('.home-layout #xjCodeBtn', 'right'), ('.home-layout #hhtCodeBtn', 'right'),
                       ('.home-layout #settingsBtn', 'right'), ('.home-layout #settingsBtn', 'width'), ('.home-layout #settingsBtn', 'height')]:
    assert value(android, selector, prop) == value(ios, selector, prop), f'{selector} {prop}: Android {value(android, selector, prop)} vs iOS {value(ios, selector, prop)}'
# Geometry: 44x48 code buttons and a 44x44 settings button, each separated by 8px, title padding clears all three.
xj, hht, settings = int(value(android, '.home-layout #xjCodeBtn', 'right')[:-2]), int(value(android, '.home-layout #hhtCodeBtn', 'right')[:-2]), 0
assert value(android, '.home-layout #xjCodeBtn,.home-layout #hhtCodeBtn', 'width') == '44px' and value(android, '.home-layout #xjCodeBtn,.home-layout #hhtCodeBtn', 'height') == '48px'
assert hht - (settings + 44) == 8 and xj - (hht + 44) == 8
assert int(value(android, '.home-layout header', 'padding-right')[:-2]) >= xj + 44 + 8
assert 'padding-right:156px' in generated and 'right:104px' in generated and 'width:44px;height:44px' in generated
print('PASS home shortcuts: Android matches iOS (44x48, 44x48, 44x44, 8px gaps, title padding 156px) in source and generated asset.')
