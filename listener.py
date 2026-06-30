import speech_recognition as sr
import whisper
import tempfile
import os

class Listener:
    def __init__(self):
        self.recognizer = sr.Recognizer()
        self.microphone = sr.Microphone()
        print("🤖 Initializing local Whisper engine (base model)...")
        # Load the base model for a good balance of speed and accuracy
        self.model = whisper.load_model("base")
        print("🤖 Whisper engine loaded successfully.")

    def listen(self):
        with self.microphone as source:
            print("🎤 Listening...")
            self.recognizer.adjust_for_ambient_noise(source)
            try:
                audio = self.recognizer.listen(source, timeout=5, phrase_time_limit=5)
            except sr.WaitTimeoutError:
                print("⏳ Standby: No speech detected.")
                return None

        try:
            # Save audio to a temporary WAV file
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
                temp_file.write(audio.get_wav_data())
                temp_path = temp_file.name

            try:
                # Transcribe locally using preloaded Whisper model
                # fp16=False prevents warnings/issues on CPU or systems without GPU FP16 support
                result = self.model.transcribe(temp_path, fp16=False)
                text = result.get("text", "").strip()
                return text.lower()
            finally:
                # Clean up the temp file
                if os.path.exists(temp_path):
                    os.remove(temp_path)
        except Exception as e:
            print(f"❌ Error transcribing audio: {e}")
            return "Speech recognition error occurred."
