import sounddevice as sd
import soundfile as sf
import os
#taining for both positive and negitive data
# ---------------- CONFIGURATION ----------------
SAMPLE_RATE = 16000      # 16 kHz sample rate
DURATION = 2             # seconds per recording
#OUTPUT_DIR = "wakeword_dataset/positive"
OUTPUT_DIR = "wakeword_dataset/negitive"
NUM_SAMPLES = 15        # number of recordings you want
WAKEWORD = "Hey Karna"   # for display purpose
# ------------------------------------------------

# Create output directory if it doesn't exist
os.makedirs(OUTPUT_DIR, exist_ok=True)

print(f"🎙️ Prepare to record {NUM_SAMPLES} samples of '{WAKEWORD}'")
print("Make sure the room is quiet and microphone is ready.\n")

for i in range(1, NUM_SAMPLES + 1):
    input(f"Press Enter and say '{WAKEWORD}' (Sample {i}/{NUM_SAMPLES})...")

    # Record audio
    print("Recording...")
    recording = sd.rec(int(DURATION * SAMPLE_RATE), samplerate=SAMPLE_RATE, channels=1)
    sd.wait()  # Wait until recording is finished

    # Save as WAV file
    filename = os.path.join(OUTPUT_DIR, f"hey_karna_{i:02d}.wav")
    sf.write(filename, recording, SAMPLE_RATE)
    print(f"✅ Saved {filename}\n")

print("🎉 Recording complete! You can now use these files for training your wake word model.")
