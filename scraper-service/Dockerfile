FROM mcr.microsoft.com/playwright/python:v1.59.0-noble

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py ./

ENV PORT=5050

EXPOSE 5050

CMD ["python", "app.py"]
