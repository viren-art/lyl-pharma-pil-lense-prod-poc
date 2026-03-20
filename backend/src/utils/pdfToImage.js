import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// LYL_DEP: pdf-poppler@^0.2.1

/**
 * Convert PDF pages to base64-encoded PNG images
 * Returns array of { pageNumber, imageBase64 }
 */
export async function convertPdfToImages(pdfBuffer) {
  const tempDir = path.join(os.tmpdir(), `pil-lens-${randomUUID()}`);
  const pdfPath = path.join(tempDir, 'input.pdf');
  
  try {
    // Create temp directory
    await fs.mkdir(tempDir, { recursive: true });
    
    // Write PDF to temp file
    await fs.writeFile(pdfPath, pdfBuffer);
    
    // Convert PDF to images using pdf-poppler
    const { convert } = await import('pdf-poppler');
    
    const options = {
      format: 'png',
      out_dir: tempDir,
      out_prefix: 'page',
      page: null // Convert all pages
    };
    
    await convert(pdfPath, options);
    
    // Read generated images
    const files = await fs.readdir(tempDir);
    const imageFiles = files
      .filter(f => f.startsWith('page') && f.endsWith('.png'))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || '0');
        const numB = parseInt(b.match(/\d+/)?.[0] || '0');
        return numA - numB;
      });
    
    const pageImages = [];
    
    for (let i = 0; i < imageFiles.length; i++) {
      const imagePath = path.join(tempDir, imageFiles[i]);
      const imageBuffer = await fs.readFile(imagePath);
      const imageBase64 = imageBuffer.toString('base64');
      
      pageImages.push({
        pageNumber: i + 1,
        imageBase64
      });
    }
    
    console.info('PDF converted to images', {
      pageCount: pageImages.length,
      tempDir
    });
    
    return pageImages;
    
  } catch (error) {
    console.error('PDF to image conversion failed', {
      error: error.message,
      tempDir
    });
    throw new Error(`Failed to convert PDF to images: ${error.message}`);
    
  } finally {
    // Cleanup temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.warn('Failed to cleanup temp directory', {
        tempDir,
        error: cleanupError.message
      });
    }
  }
}

/**
 * Mock implementation for development (when pdf-poppler not available)
 * Generates placeholder images
 */
export async function mockConvertPdfToImages(pageCount = 5) {
  console.warn('Using mock PDF to image conversion');
  
  const pageImages = [];
  
  for (let i = 1; i <= pageCount; i++) {
    // Create a simple placeholder image (1x1 transparent PNG)
    const placeholderBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    
    pageImages.push({
      pageNumber: i,
      imageBase64: placeholderBase64
    });
  }
  
  return pageImages;
}