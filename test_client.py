import asyncio
import websockets
import json
import random
import math
from datetime import datetime

async def simulate_device(device_id: str, region_id: str, lat: float, lon: float, duration: int = 60):
    uri = f"ws://localhost:8000/ws/sensor/{device_id}"
    
    print(f"[{device_id}] Connecting to {uri}...")
    
    try:
        async with websockets.connect(uri) as websocket:
            print(f"[{device_id}] Connected!")
            
            for i in range(duration):
                base_noise = 0.02
                x = random.gauss(0, base_noise)
                y = random.gauss(0, base_noise)
                z = 9.81 + random.gauss(0, base_noise)
                
                if i == 30:
                    print(f"[{device_id}] 🚨 Simulating earthquake trigger!")
                    x += random.uniform(0.5, 1.5)
                    y += random.uniform(0.5, 1.5)
                    z += random.uniform(0.5, 1.5)
                
                data = {
                    "timestamp": datetime.utcnow().isoformat(),
                    "x": x,
                    "y": y,
                    "z": z,
                    "latitude": lat + random.gauss(0, 0.001),
                    "longitude": lon + random.gauss(0, 0.001),
                    "region_id": region_id
                }
                
                await websocket.send(json.dumps(data))
                
                response = await websocket.recv()
                response_data = json.loads(response)
                
                magnitude = response_data.get('magnitude', 0)
                triggered = response_data.get('triggered', False)
                
                if triggered:
                    print(f"[{device_id}] ⚠️  TRIGGERED! Magnitude: {magnitude:.3f} m/s²")
                elif i % 10 == 0:
                    print(f"[{device_id}] Normal - Magnitude: {magnitude:.3f} m/s²")
                
                await asyncio.sleep(1)
    
    except Exception as e:
        print(f"[{device_id}] Error: {e}")

async def main():
    print("=" * 60)
    print("Seismic Network Test Client")
    print("=" * 60)
    print()
    print("This will simulate 5 devices in Istanbul region.")
    print("At t=30s, all devices will simulate earthquake motion.")
    print("The system should detect a POTENTIAL_QUAKE event.")
    print()
    print("Make sure the server is running: python main.py")
    print()
    print("=" * 60)
    
    await asyncio.sleep(2)
    
    devices = [
        ("device_001", "istanbul-kadikoy", 40.9900, 29.0300),
        ("device_002", "istanbul-kadikoy", 40.9920, 29.0320),
        ("device_003", "istanbul-kadikoy", 40.9880, 29.0280),
        ("device_004", "istanbul-uskudar", 41.0200, 29.0100),
        ("device_005", "istanbul-besiktas", 41.0400, 29.0000),
    ]
    
    tasks = [
        simulate_device(device_id, region_id, lat, lon, duration=60)
        for device_id, region_id, lat, lon in devices
    ]
    
    await asyncio.gather(*tasks)
    
    print()
    print("=" * 60)
    print("Test completed!")
    print("Check http://localhost:8000/alerts to see generated alerts")
    print("Check http://localhost:8000/status for system status")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
