FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
RUN python -m playwright install --with-deps chromium

COPY app.py ./

ENV PORT=5050

EXPOSE 5050

CMD ["python", "app.py"]
