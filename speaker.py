import sys
import pyttsx3

class Speaker:
    def __init__(self):
        # On Windows, ensure COM is initialized for SAPI5 (pyttsx3)
        if sys.platform == 'win32':
            import ctypes
            try:
                ctypes.windll.ole32.CoInitialize(None)
            except Exception as e:
                print(f"COM initialization warning: {e}")

        self.engine = pyttsx3.init()
        self.engine.setProperty("rate", 170)
        self.engine.setProperty("voice", self.engine.getProperty("voices")[0].id)

    def speak(self, text):
        print(f"🗣️ Karna: {text}")
        self.engine.say(text)
        self.engine.runAndWait()
