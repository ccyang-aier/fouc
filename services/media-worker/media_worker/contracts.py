from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

UUID_PATTERN = r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
RequestId = Annotated[str, Field(pattern=UUID_PATTERN)]
AssetHash = Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]
Operation = Literal["transcribe", "parse_document"]

MEDIA_TYPES = {
    "audio/mpeg": ".mp3", "audio/mp4": ".m4a", "audio/x-m4a": ".m4a",
    "audio/wav": ".wav", "audio/x-wav": ".wav", "audio/flac": ".flac",
    "audio/ogg": ".ogg", "audio/webm": ".webm", "video/mp4": ".mp4",
    "video/webm": ".webm", "video/quicktime": ".mov",
}
DOCUMENT_TYPES = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
}


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)


class Resource(StrictModel):
    url: str = Field(min_length=1, max_length=8192)
    expiresAt: str = Field(min_length=20, max_length=40)
    sha256: AssetHash
    size: int = Field(gt=0, le=5 * 1024**3)
    mime: str = Field(min_length=1, max_length=200)

    @model_validator(mode="after")
    def aware_expiry(self) -> "Resource":
        expiry = datetime.fromisoformat(self.expiresAt.replace("Z", "+00:00"))
        if expiry.tzinfo is None:
            raise ValueError("Resource expiry must include a timezone")
        return self


class ProcessRequest(StrictModel):
    requestId: RequestId
    operation: Operation
    resource: Resource
    timeoutMs: int = Field(default=600_000, ge=1, le=3_600_000)
    language: str | None = Field(default=None, pattern=r"^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$")

    @model_validator(mode="after")
    def operation_matches(self) -> "ProcessRequest":
        accepted = MEDIA_TYPES if self.operation == "transcribe" else DOCUMENT_TYPES
        if self.resource.mime not in accepted:
            raise ValueError("MIME type is not supported by the requested operation")
        if self.operation != "transcribe" and self.language is not None:
            raise ValueError("Language is only valid for transcription")
        return self


class TranscriptSegment(StrictModel):
    start: float = Field(ge=0)
    end: float = Field(ge=0)
    text: str = Field(max_length=100_000)

    @model_validator(mode="after")
    def ordered(self) -> "TranscriptSegment":
        if self.end < self.start:
            raise ValueError("Segment end precedes its start")
        return self


class Derived(StrictModel):
    # This is the ready subset of shared/contracts/content.ts assetDerivedSchema.
    status: Literal["ready"] = "ready"
    markdown: str | None = Field(default=None, max_length=2 * 1024**2)
    transcript: list[TranscriptSegment] | None = Field(default=None, max_length=100_000)

    @model_validator(mode="after")
    def one_result(self) -> "Derived":
        if (self.markdown is None) == (self.transcript is None):
            raise ValueError("Return exactly one derived representation")
        return self


class ProcessResponse(StrictModel):
    requestId: RequestId
    operation: Operation
    assetHash: AssetHash
    derived: Derived
    processor: str = Field(min_length=1, max_length=100)
    elapsedMs: int = Field(ge=0)

    @model_validator(mode="after")
    def matching_result(self) -> "ProcessResponse":
        if (self.operation == "transcribe") != (self.derived.transcript is not None):
            raise ValueError("Derived result does not match its operation")
        return self
