import openwakeword
import pyaudio
import numpy as np

class WakeWordDetector:
    def __init__(self):
        self.detector = openwakeword.Model(wakeword_models=["karna.onnx", "alexa", "hey_jarvis"])
        self.chunk_size = 1280
        self.format = pyaudio.paInt16
        self.channels = 1
        self.rate = 16000

    def listen_for_wakeword(self):
        """ Continuously checks for the wake word 'Hey Karna' or built-in alternatives """
        audio = pyaudio.PyAudio()
        stream = audio.open(
            format=self.format,
            channels=self.channels,
            rate=self.rate,
            input=True,
            frames_per_buffer=self.chunk_size
        )

        try:
            print("🎙️ Microphone stream opened. Start speaking...", flush=True)
            chunk_count = 0
            max_confidences = {k: 0.0 for k in ["karna", "alexa", "hey_jarvis"]}
            sum_amplitude = 0.0
            while True:
                # Read raw PCM audio from the stream
                data = stream.read(self.chunk_size, exception_on_overflow=False)
                # Convert buffer to int16 numpy array
                audio_data = np.frombuffer(data, dtype=np.int16)
                
                # Calculate average absolute amplitude
                avg_amplitude = np.abs(audio_data).mean()
                sum_amplitude += avg_amplitude

                # Feed it to the detector
                prediction = self.detector.predict(audio_data)
                
                # Check confidence scores
                for key, val in prediction.items():
                    if key in max_confidences:
                        if val > max_confidences[key]:
                            max_confidences[key] = val
                    else:
                        max_confidences[key] = val

                chunk_count += 1
                if chunk_count >= 12:  # Roughly every 1 second
                    avg_amp_1s = sum_amplitude / chunk_count
                    conf_str = " | ".join([f"{k}: {v:.3f}" for k, v in max_confidences.items()])
                    print(f"🎙️ [Status] Max Confidence [{conf_str}] | Avg Amplitude: {avg_amp_1s:.1f}", flush=True)
                    if avg_amp_1s < 5.0:
                        print("⚠️ [Warning] Microphone input is extremely quiet/silent. Check mic connection/permissions.", flush=True)
                    # Reset metrics for next second
                    chunk_count = 0
                    max_confidences = {k: 0.0 for k in max_confidences}
                    sum_amplitude = 0.0

                # Check if any model triggers
                for model_name, confidence in prediction.items():
                    if confidence > 0.5:
                        print(f"Wake word detected: {model_name} (confidence: {confidence:.2f})", flush=True)
                        return True
        finally:
            stream.stop_stream()
            stream.close()
            audio.terminate()
