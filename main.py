from fastapi import FastAPI, File, UploadFile, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
import uvicorn
import pandas as pd
import io
import docx
import tempfile
import os
from translation_service import TMTService

# Initialize services
app = FastAPI(
    title="FastAPI Backend",
    description="A production-ready FastAPI structure for document processing and translation.",
    version="1.1.0"
)
tmt_service = TMTService()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/ping", tags=["Health Check"])
async def ping():
    return {"status": "ok", "message": "pong"}

@app.post("/translate/csv", tags=["Translation"])
async def translate_csv(
    file: UploadFile = File(...),
    target_lang: str = Form(...),
    source_lang: str = Form("en")
):
    """
    Accepts a CSV file, translates all string content, and returns the translated CSV.
    """
    # Read the CSV into a pandas DataFrame
    contents = await file.read()
    df = pd.read_csv(io.BytesIO(contents))

    # Define a helper to translate if the value is a string
    def translate_value(val):
        if isinstance(val, str):
            return tmt_service.translate_text(val, source_lang, target_lang)
        return val

    # Apply translation across the entire dataframe
    translated_df = df.map(translate_value)

    # Convert translated dataframe back to CSV in memory
    stream = io.StringIO()
    translated_df.to_csv(stream, index=False)
    
    # Reset stream position and return as a downloadable file
    response = StreamingResponse(
        iter([stream.getvalue()]),
        media_type="text/csv"
    )
    response.headers["Content-Disposition"] = f"attachment; filename=translated_{file.filename}"
    
    return response

@app.post("/translate/docx", tags=["Translation"])
async def translate_docx(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    target_lang: str = Form(...),
    source_lang: str = Form("en")
):
    """
    Accepts a .docx file, translates text while preserving structure/formatting, and returns the modified file.
    """
    # Read docx from upload
    contents = await file.read()
    doc = docx.Document(io.BytesIO(contents))

    # Helper to translate runs in a list of paragraphs
    def translate_paragraphs(paragraphs):
        for para in paragraphs:
            for run in para.runs:
                if run.text.strip():
                    run.text = tmt_service.translate_text(run.text, source_lang, target_lang)

    # Translate main document paragraphs
    translate_paragraphs(doc.paragraphs)

    # Translate tables
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                translate_paragraphs(cell.paragraphs)

    # Save to a temporary file
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".docx")
    doc.save(temp_file.name)
    temp_file.close()

    # Clean up the temp file after response is sent
    background_tasks.add_task(os.remove, temp_file.name)

    return FileResponse(
        temp_file.name,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=f"translated_{file.filename}"
    )

@app.post("/translate/pdf", tags=["Translation"])
async def translate_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    target_lang: str = Form(...),
    source_lang: str = Form("en")
):
    """
    Accepts a .pdf file, translates text, and returns a new PDF. 
    Note: For MVP, this extracts text and re-renders it simply.
    """
    import fitz # PyMuPDF

    contents = await file.read()
    doc = fitz.open(stream=contents, filetype="pdf")
    
    # Create a new PDF for output
    out_doc = fitz.open()
    
    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        text = page.get_text("text")
        
        # Translate text
        translated_text = tmt_service.translate_text(text, source_lang, target_lang)
        
        # Create a new page with same dimensions
        new_page = out_doc.new_page(width=page.rect.width, height=page.rect.height)
        
        # Insert translated text (basic layout)
        new_page.insert_text((50, 50), translated_text, fontsize=11, fontname="helv")

    # Save output to temp file
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    out_doc.save(temp_file.name)
    out_doc.close()
    doc.close()

    background_tasks.add_task(os.remove, temp_file.name)

    return FileResponse(
        temp_file.name,
        media_type="application/pdf",
        filename=f"translated_{file.filename}"
    )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
