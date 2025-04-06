from fastapi import APIRouter, Request, HTTPException, Response
from dotenv import load_dotenv
from app.services.github_service import GitHubService
from app.services.claude_service import ClaudeService
from app.services.speech_service import SpeechService
from app.services.slide_service import SlideService
from app.services.openai_service import OpenAIService


from app.core.limiter import limiter
import os
from app.prompts import PODCAST_SSML_PROMPT_AFTER_BREAK, PODCAST_SSML_PROMPT, PODCAST_SSML_PROMPT_BEFORE_BREAK, SLIDE_PROMPT
from anthropic._exceptions import RateLimitError
from pydantic import BaseModel
from functools import lru_cache
import re
from tempfile import NamedTemporaryFile
import base64
from pydub import AudioSegment
import io
import concurrent.futures
from clerk_backend_api import Clerk
from clerk_backend_api.jwks_helpers import authenticate_request, AuthenticateRequestOptions


load_dotenv()

router = APIRouter(prefix="/generate", tags=["Claude"])

# Initialize services
github_service = GitHubService()
claude_service = ClaudeService()
speech_service = SpeechService()
openai_service = OpenAIService()
slide_service = SlideService()


def is_signed_in(request: Request):
    return True
    # sdk = Clerk(bearer_auth=os.getenv('CLERK_SECRET_KEY'))
    # request_state = sdk.authenticate_request(
    #     request,
    #     AuthenticateRequestOptions()
    # )
    # print("req header")
    # print(request_state, request.headers)
    # if '__clerk_handshake' in request.headers.cookie:
    #     return True
    # return request_state.is_signed_in

# cache github data for 5 minutes to avoid double API calls from cost and generate
@lru_cache(maxsize=100)
def get_cached_github_data(username: str, repo: str):
    default_branch = github_service.get_default_branch(username, repo)
    if not default_branch:
        default_branch = "main"  # fallback value

    file_tree = github_service.get_github_file_paths_as_list(username, repo)
    readme = github_service.get_github_readme(username, repo)
    file_content = ""
    try:
        file_list = openai_service.get_important_files(file_tree)
        for fpath in file_list:
            content = github_service.get_github_file_content(username, repo, fpath)
            discuss_or_not = "- discuss this file." if '.md' not in fpath else ""
            file_content += f"FPATH: {fpath} {discuss_or_not} \n CONTENT:{content[:50000]}"
    except Exception as e:
        print(f"Some error in getting github file content {e}. Proceeding.")

    return {
        "default_branch": default_branch,
        "file_tree": file_tree,
        "readme": readme,
        "file_content": file_content
    }

def process_github_content(content, speech_prompt, max_length, max_tokens=None):
    content = content[:max_length]
    print(content[-200:])

    try:
        token_count = claude_service.count_tokens(content)
        print(f"TOKEN COUNT: {token_count}")
        if max_tokens and token_count > max_tokens:
            return {
                "error": "Content is too large for analysis."
            }
    except Exception as e:
        print(f"{e} Error in token count")

    with NamedTemporaryFile(delete=False, mode='w+', suffix='.txt') as temp_file:
        temp_file.write(content)
        temp_file_path = temp_file.name

    try:
        ssml_response = speech_service.generate_ssml_with_retry([temp_file_path], speech_prompt)
        print(ssml_response[-200:])
    finally:
        os.remove(temp_file_path)

    return ssml_response


def process_github_content_for_slides(content, slide_prompt, max_length, max_tokens=None):
    content = content[:max_length]
    print(content[-200:])

    try:
        token_count = claude_service.count_tokens(content)
        print(f"TOKEN COUNT: {token_count}")
        if max_tokens and token_count > max_tokens:
            return {
                "error": "Content is too large for analysis."
            }
    except Exception as e:
        print(f"{e} Error in token count")

    with NamedTemporaryFile(delete=False, mode='w+', suffix='.txt') as temp_file:
        temp_file.write(content)
        temp_file_path = temp_file.name

    try:
        slide_markdown_response = slide_service.generate_markdown_with_retry([temp_file_path], slide_prompt)
        print(slide_markdown_response[-200:])
    finally:
        os.remove(temp_file_path)

    return slide_markdown_response


def generate_ssml_concurrently(file_tree, readme, file_content, audio_length) -> str | dict:
    # Prepare the content
    if audio_length == 'short':
        combined_content = f"FILE TREE: {file_tree}\nREADME: {readme} IMPORTANT FILES: {file_content}"
        ssml_response = process_github_content(combined_content, PODCAST_SSML_PROMPT, 250000, 100000)
        return ssml_response
    else:
        combined_content_tree_readme = f"FILE TREE: {file_tree}\nREADME: {readme}"
        combined_content_file_content = f"IMPORTANT FILES: {file_content}"

        # Define a function for error handling
        def check_response(response):
            if isinstance(response, dict):  # Check if it returns an error dictionary
                return response
            return None

        # Use ThreadPoolExecutor to execute tasks concurrently
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future_tree_readme = executor.submit(
                process_github_content,
                combined_content_tree_readme,
                PODCAST_SSML_PROMPT_BEFORE_BREAK,
                250000,
                100000
            )
            future_file_content = executor.submit(
                process_github_content,
                combined_content_file_content,
                PODCAST_SSML_PROMPT_AFTER_BREAK,
                250000,
                100000
            )

            ssml_response_tree_readme = future_tree_readme.result()
            ssml_response_file_content = future_file_content.result()

            # Check for errors
            error_response = check_response(ssml_response_tree_readme) or check_response(ssml_response_file_content)
            if error_response:
                return error_response
        # Apply the function to remove the first occurrence of the <speak> tags from responses
        ssml_response_tree_readme_content = speech_service.remove_first_speak_tag(ssml_response_tree_readme)
        ssml_response_file_content_content = speech_service.remove_first_speak_tag(ssml_response_file_content)
        # Combine the contents
        combined_ssml_content = f"{ssml_response_tree_readme_content}\n{ssml_response_file_content_content}"

        # Wrap the combined content in a single <speak> tag
        full_ssml_response = f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">{combined_ssml_content}</speak>'

        # Proceed with ssml_response_tree_readme and ssml_response_file_content as needed
        return full_ssml_response


class ApiRequest(BaseModel):
    username: str
    repo: str
    instructions: str
    api_key: str | None = None
    audio: bool = False  # new param
    audio_length: str = 'long'


class SlideRequest(BaseModel):
    username: str
    repo: str
    instructions: str
    api_key: str | None = None
    audio: bool = False  # new param
    audio_length: str = 'long'


# @limiter.limit("1/minute;5/day") # TEMP: disable rate limit for growth??
@router.post("")
async def generate(request: Request, body: ApiRequest):
    try:
        if len(body.instructions) > 1000:
            return {"error": "Instructions exceed maximum length of 1000 characters"}

        audio_length = body.audio_length

        if audio_length == 'long' and not is_signed_in(request):
            raise HTTPException(
                status_code=401,
                detail="Please sign in to access this resource"
            )
        github_data = get_cached_github_data(body.username, body.repo)
        default_branch = github_data["default_branch"]
        file_tree = github_data["file_tree"]
        readme = github_data["readme"]
        file_content = github_data["file_content"]

        result = generate_ssml_concurrently(file_tree, readme, file_content, audio_length)
        # Check if there was an error response
        if isinstance(result, dict):  # There was an error
            print("Error in processing:")
            for error in result.get("errors", []):
                print(error)
            return {"error": "Some error in genererating audio: E001"}
        else:
            # Successful processing
            full_ssml_response = result

        print(full_ssml_response[-100:])
        ssml_response = full_ssml_response

        if not body.audio:
            return {"diagram": "flowchart TB\n    subgraph Input\n        CLI[CLI Interface]:::input\n        API[API Interface]:::input\n    end\n\n    subgraph Orchestration\n        TM[Task Manager]:::core\n        PR[Platform Router]:::core\n    end\n\n    subgraph \"Planning Layer\"\n        TP[Task Planning]:::core\n        subgraph Planners\n            OP[OpenAI Planner]:::planner\n            GP[Gemini Planner]:::planner\n            LP[Local Ollama Planner]:::planner\n        end\n    end\n\n    subgraph \"Finding Layer\"\n        subgraph Finders\n            OF[OpenAI Finder]:::finder\n            GF[Gemini Finder]:::finder\n            LF[Local Ollama Finder]:::finder\n            MF[MLX Finder]:::finder\n        end\n    end\n\n    subgraph \"Execution Layer\"\n        AE[Android Executor]:::executor\n        OE[OSX Executor]:::executor\n    end\n\n    subgraph \"External Services\"\n        direction TB\n        OAPI[OpenAI API]:::external\n        GAPI[Google Gemini API]:::external\n        LAPI[Local Ollama Instance]:::external\n    end\n\n    subgraph \"Platform Tools\"\n        direction TB\n        ADB[Android Debug Bridge]:::platform\n        OSX[OSX System Tools]:::platform\n    end\n\n    subgraph \"Configuration\"\n        direction TB\n        MS[Model Settings]:::config\n        FD[Function Declarations]:::config\n        SP[System Prompts]:::config\n    end\n\n    %% Connections\n    CLI --> TM\n    API --> TM\n    TM --> PR\n    PR --> TP\n    TP --> Planners\n    Planners --> Finders\n    Finders --> AE & OE\n    \n    %% External Service Connections\n    OP & OF -.-> OAPI\n    GP & GF -.-> GAPI\n    LP & LF -.-> LAPI\n    \n    %% Platform Tool Connections\n    AE --> ADB\n    OE --> OSX\n    \n    %% Configuration Connections\n    MS -.-> TM\n    FD -.-> PR\n    SP -.-> TP\n\n    %% Click Events\n    click CLI \"https://github.com/BandarLabs/clickclickclick/blob/main/main.py\"\n    click API \"https://github.com/BandarLabs/clickclickclick/blob/main/api.py\"\n    click MS \"https://github.com/BandarLabs/clickclickclick/blob/main/clickclickclick/config/models.yaml\"\n    click FD \"https://github.com/BandarLabs/clickclickclick/tree/main/clickclickclick/config/function_declarations\"\n    click SP \"https://github.com/BandarLabs/clickclickclick/blob/main/clickclickclick/config/prompts.yaml\"\n    click OP \"https://github.com/BandarLabs/clickclickclick/blob/main/clickclickclick/planner/openai.py\"\n    click GP \"https://github.com/BandarLabs/clickclickclick/blob/main/clickclickclick/planner/gemini.py\"\n    click LP \"https://github.com/BandarLabs/clickclickclick/blob/main/clickclickclick/planner/local_ollama.py\"\n    click TP \"https://github.com/BandarLabs/clickclickclick/blob/main/clickclickclick/planner/task.py\"\n    click OF \"https://github.com/BandarLabs/clickclickclick/blob/main/clickclickclick/finder/openai.py\"\n    click GF \"https://github.com/BandarLabs/clickclickclick/blob/main/clickclickclick/finder/gemini.py\"\n    click LF \"https://github.com/BandarLabs/clickclickclick/blob/main/clickclickclick/finder/local_ollama.py\"\n    click MF \"https://github.com/BandarLabs/clickclickclick/blob/main/clickclickclick/finder/mlx.py\"\n    click AE \"https://github.com/BandarLabs/clickclickclick/blob/main/clickclickclick/executor/android.py\"\n    click OE \"https://github.com/BandarLabs/clickclickclick/blob/main/clickclickclick/executor/osx.py\"\n\n    %% Styles\n    classDef input fill:#87CEEB,stroke:#333,stroke-width:2px\n    classDef core fill:#4169E1,stroke:#333,stroke-width:2px\n    classDef planner fill:#6495ED,stroke:#333,stroke-width:2px\n    classDef finder fill:#4682B4,stroke:#333,stroke-width:2px\n    classDef executor fill:#1E90FF,stroke:#333,stroke-width:2px\n    classDef external fill:#98FB98,stroke:#333,stroke-width:2px\n    classDef platform fill:#FFA500,stroke:#333,stroke-width:2px\n    classDef config fill:#D3D3D3,stroke:#333,stroke-width:2px",
                    "explanation": 'EXPLANATION'}
        else:

            audio_bytes = speech_service.text_to_mp3(ssml_response)

            if audio_bytes:
                response = Response(content=audio_bytes, media_type="audio/mpeg", headers={"Content-Disposition": "attachment; filename=explanation.mp3"})

                audio = AudioSegment.from_file(io.BytesIO(audio_bytes), format="mp3")
                duration_in_seconds = len(audio) / 1000.0
                print("duration in sec", duration_in_seconds)
                vtt_content = speech_service.ssml_to_webvtt(ssml_response, duration_in_seconds)
                encoded_vtt_content = base64.b64encode(vtt_content.encode('utf-8')).decode('utf-8')
                response.headers["X-VTT-Content"] = encoded_vtt_content

                response.headers["Access-Control-Expose-Headers"] = "X-VTT-Content"
                response.headers["Access-Control-Allow-Origin"] = "*"
                return response
            else:
                return {"error": "Text to speech is not available. Please set Azure speech credentials in .env E002"}
    except RateLimitError as e:
        raise HTTPException(
            status_code=429,
            detail="Service is currently experiencing high demand. Please try again in a few minutes."
        )
    except Exception as e:
        return {"error": str(e)}

@router.post("/slide")
async def generate_slide(request: Request, body: SlideRequest):
    try:
        if len(body.instructions) > 1000:
            return {"error": "Instructions exceed maximum length of 1000 characters"}

        # audio_length = body.audio_length

        # if audio_length == 'long' and not is_signed_in(request):
        #     raise HTTPException(
        #         status_code=401,
        #         detail="Please sign in to access this resource"
        #     )
        github_data = get_cached_github_data(body.username, body.repo)
        default_branch = github_data["default_branch"]
        file_tree = github_data["file_tree"]
        readme = github_data["readme"]
        file_content = github_data["file_content"]
        markdown = process_github_content_for_slides(f" file tree: {file_tree} \n contents: {file_content}", SLIDE_PROMPT, 250000, 100000)
        return {"slide_markdown": markdown}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

@router.post("/cost")
# @limiter.limit("5/minute") # TEMP: disable rate limit for growth??
async def get_generation_cost(request: Request, body: ApiRequest):
    try:
        # Get file tree and README content
        github_data = get_cached_github_data(body.username, body.repo)
        file_tree = github_data["file_tree"]
        readme = github_data["readme"]

        # Calculate combined token count
        file_tree_tokens = claude_service.count_tokens(file_tree)
        readme_tokens = claude_service.count_tokens(readme)

        # Calculate approximate cost
        # Input cost: $3 per 1M tokens ($0.000003 per token)
        # Output cost: $15 per 1M tokens ($0.000015 per token)
        # Estimate output tokens as roughly equal to input tokens
        input_cost = ((file_tree_tokens * 2 + readme_tokens) + 3000) * 0.000003
        output_cost = 3500 * 0.000015
        estimated_cost = input_cost + output_cost

        # Format as currency string
        cost_string = f"${estimated_cost:.2f} USD"
        return {"cost": cost_string}
    except Exception as e:
        return {"error": str(e)}


def process_click_events(diagram: str, username: str, repo: str, branch: str) -> str:
    """
    Process click events in Mermaid diagram to include full GitHub URLs.
    Detects if path is file or directory and uses appropriate URL format.
    """
    def replace_path(match):
        # Extract the path from the click event
        path = match.group(2).strip('"\'')

        # Determine if path is likely a file (has extension) or directory
        is_file = '.' in path.split('/')[-1]

        # Construct GitHub URL
        base_url = f"https://github.com/{username}/{repo}"
        path_type = "blob" if is_file else "tree"
        full_url = f"{base_url}/{path_type}/{branch}/{path}"

        # Return the full click event with the new URL
        return f'click {match.group(1)} "{full_url}"'

    # Match click events: click ComponentName "path/to/something"
    click_pattern = r'click ([^\s"]+)\s+"([^"]+)"'
    return re.sub(click_pattern, replace_path, diagram)
