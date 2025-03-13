import os
import time
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

class GeminiService:
    def __init__(self):
        # Configure the Gemini API with the API key
        genai.configure(api_key=os.environ["GEMINI_API_KEY"])

    def upload_to_gemini(self, path, mime_type=None):
        """
        Uploads the given file to Gemini.
        See https://ai.google.dev/gemini-api/docs/prompting_with_media
        """
        file = genai.upload_file(path, mime_type=mime_type)
        print(f"Uploaded file '{file.display_name}' as: {file.uri}")
        return file

    def wait_for_files_active(self, files):
        """
        Waits for the given files to be active.
        Some files uploaded to the Gemini API need to be processed before
        they can be used as prompt inputs. The status can be seen by querying
        the file's "state" field.
        This implementation uses a simple blocking polling loop. Production
        code should probably employ a more sophisticated approach.
        """
        print("Waiting for file processing...")
        for name in (file.name for file in files):
            file = genai.get_file(name)
            while file.state.name == "PROCESSING":
                print(".", end="", flush=True)
                time.sleep(10)
                file = genai.get_file(name)
            if file.state.name != "ACTIVE":
                raise Exception(f"File {file.name} failed to process")
        print("...all files ready")
        print()

    def call_gemini_flash(self, file_paths, prompt, last_message="JUST GIVE SSML. Dont put formatting of backticks etc."):
        """
        Calls the Gemini Flash API to generate SSML/markdown etc based on a given prompt.

        Args:
            file_paths (list): List of paths to files to upload.
            ssml_prompt (str): SSML template or prompt to instruct the model.

        Returns:
            str: The generated SSML text.
        """
        files = [self.upload_to_gemini(path, mime_type="text/plain") for path in file_paths]

        # Some files have a processing delay. Wait for them to be ready.
        self.wait_for_files_active(files)

        # Configure model generation properties
        generation_config = {
            "temperature": 1,
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 8192,
            "response_mime_type": "text/plain",
        }

        # Initialization of the model
        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash-exp",
            generation_config=generation_config,
        )

        # Start a chat session with the defined history and inputs
        chat_session = model.start_chat(
            history=[
                {
                    "role": "user",
                    "parts": [
                        files[0],
                        prompt,
                    ],
                },
            ]
        )
        response = chat_session.send_message(last_message)

        print(response.text)
        return response.text  # Retrieve the response text, adjust as needed

# Example usage
if __name__ == "__main__":
    ssml_prompt = """Can you convert it into a podcast so that someone could listen to it and understand what's going on - make it a ssml similar to this: <speak version=\"1.0\" xmlns=\"http://www.w3.org/2001/10/synthesis\" xml:lang=\"en-US\">\n<voice name=\"en-US-AvaMultilingualNeural\">\nWelcome to Next Gen Innovators!  (no need to open links) .. also make it a conversation between host and guest of a podcast, question answer kind. \n\n<break time=\"500ms\" />\nI’m your host, Ava, and today we’re diving into an exciting topic: how students can embark on their entrepreneurial journey right from college.\n<break time=\"700ms\" />\nJoining us is Arun Sharma, a seasoned entrepreneur with over two decades of experience and a passion for mentoring young innovators.\n<break time=\"500ms\" />\nArun, it’s a pleasure to have you here.\n</voice>\n\n<voice name=\"en-US-BrianMultilingualNeural\">\n    Thank you, Ava.\n    <break time=\"300ms\" />\n    It’s great to be here. I’m excited to talk about how students can channel their creativity and energy into building impactful ventures.\n</voice> ..\n","""
    file_paths = ["/Users/manish/Downloads/ahmedkhaleel2004-gitdiagram.txt"]
    gemini_service = GeminiService()
    ssml_response = gemini_service.call_gemini_flash(file_paths, ssml_prompt)
    print(ssml_response)