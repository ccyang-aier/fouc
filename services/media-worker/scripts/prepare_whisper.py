"""Explicit, size-bounded public model preparation; never uses implicit HF keys."""
import hashlib
import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ["HF_HUB_DISABLE_IMPLICIT_TOKEN"] = "1"
os.environ["HF_HUB_DISABLE_XET"] = "1"
os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"

from huggingface_hub import HfApi, hf_hub_download
from media_worker.whisper_config import MODEL_FILES, MODEL_REPOSITORIES, REQUIRED_MODEL_FILES, WhisperSettings


def retry(operation):
    for attempt in range(3):
        try:
            return operation()
        except Exception as error:
            if attempt == 2:
                raise RuntimeError(f"Public model preparation failed ({type(error).__name__}); no credentials were used.") from None
            print(f"Public model transfer retry {attempt + 1}/2 ({type(error).__name__}).", flush=True)
            time.sleep(2 ** attempt)


def main():
    config = WhisperSettings.from_environment()
    if config.model_path is not None:
        raise RuntimeError("Explicit model_path is local-only; prepare the managed model cache without this override.")
    repo = MODEL_REPOSITORIES[config.model]
    info = retry(lambda: HfApi(token=False).model_info(repo, files_metadata=True, token=False))
    files = [entry for entry in info.siblings if entry.rfilename in MODEL_FILES]
    if not set(REQUIRED_MODEL_FILES).issubset({entry.rfilename for entry in files}) or any(entry.size is None for entry in files):
        raise RuntimeError("Official model metadata is incomplete; no unbounded download attempted.")
    total = sum(entry.size for entry in files)
    if total > config.max_download_bytes:
        raise RuntimeError(f"Model requires {total} bytes, above the configured {config.max_download_bytes}-byte download budget.")
    config.directory.mkdir(parents=True, exist_ok=True)
    print(f"Preparing public {repo} at revision {info.sha}: {total} bytes in the isolated model cache.", flush=True)
    evidence = []
    for entry in files:
        downloaded = Path(retry(lambda: hf_hub_download(repo, entry.rfilename, revision=info.sha,
                                                       local_dir=config.directory, token=False)))
        if downloaded.stat().st_size != entry.size:
            raise RuntimeError("Downloaded model artifact size did not match official metadata.")
        with downloaded.open("rb") as content:
            digest = hashlib.file_digest(content, "sha256").hexdigest()
        if entry.lfs is not None and digest != entry.lfs.sha256:
            raise RuntimeError("Downloaded model artifact checksum did not match official metadata.")
        evidence.append({"name": entry.rfilename, "bytes": entry.size, "sha256": digest})
        print(f"Verified {entry.rfilename}: {entry.size} bytes.", flush=True)
    manifest = {"repository": repo, "revision": info.sha, "bytes": total, "files": evidence}
    (config.directory / "fouc-model.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print("PASS model preparation: size and checksums verified; HTTP inference uses local files only.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error) if isinstance(error, RuntimeError) else f"Model preparation failed ({type(error).__name__}).", file=sys.stderr)
        sys.exit(1)
