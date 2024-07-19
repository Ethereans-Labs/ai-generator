from pydantic import BaseModel, Field
from typing import Optional
import logging


logger = logging.getLogger("uvicorn")


class CodeGenerationBody(BaseModel):
    natspec: Optional[str] = Field(default=None, description="Natspec")
    smart_contract_code: Optional[str] = Field(
        default=None, description="Smart contract code")
    prompt: Optional[str] = Field(
        default=None, description="Prompt used by the LLM to generate the code")


class CodeGenerationResponse(BaseModel):
    html: Optional[str] = Field(
        default=None, description="Generated HTML code")
    css: Optional[str] = Field(
        default=None, description="Generated CSS code")
    javascript: Optional[str] = Field(
        default=None, description="Generated JavaScript code")
