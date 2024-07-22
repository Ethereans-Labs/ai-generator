from app.api.routers.models import CodeGenerationBody, CodeGenerationResponse
from fastapi import APIRouter
from llama_index.agent.openai import OpenAIAgent
from llama_index.core.agent import AgentChatResponse
from llama_index.core.tools import FunctionTool
from typing import Dict
import ast
import logging
import os

code_generation_router = r = APIRouter()

logger = logging.getLogger("uvicorn")


def generate_code(html: str, css: str, javascript: str):
    return {"html": html, "css": css, "javascript": javascript}


def get_agent(system_prompt: str | None = None):
    generate_code_tool = FunctionTool.from_defaults(
        fn=generate_code, return_direct=True)
    agent = OpenAIAgent.from_tools(
        tools=[generate_code_tool], system_prompt=system_prompt, verbose=True
    )

    return agent


@r.post("")
async def generate(
    body: CodeGenerationBody
) -> CodeGenerationResponse:
    system_prompt = os.getenv("CODE_GENERATION_SYSTEM_PROMPT")
    agent = get_agent(system_prompt=system_prompt)

    if body.custom_instructions:
        query = f"""{body.custom_instructions}

        Here is the code for the smart contract:
        {body.smart_contract_code}
        """
    else:
        query = f"""Here is the code for the smart contract:
        {body.smart_contract_code}"""

    response: AgentChatResponse = await agent.achat(message=query, tool_choice="generate_code")
    parsed_response: Dict[str, str] = ast.literal_eval(response.response)

    return CodeGenerationResponse(html=parsed_response.get("html"), css=parsed_response.get("css"), javascript=parsed_response.get("javascript"))
