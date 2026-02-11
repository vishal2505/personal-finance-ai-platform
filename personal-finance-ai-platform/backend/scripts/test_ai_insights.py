"""
Call the AI insights endpoint. Requires backend running (e.g. uvicorn on port 8000)
and OPENAI_API_KEY in backend/.env.

Usage (from repo root, with venv activated):
  python backend/scripts/test_ai_insights.py
  python backend/scripts/test_ai_insights.py --user other@example.com --password otherpass
"""
import argparse
import json
import urllib.error
import urllib.parse
import urllib.request

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://localhost:8000", help="API base URL")
    parser.add_argument("--user", default="test@example.com", help="Login email")
    parser.add_argument("--password", default="test123", help="Login password")
    parser.add_argument("--months", type=int, default=3, help="Months of data for insights")
    args = parser.parse_args()

    base = args.base.rstrip("/")
    data = f"username={urllib.parse.quote(args.user)}&password={urllib.parse.quote(args.password)}".encode()

    try:
        req = urllib.request.Request(
            f"{base}/api/auth/login",
            data=data,
            method="POST",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        with urllib.request.urlopen(req, timeout=15) as r:
            token = json.loads(r.read().decode())["access_token"]
    except Exception as e:
        print(f"Login failed (is the backend running?): {e}")
        return 1

    try:
        req = urllib.request.Request(
            f"{base}/api/insights/ai?months={args.months}",
            headers={"Authorization": f"Bearer {token}"},
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            insights = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        print(f"AI insights failed: {e.code} {e.reason}")
        print(body)
        return 1
    except Exception as e:
        print(f"AI insights failed: {e}")
        return 1

    print(f"AI insights ({len(insights)}):")
    for i, insight in enumerate(insights, 1):
        print(f"  {i}. [{insight.get('type')}] {insight.get('title')}")
        print(f"     {insight.get('description')}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
