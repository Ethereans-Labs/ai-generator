import os
from llama_index.core.settings import Settings


def init_settings():
    model_provider = os.getenv("MODEL_PROVIDER")
    match model_provider:
        case "openai":
            init_openai()
        case _:
            raise ValueError(f"Invalid model provider: {model_provider}")

    Settings.chunk_size = int(os.getenv("CHUNK_SIZE", "1024"))
    Settings.chunk_overlap = int(os.getenv("CHUNK_OVERLAP", "20"))


def init_openai():
    from llama_index.core.constants import DEFAULT_TEMPERATURE
    from llama_index.embeddings.openai import OpenAIEmbedding
    from llama_index.llms.openai import OpenAI

    max_tokens = os.getenv("LLM_MAX_TOKENS")
    config = {
        "model": os.getenv("MODEL"),
        "temperature": float(os.getenv("LLM_TEMPERATURE", DEFAULT_TEMPERATURE)),
        "max_tokens": int(max_tokens) if max_tokens is not None else None,
    }
    Settings.llm = OpenAI(**config)

    dimensions = os.getenv("EMBEDDING_DIM")
    config = {
        "model": os.getenv("EMBEDDING_MODEL"),
        "dimensions": int(dimensions) if dimensions is not None else None,
    }
    Settings.embed_model = OpenAIEmbedding(**config)
