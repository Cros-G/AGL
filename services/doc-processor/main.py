"""
AGL Document Processor & Speech-to-Text Service

提供两个核心能力：
1. /api/process-document  - 文档转 Markdown（PDF/Word/PPT/图片）
2. /api/transcribe        - 语音转文字（Whisper）
"""

import os
from pathlib import Path

# 加载 .env
_env_file = Path(__file__).parent / ".env"
if _env_file.exists():
    for line in _env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

# 代理配置（模型下载需要）
_proxy = os.getenv("HTTPS_PROXY", os.getenv("HTTP_PROXY", ""))
if _proxy:
    os.environ.setdefault("HTTPS_PROXY", _proxy)
    os.environ.setdefault("HTTP_PROXY", _proxy)

# PaddlePaddle 3.x PIR/oneDNN workaround for Windows CPU
os.environ["FLAGS_use_mkldnn"] = "0"
os.environ["FLAGS_enable_pir_api"] = "0"
os.environ["FLAGS_enable_pir_in_executor"] = "0"

import tempfile
import time
import logging
from pathlib import Path
from contextlib import asynccontextmanager

# Pre-import ctranslate2 before PaddlePaddle to avoid DLL conflict on Windows
try:
    import ctranslate2  # noqa: F401
except Exception:
    pass

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("doc-processor")

ocr_engine = None
whisper_model = None

WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "base")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
UPLOAD_MAX_SIZE = 50 * 1024 * 1024  # 50MB


def get_ocr_engine():
    global ocr_engine
    if ocr_engine is None:
        logger.info("Loading PaddleOCR engine (PP-OCRv5 mobile)...")
        from paddleocr import PaddleOCR
        ocr_engine = PaddleOCR(
            text_detection_model_name="PP-OCRv5_mobile_det",
            text_recognition_model_name="PP-OCRv5_mobile_rec",
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
            device="cpu",
            enable_mkldnn=False,
        )
        logger.info("PaddleOCR loaded.")
    return ocr_engine


def get_whisper_model():
    global whisper_model
    if whisper_model is None:
        logger.info(f"Loading Whisper model: {WHISPER_MODEL_SIZE} on {WHISPER_DEVICE}...")
        from faster_whisper import WhisperModel
        whisper_model = WhisperModel(
            WHISPER_MODEL_SIZE,
            device=WHISPER_DEVICE,
            compute_type="int8" if WHISPER_DEVICE == "cpu" else "float16",
        )
        logger.info("Whisper model loaded.")
    return whisper_model


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Doc Processor service starting...")
    yield
    logger.info("Doc Processor service stopping.")


app = FastAPI(title="AGL Doc Processor", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "whisper_model": WHISPER_MODEL_SIZE, "device": WHISPER_DEVICE}


# ────────────────────────────────────────
# 文档处理
# ────────────────────────────────────────

@app.post("/api/process-document")
async def process_document(file: UploadFile = File(...)):
    start = time.time()

    filename = file.filename or "unknown"
    ext = Path(filename).suffix.lower()

    logger.info(f"Processing document: {filename}")

    data = await file.read()
    if len(data) > UPLOAD_MAX_SIZE:
        raise HTTPException(status_code=413, detail=f"文件超过 {UPLOAD_MAX_SIZE // 1024 // 1024}MB 限制")

    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        tmp.write(data)
        tmp_path = tmp.name

    try:
        markdown_text = ""
        method = "unknown"

        if ext in (".png", ".jpg", ".jpeg", ".webp", ".bmp"):
            method = "paddleocr"
            markdown_text = ocr_image(tmp_path)
        elif ext == ".pdf":
            method = "markitdown"
            markdown_text = convert_with_markitdown(tmp_path)
            if len(markdown_text.strip()) < 50:
                method = "markitdown+paddleocr"
                markdown_text = ocr_pdf(tmp_path)
        else:
            method = "markitdown"
            markdown_text = convert_with_markitdown(tmp_path)

        duration = round(time.time() - start, 2)
        logger.info(f"Done: {filename} | method={method} | {len(markdown_text)} chars | {duration}s")

        return JSONResponse({
            "filename": filename,
            "method": method,
            "markdown": markdown_text,
            "char_count": len(markdown_text),
            "duration_seconds": duration,
        })

    finally:
        os.unlink(tmp_path)


def convert_with_markitdown(file_path: str) -> str:
    try:
        from markitdown import MarkItDown
        mid = MarkItDown()
        result = mid.convert(file_path)
        return result.text_content
    except Exception as e:
        logger.warning(f"markitdown failed: {e}")
        return ""


def ocr_image(image_path: str) -> str:
    """用 PaddleOCR 3.x 识别单张图片"""
    engine = get_ocr_engine()
    results = engine.predict(image_path)

    lines = []
    for res in results:
        json_data = res.json
        inner = json_data.get("res", json_data)
        if "rec_texts" in inner:
            for text in inner["rec_texts"]:
                if text.strip():
                    lines.append(text.strip())
    return "\n".join(lines)


def ocr_pdf(pdf_path: str) -> str:
    """将 PDF 每页转为图片再 OCR"""
    try:
        import fitz  # PyMuPDF
    except ImportError:
        logger.warning("PyMuPDF not installed, trying direct OCR on PDF")
        return ocr_image(pdf_path)

    doc = fitz.open(pdf_path)
    all_text = []
    for page_num in range(len(doc)):
        page = doc[page_num]
        pix = page.get_pixmap(dpi=200)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as img_tmp:
            pix.save(img_tmp.name)
            page_text = ocr_image(img_tmp.name)
            os.unlink(img_tmp.name)
        all_text.append(f"<!-- Page {page_num + 1} -->\n{page_text}")
    doc.close()
    return "\n\n".join(all_text)


# ────────────────────────────────────────
# 语音转写
# ────────────────────────────────────────

@app.post("/api/transcribe")
async def transcribe(file: UploadFile = File(...)):
    start = time.time()
    filename = file.filename or "audio"
    logger.info(f"Transcribing: {filename} ({file.content_type})")

    data = await file.read()
    if len(data) > UPLOAD_MAX_SIZE:
        raise HTTPException(status_code=413, detail="音频文件过大")

    ext = Path(filename).suffix.lower() or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        tmp.write(data)
        tmp_path = tmp.name

    try:
        model = get_whisper_model()
        segments, info = model.transcribe(tmp_path, language="zh", beam_size=5)

        text_parts = []
        for segment in segments:
            text_parts.append(segment.text.strip())

        full_text = "".join(text_parts)
        duration = round(time.time() - start, 2)

        logger.info(f"Transcribed: {len(full_text)} chars | lang={info.language} | {duration}s")

        return JSONResponse({
            "text": full_text,
            "language": info.language,
            "duration_seconds": duration,
            "audio_duration": round(info.duration, 1),
        })

    finally:
        os.unlink(tmp_path)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("DOC_PROCESSOR_PORT", "8100"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
