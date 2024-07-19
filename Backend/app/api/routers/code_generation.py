from app.api.routers.models import CodeGenerationBody, CodeGenerationResponse
from fastapi import APIRouter
from llama_index.agent.openai import OpenAIAgent
from llama_index.core.agent import AgentChatResponse
from llama_index.core.tools import FunctionTool
import ast
import logging

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
    agent = get_agent(system_prompt=body.prompt)

    query = "give me the code for snake"
    response: AgentChatResponse = await agent.achat(message=query, tool_choice="generate_code")
    parsed_response = ast.literal_eval(response.response)

    return CodeGenerationResponse(html=parsed_response.get("html"), css=parsed_response.get("css"), javascript=parsed_response.get("javascript"))
