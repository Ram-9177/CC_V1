import asyncio
import httpx
import time
import os
import sys
import statistics
import psutil
import json
from datetime import datetime

# Setup Django
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hostelconnect.settings.base')
import django
django.setup()

from django.contrib.auth import get_user_model
from apps.gate_passes.models import GatePass
from django.utils import timezone

User = get_user_model()

BASE_URL = "http://localhost:8000/api"
STUDENT_COUNT = 500
APPROVAL_COUNT = 100
CONCURRENT_REQUESTS = 50

results = {
    "dashboard_loads": [],
    "approvals": [],
    "errors": 0,
    "memory_start": 0,
    "memory_peak": 0
}

def get_mem():
    process = psutil.Process(os.getpid())
    return process.memory_info().rss / 1024 / 1024 # MB

async def login_user(client, username, password):
    try:
        resp = await client.post(f"{BASE_URL}/auth/login/", json={
            "username": username,
            "password": password
        })
        if resp.status_code == 200:
            return resp.json()['tokens']['access']
    except Exception as e:
        # print(f"Login failed for {username}: {e}")
        pass
    return None

async def load_dashboard(client, token):
    start = time.perf_counter()
    try:
        resp = await client.get(
            f"{BASE_URL}/metrics/advanced-dashboard/?period=week",
            headers={"Authorization": f"Bearer {token}"}
        )
        latency = (time.perf_counter() - start) * 1000
        if resp.status_code == 200:
            results["dashboard_loads"].append(latency)
        else:
            results["errors"] += 1
    except Exception:
        results["errors"] += 1
    
    # Update peak memory
    results["memory_peak"] = max(results["memory_peak"], get_mem())

async def approve_gatepass(client, token, pass_id):
    start = time.perf_counter()
    try:
        resp = await client.post(
            f"{BASE_URL}/gate-passes/{pass_id}/approve/",
            json={"remarks": "Stress Test Approval"},
            headers={"Authorization": f"Bearer {token}"}
        )
        latency = (time.perf_counter() - start) * 1000
        if resp.status_code == 200:
            results["approvals"].append(latency)
        else:
            results["errors"] += 1
    except Exception as e:
        results["errors"] += 1

def setup_simulation():
    print(f"🚀 Initializing Stress Simulation ({STUDENT_COUNT} Students, {APPROVAL_COUNT} Approvals)")
    results["memory_start"] = get_mem()
    
    # 1. Setup Test Users
    from django.db import transaction
    from django.contrib.auth.hashers import make_password
    
    print("👤 Seeding test users (Optimized Batch)...")
    hashed_pwd = make_password("password123")
    
    with transaction.atomic():
        for i in range(1, STUDENT_COUNT + 1):
            username = f"STRESS_STUDENT_{i}"
            if not User.objects.filter(username=username).exists():
                User.objects.create(
                    username=username,
                    password=hashed_pwd,
                    email=f"{username.lower()}@stress.test",
                    role='student',
                    first_name='Stress',
                    last_name=str(i)
                )
    
    # 2. Setup Passes for Approvals
    print(f"🎟️ Creating {APPROVAL_COUNT} GatePasses for approval...")
    passes = []
    with transaction.atomic():
        for i in range(APPROVAL_COUNT):
            student = User.objects.get(username=f"STRESS_STUDENT_{i+1}")
            # Clear existing pending to keep it clean
            GatePass.objects.filter(student=student, status='pending').delete()
            
            gp = GatePass.objects.create(
                student=student,
                destination="Stress Market",
                reason="Load Testing",
                pass_type='local',
                status='pending',
                parent_informed=True, 
                exit_date=timezone.now()
            )
            passes.append(gp.id)
    return passes

async def run_simulation(pids):
    # 0. Get Admin Token FIRST before any student bursts
    print("👮 Authenticating Admin...")
    async with httpx.AsyncClient(timeout=20.0) as client:
        admin_token = await login_user(client, "ADMIN", "password123")
        if not admin_token:
            print("❌ Admin login failed. Likely throttled. Waiting 30s...")
            await asyncio.sleep(30)
            admin_token = await login_user(client, "ADMIN", "password123")
            if not admin_token:
                print("❌ Admin login failed twice. Aborting.")
                return

    students = [f"STRESS_STUDENT_{i}" for i in range(1, STUDENT_COUNT+1)]
    
    # 2. Get Student Tokens (Batching)
    print("🔑 Authenticating students...")
    tokens = []
    async with httpx.AsyncClient(timeout=60.0) as client:
        batch_size = 20 # Slower batch to avoid throttle
        for i in range(0, len(students), batch_size):
            batch = students[i:i+batch_size]
            batch_tokens = await asyncio.gather(*[login_user(client, u, "password123") for u in batch])
            tokens.extend([t for t in batch_tokens if t])
            # Small delay to keep throttle happy
            await asyncio.sleep(0.5)
    
    print(f"✅ Authenticated {len(tokens)} students.")

    # 3. Stress Scenario 1: Dashboard Loads
    print(f"📉 Simulating {len(tokens)} CONCURRENT DASHBOARD loads...")
    async with httpx.AsyncClient(timeout=60.0) as client:
        tasks = [load_dashboard(client, t) for t in tokens]
        await asyncio.gather(*tasks)

    # 4. Stress Scenario 2: Approvals (Reusable Admin token)
    print(f"✍️ Simulating {APPROVAL_COUNT} CONCURRENT APPROVALS...")
    async with httpx.AsyncClient(timeout=60.0) as client:
        tasks = [approve_gatepass(client, admin_token, pid) for pid in pids]
        await asyncio.gather(*tasks)

    # 5. Summary
    print("\n" + "="*40)
    print("      STRESS TEST RESULTS")
    print("="*40)
    
    avg_dash = statistics.mean(results["dashboard_loads"]) if results["dashboard_loads"] else 0
    p95_dash = statistics.quantiles(results["dashboard_loads"], n=20)[18] if len(results["dashboard_loads"]) > 20 else 0
    
    avg_appr = statistics.mean(results["approvals"]) if results["approvals"] else 0
    
    print(f"Avg Dashboard Load: {avg_dash:.2f}ms")
    print(f"P95 Dashboard Load: {p95_dash:.2f}ms")
    print(f"Avg Approval Time:  {avg_appr:.2f}ms")
    print(f"Total Errors:       {results['errors']}")
    print(f"Peak Memory usage:  {results['memory_peak']:.2f} MB")
    print(f"Heap Growth:        {results['memory_peak'] - results['memory_start']:.2f} MB")
    
    # Bottlenecks & Recommendations
    print("\n🔍 Bottleneck Detection:")
    if results['errors'] > 0:
        print("   - High Error Rate: Server likely dropped connections due to queue full (uWSGI/Gunicorn listen backlog).")
    if avg_dash > 500:
        print("   - Response Degradation: Single-threaded 'runserver' is blocking. Dashboard calculation is CPU-bound.")
    
    print("\n🚀 Scaling Recommendations:")
    print("   1. Transition to Gunicorn/Uvicorn with 4-8 workers (CPU cores + 1).")
    print("   2. Implement Redis caching for 'advanced-dashboard' with 30s TTL.")
    print("   3. Move WebSocket broadcasts to a background Celery task.")
    print("   4. Increase DB Connection Pool size for concurrent write bursts.")

if __name__ == "__main__":
    pids = setup_simulation()
    asyncio.run(run_simulation(pids))
