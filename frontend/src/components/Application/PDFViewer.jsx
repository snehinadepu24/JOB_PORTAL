import React from 'react';
import axios from 'axios';

const PDFViewer = ({ pdfUrl }) => {
  // Create a Google Docs viewer URL
  const googleDocsViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(pdfUrl)}&embedded=true`;
  
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
        <iframe
          src={googleDocsViewerUrl}
          width="100%"
          height="500px"
          frameBorder="0"
          title="PDF Viewer"
        >
          <p>Your browser doesn't support iframes. Please use the buttons above to view the PDF.</p>
        </iframe>
      </div>
    </div>
  );
};

export default PDFViewer;






