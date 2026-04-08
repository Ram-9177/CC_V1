import time
import statistics
import urllib.request
import urllib.error
import json
import threading
from concurrent.futures import ThreadPoolExecutor

# SRE Load Testing Script for CampusCore CX33 spec (Advanced Stress Tests)

TARGET_URL = "http://127.0.0.1:8000/api/metrics/dashboard/" 
GATE_PASS_URL = "http://127.0.0.1:8000/api/gatepasses/" # Expected write endpoint
TIMEOUT = 5.0

def fetch(url, method="GET", payload=None):
    start = time.time()
    try:
        data = json.dumps(payload).encode('utf-8') if payload else None
        headers = {'User-Agent': 'SRE-Load-Tester/2.0', 'Content-Type': 'application/json'}
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        with urllib.request.urlopen(req, timeout=TIMEOUT) as response:
            status = response.status
            response.read()
    except urllib.error.HTTPError as e:
        status = e.code
    except Exception:
        status = 0
    end = time.time()
    return status, end - start

def print_metrics(results, errors, total_requests, total_time, name):
    if results:
        p50 = statistics.median(results)
        p95 = statistics.quantiles(results, n=20)[18] if len(results) >= 20 else max(results)
        p99 = statistics.quantiles(results, n=100)[98] if len(results) >= 100 else max(results)
        avg = statistics.mean(results)
    else:
        p50 = p95 = p99 = avg = 0
        
    error_rate = (errors / total_requests) * 100 if total_requests else 0
    rps = total_requests / total_time if total_time else 0
    
    print(f"--- {name} Metrics ---")
    print(f"  Req/sec (RPS): {rps:.2f}")
    print(f"  Average Time:  {avg*1000:.1f}ms")
    print(f"  p50 Latency:   {p50*1000:.1f}ms")
    print(f"  p95 Latency:   {p95*1000:.1f}ms")
    print(f"  p99 Latency:   {p99*1000:.1f}ms")
    print(f"  Error Rate:    {error_rate:.1f}%")
    print("------------------------\n")

def run_burst(concurrency, total_requests, name="Burst", method="GET", url=TARGET_URL, payload=None):
    results = []
    errors = 0
    start_time = time.time()
    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(fetch, url, method, payload) for _ in range(total_requests)]
        for f in futures:
            status, latency = f.result()
            results.append(latency)
            if status not in (200, 201, 301, 302, 304, 401, 403, 405): 
                errors += 1
    total_time = time.time() - start_time
    print_metrics(results, errors, total_requests, total_time, name)

def test_cold_start():
    print("\n[TEST 1] COLD START TEST")
    print(">>> ACTION REQUIRED: Run `redis-cli FLUSHALL` to wipe cache, then press Enter.")
    input("Press Enter to simulate 200 concurrent users immediately... ")
    run_burst(200, 400, "Cold Start - 200 Users")

def test_write_heavy():
    print("\n[TEST 2] WRITE-HEAVY LOAD TEST")
    print("Simulating 100 users writing Gate Passes + 100 users reading dashboards.")
    
    results = []
    errors = 0
    start_time = time.time()
    
    def mixed_worker(i):
        if i % 2 == 0:
            return fetch(TARGET_URL, "GET")
        else:
            return fetch(GATE_PASS_URL, "POST", {"reason": "Stress Test Go Home", "destination": "City"})

    with ThreadPoolExecutor(max_workers=200) as executor:
        futures = [executor.submit(mixed_worker, i) for i in range(400)]
        for f in futures:
            status, latency = f.result()
            results.append(latency)
            if status not in (200, 201, 301, 302, 304, 401, 403, 405): 
                errors += 1
                
    total_time = time.time() - start_time
    print_metrics(results, errors, 400, total_time, "Write-Heavy Simulation")

def test_endurance(duration_seconds=60):
    print(f"\n[TEST 3] ENDURANCE TEST ({duration_seconds} seconds)")
    print("Simulating sustained load. Monitor htop/top for memory growth and worker restarts.")
    
    stop_flag = False
    results = []
    errors = 0
    
    def worker():
        nonlocal errors
        while not stop_flag:
            status, latency = fetch(TARGET_URL)
            results.append(latency)
            if status not in (200, 201, 301, 302, 304, 401, 403, 405):
                errors += 1
            time.sleep(0.1) # Paced requests
            
    threads = [threading.Thread(target=worker) for _ in range(50)]
    start_time = time.time()
    for t in threads: t.start()
    
    time.sleep(duration_seconds)
    stop_flag = True
    for t in threads: t.join()
    
    total_time = time.time() - start_time
    print_metrics(results, errors, len(results), total_time, f"Endurance Test ({duration_seconds}s)")

def text_cache_failure_and_network():
    print("\n[TEST 4] CACHE FAILURE SIMULATION")
    print(">>> ACTION REQUIRED: Stop Redis (`sudo systemctl stop redis` or scale replica to 0).")
    print("Run `python sre_load_test.py burst` to verify DB survival.")
    
    print("\n[TEST 5] NETWORK DEGRADATION SIMULATION")
    print(">>> ACTION REQUIRED: Open Chrome DevTools -> Network -> Fast 3G.")
    print("Load the dashboard. Ensure React Skeleton renders instantly and critical Hero loads first.")

if __name__ == "__main__":
    import sys
    cmd = sys.argv[1] if len(sys.argv) > 1 else "all"
    
    print("CampusCore CX33 SRE Advanced Validation")
    if cmd in ("all", "cold"): test_cold_start()
    if cmd in ("all", "write"): test_write_heavy()
    if cmd in ("all", "endurance"): test_endurance() # defaults to 60s for unit test formatting
    if cmd in ("all", "manual"): text_cache_failure_and_network()
    if cmd == "burst": run_burst(100, 500, "Base Validation")
