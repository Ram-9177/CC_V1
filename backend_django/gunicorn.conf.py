import multiprocessing
import os

# Tuned for small-medium droplets (2 vCPU / 2 GB class)
bind = os.getenv("GUNICORN_BIND", "0.0.0.0:8000")
worker_class = "uvicorn.workers.UvicornWorker"

cpu_count = max(1, multiprocessing.cpu_count())
workers = int(os.getenv("GUNICORN_WORKERS", min(3, cpu_count + 1)))
threads = int(os.getenv("GUNICORN_THREADS", 2))
timeout = int(os.getenv("GUNICORN_TIMEOUT", 45))
keepalive = int(os.getenv("GUNICORN_KEEPALIVE", 10))
graceful_timeout = int(os.getenv("GUNICORN_GRACEFUL_TIMEOUT", 30))
max_requests = int(os.getenv("GUNICORN_MAX_REQUESTS", 1200))
max_requests_jitter = int(os.getenv("GUNICORN_MAX_REQUESTS_JITTER", 120))

accesslog = "-"
errorlog = "-"
loglevel = os.getenv("GUNICORN_LOG_LEVEL", "info")
capture_output = True
