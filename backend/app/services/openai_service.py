import os
import openai
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import List
load_dotenv()
class FileListFormat(BaseModel):
    file_list: List[str]

class OpenAIService:
    def __init__(self):
        # Retrieve necessary Azure OpenAI API setup from environment variables
        openai.api_type = "azure"  # azure / openai
        openai.api_base = os.environ["AZURE_OPENAI_ENDPOINT"]  # remove this for openai api
        openai.api_version = "2024-10-21"
        openai.api_key = os.environ["AZURE_OPENAI_API_KEY"]  # use openai key for openai api
        # Model name should match your Azure configuration
        self.model_name = os.environ.get("AZURE_OPENAI_MODEL_NAME", "gpt-4o")

    def call_openai_for_response(self, files_path, prompt_text):
        """
        Calls Azure OpenAI API to generate a response based on the given text prompt.

        Args:
            prompt_text (str): The input text prompt for the model.

        Returns:
            str: The generated response from the model.
        """
        # Read the content of the file specified by files_path
        with open(files_path[0], 'r') as file:
            file_content = file.read()  # this has everything readme + tree + other files
        # Send the prompt to Azure OpenAI for processing
        response = openai.chat.completions.create(
            model=self.model_name,
            messages=[
                {"role": "system", "content": prompt_text},  # Initial system prompt
                {"role": "user", "content": file_content}  # User prompt
            ]
        )
        # print(response)
        # Get and return the content of the assistant's reply
        assistant_response = response.choices[0].message.content.strip()
        return assistant_response

    def get_important_files(self, file_tree):
        # file_tree = "api/backend/main.py  api.py"
        # Send the prompt to Azure OpenAI for processing
        response = openai.beta.chat.completions.parse(
            model=self.model_name,
            messages=[
                {"role": "system", "content": "Can you give the list of upto 10 most important file paths in this file tree to understand code architechture and high level decisions and overall what the repository is about to include in the podcast i am creating, as a list, do not write any unknown file paths not listed below"},  # Initial system prompt
                {"role": "user", "content": file_tree}
            ],
            response_format=FileListFormat,
        )
        try:
            response = response.choices[0].message.parsed
            print(type(response), " resp ")
            return response.file_list
        except Exception as e:
            print("Error processing file tree:", e)
            return []


# Example usage
if __name__ == "__main__":
    ssml_prompt = """Can you convert it into a podcast so that someone could listen to it and understand what's going on - make it a ssml similar to this: <speak version=\"1.0\" xmlns=\"http://www.w3.org/2001/10/synthesis\" xml:lang=\"en-US\">\n<voice name=\"en-US-AvaMultilingualNeural\">\nWelcome to Next Gen Innovators!  (no need to open links) .. also make it a conversation between host and guest of a podcast, question answer kind. \n\n<break time=\"500ms\" />\nI’m your host, Ava, and today we’re diving into an exciting topic: how students can embark on their entrepreneurial journey right from college.\n<break time=\"700ms\" />\nJoining us is Arun Sharma, a seasoned entrepreneur with over two decades of experience and a passion for mentoring young innovators.\n<break time=\"500ms\" />\nArun, it’s a pleasure to have you here.\n</voice>\n\n<voice name=\"en-US-BrianMultilingualNeural\">\n    Thank you, Ava.\n    <break time=\"300ms\" />\n    It’s great to be here. I’m excited to talk about how students can channel their creativity and energy into building impactful ventures.\n</voice> ..\n","""
    azure_openai_service = OpenAIService()
    r = azure_openai_service.get_important_files("")
    print(r)
    # file_paths = ["/Users/manish/Downloads/ahmedkhaleel2004-gitdiagram.txt"]
    # response = azure_openai_service.call_openai_for_response(file_paths, ssml_prompt)
    # print("AI Response:", response)