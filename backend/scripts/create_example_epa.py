import urllib.request
import os
from fpdf import FPDF

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_DATA_RAW_DIR = os.path.join(_SCRIPT_DIR, "..", "..", "data", "raw")

class ePADocument(FPDF):
    def header(self):
        self.set_font('helvetica', 'B', 14)
        self.cell(0, 8, 'Radiologische Gemeinschaftspraxis Dr. Muster', border=False, ln=1, align='R')
        self.set_font('helvetica', '', 10)
        self.cell(0, 6, 'Gesundheitsweg 1, 85748 Garching | Tel: 089-123456', border=False, ln=1, align='R')
        self.line(10, 25, 200, 25)
        self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font('helvetica', 'I', 8)
        self.line(10, 282, 200, 282)
        self.cell(0, 10, f'ePA-Dokumenten-ID: 98765-XYZ | Seite {self.page_no()}', 0, 0, 'C')

# Initialize PDF
pdf = ePADocument()
pdf.add_page()

# Patient Data 
pdf.set_font('helvetica', 'B', 11)
pdf.cell(40, 6, 'Patient:', 0, 0)
pdf.set_font('helvetica', '', 11)
pdf.cell(0, 6, 'Max Mustermann, geb. 01.01.1980', 0, 1)

pdf.set_font('helvetica', 'B', 11)
pdf.cell(40, 6, 'KVNR:', 0, 0)
pdf.set_font('helvetica', '', 11)
pdf.cell(0, 6, 'X123456789', 0, 1)

pdf.set_font('helvetica', 'B', 11)
pdf.cell(40, 6, 'Datum:', 0, 0)
pdf.set_font('helvetica', '', 11)
pdf.cell(0, 6, '29.03.2026', 0, 1)
pdf.ln(10)

# Document Title
pdf.set_font('helvetica', 'B', 16)
pdf.cell(0, 10, 'Befundbericht: MRT des rechten Kniegelenks', ln=1)
pdf.ln(5)

# Main Text
pdf.set_font('helvetica', '', 11)
text_body = (
    "Indikation: Anhaltende Schmerzen im rechten Knie nach Distorsionstrauma beim Sport.\n\n"
    "Befund: Es zeigt sich eine unauffällige Darstellung der knöchernen Strukturen. Keine Anzeichen "
    "auf Frakturen oder Knochenödeme. Der Innenmeniskus und Außenmeniskus sind intakt. Das vordere "
    "und hintere Kreuzband sind durchgängig und normal konfiguriert."
)
pdf.multi_cell(0, 6, text_body)
pdf.ln(10)

# --- NEW: Download and Insert Real Image ---
y_before_image = pdf.get_y()
image_filename = "temp_mri_knee.jpg"

# URL for a public domain sagittal MRI of a knee from Wikimedia Commons
image_url = "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Normal_sagittal_MRI_of_the_knee.jpg/320px-Normal_sagittal_MRI_of_the_knee.jpg"

# --- NEW: Use Local Image ---
y_before_image = pdf.get_y()
image_filename = os.path.join(_DATA_RAW_DIR, "mri_knee.jpg")

# Insert image into PDF 
pdf.image(image_filename, x=65, y=y_before_image, w=80)

# Move cursor down below the image
pdf.set_y(y_before_image + 85)
# -------------------------------------------
# Add the Caption below the image
pdf.set_font('helvetica', 'I', 10)
pdf.cell(0, 6, 'Abb. 1: Sagittale T1-gewichtete MRT-Aufnahme des rechten Kniegelenks.', ln=1, align='C')

# Save the PDF
pdf.output(os.path.join(_DATA_RAW_DIR, 'ePA_Musterbefund_mit_Bild.pdf'))
print("Successfully generated 'ePA_Musterbefund_mit_Bild.pdf'")