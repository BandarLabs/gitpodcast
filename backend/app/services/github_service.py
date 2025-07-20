import requests
import jwt
import time
from datetime import datetime, timedelta
from dotenv import load_dotenv
import os
from base64 import b64decode

load_dotenv()


class GitHubService:
    def __init__(self, user_token=None):
        # User-specific token for accessing private repositories
        self.user_token = user_token
        
        # Try app authentication first
        self.client_id = os.getenv("GITHUB_CLIENT_ID")
        self.private_key = os.getenv("GITHUB_PRIVATE_KEY")
        self.installation_id = os.getenv("GITHUB_INSTALLATION_ID")

        # Fallback to PAT if app credentials not found
        self.github_token = os.getenv("GITHUB_PAT")

        # If no credentials are provided, warn about rate limits
        if not all([self.client_id, self.private_key, self.installation_id]) and not self.github_token and not self.user_token:
            print("\033[93mWarning: No GitHub credentials provided. Using unauthenticated requests with rate limit of 60 requests/hour.\033[0m")

        self.access_token = None
        self.token_expires_at = None

    # autopep8: off
    def _generate_jwt(self):
        now = int(time.time())
        payload = {
            "iat": now,
            "exp": now + (10 * 60),  # 10 minutes
            "iss": self.client_id
        }
        # Convert PEM string format to proper newlines
        return jwt.encode(payload, self.private_key, algorithm="RS256")  # type: ignore
    # autopep8: on

    def _get_installation_token(self):
        if self.access_token and self.token_expires_at > datetime.now():  # type: ignore
            return self.access_token

        jwt_token = self._generate_jwt()
        response = requests.post(
            f"https://api.github.com/app/installations/{
                self.installation_id}/access_tokens",
            headers={
                "Authorization": f"Bearer {jwt_token}",
                "Accept": "application/vnd.github+json"
            }
        )
        data = response.json()
        self.access_token = data["token"]
        self.token_expires_at = datetime.now() + timedelta(hours=1)
        return self.access_token

    def _get_headers(self):
        # Use user token first if available (for private repos)
        if self.user_token:
            return {
                "Authorization": f"token {self.user_token}",
                "Accept": "application/vnd.github+json"
            }

        # Use PAT if available
        if self.github_token:
            return {
                "Authorization": f"token {self.github_token}",
                "Accept": "application/vnd.github+json"
            }

        # Try app authentication if configured
        if all([self.client_id, self.private_key, self.installation_id]):
            token = self._get_installation_token()
            return {
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28"
            }

        # If no credentials are available, return basic headers
        return {
            "Accept": "application/vnd.github+json"
        }

    def get_default_branch(self, username, repo):
        """Get the default branch of the repository."""
        api_url = f"https://api.github.com/repos/{username}/{repo}"
        response = requests.get(api_url, headers=self._get_headers())

        if response.status_code == 200:
            return response.json().get('default_branch')
        elif response.status_code == 404:
            raise ValueError(f"Repository {username}/{repo} not found or is private")
        elif response.status_code == 403:
            raise ValueError(f"Access denied to repository {username}/{repo}. Repository may be private and require authentication")
        else:
            raise Exception(f"Failed to access repository: HTTP {response.status_code}")
        return None

    def get_github_file_paths_as_list(self, username, repo):
        """
        Fetches the file tree of an open-source GitHub repository,
        excluding static files and generated code.

        Args:
            username (str): The GitHub username or organization name
            repo (str): The repository name

        Returns:
            str: A filtered and formatted string of file paths in the repository, one per line.
        """
        def should_include_file(path):
            # Patterns to exclude
            excluded_patterns = [
                # Dependencies
                'node_modules/', 'vendor/', 'venv/',
                # Compiled files
                '.min.', '.pyc', '.pyo', '.pyd', '.so', '.dll', '.class',
                # Asset files
                '.jpg', '.jpeg', '.png', '.gif', '.ico', '.svg', '.ttf', '.woff', '.webp',
                # Cache and temporary files
                '__pycache__/', '.cache/', '.tmp/',
                # Lock files and logs
                'yarn.lock', 'poetry.lock', '*.log',
                # Configuration files
                '.vscode/', '.idea/'
            ]

            return not any(pattern in path.lower() for pattern in excluded_patterns)

        # Try to get the default branch first
        try:
            branch = self.get_default_branch(username, repo)
            if branch:
                api_url = f"https://api.github.com/repos/{
                    username}/{repo}/git/trees/{branch}?recursive=1"
                response = requests.get(api_url, headers=self._get_headers())

                if response.status_code == 200:
                    data = response.json()
                    if "tree" in data:
                        # Filter the paths and join them with newlines
                        paths = [item['path'] for item in data['tree']
                                 if should_include_file(item['path'])]
                        return "\n".join(paths)
                elif response.status_code == 403:
                    raise ValueError(f"Access denied to repository {username}/{repo}. Repository may be private and require authentication")
                elif response.status_code == 404:
                    raise ValueError(f"Repository {username}/{repo} not found or is private")
        except ValueError:
            # Re-raise specific errors from get_default_branch
            raise

        # If default branch didn't work or wasn't found, try common branch names
        for branch in ['main', 'master']:
            api_url = f"https://api.github.com/repos/{
                username}/{repo}/git/trees/{branch}?recursive=1"
            response = requests.get(api_url, headers=self._get_headers())

            if response.status_code == 200:
                data = response.json()
                if "tree" in data:
                    # Filter the paths and join them with newlines
                    paths = [item['path'] for item in data['tree']
                             if should_include_file(item['path'])]
                    return "\n".join(paths)
            elif response.status_code == 403:
                raise ValueError(f"Access denied to repository {username}/{repo}. Repository may be private and require authentication")

        raise ValueError(f"Repository {username}/{repo} not found, is empty, or is private and requires authentication")

    def get_github_readme(self, username, repo):
        """
        Fetches the README contents of an open-source GitHub repository.

        Args:
            username (str): The GitHub username or organization name
            repo (str): The repository name

        Returns:
            str: The contents of the README file.
        """
        api_url = f"https://api.github.com/repos/{username}/{repo}/readme"
        response = requests.get(api_url, headers=self._get_headers())

        if response.status_code == 404:
            raise ValueError(f"Repository {username}/{repo} or README not found")
        elif response.status_code == 403:
            raise ValueError(f"Access denied to repository {username}/{repo}. Repository may be private and require authentication")
        elif response.status_code != 200:
            raise Exception(f"Failed to fetch README: {response.status_code}, {response.text}")

        data = response.json()
        readme_content = requests.get(data['download_url']).text
        return readme_content

    def get_github_file_content(self, username, repo, filepath):
        """
        Fetches the contents of a file from an open-source GitHub repository.

        Args:
            username (str): The GitHub username or organization name
            repo (str): The repository name
            filepath (str): The path to the file within the repository

        Returns:
            str: The contents of the specified file.
        """
        api_url = f"https://api.github.com/repos/{username}/{repo}/contents/{filepath}"
        response = requests.get(api_url, headers=self._get_headers())

        if response.status_code == 404:
            raise ValueError(f"File {filepath} not found in repository {username}/{repo}")
        elif response.status_code == 403:
            raise ValueError(f"Access denied to repository {username}/{repo}. Repository may be private and require authentication")
        elif response.status_code != 200:
            raise Exception(f"Failed to fetch file: {response.status_code}, {response.text}")

        data = response.json()
        file_content = b64decode(data['content'].replace("\n", "")).decode('utf-8')
        return file_content