import json
import os
import re
import subprocess
import time
import sys

# Set default encoding to UTF-8 for prints
sys.stdout.reconfigure(encoding='utf-8')

notebooks = {
    "Ch2 (FN)": {
        "id": "e4f43415-ed66-4621-a902-c4c450a6925d",
        "clean_json": "ch2_(fn)_clean.json",
        "folder": "functional_neurology",
        "filenames": {
            "Episode 1": "01_episode1_universe.m4a",
            "Episode 2": "02_episode2_assessment.m4a",
            "Episode 3": "03_episode3_treatment.m4a",
            "Episode 4": "04_episode4_humility.m4a"
        }
    },
    "Ch3 (Diversified)": {
        "id": "291e66c6-c8b5-4de0-9ef9-f3bab92ac4ff",
        "clean_json": "ch3_(diversified)_clean.json",
        "folder": "diversified",
        "filenames": {
            "Episode 1": "01_episode1_history.m4a",
            "Episode 2": "02_episode2_palpation.m4a",
            "Episode 3": "03_episode3_hvla.m4a",
            "Episode 4": "04_episode4_safety.m4a"
        }
    },
    "Ch4 (Gonstead)": {
        "id": "4e8b2040-ae5a-438c-90ad-a8acc7a542f2",
        "clean_json": "ch4_(gonstead)_clean.json",
        "folder": "gonstead",
        "filenames": {
            "Episode 1": "01_episode1_discovery.m4a",
            "Episode 2": "02_episode2_5step.m4a",
            "Episode 3": "03_episode3_listing.m4a",
            "Episode 4": "04_episode4_critical.m4a"
        }
    },
    "Ch12 (AK)": {
        "id": "416ef164-398d-46f0-8d11-45558467bd7f",
        "clean_json": "ch12_(ak)_clean.json",
        "folder": "ak",
        "filenames": {
            "Episode 1": "01_episode1_history.m4a",
            "Episode 2": "02_episode2_diagnosis.m4a",
            "Episode 3": "03_episode3_treatment.m4a",
            "Episode 4": "04_episode4_critical.m4a"
        }
    }
}

# Queue to monitor
# Structure: { artifact_id: { "nb_id": nb_id, "folder": folder, "filename": filename, "ch_name": ch_name, "status": "pending" } }
monitor_queue = {}

print("=== Starting Podcast Regeneration Pipeline ===")

# Step 1: Trigger creation for all episodes
for ch_name, info in notebooks.items():
    print(f"\nProcessing {ch_name}...")
    clean_json = info["clean_json"]
    nb_id = info["id"]
    folder = info["folder"]
    filenames = info["filenames"]
    
    if not os.path.exists(clean_json):
        print(f"  Error: {clean_json} not found. Skipping.")
        continue
        
    with open(clean_json, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    # Extract audio items
    audio_items = [item for item in data if item.get("type") == "audio" and item.get("custom_instructions")]
    
    for item in audio_items:
        inst = item["custom_instructions"]
        
        # Determine episode number (1, 2, 3, or 4) from prompt text
        ep_match = re.search(r'Episode (\d)', inst)
        if not ep_match:
            print(f"  Warning: Could not determine episode number for audio artifact {item.get('id')}. Skipping.")
            continue
            
        ep_num = f"Episode {ep_match.group(1)}"
        filename = filenames.get(ep_num)
        
        if not filename:
            print(f"  Warning: No filename mapped for {ep_num}. Skipping.")
            continue
            
        print(f"  Triggering creation for {ch_name} - {ep_num} ({filename})...")
        
        # Run nlm create command
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        
        try:
            result = subprocess.run(
                ["nlm", "create", "audio", nb_id, "--focus", inst, "--confirm"],
                capture_output=True,
                env=env,
                check=True
            )
            stdout_str = result.stdout.decode('utf-8', errors='replace')
            
            # Parse artifact ID from stdout
            id_match = re.search(r'Artifact ID:\s*([a-f0-9\-]+)', stdout_str)
            if id_match:
                new_id = id_match.group(1)
                print(f"    -> Successfully triggered. New Artifact ID: {new_id}")
                monitor_queue[new_id] = {
                    "nb_id": nb_id,
                    "folder": folder,
                    "filename": filename,
                    "ch_name": ch_name,
                    "ep_name": ep_num,
                    "status": "generating"
                }
            else:
                print(f"    -> Warning: Could not parse Artifact ID from output. Stdout:\n{stdout_str}")
        except Exception as e:
            print(f"    -> Error triggering creation: {e}")

# Save initial trigger queue
with open("regeneration_queue.json", "w", encoding="utf-8") as f:
    json.dump(monitor_queue, f, ensure_ascii=False, indent=2)

print(f"\nTrigger phase finished. Total audio artifacts in queue: {len(monitor_queue)}")

# Step 2: Monitor status until all completed
pending_count = len(monitor_queue)
check_interval = 30 # Check every 30 seconds

print("\n=== Monitoring Status ===")

while pending_count > 0:
    print(f"\nChecking status of {pending_count} pending artifacts at {time.strftime('%H:%M:%S')}...")
    
    # We group by notebook_id to minimize nlm status CLI calls
    nb_groups = {}
    for aid, info in monitor_queue.items():
        if info["status"] == "generating":
            nb_groups.setdefault(info["nb_id"], []).append(aid)
            
    for nb_id, aids in nb_groups.items():
        # Call nlm studio status for this notebook
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        
        try:
            result = subprocess.run(
                ["nlm", "studio", "status", nb_id, "--full", "--json"],
                capture_output=True,
                env=env,
                check=True
            )
            stdout_str = result.stdout.decode('utf-8', errors='replace')
            status_data = json.loads(stdout_str)
            
            # Create a lookup map of artifact_id -> status
            status_map = {item["id"]: item.get("status", "unknown") for item in status_data}
            
            for aid in aids:
                current_status = status_map.get(aid, "not_found")
                info = monitor_queue[aid]
                
                if current_status == "completed":
                    print(f"  [COMPLETED] {info['ch_name']} {info['ep_name']} (ID: {aid})")
                    # Trigger download
                    download_dir = f"downloads/{info['folder']}/podcasts_v3"
                    os.makedirs(download_dir, exist_ok=True)
                    output_path = f"{download_dir}/{info['filename']}"
                    
                    print(f"    -> Downloading to {output_path}...")
                    try:
                        dl_result = subprocess.run(
                            ["nlm", "download", "audio", nb_id, "--id", aid, "--output", output_path, "--no-progress"],
                            capture_output=True,
                            env=env,
                            check=True
                        )
                        print("    -> Download finished successfully.")
                        monitor_queue[aid]["status"] = "downloaded"
                        pending_count -= 1
                    except Exception as dl_err:
                        print(f"    -> Error downloading artifact: {dl_err}")
                elif current_status == "failed":
                    print(f"  [FAILED] {info['ch_name']} {info['ep_name']} (ID: {aid})")
                    monitor_queue[aid]["status"] = "failed"
                    pending_count -= 1
                else:
                    print(f"  [IN PROGRESS] {info['ch_name']} {info['ep_name']} (ID: {aid}) - status: {current_status}")
                    
        except Exception as e:
            print(f"  Error fetching status for notebook {nb_id}: {e}")
            
    # Save progress state
    with open("regeneration_queue.json", "w", encoding="utf-8") as f:
        json.dump(monitor_queue, f, ensure_ascii=False, indent=2)
        
    if pending_count > 0:
        print(f"Sleeping for {check_interval} seconds...")
        time.sleep(check_interval)

print("\n=== All Audio Generations and Downloads Finished ===")
# Print final summary
for aid, info in monitor_queue.items():
    print(f" - {info['ch_name']} {info['ep_name']}: {info['status']} (ID: {aid})")

# Step 3: Run R2 Upload
print("\n=== Triggering R2 Bucket Uploads ===")

try:
    import boto3
    from dotenv import load_dotenv
    load_dotenv()
    
    r2_account_id = os.getenv("R2_ACCOUNT_ID")
    r2_access_key_id = os.getenv("R2_ACCESS_KEY_ID")
    r2_secret_access_key = os.getenv("R2_SECRET_ACCESS_KEY")
    bucket_name = "chiropraticos-curriculum-assets"
    
    print(f"R2 Account ID: {r2_account_id}")
    
    if not all([r2_account_id, r2_access_key_id, r2_secret_access_key]):
        print("  Error: Cloudflare R2 credentials not fully set in .env. Falling back to running _podcast_dl/upload_r2.py.")
    else:
        s3 = boto3.client(
            service_name='s3',
            endpoint_url=f"https://{r2_account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=r2_access_key_id,
            aws_secret_access_key=r2_secret_access_key,
            region_name="auto"
        )
        
        # Upload all downloaded files
        uploaded_count = 0
        for aid, info in monitor_queue.items():
            if info["status"] == "downloaded":
                local_path = f"downloads/{info['folder']}/podcasts_v3/{info['filename']}"
                # R2 path
                r2_key = f"{info['folder']}/podcasts_v3/{info['filename']}"
                
                if os.path.exists(local_path):
                    print(f"  Uploading {local_path} -> R2 Key: {r2_key}...")
                    s3.upload_file(
                        local_path,
                        bucket_name,
                        r2_key,
                        ExtraArgs={'ContentType': 'audio/m4a'}
                    )
                    print("    -> Upload completed.")
                    uploaded_count += 1
                else:
                    print(f"  Local file not found for upload: {local_path}")
        print(f"  Successfully uploaded {uploaded_count} podcasts to Cloudflare R2.")
except Exception as r2_err:
    print(f"  Error setting up R2 upload: {r2_err}")
