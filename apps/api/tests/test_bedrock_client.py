import json
from unittest.mock import MagicMock

from build_block.bedrock.client import BedrockClient


def test_embed_parses_titan_response():
    client = BedrockClient.__new__(BedrockClient)
    client.region = "us-east-1"
    mock_runtime = MagicMock()
    mock_runtime.invoke_model.return_value = {
        "body": MagicMock(read=lambda: json.dumps({"embedding": [0.1, 0.2, 0.3]}).encode())
    }
    client._runtime = mock_runtime

    result = client.embed("hello world")

    assert result == [0.1, 0.2, 0.3]
    mock_runtime.invoke_model.assert_called_once()


def test_converse_returns_joined_text():
    client = BedrockClient.__new__(BedrockClient)
    client.region = "us-east-1"
    mock_runtime = MagicMock()
    mock_runtime.converse.return_value = {
        "output": {"message": {"content": [{"text": "Section one."}, {"text": "Section two."}]}}
    }
    client._runtime = mock_runtime

    result = client.converse(
        model_id="anthropic.claude-3-haiku-20240307-v1:0",
        user_message="Write a summary",
        system_message="You are helpful",
    )

    assert result == "Section one.\nSection two."
