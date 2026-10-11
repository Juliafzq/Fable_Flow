"""Language row: dropdown like Daily Reset; tapping the row never switches by itself; picking switches; persists; menu size stable."""
import sys, json, time
sys.path.insert(0, '.')
from cdp_helper import CDP
c = CDP(390, 844, port=int(sys.argv[1]))
c.js("""(() => { const a = window.fableFlowApp; document.getElementById('about-modal-overlay').classList.add('hidden');
  a.state.hasCompletedOnboarding = true; a.applyLanguage('en', true); a.saveState(); a.openProfileModal(); })()""")
time.sleep(0.5)
menu = """(() => { const card = document.querySelector('.profile-popover-card').getBoundingClientRect(); const sel = document.getElementById('profile-language-select');
  return { lang: window.fableFlowApp.state.language, selVal: sel && sel.value, isSelect: sel && sel.tagName === 'SELECT',
           opts: sel ? Array.from(sel.options).map(o => o.textContent) : [], w: Math.round(card.width), h: Math.round(card.height),
           selClipped: sel ? sel.scrollWidth > sel.clientWidth + 1 : true, pill: document.getElementById('pill-timer-btn').textContent,
           menuOpen: !document.getElementById('profile-modal-overlay').classList.contains('hidden') }; })()"""
res = {}
s0 = c.js(menu); res['dropdown present (en)'] = s0['isSelect'] and s0['selVal'] == 'en' and s0['opts'] == ['English', '简体中文']
# real tap on the Language row label (not the select) -> must NOT switch
x, y = c.js("(() => { const r = document.querySelector('label[for=\"profile-language-select\"] span').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()")
c.call('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]}); time.sleep(0.05)
c.call('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); time.sleep(0.5)
s1 = c.js(menu); res['tap on row does not switch'] = s1['lang'] == 'en' and s1['pill'] == 'Timer'
# pick 简体中文
c.js("(() => { const s = document.getElementById('profile-language-select'); s.value = 'zh'; s.dispatchEvent(new Event('change', { bubbles: true })); })()"); time.sleep(0.5)
s2 = c.js(menu)
res['picking 简体中文 switches'] = s2['lang'] == 'zh' and s2['pill'] == '番茄' and s2['selVal'] == 'zh'
res['menu size same en/zh'] = (s0['w'], s0['h']) == (s2['w'], s2['h'])
res['select text not clipped'] = not s0['selClipped'] and not s2['selClipped']
# persists across reload
c.call('Page.reload'); time.sleep(3.5)
c.js("(() => { document.getElementById('about-modal-overlay').classList.add('hidden'); window.fableFlowApp.openProfileModal(); })()"); time.sleep(0.4)
s3 = c.js(menu); res['persists after reload'] = s3['lang'] == 'zh' and s3['selVal'] == 'zh' and s3['pill'] == '番茄'
c.shot('lang_dropdown_zh')
c.js("(() => { const s = document.getElementById('profile-language-select'); s.value = 'en'; s.dispatchEvent(new Event('change', { bubbles: true })); })()"); time.sleep(0.4)
s4 = c.js(menu); res['switch back to English'] = s4['lang'] == 'en' and s4['pill'] == 'Timer' and s4['selVal'] == 'en'
for k, v in res.items(): print(('OK   ' if v else 'BAD  ') + k)
print('PASS' if all(res.values()) else 'FAIL')
c.close()
