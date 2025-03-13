from dotenv import load_dotenv

from app.services.openai_service import OpenAIService

from io import BytesIO

load_dotenv()

openai_service = OpenAIService()

class SlideService:
    def __init__(self):
        pass
    def is_valid_markdown(self, markdown: str) -> bool:
        return True

    # Function to generate SSML with retry logic
    def generate_markdown_with_retry(self, file_paths, prompt, max_retries=3, delay=2):
        attempts = 0
        while attempts < max_retries:
            # Call the OpenAI function to generate SSML
            markdown_response = openai_service.call_openai_for_response(file_paths, prompt)
            filtered_markdown_response = '\n'.join(line for line in markdown_response.split('\n'))


            # Check if the sanitized SSML is valid
            if self.is_valid_markdown(filtered_markdown_response):
                return filtered_markdown_response

            # If not valid, increment attempts and wait before retrying
            attempts += 1

        # Optionally raise an exception or return an error if max retries reached
        raise ValueError("Failed to generate valid SSML after multiple attempts.")