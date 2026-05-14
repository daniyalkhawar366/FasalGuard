FROM python:3.10-slim

WORKDIR /app

# Copy and install ML service dependencies from the correct path
COPY backend/ml_service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r ./requirements.txt

# Copy ML service source, models, and credentials
COPY backend/ml_service ./ml_service
COPY backend/ml_models ./ml_models

# Copy GEE credentials if they exist
COPY backend/ml_service/gee_credentials.json ./ml_service/gee_credentials.json

WORKDIR /app/ml_service

ENV PYTHONUNBUFFERED=1
EXPOSE 5001

CMD ["python", "app.py"]
