import React from 'react';
import { Card, CardContent } from "@/@/components/ui/card";
import { Alert, AlertDescription } from "@/@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Badge } from "@/@/components/ui/badge";

const DocumentTable = ({ alertHistory = [] }) => {
  const getFileIcon = (fileName) => {
    if (!fileName) return "https://www.svgrepo.com/show/533213/file.svg";
    
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    const iconMap = {
      'pdf': "https://www.svgrepo.com/show/452139/acrobat-reader.svg",
      'doc': "https://www.svgrepo.com/show/375299/word-document.svg",
      'docx': "https://www.svgrepo.com/show/303194/microsoft-word-2013-logo-logo.svg",
      'xls': "https://www.svgrepo.com/show/375311/excel-document.svg",
      'xlsx': "https://www.svgrepo.com/show/452066/ms-excel.svg",
      'txt': "https://www.svgrepo.com/show/375297/txt-document.svg",
      'jpg': "https://www.svgrepo.com/show/33989/jpg.svg",
      'jpeg': "https://www.svgrepo.com/show/330750/jpeg.svg",
      'png': "https://www.svgrepo.com/show/34022/png.svg"
    };
    
    return iconMap[extension] || "https://www.svgrepo.com/show/533213/file.svg";
  };

  const getFileName = (url) => {
    if (!url) return '-';
    const segments = url.split('/');
    return segments[segments.length - 1];
  };

  const handleDownload = (docLink: string) => {
    if (!docLink) return;
    window.open(docLink, '_blank');
  };

  if (!Array.isArray(alertHistory)) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Document history is not available</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="h-[24.7rem] overflow-auto">
      <CardContent className="p-0">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr className="text-xs font-medium text-gray-500">
              <th className="px-4 py-3 text-left">Action Type</th>
              <th className="px-4 py-3 text-left">File Type</th>
              <th className="px-4 py-3 text-left">Document</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {alertHistory.map((history, index) => (
              <tr key={index} className="text-xs hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Badge variant="outline">{history.action_type || 'N/A'}</Badge>
                </td>
                <td className="px-4 py-3">
                  {history.doc_link ? (
                    <img 
                      src={getFileIcon(getFileName(history.doc_link))}
                      alt="file type"
                      className="w-5 h-5"
                    />
                  ) : (
                    <span className="text-gray-500">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {history.doc_link ? (
                    <button
                      onClick={() => handleDownload(history.doc_link)}
                      className="text-blue-600 hover:text-blue-800 underline flex items-center gap-2"
                    >
                      {getFileName(history.doc_link)}
                    </button>
                  ) : (
                    <span className="text-gray-500">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
};

export default DocumentTable;