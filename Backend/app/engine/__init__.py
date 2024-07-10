import os
from llama_index.core.settings import Settings
from llama_index.core.agent import AgentRunner
from app.engine.tools import ToolFactory


def get_chat_engine():
    system_prompt = os.getenv("SYSTEM_PROMPT")
    tools = []

    # Add additional tools
    tools += ToolFactory.from_env()

    return AgentRunner.from_llm(
        llm=Settings.llm,
        tools=tools,
        system_prompt=system_prompt,
        verbose=True,
    )
