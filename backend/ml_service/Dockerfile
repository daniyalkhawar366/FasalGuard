FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r ./requirements.txt

COPY . ./

WORKDIR /app/ml_service

ENV PYTHONUNBUFFERED=1
EXPOSE 5001

CMD ["python", "app.py"]
