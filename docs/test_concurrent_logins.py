#!/usr/bin/env python
"""
Concurrent Login Load Test
Tests the system with 10+ simultaneous logins to reproduce the "going down" issue.

Usage:
    python test_concurrent_logins.py --users 10 --url http://localhost:8000

Requirements:
    pip install httpx asyncio aiohttp
"""

import asyncio
import httpx
import time
import sys
from datetime import datetime
from typing import List, Dict, Tuple
import json

# Configuration
DEFAULT_API_URL = "http://localhost:8000"
DEFAULT_NUM_USERS = 10
DEFAULT_CONCURRENT_BATCH = 10

class LoadTestRunner:
    """Run concurrent login load test."""
    
    def __init__(self, api_url: str, num_users: int):
        self.api_url = api_url.rstrip('/')
        self.num_users = num_users
        self.results = []
        self.failed_logins = []
        self.failed_websockets = []
        
    async def create_test_user(self, username: str, password: str = "password123") -> bool:
        """Create a test user account."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.api_url}/api/auth/register/",
                    json={
                        "username": username,
                        "email": f"{username}@test.local",
                        "password": password,
                        "role": "student"
                    }
                )
                return response.status_code in [201, 400]  # 201=created, 400=already exists
        except Exception as e:
            print(f"❌ Failed to create user {username}: {e}")
            return False
    
    async def login_user(self, user_id: int, username: str, password: str) -> Tuple[bool, float, str]:
        """Login a single user and return success, time taken, and token."""
        start_time = time.time()
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    f"{self.api_url}/api/auth/login/",
                    json={
                        "username": username,
                        "password": password
                    }
                )
                elapsed = time.time() - start_time
                
                if response.status_code == 200:
                    data = response.json()
                    token = data.get('access')
                    return True, elapsed, token or ""
                else:
                    self.failed_logins.append({
                        'user_id': user_id,
                        'username': username,
                        'status_code': response.status_code,
                        'error': response.text[:100]
                    })
                    return False, elapsed, ""
        except asyncio.TimeoutError:
            elapsed = time.time() - start_time
            self.failed_logins.append({
                'user_id': user_id,
                'username': username,
                'error': 'Timeout (15s)'
            })
            return False, elapsed, ""
        except Exception as e:
            elapsed = time.time() - start_time
            self.failed_logins.append({
                'user_id': user_id,
                'username': username,
                'error': str(e)
            })
            return False, elapsed, ""
    
    async def test_websocket_connection(self, user_id: int, token: str) -> Tuple[bool, float]:
        """Test WebSocket connection (if possible without browser)."""
        # Note: Full WebSocket testing requires separate tool
        # This is a placeholder for documentation
        return True, 0.0
    
    async def run_concurrent_logins(self) -> None:
        """Run concurrent login test for all users."""
        print(f"\n🔄 Testing concurrent logins with {self.num_users} users...")
        print(f"📍 API URL: {self.api_url}")
        print(f"⏱️  Start time: {datetime.now().strftime('%H:%M:%S.%f')[:-3]}")
        print("-" * 80)
        
        # Step 1: Create test users
        print("\n📝 Step 1: Creating test users...")
        tasks = []
        for i in range(1, self.num_users + 1):
            username = f"loadtest_user_{i}"
            tasks.append(self.create_test_user(username))
        
        results = await asyncio.gather(*tasks)
        created = sum(results)
        print(f"✅ {created}/{self.num_users} users created/verified")
        
        # Step 2: Run concurrent logins
        print(f"\n🚀 Step 2: Running {self.num_users} concurrent logins...")
        print(f"⏱️  Start: {datetime.now().strftime('%H:%M:%S.%f')[:-3]}")
        
        login_tasks = []
        for i in range(1, self.num_users + 1):
            username = f"loadtest_user_{i}"
            task = self.login_user(i, username, "password123")
            login_tasks.append(task)
        
        login_results = await asyncio.gather(*login_tasks)
        print(f"⏱️  End: {datetime.now().strftime('%H:%M:%S.%f')[:-3]}")
        
        # Analyze results
        successful_logins = [r for r in login_results if r[0]]
        failed_logins = [r for r in login_results if not r[0]]
        response_times = [r[1] for r in login_results]
        
        print("\n" + "=" * 80)
        print("📊 RESULTS")
        print("=" * 80)
        
        print(f"\n✅ Successful Logins: {len(successful_logins)}/{self.num_users}")
        print(f"❌ Failed Logins: {len(failed_logins)}/{self.num_users}")
        print(f"   Success Rate: {len(successful_logins) / self.num_users * 100:.1f}%")
        
        if response_times:
            avg_time = sum(response_times) / len(response_times)
            min_time = min(response_times)
            max_time = max(response_times)
            
            print(f"\n⏱️  Response Times:")
            print(f"   Average: {avg_time:.3f}s")
            print(f"   Min: {min_time:.3f}s")
            print(f"   Max: {max_time:.3f}s")
            print(f"   Std Dev: {(sum((t - avg_time) ** 2 for t in response_times) / len(response_times)) ** 0.5:.3f}s")
        
        # Print failed logins if any
        if self.failed_logins:
            print(f"\n🔴 Failed Login Details:")
            for fail in self.failed_logins[:5]:  # Show first 5
                print(f"   - {fail.get('username', 'unknown')}: {fail.get('error', 'unknown')}")
            if len(self.failed_logins) > 5:
                print(f"   ... and {len(self.failed_logins) - 5} more")
        
        # Performance assessment
        print(f"\n📈 Performance Assessment:")
        if len(successful_logins) == self.num_users and max(response_times) < 2.0:
            print("   🟢 EXCELLENT: All logins succeeded under 2 seconds")
        elif len(successful_logins) >= self.num_users * 0.95 and max(response_times) < 5.0:
            print("   🟡 GOOD: 95%+ success, most logins under 5 seconds")
        elif len(successful_logins) >= self.num_users * 0.80:
            print("   🟠 FAIR: 80%+ success, but response times slow")
        else:
            print("   🔴 POOR: Less than 80% success rate or extreme timeouts")
            print("   ⚠️  System cannot handle this load - see CONCURRENT_LOGIN_ANALYSIS.md")
        
        print("\n" + "=" * 80)
    
    async def run(self) -> bool:
        """Run the complete test suite."""
        try:
            await self.run_concurrent_logins()
            return len(self.failed_logins) < self.num_users * 0.2  # Pass if < 20% failures
        except KeyboardInterrupt:
            print("\n❌ Test interrupted by user")
            return False
        except Exception as e:
            print(f"\n❌ Test failed with error: {e}")
            return False


async def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Concurrent login load test for SMG Hostel",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Test with 10 users (default)
  python test_concurrent_logins.py
  
  # Test with 20 users against custom URL
  python test_concurrent_logins.py --users 20 --url http://api.example.com
  
  # Test production endpoint
  python test_concurrent_logins.py --users 50 --url https://api.prod.com
        """
    )
    
    parser.add_argument(
        '--users', '-u',
        type=int,
        default=DEFAULT_NUM_USERS,
        help=f'Number of concurrent users to test (default: {DEFAULT_NUM_USERS})'
    )
    
    parser.add_argument(
        '--url',
        default=DEFAULT_API_URL,
        help=f'API base URL (default: {DEFAULT_API_URL})'
    )
    
    args = parser.parse_args()
    
    print(f"""
╔════════════════════════════════════════════════════════════════╗
║          SMG HOSTEL CONCURRENT LOGIN LOAD TEST                 ║
║     Tests system behavior with 10+ simultaneous logins        ║
╚════════════════════════════════════════════════════════════════╝
    """)
    
    runner = LoadTestRunner(args.url, args.users)
    success = await runner.run()
    
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    asyncio.run(main())
