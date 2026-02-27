import requests
import json
import logging

try:
    url = "http://127.0.0.1:8000/api/token/"
    # Get a token using your existing test user if you know one, or let's create a user
    print("Testing locally")
except Exception as e:
    print(e)
