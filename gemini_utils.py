"""Shared helpers for Gemini API key rotation and content generation."""

from __future__ import annotations

import os
import re
import time
from typing import List, Sequence

import google.generativeai as genai


def collect_api_keys(*candidates: str | None) -> List[str]:
    """Collect unique Gemini API keys from explicit values and env vars."""

    env_candidates = [os.getenv("GOOGLE_API_KEYS"), os.getenv("GOOGLE_API_KEY")]
    values = [*candidates, *env_candidates]
    keys: List[str] = []

    for value in values:
        if not value:
            continue

        for part in re.split(r"[\n,;]+", str(value)):
            key = part.strip()
            if key and key not in keys:
                keys.append(key)

    return keys


def _configure_model(api_key: str | None, model_name: str):
    if api_key:
        genai.configure(api_key=api_key)
    return genai.GenerativeModel(model_name)


class GeminiKeyRotator:
    """Keep track of the last successful Gemini API key."""

    def __init__(self, api_keys: Sequence[str]):
        self._keys = [key for key in api_keys if key]
        self._current_index = 0

    def has_keys(self) -> bool:
        return bool(self._keys)

    def generate_content(
        self,
        prompt: str,
        model_name: str,
        *,
        max_attempts: int = 3,
        retry_delay: int = 60,
        error_label: str = "Gemini request",
    ):
        """Generate content starting from the last successful key."""

        if not self._keys:
            raise RuntimeError("No Gemini API keys are configured")

        last_error = None
        total_keys = len(self._keys)

        for attempt in range(1, max_attempts + 1):
            start_index = self._current_index % total_keys

            for offset in range(total_keys):
                index = (start_index + offset) % total_keys
                api_key = self._keys[index]

                try:
                    model = _configure_model(api_key, model_name)
                    response = model.generate_content(prompt)
                    self._current_index = index
                    return response
                except Exception as error:
                    last_error = error
                    print(f"{error_label} failed with key {index + 1}/{total_keys}: {error}")

            if attempt < max_attempts:
                print(f"Retrying Gemini request with another key in {retry_delay} seconds...")
                time.sleep(retry_delay)

        raise last_error

def generate_content_with_fallback(
    prompt: str,
    model_name: str,
    api_keys: Sequence[str],
    *,
    max_attempts: int = 3,
    retry_delay: int = 60,
    error_label: str = "Gemini request",
):
    """Generate content using each API key until one succeeds."""

    rotator = GeminiKeyRotator(api_keys)
    return rotator.generate_content(
        prompt,
        model_name,
        max_attempts=max_attempts,
        retry_delay=retry_delay,
        error_label=error_label,
    )