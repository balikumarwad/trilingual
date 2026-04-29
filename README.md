# FastAPI Backend Project

This project provides a robust starting point for a Python-based backend using FastAPI.

## Features
- **FastAPI**: Modern, fast (high-performance) web framework.
- **CORS Configured**: Ready to communicate with a React frontend on `http://localhost:3000`.
- **Health Check**: `/ping` endpoint for status monitoring.
- **Auto-Documentation**: Swagger UI available at `/docs`.
- **Dependency Stack**: Includes `pandas`, `python-docx`, and `PyMuPDF` for document and data processing.

## Setup Instructions

1. **Create a Virtual Environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the Server**:
   ```bash
   python main.py
   ```

4. **Access Documentation**:
   Visit `http://localhost:3000/docs` in your browser.
