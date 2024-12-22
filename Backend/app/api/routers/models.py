from pydantic import BaseModel, Field
from typing import Optional
import logging


logger = logging.getLogger("uvicorn")


class CodeGenerationBody(BaseModel):
    parsed_smart_contracts: Optional[str] = Field(
        default=None, description="Parsed smart contracts")
    custom_instructions: Optional[str] = Field(
        default=None, description="Custom instructions used by the LLM to generate the code")


class CodeGenerationResponse(BaseModel):
    html: Optional[str] = Field(
        default=None, description="Generated HTML code")
    css: Optional[str] = Field(
        default=None, description="Generated CSS code")
    javascript: Optional[str] = Field(
        default=None, description="Generated JavaScript code")
