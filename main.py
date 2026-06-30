import sys

# Reconfigure stdout and stderr to support UTF-8 (emojis, etc.) on Windows terminals
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

from wakeword import WakeWordDetector
from listener import Listener
from speaker import Speaker
from brain import Brain

def main():
    print("🔊 Karna is running... Say 'Hey Karna' to wake me up.")

    wakeword = WakeWordDetector()
    listener = Listener()
    speaker = Speaker()
    brain = Brain()

    while True:
        if wakeword.listen_for_wakeword():  # Wake word detected
            speaker.speak("Yes, I am listening...")
            command = listener.listen()

            if command:
                print(f"👂 You said: {command}")
                response = brain.process(command)
                speaker.speak(response)

if __name__ == "__main__":
    main()
