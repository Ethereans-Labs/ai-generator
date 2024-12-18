from app.api.routers.models import CodeGenerationBody, CodeGenerationResponse
from fastapi import APIRouter, HTTPException, Header, Request
from github import Github
from github.GithubException import GithubException, BadCredentialsException
from llama_index.agent.openai import OpenAIAgent
from llama_index.core.agent import AgentChatResponse
from llama_index.core.constants import DEFAULT_TEMPERATURE
from llama_index.core.tools import FunctionTool
from llama_index.llms.openai import OpenAI
from typing import Annotated, Dict
import ast
import logging
import os
import time

code_generation_router = r = APIRouter()

logger = logging.getLogger("uvicorn")

MAX_CALLS_PER_MINUTE = int(os.getenv("MAX_CALLS_PER_MINUTE"))


def generate_code(html: str, css: str, javascript: str):
    return {"html": html, "css": css, "javascript": javascript}


def get_agent(llm: OpenAI | None = None, system_prompt: str | None = None):
    generate_code_tool = FunctionTool.from_defaults(
        fn=generate_code, return_direct=True)
    agent = OpenAIAgent.from_tools(
        tools=[generate_code_tool], llm=llm, system_prompt=system_prompt, verbose=True
    )
    return agent


def get_github_user(token):
    try:
        g = Github(token)
        user = g.get_user()
        user.login
        return user
    except BadCredentialsException:
        return None
    except GithubException:
        return None


def check_rate_limit(calls_per_user: Dict[str, list], username: str):
    current_time = time.time()
    one_minute_ago = current_time - 60

    calls_timestamps = calls_per_user.get(username, [])
    calls_timestamps = [ts for ts in calls_timestamps if ts > one_minute_ago]

    if len(calls_timestamps) >= MAX_CALLS_PER_MINUTE:
        return False

    calls_timestamps.append(current_time)
    calls_per_user[username] = calls_timestamps

    if not calls_timestamps:
        calls_per_user.pop(username, None)

    return True


@r.post("")
async def generate(
    body: CodeGenerationBody,
    request: Request,
    github_access_token: Annotated[str | None, Header()] = None,
    openai_api_key: Annotated[str | None, Header()] = None
) -> CodeGenerationResponse:
    calls_per_user: Dict[str, list] = request.state.calls_per_user

    github_user = get_github_user(github_access_token)

    if not github_user:
        raise HTTPException(
            status_code=401, detail="Invalid Github access token")

    if not openai_api_key:
        username = github_user.login
        if not check_rate_limit(calls_per_user, username):
            raise HTTPException(
                status_code=429, detail=f"Rate limit exceeded. You can only make {MAX_CALLS_PER_MINUTE} calls per minute without providing an OpenAI API key.")

    if openai_api_key:
        config = {
            "model": os.getenv("MODEL"),
            "temperature": float(os.getenv("LLM_TEMPERATURE", DEFAULT_TEMPERATURE)),
            "api_key": openai_api_key
        }
        llm = OpenAI(**config)
    else:
        llm = None

    system_prompt = os.getenv("CODE_GENERATION_SYSTEM_PROMPT")
    agent = get_agent(llm=llm, system_prompt=system_prompt)

    if body.custom_instructions:
        query = f"""{body.custom_instructions}

        Here is the code for the smart contract:
        {body.smart_contract_code}
        """
    else:
        query = f"""Here is the code for the smart contract:
        {body.smart_contract_code}"""

    try:
        response: AgentChatResponse = await agent.achat(message=query, tool_choice="generate_code")
    except Exception as e:
        if hasattr(e, 'code') and e.code == "invalid_api_key":
            raise HTTPException(
                status_code=401, detail="Invalid OpenAI API key")
        else:
            raise e

    parsed_response: Dict[str, str] = ast.literal_eval(response.response)

    return CodeGenerationResponse(
        html=parsed_response.get("html"),
        css=parsed_response.get("css"),
        javascript=parsed_response.get("javascript")
    )
