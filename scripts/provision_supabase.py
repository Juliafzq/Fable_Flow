#!/usr/bin/env python3
"""Automated Supabase Cloud Provisioner for Fable / Flow.

Usage:
  # Mode 1: Full auto-provisioning via Supabase Personal Access Token (sbp_...)
  python3 scripts/provision_supabase.py --token sbp_YOUR_TOKEN

  # Mode 2: Bake existing Project URL + Anon Key directly into js/supabaseSync.js
  python3 scripts/provision_supabase.py --url https://xyz.supabase.co --anon-key eyJ...
"""

import argparse
import json
import pathlib
import re
import secrets
import sys
import time
import urllib.error
import urllib.request

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
SCHEMA_PATH = REPO_ROOT / "supabase" / "schema.sql"
SYNC_JS_PATHS = [
    REPO_ROOT / "js" / "supabaseSync.js",
    REPO_ROOT / "Project Focus Beta" / "js" / "supabaseSync.js",
]
API_BASE = "https://api.supabase.com/v1"


def api_request(method: str, path: str, token: str, payload=None):
  url = f"{API_BASE}{path}"
  data = json.dumps(payload).encode("utf-8") if payload is not None else None
  req = urllib.request.Request(
      url,
      data=data,
      method=method,
      headers={
          "Authorization": f"Bearer {token}",
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "FableFlowProvisioner/1.0",
      },
  )
  try:
    with urllib.request.urlopen(req, timeout=30) as resp:
      raw = resp.read().decode("utf-8")
      return json.loads(raw) if raw else {}
  except urllib.error.HTTPError as e:
    err_body = e.read().decode("utf-8", errors="replace")
    raise RuntimeError(f"Supabase API {method} {path} failed ({e.code}): {err_body}") from e


def update_default_config_in_js(project_url: str, anon_key: str):
  clean_url = project_url.strip().rstrip("/")
  clean_key = anon_key.strip()
  pattern = re.compile(
      r"export const DEFAULT_SUPABASE_CONFIG = \{\s*url:\s*'[^']*',\s*anonKey:\s*'[^']*',\s*\};",
      re.MULTILINE,
  )
  replacement = (
      "export const DEFAULT_SUPABASE_CONFIG = {\n"
      f"  url: '{clean_url}',\n"
      f"  anonKey: '{clean_key}',\n"
      "};"
  )
  for path in SYNC_JS_PATHS:
    if path.exists():
      content = path.read_text(encoding="utf-8")
      updated, count = pattern.subn(replacement, content, count=1)
      if count == 0:
        raise RuntimeError(f"Could not find DEFAULT_SUPABASE_CONFIG in {path}")
      path.write_text(updated, encoding="utf-8")
      print(f"[✓] Updated DEFAULT_SUPABASE_CONFIG in {path.relative_to(REPO_ROOT)}")


def provision_with_token(args):
  token = args.token.strip()
  print("[1/5] Checking Supabase organizations & projects...")
  projects = api_request("GET", "/projects", token)
  target = None
  for p in projects:
    if p.get("name", "").lower() in ("fable_flow", "fable-flow", "fable / flow", "projectfocus"):
      target = p
      break

  if not target:
    orgs = api_request("GET", "/organizations", token)
    if not orgs:
      raise RuntimeError("No Supabase organization found on this account.")
    org_id = orgs[0]["id"]
    db_pass = f"Ff!{secrets.token_urlsafe(16)}9a"
    print(f"[2/5] Creating Free Tier project 'Fable_Flow' in org {org_id}...")
    target = api_request(
        "POST",
        "/projects",
        token,
        {
            "name": "Fable_Flow",
            "organization_id": org_id,
            "db_pass": db_pass,
            "region": args.region,
            "plan": "free",
        },
    )
  else:
    print(f"[2/5] Found existing project '{target['name']}' (ref: {target['id']})")

  ref = target["id"]
  for _ in range(45):
    proj_info = api_request("GET", f"/projects/{ref}", token)
    status = proj_info.get("status", "")
    if status == "ACTIVE_HEALTHY":
      break
    print(f"      Waiting for database to become ACTIVE_HEALTHY (current: {status})...")
    time.sleep(4)

  print("[3/5] Applying supabase/schema.sql (fable_flow_user_state & RLS policies)...")
  sql = SCHEMA_PATH.read_text(encoding="utf-8")
  api_request("POST", f"/projects/{ref}/database/query", token, {"query": sql})

  print("[4/5] Configuring Supabase Auth URLs, auto-confirm & OAuth providers...")
  auth_patch = {
      "site_url": "https://juliafzq.github.io/Fable_Flow/",
      "uri_allow_list": "https://juliafzq.github.io/Fable_Flow/**,http://localhost:8090/**",
      "mailer_autoconfirm": True,
  }
  if args.google_client_id and args.google_secret:
    auth_patch["external_google_enabled"] = True
    auth_patch["external_google_client_id"] = args.google_client_id
    auth_patch["external_google_secret"] = args.google_secret
  if args.apple_client_id and args.apple_secret:
    auth_patch["external_apple_enabled"] = True
    auth_patch["external_apple_client_id"] = args.apple_client_id
    auth_patch["external_apple_secret"] = args.apple_secret
  api_request("PATCH", f"/projects/{ref}/config/auth", token, auth_patch)

  print("[5/5] Fetching project API keys & updating js/supabaseSync.js...")
  keys = api_request("GET", f"/projects/{ref}/api-keys", token)
  anon_key = next((k["api_key"] for k in keys if k.get("name") == "anon"), None)
  if not anon_key:
    raise RuntimeError("Could not find 'anon' API key for project.")
  project_url = f"https://{ref}.supabase.co"
  update_default_config_in_js(project_url, anon_key)
  print(f"\n[DONE] Fable_Flow is now connected to {project_url}!")


def main():
  parser = argparse.ArgumentParser(description="Provision Supabase Cloud for Fable / Flow")
  parser.add_argument("--token", help="Supabase Personal Access Token (sbp_...)")
  parser.add_argument("--region", default="us-east-1", help="AWS region for new Supabase project")
  parser.add_argument("--url", help="Existing Supabase Project URL (https://<ref>.supabase.co)")
  parser.add_argument("--anon-key", help="Existing Supabase Anon Public Key")
  parser.add_argument("--google-client-id", help="Optional Google OAuth Client ID")
  parser.add_argument("--google-secret", help="Optional Google OAuth Client Secret")
  parser.add_argument("--apple-client-id", help="Optional Apple OAuth Services ID")
  parser.add_argument("--apple-secret", help="Optional Apple OAuth Secret Key")
  args = parser.parse_args()

  if args.token:
    provision_with_token(args)
  elif args.url and args.anon_key:
    update_default_config_in_js(args.url, args.anon_key)
    print(f"[DONE] Baked {args.url} into js/supabaseSync.js!")
  else:
    parser.error("Provide either --token sbp_... OR both --url and --anon-key.")


if __name__ == "__main__":
  main()
