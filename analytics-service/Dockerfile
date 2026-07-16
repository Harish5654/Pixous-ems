# syntax=docker/dockerfile:1
#
# Python face-recognition / OCR service (FastAPI).
#
# NOTE ON RESOURCES: this image is large and memory-hungry — dlib
# (face_recognition), PyTorch (easyocr) and Tesseract together need well over
# 512 MB of RAM at runtime. It will NOT run on Render's free tier; deploy it on
# a Standard instance (or larger). See DEPLOY_RENDER.md.

FROM python:3.11-slim AS runtime
WORKDIR /app

# System libraries: cmake + g++ to build dlib, tesseract for pytesseract,
# libglib/libgomp for opencv-python-headless and torch.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        cmake \
        tesseract-ocr \
        libglib2.0-0 \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install CPU-only PyTorch first (much smaller than the default CUDA build)
# so easyocr reuses it instead of pulling the GPU wheels.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Render injects PORT; fall back to 8082 locally.
ENV PORT=8082
EXPOSE 8082
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
