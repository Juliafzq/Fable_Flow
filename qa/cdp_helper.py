"""Minimal CDP helper + zh overflow audit for Fable / Flow (no external deps)."""
import base64, json, os, socket, struct, subprocess, sys, time, urllib.request
from urllib.parse import urlparse

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shots')
os.makedirs(OUT, exist_ok=True)


class CDP:
    def __init__(self, width, height, port=9233, url='http://127.0.0.1:8091/'):
        self.proc = subprocess.Popen([
            'google-chrome', '--headless=new', '--disable-gpu', '--no-sandbox',
            f'--remote-debugging-port={port}', f'--window-size={width},{height}',
            '--user-data-dir=/tmp/zh_audit_profile_%d_%d_%d' % (width, port, int(time.time())), 'about:blank'],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        tabs = None
        for _ in range(100):
            time.sleep(0.3)
            try:
                tabs = json.loads(urllib.request.urlopen(f'http://127.0.0.1:{port}/json').read()); break
            except Exception:
                pass
        ws = [t['webSocketDebuggerUrl'] for t in tabs if t.get('type') == 'page'][0]
        u = urlparse(ws)
        self.sock = socket.create_connection((u.hostname, u.port))
        key = base64.b64encode(b'abcdefghijklmnop').decode()
        self.sock.sendall((f'GET {u.path} HTTP/1.1\r\nHost: {u.netloc}\r\nUpgrade: websocket\r\n'
                           f'Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
        buf = b''
        while b'\r\n\r\n' not in buf:
            buf += self.sock.recv(1024)
        self.mid = 0
        self.call('Emulation.setDeviceMetricsOverride', {
            'width': width, 'height': height, 'deviceScaleFactor': 2, 'mobile': True})
        self.call('Page.enable')
        self.call('Emulation.setFocusEmulationEnabled', {'enabled': True})
        self.call('Page.navigate', {'url': url})
        time.sleep(4.0)

    def _send(self, obj):
        payload = json.dumps(obj).encode()
        hdr = bytearray([0x81]); n = len(payload); mask = b'\x01\x02\x03\x04'
        if n < 126: hdr.append(0x80 | n)
        elif n < 65536: hdr.append(0x80 | 126); hdr += struct.pack('!H', n)
        else: hdr.append(0x80 | 127); hdr += struct.pack('!Q', n)
        hdr += mask
        self.sock.sendall(bytes(hdr) + bytes(b ^ mask[i % 4] for i, b in enumerate(payload)))

    def _recvall(self, n):
        d = b''
        while len(d) < n:
            d += self.sock.recv(n - len(d))
        return d

    def _recv(self):
        b1, b2 = self._recvall(2); ln = b2 & 0x7f
        if ln == 126: ln = struct.unpack('!H', self._recvall(2))[0]
        elif ln == 127: ln = struct.unpack('!Q', self._recvall(8))[0]
        return json.loads(self._recvall(ln).decode())

    def call(self, method, params=None):
        self.mid += 1; my = self.mid
        self._send({'id': my, 'method': method, 'params': params or {}})
        while True:
            r = self._recv()
            if r.get('id') == my:
                return r

    def js(self, expr):
        r = self.call('Runtime.evaluate', {'expression': expr, 'returnByValue': True, 'awaitPromise': True})
        res = r.get('result', {})
        if 'exceptionDetails' in res:
            raise RuntimeError(json.dumps(res['exceptionDetails'])[:800])
        return res.get('result', {}).get('value')

    def shot(self, name):
        r = self.call('Page.captureScreenshot', {'format': 'png'})
        with open(f'{OUT}/{name}.png', 'wb') as f:
            f.write(base64.b64decode(r['result']['data']))

    def close(self):
        self.proc.terminate()
        try:
            self.proc.wait(timeout=10)
        except Exception:
            self.proc.kill()


OVERFLOW_JS = r"""
(() => {
  const vp = document.getElementById('app-viewport').getBoundingClientRect();
  const issues = [];
  const isVisible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
    if (el.closest('.hidden')) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  document.querySelectorAll('#app-viewport *').forEach((el) => {
    if (el.closest('svg, canvas, script, style, .stack-date-strip, .calendar-months-container, .stack-outgoing-card-clone, .stack-peek-card')) return;
    const ownText = Array.from(el.childNodes).filter(n => n.nodeType === 3).map(n => n.nodeValue.trim()).join('');
    const isField = (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.placeholder && !el.value;
    if (!ownText && !isField) return;
    if (!isVisible(el)) return;
    const r = el.getBoundingClientRect();
    const label = (ownText || ('[placeholder] ' + el.placeholder)).slice(0, 60);
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
      issues.push({ kind: 'scroll-x', label, sw: el.scrollWidth, cw: el.clientWidth, cls: el.className });
    }
    if (isField) {
      const ctx = document.createElement('canvas').getContext('2d');
      const cs = getComputedStyle(el); ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const w = ctx.measureText(el.placeholder).width;
      const avail = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      if (el.tagName === 'INPUT' && w > avail + 1) issues.push({ kind: 'placeholder-clipped', label, w: Math.round(w), avail: Math.round(avail) });
    }
    if (r.right > vp.right + 1 || r.left < vp.left - 1) {
      issues.push({ kind: 'outside-viewport', label, left: Math.round(r.left), right: Math.round(r.right), cls: el.className });
    }
    // clipped by an overflow:hidden ancestor
    let a = el.parentElement;
    while (a && a.id !== 'app-viewport') {
      const cs = getComputedStyle(a);
      if (cs.overflowX === 'hidden' || cs.overflow === 'hidden') {
        const ar = a.getBoundingClientRect();
        if (r.right > ar.right + 2 || r.left < ar.left - 2) {
          issues.push({ kind: 'clipped-by-ancestor', label, cls: el.className, anc: a.className });
        }
        break;
      }
      a = a.parentElement;
    }
  });
  return issues;
})()
"""
