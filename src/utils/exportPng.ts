import html2canvas from 'html2canvas';

export async function exportPageToPng(elementId: string, filename: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id "${elementId}" not found`);
    return;
  }

  try {
    // Create canvas from the element
    const canvas = await html2canvas(element, {
      backgroundColor: '#1a1a2e', // Match app background
      scale: 2, // Higher quality
      logging: false,
      useCORS: true,
    });

    // Convert to blob and download
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}-${new Date().toISOString().split('T')[0]}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    }, 'image/png');
  } catch (error) {
    console.error('Failed to export PNG:', error);
    alert('Failed to export image. Please try again.');
  }
}




