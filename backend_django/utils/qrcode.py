"""QR code generation utilities."""

import qrcode
from io import BytesIO
from django.core.files.base import ContentFile


def generate_qr_code(data, size=10, border=4):
    """Generate QR code from data.
    
    Args:
        data: String to encode
        size: Size of each box in pixels
        border: Border size in pixels
        
    Returns:
        PIL Image object
    """
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=size,
        border=border,
    )
    qr.add_data(data)
    qr.make(fit=True)
    return qr.make_image(fill_color='black', back_color='white')


def qr_code_to_file(data, filename_prefix='qrcode'):
    """Generate QR code and return as Django ContentFile.
    
    Args:
        data: String to encode
        filename_prefix: Prefix for generated file
        
    Returns:
        Tuple of (ContentFile, filename)
    """
    img = generate_qr_code(data)
    
    # Save to BytesIO
    img_io = BytesIO()
    img.save(img_io, format='PNG')
    img_io.seek(0)
    
    filename = f'{filename_prefix}_{data[:8]}.png'
    file = ContentFile(img_io.getvalue(), name=filename)
    
    return file, filename
