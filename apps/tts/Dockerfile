FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY fetch-models.sh .
RUN sh fetch-models.sh

COPY *.py ./

ENV TTS_HOST=0.0.0.0
ENV TTS_PORT=8788
EXPOSE 8788

CMD ["python", "server.py"]
