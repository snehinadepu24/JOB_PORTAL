import React from 'react';
import axios from 'axios';

const PDFJSViewer = ({ pdfUrl }) => {
  // Extract filename from URL or use default
  const getFileName = () => {
    try {
      // Try to get the filename from the URL
      const urlParts = pdfUrl.split('/');
      const fileNameWithParams = urlParts[urlParts.length - 1];
      const fileName = fileNameWithParams.split('?')[0]; // Remove query parameters
      
      // Ensure it has .pdf extension
      if (fileName.toLowerCase().endsWith('.pdf')) {
        return fileName;
      } else {
        return fileName + '.pdf';
      }
    } catch (error) {
      // Fallback to default name
      return 'resume.pdf';
    }
  };
  
  // Function to handle proper PDF download
  const handleDownload = async () => {
    try {
      // Fetch the PDF file with proper headers
      const response = await axios.get(pdfUrl, {
        responseType: 'blob',
        headers: {
          'Accept': 'application/pdf'
        }
      });
      
      // Create a blob URL from the response
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary link element to trigger the download
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', getFileName());
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      // Fallback to direct download if the fetch method fails
      window.open(pdfUrl, '_blank');
    }
  };
  
  return (
    <div className="pdf-viewer-container">
      <div className="pdf-actions">
        <button 
          onClick={handleDownload}
          className="download-btn"
        >
          Download PDF
        </button>
      </div>
      
      <div className="pdf-embed-container">
        <object
          data={pdfUrl}
          type="application/pdf"
          width="100%"
          height="500px"
        >
          <p>
            It appears your browser doesn't support embedded PDFs.
            Please use the download button above to view the PDF.
          </p>
        </object>
      </div>
    </div>
  );
};

export default PDFJSViewer;




