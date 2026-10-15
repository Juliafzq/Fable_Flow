#!/usr/bin/env python3
"""One-shot setup for UNTO / FLOW cloud services.

  1. Email delivery from untoworld.com: Resend domain + Cloudflare DNS records (DKIM, SPF/bounce MX,
     DMARC) + verification + a sending-only API key.
  2. Supabase Auth: custom SMTP (Resend), sender "UNTO / FLOW" <flow@untoworld.com>, email rate limit,
     site URL + redirect allow-list (web app and the iPhone app's untoflow://auth-callback),
     reset-email subject, and Google sign-in (if credentials are given).
  3. Optional: sends a real password-reset email to TEST_EMAIL to prove delivery.

Inputs (environment variables). Each step runs only if its inputs are present; safe to re-run.
  SUPABASE_ACCESS_TOKEN   Supabase personal access token (sbp_...)      -> revoke after
  RESEND_API_KEY          Resend API key with *Full access* (re_...)    -> revoke after
  CLOUDFLARE_API_TOKEN    Cloudflare token: Zone > DNS > Edit, zone untoworld.com -> revoke after
  GOOGLE_CLIENT_ID        Google OAuth web client ID (...apps.googleusercontent.com)
  GOOGLE_CLIENT_SECRET    Google OAuth web client secret (GOCSPX-...)
  TEST_EMAIL              optional: an existing account email to send a test reset email to
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

PROJECT_REF = 'hnuzvsdxrtcuylfvoftn'
SUPABASE_URL = f'https://{PROJECT_REF}.supabase.co'
ANON_KEY = ('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhudXp2c2R4cnRjdXlsZnZvZnRuIiwi'
            'cm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNzIyMzMsImV4cCI6MjEwNzY0ODIzM30.i_UeE3WGSG_xboeUA0zYWZBy3HCQ8qO2oOkCusk780c')
DOMAIN = 'untoworld.com'
SENDER = 'flow@untoworld.com'
SENDER_NAME = 'UNTO / FLOW'
SITE_URL = 'https://juliafzq.github.io/UNTO_FLOW/'
REDIRECTS = ['https://juliafzq.github.io/UNTO_FLOW/**', 'untoflow://auth-callback']

env = lambda k: (os.environ.get(k) or '').strip()


def http(method, url, token=None, body=None, headers=None):
  h = {'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'untoflow-setup/1.0'}
  if token:
    h['Authorization'] = f'Bearer {token}'
  h.update(headers or {})
  data = json.dumps(body).encode() if body is not None else None
  req = urllib.request.Request(url, data=data, method=method, headers=h)
  try:
    with urllib.request.urlopen(req, timeout=40) as r:
      raw = r.read().decode()
      return r.status, (json.loads(raw) if raw else {})
  except urllib.error.HTTPError as e:
    raw = e.read().decode(errors='replace')
    try:
      return e.code, json.loads(raw)
    except Exception:
      return e.code, {'raw': raw}


def step(msg):
  print(f'\n== {msg}')


def fail(msg):
  print(f'   !! {msg}')
  sys.exit(1)


def setup_email():
  resend, cf = env('RESEND_API_KEY'), env('CLOUDFLARE_API_TOKEN')
  if not (resend and cf):
    print('   (skipping email domain: RESEND_API_KEY and CLOUDFLARE_API_TOKEN not both set)')
    return None

  step(f'Resend: domain {DOMAIN}')
  st, res = http('GET', 'https://api.resend.com/domains', resend)
  if st != 200:
    fail(f'Resend API {st}: {res}  (the key needs Full access)')
  dom = next((d for d in res.get('data', []) if d.get('name') == DOMAIN), None)
  if not dom:
    st, dom = http('POST', 'https://api.resend.com/domains', resend, {'name': DOMAIN, 'region': 'us-east-1'})
    if st not in (200, 201):
      fail(f'could not add domain: {st} {dom}')
    print('   added domain')
  dom_id = dom['id']
  st, dom = http('GET', f'https://api.resend.com/domains/{dom_id}', resend)
  records = dom.get('records', [])
  print(f'   status: {dom.get("status")}, {len(records)} DNS records required')

  step('Cloudflare: DNS records')
  st, z = http('GET', f'https://api.cloudflare.com/client/v4/zones?name={DOMAIN}', cf)
  if st != 200 or not z.get('result'):
    fail(f'Cloudflare zone lookup failed: {st} {z}')
  zone = z['result'][0]['id']
  st, existing = http('GET', f'https://api.cloudflare.com/client/v4/zones/{zone}/dns_records?per_page=500', cf)
  have = existing.get('result', [])

  def fqdn(name):
    name = (name or '@').rstrip('.')
    if name in ('@', DOMAIN):
      return DOMAIN
    return name if name.endswith('.' + DOMAIN) else f'{name}.{DOMAIN}'

  wanted = [{'type': r['type'], 'name': fqdn(r['name']), 'content': r['value'],
             'priority': r.get('priority')} for r in records]
  if not any(x['name'] == f'_dmarc.{DOMAIN}' and x['type'] == 'TXT' for x in have):
    wanted.append({'type': 'TXT', 'name': f'_dmarc.{DOMAIN}', 'content': 'v=DMARC1; p=none;', 'priority': None})

  norm = lambda v: str(v or '').strip().strip('"').rstrip('.').lower()
  for w in wanted:
    if any(x['type'] == w['type'] and x['name'] == w['name'] and norm(x['content']) == norm(w['content']) for x in have):
      print(f'   ok      {w["type"]:<4} {w["name"]}')
      continue
    if w['type'] == 'TXT' and w['content'].startswith('v=spf1') and any(
        x['type'] == 'TXT' and x['name'] == w['name'] and norm(x['content']).startswith('v=spf1') for x in have):
      fail(f'{w["name"]} already has a different SPF record; merge it by hand: {w["content"]}')
    rec = {'type': w['type'], 'name': w['name'], 'content': w['content'], 'ttl': 1, 'proxied': False}
    if w['type'] == 'MX':
      rec['priority'] = int(w['priority'] or 10)
    st, r = http('POST', f'https://api.cloudflare.com/client/v4/zones/{zone}/dns_records', cf, rec)
    if st not in (200, 201) or not r.get('success'):
      fail(f'could not add {w["type"]} {w["name"]}: {st} {r}')
    print(f'   added   {w["type"]:<4} {w["name"]}')

  step('Resend: verify domain (DNS can take a few minutes)')
  http('POST', f'https://api.resend.com/domains/{dom_id}/verify', resend)
  for i in range(40):
    st, dom = http('GET', f'https://api.resend.com/domains/{dom_id}', resend)
    status = dom.get('status')
    if status == 'verified':
      print('   verified')
      break
    if i % 4 == 0:
      print(f'   status: {status} (waiting)')
    time.sleep(15)
  else:
    fail('domain not verified yet; DNS may still be spreading. Re-run this script in 10 minutes.')

  step('Resend: sending-only API key for Supabase')
  st, k = http('POST', 'https://api.resend.com/api-keys', resend,
               {'name': 'Supabase SMTP (UNTO / FLOW)', 'permission': 'sending_access', 'domain_id': dom_id})
  if st not in (200, 201) or 'token' not in k:
    fail(f'could not create sending key: {st} {k}')
  print('   created')
  return k['token']


def setup_supabase(smtp_pass):
  pat = env('SUPABASE_ACCESS_TOKEN')
  if not pat:
    print('   (skipping Supabase: SUPABASE_ACCESS_TOKEN not set)')
    return
  step('Supabase Auth settings')
  patch = {
      'site_url': SITE_URL,
      'uri_allow_list': ','.join(REDIRECTS),
      'mailer_autoconfirm': True,
      'mailer_subjects_recovery': 'Reset your UNTO / FLOW password',
  }
  if smtp_pass:
    patch.update({
        'smtp_admin_email': SENDER,
        'smtp_sender_name': SENDER_NAME,
        'smtp_host': 'smtp.resend.com',
        'smtp_port': '465',
        'smtp_user': 'resend',
        'smtp_pass': smtp_pass,
        'smtp_max_frequency': 60,
        'rate_limit_email_sent': 30,
    })
  gid, gsecret = env('GOOGLE_CLIENT_ID'), env('GOOGLE_CLIENT_SECRET')
  if gid and gsecret:
    patch.update({'external_google_enabled': True, 'external_google_client_id': gid, 'external_google_secret': gsecret})
  st, r = http('PATCH', f'https://api.supabase.com/v1/projects/{PROJECT_REF}/config/auth', pat, patch)
  if st == 400 and 'smtp_port' in json.dumps(r) and 'smtp_port' in patch:
    patch['smtp_port'] = 465  # some API versions want a number
    st, r = http('PATCH', f'https://api.supabase.com/v1/projects/{PROJECT_REF}/config/auth', pat, patch)
  if st not in (200, 201):
    fail(f'Supabase config update failed: {st} {r}')
  shown = {k: ('***' if k in ('smtp_pass', 'external_google_secret') else v) for k, v in patch.items()}
  print('   updated:', json.dumps(shown, indent=2))

  st, s = http('GET', f'{SUPABASE_URL}/auth/v1/settings', headers={'apikey': ANON_KEY})
  print('   live check -> google sign-in on:', s.get('external', {}).get('google'), '| autoconfirm:', s.get('mailer_autoconfirm'))


def send_test_reset():
  email = env('TEST_EMAIL')
  if not email:
    return
  step(f'Test: password reset email to {email}')
  st, r = http('POST', f'{SUPABASE_URL}/auth/v1/recover?redirect_to={SITE_URL}', body={'email': email},
               headers={'apikey': ANON_KEY})
  print('   sent' if st == 200 else f'   failed: {st} {r}')


if __name__ == '__main__':
  key = setup_email()
  setup_supabase(key)
  send_test_reset()
  print('\nDone. Revoke the Supabase token, the Resend full-access key and the Cloudflare token now.')
